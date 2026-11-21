// Package core wires the UniCache components together.
package core

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/Anarki-LNX/unicache/internal/adapters"
	"github.com/Anarki-LNX/unicache/internal/config"
	"github.com/Anarki-LNX/unicache/internal/database"
)

// Repo is one configured upstream repository of a module.
type Repo struct {
	ID        int64     `json:"id"`
	Module    string    `json:"module"`
	Name      string    `json:"name"`
	Upstreams []string  `json:"upstreams"`
	Enabled   bool      `json:"enabled"`
	CreatedAt time.Time `json:"created_at"`
}

// ErrRepoExists is returned when a repository name is already taken.
var ErrRepoExists = errors.New("a repository with this name already exists in the module")

// ErrUnknownModule is returned for module names without an adapter.
var ErrUnknownModule = errors.New("unknown module")

// ErrRepoNotFound is returned when a repository does not exist.
var ErrRepoNotFound = errors.New("repository not found")

// Modules is the runtime registry of enabled modules and their
// repositories. The database is the source of truth; the configuration file
// seeds it (each module and repository exactly once), so changes made in the
// web interface survive restarts and upgrades.
type Modules struct {
	db  *database.DB
	reg *adapters.Registry

	mu      sync.RWMutex
	enabled map[string]bool
	repos   map[string]map[string]*Repo // module -> name -> repo
}

// LoadModules seeds the database from cfg and loads the registry.
func LoadModules(ctx context.Context, db *database.DB, reg *adapters.Registry, cfg *config.Config) (*Modules, error) {
	m := &Modules{db: db, reg: reg}
	if err := m.seed(ctx, cfg); err != nil {
		return nil, fmt.Errorf("seed modules: %w", err)
	}
	if err := m.reload(ctx); err != nil {
		return nil, err
	}
	return m, nil
}

func (m *Modules) seed(ctx context.Context, cfg *config.Config) error {
	tx, err := m.db.W.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	now := time.Now().Unix()
	for _, name := range m.reg.Names() {
		mc, inCfg := cfg.Modules[name]
		if _, err := tx.Exec(`INSERT INTO module_state (module, enabled) VALUES (?, ?)
			ON CONFLICT(module) DO NOTHING`, name, inCfg && mc.Enabled); err != nil {
			return err
		}
		for _, r := range mc.Repositories {
			marker := "seeded:" + name + "/" + r.Name
			res, err := tx.Exec(`INSERT INTO settings (key, value) VALUES (?, '1') ON CONFLICT(key) DO NOTHING`, marker)
			if err != nil {
				return err
			}
			if n, _ := res.RowsAffected(); n == 0 {
				continue // seeded before; the user may have changed or removed it since
			}
			ups, _ := json.Marshal(r.Upstreams)
			if _, err := tx.Exec(`INSERT INTO repositories (module, name, upstreams, enabled, created_at)
				VALUES (?, ?, ?, 1, ?) ON CONFLICT(module, name) DO NOTHING`, name, r.Name, string(ups), now); err != nil {
				return err
			}
		}
	}
	return tx.Commit()
}

