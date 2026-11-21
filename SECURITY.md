# Security

## Reporting a vulnerability

Please report security problems privately through GitHub's "Report a
vulnerability" (Security Advisories) on the repository instead of a public
issue. You will get an answer as soon as possible; please allow time for a fix
before publishing details.

## Threat model

UniCache is built for a **private LAN**. It protects against:

- clients outside the configured networks using the cache or the dashboard;
- being abused as an open proxy or for server-side request forgery (SSRF);
- a client tricking the cache into fetching or storing something outside a
  configured repository (path traversal, URL smuggling);
- corrupted or truncated downloads being served as valid cache entries;
- content from an upstream attacking the dashboard through the browser;
- attacks on the management interface (credential guessing, CSRF, session
  theft from a leaked database).

It does **not** protect against a malicious upstream serving bad packages.
That is the job of the package manager's signature verification, which
UniCache leaves completely intact: it never modifies repository metadata or
packages and never asks clients to disable verification. "Downloaded
successfully" is never treated as "safe".

Traffic between clients and UniCache is plain HTTP by default, like most
distribution mirrors. Package integrity does not depend on transport security
(signed indexes), but an observer in the LAN can see which packages are
fetched. Enable TLS (`server.tls_cert` / `tls_key`) or put a TLS reverse proxy
in front if that matters, and in any case for the dashboard on networks you do
not fully trust.

## Defaults

| Area | Default |
|---|---|
| Cache clients | private IPv4/IPv6 ranges and loopback only (`security.allowed_clients`) |
| Dashboard and API | the same ranges (`security.admin_allowed`), plus authentication |
| Upstreams | only repositories an administrator configured; hosts must resolve to public addresses (`allow_private_upstreams: false`) |
| TLS to upstreams | always verified; there is no option to disable certificate validation |
| TLS interception | none, by design |
| First administrator | password from the environment, or a web setup that requires a one-time token stored in a `0600` file on the server |

## Measures

**No open proxy, no SSRF.** Requests are only mapped to configured upstream
base URLs. Upstream URLs must be `http`/`https` without credentials, query or
fragment. The address check runs in the socket dialer, on the IP the
connection really goes to, after DNS resolution and for every redirect hop;
this also defeats DNS rebinding. Loopback, private, link-local, CGNAT,
multicast and unspecified addresses are refused unless explicitly allowed.
Redirects are limited to five, to `http`/`https`, and never from `https` to
`http`. Ambient proxy variables are ignored.

**Paths.** A request path is either canonical or rejected: no empty, `.` or
`..` segments, no backslashes or control characters, limited length. Segments
are re-escaped for the upstream. The query string is dropped.

**Credential isolation.** UniCache v0.1 has no concept of private upstream
repositories. Client `Authorization` and `Cookie` headers are never forwarded.
The generic adapter refuses requests that carry them and does not store
responses that are `private`, `no-store`, set cookies or vary on request
headers.

**Cached content cannot script the dashboard.** Cache responses carry
`X-Content-Type-Options: nosniff` and `Content-Security-Policy: sandbox`, so
HTML from an upstream opens in a unique, script-less origin. The dashboard
itself has a strict CSP (`default-src 'self'`), `frame-ancestors 'none'` and
no inline scripts.

**Management interface.** Passwords are hashed with bcrypt (minimum 10
characters). Session cookies are `HttpOnly`, `SameSite=Strict` and `Secure`
when TLS is on; only their SHA-256 is stored. State-changing requests need a
per-session CSRF token in a custom header. Login and setup are rate limited
per address; all API calls are rate limited. JSON bodies are size limited and
parsed strictly. Changing a password ends all sessions. Administrative actions
and logins are written to an audit log that never contains credentials.

**Storage.** Temp files are created with unpredictable names in a directory
owned by the service. Blob names are validated hashes, so they cannot escape
the blob directory. Objects are published atomically after fsync.

**Process.** The container runs as an unprivileged user with a read-only root
filesystem and no capabilities. The systemd unit uses `ProtectSystem=strict`,
`NoNewPrivileges`, an empty capability set and related hardening.

## Known limitations

- Client access control is by IP address. Anyone inside an allowed network
  can use the cache and can make it download objects from the configured
  repositories (bounded by `download.max_concurrent` and the storage limits).
- The first administrator must be created before the installation is exposed
  to people you do not trust (the setup token limits this to someone who can
  read the data directory).
- There is one administrator role; role-based access control is planned.
- Behind a reverse proxy, set `server.trusted_proxies`, otherwise all clients
  appear as the proxy.
- No independent security audit has been performed.
