package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/Anarki-LNX/unicache/internal/core"
	"github.com/Anarki-LNX/unicache/internal/proxy"
	"github.com/Anarki-LNX/unicache/internal/stats"
	"github.com/Anarki-LNX/unicache/internal/storage"
)

const policySettingKey = "policy"

// LoadPolicy returns the persisted runtime policy, or def when none was
// saved yet.
func LoadPolicy(ctx context.Context, m *core.Modules, def proxy.Policy) (proxy.Policy, error) {
	raw, ok, err := m.Setting(ctx, policySettingKey)
	if err != nil || !ok {
		return def, err
	}
	var p policyDTO
	if err := json.Unmarshal([]byte(raw), &p); err != nil {
		return def, fmt.Errorf("stored policy is corrupt: %w", err)
	}
	return p.policy(), nil
}

// policyDTO is the JSON form of the policy (durations in seconds).
type policyDTO struct {
	MetadataTTL       int64            `json:"metadata_ttl_seconds"`
	ModuleTTL         map[string]int64 `json:"module_ttl_seconds"`
	NegativeTTL       int64            `json:"negative_ttl_seconds"`
	ServeStaleOnError bool             `json:"serve_stale_on_error"`
}

func (d policyDTO) policy() proxy.Policy {
	p := proxy.Policy{
		MetadataTTL:       time.Duration(d.MetadataTTL) * time.Second,
		NegativeTTL:       time.Duration(d.NegativeTTL) * time.Second,
		ServeStaleOnError: d.ServeStaleOnError,
		ModuleTTL:         map[string]time.Duration{},
	}
	for m, s := range d.ModuleTTL {
		if s > 0 {
			p.ModuleTTL[m] = time.Duration(s) * time.Second
		}
	}
	return p
}

func toDTO(p proxy.Policy) policyDTO {
	d := policyDTO{
		MetadataTTL: int64(p.MetadataTTL / time.Second), NegativeTTL: int64(p.NegativeTTL / time.Second),
		ServeStaleOnError: p.ServeStaleOnError, ModuleTTL: map[string]int64{},
	}
	for m, t := range p.ModuleTTL {
		d.ModuleTTL[m] = int64(t / time.Second)
	}
	return d
}

func (a *API) policies(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, toDTO(a.d.Proxy.Policy()))
}

func (a *API) policiesUpdate(w http.ResponseWriter, r *http.Request) {
	var d policyDTO
	if err := decode(r, &d); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	const maxTTL = 30 * 24 * 3600
	if d.MetadataTTL < 0 || d.MetadataTTL > maxTTL || d.NegativeTTL < 0 || d.NegativeTTL > 3600 {
		writeError(w, http.StatusBadRequest, "metadata_ttl_seconds must be 0..2592000 and negative_ttl_seconds 0..3600")
		return
	}
	for m, s := range d.ModuleTTL {
		if _, ok := a.d.Modules.Registry().Get(m); !ok {
			writeError(w, http.StatusBadRequest, "unknown module "+m)
			return
		}
		if s < 0 || s > maxTTL {
			writeError(w, http.StatusBadRequest, "module TTL out of range")
			return
		}
	}
	raw, _ := json.Marshal(d)
	if err := a.d.Modules.SetSetting(r.Context(), policySettingKey, string(raw)); err != nil {
		a.internal(w, r, err)
		return
	}
	a.d.Proxy.SetPolicy(d.policy())
	a.auditLog(r, "policy_updated", string(raw))
	writeJSON(w, http.StatusOK, toDTO(a.d.Proxy.Policy()))
}

func (a *API) baseURL(r *http.Request) string {
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	return scheme + "://" + r.Host
}

func (a *API) modules(w http.ResponseWriter, r *http.Request) {
	usage, err := a.d.Store.Usage(r.Context())
	if err != nil {
		a.internal(w, r, err)
		return
	}
	byModule := map[string]storage.ModuleUsage{}
	for _, m := range usage.Modules {
		byModule[m.Module] = m
	}
	_, per := a.d.Stats.Totals()
	out := []map[string]any{}
	for _, name := range a.d.Modules.Registry().Names() {
		ad, _ := a.d.Modules.Registry().Get(name)
		repos := a.d.Modules.Repos(name)
		repoOut := make([]map[string]any, 0, len(repos))
		for _, rp := range repos {
			base := a.baseURL(r) + "/" + name + "/" + rp.Name
			repoOut = append(repoOut, map[string]any{
				"id": rp.ID, "name": rp.Name, "upstreams": rp.Upstreams, "enabled": rp.Enabled,
				"url": base, "client_config": ad.ClientConfig(base, rp.Name),
			})
		}
		c := per[name]
		m := map[string]any{
			"info": ad.Info(), "enabled": a.d.Modules.Enabled(name), "repositories": repoOut,
			"counters": c, "hit_ratio": c.HitRatio(), "usage": byModule[name],
		}
		if rec, ok := a.d.Stats.LastError(name); ok {
			m["last_error"] = rec
		}
		out = append(out, m)
	}
	writeJSON(w, http.StatusOK, map[string]any{"modules": out})
}

