const UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];

export function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "–";
  let v = Math.abs(n);
  let i = 0;
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = i === 0 ? 0 : v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${n < 0 ? "-" : ""}${v.toFixed(digits)} ${UNITS[i]}`;
}

export function formatRate(bytesPerSecond: number | null | undefined): string {
  if (bytesPerSecond === null || bytesPerSecond === undefined || !isFinite(bytesPerSecond)) return "–";
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "–";
  return n.toLocaleString("en-US");
}

export function formatCompact(n: number): string {
  if (Math.abs(n) < 1000) return String(Math.round(n * 10) / 10);
  const units = ["k", "M", "G", "T"];
  let v = n;
  let i = -1;
  while (Math.abs(v) >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v.toFixed(Math.abs(v) >= 100 ? 0 : 1)}${units[i]}`;
}

export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || !isFinite(ratio)) return "–";
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Human duration from seconds: "45 s", "12 min", "3 h 5 min", "2 d 4 h". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !isFinite(seconds)) return "–";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !isFinite(ms)) return "–";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
  return formatDuration(ms / 1000);
}

/** The Go zero time ("0001-01-01T00:00:00Z") means "never". */
export function isZeroTime(iso: string | null | undefined): boolean {
  if (!iso) return true;
  return iso.startsWith("0001-01-01");
}

export function toDate(v: string | number | null | undefined): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v > 0 ? new Date(v * 1000) : null;
  if (isZeroTime(v)) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function relativeTime(v: string | number | null | undefined, now: number = Date.now()): string {
  const d = toDate(v);
  if (!d) return "never";
  const diff = Math.round((now - d.getTime()) / 1000);
  if (diff < 0) return "just now";
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff} s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} d ago`;
  return d.toLocaleDateString();
}

export function absoluteTime(v: string | number | null | undefined): string {
  const d = toDate(v);
  return d ? d.toLocaleString() : "never";
}

export function clockTime(v: string | number | null | undefined): string {
  const d = toDate(v);
  if (!d) return "–";
  return d.toLocaleTimeString([], { hour12: false });
}

export function requestsOf(c: { hits: number; misses: number; revalidated: number; errors: number }): number {
  return c.hits + c.misses + c.revalidated + c.errors;
}

export function shortHash(h: string): string {
  const raw = h.includes(":") ? h.slice(h.indexOf(":") + 1) : h;
  return raw.slice(0, 12);
}
