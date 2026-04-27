import { Readable } from 'node:stream';
import { ReadableStream as WebReadableStream } from 'node:stream/web';
import type {
  ReleaseChannel,
  VersionCatalogEntry,
  VersionCatalogPayload,
  VersionBuildCatalogEntry,
} from '@shindo/shared';
import { distributionConfig, sanitizeVersionId } from '../config/distributionConfig';
import { getFetch } from './fetchClient';

// ─── Internal Types ───────────────────────────────────────────────────────────

type JsonRecord = Record<string, unknown>;

// ─── URL Helpers ──────────────────────────────────────────────────────────────

function toAbsoluteUrl(pathOrUrl: string): string {
  try {
    new URL(pathOrUrl);
    return pathOrUrl;
  } catch {
    const normalized = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return new URL(normalized, `${distributionConfig.client.cdnBaseUrl}/`).toString();
  }
}

// ─── Value Coercions ──────────────────────────────────────────────────────────

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ─── Network ──────────────────────────────────────────────────────────────────

async function requestJson(url: string): Promise<unknown | null> {
  try {
    const fetch = await getFetch();
    const response = await fetch(url);
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}

async function readText(url: string): Promise<string | null> {
  try {
    const fetch = await getFetch();
    const response = await fetch(url);
    if (!response.ok) return null;
    const trimmed = (await response.text()).trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

export async function downloadFromUrl(url: string): Promise<NodeJS.ReadableStream> {
  const fetch = await getFetch();
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status} ${response.statusText})`);
  }
  const body = response.body;
  if (typeof (body as NodeJS.ReadableStream).pipe === 'function') return body as NodeJS.ReadableStream;
  if (typeof (body as WebReadableStream).getReader === 'function') return Readable.fromWeb(body as WebReadableStream);
  throw new Error('Download failed: unsupported response body type');
}

// ─── CDN Entry Parsing ────────────────────────────────────────────────────────

export interface CdnClientVersionEntry {
  versionId: string;
  buildVersion: string | null;
  buildNumber?: number | null;
  packageUrl: string;
  jarUrl?: string | null;
  legacyJarUrl?: string | null;
  versionUrl?: string | null;
  baseVersion?: string | null;
  assetsIndex?: string | null;
  versionJsonPath?: string | null;
  bannerUrl?: string | null;
}
const CHANNEL_ORDER: ReleaseChannel[] = ['stable', 'snapshot', 'dev'];
const CHANNEL_PRIORITY: Record<ReleaseChannel, number> = {
  dev: 0,
  snapshot: 1,
  stable: 2,
};

/** Picks from an `artifacts` sub-object first, then from the root. */
function pickArtifactField(entry: JsonRecord, ...keys: string[]): string | null {
  const artifacts = entry.artifacts && typeof entry.artifacts === 'object'
    ? (entry.artifacts as JsonRecord)
    : null;
  for (const key of keys) {
    const fromArtifacts = artifacts ? asString(artifacts[key]) : null;
    if (fromArtifacts) return fromArtifacts;
    const fromRoot = asString(entry[key]);
    if (fromRoot) return fromRoot;
  }
  return null;
}

function normalizeEntry(entry: JsonRecord, fallbackVersionId: string): CdnClientVersionEntry | null {
  const packageUrl =
    pickArtifactField(entry, 'packageUrl', 'zipUrl', 'downloadUrl') ||
    asString(entry.clientZip);
  if (!packageUrl) return null;

  return {
    versionId: sanitizeVersionId(asString(entry.id) || asString(entry.versionId) || fallbackVersionId),
    buildVersion:
      asString(entry.semver) ||
      asString(entry.buildVersion) ||
      asString(entry.build) ||
      asString(entry.version) ||
      asString(entry.clientVersion),
    packageUrl: toAbsoluteUrl(packageUrl),
    versionUrl: pickArtifactField(entry, 'versionUrl', 'versionFileUrl'),
    baseVersion: asString(entry.baseVersion) || asString(entry.minecraftVersion),
    assetsIndex: asString(entry.assetsIndex) || asString(entry.assets),
    versionJsonPath: pickArtifactField(entry, 'versionJsonPath'),
  };
}

function parseManifestObject(manifest: JsonRecord, versionId: string): CdnClientVersionEntry | null {
  // Array of versions
  const versionsArray =
    (Array.isArray(manifest.versions) ? manifest.versions : null) ||
    (Array.isArray(manifest.clients) ? manifest.clients : null);

  if (versionsArray) {
    for (const item of versionsArray as JsonRecord[]) {
      if (!item || typeof item !== 'object') continue;
      const id = asString(item.id) || asString(item.versionId);
      if (id === versionId) {
        const normalized = normalizeEntry(item, versionId);
        if (normalized) return normalized;
      }
    }
  }

  // Map of versions
  if (manifest.versions && typeof manifest.versions === 'object' && !Array.isArray(manifest.versions)) {
    const map = manifest.versions as JsonRecord;
    const candidate = (map[versionId] ?? map.default);
    if (candidate && typeof candidate === 'object') {
      const normalized = normalizeEntry(candidate as JsonRecord, versionId);
      if (normalized) return normalized;
    }
  }

  // Treat the manifest itself as an entry
  return normalizeEntry(manifest, versionId);
}

// ─── Build Catalog Parsing ────────────────────────────────────────────────────

function asBuildEntry(
  value: JsonRecord,
  parent: { versionId: string; baseVersion: string | null; assetsIndex: string | null; bannerUrl: string | null },
): VersionBuildCatalogEntry | null {
  const build = asNumber(value.build);
  if (!build || build <= 0) return null;

  const semver = asString(value.semver) ?? asString(value.version) ?? '';
  const fallbackBuildNumber = asNumber(value.buildNumber);
  const fallbackBuildId = asString(value.buildId);
  const resolvedBuildNumber = fallbackBuildNumber ?? (fallbackBuildId?.split('.').length === 2 ? Number(fallbackBuildId.split('.')[1]) : 1);
  const resolvedBuildId = fallbackBuildId ?? `${build}.${Number.isFinite(resolvedBuildNumber) ? resolvedBuildNumber : 1}`;
  const typeRaw = asString(value.type);
  const resolvedChannel = (typeRaw && CHANNEL_ORDER.includes(typeRaw as ReleaseChannel) ? typeRaw : 'stable') as ReleaseChannel;
  const label = asString(value.label) ?? (semver ? `v${semver}` : `Build ${resolvedBuildId}`);

  const packageUrl = pickArtifactField(value, 'packageUrl', 'zipUrl', 'downloadUrl');
  const jarUrl = pickArtifactField(value, 'jarUrl');
  const legacyJarUrl = pickArtifactField(value, 'legacyJarUrl');
  const versionUrl = pickArtifactField(value, 'versionUrl', 'versionFileUrl');
  const versionJsonPath = pickArtifactField(value, 'versionJsonPath');

  return {
    versionBase: asNumber(value.versionBase) ?? build,
    buildNumber: Number.isFinite(resolvedBuildNumber as number) ? (resolvedBuildNumber as number) : 1,
    buildId: resolvedBuildId,
    type: resolvedChannel,
    build,
    semver: semver ?? '',
    label,
    packageUrl: packageUrl ? toAbsoluteUrl(packageUrl) : null,
    jarUrl: jarUrl ? toAbsoluteUrl(jarUrl) : null,
    legacyJarUrl: legacyJarUrl ? toAbsoluteUrl(legacyJarUrl) : null,
    versionUrl: versionUrl ? toAbsoluteUrl(versionUrl) : null,
    versionJsonPath,
    releasedAt: asString(value.releasedAt),
  };
}

function compareBuildEntries(a: VersionBuildCatalogEntry, b: VersionBuildCatalogEntry): number {
  if (a.build !== b.build) return b.build - a.build;
  if (a.type !== b.type) return CHANNEL_PRIORITY[b.type] - CHANNEL_PRIORITY[a.type];
  return b.buildNumber - a.buildNumber;
}

function asCatalogEntry(value: JsonRecord, fallbackVersionId: string): VersionCatalogEntry | null {
  const versionId = sanitizeVersionId(asString(value.id) || asString(value.versionId) || fallbackVersionId);
  const minecraftVersion = asString(value.minecraftVersion) || asString(value.baseVersion) || '1.8.9';
  const baseVersion = asString(value.baseVersion) || asString(value.minecraftVersion) || null;
  const assetsIndex = asString(value.assetsIndex) || asString(value.assets) || null;
  const bannerUrl = asString(value.bannerUrl);
  const name = asString(value.name) || `Shindo Client ${minecraftVersion}`;
  const enabled = value.enabled !== false;

  const parentCtx = { versionId, baseVersion, assetsIndex, bannerUrl };
  const buildsRaw = Array.isArray(value.builds) ? (value.builds as JsonRecord[]) : null;

  const builds: VersionBuildCatalogEntry[] = [];
  if (buildsRaw && buildsRaw.length > 0) {
    for (const candidate of buildsRaw) {
      if (candidate && typeof candidate === 'object') {
        const parsed = asBuildEntry(candidate, parentCtx);
        if (parsed) builds.push(parsed);
      }
    }
  } else {
    // Legacy: the version entry itself is a single build
    const legacyBuild = asBuildEntry(value, parentCtx);
    if (legacyBuild) builds.push(legacyBuild);
  }

  builds.sort(compareBuildEntries);
  const latest = builds[0] ?? null;

  return {
    id: versionId,
    name,
    enabled,
    minecraftVersion,
    bannerUrl: bannerUrl ? toAbsoluteUrl(bannerUrl) : null,
    assetsIndex,
    baseVersion,
    latestBuild: latest?.build ?? null,
    latestBuildId: latest?.buildId ?? null,
    latestSemver: latest?.semver ?? null,
    latestType: latest?.type ?? null,
    builds,
  };
}

function parseVersionCatalog(manifest: JsonRecord): VersionCatalogPayload {
  const entries: VersionCatalogEntry[] = [];

  if (Array.isArray(manifest.versions)) {
    for (const v of manifest.versions as JsonRecord[]) {
      if (v && typeof v === 'object') {
        const parsed = asCatalogEntry(v, distributionConfig.client.defaultVersionId);
        if (parsed) entries.push(parsed);
      }
    }
  } else if (manifest.versions && typeof manifest.versions === 'object') {
    for (const [id, v] of Object.entries(manifest.versions as JsonRecord)) {
      if (v && typeof v === 'object') {
        const parsed = asCatalogEntry(v as JsonRecord, id);
        if (parsed) entries.push(parsed);
      }
    }
  } else {
    const single = asCatalogEntry(manifest, distributionConfig.client.defaultVersionId);
    if (single) entries.push(single);
  }

  return {
    updatedAt: asString(manifest.updatedAt),
    defaultVersionId:
      asString(manifest.defaultVersionId) ||
      asString((manifest.latest as JsonRecord | undefined)?.versionId) ||
      entries[0]?.id ||
      distributionConfig.client.defaultVersionId,
    entries,
  };
}

// ─── Manifest URL Resolution ──────────────────────────────────────────────────

const DEFAULT_VERSIONING_PATH = '/data/meta/versioning.json';

function getVersioningManifestUrl(): string {
  const configured = distributionConfig.client.versioningManifestUrl?.trim();
  return configured || `${distributionConfig.client.cdnBaseUrl.replace(/\/+$/, '')}${DEFAULT_VERSIONING_PATH}`;
}

function buildManifestCandidates(versionId: string): string[] {
  const base = distributionConfig.client.cdnBaseUrl;
  const fromConfig = distributionConfig.client.cdnManifestCandidates.map(toAbsoluteUrl);
  const extra = [
    `${base}/clients/${versionId}.json`,
    `${base}/versions/${versionId}.json`,
    `${base}/${versionId}/manifest.json`,
  ];
  return [...new Set([...fromConfig, ...extra])];
}

async function resolveCatalogFromCandidates(versionId?: string): Promise<VersionCatalogPayload | null> {
  const candidates = buildManifestCandidates(versionId ?? distributionConfig.client.defaultVersionId);
  for (const url of candidates) {
    const raw = await requestJson(url);
    if (!raw || typeof raw !== 'object') continue;
    const catalog = parseVersionCatalog(raw as JsonRecord);
    if (catalog.entries.length > 0) return catalog;
  }
  return null;
}

// ─── Versioning Manifest ──────────────────────────────────────────────────────

export interface VersioningEntry {
  id?: string;
  versionId?: string;
  minecraftVersion?: string;
  baseVersion?: string;
  javaId?: string | number;
  javaVersion?: string | number;
  javaMajor?: string | number;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface VersioningManifest {
  schema?: string;
  updatedAt?: string;
  defaultVersionId?: string;
  latest?: VersioningEntry;
  channels?: Partial<Record<ReleaseChannel, VersioningEntry>>;
  recommended?: ReleaseChannel;
  java?: {
    version?: number;
    vendor?: string;
  };
  versions?: VersioningEntry[] | Record<string, VersioningEntry>;
}

export async function loadVersioningManifest(): Promise<VersioningManifest | null> {
  const payload = await requestJson(getVersioningManifestUrl());
  return payload && typeof payload === 'object' ? (payload as VersioningManifest) : null;
}

export async function loadVersionCatalogFromCdn(): Promise<VersionCatalogPayload | null> {
  return resolveCatalogFromCandidates(distributionConfig.client.defaultVersionId);
}

// ─── Public Version Resolution ────────────────────────────────────────────────

function toResolvedVersionEntry(
  entry: VersionCatalogEntry,
  build: VersionBuildCatalogEntry,
): CdnClientVersionEntry | null {
  if (!build.packageUrl) return null;
  return {
    versionId: entry.id,
    buildVersion: build.buildId || build.semver || String(build.build),
    buildNumber: build.build,
    packageUrl: build.packageUrl,
    jarUrl: build.jarUrl,
    legacyJarUrl: build.legacyJarUrl,
    versionUrl: build.versionUrl,
    baseVersion: entry.baseVersion,
    assetsIndex: entry.assetsIndex,
    versionJsonPath: build.versionJsonPath,
    bannerUrl: entry.bannerUrl,
  };
}

function selectBuildByChannel(
  builds: VersionBuildCatalogEntry[],
  channel: ReleaseChannel | null,
): VersionBuildCatalogEntry | null {
  if (builds.length === 0) return null;
  if (!channel) return builds[0];
  const inChannel = builds.filter((b) => b.type === channel);
  return inChannel[0] ?? builds[0];
}

function pickBuildFromManifest(
  manifest: VersioningManifest | null,
  preferredChannel?: ReleaseChannel | null,
) : { build: number | null; buildId: string | null; channel: ReleaseChannel | null } {
  const empty = { build: null, buildId: null, channel: null as ReleaseChannel | null };
  if (!manifest) return empty;
  const recommended = manifest.recommended ?? 'stable';
  const selected = preferredChannel ?? recommended;

  const channels = manifest.channels ?? {};
  for (const channel of [selected, ...CHANNEL_ORDER.filter((c) => c !== selected)]) {
    const entry = channels[channel];
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const build = asNumber(record.build);
    const buildId = asString(record.buildId);
    if (build || buildId) {
      return {
        build: build ?? null,
        buildId: buildId ?? null,
        channel,
      };
    }
  }
  return empty;
}

export async function resolveClientVersionFromCdn(
  versionIdInput: string,
  options: { buildNumber?: number | null; channel?: ReleaseChannel | null } = {},
): Promise<CdnClientVersionEntry | null> {
  const versionId = sanitizeVersionId(versionIdInput);
  const manifest = await loadVersioningManifest();
  const preferredBuild = pickBuildFromManifest(manifest, options.channel);
  const catalog = await resolveCatalogFromCandidates(versionId);
  if (!catalog) return null;

  const targetEntry =
    catalog.entries.find((e) => e.id === versionId) ||
    catalog.entries.find((e) => e.id === catalog.defaultVersionId) ||
    null;

  if (!targetEntry || targetEntry.builds.length === 0) return null;

  const requestedBuild =
    typeof options.buildNumber === 'number' && Number.isFinite(options.buildNumber)
      ? options.buildNumber
      : null;
  const byRequestedBuild = requestedBuild
    ? targetEntry.builds.find((b) => b.build === requestedBuild)
    : null;
  const byPreferredBuild = preferredBuild?.build
    ? targetEntry.builds.find((b) => b.build === preferredBuild.build)
    : null;
  const byPreferredBuildId = preferredBuild?.buildId
    ? targetEntry.builds.find((b) => b.buildId === preferredBuild.buildId)
    : null;
  const byChannel = selectBuildByChannel(
    targetEntry.builds,
    options.channel ?? preferredBuild?.channel ?? manifest?.recommended ?? null,
  );
  const selectedBuild = byRequestedBuild ?? byPreferredBuildId ?? byPreferredBuild ?? byChannel ?? targetEntry.builds[0];

  const resolved = toResolvedVersionEntry(targetEntry, selectedBuild);
  if (resolved) return resolved;

  // Backward compatibility: fall back to raw manifest parsing
  for (const url of buildManifestCandidates(versionId)) {
    const raw = await requestJson(url);
    if (!raw || typeof raw !== 'object') continue;
    const parsed = parseManifestObject(raw as JsonRecord, versionId);
    if (!parsed) continue;
    if (parsed.versionUrl?.trim()) {
      parsed.versionUrl = toAbsoluteUrl(parsed.versionUrl);
    }
    return parsed;
  }

  return null;
}

export async function loadRemoteVersionText(versionUrl: string): Promise<string | null> {
  return readText(toAbsoluteUrl(versionUrl));
}
