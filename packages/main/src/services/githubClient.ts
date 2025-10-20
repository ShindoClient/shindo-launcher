import { Readable } from 'node:stream';
import { ReadableStream as WebReadableStream } from 'node:stream/web';

const GITHUB_API = 'https://api.github.com';
const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'shindo-launcher',
  Accept: 'application/vnd.github+json',
};

type FetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  body?: unknown;
  text(): Promise<string>;
  json(): Promise<unknown>;
};

type FetchFn = (input: string, init?: Record<string, unknown>) => Promise<FetchResponse>;

export class GitHubHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'GitHubHttpError';
  }
}

let cachedFetch: FetchFn | null = null;

async function getFetch(): Promise<FetchFn> {
  if (cachedFetch) return cachedFetch;

  const nativeFetch = (globalThis as Record<string, unknown>).fetch;
  if (typeof nativeFetch === 'function') {
    cachedFetch = nativeFetch as FetchFn;
    return cachedFetch;
  }

  const mod = await import('node-fetch');
  const impl = (mod as Record<string, unknown>).default ?? mod;
  cachedFetch = impl as FetchFn;
  return cachedFetch;
}

async function requestJson<T>(url: string): Promise<T> {
  const fetch = await getFetch();
  const response = await fetch(url, { headers: DEFAULT_HEADERS });
  await ensureOk(response, 'GitHub request failed');
  return response.json() as Promise<T>;
}

async function ensureOk(response: FetchResponse, errorPrefix: string): Promise<void> {
  if (response.ok) return;
  const body = await response.text();
  throw new GitHubHttpError(response.status, `${errorPrefix}: ${response.status} ${response.statusText} :: ${body}`);
}

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

export async function fetchLatestRelease(repo: string): Promise<GitHubRelease> {
  return requestJson<GitHubRelease>(`${GITHUB_API}/repos/${repo}/releases/latest`);
}

export interface DownloadAssetOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
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
  if (!response.body) {
    throw new Error('Asset download failed: empty body');
  }
  return toNodeStream(response.body);
}

async function toNodeStream(body: unknown): Promise<NodeJS.ReadableStream> {
  if (!body) throw new Error('Asset download failed: empty body');

  if (typeof (body as NodeJS.ReadableStream).pipe === 'function') {
    return body as NodeJS.ReadableStream;
  }

  if (typeof (body as WebReadableStream).getReader === 'function') {
    return Readable.fromWeb(body as WebReadableStream);
  }

  throw new Error('Unsupported response body type');
}
