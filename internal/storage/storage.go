// Package storage is the shared storage engine of UniCache.
//
// It combines the content addressable blob store (package cas) with the
// metadata database and is the only API protocol adapters and the proxy use
// to read or write cached content. Blobs are deduplicated by SHA-256; cache
// entries (module, repository, path) reference blobs. A blob is removed only
// when no entry references it any more.
//
// # Concurrency model
//
// Publishing an object consists of two steps that are not atomic on their
// own: renaming the temp file into the blob directory and committing the
// database transaction that references it. Garbage collection must never
// observe the state in between (a blob file without references that is about
// to get one). The gate RWMutex provides that guarantee: publishers hold it
// shared for the (short) rename + transaction, the garbage collector holds
// it exclusively while it decides about and deletes a small batch of blobs.
// Downloads themselves never hold the gate.
package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Anarki-LNX/unicache/internal/database"
	"github.com/Anarki-LNX/unicache/internal/storage/cas"
)

// ErrNotFound is returned when no cache entry exists for a key.
var ErrNotFound = errors.New("storage: entry not found")

// Key identifies a cached object. Repository identity is part of the key, so
// two repositories never share an entry even if the path is identical; they
// still share the blob when the content is identical.
type Key struct {
	Module string
	Repo   string
	Path   string
}

func (k Key) String() string { return k.Module + "/" + k.Repo + "/" + k.Path }

// Entry is the metadata of one cached object.
type Entry struct {
	ID           int64
	Key          Key
	BlobHash     string
	Size         int64
	ContentType  string
	ETag         string
	LastModified string
	UpstreamURL  string
	Immutable    bool
	Pinned       bool
	CreatedAt    time.Time
	ValidatedAt  time.Time
	ExpiresAt    time.Time // zero: never needs revalidation
	LastAccess   time.Time
	Hits         int64
}

// Fresh reports whether the entry may be served without revalidation.
func (e *Entry) Fresh(now time.Time) bool {
	return e.Immutable || e.ExpiresAt.IsZero() || now.Before(e.ExpiresAt)
}

// Meta is the metadata a publisher supplies for a new object.
type Meta struct {
	ContentType  string
	ETag         string
	LastModified string
	UpstreamURL  string
	Immutable    bool
	TTL          time.Duration // ignored for immutable objects; 0 = always revalidate
}

// Options configure a Store.
type Options struct {
	Root         string
	MaxSize      int64   // 0 = unlimited
	MinFreeBytes int64   // absolute minimum free space, 0 = off
	MinFreePct   float64 // minimum free space in percent, 0 = off
	Logger       *slog.Logger
	NoSync       bool // tests only
	// KickInterval is the minimum time between limit checks triggered by
	// newly published data (default 5s).
	KickInterval time.Duration
}

// Store is the shared storage engine.
type Store struct {
	cas  *cas.Store
	db   *database.DB
	opts Options
	log  *slog.Logger

	gate sync.RWMutex // see package documentation

	touchMu sync.Mutex
	touches map[int64]*touch

	limits atomic.Pointer[Limits]

	// kick asks the maintenance loop to check the size limits soon
	// (after new data was published) instead of waiting for the next tick.
	kick chan struct{}

	evictMu     sync.Mutex
	lastEvict   EvictionReport
	lastGC      GCReport
	lastVerify  VerifyReport
	maintenance sync.Mutex // serialises GC / eviction / verify runs
}

type touch struct {
	at   int64
	hits int64
}

// Open opens the storage engine rooted at opts.Root.
func Open(db *database.DB, opts Options) (*Store, error) {
	c, err := cas.Open(opts.Root)
	if err != nil {
		return nil, err
	}
	if opts.NoSync {
		c.DisableSync()
	}
	log := opts.Logger
	if log == nil {
		log = slog.Default()
	}
	s := &Store{cas: c, db: db, opts: opts, log: log, touches: map[int64]*touch{}, kick: make(chan struct{}, 1)}
	s.limits.Store(&Limits{MaxSize: opts.MaxSize, MinFreeBytes: opts.MinFreeBytes, MinFreePct: opts.MinFreePct})
	return s, nil
}

// Limits are the storage limits enforced by eviction. They can be changed
// while the store is in use.
type Limits struct {
	MaxSize      int64   // 0 = unlimited
	MinFreeBytes int64   // absolute minimum free space, 0 = off
	MinFreePct   float64 // minimum free space in percent, 0 = off
}

// Limits returns the active storage limits.
func (s *Store) Limits() Limits { return *s.limits.Load() }

