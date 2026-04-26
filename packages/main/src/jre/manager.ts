import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { JavaMajor, JavaValidationResult } from '@shindo/shared';
import { getBaseDataDir } from '../utils/pathResolver';

const SUPPORTED_JRE: JavaMajor[] = [8, 11, 16, 17, 21];

// Known Java installation paths for each OS
const JAVA_PATHS: Record<string, string[]> = {
  win32: [
    'C:\\Program Files\\Java\\',
    'C:\\Program Files (x86)\\Java\\',
  ],
  darwin: [
    '/Library/Java/JavaVirtualMachines/',
    '/System/Library/Java/JavaVirtualMachines/',
  ],
  linux: [
    '/usr/lib/jvm/',
    '/usr/java/',
    '/opt/java/',
  ],
};

interface JreConfig {
  javaPath?: string | null;
  javaSource: 'auto' | 'custom';
}

let config: JreConfig = {
  javaSource: 'auto',
  javaPath: null,
};

function getConfig(): JreConfig {
  return config;
}

function setConfig(newConfig: Partial<JreConfig>): void {
  config = { ...config, ...newConfig };
}

function getRuntimeDir(): string {
  const dir = path.join(getBaseDataDir(), 'java');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getJreDir(major: JavaMajor): string {
  const dir = path.join(getRuntimeDir(), `jdk-${major}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getJreBin(major: JavaMajor): string {
  const base = getJreDir(major);
  const binDir = process.platform === 'win32' ? 'bin' : 'bin';
  const exe = process.platform === 'win32' ? 'java.exe' : 'java';
  return path.join(base, binDir, exe);
}

function getSystemJavaPaths(): string[] {
  const paths: string[] = [];
  const basePaths = JAVA_PATHS[process.platform] || [];

  for (const base of basePaths) {
    try {
      if (!fs.existsSync(base)) continue;
      const entries = fs.readdirSync(base);
      for (const entry of entries) {
        const fullPath = path.join(base, entry, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
        if (fs.existsSync(fullPath)) {
          paths.push(fullPath);
        }
      }
    } catch {
      // ignore permission errors
    }
  }

  // Add PATH environment variable Java
  const pathEnv = process.env.PATH || '';
  for (const p of pathEnv.split(process.platform === 'win32' ? ';' : ':')) {
    const javaPath = path.join(p.trim(), process.platform === 'win32' ? 'java.exe' : 'java');
    if (fs.existsSync(javaPath)) {
      paths.push(javaPath);
    }
  }

  return paths;
}

function parseJavaVersion(output: string): JavaMajor | null {
  if (!output) return null;
  
  const match = output.match(/version\s+"?(\d+)(?:\.\d+)+/i);
  if (!match) return null;
  
  const version = Number(match[1]);
  if (SUPPORTED_JRE.includes(version as JavaMajor)) {
    return version as JavaMajor;
  }
  
  return null;
}

function validateJava(javaPath: string): JavaValidationResult {
  if (!javaPath || !fs.existsSync(javaPath)) {
    return { ok: false, path: javaPath, error: 'File not found' };
  }

  try {
    const result = spawnSync(javaPath, ['-version'], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });

    const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
    const major = parseJavaVersion(output);

    if (!major) {
      return { ok: false, path: javaPath, versionText: output, error: 'Unsupported Java version' };
    }

    return { ok: true, path: javaPath, versionText: output };
  } catch (error) {
    return { 
      ok: false, 
      path: javaPath, 
      error: error instanceof Error ? error.message : 'Validation failed' 
    };
  }
}

function findJavaOnSystem(requiredMajor: JavaMajor): JavaValidationResult | null {
  const paths = getSystemJavaPaths();

  for (const javaPath of paths) {
    const result = validateJava(javaPath);
    if (result.ok && result.versionText) {
      const major = parseJavaVersion(result.versionText);
      if (major === requiredMajor || requiredMajor === 17) {
        return result;
      }
    }
  }

  return null;
}

function isJreInstalled(major: JavaMajor): boolean {
  const binPath = getJreBin(major);
  return fs.existsSync(binPath);
}

function getInstalledJres(): JavaMajor[] {
  return SUPPORTED_JRE.filter(isJreInstalled);
}

function getOrFindJava(requiredMajor: JavaMajor): JavaValidationResult | null {
  // 1. If custom path configured, use it
  if (config.javaPath) {
    const result = validateJava(config.javaPath);
    if (result.ok) return result;
  }

  // 2. Check installed runtime
  const installedPath = getJreBin(requiredMajor);
  if (fs.existsSync(installedPath)) {
    const result = validateJava(installedPath);
    if (result.ok) return result;
  }

  // 3. Find on system with matching version
  const systemJava = findJavaOnSystem(requiredMajor);
  if (systemJava) return systemJava;

  // 4. Find any system Java (fallback)
  return findJavaOnSystem(21) || findJavaOnSystem(17) || findJavaOnSystem(16);
}

export const jreManager = {
  getConfig,
  setConfig,
  getRuntimeDir,
  getJreDir,
  getJreBin,
  validateJava,
  isJreInstalled,
  getInstalledJres,
  getOrFindJava,
  SUPPORTED_JRE,
};

export default jreManager;