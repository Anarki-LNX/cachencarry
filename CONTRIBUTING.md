# Contributing

Contributions are welcome: bug reports, test results from real clients and
deployments, documentation, and code.

## Development setup

Requirements: Go ≥ 1.27, Node.js ≥ 20, make. Docker only for the image.

```sh
make test                 # all Go tests (no Internet needed)
make race                 # with the race detector; must stay clean
make run                  # backend only on 127.0.0.1:8080, data in ./data
cd web && npm ci && npm run dev    # dashboard with hot reload, proxies /api to :8080
make build                # production binary with embedded dashboard
make lint                 # gofmt, go vet, frontend lint
```

`make run` prints where the setup token is; or start with
`CACHENCARRY_SECURITY_ADMIN_PASSWORD=some-long-password`.

## Rules

1. **Correctness before features.** A change to storage, downloads or the
   proxy needs a test that fails without it.
2. **Tests must not need the Internet.** Use mock upstreams
   (`tests/e2e_test.go` has helpers).
3. **Do not claim what was not run.** Documentation distinguishes
   "implemented and tested", "experimental" and "planned". Compatibility with
   a client is only claimed after running that client.
4. **Adapters stay thin.** No file or database access outside
   `internal/storage`; no HTTP client outside `internal/security` /
   `internal/download`.
5. **Security-critical logic stays in `internal/security`.** Never weaken
   signature verification, certificate validation or the default ACLs.
6. **No silent errors.** Handle them or log them with context. Never log
   credentials.
7. **Statistics are measured.** No estimated or sample numbers in the product.
8. **Configuration is forever.** New options need defaults that keep existing
   files working; incompatible changes need a migration step and a new
   `version`.
9. Keep dependencies few and maintained. Run `gofmt`.

## Pull requests

- One topic per pull request, with a description of what and why.
- `make lint` and `make race` pass.
- Update the documentation that the change affects, including
  [TODO.md](TODO.md) if you close or open a gap.

## Adding an adapter

See [ADAPTERS.md](ADAPTERS.md#writing-an-adapter).

## Reporting bugs

Include the Cache & Carry version (`cachencarry version`), how it is deployed, the
client and its version, the relevant lines from Live Traffic or the log
(`logging.level: debug` shows every request), and what you expected.
Security issues: see [SECURITY.md](SECURITY.md).

## License

By contributing you agree that your contribution is licensed under the
Apache License 2.0.
