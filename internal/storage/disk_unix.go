//go:build unix

package storage

import "golang.org/x/sys/unix"

// diskSpace returns the total size of the filesystem containing path and the
// space available to unprivileged processes.
func diskSpace(path string) (total, free int64, err error) {
	var st unix.Statfs_t
	if err := unix.Statfs(path, &st); err != nil {
		return 0, 0, err
	}
	bs := int64(st.Bsize) //nolint:unconvert // type differs per platform
	return int64(st.Blocks) * bs, int64(st.Bavail) * bs, nil
}
