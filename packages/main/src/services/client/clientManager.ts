import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import AdmZip from 'adm-zip';
import { loadConfig } from '../config';
import {
  fetchVersionCatalog,
  resolveTargetBuild,
  fetchRemoteVersionText,
  downloadFile,
} from '../cdn/cdnClient';
import { getVersionsDir, getTempDir } from '../../utils/paths';
import { logMessage } from '../log';
import type {
  ClientState,
  ClientUpdateResult,
  VersionCatalog,
  ReleaseChannel,
} from '@shindo/shared';

const VERSION_MARKER = '.client-version';
const ENCODING: BufferEncoding = 'utf8';

// ─── Storage helpers ──────────────────────────────────────────────────────────

function clientDir(versionId: string): string {
  const dir = path.join(getVersionsDir(), versionId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function markerPath(versionId: string): string {
  return path.join(clientDir(versionId), VERSION_MARKER);
}

function readLocalVersion(versionId: string): string | null {
  const file = markerPath(versionId);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, ENCODING).trim() || null;
}

function writeLocalVersion(versionId: string, version: string): void {
  fs.writeFileSync(markerPath(versionId), `${version}\n`, ENCODING);
}

// ─── Version JSON helpers ─────────────────────────────────────────────────────

function findVersionJson(dir: string, versionId: string, hint?: string | null): string | null {
  // 1. Hinted path from CDN manifest
  if (hint) {
    const abs = path.isAbsolute(hint) ? hint : path.join(dir, hint);
    if (fs.existsSync(abs)) return abs;
  }
  // 2. Standard well-known paths
  for (const candidate of [
    path.join(dir, `${versionId}.json`),
    path.join(dir, 'ShindoClient.json'),
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  // 3. BFS scan
  const queue = [dir];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(full);
        continue;
      }
      if (entry.name === `${versionId}.json` || entry.name === 'ShindoClient.json') return full;
    }
  }
  return null;
}

interface ParsedVersionJson {
  baseVersion: string | null;
  id: string;
  assetsIndex: string | null;
}

function parseVersionJson(jsonPath: string | null, fallbackId: string): ParsedVersionJson {
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    return { baseVersion: null, id: fallbackId, assetsIndex: null };
  }
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, ENCODING)) as Record<string, unknown>;
    return {
      baseVersion: (data.inheritsFrom ?? data.minecraftVersion ?? null) as string | null,
      id: (data.id ?? fallbackId) as string,
      assetsIndex: (data.assets ?? null) as string | null,
    };
  } catch {
    return { baseVersion: null, id: fallbackId, assetsIndex: null };
  }
}

function normalizeVersionJson(dir: string, versionId: string, hint?: string | null): string | null {
  const found = findVersionJson(dir, versionId, hint);
  if (!found) return null;

  const canonical = path.join(dir, `${versionId}.json`);
  try {
    const raw = JSON.parse(fs.readFileSync(found, ENCODING)) as Record<string, unknown>;
    if (found !== canonical || raw.id !== versionId) {
      fs.writeFileSync(canonical, JSON.stringify({ ...raw, id: versionId }, null, 2), ENCODING);
    }
  } catch {
    /* leave file as-is */
  }

  return fs.existsSync(canonical) ? canonical : found;
}

// ─── Download & extract ───────────────────────────────────────────────────────

async function downloadAndExtract(url: string, destDir: string, versionId: string): Promise<void> {
  const zipPath = path.join(getTempDir(), `${versionId}-${Date.now()}.zip`);
  try {
    const stream = await downloadFile(url);
    await pipeline(stream, fs.createWriteStream(zipPath));
    fs.rmSync(destDir, { recursive: true, force: true });
    fs.mkdirSync(destDir, { recursive: true });
    new AdmZip(zipPath).extractAllTo(destDir, true);
  } finally {
    fs.rmSync(zipPath, { force: true });
  }
}

// ─── Update check ─────────────────────────────────────────────────────────────

