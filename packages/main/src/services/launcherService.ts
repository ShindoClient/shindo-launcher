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
import { accountService } from './accountService';
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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LaunchCallbacks {
  onLog?: (message: string) => void;
  onError?: (message: string) => void;
  onProgress?: (details: { task: string; progress: number }) => void;
  onClose?: (code: number | null) => void;
  onJavaProgress?: (payload: JavaProgressPayload) => void;
  onJavaReady?: (payload: { path: string; major: number; source: string }) => void;
  onJavaError?: (message: string) => void;
}

type JreNotifier = (payload: { message: string; severity: 'info' | 'warning' }) => void;

// ─── LauncherService ──────────────────────────────────────────────────────────

export class LauncherService {
  private activeProcess: ChildProcessWithoutNullStreams | null = null;
  private jreNotifier: JreNotifier | null = null;

  setJreNotifier(notifier: JreNotifier): void {
    this.jreNotifier = notifier;
  }

  // ── Delegation wrappers ───────────────────────────────────────────────────

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

  // ── Process control ───────────────────────────────────────────────────────

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

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      proc.once('close', () => settle(true));
      // Hard-kill escalation after 2.2s
      setTimeout(() => {
        if (!settled) {
          try { proc.kill('SIGKILL'); } catch { /* ignore */ }
        }
      }, 2200);
      // Final settle after 4.2s
      setTimeout(() => settle(proc.killed), 4200);
    });
  }

  // ── Java resolution ───────────────────────────────────────────────────────

  /**
   * Resolves the Java executable path for launch.
   * Priority:
   *  1. Explicit path from launch options
   *  2. Custom path from config (if valid)
   *  3. Auto-managed Adoptium JRE
   */
  private async resolveJavaPath(
    requiredMajor: number,
    explicitPath: string | null | undefined,
    callbacks?: LaunchCallbacks,
  ): Promise<string> {
    // 1. Explicit override from caller
    if (explicitPath) return explicitPath;

    let config = loadConfig();

    // 2. Custom Java from config
    if (config.javaSource === 'custom' && config.javaCustomPath) {
      const validation = validateJavaExecutable(config.javaCustomPath);
      if (validation.ok) {
        const { major: detectedMajor } = summarizeValidation(validation);
        const resolvedMajor = detectedMajor ?? requiredMajor;
        const javaPath = config.javaCustomPath;
        updateConfig({ javaSource: 'custom', javaCustomPath: javaPath, javaPath, javaRuntimeMajor: 8 });
        this.jreNotifier?.({ message: `Usando Java custom em ${javaPath}`, severity: 'info' });
        callbacks?.onJavaReady?.({ path: javaPath, major: resolvedMajor, source: 'custom' });
        return javaPath;
      }

      // Custom path invalid — fall back to auto
      const error = validation.error ?? 'Java personalizado inválido';
      this.jreNotifier?.({ message: `${error}. Voltando para Java automático.`, severity: 'warning' });
      callbacks?.onJavaError?.(error);
      updateConfig({ javaSource: 'auto', javaPath: null, javaCustomPath: null, javaRuntimeMajor: undefined });
    }

    // 3. Auto-managed JRE
    callbacks?.onJavaProgress?.({ message: `Preparando Java ${requiredMajor}...`, percent: 5 });
    try {
      const runtime = await ensureJavaRuntime(requiredMajor as Parameters<typeof ensureJavaRuntime>[0], callbacks?.onJavaProgress);
      updateConfig({ javaSource: 'auto', javaPath: runtime.path, javaRuntimeMajor: runtime.major });
      this.jreNotifier?.({ message: `Java ${runtime.major} pronto em ${runtime.path}`, severity: 'info' });
      callbacks?.onJavaReady?.({ path: runtime.path, major: runtime.major, source: runtime.source });
      return runtime.path;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      callbacks?.onJavaError?.(message);
      throw error;
    }
  }

  // ── Launch ────────────────────────────────────────────────────────────────

  async launchClient(
    options?: LaunchClientOptionsPayload,
    callbacks?: LaunchCallbacks,
  ): Promise<LaunchClientResultPayload> {
    console.log('[LAUNCHER] launchClient called with options:', options);

    const config = loadConfig();

    const selectedBuild =
      typeof options?.build === 'number' && Number.isFinite(options.build)
        ? options.build
        : typeof config.selectedBuild === 'number' && Number.isFinite(config.selectedBuild)
          ? config.selectedBuild
          : undefined;

    // Ensure client files are up-to-date
    const clientState = await this.ensureClientUpToDate({
      versionId: options?.versionId || config.versionId,
      build: selectedBuild,
    });

    if (!clientState.versionJsonPath) {
      throw new Error('ShindoClient.json not found. Run the update before launching.');
    }

    // Determine required Java version from Minecraft version
    const requiredJava = await determineJavaMajor(
      clientState.versionId ?? null,
      clientState.baseVersion ?? clientState.versionId ?? null,
    );

    console.log(
      `[LAUNCHER] Minecraft ${clientState.baseVersion ?? 'unknown'} → requires Java ${requiredJava}`,
    );

    const javaPath = await this.resolveJavaPath(requiredJava, options?.javaPath, callbacks);

    // Build launch parameters
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
      root, memory, javaPath, versionId, versionNumber, assetIndex, versionJsonRelative,
    });

    const customArgs = [
      ...parseJvmArgs(config.jvmArgs),
      ...(options?.customArgs ?? []),
    ];

    const accountContext = await accountService.getLaunchContext();
    const authorization = await buildAuthorization(accountContext);

    // Wire up launcher events
    const launcher = new Client();

    if (callbacks?.onLog) {
      launcher.on('debug', (line: string) => callbacks.onLog?.(line));
      launcher.on('data', (line: string) => callbacks.onLog?.(line));
    }
    if (callbacks?.onError) {
      launcher.on('error', (line: string) => callbacks.onError?.(String(line)));
    }
    if (callbacks?.onProgress) {
      launcher.on('progress', (p: { task: string; type: string; percent: number }) => {
        callbacks.onProgress?.({ task: p.task, progress: p.percent });
      });
    }

    await ensureLaunchWrapperJar(root);
    await ensureRequiredLibraries(root);

    const startedAt = Date.now();
    const proc = await launcher.launch({
      root,
      javaPath,
      authorization,
      version: { number: versionNumber, type: 'release', custom: versionId },
      memory,
      customArgs,
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

    proc?.on('close', (code) => {
      this.activeProcess = null;
      callbacks?.onClose?.(code);
    });

    return {
      pid: proc?.pid ?? null,
      command: extractCommand(proc),
      startedAt,
    };
  }
}
