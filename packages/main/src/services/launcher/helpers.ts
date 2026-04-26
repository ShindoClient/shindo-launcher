import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Authenticator } from 'minecraft-launcher-core';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { LauncherConfig, MemoryOptions } from '@shindo/shared';
import { downloadAsset } from '../githubClient';
import { getBaseDataDir } from '../../utils/pathResolver';

// ─── Constants ────────────────────────────────────────────────────────────────

const LAUNCHWRAPPER_URL =
  'https://libraries.minecraft.net/net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar';

const REQUIRED_LIBRARIES = [
  {
    relativePath: 'org/ow2/asm/asm-all/5.0.3/asm-all-5.0.3.jar',
    url: 'https://libraries.minecraft.net/org/ow2/asm/asm-all/5.0.3/asm-all-5.0.3.jar',
  },
];

// ─── Library Helpers ──────────────────────────────────────────────────────────

async function downloadIfMissing(url: string, dest: string): Promise<void> {
  try {
    if (fs.statSync(dest).size > 0) return;
  } catch {
    // File missing or unreadable — download it
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const stream = await downloadAsset(url);
  await pipeline(stream, fs.createWriteStream(dest));
}

export async function ensureLaunchWrapperJar(root: string): Promise<void> {
  const dest = path.join(root, 'libraries', 'net', 'minecraft', 'launchwrapper', '1.12', 'launchwrapper-1.12.jar');
  await downloadIfMissing(LAUNCHWRAPPER_URL, dest);
}

export async function ensureRequiredLibraries(root: string): Promise<void> {
  for (const { relativePath, url } of REQUIRED_LIBRARIES) {
    const dest = path.join(root, 'libraries', ...relativePath.split('/'));
    await downloadIfMissing(url, dest);
  }
}

export function ensureDataRoot(): string {
  const root = getBaseDataDir();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

// ─── Launch Config ────────────────────────────────────────────────────────────

export function resolveMemory(
  config: LauncherConfig,
  memory?: MemoryOptions,
): Required<MemoryOptions> {
  return {
    min: memory?.min ?? '1G',
    max: memory?.max ?? `${Math.max(1, config.ramGB)}G`,
  };
}

export function parseJvmArgs(args?: string): string[] {
  if (!args) return [];
  return (args.match(/"[^"]+"|\S+/g) ?? []).map((t) => t.replace(/^"(.*)"$/, '$1'));
}

// ─── Authorization ────────────────────────────────────────────────────────────

type AuthPayload = Awaited<ReturnType<typeof Authenticator.getAuth>>;

export async function buildAuthorization(context: {
  accessToken?: string | null;
  clientToken: string;
  uuid: string;
  username: string;
}): Promise<AuthPayload> {
  const uuid = context.uuid.replace(/-/g, '');

  if (context.accessToken) {
    return {
      access_token: context.accessToken,
      client_token: context.clientToken,
      uuid,
      name: context.username,
      user_properties: {},
    } as AuthPayload;
  }

  const offline = await Authenticator.getAuth(context.username);
  return {
    ...offline,
    access_token: offline.access_token ?? context.accessToken ?? context.clientToken,
    client_token: context.clientToken,
    uuid,
    name: context.username,
    user_properties: offline.user_properties ?? {},
  } as AuthPayload;
}

// ─── Process Helpers ──────────────────────────────────────────────────────────

export function extractCommand(proc: ChildProcessWithoutNullStreams | null): string[] {
  if (!proc) return [];
  return Array.isArray(proc.spawnargs) ? proc.spawnargs.map(String) : [];
}
