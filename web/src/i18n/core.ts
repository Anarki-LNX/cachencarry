import { de } from "./de";
import { en } from "./en";

export type Lang = "en" | "de";
export type Key = keyof typeof en;
/** Values for `{name}` placeholders. Numbers are formatted for the language; `count` also selects the plural form. */
export type Params = Record<string, string | number>;

export const LANGS: readonly Lang[] = ["en", "de"];

const STORAGE_KEY = "cachencarry.lang";
const LOCALES: Record<Lang, string> = { en: "en-GB", de: "de-DE" };
const dictionaries: Record<Lang, typeof en> = { en, de };

function detect(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "de") return stored;
  } catch {
    /* storage unavailable */
  }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("de") ? "de" : "en";
}

/**
 * The active language lives at module level so plain helpers (lib/format.ts,
 * the API client) can read it without a hook. LanguageProvider is the only writer.
 */
let current: Lang = detect();
document.documentElement.lang = current;

export function getLang(): Lang {
  return current;
}

export function setCurrentLang(lang: Lang) {
  current = lang;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage unavailable */
  }
}

/** BCP 47 locale for Intl number and date formatting in the active language. */
export function locale(lang: Lang = current): string {
  return LOCALES[lang];
}

export function isKey(key: string): key is Key {
  return Object.prototype.hasOwnProperty.call(en, key);
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const pluralRules = new Map<Lang, Intl.PluralRules>();

/** Cached Intl.NumberFormat for the active language. */
export function numberFormat(options: Intl.NumberFormatOptions = {}, lang: Lang = current): Intl.NumberFormat {
  const id = `${lang}|${JSON.stringify(options)}`;
  let f = numberFormats.get(id);
  if (!f) {
    f = new Intl.NumberFormat(LOCALES[lang], options);
    numberFormats.set(id, f);
  }
  return f;
}

function pluralForm(count: number, lang: Lang): "one" | "other" {
  let rules = pluralRules.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(LOCALES[lang]);
    pluralRules.set(lang, rules);
  }
  return rules.select(count) === "one" ? "one" : "other";
}

/** The raw template for a key, with the plural form resolved. */
export function template(key: Key, params?: Record<string, unknown>, lang: Lang = current): string {
  const entry: string | { one: string; other: string } = dictionaries[lang][key];
  if (typeof entry === "string") return entry;
  const count = params?.count;
  return entry[typeof count === "number" ? pluralForm(count, lang) : "other"];
}

const PLACEHOLDER = /\{(\w+)\}/g;

export function translate(key: Key, params?: Params, lang: Lang = current): string {
  const text = template(key, params, lang);
  if (!params) return text;
  return text.replace(PLACEHOLDER, (match, name: string) => {
    const v = params[name];
    if (v === undefined) return match;
    return typeof v === "number" ? numberFormat({}, lang).format(v) : v;
  });
}
