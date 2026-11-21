package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func write(t *testing.T, body string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(p, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestDefaultsAreValidAndSafe(t *testing.T) {
	c := Default()
	c.finalize()
	if err := c.Validate(); err != nil {
		t.Fatal(err)
	}
	if c.Security.AllowPrivateUpstreams {
		t.Error("private upstreams must be off by default")
	}
	for _, cidr := range c.Security.AllowedClients {
		if cidr == "0.0.0.0/0" || cidr == "::/0" {
			t.Error("default client ACL must not allow the whole Internet")
		}
	}
	if c.Database.Path != "/var/lib/cachencarry/metadata.db" {
		t.Errorf("database path = %q", c.Database.Path)
	}
}

func TestLoadFileAndEnvOverrides(t *testing.T) {
	p := write(t, `
server:
  port: 9000
storage:
  path: /srv/cache
  max_size: 500GB
  min_free_space: 5%
cache:
  metadata_ttl: 10m
  immutable_max_age: 90d
modules:
  apt:
    enabled: true
    repositories:
      - name: mymirror
        upstreams: ["https://mirror.example.org/debian"]
`)
	t.Setenv("CACHENCARRY_SERVER_PORT", "9100")
	t.Setenv("CACHENCARRY_STORAGE_MAX_SIZE", "2TB")
	t.Setenv("CACHENCARRY_SECURITY_ALLOWED_CLIENTS", "10.1.0.0/16, 192.168.7.0/24")
	t.Setenv("CACHENCARRY_SECURITY_ALLOW_PRIVATE_UPSTREAMS", "true")
	t.Setenv("CACHENCARRY_DOWNLOAD_IDLE_TIMEOUT", "2m")
	t.Setenv("CACHENCARRY_MODULES_PACMAN_ENABLED", "false")
	c, err := Load(p, false)
	if err != nil {
		t.Fatal(err)
	}
	if c.Server.Port != 9100 {
		t.Errorf("env must override file: port = %d", c.Server.Port)
	}
	if c.Storage.MaxSize != 2<<40 || c.Storage.Path != "/srv/cache" {
		t.Errorf("storage = %+v", c.Storage)
	}
	if c.Database.Path != "/srv/cache/metadata.db" {
		t.Errorf("database path = %q", c.Database.Path)
	}
	if c.Cache.MetadataTTL.Std() != 10*time.Minute || c.Cache.ImmutableMaxAge.Std() != 90*24*time.Hour {
		t.Errorf("cache = %+v", c.Cache)
	}
	if len(c.Security.AllowedClients) != 2 || c.Security.AllowedClients[1] != "192.168.7.0/24" {
		t.Errorf("allowed clients = %v", c.Security.AllowedClients)
	}
	if !c.Security.AllowPrivateUpstreams || c.Download.IdleTimeout.Std() != 2*time.Minute {
		t.Error("bool/duration override not applied")
	}
	// A module given in the file replaces the built-in example repos.
	if r := c.Modules["apt"].Repositories; len(r) != 1 || r[0].Name != "mymirror" {
		t.Errorf("apt repositories = %+v", r)
	}
	if c.Modules["pacman"].Enabled {
		t.Error("module env override not applied")
	}
}

func TestMissingFile(t *testing.T) {
	if _, err := Load("/nonexistent/config.yaml", false); err == nil {
		t.Error("explicitly named missing file must be an error")
	}
	if _, err := Load("/nonexistent/config.yaml", true); err != nil {
		t.Errorf("optional missing file: %v", err)
	}
	if _, err := Load(write(t, ""), false); err != nil {
		t.Errorf("empty file: %v", err)
	}
}

func TestInvalidConfigurationsAreRejected(t *testing.T) {
	cases := map[string]string{
		"unknown key":      "server:\n  prot: 80\n",
		"port range":       "server:\n  port: 70000\n",
		"listen":           "server:\n  listen: not-an-ip\n",
		"relative storage": "storage:\n  path: data\n",
		"bad size":         "storage:\n  max_size: lots\n",
		"bad min free":     "storage:\n  min_free_space: 150%\n",
		"bad duration":     "cache:\n  metadata_ttl: soon\n",
		"driver":           "database:\n  driver: postgres\n",
		"cidr":             "security:\n  allowed_clients: [\"10.0.0.0/33\"]\n",
		"tls half":         "server:\n  tls_cert: /a.pem\n",
		"log level":        "logging:\n  level: loud\n",
		"upstream scheme":  "modules:\n  apt:\n    repositories:\n      - name: x\n        upstreams: [\"ftp://m.example\"]\n",
		"upstream creds":   "modules:\n  apt:\n    repositories:\n      - name: x\n        upstreams: [\"https://u:p@m.example\"]\n",
		"repo name":        "modules:\n  apt:\n    repositories:\n      - name: \"a/b\"\n        upstreams: [\"https://m.example\"]\n",
		"repo duplicate":   "modules:\n  apt:\n    repositories:\n      - {name: x, upstreams: [\"https://m.example\"]}\n      - {name: x, upstreams: [\"https://n.example\"]}\n",
		"no upstream":      "modules:\n  apt:\n    repositories:\n      - name: x\n",
		"newer schema":     "version: 99\n",
		"concurrency":      "download:\n  max_concurrent: 0\n",
	}
	for name, body := range cases {
		if _, err := Load(write(t, body), false); err == nil {
			t.Errorf("%s: configuration was accepted", name)
		}
	}
	t.Setenv("CACHENCARRY_SERVER_PORT", "eighty")
	if _, err := Load("", true); err == nil || !strings.Contains(err.Error(), "CACHENCARRY_SERVER_PORT") {
		t.Errorf("bad env override: err = %v", err)
	}
}

func TestParsers(t *testing.T) {
	sizes := map[string]ByteSize{"0": 0, "1024": 1024, "1KB": 1 << 10, "1.5 GiB": 3 << 29, "4TB": 4 << 40, "10m": 10 << 20}
	for in, want := range sizes {
		if got, err := ParseByteSize(in); err != nil || got != want {
			t.Errorf("ParseByteSize(%q) = %d, %v; want %d", in, got, err, want)
		}
	}
	for _, in := range []string{"-1GB", "GB", "1XB"} {
		if _, err := ParseByteSize(in); err == nil {
			t.Errorf("ParseByteSize(%q) accepted", in)
		}
	}
	if b, p, err := ParseMinFree("10%"); err != nil || b != 0 || p != 10 {
		t.Errorf("ParseMinFree(10%%) = %d, %v, %v", b, p, err)
	}
	if b, p, err := ParseMinFree("20GB"); err != nil || b != 20<<30 || p != 0 {
		t.Errorf("ParseMinFree(20GB) = %d, %v, %v", b, p, err)
	}
	if d, err := ParseDuration("7d"); err != nil || d != 7*24*time.Hour {
		t.Errorf("ParseDuration(7d) = %v, %v", d, err)
	}
}
