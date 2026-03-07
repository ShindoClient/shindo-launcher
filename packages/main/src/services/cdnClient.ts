import { Readable } from 'node:stream'
import { ReadableStream as WebReadableStream } from 'node:stream/web'
import type { VersionCatalogEntry, VersionCatalogPayload, VersionBuildCatalogEntry } from '@shindo/shared'
import { distributionConfig, sanitizeVersionId } from '../config/distributionConfig'

type FetchResponse = {
  ok: boolean
  status: number
  statusText: string
  body?: unknown
  text(): Promise<string>
  json(): Promise<unknown>
}

type FetchFn = (input: string, init?: Record<string, unknown>) => Promise<FetchResponse>

let cachedFetch: FetchFn | null = null

async function getFetch(): Promise<FetchFn> {
  if (cachedFetch) return cachedFetch

  const nativeFetch = (globalThis as Record<string, unknown>).fetch
  if (typeof nativeFetch === 'function') {
    cachedFetch = nativeFetch as FetchFn
    return cachedFetch
  }

  const mod = await import('node-fetch')
  const impl = (mod as Record<string, unknown>).default ?? mod
  cachedFetch = impl as FetchFn
  return cachedFetch
}

function normalizePath(pathname: string): string {
  if (!pathname.startsWith('/')) return `/${pathname}`
  return pathname
}

