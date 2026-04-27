import type {
  ClientStatePayload,
  ClientUpdatePayload,
  ReleaseChannel,
  ReleaseAssetInfo,
  ReleaseInfo,
  VersionCatalogPayload,
} from '@shindo/shared';
import AdmZip from 'adm-zip';
import fs from 'node:fs';
import path from 'node:path';
import { buffer } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';
import {
  distributionConfig,
  resolveClientRepo,
  sanitizeVersionId,
} from '../config/distributionConfig';
import { getBaseDataDir, getTempDir, getVersionsDir } from '../utils/pathResolver';
import {
  downloadFromUrl,
  loadRemoteVersionText,
  loadVersionCatalogFromCdn,
  resolveClientVersionFromCdn,
} from './cdnClient';
import { loadConfig } from './configService';
import type { GitHubAsset, GitHubRelease } from './githubClient';
import { downloadAsset, fetchLatestRelease } from './githubClient';

// ─── Constants ───────────────────────────────────────────────────────────────

const VERSION_FILE_ENCODING: BufferEncoding = 'utf8';
const VERSION_MARKER_NAME = '.client-version';
const LEGACY_VERSION_FILE_NAME = 'version.txt';

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface EnsureClientOptions {
  force?: boolean;
  versionId?: string;
  build?: number | null;
  releaseChannel?: ReleaseChannel;
}

// ─── Internal Types ───────────────────────────────────────────────────────────

interface ClientStorageLayout {
  versionId: string;
  clientDir: string;
  versionMarkerFile: string;
}

interface ResolvedClientSource {
  provider: 'cdn' | 'github';
  versionId: string;
  packageUrl: string;
  remoteVersion: string;
  buildNumber?: number | null;
  jarUrl?: string | null;
  legacyJarUrl?: string | null;
  baseVersion?: string | null;
  assetsIndex?: string | null;
  hintedVersionJsonPath?: string | null;
  release?: ReleaseInfo;
}

interface ParsedClientJson {
  baseVersion: string | null;
  id: string;
  assets: string | null;
}

// ─── Asset Helpers ────────────────────────────────────────────────────────────

function findAssetByName(assets: GitHubAsset[], names: string[]): GitHubAsset | null {
  const lower = names.map((n) => n.toLowerCase());
  return assets.find((a) => lower.includes(a.name?.toLowerCase() ?? '')) ?? null;
}

function versionAssetCandidates(versionId: string): string[] {
  return [
    `version-${versionId}.txt`,
    `${versionId}.version.txt`,
    distributionConfig.client.defaultVersionAssetName,
  ];
}

function packageAssetCandidates(versionId: string): string[] {
  return [`${versionId}.zip`, distributionConfig.client.defaultPackageAssetName];
}

function mapAsset(asset: GitHubAsset): ReleaseAssetInfo {
  return {
    name: asset.name,
    downloadUrl: asset.browser_download_url,
    size: asset.size,
    contentType: asset.content_type,
  };
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
  };
}

// ─── Storage Layout ───────────────────────────────────────────────────────────

function resolveStorageLayout(versionIdInput?: string): ClientStorageLayout {
  const versionId = sanitizeVersionId(versionIdInput ?? loadConfig().versionId);
  const clientDir = path.join(getVersionsDir(), versionId);
  fs.mkdirSync(clientDir, { recursive: true });
  return {
    versionId,
    clientDir,
    versionMarkerFile: path.join(clientDir, VERSION_MARKER_NAME),
  };
}

// ─── Version Marker I/O ───────────────────────────────────────────────────────

function readLegacyVersionMarker(versionId: string): string | null {
  if (versionId !== distributionConfig.client.defaultVersionId) return null;
  const legacyPath = path.join(getBaseDataDir(), LEGACY_VERSION_FILE_NAME);
  if (!fs.existsSync(legacyPath)) return null;
  const value = fs.readFileSync(legacyPath, VERSION_FILE_ENCODING).trim();
  return value || null;
}

function readLocalVersion(versionFile: string, versionId: string): string | null {
  if (fs.existsSync(versionFile)) {
    const value = fs.readFileSync(versionFile, VERSION_FILE_ENCODING).trim();
    return value || null;
  }
  return readLegacyVersionMarker(versionId);
}

function writeLocalVersion(versionFile: string, version: string): void {
  fs.writeFileSync(versionFile, `${version}\n`, VERSION_FILE_ENCODING);
}

// ─── Version JSON Normalization ───────────────────────────────────────────────

