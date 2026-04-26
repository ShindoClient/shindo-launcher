import { app, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import semver from 'semver';
import { autoUpdater, type UpdateCheckResult } from 'electron-updater';
import type { LauncherUpdateInfoPayload, LauncherUpdateResultPayload } from '@shindo/shared';
import {
  downloadAsset,
  fetchLatestRelease,
  type GitHubAsset,
  type GitHubRelease,
  GitHubHttpError,
} from './githubClient';
import { getLauncherUpdateDir } from '../utils/pathResolver';
import { distributionConfig } from '../config/distributionConfig';
import {
  fileNameFromUrl,
  mapAsset,
  mapAssetFromFile,
  mapRelease,
  mapReleaseFromUpdateInfo,
  pickAssetForPlatform,
  pickFileForPlatform,
} from './launcherUpdater/mapping';
import {
  notifyProgress,
  onLauncherDownloadProgress,
  setupAutoUpdaterProgressHooks,
} from './launcherUpdater/progress';

// ─── State ────────────────────────────────────────────────────────────────────

let updaterConfigured = false;
let lastCheckResult: UpdateCheckResult | null = null;
let lastDownloadedPath: string | null = null;
let lastDownloadUsedAutoUpdater = false;

setupAutoUpdaterProgressHooks();
export { onLauncherDownloadProgress };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRepo(): string {
  return distributionConfig.launcher.githubRepo;
}

function normalizeVersion(raw: string | null | undefined): string | null {
  const coerced = semver.coerce(raw ?? '');
  return coerced ? coerced.version : null;
}

function getCurrentVersion(): string | null {
  return normalizeVersion(app.getVersion() ?? null);
}

function isIgnorableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message?.toLowerCase() ?? '';
  return [
    'update check failed',
    'auto-updater not supported',
    'electron-updater does not support',
    'app is not ready',
    'error: connect',
    'must be packaged',
    'cannot find latest',
    'no cached update',
    'channel is not specified',
    'http error',
  ].some((s) => msg.includes(s));
}

function configureAutoUpdater(): boolean {
  if (!app.isPackaged) return false;
  if (updaterConfigured) return true;

  try {
    const [owner, repoName] = getRepo().split('/', 2);
    if (!owner || !repoName) return false;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.fullChangelog = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.setFeedURL({ provider: 'github', owner, repo: repoName, releaseType: 'release' });

    updaterConfigured = true;
    return true;
  } catch (error) {
    updaterConfigured = false;
    if (isIgnorableError(error)) return false;
    throw error;
  }
}

// ─── Check for Updates ────────────────────────────────────────────────────────

async function checkWithAutoUpdater(): Promise<LauncherUpdateInfoPayload | null> {
  if (!configureAutoUpdater()) return null;

  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result?.updateInfo) {
      lastDownloadedPath = null;
      lastDownloadUsedAutoUpdater = false;
      return { updateAvailable: false, currentVersion: getCurrentVersion(), latestVersion: null, release: undefined, asset: null };
    }

    lastCheckResult = result;
    const { updateInfo } = result;
    const latestVersion = normalizeVersion(updateInfo.version);
    const currentVersion = getCurrentVersion();
    const updateAvailable =
      latestVersion && currentVersion
        ? semver.gt(latestVersion, currentVersion)
        : result.isUpdateAvailable;

    return {
      updateAvailable: Boolean(updateAvailable),
      currentVersion,
      latestVersion: latestVersion ?? updateInfo.version ?? null,
      release: mapReleaseFromUpdateInfo(updateInfo),
      asset: mapAssetFromFile(pickFileForPlatform(updateInfo.files)),
    };
  } catch (error) {
    if (isIgnorableError(error)) return null;
    throw error;
  }
}

async function checkWithGitHubFallback(): Promise<LauncherUpdateInfoPayload> {
  const current = getCurrentVersion();
  let release: GitHubRelease;

  try {
    release = await fetchLatestRelease(getRepo());
  } catch (error) {
    if (error instanceof GitHubHttpError && error.status === 404) {
      return { updateAvailable: false, currentVersion: current, latestVersion: null, release: undefined, asset: null };
    }
    throw error;
  }

  const latestRaw = release.tag_name ?? release.name;
  const latest = normalizeVersion(latestRaw);
  const updateAvailable =
    latest && current
      ? semver.gt(latest, current)
      : latestRaw !== undefined && latestRaw !== current;

  return {
    updateAvailable: Boolean(updateAvailable),
    currentVersion: current,
    latestVersion: latest ?? latestRaw,
    release: mapRelease(release),
    asset: mapAsset(pickAssetForPlatform(release.assets ?? [])),
  };
}

// ─── Download Update ──────────────────────────────────────────────────────────

