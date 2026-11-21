import { AlertTriangle } from "lucide-react";
import type { Maintenance } from "../api/types";
import { absoluteTime, formatBytes, formatNumber, isZeroTime, relativeTime } from "../lib/format";

function Item({ title, at, children, warn }: { title: string; at: string; children: React.ReactNode; warn?: string | null }) {
  const never = isZeroTime(at);
  return (
    <div className="min-w-0 rounded-lg border border-line p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-dim" title={never ? undefined : absoluteTime(at)}>
          {never ? "never ran" : relativeTime(at)}
        </span>
      </div>
      <div className="num mt-1.5 text-xs text-muted">{never ? "No run recorded since the server started." : children}</div>
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
  const bad = m.verify.corrupt + m.verify.missing;
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Item title="Garbage collection" at={m.gc.at}>
        Removed {formatNumber(m.gc.blobs_removed)} unreferenced blobs, freed {formatBytes(m.gc.bytes_freed)}.
      </Item>
      <Item
        title="Eviction"
        at={m.eviction.at}
        warn={m.eviction.unsatisfied ? "Eviction could not free enough space. Raise the size limit, free disk space or unpin objects." : null}
      >
        Removed {formatNumber(m.eviction.entries_removed)} objects, freed {formatBytes(m.eviction.bytes_freed)}
        {m.eviction.reason ? ` (${m.eviction.reason})` : ""}.
      </Item>
      <Item
        title="Integrity check"
        at={m.verify.at}
        warn={bad > 0 ? `${formatNumber(m.verify.corrupt)} corrupt and ${formatNumber(m.verify.missing)} missing blobs were found; affected objects are downloaded again on next use.` : null}
      >
        Checked {formatNumber(m.verify.checked)} blobs: {formatNumber(m.verify.corrupt)} corrupt, {formatNumber(m.verify.missing)} missing.
      </Item>
    </div>
  );
}
