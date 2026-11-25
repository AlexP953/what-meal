#!/usr/bin/env bash
set -euo pipefail
umask 077

case "${1:-}" in
  version)
    exec mongosh --nodb --quiet --eval '
      try {
        const password = require("node:fs").readFileSync("/run/secrets/mongo_backup_password", "utf8").replace(/\n+$/, "");
        const db = new Mongo("mongodb://mongo:27017").getDB("whatmeal");
        db.auth("whatmeal_backup", password);
        print(db.version());
      } catch { quit(1); }
    ' 2>/dev/null
    ;;
  dump)
    password=$(cat /run/secrets/mongo_backup_password)
    if [[ ! "$password" =~ ^[a-f0-9]{64}$ ]]; then
      echo 'Invalid MongoDB backup password file.' >&2
      exit 1
    fi
    work=$(TMPDIR=/dev/shm mktemp -d)
    printf 'password: "%s"\n' "$password" > "$work/config.yml"
    exec mongodump --quiet --config "$work/config.yml" --host mongo --username whatmeal_backup \
      --authenticationDatabase whatmeal --db whatmeal --archive --gzip 2>/dev/null
    ;;
  *)
    echo 'Use version or dump.' >&2
    exit 2
    ;;
esac
