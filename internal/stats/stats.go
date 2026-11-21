// Package stats collects traffic statistics.
//
// All numbers are measured, never estimated: byte counters are fed by the
// writers that actually send data to clients and by the download manager as
// data arrives from upstream. "Bandwidth saved" is therefore the number of
// body bytes that were really delivered to clients without being fetched
// from upstream for that request (partial and aborted transfers count only
// with what was sent).
package stats

import (
	"context"
	"log/slog"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Anarki-LNX/cachencarry/internal/database"
	"github.com/Anarki-LNX/cachencarry/internal/events"
)

// Result classifies how a request was answered.
type Result string

const (
	Hit         Result = "HIT"         // served from the cache
	Miss        Result = "MISS"        // this request triggered the upstream download
	Coalesced   Result = "COALESCED"   // joined a download another request had started
	Revalidated Result = "REVALIDATED" // upstream confirmed the cached copy (304)
	Stale       Result = "STALE"       // upstream unreachable, expired copy served
	NotFound    Result = "NOTFOUND"    // upstream does not have the object
	Error       Result = "ERROR"       // upstream or internal failure
	Denied      Result = "DENIED"      // rejected by access control or policy
)

// Record describes one finished client request.
type Record struct {
	ID         int64     `json:"id"`
	Time       time.Time `json:"time"`
	Client     string    `json:"client"`
	Module     string    `json:"module"`
	Repo       string    `json:"repo"`
	Path       string    `json:"path"`
	Method     string    `json:"method"`
	Result     Result    `json:"result"`
	Status     int       `json:"status"`
	Bytes      int64     `json:"bytes"`
	DurationMS int64     `json:"duration_ms"`
	Source     string    `json:"source"` // "cache" or "upstream"
	Partial    bool      `json:"partial"`
}

// Counters are the aggregated numbers of one module or of everything.
type Counters struct {
	Hits          int64 `json:"hits"`
	Misses        int64 `json:"misses"`
	Revalidated   int64 `json:"revalidated"`
	Errors        int64 `json:"errors"`
	BytesCache    int64 `json:"bytes_cache"`    // sent to clients without upstream transfer
	BytesOrigin   int64 `json:"bytes_origin"`   // sent to clients while downloading upstream
	BytesUpstream int64 `json:"bytes_upstream"` // received from upstream
}

func (c *Counters) add(o Counters) {
	c.Hits += o.Hits
	c.Misses += o.Misses
	c.Revalidated += o.Revalidated
	c.Errors += o.Errors
	c.BytesCache += o.BytesCache
	c.BytesOrigin += o.BytesOrigin
	c.BytesUpstream += o.BytesUpstream
}

// HitRatio is hits (including revalidated) over all cacheable lookups.
func (c Counters) HitRatio() float64 {
	total := c.Hits + c.Revalidated + c.Misses
	if total == 0 {
		return 0
	}
	return float64(c.Hits+c.Revalidated) / float64(total)
}

// Client aggregates the activity of one client address.
type Client struct {
	IP        string    `json:"ip"`
	FirstSeen time.Time `json:"first_seen"`
	LastSeen  time.Time `json:"last_seen"`
	Requests  int64     `json:"requests"`
	Hits      int64     `json:"hits"`
	Bytes     int64     `json:"bytes"`
}

// RatePoint is one second of live throughput.
type RatePoint struct {
	Time     int64 `json:"t"`        // unix seconds
	LAN      int64 `json:"lan"`      // bytes sent to clients
	Upstream int64 `json:"upstream"` // bytes received from upstream
}

type bucketKey struct {
	minute int64
	module string
}

// Collector gathers statistics in memory and persists them periodically.
type Collector struct {
	db     *database.DB
	broker *events.Broker
	log    *slog.Logger
	ringN  int

	liveLAN      atomic.Int64
	liveUpstream atomic.Int64

	mu       sync.Mutex
	totals   map[string]*Counters
	pending  map[bucketKey]*Counters // not yet written to the database
	clients  map[string]*Client
	dirty    map[string]*Client // client deltas not yet written
	ring     []Record
	ringPos  int
	nextID   int64
	rates    []RatePoint
	lastErrs map[string]Record
}

