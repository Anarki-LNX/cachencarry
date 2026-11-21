import { useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, errorMessage } from "../api/client";
import type { Module, Repository } from "../api/types";
import { Card, EmptyState, ErrorNote, Notice, PageHeader, Resource } from "../components/Card";
import { Button, Field, IconButton, Input, Select, Switch, Textarea } from "../components/Controls";
import { ConfirmDialog, Modal } from "../components/Modal";
import { Table, Td, Th, Tr } from "../components/Table";
import { useT, type Translate } from "../i18n";
import { adapterRepoHint } from "../i18n/server";
import { absoluteTime, relativeTime } from "../lib/format";
import { useApi } from "../lib/useApi";
import { useToast } from "../state/toast";

const NAME_RE = /^[a-z0-9._-]+$/;

function parseUpstreams(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Mirrors the server rules so mistakes are caught before the round trip. */
function upstreamError(list: string[], t: Translate): string | null {
  if (list.length === 0) return t("repos.upstreamRequired");
  for (const raw of list) {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      return t("repos.invalidUrl", { url: raw });
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return t("repos.badScheme", { url: raw });
    if (u.username || u.password) return t("repos.hasCredentials", { url: raw });
    if (u.search) return t("repos.hasQuery", { url: raw });
  }
  return null;
}

function AddForm({ modules, onCreated }: { modules: Module[]; onCreated: () => Promise<void> }) {
  const toast = useToast();
  const { t } = useT();
  const [module, setModule] = useState(modules[0]?.info.name ?? "");
  const [name, setName] = useState("");
  const [upstreams, setUpstreams] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const info = modules.find((m) => m.info.name === module)?.info;

  const list = parseUpstreams(upstreams);
  const nameErr = touched && !NAME_RE.test(name) ? t("repos.nameError") : null;
  const upErr = touched ? upstreamError(list, t) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!module || !NAME_RE.test(name) || upstreamError(list, t)) return;
    setBusy(true);
    setError(null);
    try {
      await api.createRepository(module, name, list);
      toast.success(t("repos.added", { repo: `${module}/${name}` }));
      setName("");
      setUpstreams("");
      setTouched(false);
      await onCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <ErrorNote message={error} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("common.module")}>
          {(p) => (
            <Select {...p} value={module} onChange={(e) => setModule(e.target.value)} required>
              {modules.map((m) => (
                <option key={m.info.name} value={m.info.name}>
                  {m.info.title || m.info.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("repos.name")} hint={t("repos.nameHint")} error={nameErr}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value.toLowerCase())} placeholder={t("repos.namePlaceholder")} spellCheck={false} autoCapitalize="none" className="font-mono" required />}
        </Field>
      </div>
      <Field label={t("repos.upstreamUrls")} hint={`${t("repos.upstreamHint")} ${adapterRepoHint(info)}`.trim()} error={upErr}>
        {(p) => <Textarea {...p} value={upstreams} onChange={(e) => setUpstreams(e.target.value)} rows={3} placeholder="https://mirror.example.org/path" spellCheck={false} required />}
      </Field>
      <Button type="submit" variant="primary" busy={busy} icon={<Plus className="size-4" aria-hidden />}>
        {t("repos.add")}
      </Button>
    </form>
  );
}

function EditDialog({ repo, onClose, onSaved }: { repo: Repository; onClose: () => void; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const { t } = useT();
  const [text, setText] = useState((repo.upstreams ?? []).join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = parseUpstreams(text);
  const name = `${repo.module}/${repo.name}`;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const invalid = upstreamError(list, t);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    try {
      await api.updateRepository(repo.id, { upstreams: list });
      toast.success(t("repos.upstreamsUpdated", { repo: name }));
      await onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("repos.editTitle", { repo: name })} onClose={onClose}>
      <form onSubmit={save} className="space-y-4" noValidate>
        <Field label={t("repos.upstreamUrls")} hint={t("repos.upstreamHint")} error={error}>
          {(p) => <Textarea {...p} value={text} onChange={(e) => setText(e.target.value)} rows={5} spellCheck={false} />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" busy={busy}>
            {t("repos.saveUpstreams")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RepoRow({ repo, onChanged, onEdit, onDelete }: { repo: Repository; onChanged: () => Promise<void>; onEdit: () => void; onDelete: () => void }) {
  const toast = useToast();
  const { t } = useT();
  const name = `${repo.module}/${repo.name}`;
  const [busy, setBusy] = useState(false);
  const toggle = async (next: boolean) => {
    setBusy(true);
    try {
      await api.updateRepository(repo.id, { enabled: next });
      toast.success(t(next ? "repos.enabledToast" : "repos.disabledToast", { repo: name }));
      await onChanged();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Tr>
      <Td className="font-medium">{repo.name}</Td>
      <Td mono>
        {(repo.upstreams ?? []).map((u) => (
          <span key={u} className="block break-all">
            {u}
          </span>
        ))}
      </Td>
      <Td className="whitespace-nowrap text-muted" title={absoluteTime(repo.created_at)}>
        {relativeTime(repo.created_at)}
      </Td>
      <Td>
        <Switch checked={repo.enabled} disabled={busy} onChange={toggle} label={t(repo.enabled ? "repos.disable" : "repos.enable", { repo: name })} />
      </Td>
      <Td right>
        <span className="inline-flex gap-1">
          <IconButton label={t("repos.editUpstreams", { repo: name })} onClick={onEdit}>
            <Pencil className="size-4" aria-hidden />
          </IconButton>
          <IconButton tone="danger" label={t("repos.delete", { repo: name })} onClick={onDelete}>
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
        </span>
      </Td>
    </Tr>
  );
}

export function Repositories() {
  const toast = useToast();
  const { t, rich } = useT();
  const repos = useApi(api.repositories, [], 30_000);
  const modules = useApi(api.modules, []);
  const [editing, setEditing] = useState<Repository | null>(null);
  const [deleting, setDeleting] = useState<Repository | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const moduleList = useMemo(() => modules.data?.modules ?? [], [modules.data]);
  const titles = useMemo(() => new Map(moduleList.map((m) => [m.info.name, m.info.title || m.info.name])), [moduleList]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await api.deleteRepository(deleting.id);
      toast.success(t("repos.deleted", { repo: `${deleting.module}/${deleting.name}`, count: res?.entries_released ?? 0 }));
      setDeleting(null);
      await repos.reload();
    } catch (e) {
      toast.error(e);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={t("nav.repositories")} description={t("repos.description")} />
      <div className="space-y-3">
        <Resource state={repos}>
          {(data) => {
            const list = data.repositories ?? [];
            if (list.length === 0) {
              return (
                <Card>
                  <EmptyState title={t("repos.empty")} hint={t("repos.emptyHint")} />
                </Card>
              );
            }
            const groups = new Map<string, Repository[]>();
            for (const r of list) groups.set(r.module, [...(groups.get(r.module) ?? []), r]);
            return (
              <>
                {[...groups.entries()]
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([module, rs]) => (
                    <Card key={module} title={`${titles.get(module) ?? module} · ${rs.length}`} bodyClassName="p-0">
                      <Table label={t("repos.tableLabel", { module: titles.get(module) ?? module })}>
                        <thead>
                          <tr>
                            <Th className="w-40">{t("repos.name")}</Th>
                            <Th>{t("repos.upstreams")}</Th>
                            <Th>{t("repos.created")}</Th>
                            <Th>{t("repos.enabled")}</Th>
                            <Th right>{t("common.actions")}</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {rs
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((r) => (
                              <RepoRow key={r.id} repo={r} onChanged={repos.reload} onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} />
                            ))}
                        </tbody>
                      </Table>
                    </Card>
                  ))}
              </>
            );
          }}
        </Resource>

        <Card title={t("repos.add")}>
          <Resource state={modules}>
            {() => (moduleList.length === 0 ? <EmptyState title={t("repos.noModules")} /> : <AddForm modules={moduleList} onCreated={repos.reload} />)}
          </Resource>
        </Card>
      </div>

      {editing && <EditDialog repo={editing} onClose={() => setEditing(null)} onSaved={repos.reload} />}
      {deleting && (
        <ConfirmDialog title={t("repos.deleteTitle")} confirmLabel={t("repos.deleteConfirm")} busy={deleteBusy} onConfirm={confirmDelete} onClose={() => setDeleting(null)}>
          <p>
            {rich("repos.deleteText", {
              repo: (
                <span className="font-mono font-medium">
                  {deleting.module}/{deleting.name}
                </span>
              ),
            })}
          </p>
          <div className="mt-3">
            <Notice tone="warn">{t("repos.deleteWarning")}</Notice>
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
