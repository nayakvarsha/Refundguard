const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const sqliteDbPath = path.join(__dirname, "..", "..", "data", "refundguard.sqlite");

function initAndMigrateDb() {
  const db = new Database(sqliteDbPath);

  // Enable WAL mode for high performance
  db.pragma("journal_mode = WAL");

  // Create relational SQLite tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      brandColor TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS connections (
      companyId TEXT PRIMARY KEY,
      razorpayKeyId TEXT,
      razorpayKeySecret TEXT,
      webhookSecret TEXT,
      webhookUrl TEXT,
      status TEXT,
      lastWebhookAt TEXT,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL,
      companyId TEXT,
      lastLoginAt TEXT,
      failedAttempts INTEGER DEFAULT 0,
      lockedUntil TEXT
    );

    CREATE TABLE IF NOT EXISTS login_logs (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      email TEXT,
      role TEXT,
      timestamp TEXT NOT NULL,
      result TEXT NOT NULL,
      details TEXT
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      code TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      username TEXT NOT NULL,
      email TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      used INTEGER DEFAULT 0
    );
  `);

  // Seed Flipkart & Myntra as DEMO_CONNECTED rows in companies & connections tables if missing
  const insertCompany = db.prepare(
    "INSERT OR IGNORE INTO companies (id, name, email, brandColor, createdAt) VALUES (?, ?, ?, ?, ?)"
  );
  const insertConnection = db.prepare(
    "INSERT OR IGNORE INTO connections (companyId, razorpayKeyId, razorpayKeySecret, webhookSecret, webhookUrl, status, lastWebhookAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  const baseUrl = process.env.PUBLIC_URL || "http://localhost:4000";

  const seedTx = db.transaction(() => {
    insertCompany.run("COMP-FLIPKART", "Flipkart E-Commerce", "finance@flipkart.com", "#2563eb", new Date().toISOString());
    insertConnection.run("COMP-FLIPKART", "rzp_test_flipkart_key", "rzp_sec_flipkart", "whsec_flipkart_01", `${baseUrl}/api/webhooks/company/COMP-FLIPKART`, "DEMO_CONNECTED", new Date().toISOString());

    insertCompany.run("COMP-MYNTRA", "Myntra Fashion", "payments@myntra.com", "#db2777", new Date().toISOString());
    insertConnection.run("COMP-MYNTRA", "rzp_test_myntra_key", "rzp_sec_myntra", "whsec_myntra_01", `${baseUrl}/api/webhooks/company/COMP-MYNTRA`, "DEMO_CONNECTED", new Date().toISOString());
  });

  seedTx();

  return db;
}

module.exports = { initAndMigrateDb, sqliteDbPath };
