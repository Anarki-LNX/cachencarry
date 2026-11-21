// Package config loads, validates and exposes the UniCache configuration.
//
// Configuration comes from a single YAML file. Every scalar setting can be
// overridden through an environment variable named UNICACHE_<SECTION>_<KEY>
// (for example UNICACHE_SERVER_PORT=9090). Docker and native installations use
// exactly the same format.
package config

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// CurrentVersion is the configuration schema version written by this release.
// Older files are migrated in memory by migrate(); the file on disk is never
// rewritten automatically.
const CurrentVersion = 1

// Config is the root of the configuration tree.
type Config struct {
	Version    int               `yaml:"version"`
	Server     Server            `yaml:"server"`
	Storage    Storage           `yaml:"storage"`
	Database   Database          `yaml:"database"`
	Cache      Cache             `yaml:"cache"`
	Download   Download          `yaml:"download"`
	Security   Security          `yaml:"security"`
	Logging    Logging           `yaml:"logging"`
	Monitoring Monitoring        `yaml:"monitoring"`
	Modules    map[string]Module `yaml:"modules"`
}

// Server configures the HTTP listener that serves both the cache endpoints
// and the management interface.
type Server struct {
	Listen          string   `yaml:"listen"`
	Port            int      `yaml:"port"`
	TLSCert         string   `yaml:"tls_cert"`
	TLSKey          string   `yaml:"tls_key"`
	ShutdownTimeout Duration `yaml:"shutdown_timeout"`
	// TrustedProxies lists CIDRs whose X-Forwarded-For header is honoured.
	TrustedProxies []string `yaml:"trusted_proxies"`
}

// Storage configures the shared content addressable store.
type Storage struct {
	Path string `yaml:"path"`
	// MaxSize is the upper bound for stored blob bytes. Zero means unlimited.
	MaxSize ByteSize `yaml:"max_size"`
	// MinFreeSpace is either an absolute size ("20GB") or a percentage of
	// the filesystem ("10%").
	MinFreeSpace    string   `yaml:"min_free_space"`
	GCInterval      Duration `yaml:"gc_interval"`
	VerifyInterval  Duration `yaml:"verify_interval"`
	VerifyBatchSize int      `yaml:"verify_batch_size"`
}

// Database configures the metadata database.
type Database struct {
	Driver string `yaml:"driver"`
	Path   string `yaml:"path"`
}

// Cache holds the global cache policy defaults.
type Cache struct {
	// MetadataTTL is how long mutable repository metadata is served without
	// revalidating it upstream.
	MetadataTTL Duration `yaml:"metadata_ttl"`
	// NegativeTTL is how long an upstream 404 is remembered (in memory).
	NegativeTTL Duration `yaml:"negative_ttl"`
	// ImmutableMaxAge bounds how long unused immutable objects are kept.
	// Zero keeps them until LRU eviction needs the space.
	ImmutableMaxAge Duration `yaml:"immutable_max_age"`
	// ServeStaleOnError serves expired metadata when the upstream is down.
	ServeStaleOnError bool `yaml:"serve_stale_on_error"`
}

// Download configures the central download manager.
type Download struct {
	MaxConcurrent   int      `yaml:"max_concurrent"`
	ConnectTimeout  Duration `yaml:"connect_timeout"`
	HeaderTimeout   Duration `yaml:"header_timeout"`
	IdleTimeout     Duration `yaml:"idle_timeout"`
	Retries         int      `yaml:"retries"`
	RetryBackoff    Duration `yaml:"retry_backoff"`
	MaxObjectSize   ByteSize `yaml:"max_object_size"`
	UpstreamRateLim ByteSize `yaml:"upstream_rate_limit"`
	ClientRateLimit ByteSize `yaml:"client_rate_limit"`
	Resume          bool     `yaml:"resume"`
	UserAgent       string   `yaml:"user_agent"`
}