func (m *Modules) reload(ctx context.Context) error {
	enabled := map[string]bool{}
	rows, err := m.db.W.QueryContext(ctx, `SELECT module, enabled FROM module_state`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var name string
		var on bool
		if err := rows.Scan(&name, &on); err != nil {
			rows.Close()
			return err
		}
		enabled[name] = on
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	repos := map[string]map[string]*Repo{}
	rrows, err := m.db.W.QueryContext(ctx, `SELECT id, module, name, upstreams, enabled, created_at FROM repositories`)
	if err != nil {
		return err
	}
	defer rrows.Close()
	for rrows.Next() {
		var r Repo
		var ups string
		var created int64
		if err := rrows.Scan(&r.ID, &r.Module, &r.Name, &ups, &r.Enabled, &created); err != nil {
			return err
		}
		if err := json.Unmarshal([]byte(ups), &r.Upstreams); err != nil {
			return fmt.Errorf("repository %s/%s: corrupt upstream list: %w", r.Module, r.Name, err)
		}
		r.CreatedAt = time.Unix(created, 0)
		if repos[r.Module] == nil {
			repos[r.Module] = map[string]*Repo{}
		}
		repos[r.Module][r.Name] = &r
	}
	if err := rrows.Err(); err != nil {
		return err
	}
	m.mu.Lock()
	m.enabled, m.repos = enabled, repos
	m.mu.Unlock()
	return nil
}

// Registry returns the adapter registry.
func (m *Modules) Registry() *adapters.Registry { return m.reg }

// Enabled reports whether a module is switched on.
func (m *Modules) Enabled(module string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.enabled[module]
}

// Resolve returns the adapter and repository for a request, if the module
// is enabled and the repository exists and is enabled.
func (m *Modules) Resolve(module, repo string) (adapters.Adapter, *Repo, bool) {
	a, ok := m.reg.Get(module)
	if !ok {
		return nil, nil, false
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	if !m.enabled[module] {
		return nil, nil, false
	}
	r := m.repos[module][repo]
	if r == nil || !r.Enabled {
		return nil, nil, false
	}
	cp := *r
	return a, &cp, true
}

// Repos lists repositories, optionally of one module, sorted by name.
func (m *Modules) Repos(module string) []Repo {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []Repo
	for mod, byName := range m.repos {
		if module != "" && mod != module {
			continue
		}
		for _, r := range byName {
			out = append(out, *r)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Module != out[j].Module {
			return out[i].Module < out[j].Module
		}
		return out[i].Name < out[j].Name
	})
	return out
}

// SetEnabled switches a module on or off.
func (m *Modules) SetEnabled(ctx context.Context, module string, on bool) error {
	if _, ok := m.reg.Get(module); !ok {
		return ErrUnknownModule
	}
	if _, err := m.db.W.ExecContext(ctx, `INSERT INTO module_state (module, enabled) VALUES (?, ?)
		ON CONFLICT(module) DO UPDATE SET enabled = excluded.enabled`, module, on); err != nil {
		return err
	}
	return m.reload(ctx)
}

// ValidateRepo checks a repository definition.
func (m *Modules) ValidateRepo(module, name string, upstreams []string) error {
	if _, ok := m.reg.Get(module); !ok {
		return ErrUnknownModule
	}
	if !config.ValidRepoName(name) {
		return errors.New("repository name must be 1-63 characters of a-z, 0-9, '.', '_' or '-' and start with a letter or digit")
	}
	if len(upstreams) == 0 {
		return errors.New("at least one upstream URL is required")
	}
	if len(upstreams) > 16 {
		return errors.New("at most 16 upstream URLs are allowed")
	}
	for _, u := range upstreams {
		if err := config.ValidateUpstream(u); err != nil {
			return err
		}
	}
	return nil
}

// AddRepo creates a repository.
func (m *Modules) AddRepo(ctx context.Context, module, name string, upstreams []string) (*Repo, error) {
	if err := m.ValidateRepo(module, name, upstreams); err != nil {
		return nil, err
	}
	ups, _ := json.Marshal(upstreams)
	res, err := m.db.W.ExecContext(ctx, `INSERT INTO repositories (module, name, upstreams, enabled, created_at)
		VALUES (?, ?, ?, 1, ?) ON CONFLICT(module, name) DO NOTHING`, module, name, string(ups), time.Now().Unix())
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, ErrRepoExists
	}
	if err := m.reload(ctx); err != nil {
		return nil, err
	}
	_, r, _ := m.lookupAny(module, name)
	return r, nil
}

func (m *Modules) lookupAny(module, name string) (adapters.Adapter, *Repo, bool) {
	a, _ := m.reg.Get(module)
	m.mu.RLock()
	defer m.mu.RUnlock()
	r := m.repos[module][name]
	if r == nil {
		return a, nil, false
	}
	cp := *r
	return a, &cp, true
}

// RepoByID returns a repository by its database ID.
func (m *Modules) RepoByID(id int64) (*Repo, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, byName := range m.repos {
		for _, r := range byName {
			if r.ID == id {
				cp := *r
				return &cp, true
			}
		}
	}
	return nil, false
}

// UpdateRepo changes the upstreams and enabled flag of a repository.
func (m *Modules) UpdateRepo(ctx context.Context, id int64, upstreams []string, enabled bool) error {
	r, ok := m.RepoByID(id)
	if !ok {
		return ErrRepoNotFound
	}
	if err := m.ValidateRepo(r.Module, r.Name, upstreams); err != nil {
		return err
	}
	ups, _ := json.Marshal(upstreams)
	if _, err := m.db.W.ExecContext(ctx, `UPDATE repositories SET upstreams = ?, enabled = ? WHERE id = ?`,
		string(ups), enabled, id); err != nil {
		return err
	}
	return m.reload(ctx)
}

// DeleteRepo removes a repository definition and returns it. Cached entries
// are removed by the caller through the storage engine.
func (m *Modules) DeleteRepo(ctx context.Context, id int64) (*Repo, error) {
	r, ok := m.RepoByID(id)
	if !ok {
		return nil, ErrRepoNotFound
	}
	res, err := m.db.W.ExecContext(ctx, `DELETE FROM repositories WHERE id = ?`, id)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, ErrRepoNotFound
	}
	return r, m.reload(ctx)
}

// Setting reads a persisted setting; ok is false when it is not set.
func (m *Modules) Setting(ctx context.Context, key string) (value string, ok bool, err error) {
	err = m.db.R.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = ?`, key).Scan(&value)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	return value, err == nil, err
}

// SetSetting stores a persisted setting.
func (m *Modules) SetSetting(ctx context.Context, key, value string) error {
	_, err := m.db.W.ExecContext(ctx, `INSERT INTO settings (key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value)
	return err
}
