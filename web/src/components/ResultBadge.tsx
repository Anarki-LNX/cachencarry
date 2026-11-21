import { Badge } from "./Card";

const tones: Record<string, "ok" | "info" | "warn" | "bad" | "alt" | "neutral"> = {
  HIT: "ok",
  COALESCED: "ok",
  REVALIDATED: "alt",
  MISS: "info",
  STALE: "warn",
  NOTFOUND: "neutral",
  ERROR: "bad",
  DENIED: "bad",
};

const hints: Record<string, string> = {
  HIT: "Served from the cache",
  MISS: "Fetched from upstream and stored",
  COALESCED: "Joined another client's in-flight download (counts as a hit)",
  REVALIDATED: "Upstream confirmed the cached copy is current",
  STALE: "Upstream unreachable, expired copy served",
  NOTFOUND: "Upstream does not have this object",
  ERROR: "Upstream or internal failure",
  DENIED: "Rejected by access control or policy",
};

export const RESULTS = ["HIT", "MISS", "COALESCED", "REVALIDATED", "STALE", "NOTFOUND", "ERROR", "DENIED"] as const;

export function ResultBadge({ result }: { result: string }) {
  return (
    <Badge tone={tones[result] ?? "neutral"} title={hints[result]}>
      {result || "–"}
    </Badge>
  );
}
