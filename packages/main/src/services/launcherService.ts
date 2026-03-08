import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Client, Authenticator } from 'minecraft-launcher-core';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type {
  ClientStatePayload,
  ClientUpdatePayload,
  VersionCatalogPayload,
  LaunchClientOptionsPayload,
  LaunchClientResultPayload,
  LauncherConfig,
  LauncherUpdateInfoPayload,
  LauncherUpdateResultPayload,
  MemoryOptions,
} from '@shindo/shared';
import {
  ensureClientUpToDate,
  getLocalClientState,
  getVersionCatalog,
  type EnsureClientOptions,
} from './clientManager';
import { checkLauncherUpdate, ensureLauncherUpdate, applyLauncherUpdate } from './launcherUpdater';
import { getBaseDataDir, getVersionsDir } from '../utils/pathResolver';
import { loadConfig, updateConfig } from './configService';
import { downloadAsset } from './githubClient';
import { accountService, type LaunchAccountContext } from './accountService';
import { ensureJre } from './jreManager';

export interface LaunchCallbacks {
  onLog?: (message: string) => void;
  onError?: (message: string) => void;
  onProgress?: (details: { task: string; progress: number }) => void;
  onClose?: (code: number | null) => void;
}

const LAUNCHWRAPPER_URL =
  'https://libraries.minecraft.net/net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar';
const REQUIRED_LIBRARIES = [
  {
    relativePath: 'org/ow2/asm/asm-all/5.0.3/asm-all-5.0.3.jar',
    url: 'https://libraries.minecraft.net/org/ow2/asm/asm-all/5.0.3/asm-all-5.0.3.jar',
  },
];

async function ensureLaunchWrapperJar(root: string): Promise<void> {
  const jarPath = path.join(
    root,
    'libraries',
    'net',
    'minecraft',
    'launchwrapper',
    '1.12',
    'launchwrapper-1.12.jar',
  );
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

type AuthPayload = Awaited<ReturnType<typeof Authenticator.getAuth>>;

function stripUuid(uuid: string): string {
  return uuid.replace(/-/g, '');
}

async function buildAuthorization(context: LaunchAccountContext): Promise<AuthPayload> {
  if (context.accessToken) {
    return {
      access_token: context.accessToken,
      client_token: context.clientToken,
      uuid: stripUuid(context.uuid),
      name: context.username,
      user_properties: {},
    };
  }

  const offline = await Authenticator.getAuth(context.username);
  return {
    ...offline,
    access_token: offline.access_token ?? context.clientToken,
    client_token: context.clientToken,
    uuid: stripUuid(context.uuid),
    name: context.username,
    user_properties: offline.user_properties ?? {},
  };
}

function extractCommand(proc: ChildProcessWithoutNullStreams | null): string[] {
  if (!proc) return [];
  if (Array.isArray(proc.spawnargs) && proc.spawnargs.length > 0) {
    return proc.spawnargs.map((arg) => String(arg));
  }
  return [];
}

export class LauncherService {
  private activeProcess: ChildProcessWithoutNullStreams | null = null;

  async ensureClientUpToDate(options?: EnsureClientOptions): Promise<ClientUpdatePayload> {
    return ensureClientUpToDate(options);
  }

  async getVersionCatalog(): Promise<VersionCatalogPayload> {
    return getVersionCatalog();
  }

  getClientState(): ClientStatePayload {
    const config = loadConfig();
    return getLocalClientState({ versionId: config.versionId });
  }

  async checkLauncherUpdate(): Promise<LauncherUpdateInfoPayload> {
    return checkLauncherUpdate();
  }

  async downloadLauncherUpdate(): Promise<LauncherUpdateResultPayload> {
    return ensureLauncherUpdate();
  }

  async applyLauncherUpdate(downloadedPath?: string | null): Promise<boolean> {
    return applyLauncherUpdate(downloadedPath);
  }

  async stopClient(): Promise<boolean> {
    const proc = this.activeProcess;
    if (!proc || proc.killed) {
      this.activeProcess = null;
      return false;
    }

    try {
      proc.kill('SIGTERM');
    } catch {
      try {
        proc.kill();
      } catch {
        return false;
      }
    }

    const terminated = await new Promise<boolean>((resolve) => {
      let settled = false;

      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      proc.once('close', () => settle(true));
      setTimeout(() => {
        if (!settled) {
          try {
            proc.kill('SIGKILL');
          } catch {
            // ignore hard-kill errors
          }
        }
      }, 2200);
      setTimeout(() => settle(proc.killed), 4200);
    });

    return terminated;
  }

  async launchClient(
    options?: LaunchClientOptionsPayload,
    callbacks?: LaunchCallbacks,
  ): Promise<LaunchClientResultPayload> {
    console.log('[LAUNCHER] launchClient called with options:', options);
    let config = loadConfig();
    console.log('[LAUNCHER] Config loaded:', config);

    const jreResult = await ensureJre(config);
    console.log('[LAUNCHER] JRE reconciliation:', jreResult.message);
    if (jreResult.patch) {
      config = updateConfig(jreResult.patch);
    }

    const selectedBuild =
      typeof options?.build === 'number' && Number.isFinite(options.build)
        ? options.build
        : typeof config.selectedBuild === 'number' && Number.isFinite(config.selectedBuild)
          ? config.selectedBuild
          : undefined;

    console.log('[LAUNCHER] Ensuring selected client build:', {
      versionId: options?.versionId || config.versionId,
      build: selectedBuild ?? null,
    });

    const clientState = await this.ensureClientUpToDate({
      versionId: options?.versionId || config.versionId,
      build: selectedBuild,
    });
    console.log('[LAUNCHER] Client state after ensure:', clientState);

    if (!clientState.versionJsonPath) {
      console.error('[LAUNCHER] ShindoClient.json not found');
      throw new Error('ShindoClient.json not found. Run the update before launching.');
    }

    const root = ensureDataRoot();
    const memory = resolveMemory(config, options?.memory);
    const javaPath = options?.javaPath ?? config.jrePath;
    const versionsDir = getVersionsDir();
    const versionId = options?.versionId || config.versionId || clientState.versionId;
    const versionNumber = clientState.baseVersion ?? '1.8.9';
    const assetIndex = clientState.assetsIndex ?? '1.8';
    const versionJsonRelative = clientState.versionJsonPath
      ? path.relative(versionsDir, clientState.versionJsonPath).split(path.sep).join('/')
      : undefined;

    console.log('[LAUNCHER] Launch parameters:', {
      root,
      memory,
      javaPath,
      versionId,
      versionNumber,
      assetIndex,
      versionJsonRelative,
    });

    const configJvmArgs = parseJvmArgs(config.jvmArgs);
    const combinedJavaArgs = [...configJvmArgs, ...(options?.customArgs ?? [])];

    const accountContext = await accountService.getLaunchContext();
    console.log('[LAUNCHER] Account context:', accountContext);

    const authorization = await buildAuthorization(accountContext);
    console.log('[LAUNCHER] Authorization built');

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

    console.log('[LAUNCHER] Ensuring launch wrapper and libraries');
    await ensureLaunchWrapperJar(root);
    await ensureRequiredLibraries(root);

    console.log('[LAUNCHER] Calling minecraft-launcher-core launch');
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

    console.log('[LAUNCHER] Process launched, pid:', proc?.pid);
    this.activeProcess = proc ?? null;

    if (proc) {
      proc.on('close', (code) => {
        this.activeProcess = null;
        callbacks?.onClose?.(code);
      });
    }

    return {
      pid: proc?.pid ?? null,
      command: extractCommand(proc),
      startedAt,
    };
  }
}
