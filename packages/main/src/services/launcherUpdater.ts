import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import semver from 'semver';
import type {
  LauncherUpdateInfoPayload,
  LauncherUpdateResultPayload,
  ReleaseAssetInfo,
  ReleaseInfo,
} from '@shindo/shared';
import { downloadAsset, fetchLatestRelease, GitHubAsset, GitHubRelease, GitHubHttpError } from './githubClient';
import { getLauncherUpdateDir } from '../utils/pathResolver';

const DEFAULT_REPO = 'ShindoClient/shindo-launcher';
const PLATFORM_HINTS: Partial<Record<NodeJS.Platform, string[]>> = {
  win32: ['win', 'windows', 'exe'],
  darwin: ['mac', 'darwin', 'osx', 'dmg'],
  linux: ['linux', 'appimage', 'deb'],
};

function getRepo(): string {
  return process.env.SHINDO_LAUNCHER_REPO || DEFAULT_REPO;
}

function normalizeVersion(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const coerced = semver.coerce(raw);
  return coerced ? coerced.version : null;
}

function readLocalPackageVersion(): string | null {
  if (process.env.npm_package_version) {
    return String(process.env.npm_package_version);
  }

  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return null;
    }
    const content = fs.readFileSync(pkgPath, 'utf8');
    const json = JSON.parse(content) as { version?: string };
    return json.version ?? null;
  } catch {
    return null;
  }
}

function mapAsset(asset: GitHubAsset | null | undefined): ReleaseAssetInfo | null {
  if (!asset) return null;
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
    assets: (release.assets ?? [])
      .map((asset) => mapAsset(asset))
      .filter((asset): asset is ReleaseAssetInfo => Boolean(asset)),
  };
}

function pickAssetForPlatform(assets: GitHubAsset[]): GitHubAsset | null {
  if (!Array.isArray(assets) || assets.length === 0) {
    return null;
  }
  const hints = PLATFORM_HINTS[process.platform] ?? [];
  const lowerHints = hints.map((hint) => hint.toLowerCase());

  const matches = assets.filter((asset) => {
    const name = asset.name?.toLowerCase() ?? '';
    return lowerHints.some((hint) => name.includes(hint));
  });

  if (matches.length > 0) {
    return matches[0];
  }

  return assets[0] ?? null;
}

export async function checkLauncherUpdate(): Promise<LauncherUpdateInfoPayload> {
  const repo = getRepo();
  const current = normalizeVersion(readLocalPackageVersion());

  let release: GitHubRelease;
  try {
    release = await fetchLatestRelease(repo);
  } catch (error) {
    if (error instanceof GitHubHttpError && error.status === 404) {
      return {
        updateAvailable: false,
        currentVersion: current,
        latestVersion: null,
        release: undefined,
        asset: null,
      };
    }
    throw error;
  }

  const latestRaw = release.tag_name ?? release.name;
  const latest = normalizeVersion(latestRaw);
  const currentVersion = current;

  const updateAvailable =
    latest && currentVersion ? semver.gt(latest, currentVersion) : latestRaw !== undefined && latestRaw !== currentVersion;

  return {
    updateAvailable: Boolean(updateAvailable),
    currentVersion,
    latestVersion: latest ?? latestRaw,
    release: mapRelease(release),
    asset: mapAsset(pickAssetForPlatform(release.assets ?? [])),
  };
}

export async function downloadLauncherUpdate(asset: GitHubAsset, version?: string | null): Promise<string> {
  const updateDir = path.join(getLauncherUpdateDir(), version || 'latest');
  fs.mkdirSync(updateDir, { recursive: true });
  const destination = path.join(updateDir, asset.name);
  const stream = await downloadAsset(asset.browser_download_url);
  await pipeline(stream, fs.createWriteStream(destination));
  return destination;
}

export async function ensureLauncherUpdate(): Promise<LauncherUpdateResultPayload> {
  const info = await checkLauncherUpdate();
  const { updateAvailable, latestVersion, asset, release, currentVersion } = info;

  if (!updateAvailable || !asset) {
    return {
      updateAvailable: false,
      latestVersion,
      currentVersion,
      release,
      asset: null,
    };
  }

  const latestRelease = await fetchLatestRelease(getRepo());
  const rawAsset = pickAssetForPlatform(latestRelease.assets ?? []);

  if (!rawAsset) {
    return {
      updateAvailable: false,
      latestVersion,
      currentVersion,
      release,
      asset: null,
    };
  }

  const downloadedPath = await downloadLauncherUpdate(rawAsset, latestVersion);
  return {
    updateAvailable: true,
    latestVersion,
    currentVersion,
    asset,
    release,
    downloadedPath,
  };
}
