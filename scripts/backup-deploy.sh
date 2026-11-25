#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# != 1 || ! -d "${1:-}" ]]; then
  echo 'Usage: bash scripts/backup-deploy.sh EXISTING_PRIVATE_BACKUP_DIRECTORY' >&2
  exit 2
fi
: "${WHATMEAL_SECRETS_DIR:?Set WHATMEAL_SECRETS_DIR}"
project="${WHATMEAL_PROJECT_NAME:-whatmeal-deploy}"
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
destination=$(cd -- "$1" && pwd)
compose() { docker compose --env-file /dev/null -p "$project" -f "$root/compose.deploy.yml" "$@"; }

# Serialize backups of this installation even when their destinations differ.
exec {lock_fd}< "$WHATMEAL_SECRETS_DIR"
flock -n "$lock_fd" || { echo 'Another backup holds the installation lock.' >&2; exit 1; }

pending=
resume_app=false
start_app() {
  docker start "$app_container" >&2 &&
    timeout 60 bash -c '
      while true; do
        status=$(docker inspect --format "{{.State.Health.Status}}" "$1") || exit 1
        [[ "$status" == healthy ]] && exit 0
        sleep 1
      done
    ' _ "$app_container"
}
cleanup() {
  local status=$?
  trap - EXIT
  if $resume_app && ! start_app; then
    echo 'The backup could not restart What Meal. Check the Compose service status.' >&2
    status=1
  fi
  if [[ -n "$pending" ]]; then
    for file in database.archive.gz mongo-version SHA256SUMS; do
      if [[ -f "$pending/$file" ]]; then rm -- "$pending/$file"; fi
    done
    rmdir -- "$pending" || status=1
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

pending=$(mktemp -d -- "$destination/.incomplete.XXXXXXXX")
state=$(compose ps --all --format '{{.State}}' whatmeal)
case "$state" in
  running|restarting)
    app_container=$(compose ps --all -q whatmeal)
    [[ "$app_container" =~ ^[a-f0-9]{64}$ ]]
    resume_app=true
    docker stop --time 60 "$app_container" >&2
    ;;
  ""|created|exited) ;;
  *)
    echo 'What Meal has an unexpected state. Check the Compose service status.' >&2
    exit 1
    ;;
esac
if ! compose run --rm --no-deps -T mongo-backup version > "$pending/mongo-version" ||
  ! grep -qxE '[0-9]+\.[0-9]+\.[0-9]+' "$pending/mongo-version" ||
  ! compose run --rm --no-deps -T mongo-backup dump > "$pending/database.archive.gz" ||
  ! gzip -t "$pending/database.archive.gz"; then
  echo 'MongoDB backup failed. Check MongoDB and the backup credential.' >&2
  exit 1
fi
if $resume_app; then
  start_app
  resume_app=false
fi
(cd -- "$pending" && sha256sum database.archive.gz mongo-version > SHA256SUMS)
backup="$destination/whatmeal-$(date -u +%Y%m%dT%H%M%SZ)-${pending##*.}"
[[ ! -e "$backup" ]]
mv -T -- "$pending" "$backup"
pending=
printf '%s\n' "$backup"
