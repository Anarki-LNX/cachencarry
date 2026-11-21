import { useT } from "../i18n";
import { LANGS } from "../i18n/core";

/** Compact EN/DE switch for the top bar and the login and setup screens. */
export function LanguageSwitch() {
  const { lang, setLang, t } = useT();
  return (
    <div role="group" aria-label={t("language.label")} className="inline-flex shrink-0 rounded-lg border border-line bg-bg p-0.5">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === lang}
          aria-label={t(`language.${l}`)}
          title={t(`language.${l}`)}
          onClick={() => setLang(l)}
          className={`h-6 rounded-md px-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
            l === lang ? "bg-raised text-fg" : "text-dim hover:text-fg"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
