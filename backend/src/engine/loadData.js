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

// In-Memory cache for uploaded datasets and demo corpus across serverless environments
let inMemoryDatasetCache = null;
const uploadedDataStore = new Map(); // companyId -> payload

function saveUploadData(companyId, uploadPayload) {
  if (!companyId || !uploadPayload) return;
  uploadedDataStore.set(companyId, uploadPayload);
  const cleanId = String(companyId).toLowerCase().trim();
  uploadedDataStore.set(cleanId, uploadPayload);

  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, `${companyId}.json`), JSON.stringify(uploadPayload, null, 2));
  } catch (e) {}
}

function getUploadData(companyId) {
  if (!companyId) return null;
  if (uploadedDataStore.has(companyId)) return uploadedDataStore.get(companyId);
  const cleanId = String(companyId).toLowerCase().trim();
  if (uploadedDataStore.has(cleanId)) return uploadedDataStore.get(cleanId);

  const uploadFile = path.join(UPLOADS_DIR, `${companyId}.json`);
  if (fs.existsSync(uploadFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(uploadFile, "utf-8"));
      uploadedDataStore.set(companyId, data);
      return data;
    } catch (e) {}
  }

  // Fallback: return the most recently uploaded dataset if companyId doesn't match exactly
  if (uploadedDataStore.size > 0) {
    return Array.from(uploadedDataStore.values())[uploadedDataStore.size - 1];
  }
  return null;
}

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

  const uploadedData = companyId ? getUploadData(companyId) : getUploadData("ANY");

  if (sourceType === "UPLOADED" || (uploadedData && sourceType === "UPLOADED")) {
    if (uploadedData) {
      orders = uploadedData.orders || [];
      payments = uploadedData.payments || [];
      refunds = uploadedData.refunds || [];
      ledger = uploadedData.ledger || [];
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
    // sourceType === 'DEMO' or fallback
    if (uploadedData && uploadedData.orders && uploadedData.orders.length > 0) {
      orders = uploadedData.orders;
      payments = uploadedData.payments;
      refunds = uploadedData.refunds;
      ledger = uploadedData.ledger;
    } else {
      const demoData = getDemoDataset();
      orders = demoData.orders;
      payments = demoData.payments;
      refunds = demoData.refunds;
      ledger = demoData.ledger;

      if (companyId) {
        const filteredOrders = orders.filter((o) => o.companyId === companyId);
        if (filteredOrders.length > 0) {
          orders = filteredOrders;
          const orderIds = new Set(orders.map((o) => o.orderId));
          payments = payments.filter((p) => p.companyId === companyId || orderIds.has(p.orderId));
          refunds = refunds.filter((r) => r.companyId === companyId || orderIds.has(r.orderId));
          ledger = ledger.filter((l) => l.companyId === companyId || orderIds.has(l.orderId));
        }
        // If filteredOrders.length === 0, keep full demo dataset so user sees demo data!
      }
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

module.exports = { loadData, saveUploadData, getUploadData };
