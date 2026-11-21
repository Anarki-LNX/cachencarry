import { useState } from "react";
import { ArrowDownToLine, X } from "lucide-react";
import { api } from "../api/client";
import type { Download } from "../api/types";
import { Badge, Card, EmptyState, PageHeader, ProgressBar } from "../components/Card";
import { Button } from "../components/Controls";
import { formatBytes, formatDuration, formatPercent, formatRate, relativeTime } from "../lib/format";
import { useNow } from "../lib/useApi";
import { useLive } from "../state/live";
import { useToast } from "../state/toast";

const stateTone = { queued: "neutral", connecting: "warn", downloading: "info", publishing: "ok" } as const;

function DownloadRow({ d, speed }: { d: Download; speed: number | undefined }) {
  const toast = useToast();
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  const known = d.total > 0;
  const ratio = known ? d.received / d.total : 0;
  const eta = known && speed && speed > 0 ? (d.total - d.received) / speed : null;

  const cancel = async () => {
    setBusy(true);
    try {
      await api.cancelDownload(d.id);
      toast.success("Download cancelled");
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="space-y-2 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={stateTone[d.state as keyof typeof stateTone] ?? "neutral"}>{d.state}</Badge>
            <span className="text-sm font-medium">{d.module}</span>
            <span className="text-xs text-dim">
              {d.clients} waiting client{d.clients === 1 ? "" : "s"} · started {relativeTime(d.started, now)}
            </span>
          </div>
          <p className="mt-1 break-all font-mono text-xs text-muted">{d.url || d.key}</p>
        </div>
        <Button size="sm" variant="danger" busy={busy} icon={<X className="size-3.5" aria-hidden />} onClick={cancel} aria-label={`Cancel download of ${d.url || d.key}`}>
          Cancel
        </Button>
      </div>
      <ProgressBar value={ratio} tone="info" indeterminate={!known} label={`Download progress of ${d.url || d.key}`} />
      <div className="num flex flex-wrap justify-between gap-x-4 text-xs text-dim">
        <span>
          {formatBytes(d.received)}
          {known ? ` of ${formatBytes(d.total)} · ${formatPercent(ratio)}` : " · total size unknown"}
        </span>
        <span>
          {speed === undefined ? "measuring speed…" : formatRate(speed)}
          {eta !== null && isFinite(eta) ? ` · about ${formatDuration(eta)} left` : ""}
        </span>
      </div>
    </li>
  );
}

export function Downloads() {
  const downloads = useLive((s) => s.downloads);
  const speeds = useLive((s) => s.speeds);
  const connection = useLive((s) => s.connection);
  const hasTick = useLive((s) => s.live !== null);

  return (
    <>
      <PageHeader title="Downloads" description="Objects being fetched from upstream right now. Clients asking for the same object share one download." />
      <Card title={`Active downloads · ${downloads.length}`} bodyClassName="p-0">
        {downloads.length === 0 ? (
          <EmptyState
            icon={<ArrowDownToLine className="size-6" />}
            title={hasTick ? "No active downloads" : connection === "live" ? "Waiting for live data…" : "Connecting to the live feed…"}
            hint={hasTick ? "Upstream transfers show up here while a client requests something that is not cached yet." : undefined}
          />
        ) : (
          <ul className="divide-y divide-line/60">
            {downloads.map((d) => (
              <DownloadRow key={String(d.id)} d={d} speed={speeds[String(d.id)]} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
