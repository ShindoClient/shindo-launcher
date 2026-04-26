import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import AdmZip from 'adm-zip';
import tar from 'tar';
import type { JavaMajor, JavaValidationResult } from '@shindo/shared';
import { getBaseDataDir } from '../utils/pathResolver';
import { resolveJavaMajorFromVersioning } from './javaMetadataService';

// ─── Public API Types ────────────────────────────────────────────────────────

export interface JavaProgressPayload {
  message: string;
  percent: number;
}

export interface EnsureRuntimeResult {
  path: string;
  major: JavaMajor;
  source: 'cached' | 'downloaded';
  runtimeDir: string;
}

// ─── Internal Types ──────────────────────────────────────────────────────────

interface AdoptiumPackage {
  name: string;
  link: string;
  size?: number;
}

interface AdoptiumBinary {
  image_type?: string;
  package?: AdoptiumPackage;
}

interface AdoptiumRelease {
  binary?: AdoptiumBinary;
  binaries?: AdoptiumBinary[];
}

type ArchiveType = 'zip' | 'tar.gz';

// ─── Constants ───────────────────────────────────────────────────────────────

const ADOPTIUM_BASE = 'https://api.adoptium.net/v3/assets/latest';
const SUPPORTED_MAJORS: JavaMajor[] = [8, 11, 16, 17, 21];

// ─── Java Version Detection ──────────────────────────────────────────────────

/**
 * Maps a Minecraft version string to the required Java major version.
 *
 * Minecraft version requirements:
 *  - 1.0  – 1.16.x  → Java 8
 *  - 1.17           → Java 16
 *  - 1.18 – 1.20.x  → Java 17
 *  - 1.21+          → Java 21
 */
function javaForMinecraft(minecraftVersion: string | null): JavaMajor {
  if (!minecraftVersion) return 8;

  // Match "1.X" or "1.X.Y" or bare "X"
  const match = minecraftVersion.match(/^(?:1\.)?(\d+)(?:\.\d+)?$/);
  if (!match) return 8;

  const minor = Number(match[1]);
  if (Number.isNaN(minor)) return 8;

  //if (minor >= 21) return 21;
  //if (minor >= 18) return 17;
  //if (minor === 17) return 16;
  // 1.16 and below (including 1.8, 1.9, etc.) → Java 8
  return 8;
}

/**
 * Parses the Java major version from `java -version` output.
 * Handles both old-style (1.8.0_xxx) and new-style (11, 17, 21) formats.
 */
