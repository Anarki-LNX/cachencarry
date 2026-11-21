// Package cas implements the on-disk content addressable blob store.
//
// Layout below the root directory:
//
//	blobs/ab/cd/abcd…   completed blobs, named by their SHA-256
//	temp/               downloads in progress
//
// A blob only ever appears under blobs/ through an atomic rename of a fully
// written, fsynced temporary file, so a partially written file can never be
// observed as a valid blob. Higher layers (package storage) own reference
// tracking; this package only deals with bytes on disk.
package cas

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"hash"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
)

// ErrInvalidHash is returned for strings that are not a SHA-256 hex digest.
var ErrInvalidHash = errors.New("cas: invalid hash")

// ErrNotFound is returned when a blob does not exist on disk.
var ErrNotFound = errors.New("cas: blob not found")

// Store is a content addressable store rooted at a directory.
type Store struct {
	root     string
	blobDir  string
	tempDir  string
	noSync   bool // tests only: skip fsync
	renameMu sync.Mutex
}

// Open creates the directory layout if needed and returns the store.
func Open(root string) (*Store, error) {
	s := &Store{
		root:    root,
		blobDir: filepath.Join(root, "blobs"),
		tempDir: filepath.Join(root, "temp"),
	}
	for _, d := range []string{s.blobDir, s.tempDir} {
		if err := os.MkdirAll(d, 0o750); err != nil {
			return nil, fmt.Errorf("cas: create %s: %w", d, err)
		}
	}
	return s, nil
}

// Root returns the store root directory.
func (s *Store) Root() string { return s.root }

// ValidHash reports whether h is a lowercase hex SHA-256 digest.
func ValidHash(h string) bool {
	if len(h) != sha256.Size*2 {
		return false
	}
	for i := 0; i < len(h); i++ {
		c := h[i]
		if (c < '0' || c > '9') && (c < 'a' || c > 'f') {
			return false
		}
	}
	return true
}

// Path returns the on-disk location for hash. The hash is validated, so the
// result can never escape the blob directory.
func (s *Store) Path(hash string) (string, error) {
	if !ValidHash(hash) {
		return "", ErrInvalidHash
	}
	return filepath.Join(s.blobDir, hash[0:2], hash[2:4], hash), nil
}

// Open opens a blob for reading.
func (s *Store) Open(hash string) (*os.File, error) {
	p, err := s.Path(hash)
	if err != nil {
		return nil, err
	}
	f, err := os.Open(p)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, ErrNotFound
	}
	return f, err
}

// Stat returns the size of a blob, or ErrNotFound.
func (s *Store) Stat(hash string) (int64, error) {
	p, err := s.Path(hash)
	if err != nil {
		return 0, err
	}
	fi, err := os.Stat(p)
	if errors.Is(err, fs.ErrNotExist) {
		return 0, ErrNotFound
	}
	if err != nil {
		return 0, err
	}
	return fi.Size(), nil
}

// Remove deletes a blob. Removing a missing blob is not an error. Readers
// that already opened the file keep a valid descriptor.
func (s *Store) Remove(hash string) error {
	p, err := s.Path(hash)
	if err != nil {
		return err
	}
	if err := os.Remove(p); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	return nil
}

// Verify re-hashes a blob and reports whether its content still matches its
// name. A missing blob yields ErrNotFound.
func (s *Store) Verify(hash string) (bool, error) {
	f, err := s.Open(hash)
	if err != nil {
		return false, err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return false, err
	}
	return hex.EncodeToString(h.Sum(nil)) == hash, nil
}

// Walk calls fn for every blob file found on disk. Files whose name is not a
// valid hash, or which sit in the wrong fan-out directory, are reported with
// valid=false so the caller can quarantine or delete them.
func (s *Store) Walk(fn func(hash, path string, size int64, valid bool) error) error {
	return filepath.WalkDir(s.blobDir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				return nil
			}
			return err
		}
		if d.IsDir() {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				return nil // removed concurrently
			}
			return err
		}
		name := d.Name()
		want, perr := s.Path(name)
		return fn(name, p, info.Size(), perr == nil && want == p)
	})
}

