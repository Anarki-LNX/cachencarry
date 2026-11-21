import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { RuntimeSettings as RuntimeT, RuntimeView } from "../api/types";
import { Card, Notice } from "../components/Card";
import { Button, Field, Input, Select } from "../components/Controls";
import { RATE_UNITS, SIZE_UNITS, UnitInput } from "../components/UnitInput";
import { useToast } from "../state/toast";

const MIB = 2 ** 20;
const GIB = 2 ** 30;
const MIN_MAX_SIZE = 100 * MIB;
const MIN_RATE = 16 * 2 ** 10;

/** Mirrors the server's validation so mistakes show up while typing. */
function validate(f: RuntimeT) {
  const minFree = f.min_free_space.trim();
  const pct = /^(\d+(\.\d+)?)\s*%$/.exec(minFree);
  return {
    max_size: f.max_size > 0 && f.max_size < MIN_MAX_SIZE ? "Use 0 for unlimited or at least 100 MiB." : null,
    min_free_space:
      minFree === "" || minFree === "0" || (pct && Number(pct[1]) < 100) || /^\d+(\.\d+)?\s*(B|[KMGTP](I?B)?)$/i.test(minFree)
        ? null
        : "Use a percentage below 100 (10%) or a size (20GB). 0 turns it off.",
    upstream_rate_limit: f.upstream_rate_limit > 0 && f.upstream_rate_limit < MIN_RATE ? "Use 0 for unlimited or at least 16 KiB/s." : null,
    client_rate_limit: f.client_rate_limit > 0 && f.client_rate_limit < MIN_RATE ? "Use 0 for unlimited or at least 16 KiB/s." : null,
    max_concurrent: Number.isInteger(f.max_concurrent) && f.max_concurrent >= 1 && f.max_concurrent <= 256 ? null : "Between 1 and 256.",
  };
}

export function RuntimeSettingsForm({ view, onSaved }: { view: RuntimeView; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [form, setForm] = useState<RuntimeT>(view.values);
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  useEffect(() => setForm(view.values), [view.values]);

  const errors = validate(form);
  const invalid = Object.values(errors).some(Boolean);
  const dirty = JSON.stringify(view.values) !== JSON.stringify(form);
  const set = <K extends keyof RuntimeT>(key: K, value: RuntimeT[K]) => setForm({ ...form, [key]: value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    setBusy("save");
    try {
      await api.saveRuntime({ ...form, min_free_space: form.min_free_space.trim() || "0" });
      toast.success("Settings saved and applied");
      await onSaved();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    setBusy("reset");
    try {
      await api.resetRuntime();
      toast.success("Settings reset to the configuration file");
      await onSaved();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <Card title="Operational settings">
        <div className="space-y-5">
          <Notice tone="info">
            These settings apply immediately, without a restart, and are remembered.{" "}
            {view.overridden
              ? "They currently override the values in the configuration file."
              : "They currently come from the configuration file; saving here takes precedence from then on."}
          </Notice>

          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Maximum cache size"
              error={errors.max_size}
              hint="When the cache grows beyond this, the least recently used objects are removed. 0 = unlimited (only the free-space rule applies)."
            >
              {(p) => <UnitInput {...p} label="Maximum cache size" value={form.max_size} onChange={(v) => set("max_size", v)} units={SIZE_UNITS} defaultUnit={GIB} />}
            </Field>
            <Field
              label="Keep free on disk"
              error={errors.min_free_space}
              hint="Space the cache always leaves free: a percentage of the disk (10%) or a size (20GB). 0 turns it off."
            >
              {(p) => <Input {...p} value={form.min_free_space} onChange={(e) => set("min_free_space", e.target.value)} className="max-w-[9rem]" spellCheck={false} />}
            </Field>
            <Field
              label="Internet download limit"
              error={errors.upstream_rate_limit}
              hint="Shared by all downloads from the Internet, so the cache cannot use your whole connection. 0 = unlimited."
            >
              {(p) => (
                <UnitInput {...p} label="Internet download limit" value={form.upstream_rate_limit} onChange={(v) => set("upstream_rate_limit", v)} units={RATE_UNITS} defaultUnit={MIB} />
              )}
            </Field>
            <Field label="Limit per client transfer" error={errors.client_rate_limit} hint="Applies to each transfer to a machine in your network. 0 = unlimited.">
              {(p) => <UnitInput {...p} label="Limit per client transfer" value={form.client_rate_limit} onChange={(v) => set("client_rate_limit", v)} units={RATE_UNITS} defaultUnit={MIB} />}
            </Field>
            <Field label="Simultaneous Internet downloads" error={errors.max_concurrent} hint="Further downloads wait in a queue. Running downloads are never interrupted by a change.">
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min={1}
                  max={256}
                  step={1}
                  value={Number.isFinite(form.max_concurrent) ? form.max_concurrent : ""}
                  onChange={(e) => set("max_concurrent", e.target.value === "" ? NaN : Number(e.target.value))}
                  className="max-w-[9rem]"
                />
              )}
            </Field>
            <Field label="Largest object to download" hint="Bigger files are refused instead of cached. 0 = unlimited.">
              {(p) => <UnitInput {...p} label="Largest object to download" value={form.max_object_size} onChange={(v) => set("max_object_size", v)} units={SIZE_UNITS} defaultUnit={GIB} />}
            </Field>
            <Field label="Log level" hint="debug writes one line per request to the server log.">
              {(p) => (
                <Select {...p} value={form.log_level} onChange={(e) => set("log_level", e.target.value)} className="max-w-[9rem]">
                  {["debug", "info", "warn", "error"].map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" busy={busy === "save"} disabled={!dirty || invalid || busy !== null}>
              Save settings
            </Button>
            <Button type="button" onClick={() => setForm(view.values)} disabled={!dirty || busy !== null}>
              Discard changes
            </Button>
            {view.overridden && (
              <Button type="button" onClick={reset} busy={busy === "reset"} disabled={busy !== null}>
                Reset to configuration file
              </Button>
            )}
            {dirty && <span className="text-xs text-warn">Unsaved changes</span>}
          </div>
        </div>
      </Card>
    </form>
  );
}
