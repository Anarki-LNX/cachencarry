import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "../api/client";
import { Badge, Card, EmptyState, KeyValue, KpiCard, PageHeader, Resource } from "../components/Card";
import { MaintenanceReport } from "../components/MaintenanceReport";
import { absoluteTime, formatBytes, formatDuration, formatNumber } from "../lib/format";
import { useApi } from "../lib/useApi";

export function Health() {
  const system = useApi(api.system, [], 5000);
  return (
    <>
      <PageHeader title="System Health" description="Self-checks and runtime figures of the UniCache process." />
      <Resource state={system}>
        {(s) => {
          const checks = s.checks ?? [];
          const failed = checks.filter((c) => !c.ok).length;
          return (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Status"
                  tone={failed === 0 ? "ok" : "bad"}
                  icon={failed === 0 ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                  value={checks.length === 0 ? "–" : failed === 0 ? "Healthy" : `${failed} failing`}
                  sub={`${checks.length - failed} of ${checks.length} checks passing`}
                />
                <KpiCard label="Uptime" value={formatDuration(s.uptime_seconds)} sub={`Started ${absoluteTime(s.started_at)}`} />
                <KpiCard label="Memory" value={formatBytes(s.memory_bytes)} sub={`${formatBytes(s.heap_bytes)} heap in use`} />
                <KpiCard label="Goroutines" value={formatNumber(s.goroutines)} sub={`${formatNumber(s.cpus)} CPU cores`} />
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                <Card title="Health checks" bodyClassName="p-0">
                  {checks.length === 0 ? (
                    <EmptyState title="The server reported no health checks" />
                  ) : (
                    <ul className="divide-y divide-line/60">
                      {checks.map((c) => (
                        <li key={c.name} className="flex items-start gap-3 px-4 py-3">
                          {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{c.name.replace(/_/g, " ")}</p>
                            <p className="break-words text-xs text-muted">{c.detail || "–"}</p>
                          </div>
                          <Badge tone={c.ok ? "ok" : "bad"}>{c.ok ? "ok" : "failed"}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card title="Build and runtime">
                  <KeyValue
                    rows={[
                      ["Version", s.version || "–"],
                      ["Go runtime", s.go_version],
                      ["Platform", `${s.os}/${s.arch}`],
                      ["Database schema", `version ${s.schema_version}`],
                      ["Started", absoluteTime(s.started_at)],
                    ]}
                  />
                </Card>
              </div>

              <Card title="Maintenance">
                <MaintenanceReport maintenance={s.maintenance} />
              </Card>
            </div>
          );
        }}
      </Resource>
    </>
  );
}
