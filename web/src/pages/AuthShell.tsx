import type { ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { IconButton } from "../components/Controls";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { LogoMark, Wordmark } from "../components/Logo";
import { Credit } from "../components/Credit";
import { useT } from "../i18n";
import { useAuth } from "../state/auth";
import { useTheme } from "../state/theme";

/** Frame for the sign-in and first-run screens: brand on top, the form in a card below. */
export function AuthShell({ title, subtitle, children, wide }: { title: string; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  const { theme, toggle } = useTheme();
  const { version } = useAuth();
  const { t } = useT();
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-4 py-16">
      {/* A soft glow behind the brand, in the accent colours of the dashboard. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(55%_60%_at_50%_0%,color-mix(in_srgb,var(--c-ok)_13%,transparent),transparent_75%)]"
        aria-hidden
      />
      <div className="absolute right-3 top-3 flex items-center gap-2">
        <LanguageSwitch />
        <IconButton label={theme === "dark" ? t("layout.lightMode") : t("layout.darkMode")} onClick={toggle}>
          {theme === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
        </IconButton>
      </div>

      <main className={`relative w-full ${wide ? "max-w-lg" : "max-w-md"}`}>
        <header className="mb-8 text-center">
          <LogoMark className="mx-auto size-20 text-ok" />
          <p className="mt-4">
            <Wordmark className="text-4xl" />
          </p>
          <p className="mt-4 text-base font-medium text-fg">{t("auth.slogan1")}</p>
          <p className="mt-1 text-sm text-muted">{t("auth.slogan2")}</p>
        </header>

        <div className="rounded-2xl border border-line bg-panel p-6 shadow-xl shadow-black/20 sm:p-8">
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>

        {version && <p className="num mt-6 text-center text-xs text-dim">Cache & Carry {version}</p>}
        <Credit className="mt-2 justify-center" />
      </main>
    </div>
  );
}