function locateVersionJson(
  clientDir: string,
  versionId: string,
  hintedPath?: string | null,
): string | null {
  // 1. Hinted path from CDN manifest
  if (hintedPath) {
    const normalized = hintedPath.trim();
    if (normalized) {
      const absolute = path.isAbsolute(normalized) ? normalized : path.join(clientDir, normalized);
      if (fs.existsSync(absolute)) return absolute;
    }
  }

  // 2. Well-known direct paths
  for (const candidate of [
    path.join(clientDir, `${versionId}.json`),
    path.join(clientDir, 'ShindoClient.json'),
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }

  // 3. BFS fallback scan
  const queue = [clientDir];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(full);
        continue;
      }
      if (
        entry.name.toLowerCase().endsWith('.json') &&
        (entry.name === `${versionId}.json` || entry.name === 'ShindoClient.json')
      ) {
        return full;
      }
    }
  }

  return null;
}

function readJsonRecord(filePath: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, VERSION_FILE_ENCODING)) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Ensures the version JSON exists at the canonical path and has the correct `id` field.
 * Returns the canonical path if successful, or the located path as fallback.
 */
function normalizeVersionLayout(
  clientDir: string,
  versionId: string,
  hintedPath?: string | null,
): string | null {
  const locatedJson = locateVersionJson(clientDir, versionId, hintedPath);
  if (!locatedJson) return null;

  const payload = readJsonRecord(locatedJson);
  if (!payload) return locatedJson;

  const canonicalPath = path.join(clientDir, `${versionId}.json`);
  const currentId = typeof payload.id === 'string' ? payload.id : null;

  if (locatedJson !== canonicalPath || currentId !== versionId) {
    fs.writeFileSync(
      canonicalPath,
      JSON.stringify({ ...payload, id: versionId }, null, 2),
      VERSION_FILE_ENCODING,
    );
  }

  return fs.existsSync(canonicalPath) ? canonicalPath : locatedJson;
}

function parseClientJson(jsonPath: string | null, fallbackVersionId: string): ParsedClientJson {
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    return { baseVersion: null, id: fallbackVersionId, assets: null };
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, VERSION_FILE_ENCODING)) as {
    inheritsFrom?: string;
    minecraftVersion?: string;
    id?: string;
    assets?: string;
  };

  return {
    baseVersion: data.inheritsFrom ?? data.minecraftVersion ?? null,
    id: data.id ?? fallbackVersionId,
    assets: data.assets ?? null,
  };
}

// ─── Download & Extract ───────────────────────────────────────────────────────

async function downloadZip(url: string, dest: string): Promise<void> {
  const stream = await downloadFromUrl(url);
  await pipeline(stream, fs.createWriteStream(dest));
}

async function extractZip(zipFile: string, destDir: string): Promise<void> {
  new AdmZip(zipFile).extractAllTo(destDir, true);
}

// ─── Source Resolution ────────────────────────────────────────────────────────

async function resolveFromCdn(
  versionId: string,
  build?: number | null,
  releaseChannel?: ReleaseChannel,
): Promise<ResolvedClientSource | null> {
  const entry = await resolveClientVersionFromCdn(versionId, { buildNumber: build, channel: releaseChannel });
  if (!entry?.packageUrl) return null;

  const remoteVersion =
    entry.buildVersion ?? (entry.versionUrl ? await loadRemoteVersionText(entry.versionUrl) : null);
  if (!remoteVersion) return null;

  return {
    provider: 'cdn',
    versionId,
    packageUrl: entry.packageUrl,
    remoteVersion,
    buildNumber: entry.buildNumber ?? null,
    jarUrl: entry.jarUrl ?? null,
    legacyJarUrl: entry.legacyJarUrl ?? null,
    baseVersion: entry.baseVersion,
    assetsIndex: entry.assetsIndex,
    hintedVersionJsonPath: entry.versionJsonPath,
  };
}

async function resolveFromGithub(versionId: string): Promise<ResolvedClientSource> {
  const repo = resolveClientRepo(versionId);
  const release = await fetchLatestRelease(repo);
  const assets = release.assets ?? [];

  const versionAsset = findAssetByName(assets, versionAssetCandidates(versionId));
  const zipAsset = findAssetByName(assets, packageAssetCandidates(versionId));

  if (!versionAsset || !zipAsset) {
    throw new Error(`Release assets for version "${versionId}" not found in ${repo}`);
  }

  const remoteVersionStream = await downloadAsset(versionAsset.browser_download_url);
  const remoteVersion = (await buffer(remoteVersionStream)).toString(VERSION_FILE_ENCODING).trim();

  return {
    provider: 'github',
    versionId,
    packageUrl: zipAsset.browser_download_url,
    remoteVersion,
    release: mapRelease(release),
  };
}

async function resolveClientSource(
  versionId: string,
  build?: number | null,
  releaseChannel?: ReleaseChannel,
): Promise<ResolvedClientSource> {
  return (await resolveFromCdn(versionId, build, releaseChannel)) ?? resolveFromGithub(versionId);
}

