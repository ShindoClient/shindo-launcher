import type { JavaMajor } from '@shindo/shared';
import { sanitizeVersionId } from '../config/distributionConfig';
import { loadVersioningManifest, VersioningEntry, VersioningManifest } from './cdnClient';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedManifest: VersioningManifest | null = null;
let cacheExpiresAt = 0;

async function getCachedManifest(force = false): Promise<VersioningManifest | null> {
  const now = Date.now();
  if (!force && cachedManifest && now < cacheExpiresAt) {
    return cachedManifest;
  }

  const manifest = await loadVersioningManifest();
  if (manifest) {
    cachedManifest = manifest;
    cacheExpiresAt = now + CACHE_TTL_MS;
    return cachedManifest;
  }

  if (cachedManifest) {
    cacheExpiresAt = now + CACHE_TTL_MS;
    return cachedManifest;
  }

  return null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function extractEntryId(entry: VersioningEntry): string | null {
  const raw = entry.versionId ?? entry.id;
  return raw ? sanitizeVersionId(raw) : null;
}

function findVersionEntry(
  manifest: VersioningManifest,
  versionId?: string | null,
  minecraftVersion?: string | null,
): VersioningEntry | null {
  const targetId = versionId ? sanitizeVersionId(versionId) : null;
  const defaultId = manifest.defaultVersionId ? sanitizeVersionId(manifest.defaultVersionId) : null;

  const entries: VersioningEntry[] = [];
  if (Array.isArray(manifest.versions)) {
    entries.push(...manifest.versions);
  } else if (manifest.versions && typeof manifest.versions === 'object') {
    entries.push(...Object.values(manifest.versions));
  }
  if (manifest.latest) {
    entries.push(manifest.latest);
  }

  let fallbackEntry: VersioningEntry | null = null;

  for (const entry of entries) {
    const entryId = extractEntryId(entry);
    if (entryId) {
      if (targetId && entryId === targetId) {
        return entry;
      }
      if (!targetId && defaultId && entryId === defaultId) {
        fallbackEntry = entry;
      }
      if (targetId && defaultId && entryId === defaultId) {
        fallbackEntry = entry;
      }
    }
  }

  if (fallbackEntry) {
    return fallbackEntry;
  }

  if (minecraftVersion) {
    const normalized = minecraftVersion.trim();
    if (normalized) {
      for (const entry of entries) {
        const entryMinecraft = asString(entry.minecraftVersion) ?? asString(entry.baseVersion);
        if (entryMinecraft && entryMinecraft === normalized) {
          return entry;
        }
      }
    }
  }

  return manifest.latest ?? null;
}

function parseJavaMajorFromValue(value: unknown): JavaMajor | null {
  if (value == null) return null;
  if (typeof value === 'number') {
    if ([8, 11, 16, 17, 21].includes(value)) {
      return value as JavaMajor;
    }
    return null;
  }
  if (typeof value === 'string') {
    const digits = value.match(/\d+/g);
    if (!digits) return null;
    const numeric = Number(digits.join(''));
    if (Number.isNaN(numeric)) return null;
    if ([8, 11, 16, 17, 21].includes(numeric)) {
      return numeric as JavaMajor;
    }
  }
  return null;
}

export async function resolveJavaMajorFromVersioning(
  versionId?: string | null,
  minecraftVersion?: string | null,
): Promise<JavaMajor | null> {
  const manifest = await getCachedManifest();
  if (!manifest) return null;

  const entry = findVersionEntry(manifest, versionId, minecraftVersion);
  if (!entry) return null;

  const candidate = entry.javaId ?? entry.javaVersion ?? entry.javaMajor ?? null;
  return parseJavaMajorFromValue(candidate);
}
