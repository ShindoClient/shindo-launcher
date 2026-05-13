import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const APP_DIR = '.shindo';

function resolveBaseDir(): string {
  switch (process.platform) {
    case 'win32': {
      const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
      return path.join(appData, APP_DIR);
    }
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', APP_DIR);
    default:
      return path.join(os.homedir(), '.local', 'share', APP_DIR);
  }
}

function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export const getBaseDataDir = () => ensureDir(resolveBaseDir());
export const getVersionsDir = () => ensureDir(path.join(getBaseDataDir(), 'versions'));
export const getCacheDir = () => ensureDir(path.join(getBaseDataDir(), 'cache'));
export const getUpdateDir = () => ensureDir(path.join(getBaseDataDir(), 'launcher-updates'));
export const getTempDir = () => ensureDir(path.join(getBaseDataDir(), 'tmp'));
export const getLogsDir = () => ensureDir(path.join(getBaseDataDir(), 'logs'));
export const getClientDir = (versionId = 'ShindoClient') =>
  ensureDir(path.join(getVersionsDir(), versionId));