// Security configures access control and the administrative login.
type Security struct {
	// AllowedClients lists the CIDRs that may use the cache endpoints.
	AllowedClients []string `yaml:"allowed_clients"`
	// AdminAllowed lists the CIDRs that may reach the management API.
	AdminAllowed []string `yaml:"admin_allowed"`
	// AllowPrivateUpstreams permits upstream hosts that resolve to private,
	// loopback or link-local addresses. Off by default (SSRF protection).
	AllowPrivateUpstreams bool     `yaml:"allow_private_upstreams"`
	SessionTTL            Duration `yaml:"session_ttl"`
	// AdminUser / AdminPassword bootstrap the first administrator. The
	// password is only read on first start and should be supplied through
	// UNICACHE_SECURITY_ADMIN_PASSWORD rather than the file.
	AdminUser     string `yaml:"admin_user"`
	AdminPassword string `yaml:"admin_password"`
	// SecureCookies forces the Secure attribute on session cookies. It is
	// enabled automatically when TLS is configured.
	SecureCookies bool `yaml:"secure_cookies"`
}

// Logging configures structured logging.
type Logging struct {
	Level  string `yaml:"level"`
	Format string `yaml:"format"`
	File   string `yaml:"file"`
}

// Monitoring configures statistics collection.
type Monitoring struct {
	Enabled       bool     `yaml:"enabled"`
	LiveStats     bool     `yaml:"live_stats"`
	RequestLog    int      `yaml:"request_log_size"`
	HistoryRetain Duration `yaml:"history_retention"`
}

// Module configures one protocol adapter.
type Module struct {
	Enabled bool `yaml:"enabled"`
	// MetadataTTL overrides cache.metadata_ttl for this module when set.
	MetadataTTL  Duration     `yaml:"metadata_ttl"`
	Repositories []Repository `yaml:"repositories"`
}

// Repository describes one upstream repository of a module. Clients address
// it as /<module>/<name>/<path>.
type Repository struct {
	Name string `yaml:"name"`
	// Upstreams are tried in order; later entries are failover mirrors.
	Upstreams []string `yaml:"upstreams"`
}

// Addr returns the listen address in host:port form.
func (s Server) Addr() string {
	return net.JoinHostPort(s.Listen, strconv.Itoa(s.Port))
}

// TLSEnabled reports whether the listener should terminate TLS.
func (s Server) TLSEnabled() bool { return s.TLSCert != "" && s.TLSKey != "" }

