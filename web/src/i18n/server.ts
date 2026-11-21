import type { ModuleInfo } from "../api/types";
import { getLang, isKey, numberFormat, translate } from "./core";

/**
 * Texts the server sends in English only. They are translated here by a stable
 * identifier (module name, check name, state) or by matching the message, and
 * fall back to the server text for anything unknown.
 */

function lookup(key: string, fallback: string): string {
  return isKey(key) ? translate(key) : fallback;
}

/** Adapter description by module name. */
export function adapterDescription(info: ModuleInfo): string {
  return lookup(`adapter.${info.name}.description`, info.description);
}

/** Adapter hint about what an upstream URL must point to, by module name. */
export function adapterRepoHint(info: ModuleInfo | undefined): string {
  if (!info) return "";
  return lookup(`adapter.${info.name}.repoHint`, info.repo_hint);
}

export function maturityLabel(maturity: string): string {
  return lookup(`maturity.${maturity}`, maturity);
}

export function downloadStateLabel(state: string): string {
  return lookup(`downloads.state.${state}`, state);
}

export function evictionReasonLabel(reason: string): string {
  return lookup(`maintenance.reason.${reason}`, reason);
}

/** Explanation of a result code. The code itself (HIT, MISS, ...) is never translated. */
export function resultHint(result: string): string | undefined {
  const key = `result.${result}`;
  return isKey(key) ? translate(key) : undefined;
}

export function healthCheckName(name: string): string {
  return lookup(`health.check.${name}`, name.replace(/_/g, " "));
}

const FREE_SPACE_DETAIL = /^(\d+(?:\.\d+)?) GiB free, minimum (\d+(?:\.\d+)?) GiB$/;

export function healthCheckDetail(detail: string): string {
  const m = FREE_SPACE_DETAIL.exec(detail);
  if (!m) return detail;
  const gib = (v: string) => numberFormat({ minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(v));
  return translate("health.freeSpaceDetail", { free: gib(m[1]), min: gib(m[2]) });
}

/** Frequent API error messages (`{"error": "..."}`), matched exactly or by prefix. */
const ERRORS_DE: { match: string; prefix?: boolean; de: string | ((message: string) => string) }[] = [
  { match: "invalid user name or password", de: "Benutzername oder Passwort ist falsch" },
  { match: "too many login attempts", prefix: true, de: "Zu viele Anmeldeversuche. Später erneut versuchen." },
  { match: "too many attempts", prefix: true, de: "Zu viele Versuche. Später erneut versuchen." },
  { match: "too many requests", de: "Zu viele Anfragen" },
  { match: "invalid setup token", de: "Das Setup-Token ist ungültig" },
  { match: "setup has already been completed", de: "Die Einrichtung wurde bereits abgeschlossen" },
  {
    match: "password must have at least",
    prefix: true,
    de: (message) => `Das Passwort muss mindestens ${/\d+/.exec(message)?.[0] ?? "10"} Zeichen haben`,
  },
  { match: "current password is wrong", de: "Das aktuelle Passwort ist falsch" },
  { match: "authentication required", de: "Anmeldung erforderlich" },
  { match: "missing or invalid CSRF token", de: "CSRF-Token fehlt oder ist ungültig" },
  { match: "a repository with this name already exists in the module", de: "In diesem Modul gibt es bereits ein Repository mit diesem Namen" },
  { match: "management access is not allowed from this address", de: "Verwaltungszugriff ist von dieser Adresse nicht erlaubt" },
  { match: "unknown module", de: "Unbekanntes Modul" },
  { match: "repository not found", de: "Repository nicht gefunden" },
  { match: "entry not found", de: "Eintrag nicht gefunden" },
  { match: "download not found", de: "Download nicht gefunden" },
  { match: "internal error", de: "Interner Fehler" },
];

/** Server error message in the active language, or unchanged if it is not in the table. */
export function serverError(message: string): string {
  if (getLang() !== "de") return message;
  const hit = ERRORS_DE.find((e) => (e.prefix ? message.startsWith(e.match) : message === e.match));
  if (!hit) return message;
  return typeof hit.de === "string" ? hit.de : hit.de(message);
}
