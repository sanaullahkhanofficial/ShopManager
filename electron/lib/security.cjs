"use strict";

const crypto = require("node:crypto");

/** Hash a password with scrypt + a random salt. Never store plain text. */
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password ?? ""), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/** Constant-time verification against a stored `salt:hash` string. */
function verifyPassword(password, stored) {
  try {
    if (typeof stored !== "string" || !stored.includes(":")) return false;
    const [salt, hash] = stored.split(":");
    const expected = Buffer.from(hash, "hex");
    const actual = crypto.scryptSync(String(password ?? ""), salt, 64);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** ISO-8601 UTC timestamp used consistently for created_at/updated_at columns. */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Wraps a message thrown from a service layer so the renderer only ever sees
 * a safe, user-friendly string — never a raw SQLite/driver error.
 */
class AppError extends Error {
  constructor(message, code = "APP_ERROR") {
    super(message);
    this.code = code;
    this.isAppError = true;
  }
}

function friendlyDbError(err) {
  const msg = String(err && err.message ? err.message : err);
  if (msg.includes("UNIQUE constraint failed")) {
    return "A record with this value already exists. Please use a unique value.";
  }
  if (msg.includes("FOREIGN KEY constraint failed")) {
    return "Unable to complete this action because the record is linked to another record.";
  }
  if (msg.includes("NOT NULL constraint failed")) {
    return "Please fill in all required fields.";
  }
  if (msg.includes("CHECK constraint failed")) {
    return "One of the provided values is not valid for this field.";
  }
  return "Something went wrong while saving. Please try again.";
}

module.exports = { hashPassword, verifyPassword, nowIso, AppError, friendlyDbError };
