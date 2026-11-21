import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export const COLORS = {
  ok: "var(--c-ok)",
  info: "var(--c-info)",
  warn: "var(--c-warn)",
  bad: "var(--c-bad)",
  alt: "var(--c-alt)",
  dim: "var(--c-dim)",
};

export function RingGauge({
  value,
  size = 120,
  stroke = 10,
  label,
  empty = false,
  children,
}: {
  /** 0..1 */
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  empty?: boolean;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, isFinite(value) ? value : 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-raised)" strokeWidth={stroke} />
        {!empty && v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={COLORS.ok}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * v} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dasharray 0.5s ease" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Sparkline({
  values,
  color = COLORS.ok,
  width = 96,
  height = 24,
  label,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  label: string;
}) {
  const max = Math.max(0, ...values);
  if (values.length < 2 || max <= 0) {
    return (
      <svg width={width} height={height} role="img" aria-label={`${label}: no activity`}>
        <line x1={0} x2={width} y1={height - 1} y2={height - 1} stroke="var(--c-line)" strokeWidth={1} />
      </svg>
    );
  }
  const step = width / (values.length - 1);
  const y = (v: number) => height - 1 - (v / max) * (height - 3);
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return (
    <svg width={width} height={height} role="img" aria-label={label}>
      <path d={`${line}L${width},${height}L0,${height}Z`} fill={color} opacity={0.15} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.25} strokeLinejoin="round" />
    </svg>
  );
}

export interface Series {
  key: string;
  label: string;
  color: string;
  values: number[];
}

function niceMax(v: number, binary: boolean): number {
  if (!(v > 0)) return binary ? 1024 : 4;
  if (binary) {
    let p = 1;
    while (p < v) p *= 2;
    return p;
  }
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / exp;
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 4 ? 4 : m <= 5 ? 5 : m <= 8 ? 8 : 10;
  return Math.max(4, nice * exp);
}

function useWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.floor(e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export function Legend({ series }: { series: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {series.map((s) => (
        <li key={s.label} className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-sm" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Time-series chart drawn as plain SVG. kind="area" overlays the series as
 * lines with a soft fill; kind="bars" stacks them per bucket.
 */
export function TimeChart({
  xs,
  series,
  kind,
  height = 200,
  formatY,
  formatX,
  binary = false,
  label,
}: {
  xs: number[];
  series: Series[];
  kind: "area" | "bars";
  height?: number;
  formatY: (v: number) => string;
  formatX: (t: number) => string;
  /** Scale the axis in powers of two (byte values). */
  binary?: boolean;
  label: string;
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const n = xs.length;
  const m = { l: 62, r: 8, t: 8, b: 20 };
  const iw = Math.max(0, width - m.l - m.r);
  const ih = height - m.t - m.b;

  const max = useMemo(() => {
    let peak = 0;
    for (let i = 0; i < n; i++) {
      if (kind === "bars") {
        let sum = 0;
        for (const s of series) sum += s.values[i] ?? 0;
        peak = Math.max(peak, sum);
      } else {
        for (const s of series) peak = Math.max(peak, s.values[i] ?? 0);
      }
    }
    return niceMax(peak, binary);
  }, [series, n, kind, binary]);

  const y = (v: number) => m.t + ih - (v / max) * ih;
  const slot = n > 0 ? iw / (kind === "bars" ? n : Math.max(1, n - 1)) : 0;
  const xAt = (i: number) => (kind === "bars" ? m.l + slot * (i + 0.5) : m.l + slot * i);
  const ticks = [0, 0.5, 1];
  const xLabelIdx = n > 1 ? Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1])) : n === 1 ? [0] : [];

  const onMove = (clientX: number, target: Element) => {
    if (n === 0 || iw <= 0) return;
    const rect = target.getBoundingClientRect();
    const px = clientX - rect.left - m.l;
    const i = kind === "bars" ? Math.floor(px / slot) : Math.round(px / slot);
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const hi = hover !== null && hover < n ? hover : null;
  const tipLeft = hi !== null ? Math.max(70, Math.min(width - 70, xAt(hi))) : 0;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          onMouseMove={(e) => onMove(e.clientX, e.currentTarget)}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => onMove(e.touches[0].clientX, e.currentTarget)}
          onTouchMove={(e) => onMove(e.touches[0].clientX, e.currentTarget)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={width - m.r} y1={y(max * t)} y2={y(max * t)} stroke="var(--c-line)" strokeWidth={1} strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={m.l - 8} y={y(max * t) + 3.5} textAnchor="end" fontSize={10} fill="var(--c-dim)">
                {formatY(max * t)}
              </text>
            </g>
          ))}
          {xLabelIdx.map((i, k) => (
            <text
              key={i}
              x={xAt(i)}
              y={height - 5}
              fontSize={10}
              fill="var(--c-dim)"
              textAnchor={k === 0 ? "start" : k === xLabelIdx.length - 1 ? "end" : "middle"}
            >
              {formatX(xs[i])}
            </text>
          ))}

          {kind === "bars" &&
            xs.map((t, i) => {
              let acc = 0;
              const bw = Math.max(1, slot - (slot > 4 ? 2 : 0));
              return (
                <g key={t} opacity={hi === null || hi === i ? 1 : 0.55}>
                  {series.map((s) => {
                    const v = s.values[i] ?? 0;
                    if (v <= 0) return null;
                    const y1 = y(acc + v);
                    const h = y(acc) - y1;
                    acc += v;
                    return <rect key={s.key} x={m.l + slot * i + (slot - bw) / 2} y={y1} width={bw} height={Math.max(h, 0.5)} fill={s.color} rx={bw > 6 ? 1.5 : 0} />;
                  })}
                </g>
              );
            })}

          {kind === "area" &&
            n > 1 &&
            series.map((s) => {
              const line = s.values.slice(0, n).map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
              return (
                <g key={s.key}>
                  <path d={`${line}L${xAt(n - 1).toFixed(1)},${y(0)}L${xAt(0).toFixed(1)},${y(0)}Z`} fill={s.color} opacity={0.12} />
                  <path d={line} fill="none" stroke={s.color} strokeWidth={1.5} strokeLinejoin="round" />
                </g>
              );
            })}

          {hi !== null && kind === "area" && (
            <g>
              <line x1={xAt(hi)} x2={xAt(hi)} y1={m.t} y2={m.t + ih} stroke="var(--c-dim)" strokeWidth={1} />
              {series.map((s) => (
                <circle key={s.key} cx={xAt(hi)} cy={y(s.values[hi] ?? 0)} r={3} fill={s.color} stroke="var(--c-panel)" strokeWidth={1.5} />
              ))}
            </g>
          )}
        </svg>
      )}
      {hi !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-raised px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: tipLeft }}
        >
          <div className="mb-1 text-dim">{formatX(xs[hi])}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="inline-block size-2 rounded-sm" style={{ background: s.color }} aria-hidden />
                {s.label}
              </span>
              <span className="num font-medium text-fg">{formatY(s.values[hi] ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
