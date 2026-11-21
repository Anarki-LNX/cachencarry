import { useState, type FormEvent, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { api, errorMessage } from "../api/client";
import type { Settings as SettingsT } from "../api/types";
import { Card, EmptyState, ErrorNote, KeyValue, Notice, PageHeader, Resource } from "../components/Card";
import { Button, Field, Input, Segmented } from "../components/Controls";
import { Table, Td, Th, Tr } from "../components/Table";
import { useT, type Translate } from "../i18n";
import { absoluteTime, formatDuration, relativeTime } from "../lib/format";
import { useApi } from "../lib/useApi";
import { useAuth } from "../state/auth";
import { RuntimeSettingsForm } from "./RuntimeSettings";
import { useTheme } from "../state/theme";

const MIN_PASSWORD = 10;

function list(v: string[] | null | undefined, t: Translate): ReactNode {
  if (!v || v.length === 0) return <span className="text-dim">{t("common.none")}</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {v.map((x) => (
        <code key={x} className="rounded bg-raised px-1.5 py-0.5 font-mono text-xs">
          {x}
        </code>
      ))}
    </span>
  );
}
function text(v: unknown, t: Translate): ReactNode {
  if (v === null || v === undefined || v === "") return <span className="text-dim">{t("common.notSet")}</span>;
  if (typeof v === "boolean") return v ? t("settings.enabled") : t("settings.disabled");
  if (typeof v === "object") return <code className="break-all font-mono text-xs">{JSON.stringify(v)}</code>;
  return String(v);
}
const mono = (v: string, t: Translate) => (v ? <code className="break-all font-mono text-xs">{v}</code> : <span className="text-dim">{t("common.notSet")}</span>);

function Config({ s }: { s: SettingsT }) {
  const { t } = useT();
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card title={t("settings.server")}>
        <KeyValue
          rows={[
            [t("settings.listenAddress"), mono(s.server?.listen ?? "", t)],
            [t("settings.port"), text(s.server?.port, t)],
            [t("settings.tls"), text(s.server?.tls, t)],
            [t("settings.trustedProxies"), list(s.server?.trusted_proxies, t)],
          ]}
        />
      </Card>
      <Card title={t("nav.storage")}>
        <KeyValue
          rows={[
            [t("common.path"), mono(s.storage?.path ?? "", t)],
            [t("settings.cleanupInterval"), formatDuration(s.storage?.gc_interval_seconds)],
            [t("settings.verifyInterval"), s.storage?.verify_interval_seconds ? formatDuration(s.storage.verify_interval_seconds) : t("settings.disabled")],
          ]}
        />
      </Card>
      <Card title={t("nav.downloads")}>
        <KeyValue
          rows={[
            [t("settings.retries"), text(s.download?.retries, t)],
            [t("settings.resume"), text(s.download?.resume, t)],
          ]}
        />
      </Card>
      <Card title={t("settings.security")}>
        <KeyValue
          rows={[
            [t("settings.allowedClients"), list(s.security?.allowed_clients, t)],
            [t("settings.managementAccess"), list(s.security?.admin_allowed, t)],
            [t("settings.privateUpstreams"), s.security?.allow_private_upstreams ? t("settings.allowed") : t("settings.blocked")],
            [t("settings.sessionLifetime"), formatDuration(s.security?.session_ttl_seconds)],
          ]}
        />
      </Card>
      <Card title={t("settings.database")}>
        <KeyValue
          rows={[
            [t("settings.driver"), text(s.database?.driver, t)],
            [t("common.path"), mono(s.database?.path ?? "", t)],
          ]}
        />
      </Card>
      <Card title={t("settings.logging")}>
        <KeyValue
          rows={[
            [t("settings.format"), text(s.logging?.format, t)],
            [t("settings.file"), s.logging?.file ? mono(s.logging.file, t) : t("settings.stdout")],
          ]}
        />
      </Card>
    </div>
  );
}

