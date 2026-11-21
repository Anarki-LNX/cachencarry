// Package api implements the versioned management REST API (/api/v1) and
// the Server-Sent Events stream used by the dashboard.
package api

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/Anarki-LNX/cachencarry/internal/config"
	"github.com/Anarki-LNX/cachencarry/internal/core"
	"github.com/Anarki-LNX/cachencarry/internal/database"
	"github.com/Anarki-LNX/cachencarry/internal/download"
	"github.com/Anarki-LNX/cachencarry/internal/events"
	"github.com/Anarki-LNX/cachencarry/internal/proxy"
	"github.com/Anarki-LNX/cachencarry/internal/security"
	"github.com/Anarki-LNX/cachencarry/internal/stats"
	"github.com/Anarki-LNX/cachencarry/internal/storage"
)

const (
	sessionCookie = "cachencarry_session"
	maxBodyBytes  = 64 << 10
)

// Deps are the components the API operates on.
type Deps struct {
	Config     *config.Config
	DB         *database.DB
	Store      *storage.Store
	DL         *download.Manager
	Modules    *core.Modules
	Stats      *stats.Collector
	Broker     *events.Broker
	Auth       *security.Auth
	Proxy      *proxy.Handler
	Upstream   *http.Client
	Logger     *slog.Logger
	Version    string
	StartedAt  time.Time
	SetupToken string // required for first-run setup; empty disables the check
	Runtime    RuntimeController
	AdminACL   *security.ACL
	Trusted    *security.ACL
}

// API is the management API handler.
type API struct {
	d       Deps
	log     *slog.Logger
	mux     *http.ServeMux
	loginRL *security.RateLimiter
	adminRL *security.RateLimiter
	secure  bool
}

type ctxKey int

const sessionKey ctxKey = 1

// New builds the API.
func New(d Deps) *API {
	if d.Logger == nil {
		d.Logger = slog.Default()
	}
	a := &API{
		d: d, log: d.Logger, mux: http.NewServeMux(),
		loginRL: security.NewRateLimiter(10, 5*time.Minute),
		adminRL: security.NewRateLimiter(600, time.Minute),
		secure:  d.Config.Server.TLSEnabled() || d.Config.Security.SecureCookies,
	}
	a.routes()
	return a
}

func (a *API) routes() {
	pub := func(pattern string, h http.HandlerFunc) { a.mux.HandleFunc(pattern, h) }
	auth := func(pattern string, h http.HandlerFunc) { a.mux.HandleFunc(pattern, a.requireSession(h)) }

	pub("GET /api/v1/health", a.health)
	pub("GET /api/v1/session", a.session)
	pub("POST /api/v1/setup", a.setup)
	pub("POST /api/v1/login", a.login)
	pub("POST /api/v1/logout", a.logout)

	auth("GET /api/v1/system", a.system)
	auth("GET /api/v1/stats", a.stats)
	auth("GET /api/v1/stats/history", a.history)
	auth("GET /api/v1/modules", a.modules)
	auth("POST /api/v1/modules/{id}/enable", a.moduleEnable(true))
	auth("POST /api/v1/modules/{id}/disable", a.moduleEnable(false))
	auth("POST /api/v1/modules/{id}/test", a.moduleTest)
	auth("GET /api/v1/storage", a.storage)
	auth("GET /api/v1/storage/stats", a.storage)
	auth("GET /api/v1/storage/blobs", a.entries)
	auth("POST /api/v1/storage/entries/{id}/pin", a.entryPin(true))
	auth("POST /api/v1/storage/entries/{id}/unpin", a.entryPin(false))
	auth("DELETE /api/v1/storage/entries/{id}", a.entryDelete)
	auth("POST /api/v1/storage/gc", a.runGC)
	auth("POST /api/v1/storage/verify", a.runVerify)
	auth("GET /api/v1/clients", a.clients)
	auth("GET /api/v1/requests", a.requests)
	auth("GET /api/v1/downloads", a.downloads)
	auth("DELETE /api/v1/downloads/{id}", a.downloadCancel)
	auth("GET /api/v1/repositories", a.repos)
	auth("POST /api/v1/repositories", a.repoCreate)
	auth("PUT /api/v1/repositories/{id}", a.repoUpdate)
	auth("DELETE /api/v1/repositories/{id}", a.repoDelete)
	auth("GET /api/v1/policies", a.policies)
	auth("PUT /api/v1/policies", a.policiesUpdate)
	auth("GET /api/v1/settings", a.settings)
	auth("PUT /api/v1/settings/runtime", a.runtimeUpdate)
	auth("DELETE /api/v1/settings/runtime", a.runtimeReset)
	auth("GET /api/v1/audit", a.audit)
	auth("POST /api/v1/account/password", a.changePassword)
	auth("GET /api/v1/events", a.events)
	a.mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "unknown API endpoint")
	})
}

