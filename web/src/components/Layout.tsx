import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  ArrowDownToLine,
  BarChart3,
  Boxes,
  ChevronsLeft,
  ChevronsRight,
  Database,
  FolderGit2,
  HardDrive,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorSmartphone,
  Moon,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  User,
  X,
} from "lucide-react";
import { useT, type Key } from "../i18n";
import { useAuth } from "../state/auth";
import { useLive } from "../state/live";
import { useTheme } from "../state/theme";
import { loadFlag, saveFlag } from "../lib/theme";
import { IconButton } from "./Controls";
import { LanguageSwitch } from "./LanguageSwitch";

export const NAV: { to: string; label: Key; icon: typeof LayoutDashboard }[] = [
  { to: "/", label: "nav.dashboard", icon: LayoutDashboard },
  { to: "/modules", label: "nav.modules", icon: Boxes },
  { to: "/traffic", label: "nav.traffic", icon: Activity },
  { to: "/clients", label: "nav.clients", icon: MonitorSmartphone },
  { to: "/repositories", label: "nav.repositories", icon: FolderGit2 },
  { to: "/storage", label: "nav.storage", icon: HardDrive },
  { to: "/downloads", label: "nav.downloads", icon: ArrowDownToLine },
  { to: "/statistics", label: "nav.statistics", icon: BarChart3 },
  { to: "/policies", label: "nav.policies", icon: ShieldCheck },
  { to: "/settings", label: "nav.settings", icon: SettingsIcon },
  { to: "/health", label: "nav.health", icon: HeartPulse },
];

function LiveIndicator() {
  const { t } = useT();
  const connection = useLive((s) => s.connection);
  const live = connection === "live";
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        live ? "border-ok/30 bg-ok/10 text-ok" : "border-warn/40 bg-warn/10 text-warn"
      }`}
    >
      <span className={`size-1.5 rounded-full ${live ? "bg-ok" : "animate-pulse bg-warn"}`} aria-hidden />
      {live ? t("layout.live") : connection === "connecting" ? t("layout.connecting") : t("layout.reconnecting")}
    </span>
  );
}

function DownloadsCount() {
  const { t } = useT();
  const count = useLive((s) => s.downloads.length);
  if (count === 0) return null;
  return (
    <span className="num ml-auto rounded-full bg-info/15 px-1.5 text-[10px] font-semibold text-info" aria-label={t("layout.activeDownloads", { count })}>
      {count}
    </span>
  );
}

function Sidebar({ expanded, onNavigate }: { expanded: boolean; onNavigate?: () => void }) {
  const { t } = useT();
  return (
    <nav aria-label={t("layout.mainNavigation")} className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
      {NAV.map(({ to, label: labelKey, icon: Icon }) => {
        const label = t(labelKey);
        return (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onNavigate}
            title={expanded ? undefined : label}
            aria-label={expanded ? undefined : label}
            className={({ isActive }) =>
              `flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors ${
                isActive ? "bg-ok/10 font-medium text-ok" : "text-muted hover:bg-raised hover:text-fg"
              } ${expanded ? "" : "justify-center"}`
            }
          >
            <Icon className="size-[18px] shrink-0" aria-hidden />
            {expanded && <span className="truncate">{label}</span>}
            {expanded && to === "/downloads" && <DownloadsCount />}
          </NavLink>
        );
      })}
    </nav>
  );
}

function Brand({ expanded }: { expanded: boolean }) {
  return (
    <div className={`flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-3 ${expanded ? "" : "justify-center"}`}>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ok/10 text-ok" aria-hidden>
        <Database className="size-[18px]" />
      </span>
      {expanded && <span className="text-[15px] font-semibold tracking-tight">Cache & Carry</span>}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, version, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { t } = useT();
  const [expanded, setExpanded] = useState(() => loadFlag("cachencarry.sidebar", true));
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const current = NAV.find((n) => (n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to)));
  const title = current ? t(current.label) : null;
  useEffect(() => {
    document.title = title ? `${title} · Cache & Carry` : "Cache & Carry";
  }, [title]);

  return (
    <div className="flex h-full">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-panel focus:px-3 focus:py-2">
        {t("layout.skipToContent")}
      </a>

      {/* Desktop sidebar */}
      <aside className={`hidden shrink-0 flex-col border-r border-line bg-panel transition-[width] duration-200 md:flex ${expanded ? "w-56" : "w-14"}`}>
        <Brand expanded={expanded} />
        <Sidebar expanded={expanded} />
        <div className={`flex items-center border-t border-line p-2 ${expanded ? "justify-between" : "justify-center"}`}>
          {expanded && <span className="num truncate px-1 text-[11px] text-dim">{version ? (/^\d/.test(version) ? `v${version}` : version) : ""}</span>}
          <IconButton
            label={expanded ? t("layout.collapseSidebar") : t("layout.expandSidebar")}
            aria-expanded={expanded}
            onClick={() => {
              saveFlag("cachencarry.sidebar", !expanded);
              setExpanded(!expanded);
            }}
          >
            {expanded ? <ChevronsLeft className="size-4" aria-hidden /> : <ChevronsRight className="size-4" aria-hidden />}
          </IconButton>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col border-r border-line bg-panel">
            <div className="flex items-center justify-between pr-2">
              <Brand expanded />
              <IconButton label={t("layout.closeNavigation")} onClick={() => setMobileOpen(false)}>
                <X className="size-4" aria-hidden />
              </IconButton>
            </div>
            <Sidebar expanded onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-panel/60 px-3 sm:px-5">
          <IconButton label={t("layout.openNavigation")} className="md:hidden" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
            <Menu className="size-5" aria-hidden />
          </IconButton>
          <span className="truncate text-sm font-medium text-muted md:hidden">{title ?? "Cache & Carry"}</span>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <LiveIndicator />
            <LanguageSwitch />
            <IconButton label={theme === "dark" ? t("layout.lightMode") : t("layout.darkMode")} onClick={toggle}>
              {theme === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
            </IconButton>
            <span className="hidden items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-xs text-muted sm:inline-flex">
              <User className="size-3.5" aria-hidden />
              <span className="max-w-32 truncate">{user}</span>
            </span>
            <IconButton label={t("layout.signOut", { user })} onClick={() => void logout()}>
              <LogOut className="size-4" aria-hidden />
            </IconButton>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto focus:outline-none">
          <div className="mx-auto w-full max-w-[1500px] p-3 sm:p-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
