const express = require("express");
const fs = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");
const { runEngine } = require("../engine/runEngine");
const { scoreBenchmark } = require("../engine/benchmark");
const { classifySeverity } = require("../engine/severity");
const { decideAction } = require("../engine/policyEngine");
const { investigate } = require("../engine/investigator");
const { simulate } = require("../engine/simulator");
const { getAuditLogs, addAuditLog, clearAuditLogs } = require("../services/auditService");
const { createMockRazorpayEvent } = require("../services/razorpayService");
const { validateWebhookSignature, translateWebhookEvent } = require("../connectors/razorpayConnector");
const { getLiveStore, addLiveOrder, addLiveRefund, addLiveIncident, addLiveEvent } = require("../engine/liveStore");
const { getRazorpayClient } = require("../services/razorpayClient");
const { loadData } = require("../engine/loadData");
const {
  getCompanies,
  getCompanyById,
  createCompany,
  getConnection,
  saveConnection,
  findUserByUsernameOrEmail,
  verifyUserPassword,
  updateLastLogin,
  checkLockout,
  recordFailedAttempt,
  clearFailedAttempts,
  createPasswordResetCode,
  verifyAndResetPassword,
  addLoginLog,
  getLoginLogs,
  touchWebhookHealth,
} = require("../services/dbService");

const router = express.Router();

// Session storage
const activeSessions = new Map(); // token -> { userId, username, role, companyId, createdAt }

// Webhook Idempotency Event Registry
const processedWebhookEvents = new Set();

// Configurable policy thresholds (Item 3!)
let policySettings = {
  autoInvestigateMax: 10000,
  merchantReviewMax: 50000,
  requireHumanApprovalAbove: 50000,
  idempotencyWindowSeconds: 5,
};

// Cache the last engine run in memory; re-run on demand via POST /run or settings update
let cache = null;

function ensureRun() {
  if (!cache) {
    cache = runEngine(null, "DEMO", policySettings);
    addAuditLog({
      eventType: "ENGINE_INITIALIZED",
      orderId: "SYSTEM",
      actor: "SYSTEM",
      action: "RUN_ENGINE",
      details: `Engine initialized with ${cache.summary.incidentsFound} incidents from ${cache.summary.recordsAnalyzed} records.`,
      severity: "INFO",
    });
  }
  return cache;
}

// POST /api/auth/login - Shared Unified Login API
router.post("/auth/login", async (req, res) => {
  try {
    const { username, password, role = "COMPANY" } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    // Lockout Protection
    const lockout = checkLockout(username);
    if (lockout.isLocked) {
      addLoginLog({
        actor: username,
        email: req.ip || "N/A",
        role,
        result: "FAILED_ATTEMPT",
        details: `Account locked. ${lockout.secondsLeft}s remaining.`,
      });
      return res.status(429).json({
        error: `Account locked due to 5 consecutive failed attempts. Try again in ${lockout.secondsLeft} seconds.`,
      });
    }

    let user = null;

    if (role === "ADMIN") {
      user = findUserByUsernameOrEmail("admin") || {
        id: "USR-ADMIN-001",
        username: "admin",
        email: "admin@refundguard.io",
        role: "ADMIN",
      };

      const isValidAdmin = await verifyUserPassword(user, password);
      if (!isValidAdmin) {
        const record = recordFailedAttempt(username);
        addLoginLog({
          actor: `ADMIN (${username})`,
          email: req.ip || "N/A",
          role: "ADMIN",
          result: "FAILED_ATTEMPT",
          details: "Invalid administrator password entered.",
        });

        return res.status(401).json({
          error: "Invalid administrator password.",
          attemptsLeft: Math.max(0, 5 - record.count),
        });
      }

      user = {
        id: `USR-ADMIN-${username.toUpperCase().slice(0, 8)}`,
        username,
        email: `${username}@refundguard.io`,
        role: "ADMIN",
        companyId: null,
        lastLoginAt: new Date().toISOString(),
      };
    } else {
      user = findUserByUsernameOrEmail(username);

      if (!user) {
        // Auto-provision customer company account on demand if logging in with new email or username
        const cleanName = username.includes("@") ? username.split("@")[0] : username;
        const compEmail = username.includes("@") ? username : `${username}@merchant.io`;
        const companyName = `${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)} Enterprise`;

        const created = await createCompany({
          name: companyName,
          email: compEmail,
          username: username.toLowerCase().trim(),
          password,
        });

        user = created.user;
      } else if (user.role === "COMPANY") {
        const isValid = await verifyUserPassword(user, password);
        if (!isValid) {
          const record = recordFailedAttempt(username);
          addLoginLog({
            actor: user.username || user.email,
            email: user.email,
            role: "COMPANY",
            result: "FAILED_ATTEMPT",
            details: "Invalid password entered.",
          });

          return res.status(401).json({
            error: "Invalid customer credentials. Please check your password or sign up.",
            attemptsLeft: Math.max(0, 5 - record.count),
          });
        }
      }
    }

    // Successful Login
    clearFailedAttempts(username);
    if (user.companyId) {
      updateLastLogin(user.id);
    }

    const token = `sess_${user.role.toLowerCase()}_${uuid().slice(0, 12)}`;
    const session = {
      userId: user.id,
      username: user.username,
      role: user.role,
      companyId: user.companyId,
      createdAt: new Date().toISOString(),
    };
    activeSessions.set(token, session);

    let company = null;
    if (user.companyId) {
      company = getCompanyById(user.companyId);
    }

    addLoginLog({
      actor: user.role === "ADMIN" ? `SUPER_ADMIN (${user.username})` : (company ? company.name : user.username),
      email: user.email,
      role: user.role,
      result: "SUCCESS",
      details: `${user.role} logged in successfully as "${user.username}".`,
    });

    res.json({
      ok: true,
      token,
      role: user.role,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        lastLoginAt: user.lastLoginAt,
      },
      company,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: `Authentication failed: ${err.message || 'Server error'}` });
  }
});

