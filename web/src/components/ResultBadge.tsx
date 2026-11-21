import { useT } from "../i18n";
import { isKey } from "../i18n/core";
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

export const RESULTS = ["HIT", "MISS", "COALESCED", "REVALIDATED", "STALE", "NOTFOUND", "ERROR", "DENIED"] as const;

/** The result code stays as the server sends it; only its explanation is translated. */
export function ResultBadge({ result }: { result: string }) {
  const { t } = useT();
  const hint = `result.${result}`;
  return (
    <Badge tone={tones[result] ?? "neutral"} title={isKey(hint) ? t(hint) : undefined}>
      {result || "–"}
    </Badge>
  );
}