// CleanTemp removes every file in the temp directory. It must only be called
// while no downloads are running (at startup).
func (s *Store) CleanTemp() (removed int, err error) {
	entries, err := os.ReadDir(s.tempDir)
	if err != nil {
		return 0, err
	}
	for _, e := range entries {
		if rmErr := os.RemoveAll(filepath.Join(s.tempDir, e.Name())); rmErr != nil {
			err = errors.Join(err, rmErr)
			continue
		}
		removed++
	}
	return removed, err
}

// Writer receives the bytes of one object. Data is written to a temporary
// file and hashed on the way; Commit publishes it atomically.
type Writer struct {
	store *Store
	f     *os.File
	path  string
	h     hash.Hash
	n     int64
	done  bool
}

// NewWriter starts a new temporary object.
func (s *Store) NewWriter() (*Writer, error) {
	f, err := os.CreateTemp(s.tempDir, "dl-*")
	if err != nil {
		return nil, fmt.Errorf("cas: create temp file: %w", err)
	}
	return &Writer{store: s, f: f, path: f.Name(), h: sha256.New()}, nil
}

// Write appends p to the temporary object.
func (w *Writer) Write(p []byte) (int, error) {
	n, err := w.f.Write(p)
	if n > 0 {
		w.h.Write(p[:n])
		w.n += int64(n)
	}
	return n, err
}

// TempPath is the location of the growing temporary file. Readers may open
// it to follow a download in progress; the descriptor stays valid after
// Commit or Abort.
func (w *Writer) TempPath() string { return w.path }

// Size is the number of bytes written so far.
func (w *Writer) Size() int64 { return w.n }

// Abort discards the temporary object. It is safe to call after Commit.
func (w *Writer) Abort() {
	if w.done {
		return
	}
	w.done = true
	w.f.Close()
	os.Remove(w.path)
}

// Commit finishes the object: the data is flushed to stable storage and the
// file is renamed to its content address. If a blob with the same content
// already exists the temporary file is dropped instead (deduplication) and
// existed is true.
func (w *Writer) Commit() (hash string, size int64, existed bool, err error) {
	if w.done {
		return "", 0, false, errors.New("cas: writer already finished")
	}
	w.done = true
	defer func() {
		if err != nil {
			os.Remove(w.path)
		}
	}()
	if !w.store.noSync {
		if err = w.f.Sync(); err != nil {
			w.f.Close()
			return "", 0, false, fmt.Errorf("cas: sync: %w", err)
		}
	}
	if err = w.f.Close(); err != nil {
		return "", 0, false, fmt.Errorf("cas: close: %w", err)
	}
	hash = hex.EncodeToString(w.h.Sum(nil))
	size = w.n
	dst, _ := w.store.Path(hash)
	dir := filepath.Dir(dst)
	if err = os.MkdirAll(dir, 0o750); err != nil {
		return "", 0, false, fmt.Errorf("cas: mkdir: %w", err)
	}
	if err = os.Chmod(w.path, 0o640); err != nil {
		return "", 0, false, fmt.Errorf("cas: chmod: %w", err)
	}

	// Serialise the exists-check + rename so two writers finishing the same
	// content agree on who published it. The critical section is tiny.
	w.store.renameMu.Lock()
	fi, statErr := os.Stat(dst)
	if statErr == nil && fi.Size() == size {
		w.store.renameMu.Unlock()
		os.Remove(w.path)
		return hash, size, true, nil
	}
	// Either the blob is new, or a file with the right name but the wrong
	// size is in the way (corruption); the rename replaces it atomically.
	err = os.Rename(w.path, dst)
	w.store.renameMu.Unlock()
	if err != nil {
		return "", 0, false, fmt.Errorf("cas: publish: %w", err)
	}
	if !w.store.noSync {
		syncDir(dir)
	}
	return hash, size, false, nil
}

// syncDir flushes a directory so a rename survives power loss. Errors are
// ignored: some filesystems do not support fsync on directories.
func syncDir(dir string) {
	if d, err := os.Open(dir); err == nil {
		d.Sync()
		d.Close()
	}
}

// DisableSync turns fsync off. Only for tests.
func (s *Store) DisableSync() { s.noSync = true }
