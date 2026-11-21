package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/Anarki-LNX/unicache/internal/storage/cas"
)

// GCReport summarises one garbage collection run.
type GCReport struct {
	At           time.Time `json:"at"`
	BlobsRemoved int64     `json:"blobs_removed"`
	BytesFreed   int64     `json:"bytes_freed"`
}

// EvictionReport summarises one eviction run.
type EvictionReport struct {
	At             time.Time `json:"at"`
	Reason         string    `json:"reason"` // "", "max_size", "min_free", "max_size+min_free"
	EntriesRemoved int64     `json:"entries_removed"`
	BytesFreed     int64     `json:"bytes_freed"`
	Unsatisfied    bool      `json:"unsatisfied"` // limits still exceeded (everything left is pinned)
}

// VerifyReport summarises one integrity verification run.
type VerifyReport struct {
	At      time.Time `json:"at"`
	Checked int64     `json:"checked"`
	Corrupt int64     `json:"corrupt"`
	Missing int64     `json:"missing"`
}

// RecoveryReport summarises the startup consistency check.
type RecoveryReport struct {
	TempRemoved    int   `json:"temp_removed"`
	OrphanFiles    int64 `json:"orphan_files"`    // blob files without database row
	MissingBlobs   int64 `json:"missing_blobs"`   // database rows without (intact) file
	EntriesDropped int64 `json:"entries_dropped"` // entries that pointed to missing blobs
}

// MaintenanceStatus is the last result of each background job.
type MaintenanceStatus struct {
	GC       GCReport       `json:"gc"`
	Eviction EvictionReport `json:"eviction"`
	Verify   VerifyReport   `json:"verify"`
}

// Status returns the most recent maintenance reports.
func (s *Store) Status() MaintenanceStatus {
	s.evictMu.Lock()
	defer s.evictMu.Unlock()
	return MaintenanceStatus{GC: s.lastGC, Eviction: s.lastEvict, Verify: s.lastVerify}
}

const gcBatch = 200

// GC deletes blobs that no entry references. It is safe to run while
// downloads and publications are in progress (see the package comment).
func (s *Store) GC(ctx context.Context) (GCReport, error) {
	s.maintenance.Lock()
	defer s.maintenance.Unlock()
	return s.gc(ctx)
}

func (s *Store) gc(ctx context.Context) (GCReport, error) {
	rep := GCReport{At: time.Now()}
	for {
		if err := ctx.Err(); err != nil {
			return rep, err
		}
		removed, freed, err := s.gcBatch(ctx)
		rep.BlobsRemoved += removed
		rep.BytesFreed += freed
		if err != nil {
			return rep, err
		}
		if removed == 0 {
			break
		}
	}
	s.evictMu.Lock()
	s.lastGC = rep
	s.evictMu.Unlock()
	if rep.BlobsRemoved > 0 {
		s.log.Info("garbage collection finished", "blobs", rep.BlobsRemoved, "bytes", rep.BytesFreed)
	}
	return rep, nil
}

func (s *Store) gcBatch(ctx context.Context) (removed, freed int64, err error) {
	// Candidate selection happens without the gate; the decision is
	// re-checked under the exclusive gate below.
	rows, err := s.db.R.QueryContext(ctx, `SELECT hash FROM blobs b
		WHERE NOT EXISTS (SELECT 1 FROM entries e WHERE e.blob_hash = b.hash) LIMIT ?`, gcBatch)
	if err != nil {
		return 0, 0, err
	}
	var candidates []string
	for rows.Next() {
		var h string
		if err := rows.Scan(&h); err != nil {
			rows.Close()
			return 0, 0, err
		}
		candidates = append(candidates, h)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, 0, err
	}
	if len(candidates) == 0 {
		return 0, 0, nil
	}

	s.gate.Lock()
	defer s.gate.Unlock()
	tx, err := s.db.W.Begin()
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback()
	var doomed []string
	for _, h := range candidates {
		var size int64
		err := tx.QueryRow(`DELETE FROM blobs WHERE hash = ?
			AND NOT EXISTS (SELECT 1 FROM entries WHERE blob_hash = ?) RETURNING size`, h, h).Scan(&size)
		if errors.Is(err, sql.ErrNoRows) {
			continue // referenced again in the meantime
		}
		if err != nil {
			return 0, 0, err
		}
		doomed = append(doomed, h)
		freed += size
	}
	if err := tx.Commit(); err != nil {
		return 0, 0, err
	}
	// Files are removed after the rows are gone and while publishers are
	// still locked out. A crash in between leaves orphan files, which the
	// startup recovery deletes.
	for _, h := range doomed {
		if err := s.cas.Remove(h); err != nil {
			s.log.Warn("gc: cannot remove blob file", "hash", h, "err", err)
		}
	}
	return int64(len(doomed)), freed, nil
}

