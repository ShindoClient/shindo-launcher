import { fetchJson, fetchText, fetchStream } from '../../utils/fetch';
import { parseCatalog } from './catalogParser';
import type { VersionCatalog, VersionEntry, VersionBuild, ReleaseChannel } from '@shindo/shared';
import { logMessage } from '../log';

const CDN_BASE = 'https://cdn.shindoclient.com';
const CATALOG_URL = `${CDN_BASE}/data/meta/versioning.json`;

export interface ResolvedBuild {
  entry: VersionEntry;
  build: VersionBuild;
}

export async function fetchVersionCatalog(): Promise<VersionCatalog | null> {
  try {
    const raw = await fetchJson<unknown>(CATALOG_URL, { timeoutMs: 10_000 });
    return parseCatalog(raw);
  } catch (err) {
    logMessage('warn', `Failed to fetch version catalog: ${String(err)}`);
    return null;
  }
}

export async function resolveTargetBuild(
  catalog: VersionCatalog,
  versionId: string,
  opts: { build?: number | null; channel?: ReleaseChannel } = {},
): Promise<ResolvedBuild | null> {
  const entry = catalog.entries.find((e) => e.id === versionId && e.enabled);
  if (!entry || entry.builds.length === 0) return null;

  let build: VersionBuild | undefined;

  if (typeof opts.build === 'number') {
    build = entry.builds.find((b) => b.build === opts.build);
  }

  if (!build) {
    const channel = opts.channel ?? 'stable';
    build = entry.builds.find((b) => b.type === channel) ?? entry.builds[0];
  }

  return build ? { entry, build } : null;
}

export async function fetchRemoteVersionText(versionUrl: string): Promise<string | null> {
  try {
    return (await fetchText(versionUrl, { timeoutMs: 8_000 })).trim();
  } catch {
    return null;
  }
}

export async function downloadFile(url: string): Promise<NodeJS.ReadableStream> {
  return fetchStream(url);
}
