import { Readable } from 'node:stream';
import { ReadableStream as WebReadableStream } from 'node:stream/web';
import { getFetch } from './fetchClient';

// ─── Constants ────────────────────────────────────────────────────────────────

const GITHUB_API = 'https://api.github.com';
const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'shindo-launcher',
  Accept: 'application/vnd.github+json',
};

// ─── Error ────────────────────────────────────────────────────────────────────

export class GitHubHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GitHubHttpError';
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GitHubAsset {
  id: number;
  name: string;
  browser_download_url: string;
  content_type?: string;
  size?: number;
}

export interface GitHubRelease {
  id: number;
  tag_name?: string;
  name?: string;
  body?: string;
  html_url?: string;
  assets: GitHubAsset[];
  published_at?: string;
}

export interface DownloadAssetOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

async function ensureOk(
  response: { ok: boolean; status: number; statusText: string; text(): Promise<string> },
  errorPrefix: string,
): Promise<void> {
  if (response.ok) return;
  const body = await response.text();
  throw new GitHubHttpError(
    response.status,
    `${errorPrefix}: ${response.status} ${response.statusText} :: ${body}`,
  );
}

function toNodeStream(body: unknown): NodeJS.ReadableStream {
  if (!body) throw new Error('Asset download failed: empty body');
  if (typeof (body as NodeJS.ReadableStream).pipe === 'function') return body as NodeJS.ReadableStream;
  if (typeof (body as WebReadableStream).getReader === 'function') return Readable.fromWeb(body as WebReadableStream);
  throw new Error('Asset download failed: unsupported response body type');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchLatestRelease(repo: string): Promise<GitHubRelease> {
  const fetch = await getFetch();
  const response = await fetch(`${GITHUB_API}/repos/${repo}/releases/latest`, {
    headers: DEFAULT_HEADERS,
  });
  await ensureOk(response, 'GitHub request failed');
  return response.json() as Promise<GitHubRelease>;
}

export async function downloadAsset(
  assetUrl: string,
  { headers = {}, signal }: DownloadAssetOptions = {},
): Promise<NodeJS.ReadableStream> {
  const fetch = await getFetch();
  const response = await fetch(assetUrl, {
    headers: { ...DEFAULT_HEADERS, ...headers },
    signal,
  });
  await ensureOk(response, 'Asset download failed');
  if (!response.body) throw new Error('Asset download failed: empty body');
  return toNodeStream(response.body);
}
