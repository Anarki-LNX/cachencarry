# syntax=docker/dockerfile:1

# --- frontend -------------------------------------------------------------
# The build stages run on the build machine's platform and cross-compile, so a
# multi-arch build (amd64, arm64) needs no CPU emulation.
FROM --platform=$BUILDPLATFORM node:22-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# --- backend --------------------------------------------------------------
FROM --platform=$BUILDPLATFORM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=web /src/web/dist ./web/dist
ARG VERSION=dev
ARG TARGETOS=linux
ARG TARGETARCH
# Pure Go build (SQLite included): a static binary without libc dependency.
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -trimpath -tags ui \
      -ldflags "-s -w -X main.version=${VERSION}" \
      -o /out/cachencarry ./cmd/cachencarry
# Pre-create the data directories with the runtime user's ownership; the
# runtime image has no shell to do it.
RUN mkdir -p /out/data /out/etc

# --- runtime --------------------------------------------------------------
# distroless/static: CA certificates and tzdata, no shell, no package manager.
FROM gcr.io/distroless/static-debian12:nonroot
LABEL org.opencontainers.image.title="Cache & Carry" \
      org.opencontainers.image.description="LAN package cache for Linux updates" \
      org.opencontainers.image.source="https://github.com/Anarki-LNX/cachencarry" \
      org.opencontainers.image.url="https://cachencarry.loopout.tech" \
      org.opencontainers.image.licenses="Apache-2.0"
COPY --from=build /out/cachencarry /usr/local/bin/cachencarry
COPY --from=build --chown=65532:65532 /out/data /var/lib/cachencarry
COPY --from=build --chown=65532:65532 /out/etc /etc/cachencarry
ENV CACHENCARRY_STORAGE_PATH=/var/lib/cachencarry
USER 65532:65532
EXPOSE 8080
VOLUME ["/var/lib/cachencarry"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["/usr/local/bin/cachencarry", "healthcheck"]
ENTRYPOINT ["/usr/local/bin/cachencarry"]
CMD ["serve"]
