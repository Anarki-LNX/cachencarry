import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { Module, Policies as PoliciesT } from "../api/types";
import { Card, Notice, PageHeader, Resource } from "../components/Card";
import { Button, Field, Switch } from "../components/Controls";
import { DurationInput } from "../components/DurationInput";
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
  const [form, setForm] = useState<PoliciesT>(() => normalise(initial));
  const [busy, setBusy] = useState(false);
  useEffect(() => setForm(normalise(initial)), [initial]);

  const overrides = form.module_ttl_seconds ?? {};
  const metaErr = form.metadata_ttl_seconds > MAX_METADATA ? "At most 30 days." : null;
  const negErr = form.negative_ttl_seconds > MAX_NEGATIVE ? "At most 1 hour." : null;
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
      toast.success("Policies saved");
      await onSaved();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <Card title="Freshness">
        <div className="space-y-5">
          <Notice tone="info">
            Packages and other versioned files are immutable: once cached they are never revalidated. These settings only affect repository indexes and other metadata that change upstream.
          </Notice>
          <Field
            label="Metadata TTL"
            hint="How long repository indexes (package lists, release files, databases) are reused before UniCache asks upstream whether they changed. Shorter = fresher updates, longer = fewer upstream requests. 0 revalidates on every request."
            error={metaErr}
          >
            {(p) => <DurationInput {...p} label="Metadata TTL" value={form.metadata_ttl_seconds} onChange={(v) => setForm({ ...form, metadata_ttl_seconds: v })} />}
          </Field>
          <Field
            label="Negative TTL"
            hint="How long a “not found” answer from upstream is remembered, so clients probing for files that do not exist do not hit upstream every time. 0 disables it; at most 1 hour."
            error={negErr}
          >
            {(p) => <DurationInput {...p} label="Negative TTL" value={form.negative_ttl_seconds} onChange={(v) => setForm({ ...form, negative_ttl_seconds: v })} />}
          </Field>
          <div className="flex items-start gap-3">
            <Switch checked={form.serve_stale_on_error} onChange={(v) => setForm({ ...form, serve_stale_on_error: v })} label="Serve stale metadata when upstream fails" />
            <div>
              <p className="text-sm font-medium">Serve stale on upstream error</p>
              <p className="mt-0.5 text-xs text-dim">If upstream is unreachable, answer with the expired cached copy instead of an error. Keeps installs working while your Internet connection or a mirror is down.</p>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Per-module metadata TTL">
        {names.length === 0 ? (
          <p className="text-sm text-dim">No modules available.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {names.map((name) => {
              const has = name in overrides;
              return (
                <li key={name} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-48 flex-1 items-center gap-3">
                    <Switch checked={has} onChange={(v) => setOverride(name, v ? form.metadata_ttl_seconds : null)} label={`Override metadata TTL for ${title(name)}`} />
                    <span className="text-sm font-medium">{title(name)}</span>
                  </div>
                  {has ? (
                    <div>
                      <DurationInput label={`Metadata TTL for ${title(name)}`} value={overrides[name]} onChange={(v) => setOverride(name, v)} aria-invalid={overrides[name] > MAX_METADATA || undefined} />
                      {overrides[name] > MAX_METADATA && <p className="mt-1 text-xs text-bad">At most 30 days.</p>}
                    </div>
                  ) : (
                    <span className="text-xs text-dim">Uses the default ({formatDuration(form.metadata_ttl_seconds)})</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" busy={busy} disabled={!dirty || !!metaErr || !!negErr || overrideErr}>
          Save policies
        </Button>
        <Button disabled={!dirty || busy} onClick={() => setForm(normalise(initial))}>
          Discard changes
        </Button>
        {dirty && <span className="text-xs text-warn">Unsaved changes</span>}
      </div>
    </form>
  );
}

export function Policies() {
  const policies = useApi(api.policies, []);
  const modules = useApi(api.modules, []);
  return (
    <>
      <PageHeader title="Policies" description="How long cached answers are trusted before UniCache checks upstream again. Changes apply immediately." />
      <Resource state={policies}>{(p) => <PolicyForm initial={p} modules={modules.data?.modules ?? []} onSaved={policies.reload} />}</Resource>
    </>
  );
}