// SetLimits replaces the storage limits and triggers a limit check, so a
// lowered limit is enforced right away.
func (s *Store) SetLimits(l Limits) {
	s.limits.Store(&l)
	s.kickEviction()
}

func (s *Store) kickEviction() {
	select {
	case s.kick <- struct{}{}:
	default:
	}
}

// Root returns the storage root directory.
func (s *Store) Root() string { return s.opts.Root }

// Writer receives the content of one object before it is published.
type Writer struct {
	w *cas.Writer
}

// NewWriter starts a temporary object. Every writer must end in exactly one
// Publish, Discard or Abort call.
func (s *Store) NewWriter() (*Writer, error) {
	w, err := s.cas.NewWriter()
	if err != nil {
		return nil, err
	}
	return &Writer{w: w}, nil
}

func (w *Writer) Write(p []byte) (int, error) { return w.w.Write(p) }

// TempPath is the growing temporary file; see cas.Writer.TempPath.
func (w *Writer) TempPath() string { return w.w.TempPath() }

// Size is the number of bytes written so far.
func (w *Writer) Size() int64 { return w.w.Size() }

// Abort discards the object.
func (w *Writer) Abort() { w.w.Abort() }

const entryCols = `id, module, repo, path, blob_hash, size, content_type, etag, last_modified,
	upstream_url, immutable, pinned, created_at, validated_at, expires_at, last_access, hits`

type scanner interface{ Scan(dest ...any) error }

func scanEntry(row scanner) (*Entry, error) {
	var e Entry
	var created, validated, expires, access int64
	err := row.Scan(&e.ID, &e.Key.Module, &e.Key.Repo, &e.Key.Path, &e.BlobHash, &e.Size,
		&e.ContentType, &e.ETag, &e.LastModified, &e.UpstreamURL, &e.Immutable, &e.Pinned,
		&created, &validated, &expires, &access, &e.Hits)
	if err != nil {
		return nil, err
	}
	e.CreatedAt = time.Unix(created, 0)
	e.ValidatedAt = time.Unix(validated, 0)
	if expires != 0 {
		e.ExpiresAt = time.Unix(expires, 0)
	}
	e.LastAccess = time.Unix(access, 0)
	return &e, nil
}

// Publish atomically turns the written data into a cache entry for key. The
// blob is deduplicated against existing content; an existing entry for the
// same key is replaced. On error the temporary data is discarded.
func (s *Store) Publish(ctx context.Context, w *Writer, key Key, m Meta) (*Entry, error) {
	// fsync before taking the gate: it can take long for large objects and
	// must not hold up garbage collection or other publishers.
	if err := w.w.Seal(); err != nil {
		return nil, err
	}
	defer s.kickEviction()
	s.gate.RLock()
	defer s.gate.RUnlock()

	hash, size, existed, err := w.w.Commit()
	if err != nil {
		return nil, err
	}
	now := time.Now().Unix()
	var expires int64
	if !m.Immutable {
		// TTL 0 means "revalidate on every use": the entry expires now.
		expires = now + int64(m.TTL/time.Second)
	}

	// The write connection is not bound to the request context on purpose:
	// a client that disconnects must not abort the publication of an object
	// other clients are waiting for.
	_ = ctx
	tx, err := s.db.W.Begin()
	if err != nil {
		s.dropUnreferenced(hash, existed)
		return nil, fmt.Errorf("storage: begin publish: %w", err)
	}
	defer tx.Rollback()
	if _, err = tx.Exec(`INSERT INTO blobs (hash, size, created_at, verified_at) VALUES (?, ?, ?, ?)
		ON CONFLICT(hash) DO NOTHING`, hash, size, now, now); err != nil {
		s.dropUnreferenced(hash, existed)
		return nil, fmt.Errorf("storage: insert blob: %w", err)
	}
	row := tx.QueryRow(`INSERT INTO entries (module, repo, path, blob_hash, size, content_type, etag,
			last_modified, upstream_url, immutable, created_at, validated_at, expires_at, last_access)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(module, repo, path) DO UPDATE SET
			blob_hash = excluded.blob_hash, size = excluded.size,
			content_type = excluded.content_type, etag = excluded.etag,
			last_modified = excluded.last_modified, upstream_url = excluded.upstream_url,
			immutable = excluded.immutable, validated_at = excluded.validated_at,
			expires_at = excluded.expires_at, last_access = excluded.last_access
		RETURNING `+entryCols,
		key.Module, key.Repo, key.Path, hash, size, m.ContentType, m.ETag, m.LastModified,
		m.UpstreamURL, m.Immutable, now, now, expires, now)
	e, err := scanEntry(row)
	if err != nil {
		s.dropUnreferenced(hash, existed)
		return nil, fmt.Errorf("storage: upsert entry: %w", err)
	}
	if err = tx.Commit(); err != nil {
		s.dropUnreferenced(hash, existed)
		return nil, fmt.Errorf("storage: commit publish: %w", err)
	}
	return e, nil
}

