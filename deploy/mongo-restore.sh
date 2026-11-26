#!/usr/bin/env bash
set -euo pipefail
umask 077

password=$(cat /run/secrets/mongo_root_password)
if [[ ! "$password" =~ ^[a-f0-9]{64}$ ]]; then
  echo 'Invalid MongoDB restore password file.' >&2
  exit 1
fi

work=$(TMPDIR=/dev/shm mktemp -d)
printf 'password: "%s"\n' "$password" > "$work/config.yml"
mongorestore --quiet --config "$work/config.yml" --host mongo --username whatmeal_root \
  --authenticationDatabase admin --nsInclude 'whatmeal.*' --stopOnError --archive --gzip 2>/dev/null

exec mongosh --nodb --quiet --eval '
  try {
    const password = require("node:fs").readFileSync("/run/secrets/mongo_root_password", "utf8").trim();
    const connection = new Mongo("mongodb://mongo:27017");
    connection.getDB("admin").auth("whatmeal_root", password);
    const collections = connection.getDB("whatmeal").getCollectionNames();
    quit(["users", "meals", "access_limits"].every(name => collections.includes(name)) ? 0 : 1);
  } catch { quit(1); }
' 2>/dev/null
