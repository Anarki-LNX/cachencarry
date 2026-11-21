// Package testutil contains helpers shared by the test suites.
package testutil

import (
	"context"
	"io"
	"log/slog"
	"path/filepath"
	"testing"

	"github.com/Anarki-LNX/unicache/internal/database"
	"github.com/Anarki-LNX/unicache/internal/storage"
)

// Logger returns a logger that discards everything.
func Logger() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

// DB opens a fresh database in a temporary directory.
func DB(t testing.TB, dir string) *database.DB {
	t.Helper()
	db, err := database.Open(context.Background(), filepath.Join(dir, "metadata.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

// Store opens a fresh storage engine (fsync disabled) in a temp directory.
func Store(t testing.TB, opts storage.Options) (*storage.Store, *database.DB) {
	t.Helper()
	if opts.Root == "" {
		opts.Root = t.TempDir()
	}
	db := DB(t, opts.Root)
	opts.NoSync = true
	opts.Logger = Logger()
	s, err := storage.Open(db, opts)
	if err != nil {
		t.Fatalf("open storage: %v", err)
	}
	return s, db
}

// Put publishes data under key and returns the entry.
func Put(t testing.TB, s *storage.Store, key storage.Key, data []byte, m storage.Meta) *storage.Entry {
	t.Helper()
	w, err := s.NewWriter()
	if err != nil {
		t.Fatalf("new writer: %v", err)
	}
	if _, err := w.Write(data); err != nil {
		t.Fatalf("write: %v", err)
	}
	e, err := s.Publish(context.Background(), w, key, m)
	if err != nil {
		t.Fatalf("publish: %v", err)
	}
	return e
}