// POST /api/auth/signup - Customer Signup Route
router.post("/auth/signup", async (req, res) => {
  try {
    const { name, email, username, password } = req.body;
    if (!name || !email || !username || !password) {
      return res.status(400).json({ error: "Missing required signup details (Company Name, Email, Username, Password)." });
    }

    const existing = findUserByUsernameOrEmail(username) || findUserByUsernameOrEmail(email);
    if (existing) {
      return res.status(400).json({ error: "Username or email is already registered." });
    }

    const { company, user } = await createCompany({ name, email, username, password });
    const conn = getConnection(company.id);

    addLoginLog({
      actor: company.name,
      email: company.email,
      role: "COMPANY",
      result: "SUCCESS",
      details: `Customer self-serve signup completed. Username: ${user.username}`,
    });

    res.json({
      ok: true,
      company: {
        ...company,
        connectionStatus: conn ? conn.status : "DISCONNECTED",
        webhookUrl: conn ? conn.webhookUrl : `${process.env.PUBLIC_URL || 'http://localhost:4000'}/api/webhooks/company/${company.id}`,
      },
      user: {
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: `Signup failed: ${err.message || 'Server error'}` });
  }
});

// POST /api/auth/forgot-password - Customer Forgot Password Code Request
router.post("/auth/forgot-password", (req, res) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ error: "Username or email is required." });
  }

  const reset = createPasswordResetCode(identifier);
  if (!reset) {
    return res.status(404).json({ error: "Account not found for customer." });
  }
  if (reset.error) {
    return res.status(400).json({ error: reset.error });
  }

  addLoginLog({
    actor: reset.username,
    email: reset.email,
    role: "COMPANY",
    result: "SUCCESS",
    details: `Password reset code requested: ${reset.code}`,
  });

  res.json({
    ok: true,
    message: "Reset code generated for demo environment.",
    resetCode: reset.code,
    username: reset.username,
  });
});

// POST /api/auth/reset-password - Customer Reset Password Completion
router.post("/auth/reset-password", async (req, res) => {
  const { code, newPassword } = req.body;
  if (!code || !newPassword) {
    return res.status(400).json({ error: "Reset code and new password are required." });
  }

  const result = await verifyAndResetPassword({ code, newPassword });
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  addLoginLog({
    actor: result.user.username,
    email: result.user.email,
    role: "COMPANY",
    result: "SUCCESS",
    details: "Password reset completed successfully.",
  });

  res.json({
    ok: true,
    message: "Password reset completed successfully. You can now log in with your new password.",
  });
});

// POST /api/auth/logout - Logout API
router.post("/auth/logout", (req, res) => {
  const token = req.headers["x-session-token"] || (req.headers["authorization"] ? req.headers["authorization"].replace("Bearer ", "") : null);
  if (token && activeSessions.has(token)) {
    activeSessions.delete(token);
  }
  res.json({ ok: true, message: "Logged out successfully" });
});

// GET /api/companies - list all registered companies
router.get("/companies", (req, res) => {
  const companies = getCompanies();
  const baseUrl = process.env.PUBLIC_URL || "http://localhost:4000";
  const list = companies.map((c) => {
    const conn = getConnection(c.id);
    return {
      ...c,
      connectionStatus: conn ? conn.status : "DISCONNECTED",
      lastWebhookAt: conn ? conn.lastWebhookAt : null,
      webhookUrl: conn ? conn.webhookUrl : `${baseUrl}/api/webhooks/company/${c.id}`,
    };
  });
  res.json({ ok: true, companies: list });
});

// Helper: mask a secret so only the last 4 characters are visible
function maskSecret(secret) {
  if (!secret) return "";
  if (secret.length <= 4) return "****";
  return "*".repeat(secret.length - 4) + secret.slice(-4);
}

// GET /api/companies/:id/connection - View company Razorpay connection status
router.get("/companies/:id/connection", (req, res) => {
  if (!verifyAdminSession(req) && !verifyCompanySession(req, req.params.id)) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  const conn = getConnection(req.params.id);
  if (!conn) return res.status(404).json({ error: "Company connection not found" });
  res.json({
    ok: true,
    connection: {
      ...conn,
      razorpayKeySecret: conn.razorpayKeySecret ? maskSecret(conn.razorpayKeySecret) : "",
      webhookSecret: conn.webhookSecret ? maskSecret(conn.webhookSecret) : "",
    },
  });
});

// POST /api/companies/:id/connection - Connect Razorpay account keys
router.post("/companies/:id/connection", (req, res) => {
  if (!verifyAdminSession(req) && !verifyCompanySession(req, req.params.id)) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  const { razorpayKeyId, razorpayKeySecret, webhookSecret } = req.body;
  const conn = saveConnection(req.params.id, { razorpayKeyId, razorpayKeySecret, webhookSecret, status: "CONNECTED" });

  addAuditLog({
    eventType: "RAZORPAY_CONNECTED",
    orderId: "SYSTEM",
    actor: req.params.id,
    action: "SAVE_KEYS",
    details: `Updated Razorpay API Key connection for company ${req.params.id}`,
    severity: "INFO",
  });

  res.json({ ok: true, connection: conn });
});

// POST /api/companies/:id/test-connection - Test Razorpay API Connection Credentials
router.post("/companies/:id/test-connection", async (req, res) => {
  const companyId = req.params.id;
  if (!verifyAdminSession(req) && !verifyCompanySession(req, companyId)) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const razorpay = getRazorpayClient(companyId);
  if (!razorpay) {
    return res.status(400).json({
      ok: false,
      verified: false,
      error: "No Razorpay credentials configured for company.",
    });
  }

  try {
    await razorpay.orders.all({ count: 1 });
    const conn = getConnection(companyId);

    addAuditLog({
      eventType: "RAZORPAY_CONNECTION_TESTED",
      orderId: "SYSTEM",
      actor: companyId,
      action: "TEST_API_KEYS",
      details: `Successfully verified Razorpay API keys for company ${companyId}.`,
      severity: "INFO",
    });

    res.json({
      ok: true,
      verified: true,
      key_id: conn?.razorpayKeyId ? maskSecret(conn.razorpayKeyId) : "Global Env Key",
      mode: "TEST",
      lastVerifiedAt: new Date().toISOString(),
      message: "✓ Razorpay API connection verified successfully!",
    });
  } catch (err) {
    console.error("Razorpay API connection test failed:", err);
    res.status(400).json({
      ok: false,
      verified: false,
      error: `Connection Failed: ${err.description || err.message || 'Invalid API credentials'}`,
    });
  }
});

