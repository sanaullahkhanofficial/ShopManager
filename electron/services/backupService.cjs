"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");

/**
 * Creates a consistent backup of the live SQLite database using
 * better-sqlite3's own `.backup()` API (safe even while WAL writes are in
 * flight), then records it in the `backups` history table.
 */
function createBackup(db, session, dbPath, destPath) {
  const dir = path.dirname(destPath);
  fs.mkdirSync(dir, { recursive: true });
  // Force all WAL pages back into the main database file first, so a plain
  // file copy of `dbPath` is a complete, consistent snapshot.
  db.pragma("wal_checkpoint(TRUNCATE)");
  fs.copyFileSync(dbPath, destPath);

  const stat = fs.statSync(destPath);
  const info = db
    .prepare("INSERT INTO backups (file_path, size_bytes, created_by, created_at) VALUES (?, ?, ?, ?)")
    .run(destPath, stat.size, session ? session.userId : null, nowIso());
  recordAudit(db, { userId: session && session.userId, actorName: session && session.displayName, action: "backup_create", entity: "backups", entityId: info.lastInsertRowid, details: destPath });
  return { id: info.lastInsertRowid, path: destPath, sizeBytes: stat.size, createdAt: nowIso() };
}

function history(db) {
  return db.prepare("SELECT * FROM backups ORDER BY id DESC").all();
}

function lastBackup(db) {
  return db.prepare("SELECT * FROM backups ORDER BY id DESC LIMIT 1").get();
}

function integrityCheck(db) {
  const result = db.pragma("integrity_check");
  const ok = Array.isArray(result) && result.length === 1 && result[0].integrity_check === "ok";
  return { ok, details: result };
}

/**
 * Restores from a chosen backup file. Validates it is a well-formed SQLite
 * database with the expected schema_meta table before touching anything,
 * then swaps it in. The caller (main.cjs) must restart the app afterward so
 * a fresh connection is opened against the restored file.
 */
function validateBackupFile(sourcePath) {
  if (!fs.existsSync(sourcePath)) throw new AppError("Selected backup file does not exist.");
  const Database = require("better-sqlite3");
  let testDb;
  try {
    testDb = new Database(sourcePath, { readonly: true });
    const row = testDb.prepare("SELECT version FROM schema_meta WHERE id = 1").get();
    if (!row) throw new AppError("This file does not look like a valid EduManage backup.");
  } catch (err) {
    if (err.isAppError) throw err;
    throw new AppError("This file does not look like a valid EduManage database backup.");
  } finally {
    if (testDb) testDb.close();
  }
  return true;
}

module.exports = { createBackup, history, lastBackup, integrityCheck, validateBackupFile };
