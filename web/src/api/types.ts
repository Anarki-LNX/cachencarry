export interface Counters {
  hits: number;
  misses: number;
  revalidated: number;
  errors: number;
  bytes_cache: number;
  bytes_origin: number;
  bytes_upstream: number;
}

export interface Session {
  setup_required: boolean;
  setup_token_required: boolean;
  authenticated: boolean;
  version: string;
  user?: string;
  csrf?: string;
}

export interface AuthResult {
  authenticated: boolean;
  user: string;
  csrf: string;
}

export interface HealthCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface GCReport {
  at: string;
  blobs_removed: number;
  bytes_freed: number;
}
export interface EvictionReport {
  at: string;
  reason: string;
  entries_removed: number;
  bytes_freed: number;
  unsatisfied: boolean;
}
export interface VerifyReport {
  at: string;
  checked: number;
  corrupt: number;
  missing: number;
}
export interface Maintenance {
  gc: GCReport;
  eviction: EvictionReport;
  verify: VerifyReport;
}

export interface SystemInfo {
  version: string;
  go_version: string;
  os: string;
  arch: string;
  started_at: string;
  uptime_seconds: number;
  goroutines: number;
  memory_bytes: number;
  heap_bytes: number;
  cpus: number;
  schema_version: number;
  checks: HealthCheck[] | null;
  maintenance: Maintenance;
}

export interface ModuleUsage {
  module: string;
  entries: number;
  logical_bytes: number;
  pinned: number;
}

export interface Usage {
  blob_count: number;
  blob_bytes: number;
  entry_count: number;
  logical_bytes: number;
  dedup_saved: number;
  pinned_count: number;
  max_size: number;
  disk_total: number;
  disk_free: number;
  min_free: number;
  modules: ModuleUsage[] | null;
}

export interface RatePoint {
  t: number;
  lan: number;
  upstream: number;
}

export interface ModuleStats {
  counters: Counters;
  hit_ratio: number;
}

export interface Stats {
  totals: Counters;
  hit_ratio: number;
  bytes_saved: number;
  modules: Record<string, ModuleStats> | null;
  storage: Usage;
  active_downloads: number;
  active_clients: number;
  rates: RatePoint[] | null;
}

export interface HistoryPoint extends Counters {
  t: number;
}
export interface History {
  step_seconds: number;
  from: number;
  to: number;
  points: HistoryPoint[] | null;
}
export type HistoryRange = "1h" | "6h" | "24h" | "7d" | "30d";

export type Result = "HIT" | "MISS" | "COALESCED" | "REVALIDATED" | "STALE" | "NOTFOUND" | "ERROR" | "DENIED";

export interface RequestRecord {
  id: number;
  time: string;
  client: string;
  module: string;
  repo: string;
  path: string;
  method: string;
  result: Result | string;
  status: number;
  bytes: number;
  duration_ms: number;
  source: string;
  partial: boolean;
}

export interface ModuleRepository {
  id: number;
  name: string;
  upstreams: string[] | null;
  enabled: boolean;
  url: string;
  client_config: string;
}

export interface ModuleInfo {
  name: string;
  title: string;
  description: string;
  maturity: "stable" | "experimental" | string;
  repo_hint: string;
}

export interface Module {
  info: ModuleInfo;
  enabled: boolean;
  repositories: ModuleRepository[] | null;
  counters: Counters;
  hit_ratio: number;
  usage: ModuleUsage;
  last_error?: RequestRecord | null;
}

export interface TestResult {
  repo: string;
  upstream: string;
  ok: boolean;
  status?: number;
  latency_ms: number;
  error?: string;
}

export interface Repository {
  id: number;
  module: string;
  name: string;
  upstreams: string[] | null;
  enabled: boolean;
  created_at: string;
}

export interface CacheEntry {
  id: number;
  module: string;
  repo: string;
  path: string;
  hash: string;
  size: number;
  content_type: string;
  immutable: boolean;
  pinned: boolean;
  created_at: string;
  validated_at: string;
  last_access: string;
  hits: number;
}

export interface Client {
  ip: string;
  first_seen: string;
  last_seen: string;
  requests: number;
  hits: number;
  bytes: number;
}

export interface Download {
  id: string | number;
  key: string;
  module: string;
  url: string;
  total: number;
  received: number;
  clients: number;
  started: string;
  state: "queued" | "connecting" | "downloading" | "publishing" | string;
}

export interface Policies {
  metadata_ttl_seconds: number;
  negative_ttl_seconds: number;
  serve_stale_on_error: boolean;
  module_ttl_seconds: Record<string, number> | null;
}

export interface RuntimeSettings {
  max_size: number;
  min_free_space: string;
  upstream_rate_limit: number;
  client_rate_limit: number;
  max_concurrent: number;
  max_object_size: number;
  log_level: string;
}

/** Settings editable at runtime: active values, the configuration file's values, and whether saved values override the file. */
export interface RuntimeView {
  values: RuntimeSettings;
  defaults: RuntimeSettings;
  overridden: boolean;
}

export interface Settings {
  runtime: RuntimeView;
  server: { listen: string; port: number; tls: unknown; trusted_proxies: string[] | null };
  storage: {
    path: string;
    max_size: number | string;
    min_free_space: number | string;
    gc_interval_seconds: number;
    verify_interval_seconds: number;
  };
  database: { driver: string; path: string };
  download: {
    max_concurrent: number;
    retries: number;
    resume: boolean;
    max_object_size: number | string;
    upstream_rate_limit: number | string;
    client_rate_limit: number | string;
  };
  security: {
    allowed_clients: string[] | null;
    admin_allowed: string[] | null;
    allow_private_upstreams: boolean;
    session_ttl_seconds: number;
  };
  logging: { level: string; format: string; file: string };
}

export interface AuditEntry {
  id: number;
  time: number;
  actor: string;
  ip: string;
  action: string;
  detail: string;
}

export interface LiveSnapshot {
  totals: Counters;
  hit_ratio: number;
  downloads: Download[] | null;
  active_clients: number;
}
export interface TickEvent {
  rate: RatePoint;
  live: LiveSnapshot;
}