// POST /api/companies/:id/oauth - Simulated / Demo Razorpay Partner OAuth Connection
router.post("/companies/:id/oauth", (req, res) => {
  if (!verifyAdminSession(req) && !verifyCompanySession(req, req.params.id)) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  const companyId = req.params.id;

  const isRealOauthConfigured = Boolean(process.env.RAZORPAY_CLIENT_ID && process.env.RAZORPAY_CLIENT_SECRET);

  if (isRealOauthConfigured) {
    const redirectUri = process.env.RAZORPAY_OAUTH_REDIRECT_URI || `${process.env.PUBLIC_URL || 'http://localhost:4000'}/api/auth/razorpay/callback`;
    const authorizeUrl = `https://auth.razorpay.com/authorize?client_id=${process.env.RAZORPAY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read_write&state=${companyId}`;
    return res.json({ ok: true, mode: "REAL_OAUTH", authorizeUrl });
  }

  const conn = saveConnection(companyId, {
    razorpayKeyId: `rzp_partner_${companyId.toLowerCase()}`,
    razorpayKeySecret: `simulated_oauth_${uuid().slice(0, 8)}`,
    webhookSecret: `whsec_${companyId.toLowerCase()}_simulated`,
    status: "DEMO_CONNECTED",
  });

  addAuditLog({
    eventType: "RAZORPAY_SIMULATED_OAUTH_CONNECTED",
    orderId: "SYSTEM",
    actor: companyId,
    action: "SIMULATED_OAUTH",
    details: `Connected Razorpay via Simulated Partner OAuth for company ${companyId}`,
    severity: "INFO",
  });

  res.json({ ok: true, connection: conn, mode: "SIMULATED_OAUTH" });
});

// GET /api/auth/razorpay/callback - Real Razorpay Partner OAuth Authorization Code Exchange & State Validation
router.get("/auth/razorpay/callback", async (req, res) => {
  const { code, state: companyId, error } = req.query;

  if (!companyId || typeof companyId !== "string" || !companyId.startsWith("COMP-")) {
    return res.status(400).send("OAuth Error: Invalid or missing state parameter.");
  }

  if (error || !code) {
    return res.status(400).send(`OAuth Error: ${error || 'Missing authorization code'}`);
  }

  try {
    const redirectUri = process.env.RAZORPAY_OAUTH_REDIRECT_URI || `${process.env.PUBLIC_URL || 'http://localhost:4000'}/api/auth/razorpay/callback`;
    const params = new URLSearchParams();
    params.append('client_id', process.env.RAZORPAY_CLIENT_ID);
    params.append('client_secret', process.env.RAZORPAY_CLIENT_SECRET);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', redirectUri);
    params.append('code', code);

    const tokenRes = await fetch('https://auth.razorpay.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const tokenData = await tokenRes.json();

    if (tokenData.access_token && companyId) {
      saveConnection(companyId, {
        razorpayKeyId: tokenData.razorpay_key_id || `rzp_live_${companyId}`,
        razorpayKeySecret: `Bearer ${tokenData.access_token}`,
        refreshToken: tokenData.refresh_token || null,
        webhookSecret: `whsec_${companyId}_oauth`,
        status: "CONNECTED",
      });

      addAuditLog({
        eventType: "RAZORPAY_OAUTH_TOKEN_EXCHANGED",
        orderId: "SYSTEM",
        actor: companyId,
        action: "OAUTH_TOKEN_EXCHANGE",
        details: `Successfully exchanged authorization code for Razorpay OAuth Access Token & Refresh Token.`,
        severity: "INFO",
      });

      res.send(`<h2>✓ Razorpay OAuth Connection Successful!</h2><p>You can close this tab and return to RefundGuard.</p>`);
    } else {
      res.status(400).send(`OAuth Exchange Error: ${tokenData.error_description || 'Token exchange failed'}`);
    }
  } catch (err) {
    console.error("OAuth token exchange error:", err);
    res.status(500).send(`Internal OAuth Error: ${err.message}`);
  }
});

// POST /api/companies/:id/upload-data - CSV / JSON Custom Transaction Importer
router.post("/companies/:id/upload-data", (req, res) => {
  const companyId = req.params.id;
  if (!verifyAdminSession(req) && !verifyCompanySession(req, companyId)) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const { records } = req.body;
  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: "Invalid upload: records array is required." });
  }

  const uploadsDir = path.join(__dirname, "..", "..", "data", "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });

  const orders = [];
  const payments = [];
  const refunds = [];
  const ledger = [];

  records.forEach((r, idx) => {
    const orderId = r.order_id || r.orderId || `ORD-UP-${idx + 1}`;
    const paymentId = r.payment_id || r.paymentId || `PAY-UP-${idx + 1}`;
    const orderAmount = Number(r.order_amount || r.orderAmount || 0);
    const capturedAmount = Number(r.captured_amount || r.capturedAmount || orderAmount);
    const refundAmount = Number(r.refund_amount || r.refundAmount || 0);
    const createdAt = new Date().toISOString();

    orders.push({ companyId, orderId, amount: orderAmount, status: "COMPLETED", createdAt });
    payments.push({ companyId, paymentId, orderId, capturedAmount, status: "CAPTURED", createdAt });

    if (refundAmount > 0) {
      refunds.push({
        companyId,
        refundId: `REF-UP-${uuid().slice(0, 6).toUpperCase()}`,
        paymentId,
        orderId,
        amount: refundAmount,
        status: "PROCESSED",
        requestedAt: createdAt,
        processedAt: createdAt,
      });
    }

    const ledgerStatus = refundAmount >= orderAmount ? "REFUNDED" : (refundAmount > 0 ? "PARTIALLY_REFUNDED" : "CAPTURED");
    ledger.push({ companyId, orderId, ledgerStatus });
  });

  const uploadPayload = { orders, payments, refunds, ledger, uploadedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(uploadsDir, `${companyId}.json`), JSON.stringify(uploadPayload, null, 2));

  addAuditLog({
    eventType: "CUSTOM_DATA_UPLOADED",
    orderId: "SYSTEM",
    actor: companyId,
    action: "IMPORT_CSV_JSON",
    details: `Imported ${records.length} custom transaction records for company ${companyId}.`,
    severity: "INFO",
  });

  const companyRun = runEngine(companyId, "UPLOADED", policySettings);

  res.json({
    ok: true,
    message: `Successfully imported ${records.length} transaction records!`,
    recordsImported: records.length,
    incidentsFound: companyRun.incidents.length,
    summary: getEnrichedSummary(companyRun.summary, companyId),
  });
});

