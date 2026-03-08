import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import AdmZip from 'adm-zip';
import tar from 'tar';
import { Readable } from 'node:stream';
import { ReadableStream as WebReadableStream } from 'node:stream/web';
import type { LauncherConfig } from '@shindo/shared';
import { getBaseDataDir } from '../utils/pathResolver';
import { distributionConfig } from '../config/distributionConfig';

export interface EnsureJreResult {
  patch?: Partial<LauncherConfig>;
  message: string;
}

type ArchiveType = 'zip' | 'tar.gz';

interface RuntimeDescriptor {
  url: string;
  archiveType: ArchiveType;
}

type JavaVersion = 8 | 11 | 17 | 21;
type JavaPackage = 'jre' | 'jdk' | 'jdk-full';
type JreProvider = 'zulu' | 'temurin' | 'liberica';

type FetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  body?: unknown;
  json(): Promise<unknown>;
};

type FetchFn = (input: string, init?: Record<string, unknown>) => Promise<FetchResponse>;

let cachedFetch: FetchFn | null = null;

async function getFetch(): Promise<FetchFn> {
  if (cachedFetch) return cachedFetch;
  const nativeFetch = (globalThis as Record<string, unknown>).fetch;
  if (typeof nativeFetch === 'function') {
    cachedFetch = nativeFetch as FetchFn;
    return cachedFetch;
  }
  const mod = await import('node-fetch');
  const impl = (mod as Record<string, unknown>).default ?? mod;
  cachedFetch = impl as FetchFn;
  return cachedFetch;
}

async function toNodeStream(body: unknown): Promise<NodeJS.ReadableStream> {
  if (!body) throw new Error('Runtime download failed: empty body');
  if (typeof (body as NodeJS.ReadableStream).pipe === 'function') {
    return body as NodeJS.ReadableStream;
  }
  if (typeof (body as WebReadableStream).getReader === 'function') {
    return Readable.fromWeb(body as WebReadableStream);
  }
  throw new Error('Runtime download failed: unsupported response body type');
}

const TEMURIN_BASE = 'https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u432-b06';

const TEMURIN_RUNTIME: Partial<
  Record<NodeJS.Platform, Partial<Record<string, RuntimeDescriptor>>>
> = {
  win32: {
    x64: {
      url: `${TEMURIN_BASE}/OpenJDK8U-jre_x64_windows_hotspot_8u432b06.zip`,
      archiveType: 'zip',
    },
  },
  linux: {
    x64: {
      url: `${TEMURIN_BASE}/OpenJDK8U-jre_x64_linux_hotspot_8u432b06.tar.gz`,
      archiveType: 'tar.gz',
    },
    arm64: {
      url: `${TEMURIN_BASE}/OpenJDK8U-jre_aarch64_linux_hotspot_8u432b06.tar.gz`,
      archiveType: 'tar.gz',
    },
  },
  darwin: {
    x64: {
      url: `${TEMURIN_BASE}/OpenJDK8U-jre_x64_mac_hotspot_8u432b06.tar.gz`,
      archiveType: 'tar.gz',
    },
  },
};

type RuntimePackageMap = Partial<Record<JavaPackage, RuntimeDescriptor>>;
type RuntimeVersionMap = Partial<Record<`${JavaVersion}`, RuntimePackageMap>>;
type RuntimeArchMap = Partial<Record<string, RuntimeVersionMap>>;
type RuntimePlatformMap = Partial<Record<NodeJS.Platform, RuntimeArchMap>>;
type RuntimeMap = Record<JreProvider, RuntimePlatformMap>;

function makeStaticProviderMap(
  source: Partial<Record<NodeJS.Platform, Partial<Record<string, RuntimeDescriptor>>>>,
): RuntimePlatformMap {
  const out: RuntimePlatformMap = {};
  for (const [platform, archRaw] of Object.entries(source) as Array<
    [NodeJS.Platform, Partial<Record<string, RuntimeDescriptor>>]
  >) {
    const archOut: RuntimeArchMap = {};
    for (const [arch, descriptor] of Object.entries(archRaw ?? {})) {
      archOut[arch] = {
        '8': { jre: descriptor },
      };
    }
    out[platform] = archOut;
  }
  return out;
}

const RUNTIME_MAP: RuntimeMap = {
  zulu: makeStaticProviderMap(TEMURIN_RUNTIME),
  temurin: makeStaticProviderMap(TEMURIN_RUNTIME),
  liberica: makeStaticProviderMap(TEMURIN_RUNTIME),
};

let cachedRemoteRuntimeMap: RuntimeMap | null = null;
let remoteRuntimeChecked = false;

function normalizeArchiveType(value: unknown): ArchiveType | null {
  if (value === 'zip' || value === 'tar.gz') return value;
  return null;
}

function asRuntimeDescriptor(value: unknown): RuntimeDescriptor | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const url =
    typeof source.url === 'string' && source.url.trim().length > 0 ? source.url.trim() : null;
  const archiveType = normalizeArchiveType(source.archiveType);
  if (!url || !archiveType) return null;
  return { url, archiveType };
}

