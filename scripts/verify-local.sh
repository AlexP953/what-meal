#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ "${1:-}" != --isolated-environment ]]; then
  exec env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" bash "$0" --isolated-environment
fi

# Linux, Bash and util-linux setsid keep every app child in an owned group.
for tool in node npm docker git tar curl setsid timeout ps; do
  command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 1; }
done
docker compose version >/dev/null
source_root=$(git -C "$(dirname -- "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)
scratch=
project=
app_pid=
compose_started=false
started=$SECONDS

compose() { timeout --kill-after=10 120 docker compose --env-file /dev/null -f "$scratch/app/docker-compose.yml" -p "$project" "$@"; }
stop_app() {
  if [[ -n "$app_pid" ]]; then
    kill -TERM -- "-$app_pid" 2>/dev/null || true
    for ((attempt=0; attempt<50; attempt++)); do
      kill -0 -- "-$app_pid" 2>/dev/null || break
      sleep 0.1
    done
    kill -KILL -- "-$app_pid" 2>/dev/null || true
    wait "$app_pid" 2>/dev/null || true
    app_pid=
  fi
}
cleanup() {
  result=$?
  trap - EXIT
  stop_app
  if $compose_started; then
    compose down --volumes --timeout 10 || result=1
  fi
  if [[ -n "$scratch" ]]; then rm -rf -- "$scratch"; fi
  echo "Local verification finished in $((SECONDS - started))s (exit $result)."
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

scratch=$(mktemp -d)
project="whatmeal-verify-$(node -p 'require("node:crypto").randomUUID().replaceAll("-", "")')"
mkdir "$scratch/app"
# Copy versioned working files only. New files must be staged before verification.
git -C "$source_root" ls-files --cached -z |
  tar -C "$source_root" --null -T - -cf - | tar -C "$scratch/app" -xf -
cd "$scratch/app"
cp package-lock.json "$scratch/lockfile.snapshot"
unset NODE_ENV
export NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_NOTIFICATIONS_ENABLED=false MONGODB_PORT=0
: > "$scratch/npm-user.conf"
: > "$scratch/npm-global.conf"
export NPM_CONFIG_USERCONFIG="$scratch/npm-user.conf" NPM_CONFIG_GLOBALCONFIG="$scratch/npm-global.conf"
export MONGODB_DB="whatmeal_verify_${project##*-}"
AUTH_SECRET=$(node -p 'require("node:crypto").randomBytes(32).toString("base64")')
export AUTH_SECRET
timeout --kill-after=10 300 npm ci
cmp package-lock.json "$scratch/lockfile.snapshot"
compose_started=true
compose up -d --wait --wait-timeout 90 mongo
database_address() {
  local mongo_address
  mongo_address=$(compose port mongo 27017)
  [[ "$mongo_address" =~ ^127\.0\.0\.1:[0-9]+$ ]]
  export MONGODB_URI="mongodb://$mongo_address"
}
database_address
timeout --kill-after=10 30 npm run db:prepare
timeout --kill-after=10 30 npm run db:prepare

probe() { timeout --kill-after=10 30 node --conditions=react-server --import tsx scripts/persistence-probe.ts "$1"; }
start_app() {
  local mode=$1
  local log="$scratch/$mode.log"
  : > "$log"
  # Auth.js requires a trusted host in production. The probe binds a loopback port.
  AUTH_TRUST_HOST=true setsid node node_modules/next/dist/bin/next "$mode" --hostname 127.0.0.1 --port 0 >"$log" 2>&1 &
  app_pid=$!
  # With job control disabled, the child is not a group leader before setsid.
  # Confirm session ownership before any group signal, including failure cleanup.
  for ((attempt=0; attempt<50; attempt++)); do
    [[ "$(ps -o sid= -p "$app_pid" | tr -d ' ')" == "$app_pid" ]] && break
    sleep 0.1
  done
  if [[ "$(ps -o sid= -p "$app_pid" | tr -d ' ')" != "$app_pid" ]]; then
    kill -TERM "$app_pid" 2>/dev/null || true
    wait "$app_pid" 2>/dev/null || true
    app_pid=
    echo "Could not establish an owned app session." >&2
    return 1
  fi
  for ((attempt=0; attempt<90; attempt++)); do
    if ! kill -0 "$app_pid" 2>/dev/null; then
      echo "Next.js $mode terminated before readiness (logs withheld to protect secrets)." >&2
      return 1
    fi
    app_url=$(sed -nE 's/.*(http:\/\/(localhost|127\.0\.0\.1):[0-9]+).*/\1/p' "$log" | head -1)
    if [[ -n "$app_url" ]] && curl --fail --silent --max-time 5 "$app_url/login" -o "$scratch/login.html"; then
      grep -q 'name="email"' "$scratch/login.html"
      grep -q 'name="password"' "$scratch/login.html"
      echo "Next.js $mode /login passed."
      return
    fi
    sleep 1
  done
  echo "Next.js $mode readiness timed out." >&2
  return 1
}

start_app dev
probe seed
stop_app
start_app dev
probe read
stop_app
compose stop mongo
timeout --kill-after=10 300 env -u MONGODB_URI -u MONGODB_DB -u AUTH_SECRET npm run build
compose up -d --wait --wait-timeout 90 mongo
database_address
start_app start
probe read
stop_app
start_app start
probe read
compose restart mongo
compose up -d --wait --wait-timeout 90 mongo
stop_app
database_address
start_app start
probe read
diary_probe() {
  TZ="$1" timeout --kill-after=10 45 node --conditions=react-server --import tsx scripts/diary-persistence-probe.ts "$2" "$app_url" "$scratch/diary.json"
}
diary_probe Pacific/Kiritimati seed
stop_app
compose restart mongo
compose up -d --wait --wait-timeout 90 mongo
database_address
start_app start
diary_probe Pacific/Kiritimati read
diary_probe Pacific/Honolulu read
cmp package-lock.json "$scratch/lockfile.snapshot"
echo "Clean installation, development, production and persistence restarts passed."
