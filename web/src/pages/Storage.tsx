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
import { absoluteTime, formatBytes, formatNumber, relativeTime, shortHash } from "../lib/format";
import { useApi } from "../lib/useApi";
import { useToast } from "../state/toast";

const PAGE = 50;

function UsageCards({ usage: u }: { usage: Usage }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="On disk" value={formatBytes(u.blob_bytes)} sub={`${formatNumber(u.blob_count)} unique blobs`} />
      <KpiCard label="Cached objects" value={formatNumber(u.entry_count)} sub={`${formatBytes(u.logical_bytes)} logical size`} />
      <KpiCard label="Dedup savings" value={formatBytes(u.dedup_saved)} sub="Identical content stored once" />
      <KpiCard label="Pinned" value={formatNumber(u.pinned_count)} sub="Never evicted" />
    </div>
  );
}

function ModuleBreakdown({ usage }: { usage: Usage }) {
  const mods = [...(usage.modules ?? [])].sort((a, b) => b.logical_bytes - a.logical_bytes);
  if (mods.length === 0) return <EmptyState title="Nothing cached yet" hint="Objects appear here after clients download through the cache." />;
  const max = Math.max(1, ...mods.map((m) => m.logical_bytes));
  return (
    <ul className="space-y-3">
      {mods.map((m) => (
        <li key={m.module}>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{m.module}</span>
            <span className="num text-xs text-muted">
              {formatBytes(m.logical_bytes)} · {formatNumber(m.entries)} objects{m.pinned > 0 ? ` · ${formatNumber(m.pinned)} pinned` : ""}
            </span>
          </div>
          <ProgressBar value={m.logical_bytes / max} tone="info" label={`${m.module} share of cached data`} />
        </li>
      ))}
    </ul>
  );
}

function ObjectBrowser({ modules, onChanged }: { modules: string[]; onChanged: () => void }) {
  const toast = useToast();
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
      toast.success(e.pinned ? "Object unpinned" : "Object pinned — it will not be evicted");
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
      toast.success("Object removed from the cache");
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
    <Card title="Cached objects" bodyClassName="p-0">
      <div className="grid items-end gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_12rem_auto]">
        <Field label="Search path">
          {(p) => (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-dim" aria-hidden />
              <Input {...p} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. linux-firmware" className="pl-8" spellCheck={false} />
            </div>
          )}
        </Field>
        <Field label="Module">
          {(p) => (
            <Select
              {...p}
              value={module}
              onChange={(e) => {
                setModule(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">All modules</option>
              {modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Sort by">
          {(p) => (
            <Select
              {...p}
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as NonNullable<BlobQuery["sort"]>);
                setOffset(0);
              }}
            >
              <option value="recent">Recently used</option>
              <option value="size">Size</option>
              <option value="hits">Hits</option>
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
          Pinned only
        </label>
      </div>

      <Resource state={blobs}>
        {() =>
          entries.length === 0 ? (
            <EmptyState title={q || module || pinned ? "No objects match these filters" : "The cache is empty"} hint={q || module || pinned ? undefined : "Objects appear here after clients download through the cache."} />
          ) : (
            <Table label="Cached objects">
              <thead>
                <tr>
                  <Th>Path</Th>
                  <Th>Module / repo</Th>
                  <Th>Hash</Th>
                  <Th right>Size</Th>
                  <Th right>Hits</Th>
                  <Th>Last access</Th>
                  <Th right>Actions</Th>
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
                        {e.pinned && <Badge tone="warn">pinned</Badge>}
                        {e.immutable && <Badge title="Immutable: never revalidated against upstream">immutable</Badge>}
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
                        <IconButton tone={e.pinned ? "active" : "default"} disabled={busyId === e.id} label={e.pinned ? `Unpin ${e.path}` : `Pin ${e.path}`} aria-pressed={e.pinned} onClick={() => void togglePin(e)}>
                          {e.pinned ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
                        </IconButton>
                        <IconButton tone="danger" disabled={busyId === e.id} label={`Delete ${e.path} from the cache`} onClick={() => setDeleting(e)}>
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
          {total === 0 ? "0 objects" : `${formatNumber(offset + 1)}–${formatNumber(Math.min(offset + PAGE, total))} of ${formatNumber(total)} objects`}
        </span>
        <span className="inline-flex gap-1">
          <Button size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} icon={<ChevronLeft className="size-3.5" aria-hidden />}>
            Previous
          </Button>
          <Button size="sm" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>
            Next <ChevronRight className="size-3.5" aria-hidden />
          </Button>
        </span>
      </div>

      {deleting && (
        <ConfirmDialog title="Delete cached object?" confirmLabel="Delete object" busy={busyId === deleting.id} onConfirm={confirmDelete} onClose={() => setDeleting(null)}>
          <p className="break-all font-mono text-xs">{deleting.path}</p>
          <p className="mt-3 text-muted">
            {formatBytes(deleting.size)} in {deleting.module}/{deleting.repo}. The next client that asks for it downloads it from upstream again.
          </p>
        </ConfirmDialog>
      )}
    </Card>
  );
}

export function Storage() {
  const toast = useToast();
  const storage = useApi(api.storage, [], 10_000);
  const [gcBusy, setGcBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [browserKey, setBrowserKey] = useState(0);

  const runGC = async () => {
    setGcBusy(true);
    try {
      const r = await api.runGC();
      const freed = (r.gc?.bytes_freed ?? 0) + (r.eviction?.bytes_freed ?? 0);
      toast.success(`Cleanup finished: ${formatNumber(r.gc?.blobs_removed ?? 0)} blobs and ${formatNumber(r.eviction?.entries_removed ?? 0)} objects removed, ${formatBytes(freed)} freed`);
      if (r.eviction?.unsatisfied) toast.error("Eviction could not free enough space");
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
      if (r.corrupt + r.missing > 0) toast.error(`Integrity check: ${r.corrupt} corrupt and ${r.missing} missing of ${r.checked} blobs`);
      else toast.success(`Integrity check passed: ${formatNumber(r.checked)} blobs verified`);
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
        title="Storage"
        description="What is on disk, how it is maintained, and every cached object."
        actions={
          <>
            <Button icon={<Sparkles className="size-4" aria-hidden />} busy={gcBusy} onClick={runGC}>
              Run cleanup now
            </Button>
            <Button icon={<ShieldCheck className="size-4" aria-hidden />} busy={verifyBusy} onClick={runVerify}>
              Verify integrity
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
                <Card title="Utilisation">
                  <StorageBar usage={data.usage} />
                  <dl className="num mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    {(
                      [
                        ["Cache limit", data.usage.max_size > 0 ? formatBytes(data.usage.max_size) : "unlimited"],
                        ["Disk size", formatBytes(data.usage.disk_total)],
                        ["Disk free", formatBytes(data.usage.disk_free)],
                        ["Keep free", data.usage.min_free > 0 ? formatBytes(data.usage.min_free) : "–"],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-dim">{k}</dt>
                        <dd className="text-sm font-medium text-fg">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
                <Card title="By module">
                  <ModuleBreakdown usage={data.usage} />
                </Card>
              </div>
              <Card title="Maintenance">
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