func (a *API) moduleEnable(on bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		err := a.d.Modules.SetEnabled(r.Context(), id, on)
		if errors.Is(err, core.ErrUnknownModule) {
			writeError(w, http.StatusNotFound, "unknown module")
			return
		}
		if err != nil {
			a.internal(w, r, err)
			return
		}
		action := "module_disabled"
		if on {
			action = "module_enabled"
		}
		a.auditLog(r, action, id)
		writeJSON(w, http.StatusOK, map[string]any{"module": id, "enabled": on})
	}
}

// moduleTest checks that every upstream of a module is reachable. It uses
// the same SSRF-protected client as real downloads.
func (a *API) moduleTest(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := a.d.Modules.Registry().Get(id); !ok {
		writeError(w, http.StatusNotFound, "unknown module")
		return
	}
	type result struct {
		Repo      string `json:"repo"`
		Upstream  string `json:"upstream"`
		OK        bool   `json:"ok"`
		Status    int    `json:"status,omitempty"`
		LatencyMS int64  `json:"latency_ms"`
		Error     string `json:"error,omitempty"`
	}
	var mu sync.Mutex
	var wg sync.WaitGroup
	results := []result{}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	for _, rp := range a.d.Modules.Repos(id) {
		for _, up := range rp.Upstreams {
			wg.Add(1)
			go func() {
				defer wg.Done()
				res := result{Repo: rp.Name, Upstream: up}
				start := time.Now()
				req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(up, "/")+"/", nil)
				if err == nil {
					var resp *http.Response
					if resp, err = a.d.Upstream.Do(req); err == nil {
						io.Copy(io.Discard, io.LimitReader(resp.Body, 4<<10))
						resp.Body.Close()
						res.Status = resp.StatusCode
						// Any HTTP answer proves reachability; many
						// mirrors forbid directory listings (403/404).
						res.OK = resp.StatusCode < 500
					}
				}
				if err != nil {
					res.Error = err.Error()
				}
				res.LatencyMS = time.Since(start).Milliseconds()
				mu.Lock()
				results = append(results, res)
				mu.Unlock()
			}()
		}
	}
	wg.Wait()
	writeJSON(w, http.StatusOK, map[string]any{"results": results})
}

func (a *API) storage(w http.ResponseWriter, r *http.Request) {
	usage, err := a.d.Store.Usage(r.Context())
	if err != nil {
		a.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"usage": usage, "maintenance": a.d.Store.Status()})
}

type entryDTO struct {
	ID          int64     `json:"id"`
	Module      string    `json:"module"`
	Repo        string    `json:"repo"`
	Path        string    `json:"path"`
	Hash        string    `json:"hash"`
	Size        int64     `json:"size"`
	ContentType string    `json:"content_type"`
	Immutable   bool      `json:"immutable"`
	Pinned      bool      `json:"pinned"`
	CreatedAt   time.Time `json:"created_at"`
	ValidatedAt time.Time `json:"validated_at"`
	LastAccess  time.Time `json:"last_access"`
	Hits        int64     `json:"hits"`
}

