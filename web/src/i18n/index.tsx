import { Fragment, createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { getLang, setCurrentLang, template, translate, type Key, type Lang, type Params } from "./core";

export type { Key, Lang, Params } from "./core";
export type Translate = (key: Key, params?: Params) => string;

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translates a key, filling `{name}` placeholders from `params`. */
  t: Translate;
  /** Like `t`, but placeholders may be React nodes (inline code, links, emphasis). */
  rich: (key: Key, nodes: Record<string, ReactNode>) => ReactNode;
}

const Ctx = createContext<I18n | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getLang);

  const setLang = useCallback((next: Lang) => {
    // Update the module-level language first, so helpers called during the re-render already see it.
    setCurrentLang(next);
    setLangState(next);
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (key, params) => translate(key, params, lang),
      rich: (key, nodes) =>
        template(key, undefined, lang)
          .split(/(\{\w+\})/)
          .map((part, i) => {
            const name = /^\{(\w+)\}$/.exec(part)?.[1];
            return <Fragment key={i}>{name !== undefined && name in nodes ? nodes[name] : part}</Fragment>;
          }),
    }),
    [lang, setLang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Every component with visible text calls this, which also re-renders it when the language changes. */
export function useT(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useT outside LanguageProvider");
  return ctx;
}
