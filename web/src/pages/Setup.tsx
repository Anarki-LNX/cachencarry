import { useState, type FormEvent } from "react";
import { ChevronDown, CircleHelp } from "lucide-react";
import { api, errorMessage } from "../api/client";
import { Button, CodeBlock, Field, Input, Segmented } from "../components/Controls";
import { ErrorNote } from "../components/Card";
import { useT } from "../i18n";
import { useAuth } from "../state/auth";
import { AuthShell } from "./AuthShell";

const MIN_PASSWORD = 10;

type InstallKind = "proxmox" | "server" | "docker";

/** Collapsed help for people who missed the token at the end of the installation. */
function LostTokenHelp() {
  const { t } = useT();
  const [kind, setKind] = useState<InstallKind>("proxmox");
  const copy = t("setup.copyCommand");
  return (
    <details className="group rounded-lg border border-line">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted hover:bg-raised/60 hover:text-fg [&::-webkit-details-marker]:hidden">
        <CircleHelp className="size-4 shrink-0" aria-hidden />
        <span className="flex-1">{t("setup.lostToken")}</span>
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-3 border-t border-line p-3 text-xs text-muted">
        <p>{t("setup.lostTokenIntro")}</p>
        <Segmented
          label={t("setup.installKind")}
          value={kind}
          onChange={setKind}
          options={[
            { value: "proxmox", label: t("setup.kindProxmox") },
            { value: "server", label: t("setup.kindServer") },
            { value: "docker", label: t("setup.kindDocker") },
          ]}
        />
        {kind === "proxmox" && (
          <div className="space-y-2">
            <p>{t("setup.proxmoxHint")}</p>
            <CodeBlock text="pct exec CTID -- cat /var/lib/cachencarry/setup-token" copyLabel={copy} />
          </div>
        )}
        {kind === "server" && (
          <div className="space-y-2">
            <p>{t("setup.serverHint")}</p>
            <CodeBlock text="su -s /bin/sh cachencarry -c '/usr/local/bin/cachencarry setup-token'" copyLabel={copy} />
          </div>
        )}
        {kind === "docker" && (
          <div className="space-y-2">
            <p>{t("setup.composeHint")}</p>
            <CodeBlock text="docker compose exec cachencarry cachencarry setup-token" copyLabel={copy} />
            <p>{t("setup.dockerRunHint")}</p>
            <CodeBlock text="docker exec cachencarry cachencarry setup-token" copyLabel={copy} />
          </div>
        )}
      </div>
    </details>
  );
}

export function Setup() {
  const { signedIn, setupTokenRequired } = useAuth();
  const { t } = useT();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const pwError = touched && password.length < MIN_PASSWORD ? t("auth.passwordTooShort", { min: MIN_PASSWORD }) : null;
  const confirmError = touched && confirm !== password ? t("auth.passwordMismatch") : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (password.length < MIN_PASSWORD || confirm !== password) return;
    setBusy(true);
    setError(null);
    try {
      signedIn(await api.setup(username.trim(), password, token.trim()));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell wide title={t("setup.title")} subtitle={t("setup.subtitle")}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <ErrorNote message={error} />}
        <Field label={t("auth.username")}>
          {(p) => <Input {...p} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("auth.password")} hint={t("auth.passwordHint", { min: MIN_PASSWORD })} error={pwError}>
            {(p) => <Input {...p} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={MIN_PASSWORD} required />}
          </Field>
          <Field label={t("auth.confirmPassword")} error={confirmError}>
            {(p) => <Input {...p} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />}
          </Field>
        </div>
        {setupTokenRequired && (
          <div className="space-y-3">
            <Field label={t("setup.token")} hint={t("setup.tokenHint")}>
              {(p) => <Input {...p} value={token} onChange={(e) => { setToken(e.target.value); setError(null); }} autoComplete="off" spellCheck={false} className="font-mono" required />}
            </Field>
            <LostTokenHelp />
          </div>
        )}
        <Button type="submit" variant="primary" busy={busy} className="w-full">
          {t("setup.createAccount")}
        </Button>
      </form>
    </AuthShell>
  );
}
