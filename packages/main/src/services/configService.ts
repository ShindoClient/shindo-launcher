import fs from 'node:fs';
import path from 'node:path';
import type { JavaMajor, JavaSource, LauncherConfig } from '@shindo/shared';
import { getBaseDataDir } from '../utils/pathResolver';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIG_FILE = path.join(getBaseDataDir(), 'config.json');

const ALLOWED_JAVA_MAJORS: JavaMajor[] = [8, 11, 16, 17, 21];

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

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizeJavaSource(value: unknown, hasCustomPath: boolean): JavaSource {
  if (value === 'custom') return 'custom';
  if (value === 'auto') return 'auto';
  return hasCustomPath ? 'custom' : 'auto';
}

function normalizeJavaMajor(value: unknown): JavaMajor | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  return ALLOWED_JAVA_MAJORS.includes(n as JavaMajor) ? (n as JavaMajor) : undefined;
}

function normalizeConfig(raw: Partial<LauncherConfig> & Record<string, unknown>): LauncherConfig {
  const legacyPath = raw.jrePath as string | undefined;
  const customPath = (raw.javaCustomPath as string | null | undefined) ?? null;
  const javaSource = normalizeJavaSource(raw.javaSource, Boolean(customPath));
  const javaPath =
    (raw.javaPath as string | null | undefined) ??
    (javaSource === 'custom' ? customPath : null) ??
    legacyPath ??
    null;

  return {
    ...DEFAULT_CONFIG,
    ...raw,
    javaSource,
    javaCustomPath: customPath,
    javaPath,
    // Support legacy field name `javaVersion` alongside current `javaRuntimeMajor`
    javaRuntimeMajor: normalizeJavaMajor(raw.javaRuntimeMajor ?? raw.javaVersion),
  };
}

// ─── Disk I/O ─────────────────────────────────────────────────────────────────

function ensureConfigDir(): void {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
}

function readConfigFromDisk(): LauncherConfig | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) as Partial<LauncherConfig> & Record<string, unknown>;
    return normalizeConfig(parsed);
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Loads config from disk. If not found, writes and returns defaults.
 * Note: normalizes once on read — no double-normalization.
 */
export function loadConfig(): LauncherConfig {
  ensureConfigDir();
  const config = readConfigFromDisk();
  if (config) return config;
  // First run: write defaults
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: LauncherConfig): LauncherConfig {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  return config;
}

export function updateConfig(patch: Partial<LauncherConfig>): LauncherConfig {
  return saveConfig({ ...loadConfig(), ...patch });
}
