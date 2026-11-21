import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { api } from "../api/client";
import type { Download, LiveSnapshot, RatePoint, RequestRecord, TickEvent } from "../api/types";

const MAX_REQUESTS = 500;
const MAX_RATES = 120;

export type Connection = "connecting" | "live" | "reconnecting";

export interface LiveState {
  connection: Connection;
  rates: RatePoint[];
  live: LiveSnapshot | null;
  downloads: Download[];
  /** Bytes per second per download id, from `received` deltas between ticks. */
  speeds: Record<string, number>;
  /** Newest first. */
  requests: RequestRecord[];
  /** Total `request` events seen on this connection (for cheap change detection). */
  requestSeq: number;
}

/**
 * One EventSource for the whole app. Components subscribe to slices through
 * useLive(selector); slices are replaced immutably so selectors stay cheap.
 */
class LiveStore {
  private state: LiveState = {
    connection: "connecting",
    rates: [],
    live: null,
    downloads: [],
    speeds: {},
    requests: [],
    requestSeq: 0,
  };
  private listeners = new Set<() => void>();
  private source: EventSource | null = null;
  private pending: RequestRecord[] = [];
  private flushTimer: number | null = null;
  private lastReceived = new Map<string, { received: number; at: number }>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };
  getState = () => this.state;

  private set(patch: Partial<LiveState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  start() {
    if (this.source) return;
    void this.seed();
    const es = new EventSource("/api/v1/events");
    this.source = es;
    es.onopen = () => this.set({ connection: "live" });
    es.onerror = () => {
      // EventSource retries on its own; CLOSED means the server refused (e.g. 401).
      this.set({ connection: "reconnecting" });
      if (es.readyState === EventSource.CLOSED) {
        // Any API call notices a lost session and returns to the login screen.
        void api.stats().catch(() => undefined);
        this.scheduleRestart();
      }
    };
    es.addEventListener("tick", (ev) => this.onTick(ev as MessageEvent<string>));
    es.addEventListener("request", (ev) => this.onRequest(ev as MessageEvent<string>));
  }

  private restartTimer: number | null = null;
  private scheduleRestart() {
    if (this.restartTimer !== null) return;
    this.restartTimer = window.setTimeout(() => {
      this.restartTimer = null;
      if (!this.source) return;
      this.source.close();
      this.source = null;
      this.start();
    }, 5000);
  }

  stop() {
    this.source?.close();
    this.source = null;
    if (this.flushTimer !== null) window.clearTimeout(this.flushTimer);
    if (this.restartTimer !== null) window.clearTimeout(this.restartTimer);
    this.flushTimer = null;
    this.restartTimer = null;
    this.pending = [];
    this.lastReceived.clear();
  }

  private async seed() {
    try {
      const [stats, reqs] = await Promise.all([api.stats(), api.requests({ limit: 200 })]);
      const seeded = reqs.requests ?? [];
      const known = new Set(this.state.requests.map((r) => r.id));
      const merged = [...this.state.requests, ...seeded.filter((r) => !known.has(r.id))]
        .sort((a, b) => b.id - a.id)
        .slice(0, MAX_REQUESTS);
      const haveT = new Set(this.state.rates.map((r) => r.t));
      const rates = [...(stats.rates ?? []).filter((r) => !haveT.has(r.t)), ...this.state.rates]
        .sort((a, b) => a.t - b.t)
        .slice(-MAX_RATES);
      this.set({ requests: merged, rates });
    } catch {
      /* pages show their own errors; live data fills in from events */
    }
  }

  private onTick(ev: MessageEvent<string>) {
    let tick: TickEvent;
    try {
      tick = JSON.parse(ev.data) as TickEvent;
    } catch {
      return;
    }
    const now = performance.now();
    const downloads = tick.live?.downloads ?? [];
    const speeds: Record<string, number> = {};
    const seen = new Set<string>();
    for (const d of downloads) {
      const id = String(d.id);
      seen.add(id);
      const prev = this.lastReceived.get(id);
      if (prev && now > prev.at) {
        const bps = Math.max(0, ((d.received - prev.received) * 1000) / (now - prev.at));
        const old = this.state.speeds[id];
        speeds[id] = old === undefined ? bps : old * 0.5 + bps * 0.5;
      }
      this.lastReceived.set(id, { received: d.received, at: now });
    }
    for (const id of this.lastReceived.keys()) if (!seen.has(id)) this.lastReceived.delete(id);

    const last = this.state.rates[this.state.rates.length - 1];
    const rates =
      tick.rate && (!last || tick.rate.t > last.t) ? [...this.state.rates, tick.rate].slice(-MAX_RATES) : this.state.rates;
    this.set({ connection: "live", rates, live: tick.live ?? null, downloads, speeds });
  }

  private onRequest(ev: MessageEvent<string>) {
    try {
      this.pending.push(JSON.parse(ev.data) as RequestRecord);
    } catch {
      return;
    }
    // Package managers fire bursts of requests; batch them into one render.
    if (this.flushTimer === null) this.flushTimer = window.setTimeout(() => this.flush(), 250);
  }

  private flush() {
    this.flushTimer = null;
    if (this.pending.length === 0) return;
    const fresh = this.pending.reverse();
    this.pending = [];
    this.set({
      requests: [...fresh, ...this.state.requests].slice(0, MAX_REQUESTS),
      requestSeq: this.state.requestSeq + fresh.length,
    });
  }
}

const Ctx = createContext<LiveStore | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => new LiveStore(), []);
  useEffect(() => {
    store.start();
    return () => store.stop();
  }, [store]);
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useLive<S>(selector: (s: LiveState) => S): S {
  const store = useContext(Ctx);
  if (!store) throw new Error("useLive outside LiveProvider");
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}
