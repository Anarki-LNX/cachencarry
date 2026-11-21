import type { ReactNode } from "react";
import { Database, Moon, Sun } from "lucide-react";
import { IconButton } from "../components/Controls";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { useT } from "../i18n";
import { useAuth } from "../state/auth";
import { useTheme } from "../state/theme";

export function AuthShell({ title, subtitle, children, wide }: { title: string; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  const { theme, toggle } = useTheme();
  const { version } = useAuth();
  const { t } = useT();
  return (
    <div className="flex min-h-full flex-col items-center justify-center p-4">
      <div className="absolute right-3 top-3 flex items-center gap-2">
        <LanguageSwitch />
        <IconButton label={theme === "dark" ? t("layout.lightMode") : t("layout.darkMode")} onClick={toggle}>
          {theme === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
        </IconButton>
      </div>
      <main className={`w-full ${wide ? "max-w-lg" : "max-w-sm"}`}>
        <div className="mb-2 flex items-center justify-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-ok/10 text-ok" aria-hidden>
            <Database className="size-5" />
          </span>
          <span className="text-xl font-semibold tracking-tight">Cache & Carry</span>
        </div>
        <p className="mb-6 text-center text-sm text-muted">{t("auth.slogan")}</p>
        <div className="rounded-xl border border-line bg-panel p-5 sm:p-6">
          <h1 className="text-base font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        {version && <p className="num mt-4 text-center text-xs text-dim">Cache & Carry {version}</p>}
      </main>
    </div>
  );
}
