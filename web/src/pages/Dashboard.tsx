import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowDownToLine, CloudDownload, Copy, Database, MonitorSmartphone, PiggyBank } from "lucide-react";
import { api } from "../api/client";
import type { HistoryRange, Module, Stats } from "../api/types";
import { Card, EmptyState, KpiCard, PageHeader, Resource, StatusDot } from "../components/Card";
import { COLORS, RingGauge, Sparkline } from "../components/Charts";
import { Segmented } from "../components/Controls";
import { BytesHistoryChart, RequestsHistoryChart, rangeOptions } from "../components/HistoryCharts";
import { ResultBadge } from "../components/ResultBadge";
import { StorageBar, utilisation } from "../components/StorageBar";
import { Table, Td, Th, Tr } from "../components/Table";
import { ThroughputChart } from "../components/ThroughputChart";
import { useT } from "../i18n";
import { formatBytes, formatNumber, formatPercent, relativeTime, requestsOf } from "../lib/format";
import { fillHistory } from "../lib/history";
import { useApi, useNow } from "../lib/useApi";
import { useLive } from "../state/live";

function Kpis({ stats }: { stats: Stats }) {
  const { t } = useT();
  const live = useLive((s) => s.live);
  const totals = live?.totals ?? stats.totals;
  const ratio = live?.hit_ratio ?? stats.hit_ratio;
  const downloads = live ? (live.downloads ?? []).length : stats.active_downloads;
  const clients = live?.active_clients ?? stats.active_clients;
  const lookups = totals.hits + totals.revalidated + totals.misses;
  const u = stats.storage;
  const util = utilisation(u);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <section className="flex min-w-0 items-center gap-4 rounded-xl border border-line bg-panel p-4 sm:row-span-2 sm:flex-col sm:justify-center xl:row-span-2">
        <h2 className="sr-only">{t("dashboard.hitRatioHeading")}</h2>
        <RingGauge value={ratio} size={132} stroke={11} empty={lookups === 0} label={lookups === 0 ? t("dashboard.hitRatioEmpty") : t("dashboard.hitRatioValue", { value: formatPercent(ratio) })}>
          <div>
            <div className="num text-2xl font-semibold tracking-tight">{lookups === 0 ? "–" : formatPercent(ratio)}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-dim">{t("common.hitRatio")}</div>
          </div>
        </RingGauge>
        <dl className="num grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-xs sm:grid-cols-3 sm:gap-x-5 sm:text-center">
          <div className="contents sm:block">
            <dt className="text-dim">{t("common.hits")}</dt>
            <dd className="font-medium text-ok">{formatNumber(totals.hits + totals.revalidated)}</dd>
          </div>
          <div className="contents sm:block">
            <dt className="text-dim">{t("common.misses")}</dt>
            <dd className="font-medium text-info">{formatNumber(totals.misses)}</dd>
          </div>
          <div className="contents sm:block">
            <dt className="text-dim">{t("common.errors")}</dt>
            <dd className={`font-medium ${totals.errors > 0 ? "text-bad" : "text-muted"}`}>{formatNumber(totals.errors)}</dd>
          </div>
        </dl>
      </section>

      <KpiCard label={t("dashboard.storedData")} tone="ok" icon={<Database className="size-4" />} value={formatBytes(u.blob_bytes)} sub={t("dashboard.storedDataSub", { blobs: formatNumber(u.blob_count), objects: formatNumber(u.entry_count) })} />
      <KpiCard label={t("dashboard.bandwidthSaved")} tone="ok" icon={<PiggyBank className="size-4" />} value={formatBytes(totals.bytes_cache)} sub={t("dashboard.bandwidthSavedSub")} />
      <KpiCard
        label={t("dashboard.upstreamDownloaded")}
        tone="info"
        icon={<CloudDownload className="size-4" />}
        value={formatBytes(totals.bytes_upstream)}
        sub={t("dashboard.upstreamDownloadedSub", { bytes: formatBytes(totals.bytes_cache + totals.bytes_origin) })}
      />
      <KpiCard label={t("dashboard.activeDownloads")} tone="info" icon={<ArrowDownToLine className="size-4" />} value={formatNumber(downloads)} sub={downloads > 0 ? <Link className="text-info hover:underline" to="/downloads">{t("dashboard.viewProgress")}</Link> : t("dashboard.noTransfers")} />
      <KpiCard label={t("dashboard.activeClients")} tone="neutral" icon={<MonitorSmartphone className="size-4" />} value={formatNumber(clients)} sub={t("dashboard.activeClientsSub")} />
      <KpiCard label={t("common.dedupSavings")} tone="alt" icon={<Copy className="size-4" />} value={formatBytes(u.dedup_saved)} sub={t("dashboard.dedupSub", { logical: formatBytes(u.logical_bytes), disk: formatBytes(u.blob_bytes) })} />

      <section className="min-w-0 rounded-xl border border-line bg-panel p-4 sm:col-span-2 xl:col-span-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t("dashboard.storageUtilisation")}</h2>
          <span className="num text-xs text-dim">
            {u.max_size > 0 ? t("dashboard.cacheLimit", { bytes: formatBytes(u.max_size) }) : t("dashboard.noCacheLimit")} · {t("dashboard.diskFree", { bytes: formatBytes(u.disk_free) })}
            {u.min_free > 0 ? ` · ${t("dashboard.keepsFree", { bytes: formatBytes(u.min_free) })}` : ""}
          </span>
        </div>
        <StorageBar usage={u} />
        {util.known && util.ratio >= 0.95 && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-warn">
            <AlertTriangle className="size-3.5" aria-hidden /> {t("dashboard.almostFull")}
          </p>
        )}
      </section>
    </div>
  );
}

