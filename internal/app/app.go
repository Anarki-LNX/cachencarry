// Package app assembles the UniCache server from its components.
package app

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/Anarki-LNX/unicache/internal/adapters"
	"github.com/Anarki-LNX/unicache/internal/api"
	"github.com/Anarki-LNX/unicache/internal/config"
	"github.com/Anarki-LNX/unicache/internal/core"
	"github.com/Anarki-LNX/unicache/internal/database"
	"github.com/Anarki-LNX/unicache/internal/download"
	"github.com/Anarki-LNX/unicache/internal/events"
	"github.com/Anarki-LNX/unicache/internal/proxy"
	"github.com/Anarki-LNX/unicache/internal/security"
	"github.com/Anarki-LNX/unicache/internal/stats"
	"github.com/Anarki-LNX/unicache/internal/storage"
)

// Options tune App construction (mostly for tests).
type Options struct {
	Version string
	Logger  *slog.Logger
	UI      fs.FS // built frontend; nil serves a notice page
	NoSync  bool  // skip fsync (tests only)
}

// App is a fully wired UniCache instance.
type App struct {
	Config  *config.Config
	DB      *database.DB
	Store   *storage.Store
	DL      *download.Manager
	Modules *core.Modules
	Stats   *stats.Collector
	Auth    *security.Auth
	Proxy   *proxy.Handler
	API     *api.API

	log        *slog.Logger
	handler    http.Handler
	cancel     context.CancelFunc
	background chan struct{}
	SetupToken string
}

// New opens the database and storage and wires all components. Background
// jobs start immediately and stop on Close.
func New(ctx context.Context, cfg *config.Config, opts Options) (*App, error) {
	log := opts.Logger
	if log == nil {
		log = slog.Default()
	}
	if err := os.MkdirAll(cfg.Storage.Path, 0o750); err != nil {
		return nil, fmt.Errorf("create storage directory: %w", err)
	}
	db, err := database.Open(ctx, cfg.Database.Path)
	if err != nil {
		return nil, err
	}
	a := &App{Config: cfg, DB: db, log: log, background: make(chan struct{})}
	ok := false
	defer func() {
		if !ok {
			db.Close()
		}
	}()
	if err := db.IntegrityCheck(ctx); err != nil {
		return nil, fmt.Errorf("%w (restore %s from a backup or remove it to start with an empty cache index)", err, cfg.Database.Path)
	}

	minBytes, minPct, err := config.ParseMinFree(cfg.Storage.MinFreeSpace)
	if err != nil {
		return nil, err
	}
	a.Store, err = storage.Open(db, storage.Options{
		Root: cfg.Storage.Path, MaxSize: int64(cfg.Storage.MaxSize),
		MinFreeBytes: minBytes, MinFreePct: minPct, Logger: log, NoSync: opts.NoSync,
	})
	if err != nil {
		return nil, err
	}
	// No download can be running yet, so leftovers in temp/ are garbage.
	if n, err := a.Store.CleanTemp(); err != nil {
		log.Warn("cannot clean temporary directory", "err", err)
	} else if n > 0 {
		log.Info("removed interrupted downloads", "files", n)
	}

	broker := events.NewBroker()
	a.Stats, err = stats.NewCollector(ctx, db, broker, cfg.Monitoring.RequestLog, log)
	if err != nil {
		return nil, err
	}
	a.Modules, err = core.LoadModules(ctx, db, adapters.Builtin(), cfg)
	if err != nil {
		return nil, err
	}
	clients, err := security.NewACL(cfg.Security.AllowedClients)
	if err != nil {
		return nil, err
	}
	admins, err := security.NewACL(cfg.Security.AdminAllowed)
	if err != nil {
		return nil, err
	}
	trusted, err := security.NewACL(cfg.Server.TrustedProxies)
	if err != nil {
		return nil, err
	}
	upstream := security.UpstreamClient(cfg.Security.AllowPrivateUpstreams,
		cfg.Download.ConnectTimeout.Std(), cfg.Download.HeaderTimeout.Std())
	a.DL = download.NewManager(download.Options{
		Client: upstream, Store: a.Store, MaxConcurrent: cfg.Download.MaxConcurrent,
		Retries: cfg.Download.Retries, RetryBackoff: cfg.Download.RetryBackoff.Std(),
		IdleTimeout: cfg.Download.IdleTimeout.Std(), MaxObjectSize: int64(cfg.Download.MaxObjectSize),
		Resume: cfg.Download.Resume, UserAgent: cfg.Download.UserAgent,
		RateLimit: int64(cfg.Download.UpstreamRateLim), Logger: log,
		OnUpstreamBytes: a.Stats.AddUpstreamBytes,
	})

	defPolicy := proxy.Policy{
		MetadataTTL: cfg.Cache.MetadataTTL.Std(), NegativeTTL: cfg.Cache.NegativeTTL.Std(),
		ServeStaleOnError: cfg.Cache.ServeStaleOnError, ModuleTTL: map[string]time.Duration{},
	}
	for name, m := range cfg.Modules {
		if m.MetadataTTL > 0 {
			defPolicy.ModuleTTL[name] = m.MetadataTTL.Std()
		}
	}
	policy, err := api.LoadPolicy(ctx, a.Modules, defPolicy)
	if err != nil {
		log.Warn("ignoring stored policy", "err", err)
	}
	a.Proxy = proxy.New(proxy.Options{
		Store: a.Store, DL: a.DL, Modules: a.Modules, Stats: a.Stats, Clients: clients, Trusted: trusted,
		Logger: log, Policy: policy, ClientRateLimit: int64(cfg.Download.ClientRateLimit),
	})

	a.Auth = security.NewAuth(db, cfg.Security.SessionTTL.Std())
	if err := a.bootstrapAdmin(ctx); err != nil {
		return nil, err
	}
	a.API = api.New(api.Deps{
		Config: cfg, DB: db, Store: a.Store, DL: a.DL, Modules: a.Modules, Stats: a.Stats, Broker: broker,
		Auth: a.Auth, Proxy: a.Proxy, Upstream: upstream, Logger: log, Version: opts.Version,
		StartedAt: time.Now(), SetupToken: a.SetupToken, AdminACL: admins, Trusted: trusted,
	})
	a.handler = a.router(opts.UI)

	bg, cancel := context.WithCancel(context.Background())
	a.cancel = cancel
	go a.runBackground(bg)
	ok = true
	return a, nil
}

