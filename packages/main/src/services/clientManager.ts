import fs from 'node:fs';
import path from 'node:path';
import { buffer } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';
import AdmZip from 'adm-zip';
import type {
  ClientStatePayload,
  ClientUpdatePayload,
  ReleaseAssetInfo,
  ReleaseInfo,
} from '@shindo/shared';
import { getBaseDataDir, getTempDir, getVersionsDir } from '../utils/pathResolver';
import { downloadAsset, fetchLatestRelease, GitHubAsset, GitHubRelease } from './githubClient';

const CLIENT_REPO = 'ShindoClient/Shindo-Client';
const VERSION_ASSET = 'version.txt';
const ZIP_ASSET = 'ShindoClient.zip';
const VERSION_FILE_NAME = 'version.txt';
const CLIENT_VERSION_NAME = 'ShindoClient';
const VERSION_FILE_ENCODING: BufferEncoding = 'utf8';

export interface EnsureClientOptions {
  force?: boolean;
}

function findAsset(assets: GitHubAsset[], name: string): GitHubAsset | undefined {
  return assets.find((asset) => asset.name?.toLowerCase() === name.toLowerCase());
}

async function loadRemoteVersion(asset: GitHubAsset): Promise<string> {
  const stream = await downloadAsset(asset.browser_download_url);
  const buf = await buffer(stream);
  return buf.toString(VERSION_FILE_ENCODING).trim();
}

function readLocalVersion(versionFile: string): string | null {
  if (!fs.existsSync(versionFile)) {
    return null;
  }
  return fs.readFileSync(versionFile, VERSION_FILE_ENCODING).trim();
}

function locateShindoJson(dir: string): string | null {
  if (!dir || !fs.existsSync(dir)) {
    return null;
  }

  const queue: string[] = [dir];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(full);
        continue;
      }
      if (entry.name === 'ShindoClient.json') {
        return full;
      }
    }
  }
  return null;
}

interface ParsedClientJson {
  baseVersion: string | null;
  id: string;
  assets: string | null;
}

function parseClientJson(jsonPath: string | null): ParsedClientJson {
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    return { baseVersion: null, id: CLIENT_VERSION_NAME, assets: null };
  }
  const content = fs.readFileSync(jsonPath, VERSION_FILE_ENCODING);
  const data = JSON.parse(content) as {
    inheritsFrom?: string;
    minecraftVersion?: string;
    id?: string;
    assets?: string;
  };
  const baseVersion = data.inheritsFrom ?? data.minecraftVersion ?? null;
  const id = data.id ?? CLIENT_VERSION_NAME;
  const assets = data.assets ?? null;
  return { baseVersion, id, assets };
}

async function downloadZip(asset: GitHubAsset, destinationFile: string): Promise<void> {
  const stream = await downloadAsset(asset.browser_download_url);
  const writeStream = fs.createWriteStream(destinationFile);
  await pipeline(stream, writeStream);
}

function cleanDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

async function extractZip(zipFile: string, destinationDir: string): Promise<void> {
  const zip = new AdmZip(zipFile);
  zip.extractAllTo(destinationDir, true);
}

function mapAsset(asset: GitHubAsset): ReleaseAssetInfo {
  return {
    name: asset.name,
    downloadUrl: asset.browser_download_url,
    size: asset.size,
    contentType: asset.content_type,
  };
}

function mapRelease(release: GitHubRelease): ReleaseInfo {
  return {
    id: release.id,
    name: release.name,
    tagName: release.tag_name,
    body: release.body,
    url: release.html_url,
    publishedAt: release.published_at,
    assets: (release.assets ?? []).map(mapAsset),
  };
}

export async function ensureClientUpToDate(
  { force = false }: EnsureClientOptions = {},
): Promise<ClientUpdatePayload> {
  const release = await fetchLatestRelease(CLIENT_REPO);
  const versionAsset = findAsset(release.assets ?? [], VERSION_ASSET);
  const zipAsset = findAsset(release.assets ?? [], ZIP_ASSET);

  if (!versionAsset || !zipAsset) {
    throw new Error('Release assets version.txt or ShindoClient.zip not found');
  }

  const remoteVersion = await loadRemoteVersion(versionAsset);

  const baseDir = getBaseDataDir();
  const versionsDir = getVersionsDir();
  const clientDir = path.join(versionsDir, CLIENT_VERSION_NAME);
  if (!fs.existsSync(clientDir)) {
    fs.mkdirSync(clientDir, { recursive: true });
  }
  const versionFile = path.join(baseDir, VERSION_FILE_NAME);
  const localVersion = readLocalVersion(versionFile);

  if (!force && localVersion && localVersion === remoteVersion) {
    const jsonPath = locateShindoJson(clientDir);
    const { baseVersion, id, assets } = parseClientJson(jsonPath);
    const payload: ClientUpdatePayload = {
      updated: false,
      version: remoteVersion,
      baseVersion,
      versionId: id,
      clientDir,
      versionJsonPath: jsonPath,
    };
    return payload;
  }

  const tempDir = getTempDir();
  const zipPath = path.join(tempDir, `${CLIENT_VERSION_NAME}-${remoteVersion}.zip`);

  await downloadZip(zipAsset, zipPath);
  if (fs.existsSync(clientDir)) {
    fs.rmSync(clientDir, { recursive: true, force: true });
  }
  await extractZip(zipPath, clientDir);
  fs.rmSync(zipPath, { force: true });
  fs.writeFileSync(versionFile, `${remoteVersion}\n`, VERSION_FILE_ENCODING);

  const jsonPath = locateShindoJson(clientDir);
  const { baseVersion, id, assets } = parseClientJson(jsonPath);

  const payload: ClientUpdatePayload = {
    updated: true,
    version: remoteVersion,
    baseVersion,
    versionId: id,
    clientDir,
    versionJsonPath: jsonPath,
    clientPackagePath: null,
    assetsIndex: assets,
    release: mapRelease(release),
  };
  return payload;
}

export function getLocalClientState(): ClientStatePayload {
  const baseDir = getBaseDataDir();
  const versionsDir = getVersionsDir();
  const clientDir = path.join(versionsDir, CLIENT_VERSION_NAME);
  if (!fs.existsSync(clientDir)) {
    fs.mkdirSync(clientDir, { recursive: true });
  }
  const versionFile = path.join(baseDir, VERSION_FILE_NAME);
  const localVersion = readLocalVersion(versionFile);
  const jsonPath = locateShindoJson(clientDir);
  const { baseVersion, id, assets } = parseClientJson(jsonPath);
  const payload: ClientStatePayload = {
    version: localVersion,
    baseVersion,
    versionId: id,
    clientDir,
    versionJsonPath: jsonPath,
    clientPackagePath: null,
    assetsIndex: assets,
  };
  return payload;
}
