import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Check, Copy } from "lucide-react";
import { useT } from "../i18n";

type Variant = "primary" | "secondary" | "danger" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-ok text-bg hover:brightness-110 border-transparent font-semibold",
  secondary: "bg-raised text-fg hover:border-dim border-line",
  danger: "bg-bad/10 text-bad hover:bg-bad/20 border-bad/40",
  ghost: "bg-transparent text-muted hover:text-fg hover:bg-raised border-transparent",
};

export function Button({
  variant = "secondary",
  size = "md",
  busy = false,
  icon,
  children,
  className = "",
  disabled,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; busy?: boolean; icon?: ReactNode }) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        size === "sm" ? "h-7 px-2 text-xs" : "h-9 px-3 text-sm"
      } ${variants[variant]} ${className}`}
      {...rest}
    >
      {busy ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className = "",
  tone = "default",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: "default" | "danger" | "active" }) {
  const toneCls = { default: "text-muted hover:text-fg", danger: "text-muted hover:text-bad", active: "text-warn hover:text-fg" }[tone];
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-8 shrink-0 place-items-center rounded-lg hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40 ${toneCls} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "border-ok bg-ok" : "border-line bg-raised"
      }`}
    >
      <span
        className={`absolute top-0.5 size-3.5 rounded-full transition-all ${checked ? "left-[18px] bg-bg" : "left-0.5 bg-dim"}`}
        aria-hidden
      />
    </button>
  );
}

const inputCls =
  "w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg placeholder:text-dim focus:border-info focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-info/30 disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}) {
  const id = useId();
  const descId = hint || error ? `${id}-desc` : undefined;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      {children({ id, "aria-describedby": descId, "aria-invalid": error ? true : undefined })}
      {(error || hint) && (
        <p id={descId} className={`mt-1 text-xs ${error ? "text-bad" : "text-dim"}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputCls} h-9 ${className}`} {...rest} />;
}
export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputCls} py-2 font-mono text-xs leading-5 ${className}`} {...rest} />;
}
export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputCls} h-9 pr-8 ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Segmented<V extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-line bg-bg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`h-6 rounded-md px-2 text-xs font-medium transition-colors ${
            o.value === value ? "bg-raised text-fg" : "text-dim hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path (plain-HTTP LAN deployments) */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useT();
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Button
      size="sm"
      icon={state === "ok" ? <Check className="size-3.5 text-ok" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      onClick={async () => {
        const ok = await copyText(text);
        setState(ok ? "ok" : "fail");
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setState("idle"), 2000);
      }}
    >
      <span aria-live="polite">{state === "ok" ? t("common.copied") : state === "fail" ? t("common.copyManually") : (label ?? t("common.copy"))}</span>
    </Button>
  );
}

export function CodeBlock({ text, copyLabel }: { text: string; copyLabel?: string }) {
  return (
    <div className="rounded-lg border border-line bg-bg">
      <div className="flex justify-end border-b border-line px-2 py-1">
        <CopyButton text={text} label={copyLabel} />
      </div>
      <pre className="max-h-56 overflow-auto p-3 font-mono text-xs leading-5 text-fg" tabIndex={0}>
        {text}
      </pre>
    </div>
  );
}
