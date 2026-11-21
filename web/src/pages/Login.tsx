import { useState, type FormEvent } from "react";
import { ApiError, api, errorMessage } from "../api/client";
import { Button, Field, Input } from "../components/Controls";
import { ErrorNote, Notice } from "../components/Card";
import { useAuth } from "../state/auth";
import { AuthShell } from "./AuthShell";

export function Login() {
  const { signedIn, notice } = useAuth();
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
        setError("Too many sign-in attempts. Wait a moment and try again.");
      } else {
        setError(errorMessage(err));
      }
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Sign in" subtitle="Manage your LAN cache.">
      <form onSubmit={submit} className="space-y-4">
        {notice && !error && <Notice tone="info">{notice}</Notice>}
        {error && <ErrorNote message={error} />}
        <Field label="Username">
          {(p) => <Input {...p} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus />}
        </Field>
        <Field label="Password">
          {(p) => <Input {...p} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />}
        </Field>
        <Button type="submit" variant="primary" busy={busy} className="w-full">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
