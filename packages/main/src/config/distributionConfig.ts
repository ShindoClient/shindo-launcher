export interface DistributionConfig {
  client: {
    defaultVersionId: string;
    cdnBaseUrl: string;
    cdnManifestCandidates: string[];
    githubDefaultRepo: string;
    githubRepoMap: Record<string, string>;
    defaultVersionAssetName: string;
    defaultPackageAssetName: string;
    versioningManifestUrl: string;
  };
  java: {
    metadataUrl: string;
  };
  launcher: {
    githubRepo: string;
  };
}

const DEFAULT_CLIENT_VERSION_ID = 'ShindoClient';
const DEFAULT_CDN_BASE_URL = 'https://cdn.shindoclient.com';
const DEFAULT_CDN_MANIFEST_CANDIDATES = [
  '/data/meta/versioning.json',
  '/manifest.json',
  '/clients/manifest.json',
  '/versions/manifest.json',
];
const DEFAULT_CLIENT_GITHUB_REPO = 'ShindoClient/Shindo-Client';
const DEFAULT_LAUNCHER_GITHUB_REPO = 'ShindoClient/shindo-launcher';
const DEFAULT_JAVA_METADATA_URL = 'https://cdn.shindoclient.com/data/meta/java.json';
const DEFAULT_VERSION_ASSET_NAME = 'version.txt';
const DEFAULT_PACKAGE_ASSET_NAME = 'ShindoClient.zip';
const DEFAULT_VERSIONING_PATH = '/data/meta/versioning.json';

const NORMALIZED_CDN_BASE_URL = normalizeBaseUrl(
  process.env.SHINDO_CDN_BASE_URL,
  DEFAULT_CDN_BASE_URL,
);

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const normalized = (value ?? fallback).trim();
  return normalized.replace(/\/+$/, '') || fallback;
}

function parseJsonMap(raw: string | undefined): Record<string, string> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const entries = Object.entries(parsed as Record<string, unknown>);
    return Object.fromEntries(
      entries
        .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
        .map(([key, value]) => [String(key), String(value).trim()]),
    );
  } catch {
    return {};
  }
}

function parseList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw || !raw.trim()) return fallback;
  const parsed = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

export const distributionConfig: DistributionConfig = Object.freeze({
  client: {
    defaultVersionId:
      process.env.SHINDO_CLIENT_DEFAULT_VERSION_ID?.trim() || DEFAULT_CLIENT_VERSION_ID,
    cdnBaseUrl: NORMALIZED_CDN_BASE_URL,
    cdnManifestCandidates: parseList(
      process.env.SHINDO_CDN_MANIFESTS,
      DEFAULT_CDN_MANIFEST_CANDIDATES,
    ),
    githubDefaultRepo: process.env.SHINDO_CLIENT_REPO?.trim() || DEFAULT_CLIENT_GITHUB_REPO,
    githubRepoMap: parseJsonMap(process.env.SHINDO_CLIENT_REPO_MAP),
    defaultVersionAssetName:
      process.env.SHINDO_CLIENT_VERSION_ASSET?.trim() || DEFAULT_VERSION_ASSET_NAME,
    defaultPackageAssetName:
      process.env.SHINDO_CLIENT_PACKAGE_ASSET?.trim() || DEFAULT_PACKAGE_ASSET_NAME,
    versioningManifestUrl:
      process.env.SHINDO_VERSIONING_MANIFEST_URL?.trim() ||
      `${NORMALIZED_CDN_BASE_URL}${DEFAULT_VERSIONING_PATH}`,
  },
  java: {
    metadataUrl: process.env.SHINDO_JAVA_META_URL?.trim() || DEFAULT_JAVA_METADATA_URL,
  },
  launcher: {
    githubRepo: process.env.SHINDO_LAUNCHER_REPO?.trim() || DEFAULT_LAUNCHER_GITHUB_REPO,
  },
});

export function sanitizeVersionId(input: string | undefined | null): string {
  const raw = (input ?? distributionConfig.client.defaultVersionId).trim();
  const sanitized = raw.replace(/[^a-zA-Z0-9_.-]/g, '-');
  return sanitized || distributionConfig.client.defaultVersionId;
}

export function resolveClientRepo(versionId: string): string {
  return (
    distributionConfig.client.githubRepoMap[versionId] ||
    distributionConfig.client.githubDefaultRepo
  );
}