// ServeHTTP applies the protections common to all API endpoints.
func (a *API) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ip := security.ClientIP(r, a.d.Trusted)
	// The health endpoint stays reachable for container health checks and
	// monitoring; it reveals nothing but "ok".
	if r.URL.Path != "/api/v1/health" {
		if !ip.IsValid() || !a.d.AdminACL.Allows(ip) {
			writeError(w, http.StatusForbidden, "management access is not allowed from this address")
			return
		}
		if !a.adminRL.Allow(ip.String()) {
			w.Header().Set("Retry-After", "60")
			writeError(w, http.StatusTooManyRequests, "too many requests")
			return
		}
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if r.Body != nil {
		r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	}
	a.mux.ServeHTTP(w, r)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Debug("write API response", "err", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// decode reads a JSON body strictly: unknown fields and trailing data are
// rejected.
func decode(r *http.Request, v any) error {
	if ct := r.Header.Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		return errors.New("Content-Type must be application/json")
	}
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return fmt.Errorf("invalid JSON body: %w", err)
	}
	if dec.More() {
		return errors.New("invalid JSON body: trailing data")
	}
	return nil
}

func (a *API) internal(w http.ResponseWriter, r *http.Request, err error) {
	if r.Context().Err() != nil {
		return
	}
	a.log.Error("api error", "path", r.URL.Path, "err", err)
	writeError(w, http.StatusInternalServerError, "internal error")
}

func (a *API) clientIP(r *http.Request) string { return security.ClientIP(r, a.d.Trusted).String() }

func (a *API) auditLog(r *http.Request, action, detail string) {
	actor := "-"
	if s, ok := r.Context().Value(sessionKey).(*security.Session); ok {
		actor = s.Username
	}
	if err := security.Audit(context.Background(), a.d.DB, actor, a.clientIP(r), action, detail); err != nil {
		a.log.Error("audit log write failed", "action", action, "err", err)
	}
	a.log.Info("audit", "actor", actor, "ip", a.clientIP(r), "action", action, "detail", detail)
}

func (a *API) currentSession(r *http.Request) (*security.Session, string) {
	c, err := r.Cookie(sessionCookie)
	if err != nil {
		return nil, ""
	}
	s, err := a.d.Auth.Session(r.Context(), c.Value)
	if err != nil {
		return nil, ""
	}
	return s, c.Value
}

// requireSession authenticates the request and enforces CSRF protection on
// state-changing methods (custom header that browsers never add to
// cross-site requests, bound to the session).
func (a *API) requireSession(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s, _ := a.currentSession(r)
		if s == nil {
			writeError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			if !s.CSRFMatches(r.Header.Get("X-CSRF-Token")) {
				writeError(w, http.StatusForbidden, "missing or invalid CSRF token")
				return
			}
		}
		next(w, r.WithContext(context.WithValue(r.Context(), sessionKey, s)))
	}
}

func (a *API) setCookie(w http.ResponseWriter, value string, expires time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: value, Path: "/", Expires: expires,
		HttpOnly: true, Secure: a.secure, SameSite: http.SameSiteStrictMode,
	})
}

