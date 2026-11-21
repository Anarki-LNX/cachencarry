import { useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, errorMessage } from "../api/client";
import type { Module, Repository } from "../api/types";
import { Card, EmptyState, ErrorNote, Notice, PageHeader, Resource } from "../components/Card";
import { Button, Field, IconButton, Input, Select, Switch, Textarea } from "../components/Controls";
import { ConfirmDialog, Modal } from "../components/Modal";
import { Table, Td, Th, Tr } from "../components/Table";
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
function upstreamError(list: string[]): string | null {
  if (list.length === 0) return "Enter at least one upstream URL.";
  for (const raw of list) {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      return `"${raw}" is not a valid URL.`;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return `"${raw}" must start with http:// or https://.`;
    if (u.username || u.password) return `"${raw}" must not contain credentials.`;
    if (u.search) return `"${raw}" must not contain a query string.`;
  }
  return null;
}

function AddForm({ modules, onCreated }: { modules: Module[]; onCreated: () => Promise<void> }) {
  const toast = useToast();
  const [module, setModule] = useState(modules[0]?.info.name ?? "");
  const [name, setName] = useState("");
  const [upstreams, setUpstreams] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const info = modules.find((m) => m.info.name === module)?.info;

  const list = parseUpstreams(upstreams);
  const nameErr = touched && !NAME_RE.test(name) ? "Use lowercase letters, digits, dot, underscore or dash." : null;
  const upErr = touched ? upstreamError(list) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!module || !NAME_RE.test(name) || upstreamError(list)) return;
    setBusy(true);
    setError(null);
    try {
      await api.createRepository(module, name, list);
      toast.success(`Repository ${module}/${name} added`);
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
        <Field label="Module">
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
        <Field label="Name" hint="Becomes part of the URL clients use, e.g. debian or archlinux." error={nameErr}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value.toLowerCase())} placeholder="my-repo" spellCheck={false} autoCapitalize="none" className="font-mono" required />}
        </Field>
      </div>
      <Field label="Upstream URLs" hint={`One per line; later lines are fallbacks.${info?.repo_hint ? ` ${info.repo_hint}` : ""}`} error={upErr}>
        {(p) => <Textarea {...p} value={upstreams} onChange={(e) => setUpstreams(e.target.value)} rows={3} placeholder="https://mirror.example.org/path" spellCheck={false} required />}
      </Field>
      <Button type="submit" variant="primary" busy={busy} icon={<Plus className="size-4" aria-hidden />}>
        Add repository
      </Button>
    </form>
  );
}

function EditDialog({ repo, onClose, onSaved }: { repo: Repository; onClose: () => void; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [text, setText] = useState((repo.upstreams ?? []).join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = parseUpstreams(text);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const invalid = upstreamError(list);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    try {
      await api.updateRepository(repo.id, { upstreams: list });
      toast.success(`Upstreams of ${repo.module}/${repo.name} updated`);
      await onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Edit upstreams · ${repo.module}/${repo.name}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4" noValidate>
        <Field label="Upstream URLs" hint="One per line; later lines are fallbacks." error={error}>
          {(p) => <Textarea {...p} value={text} onChange={(e) => setText(e.target.value)} rows={5} spellCheck={false} />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" busy={busy}>
            Save upstreams
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RepoRow({ repo, onChanged, onEdit, onDelete }: { repo: Repository; onChanged: () => Promise<void>; onEdit: () => void; onDelete: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const toggle = async (next: boolean) => {
    setBusy(true);
    try {
      await api.updateRepository(repo.id, { enabled: next });
      toast.success(`${repo.module}/${repo.name} ${next ? "enabled" : "disabled"}`);
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
        <Switch checked={repo.enabled} disabled={busy} onChange={toggle} label={`${repo.enabled ? "Disable" : "Enable"} repository ${repo.module}/${repo.name}`} />
      </Td>
      <Td right>
        <span className="inline-flex gap-1">
          <IconButton label={`Edit upstreams of ${repo.module}/${repo.name}`} onClick={onEdit}>
            <Pencil className="size-4" aria-hidden />
          </IconButton>
          <IconButton tone="danger" label={`Delete repository ${repo.module}/${repo.name}`} onClick={onDelete}>
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
        </span>
      </Td>
    </Tr>
  );
}

export function Repositories() {
  const toast = useToast();
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
      toast.success(`Repository ${deleting.module}/${deleting.name} deleted — ${res?.entries_released ?? 0} cached objects released`);
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
      <PageHeader title="Repositories" description="A repository maps a name under a module to one or more upstream mirrors." />
      <div className="space-y-3">
        <Resource state={repos}>
          {(data) => {
            const list = data.repositories ?? [];
            if (list.length === 0) {
              return (
                <Card>
                  <EmptyState title="No repositories yet" hint="Add the first one below." />
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
                      <Table label={`Repositories of ${titles.get(module) ?? module}`}>
                        <thead>
                          <tr>
                            <Th className="w-40">Name</Th>
                            <Th>Upstreams</Th>
                            <Th>Created</Th>
                            <Th>Enabled</Th>
                            <Th right>Actions</Th>
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

        <Card title="Add repository">
          <Resource state={modules}>
            {() => (moduleList.length === 0 ? <EmptyState title="No modules available" /> : <AddForm modules={moduleList} onCreated={repos.reload} />)}
          </Resource>
        </Card>
      </div>

      {editing && <EditDialog repo={editing} onClose={() => setEditing(null)} onSaved={repos.reload} />}
      {deleting && (
        <ConfirmDialog title="Delete repository?" confirmLabel="Delete repository" busy={deleteBusy} onConfirm={confirmDelete} onClose={() => setDeleting(null)}>
          <p>
            <span className="font-mono font-medium">
              {deleting.module}/{deleting.name}
            </span>{" "}
            will be removed and clients using its URL will get errors.
          </p>
          <div className="mt-3">
            <Notice tone="warn">All objects cached for this repository are released and their disk space is reclaimed by the next cleanup. They must be downloaded again if you re-add it.</Notice>
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
