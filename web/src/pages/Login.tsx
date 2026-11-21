import { useState, type FormEvent } from "react";
import { ApiError, api, errorMessage } from "../api/client";
import { Button, Field, Input } from "../components/Controls";
import { ErrorNote, Notice } from "../components/Card";
import { useT } from "../i18n";
import { useAuth } from "../state/auth";
import { AuthShell } from "./AuthShell";

export function Login() {
  const { signedIn, notice } = useAuth();
  const { t } = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      signedIn(await api.login(username.trim(), password));
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(t("auth.tooManyAttempts"));
      } else {
        setError(errorMessage(err));
      }
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={t("auth.signIn")} subtitle={t("auth.signInSubtitle")}>
      <form onSubmit={submit} className="space-y-4">
        {notice && !error && <Notice tone="info">{t(notice)}</Notice>}
        {error && <ErrorNote message={error} />}
        <Field label={t("auth.username")}>
          {(p) => <Input {...p} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus />}
        </Field>
        <Field label={t("auth.password")}>
          {(p) => <Input {...p} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />}
        </Field>
        <Button type="submit" variant="primary" busy={busy} className="w-full">
          {t("auth.signIn")}
        </Button>
      </form>
    </AuthShell>
  );
}
