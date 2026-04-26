/**
 * Shared fetch utility — resolves native fetch or falls back to node-fetch.
 * Cached after first resolution to avoid repeated dynamic imports.
 */

export type FetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  body?: unknown;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
};

export type FetchFn = (input: string, init?: Record<string, unknown>) => Promise<FetchResponse>;

let cachedFetch: FetchFn | null = null;

export async function getFetch(): Promise<FetchFn> {
  if (cachedFetch) return cachedFetch;

  const nativeFetch = (globalThis as Record<string, unknown>).fetch;
  if (typeof nativeFetch === 'function') {
    cachedFetch = nativeFetch as FetchFn;
    return cachedFetch;
  }

  const mod = await import('node-fetch');
  cachedFetch = ((mod as Record<string, unknown>).default ?? mod) as FetchFn;
  return cachedFetch;
}
