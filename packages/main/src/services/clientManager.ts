import fs from 'node:fs'
import path from 'node:path'
import { buffer } from 'node:stream/consumers'
import { pipeline } from 'node:stream/promises'
import AdmZip from 'adm-zip'
import type {
  ClientStatePayload,
  ClientUpdatePayload,
  ReleaseAssetInfo,
  ReleaseInfo,
  VersionCatalogPayload,
} from '@shindo/shared'
import { distributionConfig, resolveClientRepo, sanitizeVersionId } from '../config/distributionConfig'
import { getBaseDataDir, getTempDir, getVersionsDir } from '../utils/pathResolver'
import { downloadFromUrl, loadRemoteVersionText, loadVersionCatalogFromCdn, resolveClientVersionFromCdn } from './cdnClient'
import { downloadAsset, fetchLatestRelease, GitHubAsset, GitHubRelease } from './githubClient'
import { loadConfig } from './configService'

const VERSION_FILE_ENCODING: BufferEncoding = 'utf8'
const VERSION_MARKER_NAME = '.client-version'
const LEGACY_VERSION_FILE_NAME = 'version.txt'

export interface EnsureClientOptions {
  force?: boolean
  versionId?: string
  build?: number | null
}

interface ClientStorageLayout {
  versionId: string
  clientDir: string
  versionMarkerFile: string
}

interface ResolvedClientSource {
  provider: 'cdn' | 'github'
  versionId: string
  packageUrl: string
  remoteVersion: string
  buildNumber?: number | null
  baseVersion?: string | null
  assetsIndex?: string | null
  hintedVersionJsonPath?: string | null
  release?: ReleaseInfo
}

interface ParsedClientJson {
  baseVersion: string | null
  id: string
  assets: string | null
}

function findAssetByName(assets: GitHubAsset[], names: string[]): GitHubAsset | null {
  const normalized = names.map((item) => item.toLowerCase())
  return (
    assets.find((asset) => normalized.includes(asset.name?.toLowerCase() ?? '')) ?? null
  )
}

function buildVersionAssetCandidates(versionId: string): string[] {
  return [
    `version-${versionId}.txt`,
    `${versionId}.version.txt`,
    distributionConfig.client.defaultVersionAssetName,
  ]
}

function buildPackageAssetCandidates(versionId: string): string[] {
  return [
    `${versionId}.zip`,
    distributionConfig.client.defaultPackageAssetName,
  ]
}

function mapAsset(asset: GitHubAsset): ReleaseAssetInfo {
  return {
    name: asset.name,
    downloadUrl: asset.browser_download_url,
    size: asset.size,
    contentType: asset.content_type,
  }
}

function mapRelease(release: GitHubRelease): ReleaseInfo {
  return {
    id: release.id,
    name: release.name,
    tagName: release.tag_name,
    body: release.body,
    url: release.html_url,
    publishedAt: release.published_at,
    assets: (release.assets ?? []).map(mapAsset),
  }
}

function resolveStorageLayout(versionIdInput?: string): ClientStorageLayout {
  const fallbackVersion = loadConfig().versionId
  const versionId = sanitizeVersionId(versionIdInput ?? fallbackVersion)
  const clientDir = path.join(getVersionsDir(), versionId)
  fs.mkdirSync(clientDir, { recursive: true })
  return {
    versionId,
    clientDir,
    versionMarkerFile: path.join(clientDir, VERSION_MARKER_NAME),
  }
}

function readLegacyVersionMarker(versionId: string): string | null {
  if (versionId !== distributionConfig.client.defaultVersionId) {
    return null
  }

  const legacy = path.join(getBaseDataDir(), LEGACY_VERSION_FILE_NAME)
  if (!fs.existsSync(legacy)) {
    return null
  }

  const value = fs.readFileSync(legacy, VERSION_FILE_ENCODING).trim()
  return value.length > 0 ? value : null
}

function readLocalVersion(versionFile: string, versionId: string): string | null {
  if (fs.existsSync(versionFile)) {
    const value = fs.readFileSync(versionFile, VERSION_FILE_ENCODING).trim()
    return value.length > 0 ? value : null
  }
  return readLegacyVersionMarker(versionId)
}

