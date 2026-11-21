import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import type { RequestRecord } from "../api/types";
import { Badge, Card, EmptyState, PageHeader } from "../components/Card";
import { Button, Field, Input, Select } from "../components/Controls";
import { RESULTS, ResultBadge } from "../components/ResultBadge";
import { Table, Td, Th, Tr } from "../components/Table";
import { clockTime, formatBytes, formatMs, formatRate } from "../lib/format";
import { useLive } from "../state/live";

function speed(r: RequestRecord): string {
  if (r.bytes <= 0 || r.duration_ms <= 0) return "–";
  return formatRate((r.bytes * 1000) / r.duration_ms);
}

export function Traffic() {
  const liveRequests = useLive((s) => s.requests);
  const [paused, setPaused] = useState(false);
  const frozen = useRef<RequestRecord[]>(liveRequests);
  if (!paused) frozen.current = liveRequests;
  const requests = paused ? frozen.current : liveRequests;
  const missed = paused ? liveRequests.filter((r) => r.id > (frozen.current[0]?.id ?? 0)).length : 0;

  const [module, setModule] = useState("");
  const [client, setClient] = useState("");
  const [result, setResult] = useState("");

  const modules = useMemo(() => Array.from(new Set(liveRequests.map((r) => r.module).filter(Boolean))).sort(), [liveRequests]);
  // Keep a selected module in the list even after its rows scrolled out.
  const moduleOptions = module && !modules.includes(module) ? [...modules, module] : modules;

  const rows = useMemo(() => {
    const c = client.trim().toLowerCase();
    return requests.filter((r) => (!module || r.module === module) && (!result || r.result === result) && (!c || r.client.toLowerCase().includes(c)));
  }, [requests, module, client, result]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === " " && t && !/^(INPUT|SELECT|TEXTAREA|BUTTON|A|SUMMARY)$/.test(t.tagName)) {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <PageHeader
        title="Live Traffic"
        description="Every client request as it finishes. The newest 500 are kept in the browser."
        actions={
          <>
            {paused && missed > 0 && <Badge tone="warn">{missed} new while paused</Badge>}
            <Button
              icon={paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
              aria-pressed={paused}
              onClick={() => setPaused(!paused)}
              title="Space bar toggles pause"
            >
              {paused ? "Resume" : "Pause"}
            </Button>
          </>
        }
      />
      <Card bodyClassName="p-0">
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-3">
          <Field label="Module">
            {(p) => (
              <Select {...p} value={module} onChange={(e) => setModule(e.target.value)}>
                <option value="">All modules</option>
                {moduleOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Client">
            {(p) => <Input {...p} value={client} onChange={(e) => setClient(e.target.value)} placeholder="IP address contains…" spellCheck={false} />}
          </Field>
          <Field label="Result">
            {(p) => (
              <Select {...p} value={result} onChange={(e) => setResult(e.target.value)}>
                <option value="">All results</option>
                {RESULTS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title={requests.length === 0 ? "No requests yet" : "No requests match these filters"}
            hint={requests.length === 0 ? "Point a client at the cache — requests appear here the moment they finish." : undefined}
          />
        ) : (
          <>
            <Table label="Client requests, newest first">
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Client</Th>
                  <Th>Module</Th>
                  <Th>Repo</Th>
                  <Th>Path</Th>
                  <Th>Result</Th>
                  <Th>Source</Th>
                  <Th right>Bytes</Th>
                  <Th right>Duration</Th>
                  <Th right>Avg speed</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <Td className="num whitespace-nowrap text-xs text-muted" title={new Date(r.time).toLocaleString()}>
                      {clockTime(r.time)}
                    </Td>
                    <Td mono className="whitespace-nowrap">{r.client}</Td>
                    <Td className="whitespace-nowrap">{r.module || "–"}</Td>
                    <Td className="whitespace-nowrap text-muted">{r.repo || "–"}</Td>
                    <Td mono className="max-w-[28rem]">
                      <span className="block truncate" title={`${r.method} ${r.path}`}>
                        {r.method && r.method !== "GET" ? <span className="text-dim">{r.method} </span> : null}
                        {r.path}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <ResultBadge result={r.result} />
                        {r.status > 0 && <span className="num text-xs text-dim">{r.status}</span>}
                        {r.partial && <Badge title="Range request (partial content)">partial</Badge>}
                      </span>
                    </Td>
                    <Td className={`whitespace-nowrap text-xs ${r.source === "cache" ? "text-ok" : r.source === "upstream" ? "text-info" : "text-dim"}`}>{r.source || "–"}</Td>
                    <Td right className="whitespace-nowrap">{formatBytes(r.bytes)}</Td>
                    <Td right className="whitespace-nowrap">{formatMs(r.duration_ms)}</Td>
                    <Td right className="whitespace-nowrap">{speed(r)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <p className="num px-4 py-2 text-xs text-dim">
              Showing {rows.length} of {requests.length} requests{paused ? " · paused" : ""}
            </p>
          </>
        )}
      </Card>
    </>
  );
}
