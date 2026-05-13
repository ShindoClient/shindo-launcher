import path from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { Client } from 'minecraft-launcher-core';
import { loadConfig } from '../config';
import { ensureClientUpToDate } from '../client/clientManager';
import { ensureJavaRuntime, javaForMinecraft } from '../java/jreManager';
import { validateJavaExecutable } from '../java/jreManager';
import { getBaseDataDir, getVersionsDir } from '../../utils/paths';
import { getLaunchContext } from '../account/accountService';
import { logMessage } from '../log';
import type { LaunchOptions, LaunchResult } from '@shindo/shared';

export interface LaunchCallbacks {
  onLog?: (msg: string) => void;
  onClose?: (code: number | null) => void;
}

let activeProcess: ChildProcess | null = null;

function parseJvmArgs(raw: string): string[] {
  return raw.trim().split(/\s+/).filter(Boolean);
}

function resolveMemory(ramGB: number): { min: string; max: string } {
  const gb = Math.max(1, Math.min(ramGB, 64));
  return { min: `${Math.max(512, Math.floor(gb * 512))}M`, max: `${gb}G` };
}

async function resolveJavaPath(requiredMajor: number): Promise<string> {
  const config = loadConfig();

  if (config.javaSource === 'custom' && config.javaCustomPath) {
    const result = validateJavaExecutable(config.javaCustomPath);
    if (result.ok) return config.javaCustomPath;
    logMessage('warn', `Custom Java invalid (${result.error}), falling back to auto`);
  }

  const runtime = await ensureJavaRuntime(requiredMajor as 8 | 11 | 16 | 17 | 21);
  return runtime.path;
}

export async function launchClient(
  opts: LaunchOptions,
  callbacks: LaunchCallbacks = {},
): Promise<LaunchResult> {
  if (activeProcess) throw new Error('A Minecraft instance is already running');

  const config = loadConfig();
  const versionId = opts.versionId ?? config.versionId;
  const root = getBaseDataDir();

  // Ensure client files are ready
  const clientState = await ensureClientUpToDate({
    versionId,
    build: typeof opts.build === 'number' ? opts.build : config.selectedBuild,
    releaseChannel: config.releaseChannel,
  });

  if (!clientState.versionJsonPath) {
    throw new Error('ShindoClient.json not found. Run update before launching.');
  }

  const mcVersion = clientState.baseVersion ?? '1.8.9';
  const requiredJava = javaForMinecraft(mcVersion);
  const javaPath = await resolveJavaPath(requiredJava);

  const memory = opts.memory
    ? { min: opts.memory.min ?? '512M', max: opts.memory.max ?? `${config.ramGB}G` }
    : resolveMemory(config.ramGB);

  const customArgs = [...parseJvmArgs(config.jvmArgs), ...(opts.customArgs ?? [])];

  const accountCtx = await getLaunchContext();


  const authorization = {
    access_token: accountCtx.accessToken ?? 'offline',
    client_token: accountCtx.clientToken,
    uuid: accountCtx.uuid,
    name: accountCtx.username,
    user_properties: {},
  } 

  const assetIndex = clientState.assetsIndex ?? '1.8';
  const versionsDir = getVersionsDir();
  const versionJsonRelative = clientState.versionJsonPath
    ? path.relative(versionsDir, clientState.versionJsonPath).split(path.sep).join('/')
    : undefined;

  const launcher = new Client();

  if (callbacks.onLog) {
    launcher.on('debug', (line: string) => callbacks.onLog!(line));
    launcher.on('data', (line: string) => callbacks.onLog!(line));
  }

  const startedAt = Date.now();
  const proc = await launcher.launch({
    root,
    javaPath,
    authorization,
    version: { number: mcVersion, type: 'release', custom: versionId },
    memory,
    customArgs,
    customLaunchArgs: opts.customLaunchArgs ?? [],
    overrides: {
      directory: clientState.clientDir,
      versionJson: versionJsonRelative,
      versionName: versionId,
      assetIndex,
      assetRoot: path.join(root, 'assets'),
    },
  });

  activeProcess = (proc as ChildProcess) ?? null;

  proc?.on('close', (code: number | null) => {
    activeProcess = null;
    callbacks.onClose?.(code);
  });

  logMessage('info', `ShindoClient launched (pid ${proc?.pid ?? 'unknown'})`);

  return {
    pid: proc?.pid ?? null,
    command: [],
    startedAt,
  };
}

export async function stopClient(): Promise<boolean> {
  const proc = activeProcess;
  if (!proc) return false;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (v: boolean) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };

    try {
      proc.kill('SIGTERM');
    } catch {
      try {
        proc.kill();
      } catch {
        settle(false);
        return;
      }
    }

    proc.once('close', () => settle(true));
    setTimeout(() => {
      if (!settled)
        try {
          proc.kill('SIGKILL');
        } catch {
          /* ignore */
        }
    }, 2_200);
    setTimeout(() => settle(proc.killed), 4_200);
  });
}
