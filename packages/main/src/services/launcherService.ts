import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'minecraft-launcher-core';
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
import { getVersionsDir } from '../utils/pathResolver';
import { loadConfig, updateConfig } from './configService';
import { accountService, type LaunchAccountContext } from './accountService';
import {
  determineJavaMajor,
  ensureJavaRuntime,
  summarizeValidation,
  validateJavaExecutable,
  type JavaProgressPayload,
} from './jreManager';
import {
  buildAuthorization,
  ensureDataRoot,
  ensureLaunchWrapperJar,
  ensureRequiredLibraries,
  extractCommand,
  parseJvmArgs,
  resolveMemory,
} from './launcher/helpers';

export interface LaunchCallbacks {
  onLog?: (message: string) => void;
  onError?: (message: string) => void;
  onProgress?: (details: { task: string; progress: number }) => void;
  onClose?: (code: number | null) => void;
  onJavaProgress?: (payload: JavaProgressPayload) => void;
  onJavaReady?: (payload: { path: string; major: number; source: string }) => void;
  onJavaError?: (message: string) => void;
}

export class LauncherService {
  private activeProcess: ChildProcessWithoutNullStreams | null = null;
  private jreNotifier:
    | ((payload: { message: string; severity: 'info' | 'warning' }) => void)
    | null = null;

  setJreNotifier(
    notifier: (payload: { message: string; severity: 'info' | 'warning' }) => void,
  ): void {
    this.jreNotifier = notifier;
  }

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

    const selectedBuild =
      typeof options?.build === 'number' && Number.isFinite(options.build)
        ? options.build
        : typeof config.selectedBuild === 'number' && Number.isFinite(config.selectedBuild)
          ? config.selectedBuild
          : undefined;

    const clientState = await this.ensureClientUpToDate({
      versionId: options?.versionId || config.versionId,
      build: selectedBuild,
    });
    console.log('[LAUNCHER] Client state after ensure:', clientState);

    if (!clientState.versionJsonPath) {
      console.error('[LAUNCHER] ShindoClient.json not found');
      throw new Error('ShindoClient.json not found. Run the update before launching.');
    }

    const requiredJava = await determineJavaMajor(
      clientState.versionId ?? null,
      clientState.baseVersion ?? clientState.versionId ?? null,
    );
    let javaPath = options?.javaPath ?? null;

    if (!javaPath && config.javaSource === 'custom' && config.javaCustomPath) {
      const validation = validateJavaExecutable(config.javaCustomPath);
      if (validation.ok) {
        const summary = summarizeValidation(validation);
        const resolvedMajor = summary.major ?? requiredJava;
        javaPath = config.javaCustomPath;
        config = updateConfig({
          javaSource: 'custom',
          javaCustomPath: config.javaCustomPath,
          javaPath,
          javaRuntimeMajor: resolvedMajor,
        });
        this.jreNotifier?.({
          message: `Usando Java custom em ${javaPath}`,
          severity: 'info',
        });
        callbacks?.onJavaReady?.({ path: javaPath, major: resolvedMajor, source: 'custom' });
      } else {
        const message = validation.error ?? 'Java personalizado inválido';
        this.jreNotifier?.({ message: `${message}. Voltando para Java automático.`, severity: 'warning' });
        callbacks?.onJavaError?.(message);
        config = updateConfig({ javaSource: 'auto', javaPath: null, javaCustomPath: null, javaRuntimeMajor: undefined });
      }
    }

    if (!javaPath) {
      callbacks?.onJavaProgress?.({
        message: `Preparando Java ${requiredJava}...`,
        percent: 5,
      });
      try {
        const runtime = await ensureJavaRuntime(requiredJava, callbacks?.onJavaProgress);
        javaPath = runtime.path;
        config = updateConfig({
          javaSource: 'auto',
          javaPath,
          javaRuntimeMajor: runtime.major,
        });
        this.jreNotifier?.({
          message: `Java ${runtime.major} pronto em ${javaPath}`,
          severity: 'info',
        });
        callbacks?.onJavaReady?.({
          path: javaPath,
          major: runtime.major,
          source: runtime.source,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        callbacks?.onJavaError?.(message);
        throw error;
      }
    }

    if (!javaPath) {
      throw new Error('Java não pôde ser determinado');
    }

    const root = ensureDataRoot();
    const memory = resolveMemory(config, options?.memory);
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
