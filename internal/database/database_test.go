package database

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestOpenMigrateReopenBackup(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	path := filepath.Join(dir, "sub", "metadata.db")
	db, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	v, err := db.SchemaVersion(ctx)
	if err != nil || v < 1 {
		t.Fatalf("schema version %d, %v", v, err)
	}
	if _, err := db.W.Exec(`INSERT INTO settings (key, value) VALUES ('k', 'v')`); err != nil {
		t.Fatal(err)
	}
	// The read handle really is read-only.
	if _, err := db.R.Exec(`INSERT INTO settings (key, value) VALUES ('x', 'y')`); err == nil {
		t.Fatal("write through the read-only handle succeeded")
	}
	// Foreign keys are enforced.
	if _, err := db.W.Exec(`INSERT INTO entries (module, repo, path, blob_hash, size, created_at, validated_at, last_access)
		VALUES ('m', 'r', 'p', 'no-such-blob', 1, 0, 0, 0)`); err == nil {
		t.Fatal("entry referencing a missing blob was accepted")
	}
	backup := filepath.Join(dir, "backup.db")
	if err := db.Backup(ctx, backup); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	// Reopening applies no migration twice and keeps the data.
	db, err = Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	var val string
	if err := db.R.QueryRow(`SELECT value FROM settings WHERE key = 'k'`).Scan(&val); err != nil || val != "v" {
		t.Fatalf("data lost: %q, %v", val, err)
	}
	if v2, _ := db.SchemaVersion(ctx); v2 != v {
		t.Fatalf("schema version changed on reopen: %d -> %d", v, v2)
	}
	if err := db.IntegrityCheck(ctx); err != nil {
		t.Fatal(err)
	}
	db.Close()

	// The backup is a complete, usable database.
	bdb, err := Open(ctx, backup)
	if err != nil {
		t.Fatal(err)
	}
	if err := bdb.R.QueryRow(`SELECT value FROM settings WHERE key = 'k'`).Scan(&val); err != nil || val != "v" {
		t.Fatalf("backup incomplete: %v", err)
	}
	bdb.Close()
}

func TestNewerSchemaIsRefused(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "m.db")
	db, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	db.W.Exec(`INSERT INTO schema_migrations (version, name, applied_at) VALUES (9999, 'future', 0)`)
	db.Close()
	if _, err := Open(ctx, path); err == nil {
		t.Fatal("database from a newer release was opened")
	}
}

func TestCorruptDatabaseIsDetected(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "m.db")
	if err := os.WriteFile(path, []byte("this is not a sqlite database, just garbage bytes................"), 0o600); err != nil {
		t.Fatal(err)
	}
	if db, err := Open(ctx, path); err == nil {
		db.Close()
		t.Fatal("garbage file opened as database")
	}
}
