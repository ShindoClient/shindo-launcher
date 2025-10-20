import fs from 'node:fs';
import path from 'node:path';
import type { LauncherConfig } from '@shindo/shared';
import { getBaseDataDir } from '../utils/pathResolver';

const CONFIG_FILE = path.join(getBaseDataDir(), 'config.json');

const DEFAULT_CONFIG: LauncherConfig = {
  ramGB: 4,
  jrePreference: 'system',
  jvmArgs: '',
  versionId: 'ShindoClient',
  showLogsOnLaunch: true,
};

function ensureConfigDir(): void {
  const dir = path.dirname(CONFIG_FILE);
  fs.mkdirSync(dir, { recursive: true });
}

function readConfigFromDisk(): LauncherConfig | null {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as LauncherConfig;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
    };
  } catch {
    return null;
  }
}

export function loadConfig(): LauncherConfig {
  ensureConfigDir();
  const config = readConfigFromDisk();
  if (config) {
    return config;
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
  return DEFAULT_CONFIG;
}

export function saveConfig(config: LauncherConfig): LauncherConfig {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  return config;
}

export function updateConfig(patch: Partial<LauncherConfig>): LauncherConfig {
  const current = loadConfig();
  const next: LauncherConfig = {
    ...current,
    ...patch,
  };
  return saveConfig(next);
}
