import type { HistoryPoint } from "../api/types";
import { formatBytes, formatCompact } from "../lib/format";
import { bucketLabel } from "../lib/history";
import { COLORS, Legend, TimeChart, type Series } from "./Charts";
import { EmptyState } from "./Card";

export function requestSeries(points: HistoryPoint[]): Series[] {
  return [
    { key: "hits", label: "Hits", color: COLORS.ok, values: points.map((p) => p.hits) },
    { key: "revalidated", label: "Revalidated", color: COLORS.alt, values: points.map((p) => p.revalidated) },
    { key: "misses", label: "Misses", color: COLORS.info, values: points.map((p) => p.misses) },
    { key: "errors", label: "Errors", color: COLORS.bad, values: points.map((p) => p.errors) },
  ];
}

export function byteSeries(points: HistoryPoint[]): Series[] {
  return [
    { key: "cache", label: "Served from cache (saved)", color: COLORS.ok, values: points.map((p) => p.bytes_cache) },
    { key: "upstream", label: "Downloaded from upstream", color: COLORS.info, values: points.map((p) => p.bytes_upstream) },
  ];
}

function span(points: HistoryPoint[]): number {
  return points.length > 1 ? points[points.length - 1].t - points[0].t : 0;
}

function hasData(series: Series[]): boolean {
  return series.some((s) => s.values.some((v) => v > 0));
}

export function RequestsHistoryChart({ points, step, height = 200 }: { points: HistoryPoint[]; step: number; height?: number }) {
  const series = requestSeries(points);
  if (!hasData(series)) return <EmptyState title="No requests in this time range" hint="Point a client at the cache to see activity here." />;
  return (
    <div className="space-y-2">
      <Legend series={series} />
      <TimeChart
        kind="bars"
        xs={points.map((p) => p.t)}
        series={series}
        height={height}
        formatY={(v) => formatCompact(v)}
        formatX={(t) => bucketLabel(t, step, span(points))}
        label="Requests by result over time"
      />
    </div>
  );
}

export function BytesHistoryChart({ points, step, height = 200 }: { points: HistoryPoint[]; step: number; height?: number }) {
  const series = byteSeries(points);
  if (!hasData(series)) return <EmptyState title="No data transferred in this time range" />;
  return (
    <div className="space-y-2">
      <Legend series={series} />
      <TimeChart
        kind="bars"
        xs={points.map((p) => p.t)}
        series={series}
        height={height}
        binary
        formatY={formatBytes}
        formatX={(t) => bucketLabel(t, step, span(points))}
        label="Bytes served from cache versus downloaded from upstream over time"
      />
    </div>
  );
}

export const RANGES = [
  { value: "1h", label: "1 h" },
  { value: "6h", label: "6 h" },
  { value: "24h", label: "24 h" },
  { value: "7d", label: "7 d" },
  { value: "30d", label: "30 d" },
] as const;
