import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const WINDOWS: NodeJS.Platform = 'win32';
const MAC: NodeJS.Platform = 'darwin';

const APP_DIR_NAME = '.shindo';

function resolveBaseDir(): string {
  const platform: NodeJS.Platform = process.platform;
  if (platform === WINDOWS) {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, APP_DIR_NAME);
  }

  if (platform === MAC) {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_DIR_NAME);
  }

  // Linux and others
  return path.join(os.homedir(), '.local', 'share', APP_DIR_NAME);
}

function ensureDir(dirPath: string): string {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

export function getBaseDataDir(): string {
  return ensureDir(resolveBaseDir());
}

export function getVersionsDir(): string {
  return ensureDir(path.join(getBaseDataDir(), 'versions'));
}

export function getClientDir(): string {
  return ensureDir(path.join(getVersionsDir(), 'ShindoClient'));
}

export function getLauncherCacheDir(): string {
  return ensureDir(path.join(getBaseDataDir(), 'cache'));
}

export function getLauncherUpdateDir(): string {
  return ensureDir(path.join(getBaseDataDir(), 'launcher-updates'));
}

export function getLogsDir(): string {
  return ensureDir(path.join(getBaseDataDir(), 'logs'));
}

export function getTempDir(): string {
  return ensureDir(path.join(getBaseDataDir(), 'tmp'));
}