function PasswordForm() {
  const { signedOut } = useAuth();
  const { t } = useT();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const nextErr = touched && next.length < MIN_PASSWORD ? t("auth.passwordTooShort", { min: MIN_PASSWORD }) : null;
  const confirmErr = touched && confirm !== next ? t("auth.passwordMismatch") : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (next.length < MIN_PASSWORD || confirm !== next) return;
    setBusy(true);
    setError(null);
    try {
      await api.changePassword(current, next);
      signedOut("auth.passwordChanged");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-md space-y-4" noValidate>
      {error && <ErrorNote message={error} />}
      <Field label={t("settings.currentPassword")}>
        {(p) => <Input {...p} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />}
      </Field>
      <Field label={t("settings.newPassword")} hint={t("auth.passwordHint", { min: MIN_PASSWORD })} error={nextErr}>
        {(p) => <Input {...p} type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />}
      </Field>
      <Field label={t("settings.confirmNewPassword")} error={confirmErr}>
        {(p) => <Input {...p} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />}
      </Field>
      <p className="text-xs text-dim">{t("settings.passwordNote")}</p>
      <Button type="submit" variant="primary" busy={busy} disabled={!current || !next}>
        {t("settings.changePassword")}
      </Button>
    </form>
  );
}

function AuditLog() {
  const audit = useApi(() => api.audit(100), [], 30_000);
  const { t } = useT();
  return (
    <Resource state={audit}>
      {(data) => {
        const rows = data.audit ?? [];
        if (rows.length === 0) return <EmptyState title={t("settings.noAudit")} />;
        return (
          <Table label={t("settings.auditLog")} className="max-h-[28rem] overflow-y-auto">
            <thead>
              <tr>
                <Th>{t("common.time")}</Th>
                <Th>{t("settings.actor")}</Th>
                <Th>{t("settings.ip")}</Th>
                <Th>{t("settings.action")}</Th>
                <Th>{t("settings.detail")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <Tr key={a.id}>
                  <Td className="whitespace-nowrap text-muted" title={absoluteTime(a.time)}>
                    {relativeTime(a.time)}
                  </Td>
                  <Td>{a.actor || "–"}</Td>
                  <Td mono>{a.ip || "–"}</Td>
                  <Td mono>{a.action}</Td>
                  <Td className="break-all text-xs text-muted">{a.detail || "–"}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        );
      }}
    </Resource>
  );
}

export function Settings() {
  const settings = useApi(api.settings, []);
  const { theme, set } = useTheme();
  const { user } = useAuth();
  const { t, rich } = useT();

  return (
    <>
      <PageHeader title={t("nav.settings")} description={t("settings.description")} />
      <div className="space-y-3">
        <Resource state={settings}>
          {(s) => (
            <div className="space-y-3">
              {s.runtime && <RuntimeSettingsForm view={s.runtime} onSaved={settings.reload} />}
              <Notice tone="info">
                {rich("settings.readOnlyNotice", {
                  file: <code className="font-mono text-xs">/etc/unicache/config.yaml</code>,
                  env: <code className="font-mono text-xs">UNICACHE_*</code>,
                })}
              </Notice>
              <Config s={s} />
            </div>
          )}
        </Resource>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card title={t("settings.changePasswordTitle", { user })}>
            <PasswordForm />
          </Card>
          <Card title={t("settings.appearance")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                {theme === "dark" ? <Moon className="size-4 text-muted" aria-hidden /> : <Sun className="size-4 text-muted" aria-hidden />}
                {t("settings.theme")}
              </div>
              <Segmented
                label={t("settings.theme")}
                value={theme}
                onChange={set}
                options={[
                  { value: "dark", label: t("settings.themeDark") },
                  { value: "light", label: t("settings.themeLight") },
                ]}
              />
            </div>
            <p className="mt-2 text-xs text-dim">{t("settings.browserOnly")}</p>
          </Card>
        </div>

        <Card title={t("settings.auditLog")} bodyClassName="p-0">
          <AuditLog />
        </Card>
      </div>
    </>
  );
}