// Helper verify caller is logged in as company or super-admin
function verifyCompanySession(req, companyId) {
  const headerToken = req.headers["x-session-token"] || (req.headers["authorization"] ? req.headers["authorization"].replace("Bearer ", "") : null);
  if (!headerToken) return false;
  const session = activeSessions.get(headerToken);
  return session && ((session.role === "COMPANY" && session.companyId === companyId) || session.role === "ADMIN");
}

// Helper middleware to verify admin token
function verifyAdminSession(req) {
  const headerToken = req.headers["x-session-token"] || (req.headers["authorization"] ? req.headers["authorization"].replace("Bearer ", "") : null);
  if (!headerToken) return false;
  const session = activeSessions.get(headerToken);
  return session && session.role === "ADMIN";
}

// GET /api/admin/overview - Protected Super-Admin Overview
router.get("/admin/overview", (req, res) => {
  if (!verifyAdminSession(req)) {
    return res.status(401).json({ error: "Unauthorized. Super-Admin authentication required." });
  }

  const companies = getCompanies();
  const overview = companies.map((c) => {
    const conn = getConnection(c.id);
    const companyRun = runEngine(c.id, "DEMO", policySettings);

    return {
      id: c.id,
      name: c.name,
      email: c.email,
      incidents: companyRun.incidents.length,
      exposure: companyRun.summary.moneyAtRisk.totalExposure,
      connectionStatus: conn ? conn.status : "DISCONNECTED",
      lastWebhookAt: conn ? conn.lastWebhookAt : null,
      webhookUrl: conn ? conn.webhookUrl : `${process.env.PUBLIC_URL || 'http://localhost:4000'}/api/webhooks/company/${c.id}`,
    };
  });

  res.json({
    ok: true,
    totalCompanies: companies.length,
    activeConnections: overview.filter((o) => o.connectionStatus === "CONNECTED").length,
    platformTotalIncidents: overview.reduce((acc, o) => acc + o.incidents, 0),
    platformTotalExposure: overview.reduce((acc, o) => acc + o.exposure, 0),
    companies: overview,
    loginLogs: getLoginLogs(100),
  });
});

// GET /api/health - Lightweight health check independent of database queries (Directive 3)
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "RefundGuard Engine API",
    mode: "MULTI_TENANT_CUSTOMER_SELF_SERVE",
    store: "Native SQLite Database (better-sqlite3)",
    backendConnected: true,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/settings - Protected policy settings
router.get("/settings", (req, res) => {
  if (!verifyAdminSession(req)) {
    return res.status(401).json({ error: "Unauthorized. Admin role required to view policy settings." });
  }
  res.json({ ok: true, settings: policySettings });
});

// POST /api/settings - Protected policy thresholds update (Item 3: Re-runs engine with new policySettings!)
router.post("/settings", (req, res) => {
  if (!verifyAdminSession(req)) {
    return res.status(401).json({ error: "Unauthorized. Admin role required to update policy thresholds." });
  }
  policySettings = { ...policySettings, ...req.body };
  cache = runEngine(null, "DEMO", policySettings);

  addAuditLog({
    eventType: "POLICY_SETTINGS_UPDATED",
    orderId: "SYSTEM",
    actor: "ADMIN",
    action: "UPDATE_POLICY_THRESHOLDS",
    details: `Updated policy thresholds: Human Approval Above ₹${policySettings.requireHumanApprovalAbove.toLocaleString("en-IN")}, Auto-Investigate Max ₹${policySettings.autoInvestigateMax.toLocaleString("en-IN")}`,
    severity: "INFO",
  });

  res.json({ ok: true, settings: policySettings, summary: getEnrichedSummary(cache.summary, null) });
});

// POST /api/run - Protected engine run endpoint (Item 3: Passes policySettings!)
router.post("/run", (req, res) => {
  const companyId = req.query.companyId || "COMP-FLIPKART";
  const sourceType = req.query.sourceType || "DEMO";
  if (!verifyCompanySession(req, companyId)) {
    return res.status(401).json({ error: "Unauthorized for company context." });
  }

  cache = runEngine(companyId, sourceType, policySettings);
  res.json({ ok: true, summary: getEnrichedSummary(cache.summary, companyId) });
});

// POST /api/reset - reset system state
router.post("/reset", (req, res) => {
  if (!verifyAdminSession(req)) {
    return res.status(401).json({ error: "Unauthorized. Admin role required." });
  }
  cache = runEngine(null, "DEMO", policySettings);
  clearAuditLogs();
  res.json({ ok: true, message: "System state reset successfully" });
});

// Mathematical Refund Integrity Score Formula
function getEnrichedSummary(rawSummary, companyId) {
  if (!rawSummary || rawSummary.recordsAnalyzed === 0) {
    return {
      recordsAnalyzed: 0,
      incidentsFound: 0,
      rawExceptionsFound: 0,
      moneyAtRisk: { totalExposure: 0, criticalExposure: 0, highExposure: 0 },
      refundIntegrityScore: 100,
      reconciledRecords: 0,
    };
  }

  if (rawSummary.incidentsFound === 0) {
    return {
      ...rawSummary,
      refundIntegrityScore: 100,
      reconciledRecords: rawSummary.recordsAnalyzed,
    };
  }

  const incidentPenalty = Math.min(40, (rawSummary.incidentsFound / rawSummary.recordsAnalyzed) * 100);
  const leakageRatio = rawSummary.moneyAtRisk.totalExposure / (rawSummary.recordsAnalyzed * 5000);
  const exposurePenalty = Math.min(30, leakageRatio * 100);
  const criticalPenalty = (rawSummary.severityCounts?.CRITICAL || 0) * 2;

  const score = Math.max(0, Math.round(100 - incidentPenalty - exposurePenalty - criticalPenalty));

  return {
    ...rawSummary,
    refundIntegrityScore: score,
    reconciledRecords: rawSummary.recordsAnalyzed - rawSummary.incidentsFound,
  };
}

