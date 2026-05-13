// Uses the native fetch available in Node 18+ / Electron 28+
// No external dependency needed.

export interface FetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const { timeoutMs = 15_000, headers } = opts;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const { timeoutMs = 15_000 } = opts;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    return res.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchStream(url: string, timeoutMs = 60_000): Promise<NodeJS.ReadableStream> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok || !res.body) {
      throw new Error(`Download failed: HTTP ${res.status} — ${url}`);
    }
    const { Readable } = await import('node:stream');
    return Readable.fromWeb(res.body as import('stream/web').ReadableStream);
  } finally {
    clearTimeout(timeout);
  }
}