function parseRuntimeMap(payload: unknown): RuntimeMap | null {
  if (!payload || typeof payload !== 'object') return null;

  const root = payload as Record<string, unknown>;
  const runtimeSource =
    (root.runtimes && typeof root.runtimes === 'object' ? root.runtimes : null) ||
    (root.providers && typeof root.providers === 'object' ? root.providers : null);

  if (!runtimeSource) return null;

  const providers = runtimeSource as Record<string, unknown>;
  const parsed: RuntimeMap = {
    zulu: {},
    temurin: {},
    liberica: {},
  };

  for (const provider of ['zulu', 'temurin', 'liberica'] as const) {
    const providerRaw = providers[provider];
    if (!providerRaw || typeof providerRaw !== 'object') continue;
    const platformMap = providerRaw as Record<string, unknown>;
    for (const platform of Object.keys(platformMap) as NodeJS.Platform[]) {
      const archRaw = platformMap[platform];
      if (!archRaw || typeof archRaw !== 'object') continue;
      const archMap = archRaw as Record<string, unknown>;
      const normalizedArchMap: RuntimeArchMap = {};
      for (const [arch, descriptorRaw] of Object.entries(archMap)) {
        if (!descriptorRaw || typeof descriptorRaw !== 'object') continue;
        const descriptorObject = descriptorRaw as Record<string, unknown>;
        const maybeLegacy = asRuntimeDescriptor(descriptorRaw);
        if (maybeLegacy) {
          normalizedArchMap[arch] = {
            '8': { jre: maybeLegacy },
          };
          continue;
        }

        const versionMap: RuntimeVersionMap = {};
        for (const [versionKey, packageRaw] of Object.entries(descriptorObject)) {
          if (!['8', '11', '17', '21'].includes(versionKey)) continue;
          if (!packageRaw || typeof packageRaw !== 'object') continue;
          const packageMapRaw = packageRaw as Record<string, unknown>;
          const packageMap: RuntimePackageMap = {};

          for (const pkg of ['jre', 'jdk', 'jdk-full'] as const) {
            const parsedDescriptor = asRuntimeDescriptor(packageMapRaw[pkg]);
            if (parsedDescriptor) {
              packageMap[pkg] = parsedDescriptor;
            }
          }

          const directPackage = asRuntimeDescriptor(packageRaw);
          if (directPackage) {
            packageMap.jre = directPackage;
          }

          if (Object.keys(packageMap).length > 0) {
            versionMap[versionKey as `${JavaVersion}`] = packageMap;
          }
        }

        if (Object.keys(versionMap).length > 0) {
          normalizedArchMap[arch] = versionMap;
        }
      }
      if (Object.keys(normalizedArchMap).length > 0) {
        parsed[provider][platform] = normalizedArchMap;
      }
    }
  }

  return parsed;
}

async function loadRemoteRuntimeMap(): Promise<RuntimeMap | null> {
  if (remoteRuntimeChecked) {
    return cachedRemoteRuntimeMap;
  }
  remoteRuntimeChecked = true;

  try {
    const fetch = await getFetch();
    const response = await fetch(distributionConfig.java.metadataUrl);
    if (!response.ok) {
      cachedRemoteRuntimeMap = null;
      return null;
    }
    const payload = await response.json();
    cachedRemoteRuntimeMap = parseRuntimeMap(payload);
    return cachedRemoteRuntimeMap;
  } catch {
    cachedRemoteRuntimeMap = null;
    return null;
  }
}

function runtimeDir(config: LauncherConfig): string {
  const provider = config.jrePreference === 'system' ? 'system' : config.jrePreference;
  const javaVersion = String(config.javaVersion ?? 8);
  const javaPackage = config.javaPackage ?? 'jre';
  return path.join(getBaseDataDir(), 'java', `${provider}-java${javaVersion}-${javaPackage}`);
}

function isExecutablePath(javaPath: string): boolean {
  try {
    fs.accessSync(javaPath, fs.constants.F_OK);
    if (process.platform !== 'win32') {
      fs.accessSync(javaPath, fs.constants.X_OK);
    }
    return true;
  } catch {
    return false;
  }
}

function canRunJava(javaPath: string): boolean {
  if (!isExecutablePath(javaPath)) {
    return false;
  }
  try {
    const result = spawnSync(javaPath, ['-version'], {
      timeout: 7000,
      windowsHide: true,
      encoding: 'utf8',
    });
    if (result.error) {
      return false;
    }
    return typeof result.status === 'number' && result.status === 0;
  } catch {
    return false;
  }
}

