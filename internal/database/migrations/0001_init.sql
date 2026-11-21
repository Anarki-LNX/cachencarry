-- Cache & Carry schema v1.
-- Timestamps are Unix seconds unless a column name ends in _ms.

CREATE TABLE blobs (
    hash        TEXT PRIMARY KEY,          -- lowercase hex SHA-256
    size        INTEGER NOT NULL,
    created_at  INTEGER NOT NULL,
    verified_at INTEGER NOT NULL DEFAULT 0 -- last successful integrity check
) WITHOUT ROWID;

-- One cache entry per (module, repository, path). Several entries may point
-- to the same blob; a blob is referenced as long as at least one entry does.
CREATE TABLE entries (
    id            INTEGER PRIMARY KEY,
    module        TEXT    NOT NULL,
    repo          TEXT    NOT NULL,
    path          TEXT    NOT NULL,
    blob_hash     TEXT    NOT NULL REFERENCES blobs(hash),
    size          INTEGER NOT NULL,
    content_type  TEXT    NOT NULL DEFAULT '',
    etag          TEXT    NOT NULL DEFAULT '',
    last_modified TEXT    NOT NULL DEFAULT '',
    upstream_url  TEXT    NOT NULL DEFAULT '',
    immutable     INTEGER NOT NULL DEFAULT 0,
    pinned        INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    validated_at  INTEGER NOT NULL,          -- last upstream (re)validation
    expires_at    INTEGER NOT NULL DEFAULT 0, -- 0 = never needs revalidation
    last_access   INTEGER NOT NULL,
    hits          INTEGER NOT NULL DEFAULT 0,
    UNIQUE (module, repo, path)
);
CREATE INDEX entries_blob ON entries (blob_hash);
CREATE INDEX entries_lru  ON entries (pinned, last_access);

CREATE TABLE repositories (
    id         INTEGER PRIMARY KEY,
    module     TEXT    NOT NULL,
    name       TEXT    NOT NULL,
    upstreams  TEXT    NOT NULL,           -- JSON array of base URLs
    enabled    INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    UNIQUE (module, name)
);

CREATE TABLE module_state (
    module  TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE users (
    id            INTEGER PRIMARY KEY,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'admin',
    created_at    INTEGER NOT NULL
);

CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,           -- SHA-256 of the cookie value
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf       TEXT    NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE audit_log (
    id     INTEGER PRIMARY KEY,
    ts     INTEGER NOT NULL,
    actor  TEXT    NOT NULL,
    ip     TEXT    NOT NULL,
    action TEXT    NOT NULL,
    detail TEXT    NOT NULL DEFAULT ''
);

-- Per-minute traffic buckets (ts is the minute start).
CREATE TABLE stats_minute (
    ts             INTEGER NOT NULL,
    module         TEXT    NOT NULL,
    hits           INTEGER NOT NULL DEFAULT 0,
    misses         INTEGER NOT NULL DEFAULT 0,
    revalidated    INTEGER NOT NULL DEFAULT 0,
    errors         INTEGER NOT NULL DEFAULT 0,
    bytes_cache    INTEGER NOT NULL DEFAULT 0, -- body bytes sent to clients from the cache
    bytes_origin   INTEGER NOT NULL DEFAULT 0, -- body bytes sent to clients while fetching upstream
    bytes_upstream INTEGER NOT NULL DEFAULT 0, -- body bytes received from upstream
    PRIMARY KEY (ts, module)
) WITHOUT ROWID;

-- Lifetime totals per module.
CREATE TABLE stats_total (
    module         TEXT PRIMARY KEY,
    hits           INTEGER NOT NULL DEFAULT 0,
    misses         INTEGER NOT NULL DEFAULT 0,
    revalidated    INTEGER NOT NULL DEFAULT 0,
    errors         INTEGER NOT NULL DEFAULT 0,
    bytes_cache    INTEGER NOT NULL DEFAULT 0,
    bytes_origin   INTEGER NOT NULL DEFAULT 0,
    bytes_upstream INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;

CREATE TABLE clients (
    ip          TEXT PRIMARY KEY,
    first_seen  INTEGER NOT NULL,
    last_seen   INTEGER NOT NULL,
    requests    INTEGER NOT NULL DEFAULT 0,
    hits        INTEGER NOT NULL DEFAULT 0,
    bytes       INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;