// NewCollector creates a collector and loads the persisted totals.
func NewCollector(ctx context.Context, db *database.DB, broker *events.Broker, ringSize int, log *slog.Logger) (*Collector, error) {
	if ringSize < 100 {
		ringSize = 100
	}
	if log == nil {
		log = slog.Default()
	}
	c := &Collector{
		db: db, broker: broker, log: log, ringN: ringSize,
		totals:   map[string]*Counters{},
		pending:  map[bucketKey]*Counters{},
		clients:  map[string]*Client{},
		dirty:    map[string]*Client{},
		lastErrs: map[string]Record{},
	}
	rows, err := db.R.QueryContext(ctx, `SELECT module, hits, misses, revalidated, errors,
		bytes_cache, bytes_origin, bytes_upstream FROM stats_total`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var m string
		var t Counters
		if err := rows.Scan(&m, &t.Hits, &t.Misses, &t.Revalidated, &t.Errors,
			&t.BytesCache, &t.BytesOrigin, &t.BytesUpstream); err != nil {
			return nil, err
		}
		c.totals[m] = &t
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	crow, err := db.R.QueryContext(ctx, `SELECT ip, first_seen, last_seen, requests, hits, bytes FROM clients`)
	if err != nil {
		return nil, err
	}
	defer crow.Close()
	for crow.Next() {
		var cl Client
		var first, last int64
		if err := crow.Scan(&cl.IP, &first, &last, &cl.Requests, &cl.Hits, &cl.Bytes); err != nil {
			return nil, err
		}
		cl.FirstSeen, cl.LastSeen = time.Unix(first, 0), time.Unix(last, 0)
		c.clients[cl.IP] = &cl
	}
	return c, crow.Err()
}

// AddClientBytes feeds the live LAN throughput meter.
func (c *Collector) AddClientBytes(n int64) { c.liveLAN.Add(n) }

// AddUpstreamBytes accounts body bytes received from upstream.
func (c *Collector) AddUpstreamBytes(module string, n int64) {
	c.liveUpstream.Add(n)
	c.mu.Lock()
	c.bucket(module, time.Now()).BytesUpstream += n
	c.total(module).BytesUpstream += n
	c.mu.Unlock()
}

func (c *Collector) total(module string) *Counters {
	t := c.totals[module]
	if t == nil {
		t = &Counters{}
		c.totals[module] = t
	}
	return t
}

func (c *Collector) bucket(module string, at time.Time) *Counters {
	k := bucketKey{minute: at.Unix() / 60 * 60, module: module}
	b := c.pending[k]
	if b == nil {
		b = &Counters{}
		c.pending[k] = b
	}
	return b
}

// Record accounts one finished request and publishes it to live listeners.
func (c *Collector) Record(r Record) {
	var d Counters
	switch r.Result {
	case Hit, Stale, Coalesced:
		d.Hits = 1
		d.BytesCache = r.Bytes
	case Revalidated:
		d.Revalidated = 1
		d.BytesCache = r.Bytes
	case Miss:
		d.Misses = 1
		d.BytesOrigin = r.Bytes
	case Error:
		d.Errors = 1
	}
	c.mu.Lock()
	c.nextID++
	r.ID = c.nextID
	c.bucket(r.Module, r.Time).add(d)
	c.total(r.Module).add(d)
	if len(c.ring) < c.ringN {
		c.ring = append(c.ring, r)
	} else {
		c.ring[c.ringPos] = r
		c.ringPos = (c.ringPos + 1) % c.ringN
	}
	if r.Result == Error {
		c.lastErrs[r.Module] = r
	}
	if r.Client != "" {
		cl := c.clients[r.Client]
		if cl == nil {
			cl = &Client{IP: r.Client, FirstSeen: r.Time}
			c.clients[r.Client] = cl
		}
		dc := c.dirty[r.Client]
		if dc == nil {
			dc = &Client{IP: r.Client, FirstSeen: cl.FirstSeen}
			c.dirty[r.Client] = dc
		}
		for _, x := range []*Client{cl, dc} {
			x.LastSeen = r.Time
			x.Requests++
			x.Bytes += r.Bytes
			if d.Hits+d.Revalidated > 0 {
				x.Hits++
			}
		}
	}
	c.mu.Unlock()
	if c.broker != nil {
		c.broker.Publish("request", r)
	}
}

// Totals returns lifetime counters per module and their sum.
func (c *Collector) Totals() (all Counters, perModule map[string]Counters) {
	perModule = map[string]Counters{}
	c.mu.Lock()
	defer c.mu.Unlock()
	for m, t := range c.totals {
		perModule[m] = *t
		all.add(*t)
	}
	return all, perModule
}

// LastError returns the most recent failed request of a module, if any.
func (c *Collector) LastError(module string) (Record, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	r, ok := c.lastErrs[module]
	return r, ok
}

// RecentFilter selects records for Recent.
type RecentFilter struct {
	Module string
	Client string
	Result string
	Limit  int
}

// Recent returns the newest matching request records, newest first.
func (c *Collector) Recent(f RecentFilter) []Record {
	if f.Limit <= 0 || f.Limit > c.ringN {
		f.Limit = 200
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]Record, 0, f.Limit)
	n := len(c.ring)
	for i := 0; i < n && len(out) < f.Limit; i++ {
		idx := (c.ringPos - 1 - i + 2*n) % n
		if len(c.ring) < c.ringN {
			idx = n - 1 - i
		}
		r := c.ring[idx]
		if (f.Module != "" && r.Module != f.Module) || (f.Client != "" && r.Client != f.Client) ||
			(f.Result != "" && string(r.Result) != f.Result) {
			continue
		}
		out = append(out, r)
	}
	return out
}

