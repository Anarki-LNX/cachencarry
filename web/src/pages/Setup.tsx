import { useState, type FormEvent } from "react";
import { api, errorMessage } from "../api/client";
import { Button, CodeBlock, Field, Input } from "../components/Controls";
import { ErrorNote } from "../components/Card";
import { useAuth } from "../state/auth";
import { AuthShell } from "./AuthShell";

const MIN_PASSWORD = 10;

export function Setup() {
  const { signedIn, setupTokenRequired } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const pwError = touched && password.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters.` : null;
  const confirmError = touched && confirm !== password ? "The passwords do not match." : null;

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
    <AuthShell wide title="Welcome — create the administrator account" subtitle="This one-time setup secures the management interface. Clients on your LAN never need an account.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <ErrorNote message={error} />}
        <Field label="Username">
          {(p) => <Input {...p} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" hint={`At least ${MIN_PASSWORD} characters.`} error={pwError}>
            {(p) => <Input {...p} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={MIN_PASSWORD} required />}
          </Field>
          <Field label="Confirm password" error={confirmError}>
            {(p) => <Input {...p} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />}
          </Field>
        </div>
        {setupTokenRequired && (
          <div className="space-y-3">
            <Field label="Setup token" hint="Proves that you have access to the server. It is stored in the file setup-token inside the data directory.">
              {(p) => <Input {...p} value={token} onChange={(e) => { setToken(e.target.value); setError(null); }} autoComplete="off" spellCheck={false} className="font-mono" required />}
            </Field>
            <div className="space-y-2 text-xs text-muted">
              <p>Read the token on the server:</p>
              <CodeBlock text="su -s /bin/sh unicache -c '/usr/local/bin/unicache setup-token'" copyLabel="Copy command" />
              <p>With Docker Compose:</p>
              <CodeBlock text="docker compose exec unicache unicache setup-token" copyLabel="Copy command" />
            </div>
          </div>
        )}
        <Button type="submit" variant="primary" busy={busy} className="w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