async function downloadWithAutoUpdater(): Promise<LauncherUpdateResultPayload | null> {
  if (!configureAutoUpdater()) return null;

  const currentInfo = await checkWithAutoUpdater();
  if (!currentInfo) return null;

  if (!currentInfo.updateAvailable) {
    lastDownloadUsedAutoUpdater = false;
    return {
      updateAvailable: false,
      latestVersion: currentInfo.latestVersion ?? null,
      currentVersion: currentInfo.currentVersion ?? getCurrentVersion(),
      release: currentInfo.release,
      asset: currentInfo.asset ?? null,
    };
  }

  const result = lastCheckResult ?? (await autoUpdater.checkForUpdates());
  if (!result?.updateInfo || !result.isUpdateAvailable) {
    lastDownloadedPath = null;
    lastDownloadUsedAutoUpdater = false;
    return {
      updateAvailable: false,
      latestVersion: currentInfo.latestVersion,
      currentVersion: currentInfo.currentVersion,
      release: currentInfo.release,
      asset: currentInfo.asset ?? null,
    };
  }

  try {
    const files = await autoUpdater.downloadUpdate(result.cancellationToken);
    const downloadedPath = files?.[0] ?? null;
    lastDownloadedPath = downloadedPath;
    lastDownloadUsedAutoUpdater = downloadedPath !== null;
    return {
      updateAvailable: true,
      latestVersion: currentInfo.latestVersion,
      currentVersion: currentInfo.currentVersion,
      release: currentInfo.release,
      asset: currentInfo.asset ?? null,
      downloadedPath,
    };
  } catch (error) {
    lastDownloadUsedAutoUpdater = false;
    if (isIgnorableError(error)) return null;
    throw error;
  }
}

async function downloadWithGitHubFallback(): Promise<LauncherUpdateResultPayload> {
  const info = await checkWithGitHubFallback();

  if (!info.updateAvailable || !info.asset) {
    lastDownloadedPath = null;
    lastDownloadUsedAutoUpdater = false;
    return { updateAvailable: false, latestVersion: info.latestVersion, currentVersion: info.currentVersion, release: info.release, asset: null };
  }

  const latestRelease = await fetchLatestRelease(getRepo());
  const rawAsset = pickAssetForPlatform(latestRelease.assets ?? []);

  if (!rawAsset) {
    return { updateAvailable: false, latestVersion: info.latestVersion, currentVersion: info.currentVersion, release: info.release, asset: null };
  }

  const downloadedPath = await downloadAssetToCache(rawAsset, info.latestVersion);
  lastDownloadedPath = downloadedPath;
  lastDownloadUsedAutoUpdater = false;

  return {
    updateAvailable: true,
    latestVersion: info.latestVersion,
    currentVersion: info.currentVersion,
    asset: info.asset,
    release: info.release,
    downloadedPath,
  };
}

async function downloadAssetToCache(asset: GitHubAsset, version?: string | null): Promise<string> {
  const updateDir = path.join(getLauncherUpdateDir(), version || 'latest');
  await fs.promises.mkdir(updateDir, { recursive: true });

  const destination = path.join(updateDir, asset.name);
  const stream = await downloadAsset(asset.browser_download_url);
  const total = asset.size ?? 0;
  let transferred = 0;

  notifyProgress({ percent: 0, transferred: 0, total, bytesPerSecond: 0 });

  stream.on('data', (chunk: Buffer) => {
    transferred += chunk.length;
    const effectiveTotal = total > 0 ? total : transferred;
    notifyProgress({
      percent: effectiveTotal > 0 ? Math.min(100, (transferred / effectiveTotal) * 100) : 0,
      transferred,
      total: effectiveTotal,
    });
  });

  await pipeline(stream, fs.createWriteStream(destination));
  notifyProgress({ percent: 100, transferred: total || transferred, total: total || transferred });

  return destination;
}

// ─── Public API ───────────────────────────────────────────────────────────────

function notPackagedResult(): LauncherUpdateInfoPayload {
  const version = getCurrentVersion();
  lastDownloadedPath = null;
  return { updateAvailable: false, currentVersion: version, latestVersion: version, release: undefined, asset: null };
}

export async function checkLauncherUpdate(): Promise<LauncherUpdateInfoPayload> {
  if (!app.isPackaged) return notPackagedResult();
  return (await checkWithAutoUpdater()) ?? checkWithGitHubFallback();
}

export async function ensureLauncherUpdate(): Promise<LauncherUpdateResultPayload> {
  if (!app.isPackaged) {
    const version = getCurrentVersion();
    lastDownloadedPath = null;
    return { updateAvailable: false, currentVersion: version, latestVersion: version, release: undefined, asset: null };
  }
  return (await downloadWithAutoUpdater()) ?? downloadWithGitHubFallback();
}

export async function applyLauncherUpdate(downloadedPath?: string | null): Promise<boolean> {
  const targetPath = downloadedPath ?? lastDownloadedPath;

  // Try electron-updater first (packaged apps)
  if (lastDownloadUsedAutoUpdater && configureAutoUpdater()) {
    try {
      console.info('[LAUNCHER_UPDATE] Applying via autoUpdater.quitAndInstall()');
      autoUpdater.quitAndInstall();
      return true;
    } catch (error) {
      if (!isIgnorableError(error)) {
        console.error('[LAUNCHER_UPDATE] Failed to apply via autoUpdater', error);
      }
    }
  }

  // Fall back to opening installer file
  if (targetPath) {
    try {
      if (!fs.existsSync(targetPath)) {
        console.error('[LAUNCHER_UPDATE] Installer not found at', targetPath);
        return false;
      }
      console.info('[LAUNCHER_UPDATE] Launching installer at', targetPath);
      const result = await shell.openPath(targetPath);
      if (result?.trim()) {
        console.error('[LAUNCHER_UPDATE] Failed to launch installer:', result);
        return false;
      }
      app.quit();
      return true;
    } catch (error) {
      console.error('[LAUNCHER_UPDATE] Failed to launch installer', error);
      return false;
    }
  }

  return false;
}
