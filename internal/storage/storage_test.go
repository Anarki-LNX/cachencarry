package storage_test

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Anarki-LNX/cachencarry/internal/database"
	"github.com/Anarki-LNX/cachencarry/internal/storage"
	"github.com/Anarki-LNX/cachencarry/internal/testutil"
)

var ctx = context.Background()

func key(repo, path string) storage.Key { return storage.Key{Module: "apt", Repo: repo, Path: path} }

func blobPath(root, hash string) string {
	return filepath.Join(root, "blobs", hash[:2], hash[2:4], hash)
}

func read(t *testing.T, s *storage.Store, e *storage.Entry) []byte {
	t.Helper()
	f, err := s.Open(e)
	if err != nil {
		t.Fatalf("open %s: %v", e.Key, err)
	}
	defer f.Close()
	b, _ := io.ReadAll(f)
	return b
}

func setAccess(t *testing.T, db *database.DB, id int64, at time.Time) {
	t.Helper()
	if _, err := db.W.Exec(`UPDATE entries SET last_access = ? WHERE id = ?`, at.Unix(), id); err != nil {
		t.Fatal(err)
	}
}

func TestPublishLookupRoundTrip(t *testing.T) {
	s, _ := testutil.Store(t, storage.Options{})
	data := []byte("package content")
	e := testutil.Put(t, s, key("debian", "pool/a.deb"), data, storage.Meta{
		ContentType: "application/x-deb", ETag: `"abc"`, LastModified: "Mon, 02 Jan 2006 15:04:05 GMT", Immutable: true})
	got, err := s.Lookup(ctx, key("debian", "pool/a.deb"))
	if err != nil {
		t.Fatal(err)
	}
	if got.BlobHash != e.BlobHash || got.Size != int64(len(data)) || got.ETag != `"abc"` || !got.Immutable {
		t.Fatalf("unexpected entry %+v", got)
	}
	if !bytes.Equal(read(t, s, got), data) {
		t.Fatal("content mismatch")
	}
	if _, err := s.Lookup(ctx, key("debian", "pool/missing.deb")); !errors.Is(err, storage.ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
}

func TestDeduplicationAcrossRepositoriesAndModules(t *testing.T) {
	s, _ := testutil.Store(t, storage.Options{})
	data := bytes.Repeat([]byte("d"), 4096)
	a := testutil.Put(t, s, key("debian", "pool/x.deb"), data, storage.Meta{Immutable: true})
	b := testutil.Put(t, s, key("mirror2", "other/name.deb"), data, storage.Meta{Immutable: true})
	c := testutil.Put(t, s, storage.Key{Module: "pacman", Repo: "arch", Path: "x.pkg.tar.zst"}, data, storage.Meta{Immutable: true})
	if a.BlobHash != b.BlobHash || b.BlobHash != c.BlobHash {
		t.Fatal("identical content got different blobs")
	}
	if a.ID == b.ID || b.ID == c.ID {
		t.Fatal("repository identity was merged")
	}
	u, err := s.Usage(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if u.BlobCount != 1 || u.BlobBytes != 4096 || u.EntryCount != 3 || u.LogicalBytes != 3*4096 || u.DedupSaved != 2*4096 {
		t.Fatalf("usage = %+v", u)
	}
}

func TestReferenceTrackingAndGC(t *testing.T) {
	s, _ := testutil.Store(t, storage.Options{})
	shared := []byte("shared blob")
	a := testutil.Put(t, s, key("r1", "a"), shared, storage.Meta{Immutable: true})
	b := testutil.Put(t, s, key("r2", "b"), shared, storage.Meta{Immutable: true})
	c := testutil.Put(t, s, key("r1", "c"), []byte("unique blob"), storage.Meta{Immutable: true})

	// Removing one of two references must keep the blob.
	if err := s.DeleteEntry(ctx, a.ID); err != nil {
		t.Fatal(err)
	}
	rep, err := s.GC(ctx)
	if err != nil || rep.BlobsRemoved != 0 {
		t.Fatalf("gc removed %d blobs (err %v), want 0", rep.BlobsRemoved, err)
	}
	if !bytes.Equal(read(t, s, b), shared) {
		t.Fatal("still-referenced blob is gone")
	}
	// Removing the last reference releases it.
	if err := s.DeleteEntry(ctx, b.ID); err != nil {
		t.Fatal(err)
	}
	rep, err = s.GC(ctx)
	if err != nil || rep.BlobsRemoved != 1 || rep.BytesFreed != int64(len(shared)) {
		t.Fatalf("gc = %+v, %v", rep, err)
	}
	if _, err := os.Stat(blobPath(s.Root(), a.BlobHash)); !os.IsNotExist(err) {
		t.Fatal("unreferenced blob file still on disk")
	}
	if !bytes.Equal(read(t, s, c), []byte("unique blob")) {
		t.Fatal("unrelated blob damaged by GC")
	}
}

func TestReplacingAnEntryReleasesTheOldBlob(t *testing.T) {
	s, _ := testutil.Store(t, storage.Options{})
	old := testutil.Put(t, s, key("debian", "dists/InRelease"), []byte("version 1"), storage.Meta{TTL: time.Minute})
	cur := testutil.Put(t, s, key("debian", "dists/InRelease"), []byte("version 2"), storage.Meta{TTL: time.Minute})
	if old.ID != cur.ID {
		t.Fatal("replacement created a second entry")
	}
	if rep, _ := s.GC(ctx); rep.BlobsRemoved != 1 {
		t.Fatalf("old version not collected: %+v", rep)
	}
	e, _ := s.Lookup(ctx, key("debian", "dists/InRelease"))
	if string(read(t, s, e)) != "version 2" {
		t.Fatal("wrong content after replacement")
	}
}

// TestGCDoesNotRaceWithPublish hammers the window between "blob file exists"
// and "entry references it": identical content is published over and over
// while entries are deleted and GC runs. Every published entry must be
// readable afterwards.
func TestGCDoesNotRaceWithPublish(t *testing.T) {
	s, _ := testutil.Store(t, storage.Options{})
	data := []byte("contended content")
	stop := make(chan struct{})
	gcDone := make(chan struct{})
	var gcs atomic.Int64
	go func() {
		defer close(gcDone)
		for {
			select {
			case <-stop:
				return
			default:
				if _, err := s.GC(ctx); err != nil {
					t.Error(err)
					return
				}
				gcs.Add(1)
			}
		}
	}()
	var writers sync.WaitGroup
	for w := 0; w < 4; w++ {
		writers.Add(1)
		go func() {
			defer writers.Done()
			for i := 0; i < 150; i++ {
				k := key("r", fmt.Sprintf("w%d/obj%d", w, i))
				e := testutil.Put(t, s, k, data, storage.Meta{Immutable: true})
				f, err := s.Open(e)
				if err != nil {
					t.Errorf("published entry %s unreadable: %v", k, err)
					return
				}
				b, _ := io.ReadAll(f)
				f.Close()
				if !bytes.Equal(b, data) {
					t.Errorf("published entry %s has wrong content", k)
				}
				// Dropping the entry makes the blob collectable again, so
				// the next publish of the same content races with GC.
				if err := s.DeleteEntry(ctx, e.ID); err != nil {
					t.Error(err)
				}
			}
		}()
	}
	writers.Wait()
	close(stop)
	<-gcDone
	if gcs.Load() == 0 {
		t.Fatal("garbage collector never ran")
	}
}

func TestLRUEvictionRespectsPinsAndOrder(t *testing.T) {
	const size = 1000
	s, db := testutil.Store(t, storage.Options{MaxSize: 3 * size})
	now := time.Now()
	var entries []*storage.Entry
	for i := 0; i < 5; i++ {
		e := testutil.Put(t, s, key("r", fmt.Sprintf("obj%d", i)), bytes.Repeat([]byte{byte('a' + i)}, size), storage.Meta{Immutable: true})
		setAccess(t, db, e.ID, now.Add(time.Duration(i-10)*time.Hour)) // obj0 is the oldest
		entries = append(entries, e)
	}
	if err := s.SetPinned(ctx, entries[0].ID, true); err != nil { // oldest, but pinned
		t.Fatal(err)
	}
	rep, err := s.Evict(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if rep.EntriesRemoved != 2 || rep.BytesFreed != 2*size || rep.Reason != "max_size" || rep.Unsatisfied {
		t.Fatalf("eviction report = %+v", rep)
	}
	for i, wantPresent := range []bool{true, false, false, true, true} {
		_, err := s.Lookup(ctx, key("r", fmt.Sprintf("obj%d", i)))
		if present := err == nil; present != wantPresent {
			t.Errorf("obj%d present = %v, want %v", i, present, wantPresent)
		}
	}
	u, _ := s.Usage(ctx)
	if u.BlobBytes > 3*size {
		t.Fatalf("still over limit: %d", u.BlobBytes)
	}
}

func TestEvictionUsesBufferedAccessTimes(t *testing.T) {
	const size = 1000
	s, db := testutil.Store(t, storage.Options{MaxSize: size})
	old := time.Now().Add(-time.Hour)
	a := testutil.Put(t, s, key("r", "a"), bytes.Repeat([]byte("a"), size), storage.Meta{Immutable: true})
	b := testutil.Put(t, s, key("r", "b"), bytes.Repeat([]byte("b"), size), storage.Meta{Immutable: true})
	setAccess(t, db, a.ID, old)
	setAccess(t, db, b.ID, old.Add(time.Minute))
	s.Touch(a) // a was just used (only buffered so far); b is now the LRU entry
	if _, err := s.Evict(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Lookup(ctx, key("r", "a")); err != nil {
		t.Fatal("recently used entry was evicted")
	}
	if _, err := s.Lookup(ctx, key("r", "b")); err == nil {
		t.Fatal("least recently used entry survived")
	}
}

func TestEvictionReportsWhenOnlyPinnedRemain(t *testing.T) {
	s, _ := testutil.Store(t, storage.Options{MaxSize: 10})
	e := testutil.Put(t, s, key("r", "big"), bytes.Repeat([]byte("p"), 100), storage.Meta{Immutable: true})
	s.SetPinned(ctx, e.ID, true)
	rep, err := s.Evict(ctx)
	if err != nil || !rep.Unsatisfied || rep.EntriesRemoved != 0 {
		t.Fatalf("report = %+v, err %v", rep, err)
	}
}

func TestTTLFreshnessAndRevalidation(t *testing.T) {
	s, _ := testutil.Store(t, storage.Options{})
	imm := testutil.Put(t, s, key("r", "pkg"), []byte("1"), storage.Meta{Immutable: true})
	mut := testutil.Put(t, s, key("r", "index"), []byte("2"), storage.Meta{TTL: time.Hour})
	zero := testutil.Put(t, s, key("r", "always"), []byte("3"), storage.Meta{TTL: 0})
	now := time.Now()
	if !imm.Fresh(now.Add(1000 * time.Hour)) {
		t.Error("immutable entry must never expire")
	}
	if !mut.Fresh(now) || mut.Fresh(now.Add(2*time.Hour)) {
		t.Error("mutable entry TTL not honoured")
	}
	if zero.Fresh(now.Add(time.Second)) {
		t.Error("TTL 0 must require revalidation")
	}
	stale, _ := s.Lookup(ctx, key("r", "always"))
	if err := s.Revalidated(stale, time.Hour); err != nil {
		t.Fatal(err)
	}
	again, _ := s.Lookup(ctx, key("r", "always"))
	if !again.Fresh(time.Now().Add(30 * time.Minute)) {
		t.Error("revalidation did not extend the lifetime")
	}
}

func TestExpireUnused(t *testing.T) {
	s, db := testutil.Store(t, storage.Options{})
	old := testutil.Put(t, s, key("r", "old"), []byte("old"), storage.Meta{Immutable: true})
	pinned := testutil.Put(t, s, key("r", "pinned"), []byte("pinned"), storage.Meta{Immutable: true})
	testutil.Put(t, s, key("r", "new"), []byte("new"), storage.Meta{Immutable: true})
	long := time.Now().Add(-48 * time.Hour)
	setAccess(t, db, old.ID, long)
	setAccess(t, db, pinned.ID, long)
	s.SetPinned(ctx, pinned.ID, true)
	n, err := s.ExpireUnused(ctx, 24*time.Hour)
	if err != nil || n != 1 {
		t.Fatalf("expired %d (err %v), want 1", n, err)
	}
}

func TestVerifyPurgesCorruptBlob(t *testing.T) {
	s, _ := testutil.Store(t, storage.Options{})
	good := testutil.Put(t, s, key("r", "good"), []byte("good data"), storage.Meta{Immutable: true})
	bad := testutil.Put(t, s, key("r", "bad"), []byte("soon damaged"), storage.Meta{Immutable: true})
	bad2 := testutil.Put(t, s, key("r2", "bad-alias"), []byte("soon damaged"), storage.Meta{Immutable: true})
	if err := os.WriteFile(blobPath(s.Root(), bad.BlobHash), []byte("bit rot!!!!!"), 0o640); err != nil {
		t.Fatal(err)
	}
	rep, err := s.Verify(ctx, 100)
	if err != nil || rep.Checked != 2 || rep.Corrupt != 1 {
		t.Fatalf("verify = %+v, %v", rep, err)
	}
	for _, k := range []storage.Key{bad.Key, bad2.Key} {
		if _, err := s.Lookup(ctx, k); !errors.Is(err, storage.ErrNotFound) {
			t.Errorf("entry %s for corrupt blob still served", k)
		}
	}
	if _, err := s.Lookup(ctx, good.Key); err != nil {
		t.Error("intact entry removed")
	}
}

func TestOpenDropsDanglingEntry(t *testing.T) {
	s, _ := testutil.Store(t, storage.Options{})
	e := testutil.Put(t, s, key("r", "lost"), []byte("lost"), storage.Meta{Immutable: true})
	os.Remove(blobPath(s.Root(), e.BlobHash))
	if _, err := s.Open(e); !errors.Is(err, storage.ErrNotFound) {
		t.Fatalf("err = %v", err)
	}
	if _, err := s.Lookup(ctx, e.Key); !errors.Is(err, storage.ErrNotFound) {
		t.Fatal("dangling entry kept")
	}
}

// TestCrashRecovery simulates the states a crash can leave behind and checks
// that reopening the store repairs all of them.
func TestCrashRecovery(t *testing.T) {
	root := t.TempDir()
	s, db := testutil.Store(t, storage.Options{Root: root})
	keep := testutil.Put(t, s, key("r", "keep"), []byte("intact"), storage.Meta{Immutable: true})
	lost := testutil.Put(t, s, key("r", "lost"), []byte("file will vanish"), storage.Meta{Immutable: true})
	trunc := testutil.Put(t, s, key("r", "trunc"), []byte("file will be truncated"), storage.Meta{Immutable: true})

	// 1. download interrupted mid-transfer: temp file without owner
	w, _ := s.NewWriter()
	w.Write([]byte("half a downlo"))
	// 2. crash between rename and database commit: blob file without row
	orphan := "ab" + "cd" + "00000000000000000000000000000000000000000000000000000000ffff"
	orphanPath := blobPath(root, orphan)
	os.MkdirAll(filepath.Dir(orphanPath), 0o750)
	os.WriteFile(orphanPath, []byte("orphan"), 0o640)
	// 3. stray junk in the blob tree
	os.WriteFile(filepath.Join(root, "blobs", "junk.tmp"), []byte("junk"), 0o640)
	// 4. row whose file is gone, 5. row whose file is truncated
	os.Remove(blobPath(root, lost.BlobHash))
	os.WriteFile(blobPath(root, trunc.BlobHash), []byte("file"), 0o640)
	db.Close()

	// "Restart".
	db2, err := database.Open(ctx, filepath.Join(root, "metadata.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db2.Close()
	if err := db2.IntegrityCheck(ctx); err != nil {
		t.Fatal(err)
	}
	s2, err := storage.Open(db2, storage.Options{Root: root, NoSync: true, Logger: testutil.Logger()})
	if err != nil {
		t.Fatal(err)
	}
	if n, err := s2.CleanTemp(); err != nil || n != 1 {
		t.Fatalf("CleanTemp = %d, %v", n, err)
	}
	rep, err := s2.Recover(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if rep.OrphanFiles != 2 || rep.MissingBlobs != 2 || rep.EntriesDropped != 2 {
		t.Fatalf("recovery report = %+v", rep)
	}
	if _, err := os.Stat(orphanPath); !os.IsNotExist(err) {
		t.Error("orphan blob file not removed")
	}
	e, err := s2.Lookup(ctx, keep.Key)
	if err != nil || string(read(t, s2, e)) != "intact" {
		t.Error("intact entry damaged by recovery")
	}
	for _, k := range []storage.Key{lost.Key, trunc.Key} {
		if _, err := s2.Lookup(ctx, k); !errors.Is(err, storage.ErrNotFound) {
			t.Errorf("entry %s with broken blob survived recovery", k)
		}
	}
	// A second run finds nothing left to repair.
	if rep, _ := s2.Recover(ctx); rep != (storage.RecoveryReport{}) {
		t.Errorf("second recovery not clean: %+v", rep)
	}
}

func TestPinAndDeleteUnknownEntry(t *testing.T) {
	s, _ := testutil.Store(t, storage.Options{})
	if err := s.SetPinned(ctx, 999, true); !errors.Is(err, storage.ErrNotFound) {
		t.Errorf("pin err = %v", err)
	}
	if err := s.DeleteEntry(ctx, 999); !errors.Is(err, storage.ErrNotFound) {
		t.Errorf("delete err = %v", err)
	}
}

func TestListEntriesFilters(t *testing.T) {
	s, _ := testutil.Store(t, storage.Options{})
	testutil.Put(t, s, key("debian", "pool/main/a/alpha.deb"), []byte("aaaa"), storage.Meta{Immutable: true})
	testutil.Put(t, s, key("debian", "pool/main/b/beta.deb"), []byte("bb"), storage.Meta{Immutable: true})
	testutil.Put(t, s, key("ubuntu", "pool/main/a/alpha.deb"), []byte("c"), storage.Meta{Immutable: true})
	list, total, err := s.ListEntries(ctx, storage.ListFilter{Repo: "debian", Sort: "size"})
	if err != nil || total != 2 || len(list) != 2 || list[0].Size != 4 {
		t.Fatalf("list = %d/%d, err %v", len(list), total, err)
	}
	// Search terms are matched literally (no SQL wildcard injection).
	if _, total, _ := s.ListEntries(ctx, storage.ListFilter{Search: "%"}); total != 0 {
		t.Fatalf("wildcard matched %d entries", total)
	}
	if _, total, _ := s.ListEntries(ctx, storage.ListFilter{Search: "alpha"}); total != 2 {
		t.Fatalf("search matched %d entries, want 2", total)
	}
}
