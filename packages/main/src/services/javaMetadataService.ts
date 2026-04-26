import type { JavaMajor } from '@shindo/shared';
import { sanitizeVersionId } from '../config/distributionConfig';
import type { VersioningEntry, VersioningManifest } from './cdnClient';
import { loadVersioningManifest } from './cdnClient';

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedManifest: VersioningManifest | null = null;
let cacheExpiresAt = 0;

async function getCachedManifest(): Promise<VersioningManifest | null> {
  const now = Date.now();
  if (cachedManifest && now < cacheExpiresAt) return cachedManifest;

  const manifest = await loadVersioningManifest();
  if (manifest) {
    cachedManifest = manifest;
    cacheExpiresAt = now + CACHE_TTL_MS;
  } else if (cachedManifest) {
    // Stale cache is better than nothing on network failure
    cacheExpiresAt = now + CACHE_TTL_MS;
  }

  return cachedManifest;
}

// ─── Entry Matching ───────────────────────────────────────────────────────────

function collectEntries(manifest: VersioningManifest): VersioningEntry[] {
  const entries: VersioningEntry[] = [];

  if (Array.isArray(manifest.versions)) {
    entries.push(...manifest.versions);
  } else if (manifest.versions && typeof manifest.versions === 'object') {
    entries.push(...Object.values(manifest.versions));
  }

  if (manifest.latest) entries.push(manifest.latest);
  return entries;
}

function entryId(entry: VersioningEntry): string | null {
  const raw = entry.versionId ?? entry.id;
  return raw ? sanitizeVersionId(raw) : null;
}

function findVersionEntry(
  manifest: VersioningManifest,
  versionId: string | null | undefined,
  minecraftVersion: string | null | undefined,
): VersioningEntry | null {
  const targetId = versionId ? sanitizeVersionId(versionId) : null;
  const defaultId = manifest.defaultVersionId ? sanitizeVersionId(manifest.defaultVersionId) : null;
  const entries = collectEntries(manifest);

  let fallback: VersioningEntry | null = null;

  for (const entry of entries) {
    const id = entryId(entry);
    if (!id) continue;

    // Exact match wins immediately
    if (targetId && id === targetId) return entry;

    // Track default entry as fallback
    if (defaultId && id === defaultId) fallback ??= entry;
  }

  if (fallback) return fallback;

  // Match by Minecraft version string
  if (minecraftVersion) {
    const mc = minecraftVersion.trim();
    for (const entry of entries) {
      const entryMc =
        (typeof entry.minecraftVersion === 'string' ? entry.minecraftVersion.trim() : null) ||
        (typeof entry.baseVersion === 'string' ? entry.baseVersion.trim() : null);
      if (entryMc && entryMc === mc) return entry;
    }
  }

  return manifest.latest ?? null;
}

// ─── Java Major Parsing ───────────────────────────────────────────────────────

const VALID_MAJORS: JavaMajor[] = [8, 11, 16, 17, 21];

function parseJavaMajor(value: unknown): JavaMajor | null {
  if (value == null) return null;

  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string') {
    const digits = value.match(/\d+/g);
    if (!digits) return null;
    n = Number(digits.join(''));
  } else {
    return null;
  }

  return !Number.isNaN(n) && VALID_MAJORS.includes(n as JavaMajor) ? (n as JavaMajor) : null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolves the required Java major version from the CDN versioning manifest.
 * Returns `null` if no manifest is available or no explicit mapping exists.
 */
export async function resolveJavaMajorFromVersioning(
  versionId?: string | null,
  minecraftVersion?: string | null,
): Promise<JavaMajor | null> {
  const manifest = await getCachedManifest();
  if (!manifest) return null;

  const entry = findVersionEntry(manifest, versionId, minecraftVersion);
  if (!entry) return null;

  return parseJavaMajor(entry.javaId ?? entry.javaVersion ?? entry.javaMajor ?? null);
}
