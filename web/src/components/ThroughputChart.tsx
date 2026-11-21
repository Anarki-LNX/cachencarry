import { useMemo } from "react";
import { useT } from "../i18n";
import { clockTime, formatRate } from "../lib/format";
import { useLive } from "../state/live";
import { COLORS, Legend, TimeChart, type Series } from "./Charts";

const WINDOW = 120;

/** Live LAN vs upstream throughput for the last two minutes. */
export function ThroughputChart({ height = 200 }: { height?: number }) {
  const { t } = useT();
  const rates = useLive((s) => s.rates);

  const { xs, series, current } = useMemo(() => {
    // Seconds without traffic may be missing; lay the samples on a gapless 1 s grid.
    const end = rates.length ? rates[rates.length - 1].t : Math.floor(Date.now() / 1000);
    const byT = new Map(rates.map((r) => [r.t, r]));
    const xs: number[] = [];
    const lan: number[] = [];
    const up: number[] = [];
    for (let t = end - WINDOW + 1; t <= end; t++) {
      const r = byT.get(t);
      xs.push(t);
      lan.push(r?.lan ?? 0);
      up.push(r?.upstream ?? 0);
    }
    const series: Series[] = [
      { key: "lan", label: t("charts.toLanClients"), color: COLORS.ok, values: lan },
      { key: "upstream", label: t("charts.fromUpstream"), color: COLORS.info, values: up },
    ];
    return { xs, series, current: rates[rates.length - 1] };
  }, [rates, t]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Legend series={series} />
        <div className="num flex gap-4 text-xs">
          <span className="text-ok">{t("charts.lanRate", { rate: formatRate(current?.lan ?? 0) })}</span>
          <span className="text-info">{t("charts.upstreamRate", { rate: formatRate(current?.upstream ?? 0) })}</span>
        </div>
      </div>
      <TimeChart
        kind="area"
        xs={xs}
        series={series}
        height={height}
        binary
        formatY={formatRate}
        formatX={clockTime}
        label={t("charts.throughput")}
      />
    </div>
  );
}
