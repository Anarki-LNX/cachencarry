import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pin, PinOff, Search, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { api, type BlobQuery } from "../api/client";
import type { CacheEntry, Usage } from "../api/types";
import { Badge, Card, EmptyState, KpiCard, PageHeader, ProgressBar, Resource } from "../components/Card";
import { Button, Field, IconButton, Input, Select } from "../components/Controls";
import { MaintenanceReport } from "../components/MaintenanceReport";
import { ConfirmDialog } from "../components/Modal";
import { StorageBar } from "../components/StorageBar";
import { Table, Td, Th, Tr } from "../components/Table";
import { useT } from "../i18n";
import { absoluteTime, formatBytes, formatNumber, relativeTime, shortHash } from "../lib/format";
import { useApi } from "../lib/useApi";
import { useToast } from "../state/toast";

const PAGE = 50;

function UsageCards({ usage: u }: { usage: Usage }) {
  const { t } = useT();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label={t("storage.onDisk")} value={formatBytes(u.blob_bytes)} sub={t("storage.uniqueBlobs", { count: u.blob_count })} />
      <KpiCard label={t("storage.cachedObjects")} value={formatNumber(u.entry_count)} sub={t("storage.logicalSize", { bytes: formatBytes(u.logical_bytes) })} />
      <KpiCard label={t("common.dedupSavings")} value={formatBytes(u.dedup_saved)} sub={t("storage.dedupSub")} />
      <KpiCard label={t("storage.pinned")} value={formatNumber(u.pinned_count)} sub={t("storage.pinnedSub")} />
    </div>
  );
}

function ModuleBreakdown({ usage }: { usage: Usage }) {
  const { t } = useT();
  const mods = [...(usage.modules ?? [])].sort((a, b) => b.logical_bytes - a.logical_bytes);
  if (mods.length === 0) return <EmptyState title={t("storage.nothingCached")} hint={t("storage.emptyHint")} />;
  const max = Math.max(1, ...mods.map((m) => m.logical_bytes));
  return (
    <ul className="space-y-3">
      {mods.map((m) => (
        <li key={m.module}>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{m.module}</span>
            <span className="num text-xs text-muted">
              {t("storage.moduleLine", { bytes: formatBytes(m.logical_bytes), count: m.entries })}
              {m.pinned > 0 ? ` · ${t("storage.pinnedCount", { count: m.pinned })}` : ""}
            </span>
          </div>
          <ProgressBar value={m.logical_bytes / max} tone="info" label={t("storage.moduleShare", { module: m.module })} />
        </li>
      ))}
    </ul>
  );
}

