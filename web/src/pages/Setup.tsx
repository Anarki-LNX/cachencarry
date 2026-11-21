import { useState, type FormEvent } from "react";
import { api, errorMessage } from "../api/client";
import { Button, CodeBlock, Field, Input } from "../components/Controls";
import { ErrorNote } from "../components/Card";
import { useT } from "../i18n";
import { useAuth } from "../state/auth";
import { AuthShell } from "./AuthShell";

const MIN_PASSWORD = 10;

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
            <div className="space-y-2 text-xs text-muted">
              <p>{t("setup.readToken")}</p>
              <CodeBlock text="su -s /bin/sh unicache -c '/usr/local/bin/unicache setup-token'" copyLabel={t("setup.copyCommand")} />
              <p>{t("setup.withCompose")}</p>
              <CodeBlock text="docker compose exec unicache unicache setup-token" copyLabel={t("setup.copyCommand")} />
            </div>
          </div>
        )}
        <Button type="submit" variant="primary" busy={busy} className="w-full">
          {t("setup.createAccount")}
        </Button>
      </form>
    </AuthShell>
  );
}
