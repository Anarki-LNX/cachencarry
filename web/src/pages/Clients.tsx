import { api } from "../api/client";
import { Badge, Card, EmptyState, PageHeader, Resource } from "../components/Card";
import { Table, Td, Th, Tr } from "../components/Table";
import { useT } from "../i18n";
import { absoluteTime, formatBytes, formatNumber, formatPercent, relativeTime, toDate } from "../lib/format";
import { useApi, useNow } from "../lib/useApi";

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export function Clients() {
  const clients = useApi(api.clients, [], 10_000);
  const now = useNow(10_000);
  const { t } = useT();

  return (
    <>
      <PageHeader title={t("nav.clients")} description={t("clients.description")} />
      <Card bodyClassName="p-0" title={clients.data ? t("clients.summary", { total: (clients.data.clients ?? []).length, active: clients.data.active }) : t("nav.clients")}>
        <Resource state={clients}>
          {(data) => {
            const list = [...(data.clients ?? [])].sort((a, b) => (toDate(b.last_seen)?.getTime() ?? 0) - (toDate(a.last_seen)?.getTime() ?? 0));
            if (list.length === 0) return <EmptyState title={t("clients.empty")} hint={t("clients.emptyHint")} />;
            return (
              <Table label={t("nav.clients")}>
                <thead>
                  <tr>
                    <Th>{t("clients.ip")}</Th>
                    <Th>{t("common.status")}</Th>
                    <Th right>{t("common.requests")}</Th>
                    <Th right>{t("common.hitRatio")}</Th>
                    <Th right>{t("clients.dataReceived")}</Th>
                    <Th>{t("clients.firstSeen")}</Th>
                    <Th>{t("clients.lastSeen")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => {
                    const last = toDate(c.last_seen);
                    const active = last !== null && now - last.getTime() < ACTIVE_WINDOW_MS;
                    return (
                      <Tr key={c.ip}>
                        <Td mono>{c.ip}</Td>
                        <Td>{active ? <Badge tone="ok">{t("clients.active")}</Badge> : <Badge>{t("clients.idle")}</Badge>}</Td>
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