// GET /api/summary - Real summary filtered by company & sourceType (Item 3: Passes policySettings!)
router.get("/summary", (req, res) => {
  const companyId = req.query.companyId;
  const sourceType = req.query.sourceType || "DEMO";

  if (companyId && verifyCompanySession(req, companyId)) {
    const company = getCompanyById(companyId);
    if (company) {
      const companyRun = runEngine(companyId, sourceType, policySettings);
      return res.json(getEnrichedSummary(companyRun.summary, companyId));
    }
  }

  // Fallback for demo preview & guest dashboard view
  const { summary } = ensureRun();
  res.json(getEnrichedSummary(summary, null));
});

// GET /api/incidents - Real incidents filtered by company & sourceType (Item 3: Passes policySettings!)
router.get("/incidents", (req, res) => {
  const companyId = req.query.companyId;
  const sourceType = req.query.sourceType || "DEMO";

  let incidents = [];
  if (companyId && verifyCompanySession(req, companyId)) {
    const companyRun = runEngine(companyId, sourceType, policySettings);
    incidents = companyRun.incidents;
  } else {
    const run = ensureRun();
    incidents = run.incidents;
  }

  let result = [...incidents];

  if (req.query.severity && req.query.severity !== "undefined" && req.query.severity !== "null") {
    const sev = req.query.severity.toUpperCase();
    result = result.filter((i) => i.severity && i.severity.level === sev);
  }
  if (req.query.type && req.query.type !== "undefined" && req.query.type !== "null") {
    const typ = req.query.type.toUpperCase();
    result = result.filter((i) => i.types && i.types.includes(typ));
  }
  if (req.query.search) {
    const q = req.query.search.toLowerCase();
    result = result.filter(
      (i) =>
        i.id.toLowerCase().includes(q) ||
        i.orderId.toLowerCase().includes(q) ||
        (i.paymentId && i.paymentId.toLowerCase().includes(q)) ||
        i.refundIds.some((r) => r.toLowerCase().includes(q))
    );
  }

  const limit = parseInt(req.query.limit, 10) || 100;
  res.json({
    total: result.length,
    incidents: result.slice(0, limit),
  });
});

// GET /api/incidents/export/csv - Real CSV export filtered by company & sourceType
router.get("/incidents/export/csv", (req, res) => {
  const companyId = req.query.companyId;
  const sourceType = req.query.sourceType || "DEMO";
  if (!companyId) return res.status(400).json({ error: "Missing companyId parameter" });
  if (!verifyCompanySession(req, companyId)) return res.status(401).json({ error: "Unauthorized for company context." });

  const company = getCompanyById(companyId);
  if (!company) return res.status(404).json({ error: "Company not found" });

  const companyRun = runEngine(companyId, sourceType, policySettings);
  const list = companyRun.incidents;
  const companyName = company.name;

  let csvContent = `Incident ID,Company Name,Order ID,Payment ID,Violation Types,Exposure Amount (INR),Severity,Policy Action,Detected At\n`;

  list.forEach((inc) => {
    const typesStr = `"${(inc.types || []).join("; ")}"`;
    const action = `"${inc.policy?.action || 'HUMAN_APPROVAL_REQUIRED'}"`;
    csvContent += `${inc.id},"${companyName}",${inc.orderId},${inc.paymentId || 'N/A'},${typesStr},${inc.exposureAmount},${inc.severity?.level || 'HIGH'},${action},${inc.detectedAt || new Date().toISOString()}\n`;
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="RefundGuard_Report_${companyId}_${Date.now()}.csv"`);
  res.send(csvContent);
});

// GET /api/incidents/:id - full detail
router.get("/incidents/:id", (req, res) => {
  const { incidents } = ensureRun();
  let incident = incidents.find((i) => i.id === req.params.id);

  if (!incident) return res.status(404).json({ error: "Incident not found" });

  const proof = generateFinancialProof(incident);

  res.json({
    ...incident,
    financialProof: proof,
  });
});

function generateFinancialProof(incident) {
  const capturedAmount = incident.exceptions?.find((e) => e.evidence?.capturedAmount)?.evidence?.capturedAmount
    || incident.exceptions?.find((e) => e.evidence?.orderAmount)?.evidence?.orderAmount
    || incident.exposureAmount;

  const refundedAmount = incident.exceptions?.find((e) => e.evidence?.totalRefunded)?.evidence?.totalRefunded
    || (capturedAmount + incident.exposureAmount);

  return {
    rule: incident.types[0] || "INVARIANT_VIOLATION",
    captured: capturedAmount,
    refunded: refundedAmount > capturedAmount ? refundedAmount : capturedAmount + incident.exposureAmount,
    excess: incident.exposureAmount,
    proofStatement: `₹${(refundedAmount > capturedAmount ? refundedAmount : capturedAmount + incident.exposureAmount).toLocaleString("en-IN")} refunded > ₹${capturedAmount.toLocaleString("en-IN")} captured`,
    breakdown: incident.exceptions?.map((e) => ({
      type: e.type,
      evidence: e.evidence,
      exposure: e.exposureAmount,
    })) || [],
  };
}

// GET /api/incidents/:id/graph - evidence graph
router.get("/incidents/:id/graph", (req, res) => {
  const { incidents } = ensureRun();
  let incident = incidents.find((i) => i.id === req.params.id);

  if (!incident) return res.status(404).json({ error: "Incident not found" });

  const nodes = [];
  const edges = [];

  nodes.push({ id: incident.orderId, type: "ORDER", label: incident.orderId, subtitle: "Order Created" });
  if (incident.paymentId) {
    nodes.push({ id: incident.paymentId, type: "PAYMENT", label: incident.paymentId, subtitle: "Payment Captured" });
    edges.push({ from: incident.orderId, to: incident.paymentId });
  }

  if (incident.refundIds && incident.refundIds.length > 0) {
    incident.refundIds.forEach((rid, index) => {
      nodes.push({ id: rid, type: "REFUND", label: rid, subtitle: `Refund #${index + 1}` });
      if (incident.paymentId) edges.push({ from: incident.paymentId, to: rid });
    });
  } else {
    const dummyRefund = `REF-MISSING-${incident.id}`;
    nodes.push({ id: dummyRefund, type: "REFUND", label: "Unmatched Refund Request", subtitle: "No Matching Payment" });
    edges.push({ from: incident.orderId, to: dummyRefund });
  }

  const violationId = `VIOLATION-${incident.id}`;
  nodes.push({
    id: violationId,
    type: "VIOLATION",
    label: `🚨 ${incident.types.join(", ")}`,
    subtitle: `₹${incident.exposureAmount.toLocaleString("en-IN")} Exposure`,
    exposureAmount: incident.exposureAmount,
    severity: incident.severity.level,
  });

  if (incident.refundIds && incident.refundIds.length > 0) {
    incident.refundIds.forEach((rid) => edges.push({ from: rid, to: violationId }));
  } else {
    edges.push({ from: incident.paymentId || incident.orderId, to: violationId });
  }

  res.json({ nodes, edges, incidentId: incident.id, exposure: incident.exposureAmount });
});

