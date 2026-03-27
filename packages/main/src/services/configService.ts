import fs from 'node:fs';
import path from 'node:path';
import type { JavaMajor, JavaSource, LauncherConfig } from '@shindo/shared';
import { getBaseDataDir } from '../utils/pathResolver';

const CONFIG_FILE = path.join(getBaseDataDir(), 'config.json');

const DEFAULT_CONFIG: LauncherConfig = {
  ramGB: 4,
  javaSource: 'auto',
  javaPath: null,
  javaCustomPath: null,
  javaRuntimeMajor: undefined,
  jvmArgs: '',
  versionId: 'ShindoClient',
  selectedBuild: null,
  showLogsOnLaunch: true,
  language: 'en',
};

function normalizeJavaSource(value: unknown, hasCustomPath: boolean): JavaSource {
  if (value === 'custom') return 'custom';
  if (value === 'auto') return 'auto';
  return hasCustomPath ? 'custom' : 'auto';
}

const ALLOWED_JAVA_MAJORS: JavaMajor[] = [8, 11, 16, 17, 21];

function normalizeJavaMajor(value: unknown): LauncherConfig['javaRuntimeMajor'] {
  const asNumber = typeof value === 'number' ? value : Number(value);
  return ALLOWED_JAVA_MAJORS.includes(asNumber as JavaMajor)
    ? (asNumber as LauncherConfig['javaRuntimeMajor'])
    : undefined;
}

function normalizeConfig(raw: Partial<LauncherConfig> & Record<string, unknown>): LauncherConfig {
  const legacyPath = (raw as Record<string, unknown>).jrePath as string | undefined;
  const customPath = raw.javaCustomPath ?? null;
  const javaSource = normalizeJavaSource(raw.javaSource, Boolean(customPath));
  const javaPath =
    raw.javaPath ?? (javaSource === 'custom' ? (customPath ?? null) : null) ?? legacyPath ?? null;

  return {
    ...DEFAULT_CONFIG,
    ...raw,
    javaSource,
    javaCustomPath: customPath ?? null,
    javaPath: javaPath ?? null,
    javaRuntimeMajor: normalizeJavaMajor(
      raw.javaRuntimeMajor ?? (raw as Record<string, unknown>).javaVersion,
    ),
  };
}

function ensureConfigDir(): void {
  const dir = path.dirname(CONFIG_FILE);
  fs.mkdirSync(dir, { recursive: true });
}

function readConfigFromDisk(): LauncherConfig | null {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<LauncherConfig> & Record<string, unknown>;
    return normalizeConfig(parsed);
  } catch {
    return null;
  }
}

export function loadConfig(): LauncherConfig {
  ensureConfigDir();
  const config = readConfigFromDisk();
  if (config) {
    const normalized = normalizeConfig(config as Partial<LauncherConfig> & Record<string, unknown>);
    saveConfig(normalized);
    return normalized;
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
