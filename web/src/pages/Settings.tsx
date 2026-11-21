import { useState, type FormEvent, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { api, errorMessage } from "../api/client";
import type { Settings as SettingsT } from "../api/types";
import { Card, EmptyState, ErrorNote, KeyValue, Notice, PageHeader, Resource } from "../components/Card";
import { Button, Field, Input, Segmented } from "../components/Controls";
import { Table, Td, Th, Tr } from "../components/Table";
import { absoluteTime, formatBytes, formatDuration, formatRate, relativeTime } from "../lib/format";
import { useApi } from "../lib/useApi";
import { useAuth } from "../state/auth";
import { useTheme } from "../state/theme";

const MIN_PASSWORD = 10;

/** Sizes arrive as byte counts or as configured strings such as "10%". */
function size(v: number | string | null | undefined, zero = "unlimited"): string {
  if (v === null || v === undefined || v === "") return "–";
  if (typeof v === "string") return v;
  return v === 0 ? zero : formatBytes(v);
}
function rate(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "–";
  if (typeof v === "string") return v;
  return v === 0 ? "unlimited" : formatRate(v);
}
function list(v: string[] | null | undefined): ReactNode {
  if (!v || v.length === 0) return <span className="text-dim">none</span>;
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
function text(v: unknown): ReactNode {
  if (v === null || v === undefined || v === "") return <span className="text-dim">not set</span>;
  if (typeof v === "boolean") return v ? "enabled" : "disabled";
  if (typeof v === "object") return <code className="break-all font-mono text-xs">{JSON.stringify(v)}</code>;
  return String(v);
}
const mono = (v: string) => (v ? <code className="break-all font-mono text-xs">{v}</code> : <span className="text-dim">not set</span>);

function Config({ s }: { s: SettingsT }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card title="Server">
        <KeyValue
          rows={[
            ["Listen address", mono(s.server?.listen ?? "")],
            ["Port", text(s.server?.port)],
            ["TLS", text(s.server?.tls)],
            ["Trusted proxies", list(s.server?.trusted_proxies)],
          ]}
        />
      </Card>
      <Card title="Storage">
        <KeyValue
          rows={[
            ["Path", mono(s.storage?.path ?? "")],
            ["Maximum size", size(s.storage?.max_size)],
            ["Minimum free space", size(s.storage?.min_free_space, "none")],
            ["Cleanup interval", formatDuration(s.storage?.gc_interval_seconds)],
            ["Integrity check interval", s.storage?.verify_interval_seconds ? formatDuration(s.storage.verify_interval_seconds) : "disabled"],
          ]}
        />
      </Card>
      <Card title="Downloads">
        <KeyValue
          rows={[
            ["Concurrent downloads", text(s.download?.max_concurrent)],
            ["Retries", text(s.download?.retries)],
            ["Resume interrupted", text(s.download?.resume)],
            ["Maximum object size", size(s.download?.max_object_size)],
            ["Upstream rate limit", rate(s.download?.upstream_rate_limit)],
            ["Client rate limit", rate(s.download?.client_rate_limit)],
          ]}
        />
      </Card>
      <Card title="Security">
        <KeyValue
          rows={[
            ["Allowed clients", list(s.security?.allowed_clients)],
            ["Management access", list(s.security?.admin_allowed)],
            ["Private upstreams", s.security?.allow_private_upstreams ? "allowed" : "blocked"],
            ["Session lifetime", formatDuration(s.security?.session_ttl_seconds)],
          ]}
        />
      </Card>
      <Card title="Database">
        <KeyValue
          rows={[
            ["Driver", text(s.database?.driver)],
            ["Path", mono(s.database?.path ?? "")],
          ]}
        />
      </Card>
      <Card title="Logging">
        <KeyValue
          rows={[
            ["Level", text(s.logging?.level)],
            ["Format", text(s.logging?.format)],
            ["File", s.logging?.file ? mono(s.logging.file) : "standard output"],
          ]}
        />
      </Card>
    </div>
  );
}

function PasswordForm() {
  const { signedOut } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const nextErr = touched && next.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters.` : null;
  const confirmErr = touched && confirm !== next ? "The passwords do not match." : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (next.length < MIN_PASSWORD || confirm !== next) return;
    setBusy(true);
    setError(null);
    try {
      await api.changePassword(current, next);
      signedOut("Password changed. All sessions were signed out — sign in with the new password.");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-md space-y-4" noValidate>
      {error && <ErrorNote message={error} />}
      <Field label="Current password">
        {(p) => <Input {...p} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />}
      </Field>
      <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`} error={nextErr}>
        {(p) => <Input {...p} type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />}
      </Field>
      <Field label="Confirm new password" error={confirmErr}>
        {(p) => <Input {...p} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />}
      </Field>
      <p className="text-xs text-dim">Changing the password signs out every session, including this one.</p>
      <Button type="submit" variant="primary" busy={busy} disabled={!current || !next}>
        Change password
      </Button>
    </form>
  );
}

function AuditLog() {
  const audit = useApi(() => api.audit(100), [], 30_000);
  return (
    <Resource state={audit}>
      {(data) => {
        const rows = data.audit ?? [];
        if (rows.length === 0) return <EmptyState title="No audit entries yet" />;
        return (
          <Table label="Audit log" className="max-h-[28rem] overflow-y-auto">
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>Actor</Th>
                <Th>IP</Th>
                <Th>Action</Th>
                <Th>Detail</Th>
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

  return (
    <>
      <PageHeader title="Settings" description="Effective server configuration, your account and the audit trail." />
      <div className="space-y-3">
        <Notice tone="info">
          The configuration below is read-only here. Change it in <code className="font-mono text-xs">/etc/unicache/config.yaml</code> or with{" "}
          <code className="font-mono text-xs">UNICACHE_*</code> environment variables, then restart UniCache.
        </Notice>
        <Resource state={settings}>{(s) => <Config s={s} />}</Resource>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card title={`Change password · ${user}`}>
            <PasswordForm />
          </Card>
          <Card title="Appearance">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                {theme === "dark" ? <Moon className="size-4 text-muted" aria-hidden /> : <Sun className="size-4 text-muted" aria-hidden />}
                Theme
              </div>
              <Segmented
                label="Theme"
                value={theme}
                onChange={set}
                options={[
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                ]}
              />
            </div>
            <p className="mt-2 text-xs text-dim">Stored in this browser only.</p>
          </Card>
        </div>

        <Card title="Audit log" bodyClassName="p-0">
          <AuditLog />
        </Card>
      </div>
    </>
  );
}
