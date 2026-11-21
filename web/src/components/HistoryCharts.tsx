import type { HistoryPoint, HistoryRange } from "../api/types";
import { useT, type Translate } from "../i18n";
import { formatBytes, formatCompact } from "../lib/format";
import { bucketLabel } from "../lib/history";
import { COLORS, Legend, TimeChart, type Series } from "./Charts";
import { EmptyState } from "./Card";

export function requestSeries(points: HistoryPoint[], t: Translate): Series[] {
  return [
    { key: "hits", label: t("common.hits"), color: COLORS.ok, values: points.map((p) => p.hits) },
    { key: "revalidated", label: t("common.revalidated"), color: COLORS.alt, values: points.map((p) => p.revalidated) },
    { key: "misses", label: t("common.misses"), color: COLORS.info, values: points.map((p) => p.misses) },
    { key: "errors", label: t("common.errors"), color: COLORS.bad, values: points.map((p) => p.errors) },
  ];
}

export function byteSeries(points: HistoryPoint[], t: Translate): Series[] {
  return [
    { key: "cache", label: t("charts.servedFromCache"), color: COLORS.ok, values: points.map((p) => p.bytes_cache) },
    { key: "upstream", label: t("charts.downloadedFromUpstream"), color: COLORS.info, values: points.map((p) => p.bytes_upstream) },
  ];
}

function span(points: HistoryPoint[]): number {
  return points.length > 1 ? points[points.length - 1].t - points[0].t : 0;
}

function hasData(series: Series[]): boolean {
  return series.some((s) => s.values.some((v) => v > 0));
}

export function RequestsHistoryChart({ points, step, height = 200 }: { points: HistoryPoint[]; step: number; height?: number }) {
  const { t } = useT();
  const series = requestSeries(points, t);
  if (!hasData(series)) return <EmptyState title={t("charts.noRequestsInRange")} hint={t("charts.noRequestsInRangeHint")} />;
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
        label={t("charts.requestsOverTime")}
      />
    </div>
  );
}

export function BytesHistoryChart({ points, step, height = 200 }: { points: HistoryPoint[]; step: number; height?: number }) {
  const { t } = useT();
  const series = byteSeries(points, t);
  if (!hasData(series)) return <EmptyState title={t("charts.noDataInRange")} />;
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
        label={t("charts.bytesOverTime")}
      />
    </div>
  );
}

export const RANGES: readonly HistoryRange[] = ["1h", "6h", "24h", "7d", "30d"];

/** Options for the time range switch, labelled in the active language. */
export function rangeOptions(t: Translate): { value: HistoryRange; label: string }[] {
  return RANGES.map((value) => ({ value, label: t(`range.${value}`) }));
}
