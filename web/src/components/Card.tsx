import type { ReactNode } from "react";

export function Card({
  title,
  actions,
  children,
  className = "",
  bodyClassName = "p-4",
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-line bg-panel ${className}`}>
      {(title || actions) && (
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h2>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

type Tone = "ok" | "info" | "warn" | "bad" | "alt" | "neutral";
const toneText: Record<Tone, string> = {
  ok: "text-ok",
  info: "text-info",
  warn: "text-warn",
  bad: "text-bad",
  alt: "text-alt",
  neutral: "text-muted",
};
const toneBg: Record<Tone, string> = {
  ok: "bg-ok/10",
  info: "bg-info/10",
  warn: "bg-warn/10",
  bad: "bg-bad/10",
  alt: "bg-alt/10",
  neutral: "bg-raised",
};

export function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = "neutral",
  children,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  children?: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</h2>
        {icon && (
          <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${toneBg[tone]} ${toneText[tone]}`} aria-hidden>
            {icon}
          </span>
        )}
      </div>
      <div className="num mt-2 truncate text-2xl font-semibold tracking-tight text-fg">{value}</div>
      {sub && <div className="mt-1 truncate text-xs text-dim">{sub}</div>}
      {children}
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ${toneBg[tone]} ${toneText[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone, label }: { tone: Tone; label: string }) {
  const bg: Record<Tone, string> = {
    ok: "bg-ok",
    info: "bg-info",
    warn: "bg-warn",
    bad: "bg-bad",
    alt: "bg-alt",
    neutral: "bg-dim",
  };
  return <span role="img" aria-label={label} title={label} className={`inline-block size-2 shrink-0 rounded-full ${bg[tone]}`} />;
}

export function ProgressBar({
  value,
  tone = "ok",
  label,
  indeterminate = false,
}: {
  /** 0..1 */
  value: number;
  tone?: Tone;
  label: string;
  indeterminate?: boolean;
}) {
  const fill: Record<Tone, string> = {
    ok: "bg-ok",
    info: "bg-info",
    warn: "bg-warn",
    bad: "bg-bad",
    alt: "bg-alt",
    neutral: "bg-dim",
  };
  const pct = Math.max(0, Math.min(1, isFinite(value) ? value : 0)) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
      className="h-2 w-full overflow-hidden rounded-full bg-raised"
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${fill[tone]} ${indeterminate ? "animate-pulse" : ""}`}
        style={{ width: indeterminate ? "100%" : `${pct}%`, opacity: indeterminate ? 0.35 : 1 }}
      />
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      {icon && <div className="text-dim" aria-hidden>{icon}</div>}
      <p className="text-sm font-medium text-muted">{title}</p>
      {hint && <p className="max-w-md text-xs text-dim">{hint}</p>}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
      <span className="min-w-0 flex-1 break-words">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="rounded-md border border-bad/40 px-2 py-1 text-xs font-medium hover:bg-bad/10">
          Retry
        </button>
      )}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "ok"; children: ReactNode }) {
  const cls = { info: "border-info/30 bg-info/10", warn: "border-warn/40 bg-warn/10", ok: "border-ok/30 bg-ok/10" }[tone];
  return <div className={`rounded-lg border px-3 py-2 text-sm text-fg ${cls}`}>{children}</div>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-dim" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-line border-t-info" aria-hidden />
      {label}
    </div>
  );
}

/** Loading / error / content switch for a single resource. */
export function Resource<T>({
  state,
  children,
}: {
  state: { data: T | undefined; error: string | null; loading: boolean; reload: () => void };
  children: (data: T) => ReactNode;
}) {
  if (state.data === undefined) {
    if (state.error) return <ErrorNote message={state.error} onRetry={state.reload} />;
    return <Loading />;
  }
  return (
    <>
      {state.error && (
        <div className="mb-3">
          <ErrorNote message={`Refresh failed: ${state.error}`} onRetry={state.reload} />
        </div>
      )}
      {children(state.data)}
    </>
  );
}

export function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-dim">{k}</dt>
          <dd className="num min-w-0 break-words text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