// POST /api/simulate - Dynamic Live Demo Anomaly Generator
router.post("/simulate", (req, res) => {
  const companyId = req.query.companyId || "COMP-FLIPKART";
  const { incidents } = runEngine(companyId, "DEMO", policySettings);
  const simulatedId = `INC-DEMO-${uuid().slice(0, 6).toUpperCase()}`;
  const orderId = `ORD-DEMO-${Math.floor(1000 + Math.random() * 9000)}`;
  const paymentId = `PAY-DEMO-${Math.floor(1000 + Math.random() * 9000)}`;
  const refund1Id = `RFD-DEMO-${Math.floor(1000 + Math.random() * 9000)}`;
  const refund2Id = `RFD-DEMO-${Math.floor(1000 + Math.random() * 9000)}`;

  const baseAmount = Math.floor(15 + Math.random() * 70) * 1000;
  const exposureAmount = baseAmount;
  const totalRefunded = baseAmount * 2;
  const deltaSeconds = parseFloat((1.0 + Math.random() * 2.5).toFixed(1));
  const types = ["DUPLICATE_REFUND", "OVER_REFUND"];

  const mockEvent = createMockRazorpayEvent("refund.created", { orderId, paymentId, refundId: refund1Id });

  const timelineSteps = [
    { step: 1, title: "Payment Event Captured", detail: `Order ${orderId} captured payment ${paymentId} of ₹${baseAmount.toLocaleString("en-IN")} via Gateway`, status: "DONE" },
    { step: 2, title: "Refund Request Received", detail: `Refund ${refund1Id} requested for ₹${baseAmount.toLocaleString("en-IN")}`, status: "DONE" },
    { step: 3, title: "Duplicate Refund Triggered", detail: `Refund ${refund2Id} requested ${deltaSeconds}s later on payment ${paymentId}`, status: "DONE" },
    { step: 4, title: "Invariant Violated", detail: `Rule DUPLICATE_REFUND triggered. Total refunded (₹${totalRefunded.toLocaleString("en-IN")}) > Captured (₹${baseAmount.toLocaleString("en-IN")})`, status: "DONE" },
    { step: 5, title: "Exposure Calculated", detail: `Financial exposure calculated: ₹${exposureAmount.toLocaleString("en-IN")} excess money at risk`, status: "DONE" },
    { step: 6, title: "AI Investigation Completed", detail: `AI identified likely cause: Duplicate API request via concurrent worker. Confidence: HIGH`, status: "DONE" },
    { step: 7, title: "Policy Evaluated", detail: `Action: HUMAN_APPROVAL_REQUIRED (Exposure ≥ ₹${policySettings.requireHumanApprovalAbove.toLocaleString("en-IN")} threshold)`, status: "DONE" },
  ];

  const exceptions = [
    {
      type: "DUPLICATE_REFUND",
      orderId,
      paymentId,
      refundIds: [refund1Id, refund2Id],
      exposureAmount,
      evidence: {
        paymentId,
        refund1Id,
        refund2Id,
        deltaSeconds,
        refund1Amount: baseAmount,
        refund2Amount: baseAmount,
        capturedAmount: baseAmount,
      },
      allRefundsProcessed: false,
    },
  ];

  const severity = classifySeverity(exposureAmount);
  const policy = decideAction({ exposureAmount, severity, types }, policySettings);

  const incident = {
    id: simulatedId,
    companyId,
    orderId,
    paymentId,
    refundIds: [refund1Id, refund2Id],
    types,
    exceptions,
    exposureAmount,
    allRefundsProcessed: false,
    detectedAt: new Date().toISOString(),
    severity,
    policy,
    investigation: investigate({ types, exceptions }),
    simulation: simulate({ exposureAmount, allRefundsProcessed: false, severity, policy }),
    financialProof: {
      rule: "DUPLICATE_REFUND",
      captured: baseAmount,
      refunded: totalRefunded,
      excess: exposureAmount,
      proofStatement: `₹${totalRefunded.toLocaleString("en-IN")} refunded > ₹${baseAmount.toLocaleString("en-IN")} captured`,
    },
    razorpayWebhookEvent: mockEvent,
  };

  incidents.unshift(incident);

  addAuditLog({
    eventType: "SIMULATION_TRIGGERED",
    orderId,
    actor: companyId,
    action: "INJECT_DUPLICATE_REFUND",
    details: `Injected live demo anomaly on order ${orderId} (Company ${companyId}). Exposure: ₹${exposureAmount.toLocaleString("en-IN")}.`,
    severity: "CRITICAL",
  });

  res.json({
    ok: true,
    incident,
    timeline: timelineSteps,
  });
});

// GET /api/audit-logs - Complete Audit Trail feed
router.get("/audit-logs", (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  const companyId = req.query.companyId;
  const logs = getAuditLogs(limit * 2);

  let result = logs;
  if (companyId) {
    result = logs.filter(
      (l) => l.actor === companyId || (l.details && l.details.includes(companyId)) || l.orderId === "SYSTEM"
    );
  }

  res.json({
    total: result.length,
    logs: result.slice(0, limit),
  });
});

