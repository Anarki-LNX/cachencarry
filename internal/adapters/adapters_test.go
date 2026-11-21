package adapters

import (
	"net/http"
	"testing"
	"time"
)

func TestAPTClassification(t *testing.T) {
	cases := map[string]Kind{
		"dists/trixie/InRelease":                                    Mutable,
		"dists/trixie/Release":                                      Mutable,
		"dists/trixie/Release.gpg":                                  Mutable,
		"dists/trixie/main/binary-amd64/Packages.xz":                Mutable,
		"dists/trixie/main/source/Sources.xz":                       Mutable,
		"dists/trixie/main/i18n/Translation-en.xz":                  Mutable,
		"dists/trixie/main/Contents-amd64.gz":                       Mutable,
		"dists/trixie/main/binary-amd64/by-hash/SHA256/9f86d081884": Immutable,
		"pool/main/h/hello/hello_2.10-3_amd64.deb":                  Immutable,
		"pool/main/h/hello/hello_2.10-3.dsc":                        Immutable,
		"pool/main/h/hello/hello_2.10.orig.tar.gz":                  Immutable,
		"ls-lR.gz": Mutable,
	}
	for p, want := range cases {
		if got := (APT{}).Classify(p).Kind; got != want {
			t.Errorf("APT %s: kind %d, want %d", p, got, want)
		}
	}
	if ct := (APT{}).Classify("pool/main/a/a_1_all.deb").ContentType; ct != "application/vnd.debian.binary-package" {
		t.Errorf("deb content type = %q", ct)
	}
}

func TestPacmanClassification(t *testing.T) {
	cases := map[string]Kind{
		"core/os/x86_64/core.db":                                     Mutable,
		"core/os/x86_64/core.db.sig":                                 Mutable,
		"core/os/x86_64/core.files":                                  Mutable,
		"core/os/x86_64/core.db.tar.gz":                              Mutable,
		"extra/os/x86_64/extra.files.tar.gz":                         Mutable,
		"core/os/x86_64/linux-6.12.1.arch1-1-x86_64.pkg.tar.zst":     Immutable,
		"core/os/x86_64/linux-6.12.1.arch1-1-x86_64.pkg.tar.zst.sig": Immutable,
		"extra/os/x86_64/python-3.13.1-1-x86_64.pkg.tar.xz":          Immutable,
		"x86_64_v3/cachyos-v3/cachyos-v3.db":                         Mutable,
		"x86_64_v3/cachyos-v3/mesa-1:25.0-1-x86_64_v3.pkg.tar.zst":   Immutable,
		"lastsync": Mutable,
	}
	for p, want := range cases {
		if got := (Pacman{}).Classify(p).Kind; got != want {
			t.Errorf("pacman %s: kind %d, want %d", p, got, want)
		}
	}
}

func TestGenericCacheability(t *testing.T) {
	def := 5 * time.Minute
	h := func(kv ...string) http.Header {
		out := http.Header{}
		for i := 0; i+1 < len(kv); i += 2 {
			out.Add(kv[i], kv[i+1])
		}
		return out
	}
	cases := []struct {
		name string
		h    http.Header
		ok   bool
		ttl  time.Duration
	}{
		{"plain with validator", h("ETag", `"a"`), true, def},
		{"max-age", h("Cache-Control", "public, max-age=60"), true, time.Minute},
		{"s-maxage wins", h("Cache-Control", "max-age=60, s-maxage=600"), true, 10 * time.Minute},
		{"s-maxage wins either order", h("Cache-Control", "s-maxage=600, max-age=60"), true, 10 * time.Minute},
		{"age is subtracted", h("Cache-Control", "max-age=60", "Age", "20"), true, 40 * time.Second},
		{"no-store", h("Cache-Control", "no-store"), false, 0},
		{"private", h("Cache-Control", "private, max-age=60"), false, 0},
		{"no-cache with validator", h("Cache-Control", "no-cache", "ETag", `"a"`), true, 0},
		{"no-cache without validator", h("Cache-Control", "no-cache"), false, 0},
		{"set-cookie", h("Set-Cookie", "a=b", "Cache-Control", "max-age=60"), false, 0},
		{"vary accept-encoding", h("Vary", "Accept-Encoding", "ETag", `"a"`), true, def},
		{"vary other", h("Vary", "Accept-Encoding, Cookie"), false, 0},
		{"vary star", h("Vary", "*"), false, 0},
		{"expired", h("Expires", "Thu, 01 Jan 1970 00:00:00 GMT", "Last-Modified", "Thu, 01 Jan 1970 00:00:00 GMT"), true, 0},
		{"invalid expires without validator", h("Expires", "0"), false, 0},
	}
	for _, c := range cases {
		ttl, ok := (Generic{}).Cacheable(c.h, def)
		if ok != c.ok || (ok && ttl != c.ttl) {
			t.Errorf("%s: got (%v, %v), want (%v, %v)", c.name, ttl, ok, c.ttl, c.ok)
		}
	}
}

func TestRegistry(t *testing.T) {
	r := Builtin()
	names := r.Names()
	if len(names) != 3 || names[0] != "apt" || names[1] != "generic" || names[2] != "pacman" {
		t.Fatalf("names = %v", names)
	}
	for _, n := range names {
		a, _ := r.Get(n)
		if i := a.Info(); i.Name != n || i.Title == "" || i.Description == "" || i.Maturity == "" {
			t.Errorf("%s: incomplete info %+v", n, i)
		}
		if a.ClientConfig("http://cache.lan:8080/"+n+"/x", "x") == "" {
			t.Errorf("%s: no client configuration", n)
		}
	}
	if _, ok := r.Get("api"); ok {
		t.Error("an adapter must never be named like a reserved path")
	}
}
