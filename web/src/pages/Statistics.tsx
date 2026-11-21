import { useState } from "react";
import { api } from "../api/client";
import type { HistoryRange } from "../api/types";
import { Card, PageHeader, Resource } from "../components/Card";
import { Segmented, Select } from "../components/Controls";
import { BytesHistoryChart, RANGES, RequestsHistoryChart } from "../components/HistoryCharts";
import { Table, Td, Th, Tr } from "../components/Table";
import { formatBytes, formatDuration, formatNumber, formatPercent, requestsOf } from "../lib/format";
import { fillHistory, hitRatio, sumCounters } from "../lib/history";
import { useApi } from "../lib/useApi";

export function Statistics() {
  const [range, setRange] = useState<HistoryRange>("24h");
  const [module, setModule] = useState("");
  const modules = useApi(api.modules, []);
  const history = useApi(() => api.history(range, module || undefined), [range, module], 30_000);
  const points = fillHistory(history.data);
  const step = history.data?.step_seconds ?? 60;
  const totals = sumCounters(points);
  const lookups = totals.hits + totals.revalidated + totals.misses;
  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? range;

  const rows: [string, string, string?][] = [
    ["Requests", formatNumber(requestsOf(totals))],
    ["Hits", formatNumber(totals.hits), "Served from the cache, including joined downloads"],
    ["Revalidated", formatNumber(totals.revalidated), "Upstream confirmed the cached copy"],
    ["Misses", formatNumber(totals.misses), "Fetched from upstream"],
    ["Errors", formatNumber(totals.errors)],
    ["Hit ratio", lookups === 0 ? "–" : formatPercent(hitRatio(totals))],
    ["Served from cache (bandwidth saved)", formatBytes(totals.bytes_cache)],
    ["Served while downloading", formatBytes(totals.bytes_origin)],
    ["Served to LAN in total", formatBytes(totals.bytes_cache + totals.bytes_origin)],
    ["Downloaded from upstream", formatBytes(totals.bytes_upstream)],
  ];

  return (
    <>
      <PageHeader
        title="Statistics"
        description="How the cache performed over time."
        actions={
          <>
            <label className="flex items-center gap-2 text-xs text-muted">
              Module
              <Select value={module} onChange={(e) => setModule(e.target.value)} className="!h-8 !w-44">
                <option value="">All modules</option>
                {(modules.data?.modules ?? []).map((m) => (
                  <option key={m.info.name} value={m.info.name}>
                    {m.info.title || m.info.name}
                  </option>
                ))}
              </Select>
            </label>
            <Segmented label="Time range" value={range} options={[...RANGES]} onChange={setRange} />
          </>
        }
      />
      <Resource state={history}>
        {() => (
          <div className="space-y-3">
            <Card title="Requests by result">
              <RequestsHistoryChart points={points} step={step} height={240} />
            </Card>
            <Card title="Data: saved vs upstream">
              <BytesHistoryChart points={points} step={step} height={240} />
            </Card>
            <Card title={`Totals · last ${rangeLabel}${module ? ` · ${module}` : ""}`} bodyClassName="p-0">
              <Table label="Totals for the selected range">
                <thead>
                  <tr>
                    <Th>Metric</Th>
                    <Th right>Value</Th>
                    <Th className="hidden sm:table-cell">Meaning</Th>
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
              <p className="px-4 py-2 text-xs text-dim">One bar covers {formatDuration(step)}.</p>
            </Card>
          </div>
        )}
      </Resource>
    </>
  );
}
