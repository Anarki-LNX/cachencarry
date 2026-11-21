import { useState } from "react";
import { AlertTriangle, CheckCircle2, PlugZap, XCircle } from "lucide-react";
import { api } from "../api/client";
import type { Module, TestResult } from "../api/types";
import { Badge, EmptyState, PageHeader, Resource, StatusDot } from "../components/Card";
import { Button, CodeBlock, Switch } from "../components/Controls";
import { ResultBadge } from "../components/ResultBadge";
import { useT } from "../i18n";
import { adapterDescription, adapterRepoHint, maturityLabel } from "../i18n/server";
import { absoluteTime, formatBytes, formatMs, formatNumber, formatPercent, relativeTime, requestsOf } from "../lib/format";
import { useApi } from "../lib/useApi";
import { useToast } from "../state/toast";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-dim">{label}</dt>
      <dd className="num truncate text-sm font-medium text-fg">{value}</dd>
    </div>
  );
}

function TestResults({ results }: { results: TestResult[] }) {
  const { t } = useT();
  if (results.length === 0) return <p className="text-xs text-dim">{t("modules.noReposToTest")}</p>;
  return (
    <ul className="space-y-1.5" aria-label={t("modules.testResults")}>
      {results.map((r, i) => (
        <li key={`${r.repo}-${r.upstream}-${i}`} className="flex items-start gap-2 text-xs">
          {r.ok ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-ok" aria-label={t("modules.reachable")} /> : <XCircle className="mt-0.5 size-3.5 shrink-0 text-bad" aria-label={t("modules.failed")} />}
          <span className="min-w-0 flex-1">
            <span className="block break-all font-mono">{r.upstream}</span>
            <span className="num block text-dim">
              {r.repo}
              {r.status ? ` · HTTP ${r.status}` : ""} · {formatMs(r.latency_ms)}
              {r.error ? <span className="text-bad"> · {r.error}</span> : null}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function ModuleCard({ module: m, onChanged }: { module: Module; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const { t } = useT();
  const title = m.info.title || m.info.name;
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const repos = m.repositories ?? [];
  const lookups = m.counters.hits + m.counters.revalidated + m.counters.misses;

  const toggle = async (next: boolean) => {
    setBusy(true);
    try {
      await api.setModuleEnabled(m.info.name, next);
      toast.success(t(next ? "modules.enabledToast" : "modules.disabledToast", { title }));
      await onChanged();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await api.testModule(m.info.name);
      const list = res.results ?? [];
      setResults(list);
      const failed = list.filter((r) => !r.ok).length;
      if (list.length === 0) toast.info(t("modules.nothingToTest", { title }));
      else if (failed === 0) toast.success(t("modules.allReachable", { title, count: list.length }));
      else toast.error(t("modules.someFailed", { title, failed, count: list.length }));
    } catch (e) {
      toast.error(e);
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-line bg-panel" aria-label={title}>
      <header className="flex items-start gap-3 border-b border-line p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{title}</h2>
            <Badge tone={m.info.maturity === "stable" ? "ok" : "warn"}>{maturityLabel(m.info.maturity)}</Badge>
            <span className="font-mono text-xs text-dim">{m.info.name}</span>
          </div>
          <p className="mt-1 text-sm text-muted">{adapterDescription(m.info)}</p>
        </div>
        <Switch checked={m.enabled} disabled={busy} onChange={toggle} label={t(m.enabled ? "modules.disable" : "modules.enable", { title })} />
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t("common.requests")} value={formatNumber(requestsOf(m.counters))} />
          <Stat label={t("common.hitRatio")} value={lookups === 0 ? "–" : formatPercent(m.hit_ratio)} />
          <Stat label={t("common.saved")} value={formatBytes(m.counters.bytes_cache)} />
          <Stat label={t("common.stored")} value={t("modules.storedValue", { bytes: formatBytes(m.usage?.logical_bytes ?? 0), count: formatNumber(m.usage?.entries ?? 0) })} />
        </dl>

        {m.last_error && (
          <div className="flex items-start gap-2 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-bad" aria-hidden />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-fg">
                <span className="font-medium">{t("modules.lastError")}</span>
                <ResultBadge result={m.last_error.result} />
                {m.last_error.status > 0 && <span className="num text-muted">HTTP {m.last_error.status}</span>}
                <span className="text-dim" title={absoluteTime(m.last_error.time)}>
                  {relativeTime(m.last_error.time)}
                </span>
              </div>
              <div className="mt-0.5 break-all font-mono text-muted">
                {m.last_error.repo ? `${m.last_error.repo}: ` : ""}
                {m.last_error.path}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t("nav.repositories")}</h3>
          {repos.length === 0 ? (
            <p className="text-xs text-dim">{t("modules.noRepos")} {adapterRepoHint(m.info)}</p>
          ) : (
            repos.map((r) => (
              <details key={r.id} className="group rounded-lg border border-line">
                <summary className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-raised/60">
                  <StatusDot tone={r.enabled ? "ok" : "neutral"} label={r.enabled ? t("common.enabled") : t("common.disabled")} />
                  <span className="font-medium">{r.name}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-dim">{r.url}</span>
                  <span className="text-xs text-info group-open:hidden">{t("modules.clientSetup")}</span>
                </summary>
                <div className="space-y-2 border-t border-line p-3">
                  <p className="text-xs text-muted">
                    {t("modules.upstreamsLabel", { count: (r.upstreams ?? []).length })} <span className="break-all font-mono">{(r.upstreams ?? []).join(", ") || t("common.none")}</span>
                  </p>
                  {r.client_config ? <CodeBlock text={r.client_config} copyLabel={t("modules.copyClientConfig")} /> : <p className="text-xs text-dim">{t("modules.noClientConfig")}</p>}
                </div>
              </details>
            ))
          )}
        </div>

        <div className="mt-auto space-y-3">
          <Button icon={<PlugZap className="size-4" aria-hidden />} busy={testing} onClick={test}>
            {t("modules.testConnectivity")}
          </Button>
          {results && <TestResults results={results} />}
        </div>
      </div>
    </section>
  );
}

export function Modules() {
  const modules = useApi(api.modules, [], 15_000);
  const { t } = useT();
  return (
    <>
      <PageHeader title={t("nav.modules")} description={t("modules.description")} />
      <Resource state={modules}>
        {(data) => {
          const list = data.modules ?? [];
          if (list.length === 0) return <EmptyState title={t("dashboard.noModules")} />;
          return (
            <div className="grid gap-3 lg:grid-cols-2">
              {list.map((m) => (
                <ModuleCard key={m.info.name} module={m} onChanged={modules.reload} />
              ))}
            </div>
          );
        }}
      </Resource>
    </>
  );
}
