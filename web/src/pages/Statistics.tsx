import { useState } from "react";
import { api } from "../api/client";
import type { HistoryRange } from "../api/types";
import { Card, PageHeader, Resource } from "../components/Card";
import { Segmented, Select } from "../components/Controls";
import { BytesHistoryChart, RequestsHistoryChart, rangeOptions } from "../components/HistoryCharts";
import { Table, Td, Th, Tr } from "../components/Table";
import { useT } from "../i18n";
import { formatBytes, formatDuration, formatNumber, formatPercent, requestsOf } from "../lib/format";
import { fillHistory, hitRatio, sumCounters } from "../lib/history";
import { useApi } from "../lib/useApi";

export function Statistics() {
  const { t } = useT();
  const [range, setRange] = useState<HistoryRange>("24h");
  const [module, setModule] = useState("");
  const modules = useApi(api.modules, []);
  const history = useApi(() => api.history(range, module || undefined), [range, module], 30_000);
  const points = fillHistory(history.data);
  const step = history.data?.step_seconds ?? 60;
  const totals = sumCounters(points);
  const lookups = totals.hits + totals.revalidated + totals.misses;
  const rangeLabel = t(`range.${range}`);

  const rows: [string, string, string?][] = [
    [t("common.requests"), formatNumber(requestsOf(totals))],
    [t("common.hits"), formatNumber(totals.hits), t("stats.hitsNote")],
    [t("common.revalidated"), formatNumber(totals.revalidated), t("stats.revalidatedNote")],
    [t("common.misses"), formatNumber(totals.misses), t("stats.missesNote")],
    [t("common.errors"), formatNumber(totals.errors)],
    [t("common.hitRatio"), lookups === 0 ? "–" : formatPercent(hitRatio(totals))],
    [t("stats.servedFromCache"), formatBytes(totals.bytes_cache)],
    [t("stats.servedWhileDownloading"), formatBytes(totals.bytes_origin)],
    [t("stats.servedTotal"), formatBytes(totals.bytes_cache + totals.bytes_origin)],
    [t("charts.downloadedFromUpstream"), formatBytes(totals.bytes_upstream)],
  ];

  return (
    <>
      <PageHeader
        title={t("nav.statistics")}
        description={t("stats.description")}
        actions={
          <>
            <label className="flex items-center gap-2 text-xs text-muted">
              {t("common.module")}
              <Select value={module} onChange={(e) => setModule(e.target.value)} className="!h-8 !w-44">
                <option value="">{t("common.allModules")}</option>
                {(modules.data?.modules ?? []).map((m) => (
                  <option key={m.info.name} value={m.info.name}>
                    {m.info.title || m.info.name}
                  </option>
                ))}
              </Select>
            </label>
            <Segmented label={t("common.timeRange")} value={range} options={rangeOptions(t)} onChange={setRange} />
          </>
        }
      />
      <Resource state={history}>
        {() => (
          <div className="space-y-3">
            <Card title={t("dashboard.requestsByResult")}>
              <RequestsHistoryChart points={points} step={step} height={240} />
            </Card>
            <Card title={t("stats.dataSavedVsUpstream")}>
              <BytesHistoryChart points={points} step={step} height={240} />
            </Card>
            <Card title={`${t("stats.totalsTitle", { range: rangeLabel })}${module ? ` · ${module}` : ""}`} bodyClassName="p-0">
              <Table label={t("stats.totalsLabel")}>
                <thead>
                  <tr>
                    <Th>{t("stats.metric")}</Th>
                    <Th right>{t("stats.value")}</Th>
                    <Th className="hidden sm:table-cell">{t("stats.meaning")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([k, v, note]) => (
                    <Tr key={k}>
                      <Td>{k}</Td>
                      <Td right className="font-medium">{v}</Td>
                      <Td className="hidden text-xs text-dim sm:table-cell">{note ?? ""}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <p className="px-4 py-2 text-xs text-dim">{t("stats.barCovers", { duration: formatDuration(step) })}</p>
            </Card>
          </div>
        )}
      </Resource>
    </>
  );
}
