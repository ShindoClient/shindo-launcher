import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Client, Authenticator } from 'minecraft-launcher-core';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type {
  ClientStatePayload,
  ClientUpdatePayload,
  LaunchClientOptionsPayload,
  LaunchClientResultPayload,
  LauncherConfig,
  LauncherUpdateInfoPayload,
  LauncherUpdateResultPayload,
  MemoryOptions,
} from '@shindo/shared';
import { ensureClientUpToDate, getLocalClientState, type EnsureClientOptions } from './clientManager';
import { checkLauncherUpdate, ensureLauncherUpdate } from './launcherUpdater';
import { getBaseDataDir, getVersionsDir } from '../utils/pathResolver';
import { loadConfig } from './configService';
import { downloadAsset } from './githubClient';

export interface LaunchCallbacks {
  onLog?: (message: string) => void;
  onError?: (message: string) => void;
  onProgress?: (details: { task: string; progress: number }) => void;
  onClose?: (code: number | null) => void;
}

const DEFAULT_USERNAME = 'ShindoPlayer';

const LAUNCHWRAPPER_URL = 'https://libraries.minecraft.net/net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar';
const REQUIRED_LIBRARIES = [
  {
    relativePath: 'org/ow2/asm/asm-all/5.0.3/asm-all-5.0.3.jar',
    url: 'https://libraries.minecraft.net/org/ow2/asm/asm-all/5.0.3/asm-all-5.0.3.jar',
  },
];

async function ensureLaunchWrapperJar(root: string): Promise<void> {
  const jarPath = path.join(root, 'libraries', 'net', 'minecraft', 'launchwrapper', '1.12', 'launchwrapper-1.12.jar');
  try {
    const stats = fs.statSync(jarPath);
    if (stats.size > 0) {
      return;
    }
  } catch {
    // ignore and download
  }

  fs.mkdirSync(path.dirname(jarPath), { recursive: true });
  const stream = await downloadAsset(LAUNCHWRAPPER_URL);
  await pipeline(stream, fs.createWriteStream(jarPath));
}

async function ensureRequiredLibraries(root: string): Promise<void> {
  for (const { relativePath, url } of REQUIRED_LIBRARIES) {
    const libPath = path.join(root, 'libraries', ...relativePath.split('/'));
    try {
      const stats = fs.statSync(libPath);
      if (stats.size > 0) {
        continue;
      }
    } catch {
      // need to download
    }

    fs.mkdirSync(path.dirname(libPath), { recursive: true });
    const stream = await downloadAsset(url);
    await pipeline(stream, fs.createWriteStream(libPath));
  }
}

function ensureDataRoot(): string {
  const root = getBaseDataDir();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function resolveMemory(config: LauncherConfig, memory?: MemoryOptions): Required<MemoryOptions> {
  const maxFromConfig = `${Math.max(1, config.ramGB)}G`;
  return {
    min: memory?.min ?? '1G',
    max: memory?.max ?? maxFromConfig,
  };
}

function parseJvmArgs(args?: string): string[] {
  if (!args) return [];
  const tokens = args.match(/"[^"]+"|\S+/g) ?? [];
  return tokens.map((token) => token.replace(/^"(.*)"$/, '$1'));
}

function extractCommand(proc: ChildProcessWithoutNullStreams | null): string[] {
  if (!proc) return [];
  if (Array.isArray(proc.spawnargs) && proc.spawnargs.length > 0) {
    return proc.spawnargs.map((arg) => String(arg));
  }
  return [];
}

export class LauncherService {
  async ensureClientUpToDate(options?: EnsureClientOptions): Promise<ClientUpdatePayload> {
    return ensureClientUpToDate(options);
  }

  getClientState(): ClientStatePayload {
    return getLocalClientState();
  }

  async checkLauncherUpdate(): Promise<LauncherUpdateInfoPayload> {
    return checkLauncherUpdate();
  }

  async downloadLauncherUpdate(): Promise<LauncherUpdateResultPayload> {
    return ensureLauncherUpdate();
  }

  async launchClient(
    options?: LaunchClientOptionsPayload,
    callbacks?: LaunchCallbacks,
  ): Promise<LaunchClientResultPayload> {
    let clientState = this.getClientState();
    if (!clientState.versionJsonPath) {
      clientState = await this.ensureClientUpToDate();
    }

    if (!clientState.versionJsonPath) {
      throw new Error('ShindoClient.json not found. Run the update before launching.');
    }

    const config = loadConfig();
    const root = ensureDataRoot();
    const memory = resolveMemory(config, options?.memory);
    const username = options?.username?.trim() || DEFAULT_USERNAME;
    const javaPath = options?.javaPath ?? config.jrePath;
    const versionsDir = getVersionsDir();
    const versionId = options?.versionId || config.versionId || clientState.versionId;
    const versionNumber = clientState.baseVersion ?? '1.8.9';
    const assetIndex = clientState.assetsIndex ?? '1.8';
    const versionJsonRelative = clientState.versionJsonPath
      ? path.relative(versionsDir, clientState.versionJsonPath).split(path.sep).join('/')
      : undefined;

    const configJvmArgs = parseJvmArgs(config.jvmArgs);
    const combinedJavaArgs = [...configJvmArgs, ...(options?.customArgs ?? [])];

    const authorization = await Authenticator.getAuth(username);

    const launcher = new Client();
    const startedAt = Date.now();

    if (callbacks?.onLog) {
      launcher.on('debug', (line: string) => callbacks.onLog?.(line));
      launcher.on('data', (line: string) => callbacks.onLog?.(line));
    }

    if (callbacks?.onError) {
      launcher.on('error', (line: string) => callbacks.onError?.(String(line)));
    }

    if (callbacks?.onProgress) {
      launcher.on('progress', (progress: { task: string; type: string; percent: number }) => {
        callbacks.onProgress?.({
          task: progress.task,
          progress: progress.percent,
        });
      });
    }

    await ensureLaunchWrapperJar(root);
    await ensureRequiredLibraries(root);

    const proc = await launcher.launch({
      root,
      javaPath,
      authorization,
      version: {
        number: versionNumber,
        type: 'release',
        custom: versionId,
      },
      memory,
      customArgs: combinedJavaArgs,
      customLaunchArgs: options?.customLaunchArgs ?? [],
      overrides: {
        directory: clientState.clientDir,
        versionJson: versionJsonRelative,
        versionName: versionId,
        assetIndex,
        assetRoot: path.join(root, 'assets'),
      },
    });

    if (proc && callbacks?.onClose) {
      proc.on('close', (code) => callbacks.onClose?.(code));
    }

    return {
      pid: proc?.pid ?? null,
      command: extractCommand(proc),
      startedAt,
    };
  }
}
