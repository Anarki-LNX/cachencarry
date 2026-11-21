package stats

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/Anarki-LNX/cachencarry/internal/database"
	"github.com/Anarki-LNX/cachencarry/internal/events"
)

func newCollector(t *testing.T, path string, ring int) (*Collector, *database.DB, *events.Broker) {
	t.Helper()
	db, err := database.Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	b := events.NewBroker()
	c, err := NewCollector(context.Background(), db, b, ring, nil)
	if err != nil {
		t.Fatal(err)
	}
	return c, db, b
}

func rec(module, client string, res Result, bytes int64) Record {
	return Record{Time: time.Now(), Module: module, Client: client, Result: res, Bytes: bytes, Status: 200}
}

func TestAccountingByResult(t *testing.T) {
	c, _, _ := newCollector(t, t.TempDir()+"/m.db", 100)
	c.Record(rec("apt", "10.0.0.1", Miss, 1000))
	c.Record(rec("apt", "10.0.0.2", Coalesced, 1000))
	c.Record(rec("apt", "10.0.0.1", Hit, 400)) // partial transfer: only what was sent
	c.Record(rec("apt", "10.0.0.1", Revalidated, 50))
	c.Record(rec("apt", "10.0.0.1", Stale, 50))
	c.Record(rec("apt", "10.0.0.1", NotFound, 0))
	c.Record(rec("apt", "10.0.0.1", Denied, 0))
	c.Record(rec("pacman", "10.0.0.3", Error, 0))
	c.AddUpstreamBytes("apt", 1000)

	all, per := c.Totals()
	apt := per["apt"]
	want := Counters{Hits: 3, Misses: 1, Revalidated: 1, BytesCache: 1000 + 400 + 50 + 50, BytesOrigin: 1000, BytesUpstream: 1000}
	if apt != want {
		t.Fatalf("apt = %+v\nwant  %+v", apt, want)
	}
	if per["pacman"].Errors != 1 || all.Errors != 1 || all.Hits != 3 {
		t.Fatalf("totals = %+v", all)
	}
	if r := apt.HitRatio(); r != 0.8 { // (3 hits + 1 revalidated) / 5 lookups
		t.Fatalf("hit ratio = %v, want 0.8", r)
	}
	if (Counters{}).HitRatio() != 0 {
		t.Fatal("hit ratio of nothing must be 0, not NaN")
	}
	if e, ok := c.LastError("pacman"); !ok || e.Result != Error {
		t.Fatal("last error not remembered")
	}
	cl := c.Clients()
	if len(cl) != 3 {
		t.Fatalf("%d clients", len(cl))
	}
	for _, x := range cl {
		if x.IP == "10.0.0.1" && (x.Requests != 6 || x.Hits != 3 || x.Bytes != 1500) {
			t.Fatalf("client = %+v", x)
		}
	}
	if c.ActiveClients(time.Minute) != 3 || c.ActiveClients(-time.Minute) != 0 {
		t.Fatal("active client window wrong")
	}
}

func TestRecentRingBufferOrderAndFilters(t *testing.T) {
	c, _, _ := newCollector(t, t.TempDir()+"/m.db", 100) // minimum ring size is 100
	for i := 1; i <= 250; i++ {
		r := rec("apt", fmt.Sprintf("10.0.0.%d", i%2), Hit, int64(i))
		if i%5 == 0 {
			r.Module, r.Result = "pacman", Miss
		}
		c.Record(r)
	}
	all := c.Recent(RecentFilter{Limit: 100})
	if len(all) != 100 {
		t.Fatalf("%d records, want 100", len(all))
	}
	for i, r := range all { // newest first, exactly the last 100
		if r.Bytes != int64(250-i) || r.ID != int64(250-i) {
			t.Fatalf("position %d: bytes %d id %d, want %d", i, r.Bytes, r.ID, 250-i)
		}
	}
	if got := c.Recent(RecentFilter{Limit: 3}); len(got) != 3 || got[0].Bytes != 250 || got[2].Bytes != 248 {
		t.Fatalf("limit: %+v", got)
	}
	pac := c.Recent(RecentFilter{Module: "pacman", Limit: 100})
	if len(pac) != 20 || pac[0].Bytes != 250 || pac[19].Bytes != 155 {
		t.Fatalf("module filter: %d records", len(pac))
	}
	if got := c.Recent(RecentFilter{Result: "MISS", Client: "10.0.0.1", Limit: 100}); len(got) != 10 {
		t.Fatalf("combined filter: %d records, want 10", len(got))
	}
	// Before the ring is full the order is the same.
	c2, _, _ := newCollector(t, t.TempDir()+"/n.db", 100)
	for i := 1; i <= 7; i++ {
		c2.Record(rec("apt", "c", Hit, int64(i)))
	}
	if got := c2.Recent(RecentFilter{}); len(got) != 7 || got[0].Bytes != 7 || got[6].Bytes != 1 {
		t.Fatalf("partial ring: %+v", got)
	}
}