func (a *API) entries(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	list, total, err := a.d.Store.ListEntries(r.Context(), storage.ListFilter{
		Module: q.Get("module"), Repo: q.Get("repo"), Search: q.Get("q"), Pinned: q.Get("pinned") == "1",
		Sort: q.Get("sort"), Limit: queryInt(r, "limit", 50), Offset: queryInt(r, "offset", 0),
	})
	if err != nil {
		a.internal(w, r, err)
		return
	}
	out := make([]entryDTO, 0, len(list))
	for _, e := range list {
		out = append(out, entryDTO{ID: e.ID, Module: e.Key.Module, Repo: e.Key.Repo, Path: e.Key.Path,
			Hash: e.BlobHash, Size: e.Size, ContentType: e.ContentType, Immutable: e.Immutable, Pinned: e.Pinned,
			CreatedAt: e.CreatedAt, ValidatedAt: e.ValidatedAt, LastAccess: e.LastAccess, Hits: e.Hits})
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": out, "total": total})
}

func (a *API) entryPin(pin bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := pathID(r)
		if !ok {
			writeError(w, http.StatusBadRequest, "invalid id")
			return
		}
		err := a.d.Store.SetPinned(r.Context(), id, pin)
		if errors.Is(err, storage.ErrNotFound) {
			writeError(w, http.StatusNotFound, "entry not found")
			return
		}
		if err != nil {
			a.internal(w, r, err)
			return
		}
		a.auditLog(r, map[bool]string{true: "entry_pinned", false: "entry_unpinned"}[pin], fmt.Sprint(id))
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "pinned": pin})
	}
}

func (a *API) entryDelete(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	err := a.d.Store.DeleteEntry(r.Context(), id)
	if errors.Is(err, storage.ErrNotFound) {
		writeError(w, http.StatusNotFound, "entry not found")
		return
	}
	if err != nil {
		a.internal(w, r, err)
		return
	}
	a.auditLog(r, "entry_deleted", fmt.Sprint(id))
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "deleted": true})
}

func (a *API) runGC(w http.ResponseWriter, r *http.Request) {
	ev, err := a.d.Store.Evict(r.Context())
	if err != nil {
		a.internal(w, r, err)
		return
	}
	gc, err := a.d.Store.GC(r.Context())
	if err != nil {
		a.internal(w, r, err)
		return
	}
	a.auditLog(r, "gc_run", fmt.Sprintf("%d blobs, %d bytes", gc.BlobsRemoved, gc.BytesFreed))
	writeJSON(w, http.StatusOK, map[string]any{"gc": gc, "eviction": ev})
}

func (a *API) runVerify(w http.ResponseWriter, r *http.Request) {
	rep, err := a.d.Store.Verify(r.Context(), a.d.Config.Storage.VerifyBatchSize)
	if err != nil {
		a.internal(w, r, err)
		return
	}
	a.auditLog(r, "verify_run", fmt.Sprintf("%d checked, %d corrupt, %d missing", rep.Checked, rep.Corrupt, rep.Missing))
	writeJSON(w, http.StatusOK, rep)
}

func (a *API) clients(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"clients": a.d.Stats.Clients(),
		"active": a.d.Stats.ActiveClients(5 * time.Minute)})
}

func (a *API) requests(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	writeJSON(w, http.StatusOK, map[string]any{"requests": a.d.Stats.Recent(stats.RecentFilter{
		Module: q.Get("module"), Client: q.Get("client"), Result: strings.ToUpper(q.Get("status")),
		Limit: queryInt(r, "limit", 200),
	})})
}

func (a *API) downloads(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"downloads": a.d.DL.Active()})
}

func (a *API) downloadCancel(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok || !a.d.DL.Cancel(id) {
		writeError(w, http.StatusNotFound, "download not found")
		return
	}
	a.auditLog(r, "download_cancelled", fmt.Sprint(id))
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "cancelled": true})
}

func (a *API) repos(w http.ResponseWriter, r *http.Request) {
	list := a.d.Modules.Repos(r.URL.Query().Get("module"))
	if list == nil {
		list = []core.Repo{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"repositories": list})
}

func (a *API) repoCreate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Module    string   `json:"module"`
		Name      string   `json:"name"`
		Upstreams []string `json:"upstreams"`
	}
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	repo, err := a.d.Modules.AddRepo(r.Context(), req.Module, req.Name, req.Upstreams)
	switch {
	case errors.Is(err, core.ErrRepoExists):
		writeError(w, http.StatusConflict, err.Error())
	case err != nil && a.isValidation(req.Module, req.Name, req.Upstreams):
		writeError(w, http.StatusBadRequest, err.Error())
	case err != nil:
		a.internal(w, r, err)
	default:
		a.auditLog(r, "repository_created", req.Module+"/"+req.Name+" -> "+strings.Join(req.Upstreams, ", "))
		writeJSON(w, http.StatusCreated, repo)
	}
}

func (a *API) isValidation(module, name string, upstreams []string) bool {
	return a.d.Modules.ValidateRepo(module, name, upstreams) != nil
}