function toAbsoluteUrl(pathOrUrl: string): string {
  try {
    const asUrl = new URL(pathOrUrl)
    return asUrl.toString()
  } catch {
    return new URL(normalizePath(pathOrUrl), `${distributionConfig.client.cdnBaseUrl}/`).toString()
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function pickByVersion(record: Record<string, unknown>, versionId: string): Record<string, unknown> | null {
  const direct = record[versionId]
  if (direct && typeof direct === 'object') {
    return direct as Record<string, unknown>
  }

  const fallback = record.default
  if (fallback && typeof fallback === 'object') {
    return fallback as Record<string, unknown>
  }

  return null
}

function normalizeEntry(entry: Record<string, unknown>, fallbackVersionId: string): CdnClientVersionEntry | null {
  const artifacts = entry.artifacts && typeof entry.artifacts === 'object'
    ? (entry.artifacts as Record<string, unknown>)
    : null

  const versionId =
    asString(entry.id) ||
    asString(entry.versionId) ||
    fallbackVersionId

  const packageUrl =
    asString(artifacts?.packageUrl) ||
    asString(artifacts?.zipUrl) ||
    asString(artifacts?.downloadUrl) ||
    asString(entry.packageUrl) ||
    asString(entry.zipUrl) ||
    asString(entry.downloadUrl) ||
    asString(entry.clientZip)

  if (!packageUrl) {
    return null
  }

  return {
    versionId: sanitizeVersionId(versionId),
    buildVersion:
      asString(entry.semver) ||
      asString(entry.buildVersion) ||
      asString(entry.build) ||
      asString(entry.version) ||
      asString(entry.clientVersion),
    packageUrl: toAbsoluteUrl(packageUrl),
    versionUrl:
      asString(artifacts?.versionUrl) ||
      asString(artifacts?.versionFileUrl) ||
      asString(entry.versionUrl) ||
      asString(entry.versionFileUrl),
    baseVersion: asString(entry.baseVersion) || asString(entry.minecraftVersion),
    assetsIndex: asString(entry.assetsIndex) || asString(entry.assets),
    versionJsonPath:
      asString(artifacts?.versionJsonPath) ||
      asString(entry.versionJsonPath),
  }
}

function parseManifestObject(manifest: Record<string, unknown>, versionId: string): CdnClientVersionEntry | null {
  const versionsArray =
    (manifest.versions && Array.isArray(manifest.versions) ? manifest.versions : null) ||
    (manifest.clients && Array.isArray(manifest.clients) ? manifest.clients : null)

  if (versionsArray) {
    for (const item of versionsArray as Array<Record<string, unknown>>) {
      if (!item || typeof item !== 'object') continue
      const itemId = asString(item.id) || asString(item.versionId)
      if (itemId === versionId) {
        const normalized = normalizeEntry(item, versionId)
        if (normalized) return normalized
      }
    }
  }

  if (manifest.versions && typeof manifest.versions === 'object' && !Array.isArray(manifest.versions)) {
    const versions = manifest.versions as Record<string, unknown>
    const candidate = pickByVersion(versions, versionId)
    if (candidate) {
      const normalized = normalizeEntry(candidate, versionId)
      if (normalized) return normalized
    }
  }

  const direct = normalizeEntry(manifest, versionId)
  if (direct) return direct

  return null
}

async function requestJson(url: string): Promise<unknown | null> {
  try {
    const fetch = await getFetch()
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    return await response.json()
  } catch {
    return null
  }
}

async function readText(url: string): Promise<string | null> {
  try {
    const fetch = await getFetch()
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    const content = await response.text()
    const trimmed = content.trim()
    return trimmed.length > 0 ? trimmed : null
  } catch {
    return null
  }
}

export async function downloadFromUrl(url: string): Promise<NodeJS.ReadableStream> {
  const fetch = await getFetch()
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status} ${response.statusText})`)
  }

  const body = response.body
  if (typeof (body as NodeJS.ReadableStream).pipe === 'function') {
    return body as NodeJS.ReadableStream
  }

  if (typeof (body as WebReadableStream).getReader === 'function') {
    return Readable.fromWeb(body as WebReadableStream)
  }

  throw new Error('Download failed: unsupported response body type')
}

export interface CdnClientVersionEntry {
  versionId: string
  buildVersion: string | null
  buildNumber?: number | null
  packageUrl: string
  jarUrl?: string | null
  legacyJarUrl?: string | null
  versionUrl?: string | null
  baseVersion?: string | null
  assetsIndex?: string | null
  versionJsonPath?: string | null
  bannerUrl?: string | null
}

function buildManifestCandidates(versionId: string): string[] {
  const fromConfig = distributionConfig.client.cdnManifestCandidates.map((candidate) => toAbsoluteUrl(candidate))
  const direct = [
    `${distributionConfig.client.cdnBaseUrl}/clients/${versionId}.json`,
    `${distributionConfig.client.cdnBaseUrl}/versions/${versionId}.json`,
    `${distributionConfig.client.cdnBaseUrl}/${versionId}/manifest.json`,
  ]

  const deduped = new Set<string>([...fromConfig, ...direct])
  return [...deduped]
}

function asNumber(value: unknown): number | null {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function asBuildEntry(
  value: Record<string, unknown>,
  parent: {
    versionId: string
    baseVersion: string | null
    assetsIndex: string | null
    bannerUrl: string | null
  },
): VersionBuildCatalogEntry | null {
  const build = asNumber(value.build)
  if (!build || build <= 0) return null

  const artifacts = value.artifacts && typeof value.artifacts === 'object'
    ? (value.artifacts as Record<string, unknown>)
    : {}

  const semver = asString(value.semver) ?? asString(value.version)
  const label = asString(value.label) ?? (semver ? `v${semver}` : `Build ${build}`)

  const packageUrl =
    asString(artifacts.packageUrl) ||
    asString(artifacts.zipUrl) ||
    asString(artifacts.downloadUrl) ||
    asString(value.packageUrl) ||
    asString(value.zipUrl) ||
    asString(value.downloadUrl) ||
    null
  const jarUrl = asString(artifacts.jarUrl) || asString(value.jarUrl) || null
  const legacyJarUrl = asString(artifacts.legacyJarUrl) || asString(value.legacyJarUrl) || null

  const versionUrl =
    asString(artifacts.versionUrl) ||
    asString(artifacts.versionFileUrl) ||
    asString(value.versionUrl) ||
    asString(value.versionFileUrl) ||
    null

  const versionJsonPath =
    asString(artifacts.versionJsonPath) ||
    asString(value.versionJsonPath) ||
    null

  return {
    build,
    semver,
    label,
    packageUrl: packageUrl ? toAbsoluteUrl(packageUrl) : null,
    jarUrl: jarUrl ? toAbsoluteUrl(jarUrl) : null,
    legacyJarUrl: legacyJarUrl ? toAbsoluteUrl(legacyJarUrl) : null,
    versionUrl: versionUrl ? toAbsoluteUrl(versionUrl) : null,
    versionJsonPath,
    releasedAt: asString(value.releasedAt),
  }
}

function asCatalogEntry(value: Record<string, unknown>, fallbackVersionId: string): VersionCatalogEntry | null {
  const versionId = sanitizeVersionId(
    asString(value.id) ||
    asString(value.versionId) ||
    fallbackVersionId,
  )

  const minecraftVersion =
    asString(value.minecraftVersion) ||
    asString(value.baseVersion) ||
    '1.8.9'

  const baseVersion =
    asString(value.baseVersion) ||
    asString(value.minecraftVersion) ||
    null

  const assetsIndex = asString(value.assetsIndex) || asString(value.assets) || null
  const bannerUrl = asString(value.bannerUrl)
  const name = asString(value.name) || `Shindo Client ${minecraftVersion}`
  const enabled = value.enabled === false ? false : true

  const buildsRaw = Array.isArray(value.builds)
    ? (value.builds as Array<Record<string, unknown>>)
    : null

  const parentCtx = { versionId, baseVersion, assetsIndex, bannerUrl }
  const builds: VersionBuildCatalogEntry[] = []

  if (buildsRaw && buildsRaw.length > 0) {
    for (const candidate of buildsRaw) {
      if (!candidate || typeof candidate !== 'object') continue
      const parsed = asBuildEntry(candidate, parentCtx)
      if (parsed) builds.push(parsed)
    }
  } else {
    // Legacy mode: version entry itself behaves as a single build.
    const legacyBuild = asBuildEntry(value, parentCtx)
    if (legacyBuild) {
      builds.push(legacyBuild)
    }
  }

  builds.sort((a, b) => b.build - a.build)
  const latest = builds[0] ?? null

  return {
    id: versionId,
    name,
    enabled,
    minecraftVersion,
    bannerUrl: bannerUrl ? toAbsoluteUrl(bannerUrl) : null,
    assetsIndex,
    baseVersion,
    latestBuild: latest?.build ?? null,
    latestSemver: latest?.semver ?? null,
    builds,
  }
}

function parseVersionCatalog(manifest: Record<string, unknown>): VersionCatalogPayload {
  const entries: VersionCatalogEntry[] = []
  const versionsArray = Array.isArray(manifest.versions)
    ? (manifest.versions as Array<Record<string, unknown>>)
    : null

  if (versionsArray) {
    for (const versionRaw of versionsArray) {
      if (!versionRaw || typeof versionRaw !== 'object') continue
      const parsed = asCatalogEntry(versionRaw, distributionConfig.client.defaultVersionId)
      if (parsed) entries.push(parsed)
    }
  } else if (manifest.versions && typeof manifest.versions === 'object') {
    const versionsMap = manifest.versions as Record<string, unknown>
    for (const [id, value] of Object.entries(versionsMap)) {
      if (!value || typeof value !== 'object') continue
      const parsed = asCatalogEntry(value as Record<string, unknown>, id)
      if (parsed) entries.push(parsed)
    }
  } else {
    const single = asCatalogEntry(manifest, distributionConfig.client.defaultVersionId)
    if (single) entries.push(single)
  }

  return {
    updatedAt: asString(manifest.updatedAt),
    defaultVersionId:
      asString(manifest.defaultVersionId) ||
      asString((manifest.latest as Record<string, unknown> | undefined)?.versionId) ||
      entries[0]?.id ||
      distributionConfig.client.defaultVersionId,
    entries,
  }
}

async function resolveCatalogFromCandidates(versionId?: string): Promise<VersionCatalogPayload | null> {
  const candidates = buildManifestCandidates(versionId ?? distributionConfig.client.defaultVersionId)
  for (const candidate of candidates) {
    const raw = await requestJson(candidate)
    if (!raw || typeof raw !== 'object') continue
    const manifest = raw as Record<string, unknown>
    const catalog = parseVersionCatalog(manifest)
    if (catalog.entries.length > 0) {
      return catalog
    }
  }
  return null
}

function toResolvedVersionEntry(
  entry: VersionCatalogEntry,
  build: VersionBuildCatalogEntry,
): CdnClientVersionEntry | null {
  if (!build.packageUrl) return null
  return {
    versionId: entry.id,
    buildVersion: build.semver ?? String(build.build),
    buildNumber: build.build,
    packageUrl: build.packageUrl,
    jarUrl: build.jarUrl,
    legacyJarUrl: build.legacyJarUrl,
    versionUrl: build.versionUrl,
    baseVersion: entry.baseVersion,
    assetsIndex: entry.assetsIndex,
    versionJsonPath: build.versionJsonPath,
    bannerUrl: entry.bannerUrl,
  }
}

export async function loadVersionCatalogFromCdn(): Promise<VersionCatalogPayload | null> {
  return resolveCatalogFromCandidates(distributionConfig.client.defaultVersionId)
}

export async function resolveClientVersionFromCdn(
  versionIdInput: string,
  buildNumber?: number | null,
): Promise<CdnClientVersionEntry | null> {
  const versionId = sanitizeVersionId(versionIdInput)
  const catalog = await resolveCatalogFromCandidates(versionId)
  if (!catalog) return null

  const targetEntry =
    catalog.entries.find((entry) => entry.id === versionId) ||
    catalog.entries.find((entry) => entry.id === catalog.defaultVersionId) ||
    null

  if (!targetEntry || targetEntry.builds.length === 0) return null

  const requestedBuild = typeof buildNumber === 'number' && Number.isFinite(buildNumber)
    ? buildNumber
    : null

  const selectedBuild =
    (requestedBuild
      ? targetEntry.builds.find((candidate) => candidate.build === requestedBuild)
      : null) ||
    targetEntry.builds[0]

  const resolved = toResolvedVersionEntry(targetEntry, selectedBuild)
  if (resolved) {
    return resolved
  }

  // Backward compatibility fallback for old schemas not parsed as catalog.
  const candidates = buildManifestCandidates(versionId)
  for (const candidate of candidates) {
    const raw = await requestJson(candidate)
    if (!raw || typeof raw !== 'object') continue
    const parsed = parseManifestObject(raw as Record<string, unknown>, versionId)
    if (!parsed) continue
    if (parsed.versionUrl && parsed.versionUrl.trim().length > 0) {
      parsed.versionUrl = toAbsoluteUrl(parsed.versionUrl)
    }
    return parsed
  }
  return null
}

export async function loadRemoteVersionText(versionUrl: string): Promise<string | null> {
  return readText(toAbsoluteUrl(versionUrl))
}
