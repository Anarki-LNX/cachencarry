package cas

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func sum(b []byte) string { s := sha256.Sum256(b); return hex.EncodeToString(s[:]) }

func open(t *testing.T) *Store {
	t.Helper()
	s, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	s.DisableSync()
	return s
}

func put(t *testing.T, s *Store, data []byte) (string, bool) {
	t.Helper()
	w, err := s.NewWriter()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.Write(data); err != nil {
		t.Fatal(err)
	}
	h, size, existed, err := w.Commit()
	if err != nil {
		t.Fatal(err)
	}
	if size != int64(len(data)) {
		t.Fatalf("size = %d, want %d", size, len(data))
	}
	return h, existed
}

func TestWriteReadAndHash(t *testing.T) {
	s := open(t)
	data := []byte("hello unicache")
	h, existed := put(t, s, data)
	if existed {
		t.Fatal("new blob reported as existing")
	}
	if h != sum(data) {
		t.Fatalf("hash = %s, want %s", h, sum(data))
	}
	p, _ := s.Path(h)
	if want := filepath.Join(s.Root(), "blobs", h[:2], h[2:4], h); p != want {
		t.Fatalf("path = %s, want %s", p, want)
	}
	f, err := s.Open(h)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	got, _ := io.ReadAll(f)
	if !bytes.Equal(got, data) {
		t.Fatal("content mismatch")
	}
	if ok, err := s.Verify(h); err != nil || !ok {
		t.Fatalf("verify = %v, %v", ok, err)
	}
}

func TestDuplicateIsStoredOnce(t *testing.T) {
	s := open(t)
	h1, _ := put(t, s, []byte("same"))
	h2, existed := put(t, s, []byte("same"))
	if h1 != h2 || !existed {
		t.Fatalf("duplicate not detected: %s %s existed=%v", h1, h2, existed)
	}
	n := 0
	s.Walk(func(string, string, int64, bool) error { n++; return nil })
	if n != 1 {
		t.Fatalf("%d blob files, want 1", n)
	}
	if left, _ := os.ReadDir(filepath.Join(s.Root(), "temp")); len(left) != 0 {
		t.Fatalf("%d temp files left behind", len(left))
	}
}

func TestConcurrentWritersSameContent(t *testing.T) {
	s := open(t)
	data := bytes.Repeat([]byte("x"), 1<<20)
	var wg sync.WaitGroup
	created := make(chan bool, 32)
	for i := 0; i < 32; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			w, err := s.NewWriter()
			if err != nil {
				t.Error(err)
				return
			}
			w.Write(data)
			_, _, existed, err := w.Commit()
			if err != nil {
				t.Error(err)
			}
			created <- !existed
		}()
	}
	wg.Wait()
	close(created)
	n := 0
	for c := range created {
		if c {
			n++
		}
	}
	if n != 1 {
		t.Fatalf("%d writers believe they created the blob, want exactly 1", n)
	}
	if ok, err := s.Verify(sum(data)); err != nil || !ok {
		t.Fatalf("verify = %v, %v", ok, err)
	}
}

func TestAbortLeavesNothing(t *testing.T) {
	s := open(t)
	w, _ := s.NewWriter()
	w.Write([]byte("partial"))
	w.Abort()
	w.Abort() // idempotent
	if _, _, _, err := w.Commit(); err == nil {
		t.Fatal("commit after abort must fail")
	}
	if left, _ := os.ReadDir(filepath.Join(s.Root(), "temp")); len(left) != 0 {
		t.Fatal("temp file left behind")
	}
	n := 0
	s.Walk(func(string, string, int64, bool) error { n++; return nil })
	if n != 0 {
		t.Fatal("aborted data was published")
	}
}

func TestPartialFileIsNeverVisibleAsBlob(t *testing.T) {
	s := open(t)
	w, _ := s.NewWriter()
	w.Write([]byte("half of the da"))
	// Nothing may exist under blobs/ before Commit.
	n := 0
	s.Walk(func(string, string, int64, bool) error { n++; return nil })
	if n != 0 {
		t.Fatal("uncommitted data visible in blob directory")
	}
	w.Abort()
}

func TestVerifyDetectsCorruption(t *testing.T) {
	s := open(t)
	h, _ := put(t, s, []byte("pristine content"))
	p, _ := s.Path(h)
	if err := os.WriteFile(p, []byte("tampered content"), 0o640); err != nil {
		t.Fatal(err)
	}
	if ok, err := s.Verify(h); err != nil || ok {
		t.Fatalf("verify = %v, %v; want false", ok, err)
	}
}

func TestCorruptSameNameIsReplacedOnCommit(t *testing.T) {
	s := open(t)
	data := []byte("the real content")
	h, _ := put(t, s, data)
	p, _ := s.Path(h)
	os.WriteFile(p, []byte("short"), 0o640) // truncated blob with the right name
	if _, existed := put(t, s, data); existed {
		t.Fatal("truncated blob accepted as duplicate")
	}
	if ok, _ := s.Verify(h); !ok {
		t.Fatal("blob not repaired")
	}
}

func TestInvalidHashRejected(t *testing.T) {
	s := open(t)
	for _, h := range []string{"", "abc", "../../etc/passwd", sum(nil)[:63] + "Z", sum(nil) + "0"} {
		if _, err := s.Open(h); !errors.Is(err, ErrInvalidHash) {
			t.Errorf("Open(%q) err = %v, want ErrInvalidHash", h, err)
		}
	}
	if _, err := s.Open(sum([]byte("absent"))); !errors.Is(err, ErrNotFound) {
		t.Errorf("missing blob err = %v", err)
	}
}

func TestCleanTemp(t *testing.T) {
	s := open(t)
	w, _ := s.NewWriter()
	w.Write([]byte("crashed download"))
	// simulate a crash: the writer is never finished
	n, err := s.CleanTemp()
	if err != nil || n != 1 {
		t.Fatalf("CleanTemp = %d, %v", n, err)
	}
}
