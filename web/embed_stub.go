//go:build !ui

// Package web embeds the built frontend into the server binary. Without the
// "ui" build tag no frontend is embedded and the server shows a notice page.
package web

import "io/fs"

// FS returns nil: this binary was built without the web interface.
func FS() fs.FS { return nil }