// bootstrapAdmin creates the first administrator from the configuration or
// prepares the one-time setup token for the web setup wizard.
func (a *App) bootstrapAdmin(ctx context.Context) error {
	tokenFile := filepath.Join(a.Config.Storage.Path, "setup-token")
	has, err := a.Auth.HasUsers(ctx)
	if err != nil {
		return err
	}
	if has {
		os.Remove(tokenFile)
		return nil
	}
	if pw := a.Config.Security.AdminPassword; pw != "" {
		if err := a.Auth.CreateFirstUser(ctx, a.Config.Security.AdminUser, pw); err != nil {
			return fmt.Errorf("create initial administrator: %w", err)
		}
		a.log.Info("initial administrator created from configuration", "user", a.Config.Security.AdminUser)
		os.Remove(tokenFile)
		return nil
	}
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return err
	}
	a.SetupToken = hex.EncodeToString(buf)
	if err := os.WriteFile(tokenFile, []byte(a.SetupToken+"\n"), 0o600); err != nil {
		return fmt.Errorf("write setup token: %w", err)
	}
	// The token itself is not logged, only where to find it.
	a.log.Info("no administrator exists yet: open the web interface and complete the setup", "setup_token_file", tokenFile)
	return nil
}

func (a *App) runBackground(ctx context.Context) {
	defer close(a.background)
	done := make(chan struct{}, 2)
	go func() {
		a.Stats.Run(ctx, a.Config.Monitoring.HistoryRetain.Std(), a.API.Live)
		done <- struct{}{}
	}()
	go func() {
		// Reconcile disk and database once, then keep the store healthy.
		if rep, err := a.Store.Recover(ctx); err != nil && ctx.Err() == nil {
			a.log.Error("storage recovery failed", "err", err)
		} else if err == nil {
			a.log.Debug("storage recovery finished", "orphans", rep.OrphanFiles, "missing", rep.MissingBlobs)
		}
		c := a.Config
		a.Store.RunMaintenance(ctx, c.Storage.GCInterval.Std(), c.Storage.VerifyInterval.Std(),
			c.Storage.VerifyBatchSize, c.Cache.ImmutableMaxAge.Std())
		done <- struct{}{}
	}()
	purge := time.NewTicker(time.Hour)
	defer purge.Stop()
	for {
		select {
		case <-ctx.Done():
			<-done
			<-done
			return
		case <-purge.C:
			if err := a.Auth.PurgeExpired(ctx); err != nil && ctx.Err() == nil {
				a.log.Warn("purge expired sessions", "err", err)
			}
		}
	}
}

