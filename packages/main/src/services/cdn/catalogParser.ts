import type { VersionCatalog, VersionEntry, VersionBuild, ReleaseChannel } from '@shindo/shared';

// ─── Raw types (CDN JSON schema 2.0) ─────────────────────────────────────────

interface RawArtifacts {
  packageUrl?: string;
  jarUrl?: string;
  legacyJarUrl?: string;
  versionUrl?: string;
  versionJsonPath?: string;
}

interface RawBuild {
  build?: number;
  buildId?: string;
  semver?: string;
  label?: string;
  type?: string;
  releasedAt?: string;
  artifacts?: RawArtifacts;
}

interface RawVersion {
  id?: string;
  name?: string;
  enabled?: boolean;
  minecraftVersion?: string;
  baseVersion?: string;
  assetsIndex?: string;
  bannerUrl?: string;
  builds?: RawBuild[];
}

interface RawCatalog {
  schema?: string;
  updatedAt?: string;
  defaultVersionId?: string;
  versions?: RawVersion[];
}

// ─── Parser ───────────────────────────────────────────────────────────────────

const VALID_CHANNELS = new Set<string>(['stable', 'snapshot', 'dev']);

function parseChannel(raw: unknown): ReleaseChannel {
  return typeof raw === 'string' && VALID_CHANNELS.has(raw) ? (raw as ReleaseChannel) : 'stable';
}

function parseBuild(raw: RawBuild, index: number): VersionBuild | null {
  const build = typeof raw.build === 'number' && raw.build > 0 ? raw.build : null;
  if (!build) return null;

  const buildId = raw.buildId ?? `${build}.${index + 1}`;

  return {
    build,
    buildId,
    buildNumber: index + 1,
    semver: raw.semver ?? '',
    label: raw.label ?? `Build ${buildId}`,
    type: parseChannel(raw.type),
    versionBase: build,
    packageUrl: raw.artifacts?.packageUrl ?? null,
    jarUrl: raw.artifacts?.jarUrl ?? null,
    legacyJarUrl: raw.artifacts?.legacyJarUrl ?? null,
    versionUrl: raw.artifacts?.versionUrl ?? null,
    versionJsonPath: raw.artifacts?.versionJsonPath ?? null,
    releasedAt: raw.releasedAt ?? null,
  };
}

function parseVersion(raw: RawVersion): VersionEntry | null {
  if (!raw.id) return null;

  const builds = (Array.isArray(raw.builds) ? raw.builds : [])
    .map((b, i) => parseBuild(b, i))
    .filter((b): b is VersionBuild => b !== null)
    .sort((a, b) => b.build - a.build); // newest first

  const latest = builds[0] ?? null;
  const mc = raw.minecraftVersion ?? raw.baseVersion ?? '1.8.9';

  return {
    id: raw.id,
    name: raw.name ?? `Shindo Client ${mc}`,
    enabled: raw.enabled !== false,
    minecraftVersion: mc,
    baseVersion: raw.baseVersion ?? null,
    assetsIndex: raw.assetsIndex ?? null,
    bannerUrl: raw.bannerUrl ?? null,
    latestBuild: latest?.build ?? null,
    latestBuildId: latest?.buildId ?? null,
    latestSemver: latest?.semver ?? null,
    latestType: latest?.type ?? null,
    builds,
  };
}

export function parseCatalog(raw: unknown): VersionCatalog {
  const data = raw as RawCatalog;
  const versions = Array.isArray(data?.versions) ? data.versions : [];
  const entries = versions.map(parseVersion).filter((v): v is VersionEntry => v !== null);

  return {
    updatedAt: data?.updatedAt ?? null,
    defaultVersionId: data?.defaultVersionId ?? entries[0]?.id ?? 'ShindoClient',
    entries,
  };
}
