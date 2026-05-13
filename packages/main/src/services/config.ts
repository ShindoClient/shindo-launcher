import fs from 'node:fs';
import path from 'node:path';
import type { JavaMajor, JavaSource, LauncherConfig, ReleaseChannel } from '@shindo/shared';
import { getBaseDataDir } from '../utils/paths';

const CONFIG_FILENAME = 'config.json';

const ALLOWED_JAVA_MAJORS: JavaMajor[] = [8, 11, 16, 17, 21];
const ALLOWED_CHANNELS: ReleaseChannel[] = ['stable', 'snapshot', 'dev'];

const DEFAULTS: LauncherConfig = {
  ramGB: 4,
  javaSource: 'auto',
  javaPath: null,
  javaCustomPath: null,
  javaRuntimeMajor: null,
  jrePath: null,
  jvmArgs: '',
  versionId: 'ShindoClient',
  selectedBuild: null,
  releaseChannel: 'stable',
  showLogsOnLaunch: true,
  language: 'en',
};

function configFilePath(): string {
  return path.join(getBaseDataDir(), CONFIG_FILENAME);
}

function normalizeJavaSource(value: unknown, hasCustomPath: boolean): JavaSource {
  if (value === 'custom') return 'custom';
  if (value === 'auto') return 'auto';
  return hasCustomPath ? 'custom' : 'auto';
}

function normalizeJavaMajor(value: unknown): JavaMajor | null {
  const n = typeof value === 'number' ? value : Number(value);
  return ALLOWED_JAVA_MAJORS.includes(n as JavaMajor) ? (n as JavaMajor) : null;
}

function normalizeReleaseChannel(value: unknown): ReleaseChannel {
  return ALLOWED_CHANNELS.includes(value as ReleaseChannel) ? (value as ReleaseChannel) : 'stable';
}

function normalize(raw: Partial<LauncherConfig> & Record<string, unknown>): LauncherConfig {
  const customPath = (raw.javaCustomPath as string | null | undefined) ?? null;
  const javaSource = normalizeJavaSource(raw.javaSource, Boolean(customPath));
  // Support legacy field jrePath
  const legacyPath = (raw.jrePath as string | null | undefined) ?? null;
  const javaPath =
    (raw.javaPath as string | null | undefined) ??
    (javaSource === 'custom' ? customPath : null) ??
    legacyPath ??
    null;

  return {
    ...DEFAULTS,
    ...raw,
    javaSource,
    javaCustomPath: customPath,
    javaPath,
    jrePath: legacyPath,
    javaRuntimeMajor: normalizeJavaMajor(
      raw.javaRuntimeMajor ?? (raw as Record<string, unknown>).javaVersion,
    ),
    releaseChannel: normalizeReleaseChannel(raw.releaseChannel),
    language: raw.language === 'pt' || raw.language === 'en' ? raw.language : 'en',
  };
}

export function loadConfig(): LauncherConfig {
  const file = configFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<LauncherConfig> &
      Record<string, unknown>;
    return normalize(raw);
  } catch {
    // First run — write defaults
    fs.writeFileSync(file, JSON.stringify(DEFAULTS, null, 2), 'utf8');
    return { ...DEFAULTS };
  }
}

export function saveConfig(config: LauncherConfig): LauncherConfig {
  const file = configFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2), 'utf8');
  return config;
}

export function updateConfig(patch: Partial<LauncherConfig>): LauncherConfig {
  return saveConfig(normalize({ ...loadConfig(), ...patch }));
}
