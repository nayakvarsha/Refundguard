const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const defaultDbPath = path.join(__dirname, "..", "..", "data", "refundguard.sqlite");
const sqliteDbPath = isVercel ? path.join("/tmp", "refundguard.sqlite") : defaultDbPath;

function createInMemoryDbFallback() {
  const users = new Map();
  const companies = new Map();
  const connections = new Map();
  const loginLogs = [];
  const passwordResets = new Map();

  const demoHash = bcrypt.hashSync("demo", 10);
  const adminHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || "rg_admin_sec_9948", 10);

  const adminUser = {
    id: "USR-ADMIN-001",
    username: process.env.ADMIN_USERNAME || "admin",
    email: "admin@refundguard.io",
    passwordHash: adminHash,
    role: "ADMIN",
    companyId: null,
    lastLoginAt: new Date().toISOString(),
    failedAttempts: 0,
    lockedUntil: null,
  };
  users.set("admin", adminUser);

  const flipkartComp = {
    id: "COMP-FLIPKART",
    name: "Flipkart E-Commerce",
    email: "finance@flipkart.com",
    brandColor: "#2563eb",
    createdAt: new Date().toISOString(),
  };
  companies.set("COMP-FLIPKART", flipkartComp);

  const flipkartUser = {
    id: "USR-FLIPKART",
    username: "flipkart",
    email: "finance@flipkart.com",
    passwordHash: demoHash,
    role: "COMPANY",
    companyId: "COMP-FLIPKART",
    lastLoginAt: new Date().toISOString(),
    failedAttempts: 0,
    lockedUntil: null,
  };
  users.set("flipkart", flipkartUser);

  const myntraComp = {
    id: "COMP-MYNTRA",
    name: "Myntra Fashion",
    email: "payments@myntra.com",
    brandColor: "#db2777",
    createdAt: new Date().toISOString(),
  };
  companies.set("COMP-MYNTRA", myntraComp);

  const myntraUser = {
    id: "USR-MYNTRA",
    username: "myntra",
    email: "payments@myntra.com",
    passwordHash: demoHash,
    role: "COMPANY",
    companyId: "COMP-MYNTRA",
    lastLoginAt: new Date().toISOString(),
    failedAttempts: 0,
    lockedUntil: null,
  };
  users.set("myntra", myntraUser);

  const flipkartConn = {
    companyId: "COMP-FLIPKART",
    razorpayKeyId: "rzp_test_flipkart_key",
    razorpayKeySecret: "rzp_sec_flipkart",
    webhookSecret: "whsec_flipkart_01",
    webhookUrl: "/api/webhooks/company/COMP-FLIPKART",
    status: "DEMO_CONNECTED",
    lastWebhookAt: new Date().toISOString(),
  };
  connections.set("COMP-FLIPKART", flipkartConn);

  const myntraConn = {
    companyId: "COMP-MYNTRA",
    razorpayKeyId: "rzp_test_myntra_key",
    razorpayKeySecret: "rzp_sec_myntra",
    webhookSecret: "whsec_myntra_01",
    webhookUrl: "/api/webhooks/company/COMP-MYNTRA",
    status: "DEMO_CONNECTED",
    lastWebhookAt: new Date().toISOString(),
  };
  connections.set("COMP-MYNTRA", myntraConn);

  return {
    pragma: () => {},
    exec: () => {},
    transaction: (fn) => (...args) => fn(...args),
    prepare: (sql) => {
      const lowerSql = sql.toLowerCase();
      return {
        get: (...params) => {
          if (lowerSql.includes("from users where role = 'admin'")) {
            return users.get("admin") || null;
          }
          if (lowerSql.includes("from users where lower(username) = ? or lower(email) = ?")) {
            const p = (params[0] || "").toLowerCase();
            for (const u of users.values()) {
              if (u.username.toLowerCase() === p || u.email.toLowerCase() === p) return u;
            }
            return null;
          }
          if (lowerSql.includes("from users where id = ?")) {
            for (const u of users.values()) {
              if (u.id === params[0]) return u;
            }
            return null;
          }
          if (lowerSql.includes("from companies where id = ?")) {
            return companies.get(params[0]) || null;
          }
          if (lowerSql.includes("from connections where companyid = ?")) {
            return connections.get(params[0]) || null;
          }
          if (lowerSql.includes("from password_resets where code = ?")) {
            return passwordResets.get(params[0]) || null;
          }
          return null;
        },
        all: (...params) => {
          if (lowerSql.includes("from users")) return Array.from(users.values());
          if (lowerSql.includes("from companies")) return Array.from(companies.values());
          if (lowerSql.includes("from login_logs")) return loginLogs.slice(0, params[0] || 100);
          return [];
        },
        run: (...params) => {
          if (lowerSql.includes("insert into users")) {
            const [id, username, email, passwordHash, role, companyId, lastLoginAt] = params;
            const u = { id, username, email, passwordHash, role, companyId, lastLoginAt, failedAttempts: 0, lockedUntil: null };
            users.set(username.toLowerCase(), u);
          } else if (lowerSql.includes("update users set username = ?, passwordhash = ? where role = 'admin'")) {
            const admin = users.get("admin");
            if (admin) {
              admin.username = params[0];
              admin.passwordHash = params[1];
            }
          } else if (lowerSql.includes("update users set passwordhash = ?")) {
            for (const u of users.values()) {
              if (u.id === params[1] || u.username === params[1]) {
                u.passwordHash = params[0];
              }
            }
          } else if (lowerSql.includes("update users set lastloginat = ? where id = ?")) {
            for (const u of users.values()) {
              if (u.id === params[1]) u.lastLoginAt = params[0];
            }
          } else if (lowerSql.includes("update users set failedattempts = ?, lockeduntil = ? where id = ?")) {
            for (const u of users.values()) {
              if (u.id === params[2]) {
                u.failedAttempts = params[0];
                u.lockedUntil = params[1];
              }
            }
          } else if (lowerSql.includes("update users set failedattempts = 0, lockeduntil = null where id = ?")) {
            for (const u of users.values()) {
              if (u.id === params[0]) {
                u.failedAttempts = 0;
                u.lockedUntil = null;
              }
            }
          } else if (lowerSql.includes("insert into companies")) {
            const [id, name, email, brandColor, createdAt] = params;
            companies.set(id, { id, name, email, brandColor, createdAt });
          } else if (lowerSql.includes("insert into connections")) {
            const [companyId, razorpayKeyId, razorpayKeySecret, webhookSecret, webhookUrl, status, lastWebhookAt] = params;
            connections.set(companyId, { companyId, razorpayKeyId, razorpayKeySecret, webhookSecret, webhookUrl, status, lastWebhookAt });
          } else if (lowerSql.includes("update connections")) {
            const conn = connections.get(params[5]);
            if (conn) {
              conn.razorpayKeyId = params[0];
              conn.razorpayKeySecret = params[1];
              conn.webhookSecret = params[2];
              conn.status = params[3];
              conn.lastWebhookAt = params[4];
            }
          } else if (lowerSql.includes("insert into login_logs")) {
            const [id, actor, email, role, timestamp, result, details] = params;
            loginLogs.unshift({ id, actor, email, role, timestamp, result, details });
          } else if (lowerSql.includes("insert into password_resets")) {
            const [code, userId, username, email, expiresAt, used] = params;
            passwordResets.set(code, { code, userId, username, email, expiresAt, used });
          }
          return { changes: 1 };
        },
      };
    },
  };
}

function initAndMigrateDb() {
  if (isVercel) {
    console.log("Vercel environment detected: using in-memory store fallback.");
    return createInMemoryDbFallback();
  }

  let Database;
  try {
    Database = require("better-sqlite3");
  } catch (err) {
    console.warn("better-sqlite3 not available, using in-memory store fallback.");
    return createInMemoryDbFallback();
  }

  try {
    const db = new Database(sqliteDbPath);
    db.pragma("journal_mode = WAL");

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

    const insertCompany = db.prepare(
      "INSERT OR IGNORE INTO companies (id, name, email, brandColor, createdAt)" +
      " VALUES (?, ?, ?, ?, ?)"
    );
    const insertConnection = db.prepare(
      "INSERT OR IGNORE INTO connections (companyId, razorpayKeyId, razorpayKeySecret, webhookSecret, webhookUrl, status, lastWebhookAt)" +
      " VALUES (?, ?, ?, ?, ?, ?, ?)"
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
  } catch (err) {
    console.error("SQLite DB error, using in-memory store fallback:", err);
    return createInMemoryDbFallback();
  }
}

module.exports = { initAndMigrateDb, sqliteDbPath };
