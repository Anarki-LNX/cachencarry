import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { Module, Policies as PoliciesT } from "../api/types";
import { Card, Notice, PageHeader, Resource } from "../components/Card";
import { Button, Field, Switch } from "../components/Controls";
import { DurationInput } from "../components/DurationInput";
import { useT } from "../i18n";
import { formatDuration } from "../lib/format";
import { useApi } from "../lib/useApi";
import { useToast } from "../state/toast";

const MAX_METADATA = 2_592_000;
const MAX_NEGATIVE = 3600;

function normalise(p: PoliciesT): PoliciesT {
  return { ...p, module_ttl_seconds: { ...(p.module_ttl_seconds ?? {}) } };
}

function PolicyForm({ initial, modules, onSaved }: { initial: PoliciesT; modules: Module[]; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const { t } = useT();
  const [form, setForm] = useState<PoliciesT>(() => normalise(initial));
  const [busy, setBusy] = useState(false);
  useEffect(() => setForm(normalise(initial)), [initial]);

  const overrides = form.module_ttl_seconds ?? {};
  const metaErr = form.metadata_ttl_seconds > MAX_METADATA ? t("policies.max30Days") : null;
  const negErr = form.negative_ttl_seconds > MAX_NEGATIVE ? t("policies.max1Hour") : null;
  const overrideErr = Object.values(overrides).some((v) => v > MAX_METADATA);
  const dirty = JSON.stringify(normalise(initial)) !== JSON.stringify(form);

  // Overrides for modules this build does not know are kept and shown too.
  const names = Array.from(new Set([...modules.map((m) => m.info.name), ...Object.keys(overrides)])).sort();
  const title = (n: string) => modules.find((m) => m.info.name === n)?.info.title || n;

  const setOverride = (name: string, value: number | null) => {
    const next = { ...overrides };
    if (value === null) delete next[name];
    else next[name] = value;
    setForm({ ...form, module_ttl_seconds: next });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (metaErr || negErr || overrideErr) return;
    setBusy(true);
    try {
      await api.savePolicies(form);
      toast.success(t("policies.saved"));
      await onSaved();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <Card title={t("policies.freshness")}>
        <div className="space-y-5">
          <Notice tone="info">
            {t("policies.notice")}
          </Notice>
          <Field
            label={t("policies.metadataTtl")}
            hint={t("policies.metadataTtlHint")}
            error={metaErr}
          >
            {(p) => <DurationInput {...p} label={t("policies.metadataTtl")} value={form.metadata_ttl_seconds} onChange={(v) => setForm({ ...form, metadata_ttl_seconds: v })} />}
          </Field>
          <Field
            label={t("policies.negativeTtl")}
            hint={t("policies.negativeTtlHint")}
            error={negErr}
          >
            {(p) => <DurationInput {...p} label={t("policies.negativeTtl")} value={form.negative_ttl_seconds} onChange={(v) => setForm({ ...form, negative_ttl_seconds: v })} />}
          </Field>
          <div className="flex items-start gap-3">
            <Switch checked={form.serve_stale_on_error} onChange={(v) => setForm({ ...form, serve_stale_on_error: v })} label={t("policies.serveStaleSwitch")} />
            <div>
              <p className="text-sm font-medium">{t("policies.serveStale")}</p>
              <p className="mt-0.5 text-xs text-dim">{t("policies.serveStaleHint")}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card title={t("policies.perModule")}>
        {names.length === 0 ? (
          <p className="text-sm text-dim">{t("policies.noModules")}</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {names.map((name) => {
              const has = name in overrides;
              return (
                <li key={name} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-48 flex-1 items-center gap-3">
                    <Switch checked={has} onChange={(v) => setOverride(name, v ? form.metadata_ttl_seconds : null)} label={t("policies.override", { module: title(name) })} />
                    <span className="text-sm font-medium">{title(name)}</span>
                  </div>
                  {has ? (
                    <div>
                      <DurationInput label={t("policies.ttlFor", { module: title(name) })} value={overrides[name]} onChange={(v) => setOverride(name, v)} aria-invalid={overrides[name] > MAX_METADATA || undefined} />
                      {overrides[name] > MAX_METADATA && <p className="mt-1 text-xs text-bad">{t("policies.max30Days")}</p>}
                    </div>
                  ) : (
                    <span className="text-xs text-dim">{t("policies.usesDefault", { duration: formatDuration(form.metadata_ttl_seconds) })}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" busy={busy} disabled={!dirty || !!metaErr || !!negErr || overrideErr}>
          {t("policies.save")}
        </Button>
        <Button disabled={!dirty || busy} onClick={() => setForm(normalise(initial))}>
          {t("common.discardChanges")}
        </Button>
        {dirty && <span className="text-xs text-warn">{t("common.unsavedChanges")}</span>}
      </div>
    </form>
  );
}

export function Policies() {
  const policies = useApi(api.policies, []);
  const modules = useApi(api.modules, []);
  const { t } = useT();
  return (
    <>
      <PageHeader title={t("nav.policies")} description={t("policies.description")} />
      <Resource state={policies}>{(p) => <PolicyForm initial={p} modules={modules.data?.modules ?? []} onSaved={policies.reload} />}</Resource>
    </>
  );
}
