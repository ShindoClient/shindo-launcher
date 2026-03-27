import path from 'node:path';
import type { UpdateFileInfo, UpdateInfo } from 'electron-updater';
import type { ReleaseAssetInfo, ReleaseInfo } from '@shindo/shared';
import type { GitHubAsset, GitHubRelease } from '../githubClient';

const PLATFORM_HINTS: Partial<Record<NodeJS.Platform, string[]>> = {
  win32: ['win', 'windows', 'exe'],
  darwin: ['mac', 'darwin', 'osx', 'dmg'],
  linux: ['linux', 'appimage', 'deb'],
};

export function mapReleaseFromUpdateInfo(info: UpdateInfo): ReleaseInfo {
  const notes = Array.isArray(info.releaseNotes)
    ? info.releaseNotes
        .map((entry) => {
          if (typeof entry === 'string') {
            return entry;
          }
          if (typeof entry === 'object' && entry !== null && 'note' in entry) {
            return String(entry.note);
          }
          return '';
        })
        .filter(Boolean)
        .join('\n\n')
    : typeof info.releaseNotes === 'string'
      ? info.releaseNotes
      : undefined;

  return {
    id: undefined,
    name: info.releaseName ?? undefined,
    tagName: info.version,
    body: notes,
    url: undefined,
    publishedAt: info.releaseDate ?? undefined,
    assets: (info.files ?? [])
      .map((file) => mapAssetFromFile(file))
      .filter((asset): asset is ReleaseAssetInfo => Boolean(asset)),
  };
}

export function fileNameFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return path.basename(parsed.pathname);
  } catch {
    return url.split('/').pop() ?? url;
  }
}

export function mapAssetFromFile(file: UpdateFileInfo | null | undefined): ReleaseAssetInfo | null {
  if (!file) return null;
  return {
    name: fileNameFromUrl(file.url) ?? file.url,
    downloadUrl: file.url,
    size: typeof file.size === 'number' ? file.size : undefined,
    contentType: undefined,
  };
}

export function pickFileForPlatform(files: UpdateFileInfo[] | undefined): UpdateFileInfo | null {
  if (!files || files.length === 0) {
    return null;
  }

  const platform = process.platform;
  const scored = files
    .filter((file) => Boolean(file?.url))
    .map((file) => {
      const url = file.url ?? '';
      const name = fileNameFromUrl(url)?.toLowerCase() ?? '';
      let score = 0;

      if (platform === 'win32') {
        if (name === 'elevate.exe') {
          score -= 1000;
        }
        if (name.endsWith('.exe')) {
          score += 40;
        }
        if (name.includes('setup') || name.includes('installer')) {
          score += 60;
        }
        if (name.includes('x64')) {
          score += 5;
        }
        if (name.includes('arm')) {
          score -= 10;
        }
      } else if (platform === 'darwin') {
        if (name.endsWith('.dmg')) {
          score += 60;
        }
        if (name.endsWith('.pkg')) {
          score += 40;
        }
        if (name.includes('arm64') && process.arch !== 'arm64') {
          score -= 20;
        }
      } else if (platform === 'linux') {
        if (name.endsWith('.appimage')) {
          score += 60;
        }
        if (name.endsWith('.deb')) {
          score += 40;
        }
        if (name.includes('arm') && process.arch !== 'arm64') {
          score -= 10;
        }
      }

      const hints = PLATFORM_HINTS[platform as NodeJS.Platform] ?? [];
      if (hints.some((hint) => name.includes(hint.toLowerCase()))) {
        score += 10;
      }

      const size = typeof file.size === 'number' ? file.size : 0;
      return { file, score, size };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.size - a.size;
    });

  return scored[0]?.file ?? null;
}

export function mapAsset(asset: GitHubAsset | null | undefined): ReleaseAssetInfo | null {
  if (!asset) return null;
  return {
    name: asset.name,
    downloadUrl: asset.browser_download_url,
    size: asset.size,
    contentType: asset.content_type,
  };
}

export function mapRelease(release: GitHubRelease): ReleaseInfo {
  return {
    id: release.id,
    name: release.name,
    tagName: release.tag_name,
    body: release.body,
    url: release.html_url,
    publishedAt: release.published_at,
    assets: (release.assets ?? [])
      .map((asset) => mapAsset(asset))
      .filter((asset): asset is ReleaseAssetInfo => Boolean(asset)),
  };
}

export function pickAssetForPlatform(assets: GitHubAsset[]): GitHubAsset | null {
  if (!Array.isArray(assets) || assets.length === 0) {
    return null;
  }

  const platform = process.platform;

  const scored = assets
    .filter((asset) => Boolean(asset?.name))
    .map((asset) => {
      const name = (asset.name ?? '').toLowerCase();
      let score = 0;

      if (platform === 'win32') {
        if (name === 'elevate.exe') {
          score -= 1000;
        }
        if (name.endsWith('.exe')) {
          score += 40;
        }
        if (name.includes('setup') || name.includes('installer')) {
          score += 60;
        }
        if (name.includes('x64')) {
          score += 5;
        }
        if (name.includes('arm')) {
          score -= 10;
        }
      } else if (platform === 'darwin') {
        if (name.endsWith('.dmg')) {
          score += 60;
        }
        if (name.endsWith('.pkg')) {
          score += 40;
        }
        if (name.includes('arm64') && process.arch !== 'arm64') {
          score -= 20;
        }
      } else if (platform === 'linux') {
        if (name.endsWith('.appimage')) {
          score += 60;
        }
        if (name.endsWith('.deb')) {
          score += 40;
        }
        if (name.includes('arm') && process.arch !== 'arm64') {
          score -= 10;
        }
      }

      const hints = PLATFORM_HINTS[platform as NodeJS.Platform] ?? [];
      if (hints.some((hint) => name.includes(hint.toLowerCase()))) {
        score += 10;
      }

      const size = typeof asset.size === 'number' ? asset.size : 0;
      return { asset, score, size };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.size - a.size;
    });

  return scored[0]?.asset ?? assets[0] ?? null;
}