function parseJavaMajor(versionText: string | undefined): JavaMajor | undefined {
  if (!versionText) return undefined;

  // Matches: version "1.8.0_xxx" or version "17.0.x" or version "21"
  const match = versionText.match(/version\s+"?(\d+)(?:\.(\d+))?/i);
  if (!match) return undefined;

  const primary = Number(match[1]);
  if (Number.isNaN(primary)) return undefined;

  // Old-style: 1.8 → major is the second digit
  if (primary === 1) {
    const secondary = Number(match[2]);
    if (Number.isNaN(secondary)) return undefined;
    return SUPPORTED_MAJORS.includes(secondary as JavaMajor)
      ? (secondary as JavaMajor)
      : undefined;
  }

  // New-style: 11, 17, 21 → major is the first digit
  return SUPPORTED_MAJORS.includes(primary as JavaMajor) ? (primary as JavaMajor) : undefined;
}

// ─── Path Helpers ────────────────────────────────────────────────────────────

function runtimeBaseDir(): string {
  const dir = path.join(getBaseDataDir(), 'java');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function runtimeDirFor(major: JavaMajor): string {
  const dir = path.join(runtimeBaseDir(), `java-${major}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function expectedBinaryPath(major: JavaMajor): string {
  const binName = process.platform === 'win32' ? 'javaw.exe' : 'java';
  return path.join(runtimeDirFor(major), 'bin', binName);
}

function ensureExecutablePermissions(executablePath: string): void {
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(executablePath, 0o755);
    } catch {
      // best effort
    }
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function validateJavaExecutable(executablePath: string): JavaValidationResult {
  const normalized = executablePath?.trim();
  if (!normalized) {
    return { ok: false, path: executablePath, error: 'Empty path' };
  }

  try {
    fs.accessSync(normalized, fs.constants.F_OK);
    if (process.platform !== 'win32') {
      fs.accessSync(normalized, fs.constants.X_OK);
    }
  } catch {
    return { ok: false, path: normalized, error: 'File not executable' };
  }

  try {
    const result = spawnSync(normalized, ['-version'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 8000,
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    if (result.error) {
      return { ok: false, path: normalized, versionText: output || undefined, error: result.error.message };
    }
    const statusOk = typeof result.status === 'number' ? result.status === 0 : true;
    return {
      ok: statusOk,
      path: normalized,
      versionText: output || undefined,
      error: statusOk ? undefined : `Exited with code ${result.status ?? 'unknown'}`,
    };
  } catch (error) {
    return {
      ok: false,
      path: normalized,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function summarizeValidation(result: JavaValidationResult): { ok: boolean; major?: JavaMajor } {
  return { ok: result.ok, major: parseJavaMajor(result.versionText) };
}

// ─── Adoptium Download ───────────────────────────────────────────────────────

let cachedFetch: typeof fetch | null = null;

async function getFetch(): Promise<typeof fetch> {
  if (cachedFetch) return cachedFetch;
  const nativeFetch = (globalThis as Record<string, unknown>).fetch;
  if (typeof nativeFetch === 'function') {
    cachedFetch = nativeFetch as typeof fetch;
    return cachedFetch;
  }
  const mod = await import('node-fetch');
  cachedFetch = ((mod as Record<string, unknown>).default ?? mod) as typeof fetch;
  return cachedFetch;
}

function mapOs(platform: NodeJS.Platform): string {
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'mac';
  return 'linux';
}

function mapArch(arch: string): string {
  if (arch === 'arm64') return 'aarch64';
  if (arch === 'x64') return 'x64';
  return arch;
}

function archiveTypeFromName(name: string): ArchiveType {
  return name.toLowerCase().endsWith('.zip') ? 'zip' : 'tar.gz';
}

async function fetchJson<T>(url: string): Promise<T> {
  const fetchFn = await getFetch();
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status} ${response.statusText})`);
  }
  return response.json() as Promise<T>;
}

async function resolveAdoptiumPackage(
  major: JavaMajor,
): Promise<{ descriptor: AdoptiumPackage; archiveType: ArchiveType }> {
  const params = new URLSearchParams({
    architecture: mapArch(process.arch),
    image_type: 'jre',
    jvm_impl: 'hotspot',
    os: mapOs(process.platform),
    heap_size: 'normal',
  });

  const url = `${ADOPTIUM_BASE}/${major}/hotspot?${params.toString()}`;
  const payload = await fetchJson<AdoptiumRelease[]>(url);

  const binaries = payload.flatMap((release) => {
    const list: AdoptiumBinary[] = [];
    if (release.binary) list.push(release.binary);
    if (release.binaries) list.push(...release.binaries);
    return list;
  });

  const preferred = binaries.find((b) => {
    const name = b.package?.name?.toLowerCase() ?? '';
    return (b.package?.link) && (name.endsWith('.zip') || name.endsWith('.tar.gz'));
  }) ?? binaries.find((b) => b.package?.link && b.package.name?.includes('jdk'));

  const pkg = preferred?.package;
  if (!pkg?.link || !pkg.name) {
    throw new Error(
      `No compatible Temurin package found for ${mapOs(process.platform)}/${mapArch(process.arch)}`,
    );
  }

  return { descriptor: pkg, archiveType: archiveTypeFromName(pkg.name) };
}

async function downloadWithProgress(
  descriptor: AdoptiumPackage,
  archiveType: ArchiveType,
  onProgress?: (payload: JavaProgressPayload) => void,
): Promise<string> {
  const fetchFn = await getFetch();
  const response = await fetchFn(descriptor.link);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download Java runtime (${response.status} ${response.statusText})`);
  }

  const total = Number(response.headers.get('content-length')) || descriptor.size || 0;
  let received = 0;
  const startedAt = Date.now();

  const archivePath = path.join(os.tmpdir(), `shindo-temurin-${Date.now()}.${archiveType}`);
  const fileStream = fs.createWriteStream(archivePath);

  const sourceStream =
    typeof (response.body as unknown as ReadableStream).pipeTo === 'function'
      ? (response.body as unknown as ReadableStream)
      : Readable.fromWeb(response.body as unknown as ReadableStream);

  const progressTransform = new Transform({
    transform(chunk, _enc, cb) {
      received += chunk.length;
      if (onProgress && total > 0) {
        const percent = Math.min(99, Math.round((received / total) * 80));
        const elapsed = Math.max(1, Date.now() - startedAt) / 1000;
        const speedMb = received / 1024 / 1024 / elapsed;
        onProgress({
          message: `Baixando Java... ${(received / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB (${speedMb.toFixed(1)} MB/s)`,
          percent,
        });
      }
      cb(null, chunk);
    },
  });

  await pipeline(sourceStream, progressTransform, fileStream);
  return archivePath;
}

function resolveExtractionRoot(dir: string): string {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  if (entries.length === 1 && entries[0].isDirectory()) {
    return path.join(dir, entries[0].name);
  }
  return dir;
}

async function extractArchive(
  archivePath: string,
  archiveType: ArchiveType,
  targetDir: string,
  onProgress?: (payload: JavaProgressPayload) => void,
): Promise<void> {
  const extractDir = path.join(os.tmpdir(), `shindo-temurin-extract-${Date.now()}`);
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    if (archiveType === 'zip') {
      new AdmZip(archivePath).extractAllTo(extractDir, true);
    } else {
      await tar.x({ file: archivePath, cwd: extractDir, strip: 1 });
    }

    const root = resolveExtractionRoot(extractDir);
    for (const entry of fs.readdirSync(root)) {
      fs.cpSync(path.join(root, entry), path.join(targetDir, entry), { recursive: true });
    }

    onProgress?.({ message: 'Extraindo Java...', percent: 95 });
  } finally {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
}

// ─── Public Functions ────────────────────────────────────────────────────────

/**
 * Determines the required Java major version for a given Minecraft version.
 *
 * Priority:
 *  1. Override from `javaMetadataService` (e.g. explicit mapping in CDN config)
 *  2. Derived from the Minecraft version number itself
 *
 * Examples:
 *  - "1.8.9"  → Java 8
 *  - "1.16.5" → Java 8
 *  - "1.17"   → Java 16
 *  - "1.18.2" → Java 17
 *  - "1.21"   → Java 21
 */
export async function determineJavaMajor(
  versionId: string | null,
  minecraftVersion: string | null,
): Promise<JavaMajor> {
  const override = await resolveJavaMajorFromVersioning(versionId, minecraftVersion);
  if (override) return override;
  return javaForMinecraft(minecraftVersion);
}

export async function ensureJavaRuntime(
  major: JavaMajor,
  onProgress?: (payload: JavaProgressPayload) => void,
): Promise<EnsureRuntimeResult> {
  // Check cache first
  const cached = expectedBinaryPath(major);
  const cachedValid = validateJavaExecutable(cached);
  if (cachedValid.ok) {
    onProgress?.({ message: `Java ${major} em cache`, percent: 100 });
    ensureExecutablePermissions(cached);
    return { path: cached, major, source: 'cached', runtimeDir: runtimeDirFor(major) };
  }

  onProgress?.({ message: `Preparando download do Java ${major}...`, percent: 5 });

  const { descriptor, archiveType } = await resolveAdoptiumPackage(major);
  const archivePath = await downloadWithProgress(descriptor, archiveType, onProgress);

  const targetDir = runtimeDirFor(major);
  try {
    await extractArchive(archivePath, archiveType, targetDir, onProgress);
  } finally {
    fs.rmSync(archivePath, { force: true });
  }

  const binaryPath = expectedBinaryPath(major);
  ensureExecutablePermissions(binaryPath);

  const validation = validateJavaExecutable(binaryPath);
  if (!validation.ok) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    throw new Error(
      `Java ${major} was downloaded but is not runnable${validation.error ? `: ${validation.error}` : ''}`,
    );
  }

  onProgress?.({ message: `Java ${major} pronto`, percent: 100 });
  return { path: binaryPath, major, source: 'downloaded', runtimeDir: targetDir };
}
