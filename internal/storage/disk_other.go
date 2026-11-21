//go:build !unix

package storage

import "errors"

func diskSpace(string) (total, free int64, err error) {
	return 0, 0, errors.New("disk space reporting is not supported on this platform")
}
