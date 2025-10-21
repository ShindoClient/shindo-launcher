import { app, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import semver from 'semver';
import {
  autoUpdater,
  type ProgressInfo,
  type UpdateCheckResult,
  type UpdateDownloadedEvent,
  type UpdateFileInfo,
  type UpdateInfo,
} from 'electron-updater';
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

let updaterConfigured = false;
let lastCheckResult: UpdateCheckResult | null = null;
let lastDownloadedPath: string | null = null;
let lastDownloadUsedAutoUpdater = false;
const progressListeners = new Set<(info: ProgressInfo) => void>();

function getRepo(): string {
  return process.env.SHINDO_LAUNCHER_REPO || DEFAULT_REPO;
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

function mapReleaseFromUpdateInfo(info: UpdateInfo): ReleaseInfo {
  const notes = Array.isArray(info.releaseNotes)
    ? info.releaseNotes
        .map((entry) => {
          if (typeof entry === 'string') {
            return entry;
          }
          if (typeof entry === 'object' && entry !== null && 'note' in entry) {
            return String(entry.note);
          }
          return '';
        })
        .filter(Boolean)
        .join('\n\n')
    : typeof info.releaseNotes === 'string'
      ? info.releaseNotes
      : undefined;

  return {
    id: undefined,
    name: info.releaseName ?? undefined,
    tagName: info.version,
    body: notes,
    url: undefined,
    publishedAt: info.releaseDate ?? undefined,
    assets: (info.files ?? [])
      .map((file) => mapAssetFromFile(file))
      .filter((asset): asset is ReleaseAssetInfo => Boolean(asset)),
  };
}

function fileNameFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return path.basename(parsed.pathname);
  } catch {
    return url.split('/').pop() ?? url;
  }
}

function mapAssetFromFile(file: UpdateFileInfo | null | undefined): ReleaseAssetInfo | null {
  if (!file) return null;
  return {
    name: fileNameFromUrl(file.url) ?? file.url,
    downloadUrl: file.url,
    size: typeof file.size === 'number' ? file.size : undefined,
    contentType: undefined,
  };
}

function pickFileForPlatform(files: UpdateFileInfo[] | undefined): UpdateFileInfo | null {
  if (!files || files.length === 0) {
    return null;
  }

  const platform = process.platform;
  const scored = files
    .filter((file) => Boolean(file?.url))
    .map((file) => {
      const url = file.url ?? '';
      const name = fileNameFromUrl(url)?.toLowerCase() ?? '';
      let score = 0;

      if (platform === 'win32') {
        if (name === 'elevate.exe') {
          score -= 1000;
        }
        if (name.endsWith('.exe')) {
          score += 40;
        }
        if (name.includes('setup') || name.includes('installer')) {
          score += 60;
        }
        if (name.includes('x64')) {
          score += 5;
        }
        if (name.includes('arm')) {
          score -= 10;
        }
      } else if (platform === 'darwin') {
        if (name.endsWith('.dmg')) {
          score += 60;
        }
        if (name.endsWith('.pkg')) {
          score += 40;
        }
        if (name.includes('arm64') && process.arch !== 'arm64') {
          score -= 20;
        }
      } else if (platform === 'linux') {
        if (name.endsWith('.appimage')) {
          score += 60;
        }
        if (name.endsWith('.deb')) {
          score += 40;
        }
        if (name.includes('arm') && process.arch !== 'arm64') {
          score -= 10;
        }
      }

      const hints = PLATFORM_HINTS[platform as NodeJS.Platform] ?? [];
      if (hints.some((hint) => name.includes(hint.toLowerCase()))) {
        score += 10;
      }

      const size = typeof file.size === 'number' ? file.size : 0;
      return { file, score, size };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.size - a.size;
    });

  return scored[0]?.file ?? null;
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

  const platform = process.platform;

  const scored = assets
    .filter((asset) => Boolean(asset?.name))
    .map((asset) => {
      const name = (asset.name ?? '').toLowerCase();
      let score = 0;

      if (platform === 'win32') {
        if (name === 'elevate.exe') {
          score -= 1000;
        }
        if (name.endsWith('.exe')) {
          score += 40;
        }
        if (name.includes('setup') || name.includes('installer')) {
          score += 60;
        }
        if (name.includes('x64')) {
          score += 5;
        }
        if (name.includes('arm')) {
          score -= 10;
        }
      } else if (platform === 'darwin') {
        if (name.endsWith('.dmg')) {
          score += 60;
        }
        if (name.endsWith('.pkg')) {
          score += 40;
        }
        if (name.includes('arm64') && process.arch !== 'arm64') {
          score -= 20;
        }
      } else if (platform === 'linux') {
        if (name.endsWith('.appimage')) {
          score += 60;
        }
        if (name.endsWith('.deb')) {
          score += 40;
        }
        if (name.includes('arm') && process.arch !== 'arm64') {
          score -= 10;
        }
      }

      const hints = PLATFORM_HINTS[platform as NodeJS.Platform] ?? [];
      if (hints.some((hint) => name.includes(hint.toLowerCase()))) {
        score += 10;
      }

      const size = typeof asset.size === 'number' ? asset.size : 0;
      return { asset, score, size };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.size - a.size;
    });

  return scored[0]?.asset ?? assets[0] ?? null;
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
      latestVersion && currentVersion ? semver.gt(latestVersion, currentVersion) : result.isUpdateAvailable;

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
    latest && currentVersion ? semver.gt(latest, currentVersion) : latestRaw !== undefined && latestRaw !== currentVersion;

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

  broadcastProgress({
    percent: 0,
    transferred: 0,
    total,
    bytesPerSecond: 0,
  });

  stream.on('data', (chunk: Buffer) => {
    transferred += chunk.length;
    const effectiveTotal = total > 0 ? total : transferred;
    const percent = effectiveTotal > 0 ? Math.min(100, (transferred / effectiveTotal) * 100) : 0;
    broadcastProgress({
      percent,
      transferred,
      total: effectiveTotal,
    });
  });

  await pipeline(stream, fs.createWriteStream(destination));

  const finalTotal = total > 0 ? total : transferred;
  broadcastProgress({
    percent: 100,
    transferred: finalTotal,
    total: finalTotal,
  });

  return destination;
}

function computeTotalFromFiles(files: UpdateFileInfo[] | undefined): number {
  return (files ?? []).reduce((acc, file) => acc + (file.size ?? 0), 0);
}

function broadcastProgress(partial: Partial<ProgressInfo>): void {
  const payload: ProgressInfo = {
    percent: partial.percent ?? 0,
    bytesPerSecond: partial.bytesPerSecond ?? 0,
    transferred: partial.transferred ?? 0,
    total: partial.total ?? partial.transferred ?? 0,
    delta: partial.delta ?? 0,
  };

  for (const listener of progressListeners) {
    try {
      listener(payload);
    } catch (error) {
      console.error('launcher download progress listener failed', error);
    }
  }
}

autoUpdater.on('download-progress', (info) => {
  broadcastProgress(info);
});

autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
  const total = computeTotalFromFiles(info.files);
  broadcastProgress({
    percent: 100,
    transferred: total,
    total,
  });
});

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

export function onLauncherDownloadProgress(listener: (info: ProgressInfo) => void): () => void {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
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
