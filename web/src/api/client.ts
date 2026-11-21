import type * as T from "./types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

let csrfToken = "";
let onUnauthorized: (() => void) | null = null;

export function setCsrf(token: string | undefined) {
  csrfToken = token ?? "";
}
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

interface Options {
  body?: unknown;
  /** login/setup: a 401 is a normal answer, not a lost session. */
  anonymous?: boolean;
  signal?: AbortSignal;
}

async function request<R>(method: string, path: string, opts: Options = {}): Promise<R> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET" && !opts.anonymous && csrfToken) headers["X-CSRF-Token"] = csrfToken;

  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      headers,
      credentials: "same-origin",
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "Cannot reach the UniCache server");
  }

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const msg =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed (${res.status} ${res.statusText})`;
    if (res.status === 401 && !opts.anonymous) onUnauthorized?.();
    throw new ApiError(res.status, msg);
  }
  return payload as R;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    p.set(k, v === true ? "1" : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

const enc = encodeURIComponent;

export interface BlobQuery {
  module?: string;
  repo?: string;
  q?: string;
  pinned?: boolean;
  sort?: "recent" | "size" | "hits";
  limit?: number;
  offset?: number;
}

export const api = {
  session: () => request<T.Session>("GET", "/session"),
  setup: (username: string, password: string, token: string) =>
    request<T.AuthResult>("POST", "/setup", { body: { username, password, token }, anonymous: true }),
  login: (username: string, password: string) =>
    request<T.AuthResult>("POST", "/login", { body: { username, password }, anonymous: true }),
  logout: () => request<unknown>("POST", "/logout"),
  changePassword: (current: string, next: string) =>
    request<unknown>("POST", "/account/password", { body: { current, new: next } }),

  system: () => request<T.SystemInfo>("GET", "/system"),
  stats: () => request<T.Stats>("GET", "/stats"),
  history: (range: T.HistoryRange, module?: string) =>
    request<T.History>("GET", `/stats/history${qs({ range, module })}`),

  modules: () => request<{ modules: T.Module[] | null }>("GET", "/modules"),
  setModuleEnabled: (name: string, enabled: boolean) =>
    request<unknown>("POST", `/modules/${enc(name)}/${enabled ? "enable" : "disable"}`),
  testModule: (name: string) => request<{ results: T.TestResult[] | null }>("POST", `/modules/${enc(name)}/test`),

  repositories: (module?: string) =>
    request<{ repositories: T.Repository[] | null }>("GET", `/repositories${qs({ module })}`),
  createRepository: (module: string, name: string, upstreams: string[]) =>
    request<T.Repository>("POST", "/repositories", { body: { module, name, upstreams } }),
  updateRepository: (id: number, patch: { upstreams?: string[]; enabled?: boolean }) =>
    request<unknown>("PUT", `/repositories/${id}`, { body: patch }),
  deleteRepository: (id: number) =>
    request<{ deleted: boolean; entries_released: number }>("DELETE", `/repositories/${id}`),

  storage: () => request<{ usage: T.Usage; maintenance: T.Maintenance }>("GET", "/storage"),
  blobs: (query: BlobQuery) =>
    request<{ entries: T.CacheEntry[] | null; total: number }>("GET", `/storage/blobs${qs({ ...query })}`),
  pinEntry: (id: number, pinned: boolean) =>
    request<unknown>("POST", `/storage/entries/${id}/${pinned ? "pin" : "unpin"}`),
  deleteEntry: (id: number) => request<unknown>("DELETE", `/storage/entries/${id}`),
  runGC: () => request<{ gc: T.GCReport; eviction: T.EvictionReport }>("POST", "/storage/gc"),
  verify: () => request<T.VerifyReport>("POST", "/storage/verify"),

  clients: () => request<{ clients: T.Client[] | null; active: number }>("GET", "/clients"),
  requests: (params: { module?: string; client?: string; status?: string; limit?: number } = {}) =>
    request<{ requests: T.RequestRecord[] | null }>("GET", `/requests${qs(params)}`),
  downloads: () => request<{ downloads: T.Download[] | null }>("GET", "/downloads"),
  cancelDownload: (id: string | number) => request<unknown>("DELETE", `/downloads/${enc(String(id))}`),

  policies: () => request<T.Policies>("GET", "/policies"),
  savePolicies: (p: T.Policies) => request<T.Policies | null>("PUT", "/policies", { body: p }),
  settings: () => request<T.Settings>("GET", "/settings"),
  audit: (limit = 100) => request<{ audit: T.AuditEntry[] | null }>("GET", `/audit${qs({ limit })}`),
};

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