func (a *API) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	var one int
	if err := a.d.DB.R.QueryRowContext(ctx, "SELECT 1").Scan(&one); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unhealthy"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *API) session(w http.ResponseWriter, r *http.Request) {
	has, err := a.d.Auth.HasUsers(r.Context())
	if err != nil {
		a.internal(w, r, err)
		return
	}
	resp := map[string]any{"setup_required": !has, "authenticated": false, "version": a.d.Version,
		"setup_token_required": !has && a.d.SetupToken != ""}
	if s, _ := a.currentSession(r); s != nil {
		resp["authenticated"] = true
		resp["user"] = s.Username
		resp["csrf"] = s.CSRF
	}
	writeJSON(w, http.StatusOK, resp)
}

func (a *API) setup(w http.ResponseWriter, r *http.Request) {
	if !a.loginRL.Allow("setup:" + a.clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "too many attempts, try again later")
		return
	}
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Token    string `json:"token"`
	}
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if a.d.SetupToken != "" &&
		subtle.ConstantTimeCompare([]byte(strings.TrimSpace(req.Token)), []byte(a.d.SetupToken)) != 1 {
		writeError(w, http.StatusForbidden, "invalid setup token")
		return
	}
	if err := a.d.Auth.CreateFirstUser(r.Context(), strings.TrimSpace(req.Username), req.Password); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	a.auditLog(r, "setup", "initial administrator "+strings.TrimSpace(req.Username)+" created")
	a.finishLogin(w, r, strings.TrimSpace(req.Username), req.Password)
}

func (a *API) login(w http.ResponseWriter, r *http.Request) {
	if !a.loginRL.Allow(a.clientIP(r)) {
		w.Header().Set("Retry-After", "300")
		writeError(w, http.StatusTooManyRequests, "too many login attempts, try again later")
		return
	}
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	a.finishLogin(w, r, req.Username, req.Password)
}

func (a *API) finishLogin(w http.ResponseWriter, r *http.Request, username, password string) {
	token, s, err := a.d.Auth.Login(r.Context(), username, password)
	if errors.Is(err, security.ErrInvalidCredentials) {
		a.auditLog(r, "login_failed", "user "+strconv.Quote(username))
		writeError(w, http.StatusUnauthorized, "invalid user name or password")
		return
	}
	if err != nil {
		a.internal(w, r, err)
		return
	}
	a.setCookie(w, token, s.Expires)
	_ = security.Audit(r.Context(), a.d.DB, s.Username, a.clientIP(r), "login", "")
	writeJSON(w, http.StatusOK, map[string]any{"authenticated": true, "user": s.Username, "csrf": s.CSRF})
}

func (a *API) logout(w http.ResponseWriter, r *http.Request) {
	s, token := a.currentSession(r)
	if s != nil {
		if !s.CSRFMatches(r.Header.Get("X-CSRF-Token")) {
			writeError(w, http.StatusForbidden, "missing or invalid CSRF token")
			return
		}
		if err := a.d.Auth.Logout(r.Context(), token); err != nil {
			a.internal(w, r, err)
			return
		}
	}
	a.setCookie(w, "", time.Unix(1, 0))
	writeJSON(w, http.StatusOK, map[string]bool{"authenticated": false})
}

func (a *API) changePassword(w http.ResponseWriter, r *http.Request) {
	s := r.Context().Value(sessionKey).(*security.Session)
	var req struct {
		Current string `json:"current"`
		New     string `json:"new"`
	}
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if !a.loginRL.Allow("pw:"+a.clientIP(r)) || !a.d.Auth.CheckPassword(r.Context(), s.UserID, req.Current) {
		writeError(w, http.StatusForbidden, "current password is wrong")
		return
	}
	if err := a.d.Auth.SetPassword(r.Context(), s.UserID, req.New); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	a.auditLog(r, "password_changed", "")
	a.setCookie(w, "", time.Unix(1, 0)) // all sessions were ended
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) system(w http.ResponseWriter, r *http.Request) {
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	schema, _ := a.d.DB.SchemaVersion(r.Context())
	dbOK := a.d.DB.IntegrityCheck(r.Context()) == nil
	usage, uerr := a.d.Store.Usage(r.Context())
	checks := []map[string]any{
		{"name": "database", "ok": dbOK, "detail": "SQLite quick_check"},
		{"name": "storage", "ok": uerr == nil, "detail": a.d.Store.Root()},
	}
	if uerr == nil && usage.MinFree > 0 {
		checks = append(checks, map[string]any{"name": "free_space", "ok": usage.DiskFree >= usage.MinFree,
			"detail": fmt.Sprintf("%.1f GiB free, minimum %.1f GiB", float64(usage.DiskFree)/(1<<30), float64(usage.MinFree)/(1<<30))})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"version":        a.d.Version,
		"go_version":     runtime.Version(),
		"os":             runtime.GOOS,
		"arch":           runtime.GOARCH,
		"started_at":     a.d.StartedAt,
		"uptime_seconds": int64(time.Since(a.d.StartedAt).Seconds()),
		"goroutines":     runtime.NumGoroutine(),
		"memory_bytes":   ms.Sys,
		"heap_bytes":     ms.HeapAlloc,
		"cpus":           runtime.NumCPU(),
		"schema_version": schema,
		"checks":         checks,
		"maintenance":    a.d.Store.Status(),
	})
}