function ModuleSpark({ name }: { name: string }) {
  const { t } = useT();
  const h = useApi(() => api.history("1h", name), [name], 60_000);
  const points = fillHistory(h.data);
  return <Sparkline values={points.map(requestsOf)} color={COLORS.ok} label={t("dashboard.moduleSpark", { name })} />;
}

function ModulesTable({ modules }: { modules: Module[] }) {
  const { t } = useT();
  if (modules.length === 0) return <EmptyState title={t("dashboard.noModules")} />;
  return (
    <Table label={t("dashboard.modulesOverview")}>
      <thead>
        <tr>
          <Th>{t("common.module")}</Th>
          <Th right>{t("common.requests")}</Th>
          <Th>{t("dashboard.lastHour")}</Th>
          <Th right>{t("common.hitRatio")}</Th>
          <Th right>{t("common.saved")}</Th>
          <Th right>{t("common.stored")}</Th>
          <Th>{t("common.status")}</Th>
        </tr>
      </thead>
      <tbody>
        {modules.map((m) => {
          const reqs = requestsOf(m.counters);
          return (
            <Tr key={m.info.name}>
              <Td>
                <span className="flex items-center gap-2">
                  <StatusDot tone={m.enabled ? "ok" : "neutral"} label={m.enabled ? t("common.enabled") : t("common.disabled")} />
                  <Link to="/modules" className="font-medium hover:underline">
                    {m.info.title || m.info.name}
                  </Link>
                </span>
              </Td>
              <Td right>{formatNumber(reqs)}</Td>
              <Td>{m.enabled ? <ModuleSpark name={m.info.name} /> : <span className="text-xs text-dim">{t("dashboard.moduleDisabled")}</span>}</Td>
              <Td right>{m.counters.hits + m.counters.revalidated + m.counters.misses === 0 ? "–" : formatPercent(m.hit_ratio)}</Td>
              <Td right>{formatBytes(m.counters.bytes_cache)}</Td>
              <Td right>{formatBytes(m.usage?.logical_bytes ?? 0)}</Td>
              <Td>
                {m.last_error ? (
                  <span className="inline-flex items-center gap-1 text-xs text-bad" title={`${m.last_error.result} ${m.last_error.status} · ${m.last_error.path}`}>
                    <AlertTriangle className="size-3.5" aria-hidden /> {t("dashboard.moduleError", { when: relativeTime(m.last_error.time) })}
                  </span>
                ) : (
                  <span className="text-xs text-dim">{m.enabled ? t("dashboard.moduleOk") : "–"}</span>
                )}
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}

function RecentRequests() {
  const { t } = useT();
  const requests = useLive((s) => s.requests);
  const now = useNow(5000);
  const recent = requests.slice(0, 8);
  if (recent.length === 0) return <EmptyState title={t("common.noRequestsYet")} hint={t("dashboard.noRequestsHint")} />;
  return (
    <ul className="divide-y divide-line/60">
      {recent.map((r) => (
        <li key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm">
          <span className="w-24 shrink-0">
            <ResultBadge result={r.result} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono text-xs" title={r.path}>
              {r.path}
            </span>
            <span className="block truncate text-xs text-dim">
              {r.client} · {r.module}
              {r.repo ? `/${r.repo}` : ""}
            </span>
          </span>
          <span className="num shrink-0 text-right text-xs">
            <span className="block text-muted">{formatBytes(r.bytes)}</span>
            <span className="block text-dim">{relativeTime(r.time, now)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Dashboard() {
  const { t } = useT();
  const stats = useApi(api.stats, [], 5000);
  const modules = useApi(api.modules, [], 15_000);
  const [range, setRange] = useState<HistoryRange>("24h");
  const history = useApi(() => api.history(range), [range], 30_000);
  const points = fillHistory(history.data);
  const step = history.data?.step_seconds ?? 60;

  return (
    <>
      <PageHeader title={t("nav.dashboard")} description={t("dashboard.description")} />
      <div className="space-y-3">
        <Resource state={stats}>{(s) => <Kpis stats={s} />}</Resource>

        <Card title={t("dashboard.liveThroughput")}>
          <ThroughputChart />
        </Card>

        <div className="grid gap-3 xl:grid-cols-2">
          <Card title={t("dashboard.requestsByResult")} actions={<Segmented label={t("common.timeRange")} value={range} options={rangeOptions(t)} onChange={setRange} />}>
            <Resource state={history}>{() => <RequestsHistoryChart points={points} step={step} />}</Resource>
          </Card>
          <Card title={t("dashboard.dataCacheVsUpstream")} actions={<Segmented label={t("common.timeRange")} value={range} options={rangeOptions(t)} onChange={setRange} />}>
            <Resource state={history}>{() => <BytesHistoryChart points={points} step={step} />}</Resource>
          </Card>
        </div>

        <div className="grid gap-3 xl:grid-cols-5">
          <Card title={t("dashboard.modules")} className="xl:col-span-3" bodyClassName="p-0">
            <Resource state={modules}>{(m) => <ModulesTable modules={m.modules ?? []} />}</Resource>
          </Card>
          <Card
            title={t("dashboard.recentRequests")}
            className="xl:col-span-2"
            bodyClassName="p-0"
            actions={
              <Link to="/traffic" className="text-xs text-info hover:underline">
                {t("dashboard.liveTraffic")}
              </Link>
            }
          >
            <RecentRequests />
          </Card>
        </div>
      </div>
    </>
  );
}
