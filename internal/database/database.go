// Package database opens the SQLite metadata database and applies schema
// migrations.
//
// SQLite runs in WAL mode. All writes go through a single connection (W) so
// that write transactions are serialised inside the process instead of
// failing with SQLITE_BUSY; reads use a small pool (R) and never block
// writers.
package database

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	_ "modernc.org/sqlite" // pure Go SQLite driver (no CGO)
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// DB bundles the write and read handles of the metadata database.
type DB struct {
	W    *sql.DB // single connection, used for every write
	R    *sql.DB // read-only pool
	Path string
}

// Open opens (creating if necessary) the database at path and migrates it to
// the newest schema.
func Open(ctx context.Context, path string) (*DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return nil, fmt.Errorf("create database directory: %w", err)
	}
	dsn := func(extra string) string {
		q := url.Values{}
		q.Add("_pragma", "busy_timeout(10000)")
		q.Add("_pragma", "journal_mode(WAL)")
		q.Add("_pragma", "synchronous(NORMAL)")
		q.Add("_pragma", "foreign_keys(ON)")
		q.Add("_txlock", "immediate")
		s := "file:" + filepath.ToSlash(path) + "?" + q.Encode()
		if extra != "" {
			s += "&" + extra
		}
		return s
	}
	w, err := sql.Open("sqlite", dsn(""))
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	w.SetMaxOpenConns(1)
	w.SetMaxIdleConns(1)
	w.SetConnMaxLifetime(0)
	if err := w.PingContext(ctx); err != nil {
		w.Close()
		return nil, fmt.Errorf("open database %s: %w", path, err)
	}
	db := &DB{W: w, Path: path}
	if err := db.migrate(ctx); err != nil {
		w.Close()
		return nil, err
	}
	r, err := sql.Open("sqlite", dsn("mode=ro"))
	if err != nil {
		w.Close()
		return nil, fmt.Errorf("open database (read): %w", err)
	}
	r.SetMaxOpenConns(4)
	r.SetMaxIdleConns(4)
	db.R = r
	return db, nil
}

// Close checkpoints the WAL and closes both handles.
func (db *DB) Close() error {
	if db.R != nil {
		db.R.Close()
	}
	_, _ = db.W.Exec("PRAGMA wal_checkpoint(TRUNCATE)")
	return db.W.Close()
}

// IntegrityCheck runs SQLite's quick integrity check.
func (db *DB) IntegrityCheck(ctx context.Context) error {
	var res string
	if err := db.W.QueryRowContext(ctx, "PRAGMA quick_check").Scan(&res); err != nil {
		return err
	}
	if res != "ok" {
		return fmt.Errorf("database integrity check failed: %s", res)
	}
	return nil
}

// Backup writes a consistent snapshot of the database to dst using
// VACUUM INTO. dst must not exist.
func (db *DB) Backup(ctx context.Context, dst string) error {
	if _, err := db.W.ExecContext(ctx, "VACUUM INTO ?", dst); err != nil {
		return fmt.Errorf("backup database: %w", err)
	}
	return nil
}

// SchemaVersion returns the highest applied migration number.
func (db *DB) SchemaVersion(ctx context.Context) (int, error) {
	var v sql.NullInt64
	err := db.W.QueryRowContext(ctx, "SELECT MAX(version) FROM schema_migrations").Scan(&v)
	return int(v.Int64), err
}

func (db *DB) migrate(ctx context.Context) error {
	if _, err := db.W.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}
	files, err := fs.Glob(migrationFS, "migrations/*.sql")
	if err != nil {
		return err
	}
	sort.Strings(files)
	current, err := db.SchemaVersion(ctx)
	if err != nil {
		return err
	}
	highest := 0
	for _, f := range files {
		base := filepath.Base(f)
		num, _, ok := strings.Cut(base, "_")
		version, convErr := strconv.Atoi(num)
		if !ok || convErr != nil {
			return fmt.Errorf("migration %q: name must start with a number", base)
		}
		if version > highest {
			highest = version
		}
		if version <= current {
			continue
		}
		body, err := migrationFS.ReadFile(f)
		if err != nil {
			return err
		}
		tx, err := db.W.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, string(body)); err != nil {
			tx.Rollback()
			return fmt.Errorf("apply migration %s: %w", base, err)
		}
		if _, err := tx.ExecContext(ctx,
			"INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
			version, base, time.Now().Unix()); err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit migration %s: %w", base, err)
		}
	}
	if current > highest {
		return fmt.Errorf("database schema version %d is newer than this release (%d); refusing to start", current, highest)
	}
	return nil
}