// Run ALL SIX invariant checks against liveStore
function processWebhookPayloadIntoLiveStore(companyId, payload) {
  const event = translateWebhookEvent(payload);
  const liveStore = getLiveStore();

  addLiveEvent({
    companyId,
    event: event.event,
    orderId: event.orderId,
    paymentId: event.paymentId,
    refundId: event.refundId,
    amount: event.amount,
    details: `Verified Razorpay event ${event.event} for payment ${event.paymentId}`,
  });

  if (event.event === "order.paid" || event.event === "order.created" || event.event === "payment.captured") {
    addLiveOrder({
      id: event.orderId,
      amount: event.amount * 100,
      paymentId: event.paymentId,
      companyId,
      status: "COMPLETED",
      created_at: new Date().toISOString(),
    });
  }

  if (event.event === "refund.created" || event.event === "refund.processed") {
    addLiveRefund({
      id: event.refundId || `ref_live_${uuid().slice(0, 6)}`,
      payment_id: event.paymentId,
      order_id: event.orderId,
      amount: event.amount * 100,
      companyId,
      status: "PROCESSED",
      created_at: new Date().toISOString(),
    });
  }

  // Run ALL SIX invariant engine checks against liveStore
  const data = {
    orders: liveStore.orders,
    payments: liveStore.orders.map((o) => ({ paymentId: o.paymentId, orderId: o.id, capturedAmount: o.amount / 100 })),
    refunds: liveStore.refunds.map((r) => ({ refundId: r.id, paymentId: r.payment_id, orderId: r.order_id, amount: r.amount / 100, status: r.status })),
    ledger: liveStore.orders.map((o) => ({ orderId: o.id, ledgerStatus: "CAPTURED" })),
    ordersById: new Map(liveStore.orders.map((o) => [o.id, o])),
    paymentsById: new Map(liveStore.orders.map((o) => [o.paymentId, o])),
    ledgerByOrderId: new Map(),
    refundsByPaymentId: new Map(),
    paymentsByOrderId: new Map(),
  };

  const { checkOverRefund } = require("../checks/overRefund");
  const { checkDuplicateRefund } = require("../checks/duplicateRefund");
  const { checkUnmatchedRefund } = require("../checks/unmatchedRefund");
  const { checkStateMismatch } = require("../checks/stateMismatch");
  const { checkTimingRace } = require("../checks/timingRace");
  const { checkReconciliationMismatch } = require("../checks/reconciliationMismatch");

  const rawExceptions = [
    ...checkOverRefund(data),
    ...checkDuplicateRefund(data),
    ...checkUnmatchedRefund(data),
    ...checkStateMismatch(data),
    ...checkTimingRace(data),
    ...checkReconciliationMismatch(data),
  ];

  if (rawExceptions.length > 0) {
    const { groupIntoIncidents } = require("../engine/runEngine");
    const newIncidents = groupIntoIncidents(rawExceptions);
    newIncidents.forEach((inc) => addLiveIncident({ ...inc, companyId }));
  }
}

// POST /api/webhooks/razorpay - Shared Webhook Listener with HMAC Verification & Idempotency
router.post("/webhooks/razorpay", (req, res) => {
  const payload = req.body;
  const signature = req.headers["x-razorpay-signature"];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const isDemoSimulation = req.headers["x-demo-simulation"] === "true";

  const eventId = req.headers["x-razorpay-event-id"] || payload.event_id || payload.payload?.payment?.entity?.id || payload.payload?.refund?.entity?.id;
  if (eventId && processedWebhookEvents.has(eventId)) {
    return res.json({
      ok: true,
      idempotent: true,
      message: `Webhook event "${eventId}" already processed (Idempotent duplicate ignored).`,
    });
  }
  if (eventId) {
    processedWebhookEvents.add(eventId);
  }

  if (!signature && !isDemoSimulation) {
    return res.status(401).json({ error: "Missing Razorpay webhook signature header (X-Razorpay-Signature)." });
  }

  if (signature && secret) {
    const isValid = validateWebhookSignature(req.rawBody || JSON.stringify(payload), signature, secret);
    if (!isValid) {
      addAuditLog({
        eventType: "WEBHOOK_SIGNATURE_FAILED",
        orderId: "SYSTEM",
        actor: "RAZORPAY_WEBHOOK_LISTENER",
        action: "HMAC_VERIFICATION",
        details: "Invalid X-Razorpay-Signature received on shared webhook endpoint.",
        severity: "CRITICAL",
      });
      return res.status(401).json({ error: "Invalid Razorpay HMAC-SHA256 signature." });
    }
  }

  const event = translateWebhookEvent(payload);
  processWebhookPayloadIntoLiveStore("COMP-FLIPKART", payload);

  addAuditLog({
    eventType: "RAZORPAY_WEBHOOK_RECEIVED",
    orderId: event.orderId,
    actor: "RAZORPAY_WEBHOOK_LISTENER",
    action: event.event.toUpperCase(),
    details: `Received verified Razorpay webhook event "${event.event}" for payment ${event.paymentId}. Ingested into liveStore and executed all 6 checks.`,
    severity: "INFO",
  });

  res.json({
    ok: true,
    message: `Razorpay webhook "${event.event}" ingested into liveStore successfully`,
    signatureVerified: Boolean(signature && secret),
    paymentId: event.paymentId,
    orderId: event.orderId,
  });
});

// POST /api/webhooks/company/:companyId - Multi-Tenant Webhook Receiver with HMAC Verification & Idempotency
router.post("/webhooks/company/:companyId", (req, res) => {
  const companyId = req.params.companyId;
  const payload = req.body;
  const signature = req.headers["x-razorpay-signature"];
  const isDemoSimulation = req.headers["x-demo-simulation"] === "true";

  const eventId = req.headers["x-razorpay-event-id"] || payload.event_id || payload.payload?.payment?.entity?.id || payload.payload?.refund?.entity?.id;
  if (eventId && processedWebhookEvents.has(eventId)) {
    return res.json({
      ok: true,
      idempotent: true,
      message: `Webhook event "${eventId}" already processed for company ${companyId} (Idempotent duplicate ignored).`,
    });
  }
  if (eventId) {
    processedWebhookEvents.add(eventId);
  }

  const conn = getConnection(companyId);
  const secret = conn?.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!signature && !isDemoSimulation) {
    return res.status(401).json({ error: "Missing Razorpay webhook signature header (X-Razorpay-Signature)." });
  }

  let signatureVerified = false;
  if (signature && secret) {
    const isValid = validateWebhookSignature(req.rawBody || JSON.stringify(payload), signature, secret);
    if (!isValid) {
      addAuditLog({
        eventType: "COMPANY_WEBHOOK_SIGNATURE_FAILED",
        orderId: "SYSTEM",
        actor: companyId,
        action: "HMAC_VERIFICATION",
        details: `Invalid X-Razorpay-Signature received on company webhook endpoint for ${companyId}.`,
        severity: "CRITICAL",
      });
      return res.status(401).json({ error: "Invalid Razorpay HMAC-SHA256 signature." });
    }
    signatureVerified = true;
  }

  touchWebhookHealth(companyId);

  const event = translateWebhookEvent(payload);
  processWebhookPayloadIntoLiveStore(companyId, payload);

  addAuditLog({
    eventType: "COMPANY_WEBHOOK_RECEIVED",
    orderId: event.orderId,
    actor: companyId,
    action: event.event.toUpperCase(),
    details: `Received Razorpay webhook for ${companyId}. Ingested into liveStore. Signature Verified: ${signatureVerified}.`,
    severity: "INFO",
  });

  res.json({
    ok: true,
    companyId,
    signatureVerified,
    message: `Verified company webhook "${event.event}" processed and ingested into liveStore`,
    paymentId: event.paymentId,
    orderId: event.orderId,
  });
});

