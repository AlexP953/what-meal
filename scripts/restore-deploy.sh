#!/usr/bin/env bash
set -euo pipefail
umask 077
unset CDPATH

if [[ $# != 2 || ! -d "$1" ]]; then
  echo 'Usage: bash scripts/restore-deploy.sh BACKUP_DIRECTORY NEW_WORKSPACE' >&2
  exit 2
fi

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
backup=$(cd -- "$1" && pwd -P)
parent=$(cd -- "$(dirname -- "$2")" && pwd -P)
workspace="${parent%/}/$(basename -- "$2")"
if [[ "$workspace" == "$backup" || "$workspace" == "${backup%/}/"* ]]; then
  echo 'Choose a workspace outside the backup directory.' >&2
  exit 2
fi
if [[ -e "$workspace" || -L "$workspace" ]]; then
  echo 'Restore workspace already exists. Choose a new path.' >&2
  exit 2
fi
suffix=$(openssl rand -hex 12)
project="whatmeal-restore-$suffix"
mkdir -- "$workspace" || { echo 'Restore workspace must be a new directory.' >&2; exit 2; }
workspace=$(cd -- "$workspace" && pwd)
export AUTH_URL=https://localhost
export WHATMEAL_SECRETS_DIR="$workspace/secrets"
compose() { docker compose --env-file /dev/null -p "$project" -f "$root/compose.deploy.yml" "$@"; }
owns_project=false
staged="$workspace/backup"
cleanup() {
  local status=$?
  trap - EXIT
  if [[ -d "$staged" ]]; then
    find "$staged" -depth -delete || status=1
  fi
  if (( status != 0 )) && $owns_project; then
    if ! compose down --volumes --timeout 10; then
      echo 'Cleanup failed. Keep the workspace for manual cleanup.' >&2
      exit "$status"
    fi
  fi
  if (( status != 0 )); then
    find "$workspace" -depth -delete || true
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir -- "$staged"
for file in database.archive.gz mongo-version SHA256SUMS; do
  if [[ ! -f "$backup/$file" || -L "$backup/$file" ]]; then
    echo 'Backup integrity check failed.' >&2
    exit 1
  fi
done
if ! (cp -- "$backup/"{database.archive.gz,mongo-version,SHA256SUMS} "$staged" &&
  cd -- "$staged" &&
  sha256sum database.archive.gz mongo-version | cmp -s SHA256SUMS - &&
  gzip -t database.archive.gz); then
  echo 'Backup integrity check failed.' >&2
  exit 1
fi

image=$(compose config --images mongo)
# Use the exact server version shipped with the restore tools in the pinned image.
target_version=$(docker run --rm --network none --entrypoint mongod "$image" --version |
  sed -n 's/^db version v//p')
if [[ ! "$target_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
  [[ $(<"$staged/mongo-version") != "$target_version" ]]; then
  echo 'Incompatible MongoDB backup version. Use the deployment revision with MongoDB matching the backup.' >&2
  exit 1
fi

containers=$(docker ps -aq --filter "label=com.docker.compose.project=$project")
volumes=$(docker volume ls -q --filter "name=^${project}_")
networks=$(docker network ls -q --filter "name=^${project}_")
if [[ -n "$containers$volumes$networks" ]]; then
  echo 'Restore project already exists.' >&2
  exit 1
fi
printf '%s\n' "$project" > "$workspace/project-name"
mkdir -- "$WHATMEAL_SECRETS_DIR"
for name in auth-secret mongo-root-password mongo-app-password mongo-backup-password; do
  openssl rand -hex 32 > "$WHATMEAL_SECRETS_DIR/$name"
done
# Local Compose bind-mounts secret files and preserves their host ownership.
secret_source=${WHATMEAL_SECRETS_DIR//\"/\"\"}
docker run --rm --network none --user 0 --entrypoint chown \
  --mount "type=bind,\"source=$secret_source\",target=/secrets" "$image" \
  1000:1000 /secrets/auth-secret /secrets/mongo-app-password

owns_project=true
compose up -d --wait mongo >&2
compose run --rm --no-deps -T mongo-provision >&2
if ! compose run --rm --no-deps -T mongo-restore < "$staged/database.archive.gz"; then
  echo 'MongoDB rejected the archive. The restoration did not complete.' >&2
  exit 1
fi
find "$staged" -depth -delete
touch "$workspace/restore-complete"
printf 'Restore complete in project %s.\n' "$project"