function isUpToDate(local: string | null, remote: string): boolean {
  if (!local) return false;
  if (local === remote) return true;
  // Numeric build comparison: "42.1" vs "43.1"
  const [la, lb] = local.split('.').map(Number);
  const [ra, rb] = remote.split('.').map(Number);
  if ([la, lb, ra, rb].some((n) => !Number.isFinite(n))) return false;
  if (ra > la) return false;
  if (ra < la) return true;
  return rb <= lb;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface EnsureClientOptions {
  force?: boolean;
  versionId?: string;
  build?: number | null;
  releaseChannel?: ReleaseChannel;
}

export async function ensureClientUpToDate(
  opts: EnsureClientOptions = {},
): Promise<ClientUpdateResult> {
  const config = loadConfig();
  const versionId = opts.versionId ?? config.versionId;
  const dir = clientDir(versionId);
  const channel = opts.releaseChannel ?? config.releaseChannel;

  const catalog = await fetchVersionCatalog();
  if (!catalog) {
    logMessage('warn', 'Could not fetch version catalog — using cached client if available');
    return { ...getLocalClientState({ versionId }), updated: false };
  }

  const resolved = await resolveTargetBuild(catalog, versionId, { build: opts.build, channel });
  if (!resolved) {
    logMessage('warn', `No build found for version "${versionId}" — using cached client`);
    return { ...getLocalClientState({ versionId }), updated: false };
  }

  const { build } = resolved;
  const remoteVersion = build.versionUrl
    ? ((await fetchRemoteVersionText(build.versionUrl)) ?? build.semver)
    : build.semver;

  const localVersion = readLocalVersion(versionId);

  if (!opts.force && isUpToDate(localVersion, remoteVersion)) {
    const jsonPath = normalizeVersionJson(dir, versionId, build.versionJsonPath);
    const parsed = parseVersionJson(jsonPath, versionId);
    return {
      updated: false,
      version: localVersion,
      baseVersion: resolved.entry.baseVersion ?? parsed.baseVersion,
      versionId: parsed.id,
      clientDir: dir,
      versionJsonPath: jsonPath,
      clientPackagePath: null,
      assetsIndex: resolved.entry.assetsIndex ?? parsed.assetsIndex,
    };
  }

  if (!build.packageUrl) throw new Error(`No packageUrl for build ${build.buildId}`);

  logMessage('info', `Downloading ShindoClient build ${build.buildId}...`);
  await downloadAndExtract(build.packageUrl, dir, versionId);
  writeLocalVersion(versionId, remoteVersion);

  const jsonPath = normalizeVersionJson(dir, versionId, build.versionJsonPath);
  const parsed = parseVersionJson(jsonPath, versionId);

  logMessage('info', `ShindoClient updated to ${remoteVersion}`);
  return {
    updated: true,
    version: remoteVersion,
    baseVersion: resolved.entry.baseVersion ?? parsed.baseVersion,
    versionId: parsed.id,
    clientDir: dir,
    versionJsonPath: jsonPath,
    clientPackagePath: null,
    assetsIndex: resolved.entry.assetsIndex ?? parsed.assetsIndex,
  };
}

export function getLocalClientState(opts: { versionId?: string } = {}): ClientState {
  const versionId = opts.versionId ?? loadConfig().versionId;
  const dir = clientDir(versionId);
  const localVersion = readLocalVersion(versionId);
  const jsonPath = normalizeVersionJson(dir, versionId);
  const parsed = parseVersionJson(jsonPath, versionId);

  return {
    version: localVersion,
    baseVersion: parsed.baseVersion,
    versionId: parsed.id,
    clientDir: dir,
    versionJsonPath: jsonPath,
    clientPackagePath: null,
    assetsIndex: parsed.assetsIndex,
  };
}

export async function getVersionCatalog(): Promise<VersionCatalog> {
  const catalog = await fetchVersionCatalog();
  if (catalog && catalog.entries.length > 0) return catalog;

  // Fallback: build synthetic catalog from local state
  const config = loadConfig();
  const local = getLocalClientState({ versionId: config.versionId });
  const buildNum = local.version ? Number(local.version.split('.')[0]) : null;
  const buildNumber = buildNum && Number.isFinite(buildNum) && buildNum > 0 ? buildNum : null;

  return {
    updatedAt: null,
    defaultVersionId: config.versionId,
    entries: [
      {
        id: config.versionId,
        name: `Shindo Client ${local.baseVersion ?? '1.8.9'}`,
        enabled: true,
        minecraftVersion: local.baseVersion ?? '1.8.9',
        baseVersion: local.baseVersion ?? null,
        assetsIndex: local.assetsIndex ?? null,
        bannerUrl: null,
        latestBuild: buildNumber,
        latestBuildId: buildNumber ? `${buildNumber}.1` : null,
        latestSemver: local.version,
        latestType: 'stable',
        builds: buildNumber
          ? [
              {
                build: buildNumber,
                buildId: `${buildNumber}.1`,
                buildNumber: 1,
                semver: local.version ?? '',
                label: `Build ${buildNumber}`,
                type: 'stable',
                versionBase: buildNumber,
                packageUrl: null,
                jarUrl: null,
                legacyJarUrl: null,
                versionUrl: null,
                versionJsonPath: local.versionJsonPath ?? null,
                releasedAt: null,
              },
            ]
          : [],
      },
    ],
  };
}
