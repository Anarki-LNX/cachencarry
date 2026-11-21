import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { RuntimeSettings as RuntimeT, RuntimeView } from "../api/types";
import { Card, Notice } from "../components/Card";
import { Button, Field, Input, Select } from "../components/Controls";
import { RATE_UNITS, SIZE_UNITS, UnitInput } from "../components/UnitInput";
import { useT, type Translate } from "../i18n";
import { useToast } from "../state/toast";

const MIB = 2 ** 20;
const GIB = 2 ** 30;
const MIN_MAX_SIZE = 100 * MIB;
const MIN_RATE = 16 * 2 ** 10;

/** Mirrors the server's validation so mistakes show up while typing. */
function validate(f: RuntimeT, t: Translate) {
  const minFree = f.min_free_space.trim();
  const pct = /^(\d+(\.\d+)?)\s*%$/.exec(minFree);
  return {
    max_size: f.max_size > 0 && f.max_size < MIN_MAX_SIZE ? t("runtime.maxSizeError") : null,
    min_free_space:
      minFree === "" || minFree === "0" || (pct && Number(pct[1]) < 100) || /^\d+(\.\d+)?\s*(B|[KMGTP](I?B)?)$/i.test(minFree)
        ? null
        : t("runtime.minFreeError"),
    upstream_rate_limit: f.upstream_rate_limit > 0 && f.upstream_rate_limit < MIN_RATE ? t("runtime.rateError") : null,
    client_rate_limit: f.client_rate_limit > 0 && f.client_rate_limit < MIN_RATE ? t("runtime.rateError") : null,
    max_concurrent: Number.isInteger(f.max_concurrent) && f.max_concurrent >= 1 && f.max_concurrent <= 256 ? null : t("runtime.concurrentError"),
  };
}

export function RuntimeSettingsForm({ view, onSaved }: { view: RuntimeView; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const { t } = useT();
  const [form, setForm] = useState<RuntimeT>(view.values);
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  useEffect(() => setForm(view.values), [view.values]);

  const errors = validate(form, t);
  const invalid = Object.values(errors).some(Boolean);
  const dirty = JSON.stringify(view.values) !== JSON.stringify(form);
  const set = <K extends keyof RuntimeT>(key: K, value: RuntimeT[K]) => setForm({ ...form, [key]: value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    setBusy("save");
    try {
      await api.saveRuntime({ ...form, min_free_space: form.min_free_space.trim() || "0" });
      toast.success(t("runtime.saved"));
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
      toast.success(t("runtime.resetDone"));
      await onSaved();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <Card title={t("runtime.title")}>
        <div className="space-y-5">
          <Notice tone="info">
            {t("runtime.notice")} {view.overridden ? t("runtime.overridden") : t("runtime.fromFile")}
          </Notice>

          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label={t("runtime.maxSize")}
              error={errors.max_size}
              hint={t("runtime.maxSizeHint")}
            >
              {(p) => <UnitInput {...p} label={t("runtime.maxSize")} value={form.max_size} onChange={(v) => set("max_size", v)} units={SIZE_UNITS} defaultUnit={GIB} />}
            </Field>
            <Field
              label={t("runtime.keepFree")}
              error={errors.min_free_space}
              hint={t("runtime.keepFreeHint")}
            >
              {(p) => <Input {...p} value={form.min_free_space} onChange={(e) => set("min_free_space", e.target.value)} className="max-w-[9rem]" spellCheck={false} />}
            </Field>
            <Field
              label={t("runtime.upstreamLimit")}
              error={errors.upstream_rate_limit}
              hint={t("runtime.upstreamLimitHint")}
            >
              {(p) => (
                <UnitInput {...p} label={t("runtime.upstreamLimit")} value={form.upstream_rate_limit} onChange={(v) => set("upstream_rate_limit", v)} units={RATE_UNITS} defaultUnit={MIB} />
              )}
            </Field>
            <Field label={t("runtime.clientLimit")} error={errors.client_rate_limit} hint={t("runtime.clientLimitHint")}>
              {(p) => <UnitInput {...p} label={t("runtime.clientLimit")} value={form.client_rate_limit} onChange={(v) => set("client_rate_limit", v)} units={RATE_UNITS} defaultUnit={MIB} />}
            </Field>
            <Field label={t("runtime.maxConcurrent")} error={errors.max_concurrent} hint={t("runtime.maxConcurrentHint")}>
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
            <Field label={t("runtime.maxObject")} hint={t("runtime.maxObjectHint")}>
              {(p) => <UnitInput {...p} label={t("runtime.maxObject")} value={form.max_object_size} onChange={(v) => set("max_object_size", v)} units={SIZE_UNITS} defaultUnit={GIB} />}
            </Field>
            <Field label={t("runtime.logLevel")} hint={t("runtime.logLevelHint")}>
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
              {t("runtime.save")}
            </Button>
            <Button type="button" onClick={() => setForm(view.values)} disabled={!dirty || busy !== null}>
              {t("common.discardChanges")}
            </Button>
            {view.overridden && (
              <Button type="button" onClick={reset} busy={busy === "reset"} disabled={busy !== null}>
                {t("runtime.reset")}
              </Button>
            )}
            {dirty && <span className="text-xs text-warn">{t("common.unsavedChanges")}</span>}
          </div>
        </div>
      </Card>
    </form>
  );
}
