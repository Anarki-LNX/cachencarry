import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "../api/client";
import { Badge, Card, EmptyState, KeyValue, KpiCard, PageHeader, Resource } from "../components/Card";
import { MaintenanceReport } from "../components/MaintenanceReport";
import { useT } from "../i18n";
import { healthCheckDetail, healthCheckName } from "../i18n/server";
import { absoluteTime, formatBytes, formatDuration, formatNumber } from "../lib/format";
import { useApi } from "../lib/useApi";

export function Health() {
  const system = useApi(api.system, [], 5000);
  const { t } = useT();
  return (
    <>
      <PageHeader title={t("nav.health")} description={t("health.description")} />
      <Resource state={system}>
        {(s) => {
          const checks = s.checks ?? [];
          const failed = checks.filter((c) => !c.ok).length;
          return (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label={t("common.status")}
                  tone={failed === 0 ? "ok" : "bad"}
                  icon={failed === 0 ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                  value={checks.length === 0 ? "–" : failed === 0 ? t("health.healthy") : t("health.failing", { count: failed })}
                  sub={t("health.passing", { ok: checks.length - failed, total: checks.length })}
                />
                <KpiCard label={t("health.uptime")} value={formatDuration(s.uptime_seconds)} sub={t("health.startedAt", { time: absoluteTime(s.started_at) })} />
                <KpiCard label={t("health.memory")} value={formatBytes(s.memory_bytes)} sub={t("health.heap", { bytes: formatBytes(s.heap_bytes) })} />
                <KpiCard label={t("health.goroutines")} value={formatNumber(s.goroutines)} sub={t("health.cpus", { count: s.cpus })} />
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                <Card title={t("health.checks")} bodyClassName="p-0">
                  {checks.length === 0 ? (
                    <EmptyState title={t("health.noChecks")} />
                  ) : (
                    <ul className="divide-y divide-line/60">
                      {checks.map((c) => (
                        <li key={c.name} className="flex items-start gap-3 px-4 py-3">
                          {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{healthCheckName(c.name)}</p>
                            <p className="break-words text-xs text-muted">{c.detail ? healthCheckDetail(c.detail) : "–"}</p>
                          </div>
                          <Badge tone={c.ok ? "ok" : "bad"}>{c.ok ? t("health.ok") : t("health.failed")}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card title={t("health.build")}>
                  <KeyValue
                    rows={[
                      [t("health.version"), s.version || "–"],
                      [t("health.goRuntime"), s.go_version],
                      [t("health.platform"), `${s.os}/${s.arch}`],
                      [t("health.schema"), t("health.schemaVersion", { n: s.schema_version })],
                      [t("health.started"), absoluteTime(s.started_at)],
                    ]}
                  />
                </Card>
              </div>

              <Card title={t("common.maintenance")}>
                <MaintenanceReport maintenance={s.maintenance} />
              </Card>
            </div>
          );
        }}
      </Resource>
    </>
  );
}
