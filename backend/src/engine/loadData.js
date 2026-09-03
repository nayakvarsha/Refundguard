/*
 * ARCHITECTURAL DECISION (DATA SOURCE DECOUPLING):
 * - JSON (orders.json, payments.json, refunds.json, ledger.json): Static 10,000-record benchmark corpus for offline detection scoring & evaluation.
 * - UPLOADS (data/uploads/<companyId>.json): Custom user-imported CSV/JSON datasets for custom merchant analysis.
 * - RAZORPAY: Live ingested webhook transactions.
 * - SQLite (refundguard.sqlite via better-sqlite3): Live application state for users, multi-tenant company connections, live incidents & audit logs.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

function readJson(file) {
  const fullPath = path.join(DATA_DIR, file);
  if (!fs.existsSync(fullPath)) return [];
  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
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
    // Default DEMO benchmark corpus
    orders = readJson("orders.json");
    payments = readJson("payments.json");
    refunds = readJson("refunds.json");
    ledger = readJson("ledger.json");

    if (companyId) {
      orders = orders.filter((o) => o.companyId === companyId);
      payments = payments.filter((p) => p.companyId === companyId);
      refunds = refunds.filter((r) => r.companyId === companyId);
      ledger = ledger.filter((l) => l.companyId === companyId);
    }
  }

  const ordersById = new Map(orders.map((o) => [o.orderId, o]));
  const paymentsById = new Map(payments.map((p) => [p.paymentId, p]));
  const ledgerByOrderId = new Map(ledger.map((l) => [l.orderId, l]));

  const refundsByPaymentId = new Map();
  for (const r of refunds) {
    if (!refundsByPaymentId.has(r.paymentId)) {
      refundsByPaymentId.set(r.paymentId, []);
    }
    refundsByPaymentId.get(r.paymentId).push(r);
  }

  const paymentsByOrderId = new Map();
  for (const p of payments) {
    paymentsByOrderId.set(p.orderId, p);
  }

  return {
    orders,
    payments,
    refunds,
    ledger,
    ordersById,
    paymentsById,
    ledgerByOrderId,
    refundsByPaymentId,
    paymentsByOrderId,
  };
}

module.exports = { loadData };
