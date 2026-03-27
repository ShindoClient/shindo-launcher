import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Authenticator } from 'minecraft-launcher-core';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { LauncherConfig, MemoryOptions } from '@shindo/shared';
import { downloadAsset } from '../githubClient';
import { getBaseDataDir } from '../../utils/pathResolver';

const LAUNCHWRAPPER_URL =
  'https://libraries.minecraft.net/net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar';
const REQUIRED_LIBRARIES = [
  {
    relativePath: 'org/ow2/asm/asm-all/5.0.3/asm-all-5.0.3.jar',
    url: 'https://libraries.minecraft.net/org/ow2/asm/asm-all/5.0.3/asm-all-5.0.3.jar',
  },
];

export async function ensureLaunchWrapperJar(root: string): Promise<void> {
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

export async function ensureRequiredLibraries(root: string): Promise<void> {
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

export function ensureDataRoot(): string {
  const root = getBaseDataDir();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

export function resolveMemory(config: LauncherConfig, memory?: MemoryOptions): Required<MemoryOptions> {
  const maxFromConfig = `${Math.max(1, config.ramGB)}G`;
  return {
    min: memory?.min ?? '1G',
    max: memory?.max ?? maxFromConfig,
  };
}

export function parseJvmArgs(args?: string): string[] {
  if (!args) return [];
  const tokens = args.match(/"[^"]+"|\S+/g) ?? [];
  return tokens.map((token) => token.replace(/^"(.*)"$/, '$1'));
}

type AuthPayload = Awaited<ReturnType<typeof Authenticator.getAuth>>;

function stripUuid(uuid: string): string {
  return uuid.replace(/-/g, '');
}

export async function buildAuthorization(context: {
  accessToken?: string | null;
  clientToken: string;
  uuid: string;
  username: string;
}): Promise<AuthPayload> {
  if (context.accessToken) {
    return {
      access_token: context.accessToken,
      client_token: context.clientToken,
      uuid: stripUuid(context.uuid),
      name: context.username,
      user_properties: {},
    } as AuthPayload;
  }

  const offline = await Authenticator.getAuth(context.username);
  return {
    ...offline,
    access_token: offline.access_token ?? context.accessToken ?? context.clientToken,
    client_token: context.clientToken,
    uuid: stripUuid(context.uuid),
    name: context.username,
    user_properties: offline.user_properties ?? {},
  } as AuthPayload;
}

export function extractCommand(proc: ChildProcessWithoutNullStreams | null): string[] {
  if (!proc) return [];
  if (Array.isArray(proc.spawnargs) && proc.spawnargs.length > 0) {
    return proc.spawnargs.map((arg) => String(arg));
  }
  return [];
}
