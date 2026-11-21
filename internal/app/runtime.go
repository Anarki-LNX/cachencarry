package app

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"

	"github.com/Anarki-LNX/cachencarry/internal/api"
	"github.com/Anarki-LNX/cachencarry/internal/config"
	"github.com/Anarki-LNX/cachencarry/internal/storage"
)

const runtimeSettingKey = "runtime"

// runtime implements api.RuntimeController.
type runtime struct {
	app      *App
	level    *slog.LevelVar // nil when the caller manages the log level
	fromFile api.RuntimeSettings

	mu         sync.Mutex
	active     api.RuntimeSettings
	overridden bool
}

func runtimeFromConfig(cfg *config.Config) api.RuntimeSettings {
	return api.RuntimeSettings{
		MaxSize:           int64(cfg.Storage.MaxSize),
		MinFreeSpace:      cfg.Storage.MinFreeSpace,
		UpstreamRateLimit: int64(cfg.Download.UpstreamRateLim),
		ClientRateLimit:   int64(cfg.Download.ClientRateLimit),
		MaxConcurrent:     cfg.Download.MaxConcurrent,
		MaxObjectSize:     int64(cfg.Download.MaxObjectSize),
		LogLevel:          cfg.Logging.Level,
	}
}

// loadRuntime restores saved settings (if any) and applies them.
func (a *App) loadRuntime(ctx context.Context, level *slog.LevelVar) (*runtime, error) {
	rt := &runtime{app: a, level: level, fromFile: runtimeFromConfig(a.Config)}
	rt.active = rt.fromFile
	raw, ok, err := a.Modules.Setting(ctx, runtimeSettingKey)
	if err != nil {
		return nil, err
	}
	if ok {
		var saved api.RuntimeSettings
		if err := json.Unmarshal([]byte(raw), &saved); err != nil {
			a.log.Warn("ignoring saved runtime settings: not readable", "err", err)
		} else if err := saved.Validate(); err != nil {
			a.log.Warn("ignoring saved runtime settings: not valid for this version", "err", err)
		} else {
			rt.active, rt.overridden = saved, true
		}
	}
	rt.apply(rt.active)
	return rt, nil
}

// apply pushes the settings into the running components. r is valid.
func (rt *runtime) apply(r api.RuntimeSettings) {
	minBytes, minPct, _ := config.ParseMinFree(r.MinFreeSpace)
	a := rt.app
	a.Store.SetLimits(storage.Limits{MaxSize: r.MaxSize, MinFreeBytes: minBytes, MinFreePct: minPct})
	a.DL.SetMaxConcurrent(r.MaxConcurrent)
	a.DL.SetRateLimit(r.UpstreamRateLimit)
	a.DL.SetMaxObjectSize(r.MaxObjectSize)
	a.Proxy.SetClientRateLimit(r.ClientRateLimit)
	if rt.level != nil {
		var l slog.Level
		if err := l.UnmarshalText([]byte(r.LogLevel)); err == nil {
			rt.level.Set(l)
		}
	}
}

func (rt *runtime) Runtime() (active, fromFile api.RuntimeSettings, overridden bool) {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	return rt.active, rt.fromFile, rt.overridden
}

func (rt *runtime) SetRuntime(ctx context.Context, r api.RuntimeSettings) error {
	if err := r.Validate(); err != nil {
		return err
	}
	raw, err := json.Marshal(r)
	if err != nil {
		return err
	}
	rt.mu.Lock()
	defer rt.mu.Unlock()
	// Persist first: settings that are active but would be lost on the
	// next restart are worse than an error.
	if err := rt.app.Modules.SetSetting(ctx, runtimeSettingKey, string(raw)); err != nil {
		return fmt.Errorf("save runtime settings: %w", err)
	}
	rt.active, rt.overridden = r, true
	rt.apply(r)
	return nil
}

func (rt *runtime) ResetRuntime(ctx context.Context) error {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	if _, err := rt.app.DB.W.ExecContext(ctx, `DELETE FROM settings WHERE key = ?`, runtimeSettingKey); err != nil {
		return fmt.Errorf("reset runtime settings: %w", err)
	}
	rt.active, rt.overridden = rt.fromFile, false
	rt.apply(rt.fromFile)
	return nil
}
