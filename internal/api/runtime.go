package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/Anarki-LNX/unicache/internal/config"
)

// RuntimeSettings are the operational settings that can be changed in the
// web interface while the server is running. Their initial values come from
// the configuration file; once saved here, the saved values take precedence
// until they are reset.
//
// Settings that decide who may reach the server or what it may connect to
// (listen address, TLS, client and admin networks, private upstreams, data
// directory) are deliberately not part of this: changing them requires
// access to the server itself.
type RuntimeSettings struct {
	// MaxSize is the upper bound for cached data in bytes; 0 = unlimited.
	MaxSize int64 `json:"max_size"`
	// MinFreeSpace is a size ("20GB") or a percentage of the disk ("10%").
	MinFreeSpace string `json:"min_free_space"`
	// UpstreamRateLimit limits all upstream downloads together (bytes per
	// second); 0 = unlimited.
	UpstreamRateLimit int64 `json:"upstream_rate_limit"`
	// ClientRateLimit limits each client response (bytes per second);
	// 0 = unlimited.
	ClientRateLimit int64 `json:"client_rate_limit"`
	// MaxConcurrent is the number of simultaneous upstream downloads.
	MaxConcurrent int `json:"max_concurrent"`
	// MaxObjectSize is the largest object that is downloaded; 0 = unlimited.
	MaxObjectSize int64 `json:"max_object_size"`
	// LogLevel is debug, info, warn or error.
	LogLevel string `json:"log_level"`
}

// Validate checks the settings.
func (r RuntimeSettings) Validate() error {
	if r.MaxSize < 0 || r.UpstreamRateLimit < 0 || r.ClientRateLimit < 0 || r.MaxObjectSize < 0 {
		return errors.New("sizes and rate limits must not be negative")
	}
	if r.MaxSize > 0 && r.MaxSize < 100<<20 {
		return errors.New("max_size must be 0 (unlimited) or at least 100 MiB")
	}
	if _, _, err := config.ParseMinFree(r.MinFreeSpace); err != nil {
		return fmt.Errorf("min_free_space: %w (use a size such as 20GB or a percentage such as 10%%)", err)
	}
	if r.MaxConcurrent < 1 || r.MaxConcurrent > 256 {
		return errors.New("max_concurrent must be between 1 and 256")
	}
	for _, limit := range []int64{r.UpstreamRateLimit, r.ClientRateLimit} {
		if limit > 0 && limit < 16<<10 {
			return errors.New("rate limits must be 0 (unlimited) or at least 16 KiB/s")
		}
	}
	switch r.LogLevel {
	case "debug", "info", "warn", "error":
	default:
		return errors.New("log_level must be debug, info, warn or error")
	}
	return nil
}

// RuntimeController applies and persists runtime settings. It is implemented
// by package app, which owns the components the settings act on.
type RuntimeController interface {
	// Runtime returns the active settings, the values from the
	// configuration file, and whether saved settings override the file.
	Runtime() (active, fromFile RuntimeSettings, overridden bool)
	// SetRuntime validates, applies and saves the settings.
	SetRuntime(ctx context.Context, r RuntimeSettings) error
	// ResetRuntime drops saved settings and returns to the file values.
	ResetRuntime(ctx context.Context) error
}

func (a *API) runtimeView() map[string]any {
	active, fromFile, overridden := a.d.Runtime.Runtime()
	return map[string]any{"values": active, "defaults": fromFile, "overridden": overridden}
}

func (a *API) runtimeUpdate(w http.ResponseWriter, r *http.Request) {
	var req RuntimeSettings
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := req.Validate(); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := a.d.Runtime.SetRuntime(r.Context(), req); err != nil {
		a.internal(w, r, err)
		return
	}
	a.auditLog(r, "settings_updated", fmt.Sprintf("max_size=%d min_free=%s upstream_rate=%d client_rate=%d max_concurrent=%d max_object=%d log=%s",
		req.MaxSize, req.MinFreeSpace, req.UpstreamRateLimit, req.ClientRateLimit, req.MaxConcurrent, req.MaxObjectSize, req.LogLevel))
	writeJSON(w, http.StatusOK, a.runtimeView())
}

func (a *API) runtimeReset(w http.ResponseWriter, r *http.Request) {
	if err := a.d.Runtime.ResetRuntime(r.Context()); err != nil {
		a.internal(w, r, err)
		return
	}
	a.auditLog(r, "settings_reset", "runtime settings reset to the configuration file")
	writeJSON(w, http.StatusOK, a.runtimeView())
}
