/* global Mongo, quit, print */
// mongosh loads scripts as CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readFileSync } = require("node:fs");

function readPassword(name) {
  const value = readFileSync(`/run/secrets/${name}`, "utf8").replace(/\n+$/, "");
  if (!/^[a-f0-9]{64}$/.test(value) || new Set(value).size < 12 || value.slice(0, 32) === value.slice(32)) {
    throw new Error("Invalid deployment password");
  }
  return value;
}

function ensureAccount(database, username, password, role) {
  const user = database.getUser(username);
  if (!user) {
    database.createUser({ user: username, pwd: password, roles: [{ role, db: "whatmeal" }] });
  } else if (user.roles.length !== 1 || user.roles[0].role !== role || user.roles[0].db !== "whatmeal") {
    throw new Error("Unexpected account roles");
  }

  const account = new Mongo("mongodb://mongo:27017").getDB("whatmeal");
  account.auth(username, password);
  if (account.runCommand({ listCollections: 1, nameOnly: true }).ok !== 1) {
    throw new Error("Account cannot list collections");
  }
}

try {
  const rootPassword = readPassword("mongo_root_password");
  const appPassword = readPassword("mongo_app_password");
  const backupPassword = readPassword("mongo_backup_password");
  if (new Set([rootPassword, appPassword, backupPassword]).size !== 3) throw new Error("Passwords must differ");

  const connection = new Mongo("mongodb://mongo:27017");
  connection.getDB("admin").auth("whatmeal_root", rootPassword);
  const database = connection.getDB("whatmeal");
  ensureAccount(database, "whatmeal_app", appPassword, "readWrite");
  ensureAccount(database, "whatmeal_backup", backupPassword, "read");
  print("MongoDB application and backup accounts verified.");
} catch {
  print("MongoDB provisioning failed. Check deployment passwords and existing account roles.");
  quit(1);
}