// Default returns the built-in defaults. They are safe for a LAN-only
// installation: only private client ranges are allowed and private upstreams
// are rejected.
func Default() *Config {
	return &Config{
		Version: CurrentVersion,
		Server: Server{
			Listen:          "0.0.0.0",
			Port:            8080,
			ShutdownTimeout: Duration(20 * time.Second),
		},
		Storage: Storage{
			Path:            "/var/lib/unicache",
			MaxSize:         0,
			MinFreeSpace:    "10%",
			GCInterval:      Duration(10 * time.Minute),
			VerifyInterval:  Duration(6 * time.Hour),
			VerifyBatchSize: 200,
		},
		Database: Database{Driver: "sqlite"},
		Cache: Cache{
			MetadataTTL:       Duration(5 * time.Minute),
			NegativeTTL:       Duration(30 * time.Second),
			ServeStaleOnError: true,
		},
		Download: Download{
			MaxConcurrent:  16,
			ConnectTimeout: Duration(15 * time.Second),
			HeaderTimeout:  Duration(30 * time.Second),
			IdleTimeout:    Duration(60 * time.Second),
			Retries:        3,
			RetryBackoff:   Duration(500 * time.Millisecond),
			Resume:         true,
			UserAgent:      "UniCache/0.1 (+https://github.com/Anarki-LNX/unicache)",
		},
		Security: Security{
			AllowedClients: []string{
				"127.0.0.0/8", "::1/128", "10.0.0.0/8", "172.16.0.0/12",
				"192.168.0.0/16", "fc00::/7", "fe80::/10",
			},
			AdminAllowed: []string{
				"127.0.0.0/8", "::1/128", "10.0.0.0/8", "172.16.0.0/12",
				"192.168.0.0/16", "fc00::/7", "fe80::/10",
			},
			SessionTTL: Duration(12 * time.Hour),
			AdminUser:  "admin",
		},
		Logging: Logging{Level: "info", Format: "text"},
		Monitoring: Monitoring{
			Enabled:       true,
			LiveStats:     true,
			RequestLog:    2000,
			HistoryRetain: Duration(30 * 24 * time.Hour),
		},
		Modules: map[string]Module{
			"apt": {Enabled: true, Repositories: []Repository{
				{Name: "debian", Upstreams: []string{"https://deb.debian.org/debian"}},
				{Name: "debian-security", Upstreams: []string{"https://security.debian.org/debian-security"}},
				{Name: "ubuntu", Upstreams: []string{"http://archive.ubuntu.com/ubuntu"}},
				{Name: "ubuntu-security", Upstreams: []string{"http://security.ubuntu.com/ubuntu"}},
			}},
			"pacman": {Enabled: true, Repositories: []Repository{
				{Name: "archlinux", Upstreams: []string{
					"https://geo.mirror.pkgbuild.com",
					"https://mirror.rackspace.com/archlinux",
				}},
				{Name: "cachyos", Upstreams: []string{"https://mirror.cachyos.org/repo"}},
			}},
			"generic": {Enabled: false},
		},
	}
}

