import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { errorMessage } from "../api/client";
import { useT } from "../i18n";

type Kind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: Kind;
  text: string;
}
interface ToastApi {
  success: (text: string) => void;
  error: (e: unknown) => void;
  info: (text: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t: tr } = useT();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind: Kind, text: string) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-4), { id, kind, text }]);
      window.setTimeout(() => dismiss(id), kind === "error" ? 8000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo<ToastApi>(
    () => ({
      success: (text) => push("success", text),
      info: (text) => push("info", text),
      error: (e) => push("error", typeof e === "string" ? e : errorMessage(e)),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className="toast-in pointer-events-auto flex items-start gap-3 rounded-lg border border-line bg-panel px-3.5 py-3 shadow-xl shadow-black/30"
          >
            {t.kind === "success" && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />}
            {t.kind === "error" && <AlertTriangle className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />}
            {t.kind === "info" && <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />}
            <p className="min-w-0 flex-1 break-words text-sm text-fg">{t.text}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label={tr("common.dismissNotification")}
              className="rounded p-0.5 text-dim hover:text-fg"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}
