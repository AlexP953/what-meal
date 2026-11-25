#!/usr/bin/env bash
set -euo pipefail

# The upstream entrypoint reads files after dropping privileges.
if ! password=$(cat /run/secrets/mongo_root_password) || [[ ! "$password" =~ ^[a-f0-9]{64}$ ]] ||
  [[ ${password:0:32} == "${password:32}" ]] ||
  [[ $(printf %s "$password" | fold -w1 | sort -u | wc -l) -lt 12 ]]; then
  echo 'Invalid MongoDB root password file. Generate it with openssl rand -hex 32.' >&2
  exit 1
fi
export MONGO_INITDB_ROOT_PASSWORD="$password"
exec docker-entrypoint.sh "$@"
