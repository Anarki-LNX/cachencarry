import { AlertTriangle } from "lucide-react";
import type { Maintenance } from "../api/types";
import { useT } from "../i18n";
import { evictionReasonLabel } from "../i18n/server";
import { absoluteTime, formatBytes, formatNumber, isZeroTime, relativeTime } from "../lib/format";

function Item({ title, at, children, warn }: { title: string; at: string; children: React.ReactNode; warn?: string | null }) {
  const { t } = useT();
  const never = isZeroTime(at);
  return (
    <div className="min-w-0 rounded-lg border border-line p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-dim" title={never ? undefined : absoluteTime(at)}>
          {never ? t("maintenance.neverRan") : relativeTime(at)}
        </span>
      </div>
      <div className="num mt-1.5 text-xs text-muted">{never ? t("maintenance.noRun") : children}</div>
      {warn && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-warn" role="alert">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {warn}
        </p>
      )}
    </div>
  );
}

export function MaintenanceReport({ maintenance: m }: { maintenance: Maintenance }) {
  const { t } = useT();
  const bad = m.verify.corrupt + m.verify.missing;
  const evicted = { objects: formatNumber(m.eviction.entries_removed), bytes: formatBytes(m.eviction.bytes_freed) };
  const checked = { checked: formatNumber(m.verify.checked), corrupt: formatNumber(m.verify.corrupt), missing: formatNumber(m.verify.missing) };
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Item title={t("maintenance.gc")} at={m.gc.at}>
        {t("maintenance.gcText", { blobs: formatNumber(m.gc.blobs_removed), bytes: formatBytes(m.gc.bytes_freed) })}
      </Item>
      <Item
        title={t("maintenance.eviction")}
        at={m.eviction.at}
        warn={m.eviction.unsatisfied ? t("maintenance.evictionUnsatisfied") : null}
      >
        {m.eviction.reason
          ? t("maintenance.evictionTextReason", { ...evicted, reason: evictionReasonLabel(m.eviction.reason) })
          : t("maintenance.evictionText", evicted)}
      </Item>
      <Item
        title={t("maintenance.verify")}
        at={m.verify.at}
        warn={bad > 0 ? t("maintenance.verifyWarning", checked) : null}
      >
        {t("maintenance.verifyText", checked)}
      </Item>
    </div>
  );
}
