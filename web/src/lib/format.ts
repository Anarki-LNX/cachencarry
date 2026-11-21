import { locale, numberFormat, translate } from "../i18n/core";

/*
 * These helpers read the active language from the i18n module, so call sites do
 * not pass it. Components re-render on a language change through useT().
 */

const UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];

/** Fixed number of decimals in the active language ("4.43" / "4,43"). */
function fixed(v: number, digits: number): string {
  return numberFormat({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
}

export function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "–";
  let v = Math.abs(n);
  let i = 0;
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = i === 0 ? 0 : v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${n < 0 ? "-" : ""}${fixed(v, digits)} ${UNITS[i]}`;
}

export function formatRate(bytesPerSecond: number | null | undefined): string {
  if (bytesPerSecond === null || bytesPerSecond === undefined || !isFinite(bytesPerSecond)) return "–";
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "–";
  return numberFormat().format(n);
}

export function formatCompact(n: number): string {
  if (Math.abs(n) < 1000) return numberFormat({ maximumFractionDigits: 1 }).format(n);
  const units = ["k", "M", "G", "T"];
  let v = n;
  let i = -1;
  while (Math.abs(v) >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${fixed(v, Math.abs(v) >= 100 ? 0 : 1)}${units[i]}`;
}

export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || !isFinite(ratio)) return "–";
  return numberFormat({ style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(ratio);
}

const secondsText = (n: number) => translate("format.seconds", { n });
const minutesText = (n: number) => translate("format.minutes", { n });
const hoursText = (n: number) => translate("format.hours", { n });
const daysText = (n: number) => translate("format.days", { n, count: n });

/** Human duration from seconds: "45 s", "12 min", "3 h 5 min", "2 d 4 h" (German: "2 Tage 4 h"). */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !isFinite(seconds)) return "–";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return secondsText(s);
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${minutesText(m)} ${secondsText(s % 60)}` : minutesText(m);
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${hoursText(h)} ${minutesText(m % 60)}` : hoursText(h);
  const d = Math.floor(h / 24);
  return h % 24 ? `${daysText(d)} ${hoursText(h % 24)}` : daysText(d);
}

export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !isFinite(ms)) return "–";
  if (ms < 1000) return `${numberFormat().format(Math.round(ms))} ms`;
  if (ms < 60_000) return translate("format.seconds", { n: fixed(ms / 1000, ms < 10_000 ? 2 : 1) });
  return formatDuration(ms / 1000);
}

/** The Go zero time ("0001-01-01T00:00:00Z") means "never". */
export function isZeroTime(iso: string | null | undefined): boolean {
  if (!iso) return true;
  return iso.startsWith("0001-01-01");
}

export function toDate(v: string | number | null | undefined): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v > 0 ? new Date(v * 1000) : null;
  if (isZeroTime(v)) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function relativeTime(v: string | number | null | undefined, now: number = Date.now()): string {
  const d = toDate(v);
  if (!d) return translate("format.never");
  const diff = Math.round((now - d.getTime()) / 1000);
  if (diff < 5) return translate("format.justNow");
  if (diff < 60) return translate("format.secondsAgo", { n: diff });
  if (diff < 3600) return translate("format.minutesAgo", { n: Math.floor(diff / 60) });
  if (diff < 86400) return translate("format.hoursAgo", { n: Math.floor(diff / 3600) });
  if (diff < 86400 * 30) {
    const days = Math.floor(diff / 86400);
    return translate("format.daysAgo", { n: days, count: days });
  }
  return d.toLocaleDateString(locale());
}

export function absoluteTime(v: string | number | null | undefined): string {
  const d = toDate(v);
  return d ? d.toLocaleString(locale()) : translate("format.never");
}

export function clockTime(v: string | number | null | undefined): string {
  const d = toDate(v);
  if (!d) return "–";
  return d.toLocaleTimeString(locale(), { hour12: false });
}

export function requestsOf(c: { hits: number; misses: number; revalidated: number; errors: number }): number {
  return c.hits + c.misses + c.revalidated + c.errors;
}

export function shortHash(h: string): string {
  const raw = h.includes(":") ? h.slice(h.indexOf(":") + 1) : h;
  return raw.slice(0, 12);
}
