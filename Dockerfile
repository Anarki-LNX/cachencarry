# syntax=docker/dockerfile:1

# --- frontend -------------------------------------------------------------
FROM node:22-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# --- backend --------------------------------------------------------------
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=web /src/web/dist ./web/dist
ARG VERSION=dev
# Pure Go build (SQLite included): a static binary without libc dependency.
RUN CGO_ENABLED=0 go build -trimpath -tags ui \
      -ldflags "-s -w -X main.version=${VERSION}" \
      -o /out/unicache ./cmd/unicache
# Pre-create the data directories with the runtime user's ownership; the
# runtime image has no shell to do it.
RUN mkdir -p /out/data /out/etc

# --- runtime --------------------------------------------------------------
# distroless/static: CA certificates and tzdata, no shell, no package manager.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/unicache /usr/local/bin/unicache
COPY --from=build --chown=65532:65532 /out/data /var/lib/unicache
COPY --from=build --chown=65532:65532 /out/etc /etc/unicache
ENV UNICACHE_STORAGE_PATH=/var/lib/unicache
USER 65532:65532
EXPOSE 8080
VOLUME ["/var/lib/unicache"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["/usr/local/bin/unicache", "healthcheck"]
ENTRYPOINT ["/usr/local/bin/unicache"]
CMD ["serve"]
