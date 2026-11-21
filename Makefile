VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS := -s -w -X main.version=$(VERSION)
GOFLAGS := -trimpath

.PHONY: all build backend web test race lint fmt docker dist clean run

all: build

## build: frontend + server binary with the web interface embedded (bin/unicache)
build: web
	CGO_ENABLED=0 go build $(GOFLAGS) -tags ui -ldflags "$(LDFLAGS)" -o bin/unicache ./cmd/unicache

## backend: server binary without the web interface (fast, no Node needed)
backend:
	CGO_ENABLED=0 go build $(GOFLAGS) -ldflags "$(LDFLAGS)" -o bin/unicache ./cmd/unicache

web:
	cd web && npm ci --no-audit --no-fund && npm run build

## test: unit and end-to-end tests (no Internet access needed)
test:
	go test ./...

## race: the same with the race detector
race:
	go test -race -count=1 ./...

lint:
	@test -z "$$(gofmt -l .)" || { echo "gofmt needed:"; gofmt -l .; exit 1; }
	go vet ./...
	go vet -tags ui ./web/ 2>/dev/null || true
	cd web && npm run lint

fmt:
	gofmt -w .

docker:
	docker build --build-arg VERSION=$(VERSION) -t unicache:$(VERSION) -t unicache:latest .

## dist: release tarballs for linux/amd64 and linux/arm64 in dist/
dist: web
	@mkdir -p dist
	@for arch in amd64 arm64; do \
		d=dist/unicache-$(VERSION)-linux-$$arch; rm -rf $$d; mkdir -p $$d/bin $$d/configs $$d/deployments/systemd $$d/scripts; \
		CGO_ENABLED=0 GOOS=linux GOARCH=$$arch go build $(GOFLAGS) -tags ui -ldflags "$(LDFLAGS)" -o $$d/bin/unicache ./cmd/unicache || exit 1; \
		cp configs/config.example.yaml $$d/configs/; cp deployments/systemd/unicache.service $$d/deployments/systemd/; \
		cp scripts/install.sh scripts/uninstall.sh $$d/scripts/; cp LICENSE README.md $$d/; \
		tar -C dist -czf $$d.tar.gz unicache-$(VERSION)-linux-$$arch; rm -rf $$d; echo "built $$d.tar.gz"; \
	done
	cd dist && sha256sum *.tar.gz > SHA256SUMS

run: backend
	UNICACHE_STORAGE_PATH=$(CURDIR)/data UNICACHE_SERVER_LISTEN=127.0.0.1 ./bin/unicache serve

clean:
	rm -rf bin dist web/dist