func TestPersistenceAndHistory(t *testing.T) {
	ctx := context.Background()
	path := t.TempDir() + "/m.db"
	c, db, _ := newCollector(t, path, 100)
	now := time.Now()
	old := rec("apt", "10.0.0.1", Hit, 100)
	old.Time = now.Add(-30 * time.Minute)
	c.Record(old)
	c.Record(rec("apt", "10.0.0.1", Miss, 300))
	c.Record(rec("pacman", "10.0.0.2", Hit, 50))
	c.AddUpstreamBytes("apt", 300)
	if err := c.Flush(ctx); err != nil {
		t.Fatal(err)
	}
	if err := c.Flush(ctx); err != nil { // nothing pending: must not double count
		t.Fatal(err)
	}
	c.Record(rec("apt", "10.0.0.1", Hit, 7)) // same minute as before: bucket is added to
	hist, err := c.History(ctx, now.Add(-time.Hour), now.Add(time.Minute), 60, "")
	if err != nil {
		t.Fatal(err)
	}
	var sum Counters
	for _, p := range hist {
		sum.add(p.Counters)
	}
	if len(hist) != 2 || sum.Hits != 3 || sum.Misses != 1 || sum.BytesCache != 157 || sum.BytesUpstream != 300 {
		t.Fatalf("history = %+v (sum %+v)", hist, sum)
	}
	if h, _ := c.History(ctx, now.Add(-time.Hour), now.Add(time.Minute), 3600, "pacman"); len(h) < 1 || h[len(h)-1].Hits != 1 {
		t.Fatalf("module history = %+v", h)
	}

	// A new collector on the same database continues where the old one stopped.
	c2, err := NewCollector(ctx, db, nil, 100, nil)
	if err != nil {
		t.Fatal(err)
	}
	all, per := c2.Totals()
	if all.Hits != 3 || all.Misses != 1 || per["apt"].BytesUpstream != 300 || per["pacman"].Hits != 1 {
		t.Fatalf("reloaded totals = %+v", all)
	}
	cl := c2.Clients()
	if len(cl) != 2 {
		t.Fatalf("reloaded clients = %+v", cl)
	}
	for _, x := range cl {
		if x.IP == "10.0.0.1" && (x.Requests != 3 || x.Bytes != 407) {
			t.Fatalf("reloaded client = %+v", x)
		}
	}
}

func TestConcurrentRecordingAndEvents(t *testing.T) {
	c, _, b := newCollector(t, t.TempDir()+"/m.db", 100)
	ch, unsub := b.Subscribe()
	defer unsub()
	var wg sync.WaitGroup
	for g := 0; g < 8; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 200; i++ {
				c.Record(rec("apt", fmt.Sprint("c", g), Hit, 10))
				c.AddUpstreamBytes("apt", 1)
				c.AddClientBytes(10)
				if i%50 == 0 {
					c.Flush(context.Background())
					c.Recent(RecentFilter{})
					c.Totals()
				}
			}
		}()
	}
	wg.Wait()
	all, _ := c.Totals()
	if all.Hits != 1600 || all.BytesCache != 16000 || all.BytesUpstream != 1600 {
		t.Fatalf("totals = %+v", all)
	}
	select {
	case ev := <-ch:
		if ev.Type != "request" {
			t.Fatalf("event type %q", ev.Type)
		}
	default:
		t.Fatal("no event published")
	}
	// A slow subscriber never blocks recording (channel is full by now).
	if b.Subscribers() != 1 {
		t.Fatal("subscriber count wrong")
	}
	unsub()
	unsub() // idempotent
	if b.Subscribers() != 0 {
		t.Fatal("unsubscribe failed")
	}
}