async function downloadToTemp(url: string, extension: string): Promise<string> {
  const fetch = await getFetch();
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download runtime (${response.status} ${response.statusText})`);
  }

  const tempPath = path.join(os.tmpdir(), `shindo-runtime-${Date.now()}.${extension}`);
  const fileStream = fs.createWriteStream(tempPath);
  const stream = await toNodeStream(response.body);
  await pipeline(stream, fileStream);
  return tempPath;
}

async function extractArchive(
  archive: string,
  destination: string,
  archiveType: ArchiveType,
): Promise<void> {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });

  if (archiveType === 'zip') {
    const zip = new AdmZip(archive);
    zip.extractAllTo(destination, true);
    return;
  }

  await tar.x({ file: archive, cwd: destination });
}

function findJavaBinary(rootDir: string): string | null {
  const expectedName = process.platform === 'win32' ? 'java.exe' : 'java';
  if (!fs.existsSync(rootDir)) {
    return null;
  }

  const queue = [rootDir];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(full);
      } else if (entry.name === expectedName) {
        return full;
      }
    }
  }

  return null;
}

function resolveExtractionRoot(dir: string): string {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  if (entries.length === 1 && entries[0].isDirectory()) {
    return path.join(dir, entries[0].name);
  }
  return dir;
}

async function descriptorFor(config: LauncherConfig): Promise<RuntimeDescriptor | null> {
  const preference = config.jrePreference as Exclude<LauncherConfig['jrePreference'], 'system'>;
  const versionKey = String(config.javaVersion ?? 8) as `${JavaVersion}`;
  const packageKey = config.javaPackage ?? 'jre';
  const remoteMap = await loadRemoteRuntimeMap();
  const runtimeMap = remoteMap?.[preference] ?? RUNTIME_MAP[preference];
  const platformMap = runtimeMap[process.platform];
  if (!platformMap) return null;
  const archMap = platformMap[process.arch];
  if (!archMap) return null;
  const versionMap = archMap[versionKey] ?? archMap['8'];
  if (!versionMap) return null;
  return versionMap[packageKey] ?? versionMap.jre ?? null;
}

export async function ensureJre(config: LauncherConfig): Promise<EnsureJreResult> {
  if (config.jrePreference === 'system') {
    if (config.jrePath) {
      if (canRunJava(config.jrePath)) {
        return {
          message: `Using system JRE at ${config.jrePath}`,
        };
      }
      return {
        patch: { jrePath: undefined },
        message: `Configured system JRE is invalid (${config.jrePath}). Falling back to Java from PATH.`,
      };
    }
    return {
      message: 'Using system JRE (PATH).',
    };
  }

  const descriptor = await descriptorFor(config);
  if (!descriptor) {
    return {
      patch: { jrePreference: 'system', jrePath: undefined },
      message: `Runtime ${config.jrePreference} not supported for ${process.platform}/${process.arch}. Using system JRE.`,
    };
  }

  const targetDir = runtimeDir(config);
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });

  let hadInvalidConfiguredPath = false;

  if (config.jrePath && fs.existsSync(config.jrePath)) {
    if (canRunJava(config.jrePath)) {
      return {
        message: `Runtime ${config.jrePreference} configured manually at ${config.jrePath}`,
      };
    }
  }

  if (config.jrePath) {
    hadInvalidConfiguredPath = true;
  }

  const existingBinary = findJavaBinary(targetDir);
  if (existingBinary && canRunJava(existingBinary)) {
    return {
      patch: { jrePath: existingBinary },
      message: `Runtime ${config.jrePreference} ready in ${targetDir}`,
    };
  }

  if (existingBinary && !canRunJava(existingBinary)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let archivePath: string | null = null;
  const extractDir = path.join(os.tmpdir(), `shindo-java-extract-${Date.now()}`);
  try {
    archivePath = await downloadToTemp(
      descriptor.url,
      descriptor.archiveType === 'zip' ? 'zip' : 'tar.gz',
    );
    fs.mkdirSync(extractDir, { recursive: true });
    await extractArchive(archivePath, extractDir, descriptor.archiveType);
    const sourceRoot = resolveExtractionRoot(extractDir);
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });
    for (const entry of fs.readdirSync(sourceRoot)) {
      fs.cpSync(path.join(sourceRoot, entry), path.join(targetDir, entry), { recursive: true });
    }
  } catch (error) {
    if (archivePath && fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath);
    }
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
    return {
      patch: { jrePreference: 'system', jrePath: undefined },
      message: `Failed to prepare runtime ${config.jrePreference}: ${error instanceof Error ? error.message : String(error)}. Falling back to system JRE.`,
    };
  } finally {
    if (archivePath && fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath);
    }
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
  }

  const javaBinary = findJavaBinary(targetDir);
  if (!javaBinary || !canRunJava(javaBinary)) {
    return {
      patch: { jrePreference: 'system', jrePath: undefined },
      message: `Runtime ${config.jrePreference} was downloaded but Java executable is not runnable. Reverting to system JRE.`,
    };
  }

  return {
    patch: { jrePath: javaBinary },
    message: hadInvalidConfiguredPath
      ? `Configured JRE path was invalid. Runtime ${config.jrePreference} was repaired in ${targetDir}`
      : `Runtime ${config.jrePreference} ready in ${targetDir}`,
  };
}