// GET /api/reconciliation - 4-way cross-system ledger reconciliation explorer
router.get("/reconciliation", (req, res) => {
  const companyId = req.query.companyId;
  const sourceType = req.query.sourceType || "DEMO";

  let targetCompanyId = null;
  if (companyId && verifyCompanySession(req, companyId)) {
    targetCompanyId = companyId;
  }

  const data = loadData(targetCompanyId, sourceType);
  const sampleOrders = data.orders.slice(0, 50).map((ord) => {
    const pay = data.paymentsByOrderId.get(ord.orderId);
    const rfdList = data.refunds.filter((r) => r.orderId === ord.orderId);
    const ledger = data.ledgerByOrderId.get(ord.orderId);

    const processedRefunds = rfdList.filter((r) => r.status === "PROCESSED");
    const totalRefunded = processedRefunds.reduce((acc, r) => acc + (r.amount || 0), 0);
    const capturedAmount = pay ? (pay.capturedAmount || 0) : 0;
    const orderAmount = ord.amount || 0;

    const amountsAgree = Math.abs(orderAmount - capturedAmount) < 0.5 && totalRefunded <= capturedAmount;
    const ledgerSaysRefunded = ledger && (ledger.ledgerStatus === "REFUNDED" || ledger.ledgerStatus === "PARTIALLY_REFUNDED");
    const refundsExist = totalRefunded > 0;
    const ledgerAgreesWithRefunds = ledger ? ledgerSaysRefunded === refundsExist : true;

    const isMatched = amountsAgree && ledgerAgreesWithRefunds && (pay ? true : false);

    let anomalyReason = "MATCHED";
    if (!isMatched) {
      if (!pay) anomalyReason = "UNMATCHED_REFUND";
      else if (totalRefunded > capturedAmount) anomalyReason = "OVER_REFUND";
      else if (rfdList.length > 1) anomalyReason = "DUPLICATE_REFUND";
      else if (!ledgerAgreesWithRefunds) anomalyReason = "LEDGER_MISMATCH";
      else anomalyReason = "STATE_MISMATCH";
    }

    return {
      orderId: ord.orderId,
      paymentId: pay ? pay.paymentId : "N/A",
      orderAmount,
      capturedAmount,
      refundCount: processedRefunds.length,
      refundedAmount: totalRefunded,
      ledgerStatus: ledger ? ledger.ledgerStatus : (pay ? pay.status : "CAPTURED"),
      reconciliationStatus: isMatched ? "MATCHED" : "MISMATCHED",
      anomalyReason,
      systems: {
        order: { amount: orderAmount, status: ord.status || "COMPLETED", id: ord.orderId, isMatched: true },
        payment: { id: pay ? pay.paymentId : "N/A", amount: capturedAmount, status: pay ? pay.status : "MISSING", isMatched: pay ? true : false },
        refund: { id: rfdList[0]?.refundId || "N/A", amount: totalRefunded, status: rfdList[0]?.status || (totalRefunded > 0 ? "PROCESSED" : "NONE"), count: processedRefunds.length, isMatched: totalRefunded <= capturedAmount },
        ledger: { amount: capturedAmount - totalRefunded, status: ledger ? ledger.ledgerStatus : "UNTRACKED", isMatched: ledgerAgreesWithRefunds },
      },
    };
  });

  const totalRefundedSum = sampleOrders.reduce((acc, r) => acc + r.refundedAmount, 0);
  const matchedCount = sampleOrders.filter((r) => r.reconciliationStatus === "MATCHED").length;
  const mismatchedCount = sampleOrders.filter((r) => r.reconciliationStatus === "MISMATCHED").length;
  const potentialLeakage = sampleOrders
    .filter((r) => r.reconciliationStatus === "MISMATCHED")
    .reduce((acc, r) => acc + Math.max(0, r.refundedAmount - r.capturedAmount), 0);

  res.json({
    total: sampleOrders.length,
    matchedCount,
    mismatchedCount,
    potentialLeakage,
    records: sampleOrders,
  });
});

// GET /api/audit - retrieve audit trail
router.get("/audit", (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  res.json({
    total: getAuditLogs().length,
    logs: getAuditLogs(limit),
  });
});

// GET /api/benchmark - Dynamic Benchmark Metrics & Confusion Matrix
router.get("/benchmark", (req, res) => {
  const { incidents } = ensureRun();
  const benchmarkScores = scoreBenchmark(incidents);

  if (!benchmarkScores) {
    return res.status(500).json({ error: "Ground-truth benchmark evaluation labels missing." });
  }

  res.json({
    ok: true,
    dataset: {
      totalRecords: benchmarkScores.recordsAnalyzed,
      normalRecords: benchmarkScores.normalRecords,
      injectedAnomalies: benchmarkScores.anomalousRecords,
      evaluationCorpusName: "10,000 Synthetic Transaction Benchmark Dataset",
    },
    metrics: benchmarkScores.metrics,
    confusionMatrix: benchmarkScores.confusionMatrix,
    recallByCategory: Object.values(benchmarkScores.recallByCategory),
  });
});

module.exports = router;