// dropUnreferenced removes a blob file this publisher just created when the
// database step failed. A pre-existing blob is left alone; if it really is
// unreferenced the garbage collector will find it.
func (s *Store) dropUnreferenced(hash string, existed bool) {
	if !existed {
		if err := s.cas.Remove(hash); err != nil {
			s.log.Warn("storage: cannot remove blob after failed publish", "hash", hash, "err", err)
		}
	}
}

// Lookup returns the entry for key or ErrNotFound.
func (s *Store) Lookup(ctx context.Context, key Key) (*Entry, error) {
	row := s.db.R.QueryRowContext(ctx, `SELECT `+entryCols+` FROM entries
		WHERE module = ? AND repo = ? AND path = ?`, key.Module, key.Repo, key.Path)
	e, err := scanEntry(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return e, err
}

// Open opens the content of an entry. If the blob file is missing (it was
// evicted concurrently or lost) the dangling entry is removed and
// ErrNotFound is returned, so the caller falls back to a fresh download.
func (s *Store) Open(e *Entry) (*os.File, error) {
	f, err := s.cas.Open(e.BlobHash)
	if errors.Is(err, cas.ErrNotFound) {
		if _, derr := s.db.W.Exec(`DELETE FROM entries WHERE id = ? AND blob_hash = ?`, e.ID, e.BlobHash); derr != nil {
			s.log.Warn("storage: cannot drop dangling entry", "key", e.Key.String(), "err", derr)
		}
		return nil, ErrNotFound
	}
	return f, err
}

// Touch records a cache hit. Updates are buffered and written in batches.
func (s *Store) Touch(e *Entry) {
	now := time.Now().Unix()
	s.touchMu.Lock()
	t := s.touches[e.ID]
	if t == nil {
		t = &touch{}
		s.touches[e.ID] = t
	}
	t.at = now
	t.hits++
	s.touchMu.Unlock()
}

// FlushTouches writes buffered access times to the database.
func (s *Store) FlushTouches() error {
	s.touchMu.Lock()
	batch := s.touches
	s.touches = map[int64]*touch{}
	s.touchMu.Unlock()
	if len(batch) == 0 {
		return nil
	}
	tx, err := s.db.W.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	stmt, err := tx.Prepare(`UPDATE entries SET last_access = MAX(last_access, ?), hits = hits + ? WHERE id = ?`)
	if err != nil {
		return err
	}
	defer stmt.Close()
	for id, t := range batch {
		if _, err := stmt.Exec(t.at, t.hits, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// Revalidated marks an entry as confirmed fresh by the upstream (HTTP 304)
// and extends its lifetime by ttl.
func (s *Store) Revalidated(e *Entry, ttl time.Duration) error {
	now := time.Now()
	exp := now.Add(ttl)
	_, err := s.db.W.Exec(`UPDATE entries SET validated_at = ?, expires_at = ? WHERE id = ? AND immutable = 0`,
		now.Unix(), exp.Unix(), e.ID)
	if err == nil {
		e.ValidatedAt, e.ExpiresAt = now, exp
	}
	return err
}

// SetPinned pins or unpins an entry. Pinned entries are never evicted.
func (s *Store) SetPinned(ctx context.Context, id int64, pinned bool) error {
	res, err := s.db.W.ExecContext(ctx, `UPDATE entries SET pinned = ? WHERE id = ?`, pinned, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteEntry removes one entry. Its blob is reclaimed by the next garbage
// collection if nothing else references it.
func (s *Store) DeleteEntry(ctx context.Context, id int64) error {
	res, err := s.db.W.ExecContext(ctx, `DELETE FROM entries WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteRepo removes every entry of a repository and returns their count.
func (s *Store) DeleteRepo(ctx context.Context, module, repo string) (int64, error) {
	res, err := s.db.W.ExecContext(ctx, `DELETE FROM entries WHERE module = ? AND repo = ?`, module, repo)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// ListFilter selects entries for ListEntries.
type ListFilter struct {
	Module string
	Repo   string
	Search string
	Pinned bool
	Sort   string // "recent" (default), "size", "hits"
	Limit  int
	Offset int
}

// ListEntries returns entries matching the filter and the total match count.
func (s *Store) ListEntries(ctx context.Context, f ListFilter) ([]*Entry, int64, error) {
	where := "WHERE 1=1"
	var args []any
	if f.Module != "" {
		where += " AND module = ?"
		args = append(args, f.Module)
	}
	if f.Repo != "" {
		where += " AND repo = ?"
		args = append(args, f.Repo)
	}
	if f.Search != "" {
		where += " AND instr(path, ?) > 0"
		args = append(args, f.Search)
	}
	if f.Pinned {
		where += " AND pinned = 1"
	}
	order := "last_access DESC"
	switch f.Sort {
	case "size":
		order = "size DESC"
	case "hits":
		order = "hits DESC"
	}
	if f.Limit <= 0 || f.Limit > 500 {
		f.Limit = 100
	}
	if f.Offset < 0 {
		f.Offset = 0
	}
	var total int64
	if err := s.db.R.QueryRowContext(ctx, "SELECT COUNT(*) FROM entries "+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.db.R.QueryContext(ctx, "SELECT "+entryCols+" FROM entries "+where+
		" ORDER BY "+order+", id LIMIT ? OFFSET ?", append(args, f.Limit, f.Offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []*Entry
	for rows.Next() {
		e, err := scanEntry(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, e)
	}
	return out, total, rows.Err()
}

// ModuleUsage is the storage accounting of one module.
type ModuleUsage struct {
	Module       string `json:"module"`
	Entries      int64  `json:"entries"`
	LogicalBytes int64  `json:"logical_bytes"` // sum of entry sizes (before dedup)
	Pinned       int64  `json:"pinned"`
}

// Usage is the storage accounting snapshot shown in the dashboard.
type Usage struct {
	BlobCount    int64         `json:"blob_count"`
	BlobBytes    int64         `json:"blob_bytes"` // bytes actually stored
	EntryCount   int64         `json:"entry_count"`
	LogicalBytes int64         `json:"logical_bytes"` // bytes if nothing were deduplicated
	DedupSaved   int64         `json:"dedup_saved"`   // logical - referenced blob bytes
	PinnedCount  int64         `json:"pinned_count"`
	MaxSize      int64         `json:"max_size"`
	DiskTotal    int64         `json:"disk_total"`
	DiskFree     int64         `json:"disk_free"`
	MinFree      int64         `json:"min_free"`
	Modules      []ModuleUsage `json:"modules"`
}

// Usage computes the current storage accounting.
func (s *Store) Usage(ctx context.Context) (*Usage, error) {
	u := &Usage{MaxSize: s.limits.Load().MaxSize}
	if err := s.db.R.QueryRowContext(ctx, `SELECT COUNT(*), COALESCE(SUM(size), 0) FROM blobs`).
		Scan(&u.BlobCount, &u.BlobBytes); err != nil {
		return nil, err
	}
	var referenced int64
	if err := s.db.R.QueryRowContext(ctx, `SELECT COALESCE(SUM(size), 0) FROM blobs
		WHERE hash IN (SELECT blob_hash FROM entries)`).Scan(&referenced); err != nil {
		return nil, err
	}
	rows, err := s.db.R.QueryContext(ctx, `SELECT module, COUNT(*), COALESCE(SUM(size), 0),
		COALESCE(SUM(pinned), 0) FROM entries GROUP BY module ORDER BY module`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var m ModuleUsage
		if err := rows.Scan(&m.Module, &m.Entries, &m.LogicalBytes, &m.Pinned); err != nil {
			return nil, err
		}
		u.EntryCount += m.Entries
		u.LogicalBytes += m.LogicalBytes
		u.PinnedCount += m.Pinned
		u.Modules = append(u.Modules, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	u.DedupSaved = u.LogicalBytes - referenced
	if total, free, err := diskSpace(s.opts.Root); err == nil {
		u.DiskTotal, u.DiskFree = total, free
		u.MinFree = s.minFree(total)
	}
	return u, nil
}

func (s *Store) minFree(diskTotal int64) int64 {
	l := s.limits.Load()
	min := l.MinFreeBytes
	if l.MinFreePct > 0 {
		if pct := int64(float64(diskTotal) * l.MinFreePct / 100); pct > min {
			min = pct
		}
	}
	return min
}
