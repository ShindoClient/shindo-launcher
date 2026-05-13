import { app, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import semver from 'semver';
import { fetchJson, fetchStream } from '../../utils/fetch';
import { getUpdateDir } from '../../utils/paths';
import { logMessage } from '../log';
import type { LauncherUpdateInfo } from '@shindo/shared';

const GITHUB_REPO = 'ShindoClient/shindo-launcher';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

interface GithubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GithubRelease {
  tag_name: string;
  html_url: string;
  assets: GithubAsset[];
}

function currentVersion(): string | null {
  return semver.coerce(app.getVersion())?.version ?? null;
}

function platformExtension(): string {
  switch (process.platform) {
    case 'win32':
      return '.exe';
    case 'darwin':
      return '.dmg';
    default:
      return '.AppImage';
  }
}

function pickAsset(assets: GithubAsset[]): GithubAsset | null {
  const ext = platformExtension();
  return assets.find((a) => a.name.endsWith(ext)) ?? null;
}

export async function checkLauncherUpdate(): Promise<LauncherUpdateInfo> {
  const current = currentVersion();
  try {
    const release = await fetchJson<GithubRelease>(GITHUB_API, {
      headers: { 'User-Agent': `shindo-launcher/${current ?? 'unknown'}` },
      timeoutMs: 10_000,
    });
    const latest = semver.coerce(release.tag_name)?.version ?? null;
    const updateAvailable = Boolean(current && latest && semver.gt(latest, current));
    return { updateAvailable, currentVersion: current, latestVersion: latest };
  } catch (err) {
    logMessage('warn', `Launcher update check failed: ${String(err)}`);
    return { updateAvailable: false, currentVersion: current, latestVersion: null };
  }
}

export async function downloadLauncherUpdate(): Promise<LauncherUpdateInfo> {
  const current = currentVersion();
  try {
    const release = await fetchJson<GithubRelease>(GITHUB_API, {
      headers: { 'User-Agent': `shindo-launcher/${current ?? 'unknown'}` },
    });
    const latest = semver.coerce(release.tag_name)?.version ?? null;

    if (!latest || !current || !semver.gt(latest, current)) {
      return { updateAvailable: false, currentVersion: current, latestVersion: latest };
    }

    const asset = pickAsset(release.assets);
    if (!asset) {
      logMessage('warn', 'No suitable update asset found for this platform');
      return { updateAvailable: true, currentVersion: current, latestVersion: latest };
    }

    const destPath = path.join(getUpdateDir(), asset.name);
    if (!fs.existsSync(destPath)) {
      logMessage('info', `Downloading launcher update: ${asset.name}`);
      const stream = await fetchStream(asset.browser_download_url);
      await pipeline(stream, fs.createWriteStream(destPath));
      logMessage('info', `Launcher update downloaded to ${destPath}`);
    } else {
      logMessage('info', `Launcher update already cached: ${destPath}`);
    }

    return {
      updateAvailable: true,
      currentVersion: current,
      latestVersion: latest,
      downloadedPath: destPath,
    };
  } catch (err) {
    logMessage('error', `Launcher download failed: ${String(err)}`);
    return { updateAvailable: false, currentVersion: current, latestVersion: null };
  }
}

export async function applyLauncherUpdate(downloadedPath: string | null): Promise<boolean> {
  if (!downloadedPath || !fs.existsSync(downloadedPath)) return false;
  try {
    if (process.platform === 'win32') {
      shell.openPath(downloadedPath);
      setTimeout(() => app.quit(), 800);
      return true;
    }
    if (process.platform === 'darwin') {
      shell.openPath(downloadedPath);
      setTimeout(() => app.quit(), 800);
      return true;
    }
    // Linux AppImage: show in file manager — user installs manually
    shell.showItemInFolder(downloadedPath);
    return false;
  } catch (err) {
    logMessage('error', `Failed to apply launcher update: ${String(err)}`);
    return false;
  }
}