// Clients returns all known clients, most recently seen first.
func (c *Collector) Clients() []Client {
	c.mu.Lock()
	out := make([]Client, 0, len(c.clients))
	for _, cl := range c.clients {
		out = append(out, *cl)
	}
	c.mu.Unlock()
	sort.Slice(out, func(i, j int) bool { return out[i].LastSeen.After(out[j].LastSeen) })
	return out
}

// ActiveClients counts clients seen within the given window.
func (c *Collector) ActiveClients(window time.Duration) int {
	cut := time.Now().Add(-window)
	c.mu.Lock()
	defer c.mu.Unlock()
	n := 0
	for _, cl := range c.clients {
		if cl.LastSeen.After(cut) {
			n++
		}
	}
	return n
}

// Rates returns the live throughput of the last two minutes.
func (c *Collector) Rates() []RatePoint {
	c.mu.Lock()
	defer c.mu.Unlock()
	return append([]RatePoint(nil), c.rates...)
}

// HistoryPoint is one aggregated time bucket.
type HistoryPoint struct {
	Time int64 `json:"t"`
	Counters
}

// History returns aggregated counters between from and to in steps of
// stepSeconds (a multiple of 60), optionally for one module.
func (c *Collector) History(ctx context.Context, from, to time.Time, stepSeconds int64, module string) ([]HistoryPoint, error) {
	if stepSeconds < 60 {
		stepSeconds = 60
	}
	stepSeconds = stepSeconds / 60 * 60
	if err := c.Flush(ctx); err != nil {
		return nil, err
	}
	q := `SELECT ts / ? * ?, SUM(hits), SUM(misses), SUM(revalidated), SUM(errors),
		SUM(bytes_cache), SUM(bytes_origin), SUM(bytes_upstream)
		FROM stats_minute WHERE ts >= ? AND ts <= ?`
	args := []any{stepSeconds, stepSeconds, from.Unix(), to.Unix()}
	if module != "" {
		q += ` AND module = ?`
		args = append(args, module)
	}
	q += ` GROUP BY 1 ORDER BY 1`
	rows, err := c.db.R.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []HistoryPoint{}
	for rows.Next() {
		var p HistoryPoint
		if err := rows.Scan(&p.Time, &p.Hits, &p.Misses, &p.Revalidated, &p.Errors,
			&p.BytesCache, &p.BytesOrigin, &p.BytesUpstream); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// Flush writes pending counters and client updates to the database.
func (c *Collector) Flush(ctx context.Context) error {
	c.mu.Lock()
	pending, dirty := c.pending, c.dirty
	c.pending, c.dirty = map[bucketKey]*Counters{}, map[string]*Client{}
	c.mu.Unlock()
	if len(pending) == 0 && len(dirty) == 0 {
		return nil
	}
	err := c.write(ctx, pending, dirty)
	if err != nil {
		// Put the deltas back so nothing is lost; they are retried on the
		// next flush.
		c.mu.Lock()
		for k, v := range pending {
			if cur := c.pending[k]; cur != nil {
				cur.add(*v)
			} else {
				c.pending[k] = v
			}
		}
		for ip, v := range dirty {
			if cur := c.dirty[ip]; cur != nil {
				cur.Requests += v.Requests
				cur.Hits += v.Hits
				cur.Bytes += v.Bytes
			} else {
				c.dirty[ip] = v
			}
		}
		c.mu.Unlock()
	}
	return err
}

func (c *Collector) write(ctx context.Context, pending map[bucketKey]*Counters, dirty map[string]*Client) error {
	tx, err := c.db.W.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for k, v := range pending {
		if _, err := tx.Exec(`INSERT INTO stats_minute (ts, module, hits, misses, revalidated, errors,
				bytes_cache, bytes_origin, bytes_upstream) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(ts, module) DO UPDATE SET hits = hits + excluded.hits,
				misses = misses + excluded.misses, revalidated = revalidated + excluded.revalidated,
				errors = errors + excluded.errors, bytes_cache = bytes_cache + excluded.bytes_cache,
				bytes_origin = bytes_origin + excluded.bytes_origin,
				bytes_upstream = bytes_upstream + excluded.bytes_upstream`,
			k.minute, k.module, v.Hits, v.Misses, v.Revalidated, v.Errors,
			v.BytesCache, v.BytesOrigin, v.BytesUpstream); err != nil {
			return err
		}
		if _, err := tx.Exec(`INSERT INTO stats_total (module, hits, misses, revalidated, errors,
				bytes_cache, bytes_origin, bytes_upstream) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(module) DO UPDATE SET hits = hits + excluded.hits,
				misses = misses + excluded.misses, revalidated = revalidated + excluded.revalidated,
				errors = errors + excluded.errors, bytes_cache = bytes_cache + excluded.bytes_cache,
				bytes_origin = bytes_origin + excluded.bytes_origin,
				bytes_upstream = bytes_upstream + excluded.bytes_upstream`,
			k.module, v.Hits, v.Misses, v.Revalidated, v.Errors,
			v.BytesCache, v.BytesOrigin, v.BytesUpstream); err != nil {
			return err
		}
	}
	for _, cl := range dirty {
		if _, err := tx.Exec(`INSERT INTO clients (ip, first_seen, last_seen, requests, hits, bytes)
				VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(ip) DO UPDATE SET last_seen = excluded.last_seen,
				requests = requests + excluded.requests, hits = hits + excluded.hits,
				bytes = bytes + excluded.bytes`,
			cl.IP, cl.FirstSeen.Unix(), cl.LastSeen.Unix(), cl.Requests, cl.Hits, cl.Bytes); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// Run samples live throughput every second, flushes periodically and prunes
// old history until ctx is cancelled.
func (c *Collector) Run(ctx context.Context, retain time.Duration, extra func() any) {
	tick := time.NewTicker(time.Second)
	flush := time.NewTicker(10 * time.Second)
	prune := time.NewTicker(time.Hour)
	defer tick.Stop()
	defer flush.Stop()
	defer prune.Stop()
	for {
		select {
		case <-ctx.Done():
			fctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			if err := c.Flush(fctx); err != nil {
				c.log.Warn("flush statistics", "err", err)
			}
			cancel()
			return
		case now := <-tick.C:
			p := RatePoint{Time: now.Unix(), LAN: c.liveLAN.Swap(0), Upstream: c.liveUpstream.Swap(0)}
			c.mu.Lock()
			c.rates = append(c.rates, p)
			if len(c.rates) > 120 {
				c.rates = c.rates[len(c.rates)-120:]
			}
			c.mu.Unlock()
			if c.broker != nil && c.broker.Subscribers() > 0 {
				payload := map[string]any{"rate": p}
				if extra != nil {
					payload["live"] = extra()
				}
				c.broker.Publish("tick", payload)
			}
		case <-flush.C:
			if err := c.Flush(ctx); err != nil && ctx.Err() == nil {
				c.log.Warn("flush statistics", "err", err)
			}
		case <-prune.C:
			if retain > 0 {
				if _, err := c.db.W.ExecContext(ctx, `DELETE FROM stats_minute WHERE ts < ?`,
					time.Now().Add(-retain).Unix()); err != nil && ctx.Err() == nil {
					c.log.Warn("prune statistics", "err", err)
				}
			}
		}
	}
}
