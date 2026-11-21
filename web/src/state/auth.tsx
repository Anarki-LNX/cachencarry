import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, errorMessage, setCsrf, setUnauthorizedHandler } from "../api/client";
import type { AuthResult, Session } from "../api/types";

type Phase = "loading" | "unreachable" | "setup" | "login" | "ready";

interface AuthState {
  phase: Phase;
  user: string;
  version: string;
  setupTokenRequired: boolean;
  error: string | null;
  /** Shown on the login screen, e.g. after a password change. */
  notice: string | null;
  refresh: () => Promise<void>;
  signedIn: (r: AuthResult) => void;
  signedOut: (notice?: string) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api.session();
      setSession(s);
      setError(null);
      if (s.setup_required) {
        setCsrf("");
        setPhase("setup");
      } else if (s.authenticated) {
        setCsrf(s.csrf);
        setUser(s.user ?? "");
        setPhase("ready");
      } else {
        setCsrf("");
        setPhase("login");
      }
    } catch (e) {
      setError(errorMessage(e));
      setPhase("unreachable");
    }
  }, []);

  const signedOut = useCallback((msg?: string) => {
    setCsrf("");
    setUser("");
    setNotice(msg ?? null);
    setPhase((p) => (p === "ready" ? "login" : p));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setUnauthorizedHandler(() => signedOut("Your session has expired. Please sign in again."));
    return () => setUnauthorizedHandler(null);
  }, [signedOut]);

  const signedIn = useCallback((r: AuthResult) => {
    setCsrf(r.csrf);
    setUser(r.user);
    setNotice(null);
    setPhase("ready");
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* the session is dropped locally either way */
    }
    signedOut();
  }, [signedOut]);

  const value = useMemo<AuthState>(
    () => ({
      phase,
      user,
      version: session?.version ?? "",
      setupTokenRequired: session?.setup_token_required ?? true,
      error,
      notice,
      refresh,
      signedIn,
      signedOut,
      logout,
    }),
    [phase, user, session, error, notice, refresh, signedIn, signedOut, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