// ExpireUnused removes unpinned entries that were not accessed for maxAge.
func (s *Store) ExpireUnused(ctx context.Context, maxAge time.Duration) (int64, error) {
	if maxAge <= 0 {
		return 0, nil
	}
	if err := s.FlushTouches(); err != nil {
		return 0, err
	}
	res, err := s.db.W.ExecContext(ctx, `DELETE FROM entries WHERE pinned = 0 AND last_access < ?`,
		time.Now().Add(-maxAge).Unix())
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// excess returns how many bytes must be freed to satisfy the limits.
func (s *Store) excess(ctx context.Context) (need int64, reason string, err error) {
	var blobBytes int64
	if err := s.db.R.QueryRowContext(ctx, `SELECT COALESCE(SUM(size), 0) FROM blobs`).Scan(&blobBytes); err != nil {
		return 0, "", err
	}
	if s.opts.MaxSize > 0 && blobBytes > s.opts.MaxSize {
		need = blobBytes - s.opts.MaxSize
		reason = "max_size"
	}
	if total, free, derr := diskSpace(s.opts.Root); derr == nil {
		if min := s.minFree(total); min > 0 && free < min {
			if d := min - free; d > need {
				need = d
			}
			if reason != "" {
				reason += "+"
			}
			reason += "min_free"
		}
	}
	return need, reason, nil
}

// Evict enforces the size limits by removing the least recently used,
// unpinned entries and collecting the blobs they released.
func (s *Store) Evict(ctx context.Context) (EvictionReport, error) {
	s.maintenance.Lock()
	defer s.maintenance.Unlock()
	rep := EvictionReport{At: time.Now()}
	if err := s.FlushTouches(); err != nil {
		return rep, err
	}
	for {
		if err := ctx.Err(); err != nil {
			return rep, err
		}
		need, reason, err := s.excess(ctx)
		if err != nil {
			return rep, err
		}
		if need <= 0 {
			break
		}
		if rep.Reason == "" {
			rep.Reason = reason
		}
		// Remove LRU entries until their combined size covers the need
		// (at most one batch per round; deduplicated blobs may free less
		// than the entry sizes suggest, hence the loop).
		res, err := s.db.W.ExecContext(ctx, `DELETE FROM entries WHERE id IN (
			SELECT id FROM (
				SELECT id, SUM(size) OVER (ORDER BY last_access, id
					ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS before
				FROM entries WHERE pinned = 0 ORDER BY last_access, id LIMIT 500
			) WHERE before IS NULL OR before < ?)`, need)
		if err != nil {
			return rep, err
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			rep.Unsatisfied = true
			s.log.Warn("eviction: storage limits exceeded but nothing left to evict (pinned entries only)",
				"need_bytes", need)
			break
		}
		rep.EntriesRemoved += n
		gc, err := s.gc(ctx)
		rep.BytesFreed += gc.BytesFreed
		if err != nil {
			return rep, err
		}
	}
	s.evictMu.Lock()
	s.lastEvict = rep
	s.evictMu.Unlock()
	if rep.EntriesRemoved > 0 {
		s.log.Info("eviction finished", "reason", rep.Reason, "entries", rep.EntriesRemoved, "bytes", rep.BytesFreed)
	}
	return rep, nil
}

// purgeBlob removes a damaged or missing blob together with every entry
// that references it, so the next request downloads it again.
func (s *Store) purgeBlob(hash string) (entries int64, err error) {
	s.gate.Lock()
	defer s.gate.Unlock()
	tx, err := s.db.W.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	res, err := tx.Exec(`DELETE FROM entries WHERE blob_hash = ?`, hash)
	if err != nil {
		return 0, err
	}
	entries, _ = res.RowsAffected()
	if _, err := tx.Exec(`DELETE FROM blobs WHERE hash = ?`, hash); err != nil {
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return entries, s.cas.Remove(hash)
}

// Verify re-hashes up to limit blobs, oldest verification first, and purges
// blobs whose content no longer matches their hash.
func (s *Store) Verify(ctx context.Context, limit int) (VerifyReport, error) {
	s.maintenance.Lock()
	defer s.maintenance.Unlock()
	rep := VerifyReport{At: time.Now()}
	rows, err := s.db.R.QueryContext(ctx, `SELECT hash FROM blobs ORDER BY verified_at, hash LIMIT ?`, limit)
	if err != nil {
		return rep, err
	}
	var hashes []string
	for rows.Next() {
		var h string
		if err := rows.Scan(&h); err != nil {
			rows.Close()
			return rep, err
		}
		hashes = append(hashes, h)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return rep, err
	}
	for _, h := range hashes {
		if err := ctx.Err(); err != nil {
			return rep, err
		}
		ok, err := s.cas.Verify(h)
		switch {
		case errors.Is(err, cas.ErrNotFound):
			// Either collected concurrently (row gone too) or truly lost.
			var one int
			if qerr := s.db.R.QueryRowContext(ctx, `SELECT 1 FROM blobs WHERE hash = ?`, h).Scan(&one); qerr != nil {
				continue
			}
			rep.Missing++
			if _, perr := s.purgeBlob(h); perr != nil {
				return rep, perr
			}
			s.log.Error("integrity: blob file missing, entries dropped", "hash", h)
		case err != nil:
			return rep, fmt.Errorf("verify %s: %w", h, err)
		case !ok:
			rep.Corrupt++
			if _, perr := s.purgeBlob(h); perr != nil {
				return rep, perr
			}
			s.log.Error("integrity: blob content does not match its hash, purged", "hash", h)
		default:
			if _, err := s.db.W.ExecContext(ctx, `UPDATE blobs SET verified_at = ? WHERE hash = ?`,
				time.Now().Unix(), h); err != nil {
				return rep, err
			}
		}
		rep.Checked++
	}
	s.evictMu.Lock()
	s.lastVerify = rep
	s.evictMu.Unlock()
	return rep, nil
}

// CleanTemp removes leftovers of interrupted downloads. Call it once at
// startup before any download starts.
func (s *Store) CleanTemp() (int, error) { return s.cas.CleanTemp() }

// Recover reconciles the blob directory with the database after a crash:
// blob files nobody knows about are deleted, and database rows whose file is
// missing or truncated are dropped together with their entries. It may run
// concurrently with normal operation.
func (s *Store) Recover(ctx context.Context) (RecoveryReport, error) {
	s.maintenance.Lock()
	defer s.maintenance.Unlock()
	var rep RecoveryReport

	// Pass 1: files without a row.
	err := s.cas.Walk(func(hash, path string, size int64, valid bool) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		if valid {
			var one int
			err := s.db.R.QueryRowContext(ctx, `SELECT 1 FROM blobs WHERE hash = ?`, hash).Scan(&one)
			if err == nil {
				return nil
			}
			if !errors.Is(err, sql.ErrNoRows) {
				return err
			}
		}
		// Re-check under the exclusive gate: a publisher may have renamed
		// the file but not yet committed its row.
		s.gate.Lock()
		defer s.gate.Unlock()
		if valid {
			var one int
			if err := s.db.W.QueryRow(`SELECT 1 FROM blobs WHERE hash = ?`, hash).Scan(&one); err == nil {
				return nil
			}
		}
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
		rep.OrphanFiles++
		return nil
	})
	if err != nil {
		return rep, fmt.Errorf("recover: scan blobs: %w", err)
	}

	// Pass 2: rows without an intact file.
	rows, err := s.db.R.QueryContext(ctx, `SELECT hash, size FROM blobs`)
	if err != nil {
		return rep, err
	}
	var bad []string
	for rows.Next() {
		var h string
		var size int64
		if err := rows.Scan(&h, &size); err != nil {
			rows.Close()
			return rep, err
		}
		got, err := s.cas.Stat(h)
		if errors.Is(err, cas.ErrNotFound) || (err == nil && got != size) {
			bad = append(bad, h)
		} else if err != nil {
			rows.Close()
			return rep, err
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return rep, err
	}
	for _, h := range bad {
		n, err := s.purgeBlob(h)
		if err != nil {
			return rep, err
		}
		rep.MissingBlobs++
		rep.EntriesDropped += n
	}
	if rep.OrphanFiles > 0 || rep.MissingBlobs > 0 {
		s.log.Warn("storage recovery repaired inconsistencies", "orphan_files", rep.OrphanFiles,
			"missing_blobs", rep.MissingBlobs, "entries_dropped", rep.EntriesDropped)
	}
	return rep, nil
}

// RunMaintenance runs the background jobs until ctx is cancelled.
func (s *Store) RunMaintenance(ctx context.Context, gcEvery, verifyEvery time.Duration, verifyBatch int, immutableMaxAge time.Duration) {
	if gcEvery <= 0 {
		gcEvery = 10 * time.Minute
	}
	flush := time.NewTicker(5 * time.Second)
	gc := time.NewTicker(gcEvery)
	defer flush.Stop()
	defer gc.Stop()
	var verify <-chan time.Time
	if verifyEvery > 0 && verifyBatch > 0 {
		t := time.NewTicker(verifyEvery)
		defer t.Stop()
		verify = t.C
	}
	for {
		select {
		case <-ctx.Done():
			if err := s.FlushTouches(); err != nil {
				s.log.Warn("flush access times", "err", err)
			}
			return
		case <-flush.C:
			if err := s.FlushTouches(); err != nil {
				s.log.Warn("flush access times", "err", err)
			}
		case <-gc.C:
			if _, err := s.ExpireUnused(ctx, immutableMaxAge); err != nil && ctx.Err() == nil {
				s.log.Error("expire unused entries", "err", err)
			}
			if _, err := s.Evict(ctx); err != nil && ctx.Err() == nil {
				s.log.Error("eviction", "err", err)
			}
			if _, err := s.GC(ctx); err != nil && ctx.Err() == nil {
				s.log.Error("garbage collection", "err", err)
			}
		case <-verify:
			if _, err := s.Verify(ctx, verifyBatch); err != nil && ctx.Err() == nil {
				s.log.Error("integrity verification", "err", err)
			}
		}
	}
}
