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

try {
  const rootPassword = readPassword("mongo_root_password");
  const appPassword = readPassword("mongo_app_password");
  if (rootPassword === appPassword) throw new Error("Passwords must differ");

  const connection = new Mongo("mongodb://mongo:27017");
  const admin = connection.getDB("admin");
  admin.auth("whatmeal_root", rootPassword);
  const database = connection.getDB("whatmeal");
  const user = database.getUser("whatmeal_app");
  if (!user) {
    database.createUser({
      user: "whatmeal_app",
      pwd: appPassword,
      roles: [{ role: "readWrite", db: "whatmeal" }],
    });
  } else if (user.roles.length !== 1 || user.roles[0].role !== "readWrite" || user.roles[0].db !== "whatmeal") {
    throw new Error("Unexpected application roles");
  }

  const app = new Mongo("mongodb://mongo:27017").getDB("whatmeal");
  app.auth("whatmeal_app", appPassword);
  if (app.runCommand({ listCollections: 1, nameOnly: true }).ok !== 1) {
    throw new Error("Application account cannot list collections");
  }
  print("MongoDB application account verified.");
} catch {
  print("MongoDB provisioning failed. Check deployment passwords and existing application roles.");
  quit(1);
}