// Load reads the configuration file at path (if it exists), applies
// environment overrides and validates the result. A missing file is not an
// error when path is empty or optional is true: the defaults are used.
func Load(path string, optional bool) (*Config, error) {
	cfg := Default()
	if path != "" {
		data, err := os.ReadFile(path)
		switch {
		case err == nil:
			dec := yaml.NewDecoder(bytes.NewReader(data))
			dec.KnownFields(true)
			// An empty file (io.EOF) simply keeps the defaults. A module
			// present in the file replaces the built-in module of the
			// same name as a whole (yaml.v3 map semantics), so users
			// never get example repositories mixed into their own.
			if err := dec.Decode(cfg); err != nil && !errors.Is(err, io.EOF) {
				return nil, fmt.Errorf("parse %s: %w", path, err)
			}
		case os.IsNotExist(err) && optional:
			// defaults
		default:
			return nil, fmt.Errorf("read config: %w", err)
		}
	}
	if err := migrate(cfg); err != nil {
		return nil, err
	}
	if err := applyEnv(cfg, os.Environ()); err != nil {
		return nil, err
	}
	cfg.finalize()
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

// migrate upgrades older configuration schema versions in memory.
func migrate(cfg *Config) error {
	if cfg.Version == 0 {
		cfg.Version = CurrentVersion
	}
	if cfg.Version > CurrentVersion {
		return fmt.Errorf("config version %d is newer than this release supports (%d)", cfg.Version, CurrentVersion)
	}
	// Future schema changes add `case` steps here: each step transforms
	// version N into N+1 so users never have to edit their file by hand.
	return nil
}

func (c *Config) finalize() {
	if c.Database.Path == "" {
		c.Database.Path = filepath.Join(c.Storage.Path, "metadata.db")
	}
	if c.Modules == nil {
		c.Modules = map[string]Module{}
	}
}

var repoNameRE = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{0,62}$`)

// ValidRepoName reports whether name is usable as a URL path segment that
// identifies a repository.
func ValidRepoName(name string) bool { return repoNameRE.MatchString(name) }

// ValidateUpstream checks that raw is an absolute http(s) URL without
// credentials, query or fragment.
func ValidateUpstream(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("invalid upstream URL %q: %w", raw, err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("upstream %q: scheme must be http or https", raw)
	}
	if u.Host == "" {
		return fmt.Errorf("upstream %q: missing host", raw)
	}
	if u.User != nil {
		return fmt.Errorf("upstream %q: credentials in URLs are not allowed", raw)
	}
	if u.RawQuery != "" || u.Fragment != "" {
		return fmt.Errorf("upstream %q: query and fragment are not allowed", raw)
	}
	return nil
}

// Validate checks the whole configuration and returns every problem found.
func (c *Config) Validate() error {
	var errs []error
	add := func(format string, a ...any) { errs = append(errs, fmt.Errorf(format, a...)) }

	if c.Server.Port < 1 || c.Server.Port > 65535 {
		add("server.port %d out of range", c.Server.Port)
	}
	if c.Server.Listen != "" && net.ParseIP(c.Server.Listen) == nil {
		add("server.listen %q is not an IP address", c.Server.Listen)
	}
	if (c.Server.TLSCert == "") != (c.Server.TLSKey == "") {
		add("server.tls_cert and server.tls_key must be set together")
	}
	if c.Storage.Path == "" || !filepath.IsAbs(c.Storage.Path) {
		add("storage.path must be an absolute path")
	}
	if _, _, err := ParseMinFree(c.Storage.MinFreeSpace); err != nil {
		add("storage.min_free_space: %v", err)
	}
	if c.Database.Driver != "sqlite" {
		add("database.driver %q is not supported (only sqlite)", c.Database.Driver)
	}
	if c.Download.MaxConcurrent < 1 {
		add("download.max_concurrent must be at least 1")
	}
	if c.Download.Retries < 0 {
		add("download.retries must not be negative")
	}
	if time.Duration(c.Cache.MetadataTTL) < 0 {
		add("cache.metadata_ttl must not be negative")
	}
	for _, list := range [][]string{c.Security.AllowedClients, c.Security.AdminAllowed, c.Server.TrustedProxies} {
		for _, cidr := range list {
			if _, _, err := net.ParseCIDR(cidr); err != nil {
				add("invalid CIDR %q", cidr)
			}
		}
	}
	switch c.Logging.Level {
	case "debug", "info", "warn", "error":
	default:
		add("logging.level %q must be debug, info, warn or error", c.Logging.Level)
	}
	switch c.Logging.Format {
	case "text", "json":
	default:
		add("logging.format %q must be text or json", c.Logging.Format)
	}
	for modName, m := range c.Modules {
		seen := map[string]bool{}
		for _, r := range m.Repositories {
			if !ValidRepoName(r.Name) {
				add("modules.%s: invalid repository name %q", modName, r.Name)
			}
			if seen[r.Name] {
				add("modules.%s: duplicate repository %q", modName, r.Name)
			}
			seen[r.Name] = true
			if len(r.Upstreams) == 0 {
				add("modules.%s.%s: at least one upstream is required", modName, r.Name)
			}
			for _, u := range r.Upstreams {
				if err := ValidateUpstream(u); err != nil {
					add("modules.%s.%s: %v", modName, r.Name, err)
				}
			}
		}
	}
	return errors.Join(errs...)
}

// ParseMinFree parses the min_free_space setting. It returns either an
// absolute byte count or a percentage (0-100); the other value is zero.
func ParseMinFree(s string) (bytes int64, percent float64, err error) {
	s = strings.TrimSpace(s)
	if s == "" || s == "0" {
		return 0, 0, nil
	}
	if strings.HasSuffix(s, "%") {
		p, err := strconv.ParseFloat(strings.TrimSuffix(s, "%"), 64)
		if err != nil || p < 0 || p >= 100 {
			return 0, 0, fmt.Errorf("invalid percentage %q", s)
		}
		return 0, p, nil
	}
	b, err := ParseByteSize(s)
	if err != nil {
		return 0, 0, err
	}
	return int64(b), 0, nil
}