// Live is the compact state pushed with every SSE tick.
func (a *API) Live() any {
	all, _ := a.d.Stats.Totals()
	return map[string]any{
		"totals":         all,
		"hit_ratio":      all.HitRatio(),
		"downloads":      a.d.DL.Active(),
		"active_clients": a.d.Stats.ActiveClients(5 * time.Minute),
	}
}

func (a *API) stats(w http.ResponseWriter, r *http.Request) {
	all, per := a.d.Stats.Totals()
	usage, err := a.d.Store.Usage(r.Context())
	if err != nil {
		a.internal(w, r, err)
		return
	}
	mods := map[string]any{}
	for name, c := range per {
		mods[name] = map[string]any{"counters": c, "hit_ratio": c.HitRatio()}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"totals":           all,
		"hit_ratio":        all.HitRatio(),
		"bytes_saved":      all.BytesCache,
		"modules":          mods,
		"storage":          usage,
		"active_downloads": len(a.d.DL.Active()),
		"active_clients":   a.d.Stats.ActiveClients(5 * time.Minute),
		"rates":            a.d.Stats.Rates(),
	})
}

func (a *API) history(w http.ResponseWriter, r *http.Request) {
	ranges := map[string][2]int64{ // range -> {seconds, step}
		"1h": {3600, 60}, "6h": {6 * 3600, 300}, "24h": {86400, 900},
		"7d": {7 * 86400, 3600}, "30d": {30 * 86400, 4 * 3600},
	}
	rg, ok := ranges[r.URL.Query().Get("range")]
	if !ok {
		rg = ranges["24h"]
	}
	module := r.URL.Query().Get("module")
	if module != "" {
		if _, ok := a.d.Modules.Registry().Get(module); !ok {
			writeError(w, http.StatusBadRequest, "unknown module")
			return
		}
	}
	now := time.Now()
	points, err := a.d.Stats.History(r.Context(), now.Add(-time.Duration(rg[0])*time.Second), now, rg[1], module)
	if err != nil {
		a.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"step_seconds": rg[1], "from": now.Unix() - rg[0], "to": now.Unix(), "points": points})
}

func pathID(r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	return id, err == nil && id > 0
}

func queryInt(r *http.Request, name string, def int) int {
	if v := r.URL.Query().Get(name); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func (a *API) events(w http.ResponseWriter, r *http.Request) {
	fl, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}
	ch, unsubscribe := a.d.Broker.Subscribe()
	defer unsubscribe()
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "retry: 3000\n\n")
	fl.Flush()
	rc := http.NewResponseController(w)
	keepalive := time.NewTicker(20 * time.Second)
	defer keepalive.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-keepalive.C:
			rc.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if _, err := fmt.Fprint(w, ": keepalive\n\n"); err != nil {
				return
			}
			fl.Flush()
		case ev, open := <-ch:
			if !open {
				return
			}
			data, err := json.Marshal(ev.Data)
			if err != nil {
				continue
			}
			rc.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Type, data); err != nil {
				return
			}
			fl.Flush()
		}
	}
}
