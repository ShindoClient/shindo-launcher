import { app, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import semver from 'semver';
import {
  autoUpdater,
  type UpdateCheckResult,
} from 'electron-updater';
import type { LauncherUpdateInfoPayload, LauncherUpdateResultPayload } from '@shindo/shared';
import {
  downloadAsset,
  fetchLatestRelease,
  GitHubAsset,
  GitHubRelease,
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

let updaterConfigured = false;
let lastCheckResult: UpdateCheckResult | null = null;
let lastDownloadedPath: string | null = null;
let lastDownloadUsedAutoUpdater = false;

setupAutoUpdaterProgressHooks();
export { onLauncherDownloadProgress };

function getRepo(): string {
  return distributionConfig.launcher.githubRepo;
}

function configureAutoUpdater(): boolean {
  if (!app.isPackaged) {
    return false;
  }

  if (updaterConfigured) {
    return true;
  }

  try {
    const repo = getRepo();
    const [owner, repoName] = repo.split('/', 2);

    if (!owner || !repoName) {
      return false;
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.fullChangelog = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.setFeedURL({
      provider: 'github',
      owner,
      repo: repoName,
      releaseType: 'release',
    });

    updaterConfigured = true;
    return true;
  } catch (error) {
    updaterConfigured = false;
    if (isIgnorableAutoUpdaterError(error)) {
      return false;
    }
    throw error;
  }
}

function normalizeVersion(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const coerced = semver.coerce(raw);
  return coerced ? coerced.version : null;
}

function getCurrentVersion(): string | null {
  return normalizeVersion(app.getVersion() ?? null);
}

function isIgnorableAutoUpdaterError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message?.toLowerCase?.() ?? '';
  return (
    message.includes('update check failed') ||
    message.includes('auto-updater not supported') ||
    message.includes('electron-updater does not support') ||
    message.includes('app is not ready') ||
    message.includes('error: connect') ||
    message.includes('must be packaged') ||
    message.includes('cannot find latest') ||
    message.includes('no cached update') ||
    message.includes('channel is not specified') ||
    message.includes('http error')
  );
}

async function checkWithAutoUpdater(): Promise<LauncherUpdateInfoPayload | null> {
  if (!configureAutoUpdater()) {
    return null;
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result || !result.updateInfo) {
      lastDownloadedPath = null;
      lastDownloadUsedAutoUpdater = false;
      return {
        updateAvailable: false,
        currentVersion: getCurrentVersion(),
        latestVersion: null,
        release: undefined,
        asset: null,
      };
    }

    lastCheckResult = result;
    const updateInfo = result.updateInfo;
    const latestVersion = normalizeVersion(updateInfo.version);
    const currentVersion = getCurrentVersion();
    const updateAvailable =
      latestVersion && currentVersion
        ? semver.gt(latestVersion, currentVersion)
        : result.isUpdateAvailable;

    const release = mapReleaseFromUpdateInfo(updateInfo);
    const asset = mapAssetFromFile(pickFileForPlatform(updateInfo.files));

    return {
      updateAvailable: Boolean(updateAvailable),
      currentVersion,
      latestVersion: latestVersion ?? updateInfo.version ?? null,
      release,
      asset,
    };
  } catch (error) {
    if (isIgnorableAutoUpdaterError(error)) {
      return null;
    }
    throw error;
  }
}

async function checkWithGitHubFallback(): Promise<LauncherUpdateInfoPayload> {
  const repo = getRepo();
  const current = getCurrentVersion();

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
    latest && currentVersion
      ? semver.gt(latest, currentVersion)
      : latestRaw !== undefined && latestRaw !== currentVersion;

  return {
    updateAvailable: Boolean(updateAvailable),
    currentVersion,
    latestVersion: latest ?? latestRaw,
    release: mapRelease(release),
    asset: mapAsset(pickAssetForPlatform(release.assets ?? [])),
  };
}

async function downloadWithAutoUpdater(): Promise<LauncherUpdateResultPayload | null> {
  if (!configureAutoUpdater()) {
    return null;
  }

  const currentInfo = await checkWithAutoUpdater();
  if (!currentInfo) {
    return null;
  }

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
  if (!result || !result.updateInfo || !result.isUpdateAvailable) {
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
    lastDownloadedPath = downloadedPath ?? null;
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
    if (isIgnorableAutoUpdaterError(error)) {
      return null;
    }
    throw error;
  }
}

async function downloadWithGitHubFallback(): Promise<LauncherUpdateResultPayload> {
  const info = await checkWithGitHubFallback();
  const { updateAvailable, latestVersion, asset, release, currentVersion } = info;

  if (!updateAvailable || !asset) {
    lastDownloadedPath = null;
    lastDownloadUsedAutoUpdater = false;
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

  const downloadedPath = await downloadAssetToCache(rawAsset, latestVersion);
  lastDownloadedPath = downloadedPath;
  lastDownloadUsedAutoUpdater = false;
  return {
    updateAvailable: true,
    latestVersion,
    currentVersion,
    asset,
    release,
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

  notifyProgress({
    percent: 0,
    transferred: 0,
    total,
    bytesPerSecond: 0,
  });

  stream.on('data', (chunk: Buffer) => {
    transferred += chunk.length;
    const effectiveTotal = total > 0 ? total : transferred;
    const percent = effectiveTotal > 0 ? Math.min(100, (transferred / effectiveTotal) * 100) : 0;
    notifyProgress({
      percent,
      transferred,
      total: effectiveTotal,
    });
  });

  await pipeline(stream, fs.createWriteStream(destination));

  const finalTotal = total > 0 ? total : transferred;
  notifyProgress({
    percent: 100,
    transferred: finalTotal,
    total: finalTotal,
  });

  return destination;
}

export async function checkLauncherUpdate(): Promise<LauncherUpdateInfoPayload> {
  if (!app.isPackaged) {
    const version = getCurrentVersion();
    lastDownloadedPath = null;
    return {
      updateAvailable: false,
      currentVersion: version,
      latestVersion: version,
      release: undefined,
      asset: null,
    };
  }

  const autoUpdaterResult = await checkWithAutoUpdater();
  if (autoUpdaterResult) {
    return autoUpdaterResult;
  }
  return checkWithGitHubFallback();
}

export async function ensureLauncherUpdate(): Promise<LauncherUpdateResultPayload> {
  if (!app.isPackaged) {
    const version = getCurrentVersion();
    lastDownloadedPath = null;
    return {
      updateAvailable: false,
      currentVersion: version,
      latestVersion: version,
      release: undefined,
      asset: null,
    };
  }

  const autoResult = await downloadWithAutoUpdater();
  if (autoResult) {
    return autoResult;
  }
  return downloadWithGitHubFallback();
}

export async function applyLauncherUpdate(downloadedPath?: string | null): Promise<boolean> {
  const targetPath = downloadedPath ?? lastDownloadedPath;

  try {
    if (lastDownloadUsedAutoUpdater && configureAutoUpdater()) {
      console.info('Applying launcher update via autoUpdater.quitAndInstall()');
      autoUpdater.quitAndInstall();
      return true;
    }
  } catch (error) {
    if (!isIgnorableAutoUpdaterError(error)) {
      console.error('Failed to apply launcher update via autoUpdater', error);
    }
  }

  if (targetPath) {
    try {
      if (!fs.existsSync(targetPath)) {
        console.error('Launcher installer not found at', targetPath);
        return false;
      }
      console.info('Launching launcher installer at', targetPath);
      const result = await shell.openPath(targetPath);
      if (result && result.trim().length > 0) {
        console.error('Failed to launch installer:', result);
        return false;
      }
      app.quit();
      return true;
    } catch (error) {
      console.error('Failed to launch launcher installer', error);
      return false;
    }
  }

  return false;
}
