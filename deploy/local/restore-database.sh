#!/usr/bin/env bash
set -eu
archive="$1"
target="$2"
case "$archive" in *[!a-zA-Z0-9_.-]*|"") echo "Invalid archive name" >&2; exit 2;; esac
case "$target" in restore_*) ;; *) echo "Target must start with restore_" >&2; exit 2;; esac
case "$target" in *[!a-z0-9_]*|"") echo "Invalid restore target" >&2; exit 2;; esac
test "$target" != "$APP_DB"
test -f "/backups/$archive"
# createdb refuses an existing name. Never clean, drop or overwrite the source database.
createdb --username postgres --owner "$APP_USER" "$target"
pg_restore --username postgres --dbname "$target" --role "$APP_USER" \
  --no-owner --no-privileges --exit-on-error --single-transaction "/backups/$archive"
echo "Restored into $target; the application connection is unchanged."
