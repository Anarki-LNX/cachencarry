import { useState } from "react";
import { ArrowDownToLine, X } from "lucide-react";
import { api } from "../api/client";
import type { Download } from "../api/types";
import { Badge, Card, EmptyState, PageHeader, ProgressBar } from "../components/Card";
import { Button } from "../components/Controls";
import { useT } from "../i18n";
import { downloadStateLabel } from "../i18n/server";
import { formatBytes, formatDuration, formatPercent, formatRate, relativeTime } from "../lib/format";
import { useNow } from "../lib/useApi";
import { useLive } from "../state/live";
import { useToast } from "../state/toast";

const stateTone = { queued: "neutral", connecting: "warn", downloading: "info", publishing: "ok" } as const;

function DownloadRow({ d, speed }: { d: Download; speed: number | undefined }) {
  const toast = useToast();
  const { t } = useT();
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  const known = d.total > 0;
  const ratio = known ? d.received / d.total : 0;
  const target = d.url || d.key;
  const eta = known && speed && speed > 0 ? (d.total - d.received) / speed : null;

  const cancel = async () => {
    setBusy(true);
    try {
      await api.cancelDownload(d.id);
      toast.success(t("downloads.cancelled"));
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
            <Badge tone={stateTone[d.state as keyof typeof stateTone] ?? "neutral"}>{downloadStateLabel(d.state)}</Badge>
            <span className="text-sm font-medium">{d.module}</span>
            <span className="text-xs text-dim">
              {t("downloads.waitingClients", { count: d.clients })} · {t("downloads.started", { when: relativeTime(d.started, now) })}
            </span>
          </div>
          <p className="mt-1 break-all font-mono text-xs text-muted">{d.url || d.key}</p>
        </div>
        <Button size="sm" variant="danger" busy={busy} icon={<X className="size-3.5" aria-hidden />} onClick={cancel} aria-label={t("downloads.cancelLabel", { target })}>
          {t("common.cancel")}
        </Button>
      </div>
      <ProgressBar value={ratio} tone="info" indeterminate={!known} label={t("downloads.progressLabel", { target })} />
      <div className="num flex flex-wrap justify-between gap-x-4 text-xs text-dim">
        <span>
          {known
            ? t("downloads.ofTotal", { received: formatBytes(d.received), total: formatBytes(d.total), percent: formatPercent(ratio) })
            : t("downloads.sizeUnknown", { received: formatBytes(d.received) })}
        </span>
        <span>
          {speed === undefined ? t("downloads.measuring") : formatRate(speed)}
          {eta !== null && isFinite(eta) ? ` · ${t("downloads.eta", { duration: formatDuration(eta) })}` : ""}
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
  const { t } = useT();

  return (
    <>
      <PageHeader title={t("nav.downloads")} description={t("downloads.description")} />
      <Card title={t("downloads.title", { count: downloads.length })} bodyClassName="p-0">
        {downloads.length === 0 ? (
          <EmptyState
            icon={<ArrowDownToLine className="size-6" />}
            title={hasTick ? t("downloads.none") : connection === "live" ? t("downloads.waiting") : t("downloads.connecting")}
            hint={hasTick ? t("downloads.noneHint") : undefined}
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
