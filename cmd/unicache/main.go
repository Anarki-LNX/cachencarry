// Command unicache is the UniCache server.
package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/Anarki-LNX/unicache/internal/app"
	"github.com/Anarki-LNX/unicache/internal/config"
	"github.com/Anarki-LNX/unicache/internal/database"
	"github.com/Anarki-LNX/unicache/internal/security"
	"github.com/Anarki-LNX/unicache/web"
)

// version is set at build time with -ldflags "-X main.version=…".
var version = "dev"

const usage = `UniCache - the universal cache for homelabs, self-hosting and small networks

Usage:
  unicache [serve] [-config FILE]     run the server (default)
  unicache check-config [-config FILE]  validate the configuration and exit
  unicache healthcheck [-config FILE]   exit 0 if the local server is healthy
  unicache reset-password [-config FILE] -user NAME
                                      set a new password (read from stdin)
  unicache backup [-config FILE] -out FILE
                                      write a consistent copy of the metadata database
  unicache version

The configuration file defaults to $UNICACHE_CONFIG or /etc/unicache/config.yaml.
Every setting can be overridden with UNICACHE_<SECTION>_<KEY> variables.
`

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "unicache:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	cmd := "serve"
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		cmd, args = args[0], args[1:]
	}
	fs := flag.NewFlagSet(cmd, flag.ContinueOnError)
	fs.Usage = func() { fmt.Fprint(os.Stderr, usage) }
	defPath := os.Getenv("UNICACHE_CONFIG")
	explicit := defPath != ""
	if defPath == "" {
		defPath = "/etc/unicache/config.yaml"
	}
	cfgPath := fs.String("config", defPath, "configuration file")
	user := fs.String("user", "admin", "user name (reset-password)")
	out := fs.String("out", "", "output file (backup)")
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return err
	}
	fs.Visit(func(f *flag.Flag) {
		if f.Name == "config" {
			explicit = true
		}
	})

	switch cmd {
	case "version":
		fmt.Println("unicache", version)
		return nil
	case "help":
		fmt.Print(usage)
		return nil
	}
	// A config file the user named explicitly must exist; the default
	// location is optional so a pure environment setup works.
	cfg, err := config.Load(*cfgPath, !explicit)
	if err != nil {
		return err
	}

	switch cmd {
	case "check-config":
		fmt.Println("configuration is valid")
		return nil
	case "healthcheck":
		return healthcheck(cfg)
	case "reset-password":
		return resetPassword(cfg, *user)
	case "backup":
		return backup(cfg, *out)
	case "serve":
		return serve(cfg)
	default:
		fmt.Fprint(os.Stderr, usage)
		return fmt.Errorf("unknown command %q", cmd)
	}
}

func newLogger(cfg *config.Config) (*slog.Logger, func(), error) {
	var level slog.Level
	if err := level.UnmarshalText([]byte(cfg.Logging.Level)); err != nil {
		return nil, nil, err
	}
	var w io.Writer = os.Stderr
	closer := func() {}
	if cfg.Logging.File != "" {
		f, err := os.OpenFile(cfg.Logging.File, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o640)
		if err != nil {
			return nil, nil, fmt.Errorf("open log file: %w", err)
		}
		w = io.MultiWriter(os.Stderr, f)
		closer = func() { f.Close() }
	}
	opts := &slog.HandlerOptions{Level: level}
	if cfg.Logging.Format == "json" {
		return slog.New(slog.NewJSONHandler(w, opts)), closer, nil
	}
	return slog.New(slog.NewTextHandler(w, opts)), closer, nil
}

func serve(cfg *config.Config) error {
	log, closeLog, err := newLogger(cfg)
	if err != nil {
		return err
	}
	defer closeLog()
	slog.SetDefault(log)
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	log.Info("starting UniCache", "version", version, "storage", cfg.Storage.Path)
	a, err := app.New(ctx, cfg, app.Options{Version: version, Logger: log, UI: web.FS()})
	if err != nil {
		return err
	}
	serveErr := a.Serve(ctx)
	if err := a.Close(); err != nil {
		log.Error("close", "err", err)
	}
	log.Info("stopped")
	return serveErr
}

func healthcheck(cfg *config.Config) error {
	host := cfg.Server.Listen
	if ip := net.ParseIP(host); host == "" || (ip != nil && ip.IsUnspecified()) {
		host = "127.0.0.1"
	}
	scheme := "http"
	client := &http.Client{Timeout: 5 * time.Second}
	if cfg.Server.TLSEnabled() {
		// The health check talks to this very process over loopback; the
		// certificate is issued for the public name, not for 127.0.0.1.
		return tlsHealthcheck(net.JoinHostPort(host, strconv.Itoa(cfg.Server.Port)))
	}
	resp, err := client.Get(scheme + "://" + net.JoinHostPort(host, strconv.Itoa(cfg.Server.Port)) + "/api/v1/health")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unhealthy: HTTP %d", resp.StatusCode)
	}
	return nil
}

// tlsHealthcheck only verifies that the TLS listener accepts connections.
func tlsHealthcheck(addr string) error {
	c, err := net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		return err
	}
	return c.Close()
}

func resetPassword(cfg *config.Config, user string) error {
	fmt.Fprint(os.Stderr, "New password (reading one line from stdin): ")
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && line == "" {
		return fmt.Errorf("read password: %w", err)
	}
	pw := strings.TrimRight(line, "\r\n")
	ctx := context.Background()
	db, err := database.Open(ctx, cfg.Database.Path)
	if err != nil {
		return err
	}
	defer db.Close()
	auth := security.NewAuth(db, 0)
	var id int64
	err = db.R.QueryRowContext(ctx, `SELECT id FROM users WHERE username = ?`, user).Scan(&id)
	if err != nil {
		// Unknown user: create it (this also recovers an installation
		// without any administrator).
		if cerr := auth.CreateUser(ctx, user, pw); cerr != nil {
			return cerr
		}
		fmt.Fprintf(os.Stderr, "\nadministrator %q created\n", user)
		return nil
	}
	if err := auth.SetPassword(ctx, id, pw); err != nil {
		return err
	}
	fmt.Fprintf(os.Stderr, "\npassword of %q changed, all sessions ended\n", user)
	return nil
}

func backup(cfg *config.Config, out string) error {
	if out == "" {
		return errors.New("backup: -out FILE is required")
	}
	if _, err := os.Stat(out); err == nil {
		return fmt.Errorf("backup: %s already exists", out)
	}
	ctx := context.Background()
	db, err := database.Open(ctx, cfg.Database.Path)
	if err != nil {
		return err
	}
	defer db.Close()
	if err := db.Backup(ctx, out); err != nil {
		return err
	}
	fmt.Println("metadata database written to", out)
	return nil
}