function ObjectBrowser({ modules, onChanged }: { modules: string[]; onChanged: () => void }) {
  const toast = useToast();
  const { t } = useT();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [module, setModule] = useState("");
  const [pinned, setPinned] = useState(false);
  const [sort, setSort] = useState<NonNullable<BlobQuery["sort"]>>("recent");
  const [offset, setOffset] = useState(0);
  const [deleting, setDeleting] = useState<CacheEntry | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setQ(search.trim());
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const blobs = useApi(() => api.blobs({ q, module, pinned, sort, limit: PAGE, offset }), [q, module, pinned, sort, offset]);
  const entries = blobs.data?.entries ?? [];
  const total = blobs.data?.total ?? 0;

  // Deleting the last row of the last page would otherwise leave an empty page.
  useEffect(() => {
    if (blobs.data && offset > 0 && offset >= total) setOffset(Math.max(0, Math.floor((total - 1) / PAGE) * PAGE));
  }, [blobs.data, offset, total]);

  const togglePin = async (e: CacheEntry) => {
    setBusyId(e.id);
    try {
      await api.pinEntry(e.id, !e.pinned);
      toast.success(e.pinned ? t("storage.unpinnedToast") : t("storage.pinnedToast"));
      await blobs.reload();
      onChanged();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await api.deleteEntry(deleting.id);
      toast.success(t("storage.removedToast"));
      setDeleting(null);
      await blobs.reload();
      onChanged();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card title={t("storage.cachedObjects")} bodyClassName="p-0">
      <div className="grid items-end gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_12rem_auto]">
        <Field label={t("storage.searchPath")}>
          {(p) => (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-dim" aria-hidden />
              <Input {...p} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("storage.searchPlaceholder")} className="pl-8" spellCheck={false} />
            </div>
          )}
        </Field>
        <Field label={t("common.module")}>
          {(p) => (
            <Select
              {...p}
              value={module}
              onChange={(e) => {
                setModule(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">{t("common.allModules")}</option>
              {modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("storage.sortBy")}>
          {(p) => (
            <Select
              {...p}
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as NonNullable<BlobQuery["sort"]>);
                setOffset(0);
              }}
            >
              <option value="recent">{t("storage.sortRecent")}</option>
              <option value="size">{t("storage.size")}</option>
              <option value="hits">{t("common.hits")}</option>
            </Select>
          )}
        </Field>
        <label className="flex h-9 cursor-pointer items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            className="size-4 accent-(--c-ok)"
            checked={pinned}
            onChange={(e) => {
              setPinned(e.target.checked);
              setOffset(0);
            }}
          />
          {t("storage.pinnedOnly")}
        </label>
      </div>

      <Resource state={blobs}>
        {() =>
          entries.length === 0 ? (
            <EmptyState title={q || module || pinned ? t("storage.noMatch") : t("storage.empty")} hint={q || module || pinned ? undefined : t("storage.emptyHint")} />
          ) : (
            <Table label={t("storage.cachedObjects")}>
              <thead>
                <tr>
                  <Th>{t("common.path")}</Th>
                  <Th>{t("storage.moduleRepo")}</Th>
                  <Th>{t("storage.hash")}</Th>
                  <Th right>{t("storage.size")}</Th>
                  <Th right>{t("common.hits")}</Th>
                  <Th>{t("storage.lastAccess")}</Th>
                  <Th right>{t("common.actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <Tr key={e.id}>
                    <Td mono className="max-w-[26rem]">
                      <span className="flex items-center gap-2">
                        <span className="truncate" title={e.path}>
                          {e.path}
                        </span>
                        {e.pinned && <Badge tone="warn">{t("storage.pinnedBadge")}</Badge>}
                        {e.immutable && <Badge title={t("storage.immutableHint")}>{t("storage.immutableBadge")}</Badge>}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-muted">
                      {e.module}/{e.repo}
                    </Td>
                    <Td mono className="text-dim" title={e.hash}>
                      {shortHash(e.hash)}
                    </Td>
                    <Td right className="whitespace-nowrap">{formatBytes(e.size)}</Td>
                    <Td right>{formatNumber(e.hits)}</Td>
                    <Td className="whitespace-nowrap text-muted" title={absoluteTime(e.last_access)}>
                      {relativeTime(e.last_access)}
                    </Td>
                    <Td right>
                      <span className="inline-flex gap-1">
                        <IconButton tone={e.pinned ? "active" : "default"} disabled={busyId === e.id} label={t(e.pinned ? "storage.unpin" : "storage.pin", { path: e.path })} aria-pressed={e.pinned} onClick={() => void togglePin(e)}>
                          {e.pinned ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
                        </IconButton>
                        <IconButton tone="danger" disabled={busyId === e.id} label={t("storage.deleteEntry", { path: e.path })} onClick={() => setDeleting(e)}>
                          <Trash2 className="size-4" aria-hidden />
                        </IconButton>
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )
        }
      </Resource>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <span className="num text-xs text-dim" aria-live="polite">
          {total === 0 ? t("storage.zeroObjects") : t("storage.pageRange", { from: offset + 1, to: Math.min(offset + PAGE, total), total })}
        </span>
        <span className="inline-flex gap-1">
          <Button size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} icon={<ChevronLeft className="size-3.5" aria-hidden />}>
            {t("storage.previous")}
          </Button>
          <Button size="sm" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>
            {t("storage.next")} <ChevronRight className="size-3.5" aria-hidden />
          </Button>
        </span>
      </div>

      {deleting && (
        <ConfirmDialog title={t("storage.deleteTitle")} confirmLabel={t("storage.deleteConfirm")} busy={busyId === deleting.id} onConfirm={confirmDelete} onClose={() => setDeleting(null)}>
          <p className="break-all font-mono text-xs">{deleting.path}</p>
          <p className="mt-3 text-muted">
            {t("storage.deleteText", { bytes: formatBytes(deleting.size), repo: `${deleting.module}/${deleting.repo}` })}
          </p>
        </ConfirmDialog>
      )}
    </Card>
  );
}

export function Storage() {
  const toast = useToast();
  const { t } = useT();
  const storage = useApi(api.storage, [], 10_000);
  const [gcBusy, setGcBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [browserKey, setBrowserKey] = useState(0);

  const runGC = async () => {
    setGcBusy(true);
    try {
      const r = await api.runGC();
      const freed = (r.gc?.bytes_freed ?? 0) + (r.eviction?.bytes_freed ?? 0);
      toast.success(t("storage.cleanupDone", { blobs: r.gc?.blobs_removed ?? 0, objects: r.eviction?.entries_removed ?? 0, bytes: formatBytes(freed) }));
      if (r.eviction?.unsatisfied) toast.error(t("storage.evictionFailed"));
      await storage.reload();
      setBrowserKey((k) => k + 1);
    } catch (e) {
      toast.error(e);
    } finally {
      setGcBusy(false);
    }
  };

  const runVerify = async () => {
    setVerifyBusy(true);
    try {
      const r = await api.verify();
      if (r.corrupt + r.missing > 0) toast.error(t("storage.verifyFailed", { corrupt: r.corrupt, missing: r.missing, checked: r.checked }));
      else toast.success(t("storage.verifyPassed", { checked: r.checked }));
      await storage.reload();
    } catch (e) {
      toast.error(e);
    } finally {
      setVerifyBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t("nav.storage")}
        description={t("storage.description")}
        actions={
          <>
            <Button icon={<Sparkles className="size-4" aria-hidden />} busy={gcBusy} onClick={runGC}>
              {t("storage.runCleanup")}
            </Button>
            <Button icon={<ShieldCheck className="size-4" aria-hidden />} busy={verifyBusy} onClick={runVerify}>
              {t("storage.verify")}
            </Button>
          </>
        }
      />
      <div className="space-y-3">
        <Resource state={storage}>
          {(data) => (
            <div className="space-y-3">
              <UsageCards usage={data.usage} />
              <div className="grid gap-3 xl:grid-cols-2">
                <Card title={t("storage.utilisation")}>
                  <StorageBar usage={data.usage} />
                  <dl className="num mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    {(
                      [
                        [t("common.cacheLimit"), data.usage.max_size > 0 ? formatBytes(data.usage.max_size) : t("common.unlimited")],
                        [t("storage.diskSize"), formatBytes(data.usage.disk_total)],
                        [t("storage.diskFree"), formatBytes(data.usage.disk_free)],
                        [t("storage.keepFree"), data.usage.min_free > 0 ? formatBytes(data.usage.min_free) : "–"],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-dim">{k}</dt>
                        <dd className="text-sm font-medium text-fg">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
                <Card title={t("storage.byModule")}>
                  <ModuleBreakdown usage={data.usage} />
                </Card>
              </div>
              <Card title={t("common.maintenance")}>
                <MaintenanceReport maintenance={data.maintenance} />
              </Card>
            </div>
          )}
        </Resource>
        <ObjectBrowser key={browserKey} modules={(storage.data?.usage.modules ?? []).map((m) => m.module).sort()} onChanged={() => void storage.reload()} />
      </div>
    </>
  );
}