function shouldSkipUpdate(
  localVersion: string | null,
  remoteVersion: string,
): boolean {
  if (!localVersion) return false;
  if (localVersion === remoteVersion) return true;
  const localMatch = localVersion.match(/^(\\d+)\\.(\\d+)$/);
  const remoteMatch = remoteVersion.match(/^(\\d+)\\.(\\d+)$/);
  if (!localMatch || !remoteMatch) return false;
  const localBuild = Number(localMatch[1]);
  const localBuildNumber = Number(localMatch[2]);
  const remoteBuild = Number(remoteMatch[1]);
  const remoteBuildNumber = Number(remoteMatch[2]);
  if ([localBuild, localBuildNumber, remoteBuild, remoteBuildNumber].some((n) => Number.isNaN(n))) {
    return false;
  }
  if (remoteBuild < localBuild) return true;
  if (remoteBuild > localBuild) return false;
  return remoteBuildNumber <= localBuildNumber;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function ensureClientUpToDate({
  force = false,
  versionId: requestedVersionId,
  build,
  releaseChannel,
}: EnsureClientOptions = {}): Promise<ClientUpdatePayload> {
  const layout = resolveStorageLayout(requestedVersionId);
  const resolvedChannel = releaseChannel ?? loadConfig().releaseChannel;
  const source = await resolveClientSource(layout.versionId, build, resolvedChannel);
  const localVersion = readLocalVersion(layout.versionMarkerFile, layout.versionId);

  // Up-to-date: skip download
  if (!force && shouldSkipUpdate(localVersion, source.remoteVersion)) {
    const jsonPath = normalizeVersionLayout(layout.clientDir, layout.versionId, source.hintedVersionJsonPath);
    const parsed = parseClientJson(jsonPath, layout.versionId);
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
    };
  }

  // Download, replace, extract
  const zipPath = path.join(getTempDir(), `${layout.versionId}-${source.remoteVersion}.zip`);
  await downloadZip(source.packageUrl, zipPath);
  fs.rmSync(layout.clientDir, { recursive: true, force: true });
  fs.mkdirSync(layout.clientDir, { recursive: true });
  await extractZip(zipPath, layout.clientDir);
  fs.rmSync(zipPath, { force: true });
  writeLocalVersion(layout.versionMarkerFile, source.remoteVersion);

  const jsonPath = normalizeVersionLayout(layout.clientDir, layout.versionId, source.hintedVersionJsonPath);
  const parsed = parseClientJson(jsonPath, layout.versionId);

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
  };
}

export function getLocalClientState(options?: { versionId?: string }): ClientStatePayload {
  const layout = resolveStorageLayout(options?.versionId);
  const localVersion = readLocalVersion(layout.versionMarkerFile, layout.versionId);
  const jsonPath = normalizeVersionLayout(layout.clientDir, layout.versionId);
  const parsed = parseClientJson(jsonPath, layout.versionId);

  return {
    version: localVersion,
    baseVersion: parsed.baseVersion,
    versionId: parsed.id,
    clientDir: layout.clientDir,
    versionJsonPath: jsonPath,
    clientPackagePath: null,
    assetsIndex: parsed.assets,
  };
}

export async function getVersionCatalog(): Promise<VersionCatalogPayload> {
  const remote = await loadVersionCatalogFromCdn();
  if (remote && remote.entries.length > 0) return remote;

  const config = loadConfig();
  const local = getLocalClientState({ versionId: config.versionId });
  const rawBuild = local.version ? Number(local.version.replace(/\D/g, '')) : null;
  const buildNumber = Number.isFinite(rawBuild) && (rawBuild ?? 0) > 0 ? rawBuild : null;

  return {
    updatedAt: null,
    defaultVersionId: config.versionId,
    entries: [
      {
        id: config.versionId,
        name: `Shindo Client ${local.baseVersion ?? '1.8.9'}`,
        enabled: true,
        minecraftVersion: local.baseVersion ?? '1.8.9',
        bannerUrl: null,
        assetsIndex: local.assetsIndex ?? null,
        baseVersion: local.baseVersion ?? null,
        latestBuild: buildNumber,
        latestBuildId: buildNumber ? `${buildNumber}.1` : null,
        latestSemver: local.version,
        latestType: 'stable',
        builds: buildNumber
          ? [
              {
                versionBase: buildNumber,
                buildNumber: 1,
                buildId: `${buildNumber}.1`,
                type: 'stable' as const,
                build: buildNumber,
                semver: local.version ?? '',
                label: `Build ${buildNumber}`,
                packageUrl: null,
                jarUrl: null,
                legacyJarUrl: null,
                versionUrl: null,
                versionJsonPath: local.versionJsonPath ?? null,
                releasedAt: null,
              },
            ]
          : [],
      },
    ],
  };
}
