/*
 * ARCHITECTURAL DECISION (DATA SOURCE DECOUPLING):
 * - JSON (orders.json, payments.json, refunds.json, ledger.json): Static 10,000-record benchmark corpus for offline detection scoring & evaluation.
 * - UPLOADS (data/uploads/<companyId>.json): Custom user-imported CSV/JSON datasets for custom merchant analysis.
 * - RAZORPAY: Live ingested webhook transactions.
 * - SQLite (refundguard.sqlite via better-sqlite3): Live application state for users, multi-tenant company connections, live incidents & audit logs.
 */

const fs = require("fs");
const path = require("path");
const { generateInMemoryDataset } = require("../data/generateDataset");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

// In-Memory cache for serverless environments (e.g. Vercel)
let inMemoryDatasetCache = null;

function getDemoDataset() {
  const ordersPath = path.join(DATA_DIR, "orders.json");
  if (fs.existsSync(ordersPath)) {
    try {
      return {
        orders: JSON.parse(fs.readFileSync(ordersPath, "utf-8")),
        payments: JSON.parse(fs.readFileSync(path.join(DATA_DIR, "payments.json"), "utf-8")),
        refunds: JSON.parse(fs.readFileSync(path.join(DATA_DIR, "refunds.json"), "utf-8")),
        ledger: JSON.parse(fs.readFileSync(path.join(DATA_DIR, "ledger.json"), "utf-8")),
      };
    } catch (err) {
      console.warn("Could not read disk JSON dataset, using in-memory generator:", err);
    }
  }

  if (!inMemoryDatasetCache) {
    inMemoryDatasetCache = generateInMemoryDataset();
  }
  return inMemoryDatasetCache;
}

/**
 * Loads source-of-truth tables and builds lookup indices based on requested sourceType.
 */
function loadData(companyId = null, sourceType = "DEMO") {
  let orders = [];
  let payments = [];
  let refunds = [];
  let ledger = [];

  if (sourceType === "UPLOADED" && companyId) {
    const uploadFile = path.join(UPLOADS_DIR, `${companyId}.json`);
    if (fs.existsSync(uploadFile)) {
      try {
        const customData = JSON.parse(fs.readFileSync(uploadFile, "utf-8"));
        orders = customData.orders || [];
        payments = customData.payments || [];
        refunds = customData.refunds || [];
        ledger = customData.ledger || [];
      } catch (err) {
        console.error(`Error reading custom upload file for ${companyId}:`, err);
      }
    }
  } else if (sourceType === "RAZORPAY" && companyId) {
    const { getLiveStore } = require("./liveStore");
    const liveStore = getLiveStore();
    orders = liveStore.orders.filter((o) => !o.companyId || o.companyId === companyId);
    refunds = liveStore.refunds.filter((r) => !r.companyId || r.companyId === companyId);
    payments = orders.map((o) => ({
      companyId,
      paymentId: o.paymentId || `PAY-${o.id}`,
      orderId: o.id,
      capturedAmount: (o.amount || 0) / 100,
      status: "CAPTURED",
      createdAt: o.created_at || new Date().toISOString(),
    }));
    ledger = orders.map((o) => ({
      companyId,
      orderId: o.id,
      ledgerStatus: "CAPTURED",
    }));
  } else {
    const demoData = getDemoDataset();
    orders = demoData.orders;
    payments = demoData.payments;
    refunds = demoData.refunds;
    ledger = demoData.ledger;

    if (companyId) {
      orders = orders.filter((o) => o.companyId === companyId);
      const orderIds = new Set(orders.map((o) => o.orderId));
      payments = payments.filter((p) => p.companyId === companyId || orderIds.has(p.orderId));
      refunds = refunds.filter((r) => r.companyId === companyId || orderIds.has(r.orderId));
      ledger = ledger.filter((l) => l.companyId === companyId || orderIds.has(l.orderId));
    }
  }

  // Pre-index by ID for O(1) checks
  const ordersById = new Map();
  orders.forEach((o) => ordersById.set(o.orderId, o));

  const paymentsById = new Map();
  const paymentsByOrderId = new Map();
  payments.forEach((p) => {
    paymentsById.set(p.paymentId, p);
    paymentsByOrderId.set(p.orderId, p);
  });

  const ledgerByOrderId = new Map();
  ledger.forEach((l) => ledgerByOrderId.set(l.orderId, l));

  const refundsByPaymentId = new Map();
  refunds.forEach((r) => {
    if (!refundsByPaymentId.has(r.paymentId)) {
      refundsByPaymentId.set(r.paymentId, []);
    }
    refundsByPaymentId.get(r.paymentId).push(r);
  });

  return {
    orders,
    payments,
    refunds,
    ledger,
    ordersById,
    paymentsById,
    paymentsByOrderId,
    ledgerByOrderId,
    refundsByPaymentId,
  };
}

module.exports = { loadData };
