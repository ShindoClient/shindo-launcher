import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import tar from 'tar';
import AdmZip from 'adm-zip';
import { fetchJson, fetchStream } from '../../utils/fetch';
import { getCacheDir } from '../../utils/paths';
import { logMessage } from '../log';
import type { JavaMajor, JavaValidationResult } from '@shindo/shared';

const ADOPTIUM_API = 'https://api.adoptium.net/v3/assets/latest';
const SUPPORTED_MAJORS: JavaMajor[] = [8, 11, 16, 17, 21];

// ─── Java version detection ───────────────────────────────────────────────────

export function javaForMinecraft(mcVersion: string): JavaMajor {
  // All Minecraft versions up to 1.16.x require Java 8
  // 1.8.9 (ShindoClient) → always Java 8
  const match = mcVersion.match(/^(?:1\.)?(\d+)/);
  if (!match) return 8;
  const minor = Number(match[1]);
  if (minor >= 21) return 21;
  if (minor >= 18) return 17;
  if (minor === 17) return 16;
  return 8;
}

// ─── Java validation ──────────────────────────────────────────────────────────

export function validateJavaExecutable(javaPath: string): JavaValidationResult {
  if (!javaPath || !fs.existsSync(javaPath)) {
    return { ok: false, path: javaPath, error: 'File not found' };
  }
  try {
    const result = spawnSync(javaPath, ['-version'], {
      encoding: 'utf8',
      timeout: 5_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const output = (result.stderr ?? '') + (result.stdout ?? '');
    if (result.status !== 0 || !output) {
      return { ok: false, path: javaPath, error: 'Not a valid Java executable' };
    }
    return { ok: true, path: javaPath, versionText: output.trim() };
  } catch {
    return { ok: false, path: javaPath, error: 'Failed to execute java -version' };
  }
}

// ─── Adoptium download ────────────────────────────────────────────────────────

interface AdoptiumPackage {
  link: string;
  name: string;
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

function jreDir(major: JavaMajor): string {
  return path.join(getCacheDir(), 'jre', `java-${major}`);
}

function javaExecutable(jreRoot: string): string {
  if (process.platform === 'win32') return path.join(jreRoot, 'bin', 'java.exe');
  return path.join(jreRoot, 'bin', 'java');
}

function findCachedJre(major: JavaMajor): string | null {
  const dir = jreDir(major);
  if (!fs.existsSync(dir)) return null;
  // Look for java binary inside any subdirectory (Adoptium extracts into a versioned folder)
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = javaExecutable(path.join(dir, entry.name));
    if (fs.existsSync(candidate)) return candidate;
  }
  // Check root level too
  const root = javaExecutable(dir);
  return fs.existsSync(root) ? root : null;
}

async function fetchAdoptiumUrl(major: JavaMajor): Promise<string> {
  const platform =
    process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux';
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x64';
  const url = `${ADOPTIUM_API}/${major}/jre?architecture=${arch}&image_type=jre&os=${platform}&vendor=eclipse`;

  const releases = await fetchJson<AdoptiumRelease[]>(url, { timeoutMs: 15_000 });
  const release = Array.isArray(releases) ? releases[0] : null;
  const binary = release?.binary ?? release?.binaries?.[0];
  const pkg = binary?.package;
  if (!pkg?.link) throw new Error(`No JRE package found for Java ${major} on ${platform}/${arch}`);
  return pkg.link;
}

type ArchiveType = 'zip' | 'tar.gz';

function detectArchive(filename: string): ArchiveType {
  return filename.endsWith('.zip') ? 'zip' : 'tar.gz';
}

async function extractJre(archivePath: string, destDir: string, type: ArchiveType): Promise<void> {
  fs.mkdirSync(destDir, { recursive: true });
  if (type === 'zip') {
    new AdmZip(archivePath).extractAllTo(destDir, true);
  } else {
    await tar.extract({ file: archivePath, cwd: destDir, strip: 1 });
  }
}

export interface EnsureRuntimeResult {
  path: string;
  major: JavaMajor;
  source: 'cached' | 'downloaded';
}

export async function ensureJavaRuntime(major: JavaMajor): Promise<EnsureRuntimeResult> {
  if (!SUPPORTED_MAJORS.includes(major)) {
    throw new Error(`Unsupported Java major version: ${major}`);
  }

  const cached = findCachedJre(major);
  if (cached) {
    logMessage('info', `Using cached JRE ${major} at ${cached}`);
    return { path: cached, major, source: 'cached' };
  }

  logMessage('info', `Downloading JRE ${major} from Adoptium...`);
  const downloadUrl = await fetchAdoptiumUrl(major);
  const filename = downloadUrl.split('/').pop() ?? `jre-${major}.tar.gz`;
  const type = detectArchive(filename);
  const archivePath = path.join(getCacheDir(), filename);

  try {
    const stream = await fetchStream(downloadUrl, 120_000);
    await pipeline(stream, fs.createWriteStream(archivePath));
    await extractJre(archivePath, jreDir(major), type);
  } finally {
    fs.rmSync(archivePath, { force: true });
  }

  const javaPath = findCachedJre(major);
  if (!javaPath) throw new Error(`JRE ${major} download succeeded but binary not found`);

  logMessage('info', `JRE ${major} installed at ${javaPath}`);
  return { path: javaPath, major, source: 'downloaded' };
}
