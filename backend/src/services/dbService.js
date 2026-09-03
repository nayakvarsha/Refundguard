/*
 * ARCHITECTURAL DECISION (DUAL STORAGE MODEL):
 * - JSON (orders.json, payments.json, refunds.json, ledger.json): Static 10,000-record benchmark corpus for offline detection scoring & evaluation.
 * - SQLite (refundguard.sqlite via better-sqlite3): Live application state for users, multi-tenant company connections, live incidents & audit logs.
 * These two data layers are intentionally decoupled to preserve benchmark evaluation immutability.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

// Ensure environment variables from backend/.env are loaded cleanly
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const { initAndMigrateDb } = require("./migrateJsonToSqlite");

// Initialize Native SQLite Database via better-sqlite3
const db = initAndMigrateDb();
const SALT_ROUNDS = 10;

async function hashPassword(plainText) {
  return await bcrypt.hash(plainText.trim(), SALT_ROUNDS);
}

async function ensureAdminUserExists() {
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "rg_admin_sec_9948";
  const passwordHash = await hashPassword(adminPassword);

  const existingAdmin = db.prepare("SELECT * FROM users WHERE role = 'ADMIN'").get();

  if (!existingAdmin) {
    db.prepare(`
      INSERT INTO users (id, username, email, passwordHash, role, companyId, lastLoginAt, failedAttempts, lockedUntil)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)
    `).run("USR-ADMIN-001", adminUsername, "admin@refundguard.io", passwordHash, "ADMIN", null, new Date().toISOString());
  } else {
    // Keep admin username and bcrypt hash in sync with environment
    db.prepare("UPDATE users SET username = ?, passwordHash = ? WHERE role = 'ADMIN'").run(adminUsername, passwordHash);
  }
}

// Automatically migrate any existing legacy password hashes in SQLite to bcrypt
async function migrateUserHashesToBcrypt() {
  const users = db.prepare("SELECT * FROM users").all();
  for (const u of users) {
    if (!u.passwordHash || !u.passwordHash.startsWith("$2")) {
      const defaultPass = u.role === "ADMIN" ? (process.env.ADMIN_PASSWORD || "rg_admin_sec_9948") : "demo";
      const newHash = await hashPassword(defaultPass);
      db.prepare("UPDATE users SET passwordHash = ? WHERE id = ?").run(newHash, u.id);
    }
  }
}

// Run async initialization tasks
(async () => {
  try {
    await ensureAdminUserExists();
    await migrateUserHashesToBcrypt();
  } catch (err) {
    console.error("Error initializing user database:", err);
  }
})();

// User Authentication API
function findUserByUsernameOrEmail(identifier) {
  if (!identifier) return null;
  const lower = identifier.trim().toLowerCase();
  return db.prepare("SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?").get(lower, lower);
}

async function verifyUserPassword(user, plainTextPassword) {
  if (!user || !plainTextPassword || !user.passwordHash) return false;
  return await bcrypt.compare(plainTextPassword.trim(), user.passwordHash);
}

function updateLastLogin(userId) {
  const timestamp = new Date().toISOString();
  db.prepare("UPDATE users SET lastLoginAt = ? WHERE id = ?").run(timestamp, userId);
}

// Persistent Lockout Protection in SQLite (Step 5)
function checkLockout(identifier) {
  const user = findUserByUsernameOrEmail(identifier);
  if (!user || !user.lockedUntil) return { isLocked: false };

  const lockedUntil = new Date(user.lockedUntil);
  if (new Date() < lockedUntil) {
    const secondsLeft = Math.ceil((lockedUntil - new Date()) / 1000);
    return { isLocked: true, secondsLeft };
  } else {
    db.prepare("UPDATE users SET failedAttempts = 0, lockedUntil = NULL WHERE id = ?").run(user.id);
    return { isLocked: false };
  }
}

function recordFailedAttempt(identifier) {
  const user = findUserByUsernameOrEmail(identifier);
  if (!user) return { count: 1 };

  const count = (user.failedAttempts || 0) + 1;
  let lockedUntil = null;

  if (count >= 5) {
    lockedUntil = new Date(Date.now() + 60000).toISOString(); // Lock for 60 seconds
  }

  db.prepare("UPDATE users SET failedAttempts = ?, lockedUntil = ? WHERE id = ?").run(count, lockedUntil, user.id);
  return { count, lockedUntil };
}

function clearFailedAttempts(identifier) {
  const user = findUserByUsernameOrEmail(identifier);
  if (user) {
    db.prepare("UPDATE users SET failedAttempts = 0, lockedUntil = NULL WHERE id = ?").run(user.id);
  }
}

// Password Resets API (Step 3: Secure RNG via crypto.randomInt)
function createPasswordResetCode(identifier) {
  const user = findUserByUsernameOrEmail(identifier);
  if (!user) return null;
  if (user.role === "ADMIN") return { error: "Admin password cannot be reset via public form." };

  const code = `RESET-${crypto.randomInt(100000, 1000000)}`;
  const expiresAt = new Date(Date.now() + 15 * 60000).toISOString();

  db.prepare(`
    INSERT INTO password_resets (code, userId, username, email, expiresAt, used)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(code, user.id, user.username, user.email, expiresAt);

  return { code, userId: user.id, username: user.username, email: user.email, expiresAt, used: false };
}

async function verifyAndResetPassword({ code, newPassword }) {
  const resetEntry = db.prepare("SELECT * FROM password_resets WHERE code = ? AND used = 0").get(code);
  if (!resetEntry) return { error: "Invalid or expired reset code." };

  if (new Date() > new Date(resetEntry.expiresAt)) {
    return { error: "Reset code has expired." };
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(resetEntry.userId);
  if (!user) return { error: "User account not found." };

  const newHash = await hashPassword(newPassword.trim());

  const resetTx = db.transaction(() => {
    db.prepare("UPDATE users SET passwordHash = ?, failedAttempts = 0, lockedUntil = NULL WHERE id = ?").run(newHash, user.id);
    db.prepare("UPDATE password_resets SET used = 1 WHERE code = ?").run(code);
  });

  resetTx();
  return { ok: true, user };
}

// Company API
function getCompanies() {
  return db.prepare("SELECT * FROM companies").all();
}

function getCompanyById(id) {
  return db.prepare("SELECT * FROM companies WHERE id = ?").get(id);
}

async function createCompany({ name, email, username, password }) {
  const companyId = `COMP-${name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8)}-${Math.floor(100 + Math.random() * 900)}`;
  const chosenUsername = (username || name.toLowerCase().replace(/[^a-z0-9]/g, "")).trim();
  const userId = `USR-${companyId.slice(5)}`;
  const passwordHash = await hashPassword(password ? password.trim() : "demo");
  const createdAt = new Date().toISOString();

  const company = { id: companyId, name, email, brandColor: "#2563eb", createdAt };
  const user = { id: userId, username: chosenUsername, email, passwordHash, role: "COMPANY", companyId, lastLoginAt: createdAt };

  const signupTx = db.transaction(() => {
    db.prepare("INSERT INTO companies (id, name, email, brandColor, createdAt) VALUES (?, ?, ?, ?, ?)").run(
      companyId, name, email, "#2563eb", createdAt
    );
    db.prepare("INSERT INTO users (id, username, email, passwordHash, role, companyId, lastLoginAt, failedAttempts, lockedUntil) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)").run(
      userId, chosenUsername, email, passwordHash, "COMPANY", companyId, createdAt
    );
    db.prepare("INSERT INTO connections (companyId, razorpayKeyId, razorpayKeySecret, webhookSecret, webhookUrl, status, lastWebhookAt) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      companyId, "", "", `whsec_${Math.random().toString(36).slice(2, 10)}`, `http://localhost:4000/api/webhooks/company/${companyId}`, "DISCONNECTED", null
    );
  });

  signupTx();
  return { company, user };
}

// Connection API
function getConnection(companyId) {
  return db.prepare("SELECT * FROM connections WHERE companyId = ?").get(companyId);
}

function saveConnection(companyId, { razorpayKeyId, razorpayKeySecret, webhookSecret }) {
  let conn = db.prepare("SELECT * FROM connections WHERE companyId = ?").get(companyId);

  if (!conn) {
    conn = {
      companyId,
      razorpayKeyId: razorpayKeyId || "",
      razorpayKeySecret: razorpayKeySecret || "",
      webhookSecret: webhookSecret || `whsec_${Math.random().toString(36).slice(2, 10)}`,
      webhookUrl: `http://localhost:4000/api/webhooks/company/${companyId}`,
      status: razorpayKeyId && razorpayKeySecret ? "CONNECTED" : "DISCONNECTED",
      lastWebhookAt: new Date().toISOString(),
    };

    db.prepare(`
      INSERT INTO connections (companyId, razorpayKeyId, razorpayKeySecret, webhookSecret, webhookUrl, status, lastWebhookAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(conn.companyId, conn.razorpayKeyId, conn.razorpayKeySecret, conn.webhookSecret, conn.webhookUrl, conn.status, conn.lastWebhookAt);

    return conn;
  }

  if (razorpayKeyId !== undefined) conn.razorpayKeyId = razorpayKeyId;
  if (razorpayKeySecret !== undefined) conn.razorpayKeySecret = razorpayKeySecret;
  if (webhookSecret) conn.webhookSecret = webhookSecret;
  conn.status = conn.razorpayKeyId && conn.razorpayKeySecret ? "CONNECTED" : "DISCONNECTED";
  conn.lastWebhookAt = new Date().toISOString();

  db.prepare(`
    UPDATE connections
    SET razorpayKeyId = ?, razorpayKeySecret = ?, webhookSecret = ?, status = ?, lastWebhookAt = ?
    WHERE companyId = ?
  `).run(conn.razorpayKeyId, conn.razorpayKeySecret, conn.webhookSecret, conn.status, conn.lastWebhookAt, companyId);

  return conn;
}

function touchWebhookHealth(companyId) {
  const timestamp = new Date().toISOString();
  db.prepare("UPDATE connections SET lastWebhookAt = ?, status = 'CONNECTED' WHERE companyId = ?").run(timestamp, companyId);
}

// Login Audit Logs API
function addLoginLog({ actor, email = "N/A", role = "COMPANY", result = "SUCCESS", details = "" }) {
  const logId = `LOG-${Date.now().toString().slice(-6)}`;
  const timestamp = new Date().toISOString();

  db.prepare(`
    INSERT INTO login_logs (id, actor, email, role, timestamp, result, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(logId, actor, email, role, timestamp, result, details);

  return { id: logId, actor, email, role, timestamp, result, details };
}

function getLoginLogs(limit = 100) {
  return db.prepare("SELECT * FROM login_logs ORDER BY timestamp DESC LIMIT ?").all(limit);
}

module.exports = {
  db,
  findUserByUsernameOrEmail,
  verifyUserPassword,
  updateLastLogin,
  checkLockout,
  recordFailedAttempt,
  clearFailedAttempts,
  createPasswordResetCode,
  verifyAndResetPassword,
  getCompanies,
  getCompanyById,
  createCompany,
  getConnection,
  saveConnection,
  touchWebhookHealth,
  addLoginLog,
  getLoginLogs,
};
