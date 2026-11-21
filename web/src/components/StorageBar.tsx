import type { Usage } from "../api/types";
import { useT } from "../i18n";
import { formatBytes, formatPercent } from "../lib/format";
import { ProgressBar } from "./Card";

export interface Utilisation {
  ratio: number;
  used: number;
  limit: number;
  /** What the bar measures against. */
  basis: "cache limit" | "disk";
  known: boolean;
}

/** Against the configured cache limit if there is one, otherwise against the disk. */
export function utilisation(u: Usage): Utilisation {
  if (u.max_size > 0) {
    return { ratio: u.blob_bytes / u.max_size, used: u.blob_bytes, limit: u.max_size, basis: "cache limit", known: true };
  }
  if (u.disk_total > 0) {
    const used = u.disk_total - u.disk_free;
    return { ratio: used / u.disk_total, used, limit: u.disk_total, basis: "disk", known: true };
  }
  return { ratio: 0, used: u.blob_bytes, limit: 0, basis: "disk", known: false };
}

export function StorageBar({ usage }: { usage: Usage }) {
  const { t } = useT();
  const u = utilisation(usage);
  if (!u.known) return <p className="text-xs text-dim">{t("storageBar.unknown")}</p>;
  const tone = u.ratio >= 0.95 ? "bad" : u.ratio >= 0.85 ? "warn" : "ok";
  return (
    <div className="space-y-1.5">
      <ProgressBar value={u.ratio} tone={tone} label={u.basis === "disk" ? t("storageBar.againstDisk") : t("storageBar.againstCacheLimit")} />
      <div className="num flex flex-wrap justify-between gap-x-3 text-xs text-dim">
        <span>
          {t(u.basis === "disk" ? "storageBar.ofDisk" : "storageBar.ofCacheLimit", { used: formatBytes(u.used), limit: formatBytes(u.limit) })}
        </span>
        <span>{formatPercent(u.ratio)}</span>
      </div>
    </div>
  );
}