function writeLocalVersion(versionFile: string, version: string): void {
  fs.writeFileSync(versionFile, `${version}\n`, VERSION_FILE_ENCODING)
}

function resolveHintedVersionJson(clientDir: string, hintedPath: string): string | null {
  const normalized = hintedPath.trim()
  if (!normalized) return null

  const asAbsolute = path.isAbsolute(normalized) ? normalized : path.join(clientDir, normalized)
  return fs.existsSync(asAbsolute) ? asAbsolute : null
}

function locateVersionJson(clientDir: string, versionId: string, hintedPath?: string | null): string | null {
  if (hintedPath) {
    const hinted = resolveHintedVersionJson(clientDir, hintedPath)
    if (hinted) return hinted
  }

  const directCandidates = [
    path.join(clientDir, `${versionId}.json`),
    path.join(clientDir, 'ShindoClient.json'),
  ]

  for (const candidate of directCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  const queue: string[] = [clientDir]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue
    const entries = fs.readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        queue.push(full)
        continue
      }
      if (!entry.name.toLowerCase().endsWith('.json')) {
        continue
      }
      if (entry.name === `${versionId}.json` || entry.name === 'ShindoClient.json') {
        return full
      }
    }
  }

  return null
}

function parseClientJson(jsonPath: string | null, fallbackVersionId: string): ParsedClientJson {
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    return { baseVersion: null, id: fallbackVersionId, assets: null }
  }

  const content = fs.readFileSync(jsonPath, VERSION_FILE_ENCODING)
  const data = JSON.parse(content) as {
    inheritsFrom?: string
    minecraftVersion?: string
    id?: string
    assets?: string
  }

  const baseVersion = data.inheritsFrom ?? data.minecraftVersion ?? null
  const id = data.id ?? fallbackVersionId
  const assets = data.assets ?? null
  return { baseVersion, id, assets }
}

async function downloadZip(url: string, destinationFile: string): Promise<void> {
  const stream = await downloadFromUrl(url)
  const writeStream = fs.createWriteStream(destinationFile)
  await pipeline(stream, writeStream)
}

async function extractZip(zipFile: string, destinationDir: string): Promise<void> {
  const zip = new AdmZip(zipFile)
  zip.extractAllTo(destinationDir, true)
}

async function resolveFromCdn(versionId: string, build?: number | null): Promise<ResolvedClientSource | null> {
  const entry = await resolveClientVersionFromCdn(versionId, build)
  if (!entry?.packageUrl) {
    return null
  }

  const remoteVersion =
    entry.buildVersion ??
    (entry.versionUrl ? await loadRemoteVersionText(entry.versionUrl) : null)

  if (!remoteVersion) {
    return null
  }

  return {
    provider: 'cdn',
    versionId,
    packageUrl: entry.packageUrl,
    remoteVersion,
    buildNumber: entry.buildNumber ?? null,
    baseVersion: entry.baseVersion,
    assetsIndex: entry.assetsIndex,
    hintedVersionJsonPath: entry.versionJsonPath,
  }
}

async function loadRemoteVersionFromAsset(asset: GitHubAsset): Promise<string> {
  const stream = await downloadAsset(asset.browser_download_url)
  const buf = await buffer(stream)
  return buf.toString(VERSION_FILE_ENCODING).trim()
}

async function resolveFromGithub(versionId: string): Promise<ResolvedClientSource> {
  const repo = resolveClientRepo(versionId)
  const release = await fetchLatestRelease(repo)
  const assets = release.assets ?? []

  const versionAsset = findAssetByName(assets, buildVersionAssetCandidates(versionId))
  const zipAsset = findAssetByName(assets, buildPackageAssetCandidates(versionId))

  if (!versionAsset || !zipAsset) {
    throw new Error(`Release assets for version ${versionId} not found in ${repo}`)
  }

  const remoteVersion = await loadRemoteVersionFromAsset(versionAsset)

  return {
    provider: 'github',
    versionId,
    packageUrl: zipAsset.browser_download_url,
    remoteVersion,
    release: mapRelease(release),
  }
}

