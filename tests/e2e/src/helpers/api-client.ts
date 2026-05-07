import { config } from './config.js';

export interface ApiResponse<T = unknown> {
  readonly status: number;
  readonly ok: boolean;
  readonly body: T;
  readonly raw: string;
}

interface RequestOptions {
  /** Optional Firebase ID token for Bearer auth. */
  readonly idToken?: string;
  /** Extra headers — overrides defaults. */
  readonly headers?: Record<string, string>;
  /** Override Host header (used for /.well-known/atproto-did calls). */
  readonly host?: string;
}

function resolveUrl(path: string): string {
  return path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${config.apiBase}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildHeaders(opts: RequestOptions, jsonBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
  };
  if (jsonBody) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.idToken !== undefined) {
    headers.Authorization = `Bearer ${opts.idToken}`;
  }
  if (opts.host !== undefined) {
    // Note: native fetch may not let us override Host. Some hosts allow it via
    // node-fetch / undici behavior; for our purposes, when we call a different
    // hostname directly via URL, the Host header is set automatically.
    headers.Host = opts.host;
  }
  return { ...headers, ...(opts.headers ?? {}) };
}

async function parseBody(res: Response): Promise<{ body: unknown; raw: string }> {
  const raw = await res.text();
  const ctype = res.headers.get('content-type') ?? '';
  if (raw.length === 0) {
    return { body: null, raw };
  }
  if (ctype.includes('application/json')) {
    try {
      return { body: JSON.parse(raw), raw };
    } catch {
      return { body: raw, raw };
    }
  }
  return { body: raw, raw };
}

export async function apiGet<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const url = resolveUrl(path);
  const res = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(options, false),
  });
  const { body, raw } = await parseBody(res);
  return { status: res.status, ok: res.ok, body: body as T, raw };
}

export async function apiPost<T = unknown>(
  path: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const url = resolveUrl(path);
  const init: RequestInit = {
    method: 'POST',
    headers: buildHeaders(options, body !== undefined && body !== null),
  };
  if (body !== undefined && body !== null) {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const { body: parsed, raw } = await parseBody(res);
  return { status: res.status, ok: res.ok, body: parsed as T, raw };
}
