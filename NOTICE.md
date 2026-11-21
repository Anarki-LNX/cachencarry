# Third-party software

Cache & Carry is licensed under the Apache License 2.0. It builds on the following
free software. Thank you to their authors.

## Go modules (linked into the binary)

| Module | License | Use |
|---|---|---|
| [modernc.org/sqlite](https://gitlab.com/cznic/sqlite) and its `modernc.org/*` support modules | BSD-3-Clause | SQLite without CGO |
| SQLite itself | public domain | metadata database |
| [gopkg.in/yaml.v3](https://github.com/go-yaml/yaml) | MIT and Apache-2.0 | configuration file |
| [golang.org/x/crypto](https://pkg.go.dev/golang.org/x/crypto) | BSD-3-Clause | bcrypt password hashing |
| [golang.org/x/sys](https://pkg.go.dev/golang.org/x/sys) | BSD-3-Clause | filesystem statistics |
| Go standard library | BSD-3-Clause | everything else |

Indirect dependencies of the above (see `go.sum`) include
`github.com/dustin/go-humanize` (MIT), `github.com/google/uuid`
(BSD-3-Clause), `github.com/mattn/go-isatty` (MIT),
`github.com/ncruces/go-strftime` (MIT) and
`github.com/remyoudompheng/bigfft` (BSD-3-Clause).

## Frontend (bundled into the binary)

The dashboard's runtime and build dependencies and their versions are listed
in `web/package.json` and `web/package-lock.json`. Main runtime components:
React and React DOM (MIT), React Router (MIT), Tailwind CSS (MIT), lucide
icons (ISC).

## Container image

Based on `gcr.io/distroless/static-debian12` (Apache-2.0, with Debian CA
certificates and tzdata).

## Design and protocol references

Cache & Carry contains no code from these projects, but their behaviour and
documentation informed the design: apt-cacher-ng, pacoloco, the Debian
repository format, the Arch Linux mirror layout, RFC 9110 and RFC 9111.
