"use strict";

const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");
const { SCHEMA_SQL, SCHEMA_VERSION } = require("./schema.cjs");
const { seedIfEmpty } = require("./seed.cjs");

let db = null;
let dataDir = null;

/**
 * Opens (or creates) the SQLite database inside the OS user-data directory,
 * applies the schema, and runs first-time seeding of roles/permissions.
 * Returns the shared better-sqlite3 instance used by every service module.
 */
function initDatabase(userDataPath) {
  dataDir = userDataPath;
  fs.mkdirSync(dataDir, { recursive: true });
  const uploadsDir = path.join(dataDir, "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const backupsDir = path.join(dataDir, "backups");
  fs.mkdirSync(backupsDir, { recursive: true });

  const dbPath = path.join(dataDir, "edumanage.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  db.exec(SCHEMA_SQL);

  const metaRow = db.prepare("SELECT version FROM schema_meta WHERE id = 1").get();
  if (!metaRow) {
    db.prepare("INSERT INTO schema_meta (id, version) VALUES (1, ?)").run(SCHEMA_VERSION);
  }

  seedIfEmpty(db);

  return db;
}

function getDb() {
  if (!db) throw new Error("Database has not been initialized yet.");
  return db;
}

function getDataDir() {
  return dataDir;
}

function getDbPath() {
  return path.join(dataDir, "edumanage.db");
}

module.exports = { initDatabase, getDb, getDataDir, getDbPath };