func (a *API) repoUpdate(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req struct {
		Upstreams []string `json:"upstreams"`
		Enabled   *bool    `json:"enabled"`
	}
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	cur, found := a.d.Modules.RepoByID(id)
	if !found {
		writeError(w, http.StatusNotFound, "repository not found")
		return
	}
	if req.Upstreams == nil {
		req.Upstreams = cur.Upstreams
	}
	enabled := cur.Enabled
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	if err := a.d.Modules.ValidateRepo(cur.Module, cur.Name, req.Upstreams); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := a.d.Modules.UpdateRepo(r.Context(), id, req.Upstreams, enabled); err != nil {
		a.internal(w, r, err)
		return
	}
	a.auditLog(r, "repository_updated", fmt.Sprintf("%s/%s enabled=%t -> %s", cur.Module, cur.Name, enabled, strings.Join(req.Upstreams, ", ")))
	updated, _ := a.d.Modules.RepoByID(id)
	writeJSON(w, http.StatusOK, updated)
}

func (a *API) repoDelete(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	repo, err := a.d.Modules.DeleteRepo(r.Context(), id)
	if errors.Is(err, core.ErrRepoNotFound) {
		writeError(w, http.StatusNotFound, "repository not found")
		return
	}
	if err != nil {
		a.internal(w, r, err)
		return
	}
	// The cached objects of the repository are unreachable now; release
	// them (the blobs are reclaimed by the next garbage collection).
	n, err := a.d.Store.DeleteRepo(r.Context(), repo.Module, repo.Name)
	if err != nil {
		a.log.Error("cannot remove entries of deleted repository", "repo", repo.Module+"/"+repo.Name, "err", err)
	}
	a.auditLog(r, "repository_deleted", fmt.Sprintf("%s/%s (%d cached objects released)", repo.Module, repo.Name, n))
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "deleted": true, "entries_released": n})
}

// settings returns the effective configuration without secrets. It is
// read-only: file settings are changed in the configuration file.
func (a *API) settings(w http.ResponseWriter, r *http.Request) {
	c := a.d.Config
	writeJSON(w, http.StatusOK, map[string]any{
		"runtime": a.runtimeView(),
		"server": map[string]any{"listen": c.Server.Listen, "port": c.Server.Port, "tls": c.Server.TLSEnabled(),
			"trusted_proxies": c.Server.TrustedProxies},
		"storage": map[string]any{"path": c.Storage.Path, "max_size": int64(c.Storage.MaxSize),
			"min_free_space": c.Storage.MinFreeSpace, "gc_interval_seconds": int64(c.Storage.GCInterval.Std().Seconds()),
			"verify_interval_seconds": int64(c.Storage.VerifyInterval.Std().Seconds())},
		"database": map[string]any{"driver": c.Database.Driver, "path": c.Database.Path},
		"download": map[string]any{"max_concurrent": c.Download.MaxConcurrent, "retries": c.Download.Retries,
			"resume": c.Download.Resume, "max_object_size": int64(c.Download.MaxObjectSize),
			"upstream_rate_limit": int64(c.Download.UpstreamRateLim), "client_rate_limit": int64(c.Download.ClientRateLimit)},
		"security": map[string]any{"allowed_clients": c.Security.AllowedClients, "admin_allowed": c.Security.AdminAllowed,
			"allow_private_upstreams": c.Security.AllowPrivateUpstreams,
			"session_ttl_seconds":     int64(c.Security.SessionTTL.Std().Seconds())},
		"logging": map[string]any{"level": c.Logging.Level, "format": c.Logging.Format, "file": c.Logging.File},
	})
}

func (a *API) audit(w http.ResponseWriter, r *http.Request) {
	limit := queryInt(r, "limit", 100)
	if limit < 1 || limit > 1000 {
		limit = 100
	}
	rows, err := a.d.DB.R.QueryContext(r.Context(),
		`SELECT id, ts, actor, ip, action, detail FROM audit_log ORDER BY id DESC LIMIT ?`, limit)
	if err != nil {
		a.internal(w, r, err)
		return
	}
	defer rows.Close()
	type rec struct {
		ID     int64  `json:"id"`
		Time   int64  `json:"time"`
		Actor  string `json:"actor"`
		IP     string `json:"ip"`
		Action string `json:"action"`
		Detail string `json:"detail"`
	}
	out := []rec{}
	for rows.Next() {
		var x rec
		if err := rows.Scan(&x.ID, &x.Time, &x.Actor, &x.IP, &x.Action, &x.Detail); err != nil {
			a.internal(w, r, err)
			return
		}
		out = append(out, x)
	}
	writeJSON(w, http.StatusOK, map[string]any{"audit": out})
}
