import type { Usage } from "../api/types";
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
  const u = utilisation(usage);
  if (!u.known) return <p className="text-xs text-dim">Disk size unknown — no limit configured.</p>;
  const tone = u.ratio >= 0.95 ? "bad" : u.ratio >= 0.85 ? "warn" : "ok";
  return (
    <div className="space-y-1.5">
      <ProgressBar value={u.ratio} tone={tone} label={`Storage utilisation against ${u.basis}`} />
      <div className="num flex flex-wrap justify-between gap-x-3 text-xs text-dim">
        <span>
          {formatBytes(u.used)} of {formatBytes(u.limit)} {u.basis === "disk" ? "disk used" : "cache limit"}
        </span>
        <span>{formatPercent(u.ratio)}</span>
      </div>
    </div>
  );
}
