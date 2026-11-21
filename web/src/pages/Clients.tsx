import { api } from "../api/client";
import { Badge, Card, EmptyState, PageHeader, Resource } from "../components/Card";
import { Table, Td, Th, Tr } from "../components/Table";
import { absoluteTime, formatBytes, formatNumber, formatPercent, relativeTime, toDate } from "../lib/format";
import { useApi, useNow } from "../lib/useApi";

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export function Clients() {
  const clients = useApi(api.clients, [], 10_000);
  const now = useNow(10_000);

  return (
    <>
      <PageHeader title="Clients" description="Machines on your network that have used the cache." />
      <Card bodyClassName="p-0" title={clients.data ? `${formatNumber((clients.data.clients ?? []).length)} clients · ${formatNumber(clients.data.active)} active` : "Clients"}>
        <Resource state={clients}>
          {(data) => {
            const list = [...(data.clients ?? [])].sort((a, b) => (toDate(b.last_seen)?.getTime() ?? 0) - (toDate(a.last_seen)?.getTime() ?? 0));
            if (list.length === 0) return <EmptyState title="No clients yet" hint="A client shows up here after its first request through the cache." />;
            return (
              <Table label="Clients">
                <thead>
                  <tr>
                    <Th>IP address</Th>
                    <Th>Status</Th>
                    <Th right>Requests</Th>
                    <Th right>Hit ratio</Th>
                    <Th right>Data received</Th>
                    <Th>First seen</Th>
                    <Th>Last seen</Th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => {
                    const last = toDate(c.last_seen);
                    const active = last !== null && now - last.getTime() < ACTIVE_WINDOW_MS;
                    return (
                      <Tr key={c.ip}>
                        <Td mono>{c.ip}</Td>
                        <Td>{active ? <Badge tone="ok">active</Badge> : <Badge>idle</Badge>}</Td>
                        <Td right>{formatNumber(c.requests)}</Td>
                        <Td right>{c.requests > 0 ? formatPercent(c.hits / c.requests) : "–"}</Td>
                        <Td right>{formatBytes(c.bytes)}</Td>
                        <Td className="whitespace-nowrap text-muted" title={absoluteTime(c.first_seen)}>
                          {relativeTime(c.first_seen, now)}
                        </Td>
                        <Td className="whitespace-nowrap text-muted" title={absoluteTime(c.last_seen)}>
                          {relativeTime(c.last_seen, now)}
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            );
          }}
        </Resource>
      </Card>
    </>
  );
}
