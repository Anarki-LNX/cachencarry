import { Heart } from "lucide-react";
import { useT } from "../i18n";

/**
 * Credit and voluntary donation link. Plain outbound links: nothing is loaded
 * from PayPal or the author's site, the UI makes no external requests.
 */
export const AUTHOR = { name: "LOOP OUT TECH", url: "https://loopout.tech" } as const;
export const DONATE_URL = "https://www.paypal.me/HenryMeinekat";

const ext = { target: "_blank", rel: "noopener noreferrer" } as const;

/** Donation link with a heart icon. `compact` shows only the icon (collapsed sidebar). */
export function DonateLink({ compact, className = "" }: { compact?: boolean; className?: string }) {
  const { t } = useT();
  return (
    <a
      href={DONATE_URL}
      {...ext}
      aria-label={t("credit.donateLabel")}
      title={compact ? t("credit.donate") : undefined}
      className={`inline-flex items-center gap-1.5 rounded-md text-[11px] text-dim transition-colors hover:text-[#ff5c8a] focus-visible:text-[#ff5c8a] ${
        compact ? "size-8 justify-center" : "px-1 py-0.5"
      } ${className}`}
    >
      <Heart className="size-3.5 shrink-0" aria-hidden />
      {!compact && <span>{t("credit.donate")}</span>}
    </a>
  );
}

/** "A project by LOOP OUT TECH" plus the donation link, for the sidebar foot and the sign-in screen. */
export function Credit({ className = "", stacked }: { className?: string; stacked?: boolean }) {
  const { t } = useT();
  return (
    <div className={`flex text-[11px] text-dim ${stacked ? "flex-col items-start gap-0.5" : "flex-wrap items-center gap-x-2 gap-y-1"} ${className}`}>
      <span>
        {t("credit.by", { author: "" })}
        <a href={AUTHOR.url} {...ext} aria-label={t("credit.authorLabel", { author: AUTHOR.name })} className="underline-offset-2 hover:text-fg hover:underline">
          {AUTHOR.name}
        </a>
      </span>
      {!stacked && <span aria-hidden>·</span>}
      <DonateLink className={stacked ? "-ml-1" : ""} />
    </div>
  );
}