// Handler returns the root HTTP handler.
func (a *App) Handler() http.Handler { return a.handler }

// Close stops downloads and background jobs and closes the database.
func (a *App) Close() error {
	a.DL.Close()
	a.cancel()
	<-a.background
	return a.DB.Close()
}

func (a *App) router(ui fs.FS) http.Handler {
	uiHandler := uiHandler(ui)
	reg := a.Modules.Registry()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		switch {
		case p == "/healthz":
			r2 := r.Clone(r.Context())
			r2.URL.Path = "/api/v1/health"
			a.API.ServeHTTP(w, r2)
		case strings.HasPrefix(p, "/api/"):
			a.API.ServeHTTP(w, r)
		default:
			first, _, _ := strings.Cut(strings.TrimPrefix(p, "/"), "/")
			if _, ok := reg.Get(first); ok {
				a.Proxy.ServeHTTP(w, r)
				return
			}
			uiHandler.ServeHTTP(w, r)
		}
	})
}

const noUIPage = `<!doctype html><meta charset="utf-8"><title>UniCache</title>
<body style="font-family:system-ui;background:#0b0f17;color:#e5e7eb;padding:3rem">
<h1>UniCache is running</h1>
<p>This binary was built without the web interface. Build with <code>make build</code>
(or <code>go build -tags ui</code> after <code>npm run build</code> in <code>web/</code>).</p>
<p>The cache endpoints and the API under <code>/api/v1</code> are fully functional.</p></body>`

// uiHandler serves the single-page frontend with a fallback to index.html
// for client-side routes.
func uiHandler(ui fs.FS) http.Handler {
	setHeaders := func(w http.ResponseWriter) {
		h := w.Header()
		h.Set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
	}
	if ui == nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			setHeaders(w)
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			fmt.Fprint(w, noUIPage)
		})
	}
	files := http.FileServerFS(ui)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		setHeaders(w)
		name := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if name == "" {
			name = "index.html"
		}
		if st, err := fs.Stat(ui, name); err != nil || st.IsDir() {
			// Unknown path: let the client-side router handle it.
			r = r.Clone(r.Context())
			r.URL.Path = "/"
			w.Header().Set("Cache-Control", "no-cache")
		} else if strings.HasPrefix(name, "assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		files.ServeHTTP(w, r)
	})
}

// Serve runs the HTTP server until ctx is cancelled, then shuts down
// gracefully.
func (a *App) Serve(ctx context.Context) error {
	cfg := a.Config
	srv := &http.Server{
		Addr:              cfg.Server.Addr(),
		Handler:           a.handler,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    64 << 10,
		// No WriteTimeout: package downloads may legitimately take long.
		BaseContext: func(net.Listener) context.Context { return context.WithoutCancel(ctx) },
	}
	ln, err := net.Listen("tcp", srv.Addr)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", srv.Addr, err)
	}
	errc := make(chan error, 1)
	go func() {
		if cfg.Server.TLSEnabled() {
			errc <- srv.ServeTLS(ln, cfg.Server.TLSCert, cfg.Server.TLSKey)
		} else {
			errc <- srv.Serve(ln)
		}
	}()
	a.log.Info("UniCache is listening", "addr", ln.Addr().String(), "tls", cfg.Server.TLSEnabled())
	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	a.log.Info("shutting down")
	sctx, cancel := context.WithTimeout(context.Background(), cfg.Server.ShutdownTimeout.Std())
	defer cancel()
	if err := srv.Shutdown(sctx); err != nil {
		a.log.Warn("forcing shutdown, some transfers were interrupted", "err", err)
		srv.Close()
	}
	if err := <-errc; err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
