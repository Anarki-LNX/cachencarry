import type { Counters, History, HistoryPoint } from "../api/types";

export const ZERO: Counters = {
  hits: 0,
  misses: 0,
  revalidated: 0,
  errors: 0,
  bytes_cache: 0,
  bytes_origin: 0,
  bytes_upstream: 0,
};

/** The API omits buckets without traffic; return one point per bucket. */
export function fillHistory(h: History | undefined): HistoryPoint[] {
  if (!h || h.step_seconds <= 0) return [];
  const step = h.step_seconds;
  const byBucket = new Map<number, HistoryPoint>();
  for (const p of h.points ?? []) byBucket.set(Math.floor(p.t / step) * step, p);
  const out: HistoryPoint[] = [];
  const first = Math.floor(h.from / step) * step;
  const last = Math.floor(h.to / step) * step;
  for (let t = first; t <= last; t += step) {
    out.push(byBucket.get(t) ?? { t, ...ZERO });
  }
  return out;
}

export function sumCounters(points: Counters[]): Counters {
  const total = { ...ZERO };
  for (const p of points) {
    total.hits += p.hits;
    total.misses += p.misses;
    total.revalidated += p.revalidated;
    total.errors += p.errors;
    total.bytes_cache += p.bytes_cache;
    total.bytes_origin += p.bytes_origin;
    total.bytes_upstream += p.bytes_upstream;
  }
  return total;
}

export function hitRatio(c: Counters): number {
  const total = c.hits + c.revalidated + c.misses;
  return total === 0 ? 0 : (c.hits + c.revalidated) / total;
}

/** Axis/tooltip label for a bucket; includes the date once the range spans more than a day. */
export function bucketLabel(t: number, stepSeconds: number, spanSeconds = 0): string {
  const d = new Date(t * 1000);
  if (stepSeconds >= 86400) return d.toLocaleDateString([], { month: "short", day: "numeric" });
  if (spanSeconds > 86400 || stepSeconds >= 3600)
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}