async function resolveClientSource(versionId: string, build?: number | null): Promise<ResolvedClientSource> {
  const fromCdn = await resolveFromCdn(versionId, build)
  if (fromCdn) {
    return fromCdn
  }

  return resolveFromGithub(versionId)
}

export async function ensureClientUpToDate(
  { force = false, versionId: requestedVersionId, build }: EnsureClientOptions = {},
): Promise<ClientUpdatePayload> {
  const layout = resolveStorageLayout(requestedVersionId)
  const source = await resolveClientSource(layout.versionId, build)
  const localVersion = readLocalVersion(layout.versionMarkerFile, layout.versionId)

  if (!force && localVersion && localVersion === source.remoteVersion) {
    const jsonPath = locateVersionJson(layout.clientDir, layout.versionId, source.hintedVersionJsonPath)
    const parsed = parseClientJson(jsonPath, layout.versionId)

    return {
      updated: false,
      version: localVersion,
      baseVersion: source.baseVersion ?? parsed.baseVersion,
      versionId: parsed.id,
      clientDir: layout.clientDir,
      versionJsonPath: jsonPath,
      clientPackagePath: null,
      assetsIndex: source.assetsIndex ?? parsed.assets,
      release: source.release,
    }
  }

  const tempDir = getTempDir()
  const zipPath = path.join(tempDir, `${layout.versionId}-${source.remoteVersion}.zip`)

  await downloadZip(source.packageUrl, zipPath)
  fs.rmSync(layout.clientDir, { recursive: true, force: true })
  fs.mkdirSync(layout.clientDir, { recursive: true })
  await extractZip(zipPath, layout.clientDir)
  fs.rmSync(zipPath, { force: true })
  writeLocalVersion(layout.versionMarkerFile, source.remoteVersion)

  const jsonPath = locateVersionJson(layout.clientDir, layout.versionId, source.hintedVersionJsonPath)
  const parsed = parseClientJson(jsonPath, layout.versionId)

  return {
    updated: true,
    version: source.remoteVersion,
    baseVersion: source.baseVersion ?? parsed.baseVersion,
    versionId: parsed.id,
    clientDir: layout.clientDir,
    versionJsonPath: jsonPath,
    clientPackagePath: null,
    assetsIndex: source.assetsIndex ?? parsed.assets,
    release: source.release,
  }
}

export function getLocalClientState(options?: { versionId?: string }): ClientStatePayload {
  const layout = resolveStorageLayout(options?.versionId)
  const localVersion = readLocalVersion(layout.versionMarkerFile, layout.versionId)
  const jsonPath = locateVersionJson(layout.clientDir, layout.versionId)
  const parsed = parseClientJson(jsonPath, layout.versionId)

  return {
    version: localVersion,
    baseVersion: parsed.baseVersion,
    versionId: parsed.id,
    clientDir: layout.clientDir,
    versionJsonPath: jsonPath,
    clientPackagePath: null,
    assetsIndex: parsed.assets,
  }
}

export async function getVersionCatalog(): Promise<VersionCatalogPayload> {
  const remote = await loadVersionCatalogFromCdn()
  if (remote && remote.entries.length > 0) {
    return remote
  }

  const config = loadConfig()
  const local = getLocalClientState({ versionId: config.versionId })
  const buildNumber = local.version ? Number(local.version.replace(/[^\d]/g, '')) : null
  const normalizedBuild = Number.isFinite(buildNumber) && (buildNumber ?? 0) > 0 ? buildNumber : 0

  return {
    updatedAt: null,
    defaultVersionId: config.versionId,
    entries: [
      {
        id: config.versionId,
        name: `Shindo Client ${local.baseVersion ?? '1.8.9'}`,
        minecraftVersion: local.baseVersion ?? '1.8.9',
        bannerUrl: null,
        assetsIndex: local.assetsIndex ?? null,
        baseVersion: local.baseVersion ?? null,
        latestBuild: normalizedBuild || null,
        latestSemver: local.version,
        builds: normalizedBuild
          ? [
              {
                build: normalizedBuild,
                semver: local.version,
                label: `Build ${normalizedBuild}`,
                packageUrl: null,
                versionUrl: null,
                versionJsonPath: local.versionJsonPath ?? null,
                releasedAt: null,
              },
            ]
          : [],
      },
    ],
  }
}
