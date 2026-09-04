const express = require("express");
const crypto = require("crypto");
const { getRazorpayClient } = require("../services/razorpayClient");
const { getConnection } = require("../services/dbService");
const { getLiveStore, resetLiveStore, addLiveOrder, addLiveRefund, addLiveIncident, addLiveEvent } = require("../engine/liveStore");
const { addAuditLog } = require("../services/auditService");
const { classifySeverity } = require("../engine/severity");
const { decideAction } = require("../engine/policyEngine");

const router = express.Router();

// GET /api/live/incidents - Live detected incidents list
router.get("/incidents", (req, res) => {
  const store = getLiveStore();
  res.json({
    total: store.incidents.length,
    incidents: store.incidents,
  });
});

// GET /api/live/events - Live raw webhook event feed
router.get("/events", (req, res) => {
  const store = getLiveStore();
  res.json({
    total: store.events.length,
    events: store.events,
  });
});

// POST /api/live/reset - Reset in-memory live data for clean demo presentation
router.post("/reset", (req, res) => {
  resetLiveStore();
  addAuditLog({
    eventType: "LIVE_STORE_RESET",
    orderId: "SYSTEM",
    actor: "USER_ACTION",
    action: "RESET_LIVE_STORE",
    details: "Cleared live Razorpay in-memory event store and incident buffer.",
    severity: "INFO",
  });
  res.json({ ok: true, message: "Live detection store reset successfully" });
});

// POST /api/live/create-order - Create real Razorpay test order via API keys (with simulation fallback)
router.post("/create-order", async (req, res) => {
  const companyId = req.body.companyId || "COMP-FLIPKART";
  const razorpay = getRazorpayClient(companyId);
  const conn = getConnection(companyId);

  const activeKeyId = (conn && conn.razorpayKeyId && !conn.razorpayKeyId.includes("flipkart") && !conn.razorpayKeyId.includes("myntra"))
    ? conn.razorpayKeyId
    : (process.env.RAZORPAY_KEY_ID || "rzp_test_TXcdzwvOAnj7lr");

  const amount = req.body.amount || 50000; // in paise (e.g. ₹500.00)
  const currency = "INR";
  const receipt = `rcpt_${Date.now().toString().slice(-6)}`;

  let order;
  let isSimulated = false;

  if (razorpay) {
    try {
      order = await razorpay.orders.create({ amount, currency, receipt, payment_capture: 1 });
    } catch (err) {
      console.warn("Razorpay API order creation failed, falling back to simulated order:", err.message || err);
      isSimulated = true;
    }
  } else {
    isSimulated = true;
  }

  if (isSimulated || !order) {
    const simOrderId = `order_sim_${Date.now().toString().slice(-8)}`;
    order = {
      id: simOrderId,
      entity: "order",
      amount,
      amount_paid: 0,
      amount_due: amount,
      currency,
      receipt,
      status: "created",
      attempts: 0,
      notes: [],
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  // Attach companyId to live order record
  addLiveOrder({
    ...order,
    companyId,
  });

  addLiveEvent({
    companyId,
    event: "order.created",
    orderId: order.id,
    amount: amount / 100,
    details: `Razorpay Order ${order.id} created for ₹${amount / 100} for ${companyId} ${isSimulated ? '(Simulated Mode)' : '(Live Razorpay)'}`,
  });

  res.json({
    ok: true,
    companyId,
    key_id: activeKeyId,
    isSimulated,
    order,
  });
});

// POST /api/live/verify-payment - Backend HMAC-SHA256 Payment Checkout Verification
router.post("/verify-payment", (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, companyId = "COMP-FLIPKART" } = req.body;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.status(400).json({ error: "Missing required Checkout verification parameters." });
  }

  const conn = getConnection(companyId);
  const secret = conn?.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    return res.status(400).json({ error: "Razorpay Key Secret not configured for payment verification." });
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      addAuditLog({
        eventType: "PAYMENT_VERIFICATION_FAILED",
        orderId: razorpay_order_id,
        actor: companyId,
        action: "VERIFY_PAYMENT_SIGNATURE",
        details: `Invalid Checkout signature detected for payment ${razorpay_payment_id}.`,
        severity: "CRITICAL",
      });

      return res.status(401).json({
        ok: false,
        verified: false,
        error: "Invalid payment signature verification.",
      });
    }

    addAuditLog({
      eventType: "PAYMENT_VERIFIED",
      orderId: razorpay_order_id,
      actor: companyId,
      action: "VERIFY_PAYMENT_SIGNATURE",
      details: `Payment ${razorpay_payment_id} independently verified on backend via HMAC-SHA256 signature for ${companyId}.`,
      severity: "INFO",
    });

    res.json({
      ok: true,
      verified: true,
      companyId,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      message: "Payment captured and independently verified on backend.",
    });
  } catch (err) {
    console.error("Payment verification error:", err);
    res.status(500).json({ error: "Internal payment verification error: " + err.message });
  }
});

// POST /api/live/refund - Issue real Razorpay refund on a payment
router.post("/refund", async (req, res) => {
  const { companyId = "COMP-FLIPKART", paymentId, amount, speed } = req.body;
  const razorpay = getRazorpayClient(companyId);
  if (!razorpay) {
    return res.status(400).json({
      error: "Razorpay API keys not configured",
      message: "Please configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env to issue real refunds.",
    });
  }

  if (!paymentId) {
    return res.status(400).json({ error: "Missing paymentId parameter" });
  }

  try {
    const refundOptions = { amount: amount ? amount * 100 : undefined, speed: speed || "optimum" };
    const refund = await razorpay.payments.refund(paymentId, refundOptions);
    
    // Item 4: Attach companyId to live refund record
    addLiveRefund({
      ...refund,
      companyId,
    });

    addLiveEvent({
      companyId,
      event: "refund.processed",
      orderId: refund.order_id || "N/A",
      paymentId,
      refundId: refund.id,
      amount: (refund.amount || 0) / 100,
      details: `Razorpay Refund ${refund.id} processed for payment ${paymentId} (${companyId})`,
    });

    res.json({ ok: true, companyId, refund });
  } catch (err) {
    console.error("Razorpay Refund Error:", err);
    res.status(500).json({
      error: "Razorpay Refund Error",
      message: err.description || err.message || "Failed to process refund via Razorpay API",
    });
  }
});

// POST /api/live/trigger-duplicate - Trigger back-to-back duplicate refunds on a payment
router.post("/trigger-duplicate", async (req, res) => {
  const { companyId = "COMP-FLIPKART", paymentId, orderId, amount = 500 } = req.body;
  const razorpay = getRazorpayClient(companyId);

  if (!paymentId) {
    return res.status(400).json({ error: "Missing paymentId parameter" });
  }

  if (!razorpay) {
    return res.status(400).json({
      error: "Razorpay not configured",
      message: "Cannot run a live test without real API keys configured.",
    });
  }

  let actualRefund1 = null;
  let actualRefund2 = null;
  let refund2Blocked = false;

  try {
    actualRefund1 = await razorpay.payments.refund(paymentId, { amount: amount * 100 });
    addLiveRefund({ ...actualRefund1, companyId });
  } catch (e) {
    return res.status(502).json({
      error: "Razorpay refund failed",
      message: `First refund attempt failed at gateway: ${e.message}`,
      gatewayError: e,
    });
  }

  try {
    actualRefund2 = await razorpay.payments.refund(paymentId, { amount: amount * 100 });
    addLiveRefund({ ...actualRefund2, companyId });
  } catch (e) {
    refund2Blocked = true;
    actualRefund2 = { id: `rfd_blocked_${Date.now()}`, status: "blocked", gatewayReason: e.message };
  }

  const rfd1Id = actualRefund1.id;
  const rfd2Id = actualRefund2.id;
  const simulatedId = `INC-LIVE-${Date.now().toString().slice(-6)}`;
  const capturedAmount = amount;

  const outcome = refund2Blocked ? "GATEWAY_BLOCKED" : "REFUNDGUARD_CAUGHT";
  const exposureAmount = refund2Blocked ? amount : amount * 2;

  const incident = {
    id: simulatedId,
    companyId,
    orderId,
    paymentId,
    refundIds: [rfd1Id, rfd2Id],
    types: ["DUPLICATE_REFUND", "OVER_REFUND"],
    exposureAmount,
    allRefundsProcessed: !refund2Blocked,
    detectedAt: new Date().toISOString(),
    severity: classifySeverity(exposureAmount),
    policy: decideAction({ exposureAmount, severity: classifySeverity(exposureAmount), types: ["DUPLICATE_REFUND", "OVER_REFUND"] }),
    exceptions: [
      {
        type: "DUPLICATE_REFUND",
        orderId,
        paymentId,
        refundIds: [rfd1Id, rfd2Id],
        exposureAmount,
        evidence: { paymentId, refund1Id: rfd1Id, refund2Id: rfd2Id, capturedAmount },
      },
    ],
  };

  addLiveIncident(incident);

  addLiveEvent({
    companyId,
    event: "duplicate.refund.attempted",
    orderId,
    paymentId,
    refundId: rfd2Id,
    amount,
    details: refund2Blocked
      ? `Second refund attempt blocked by Razorpay gateway anti-fraud check (${actualRefund2.gatewayReason})`
      : `CRITICAL: Both duplicate refunds processed! Exposure: ₹${exposureAmount}`,
  });

  res.json({
    ok: true,
    companyId,
    outcome,
    incident,
    refund1: actualRefund1,
    refund2: actualRefund2,
    refund2Blocked,
    message: refund2Blocked
      ? "Gateway anti-fraud check blocked the 2nd refund attempt. RefundGuard caught the anomaly."
      : "BACKEND ERROR: Gateway allowed duplicate refund! RefundGuard flagged ₹" + exposureAmount + " exposure.",
  });
});

// POST /api/live/trigger-over-refund - Trigger different-sized over-refund attack
router.post("/trigger-over-refund", async (req, res) => {
  const { companyId = "COMP-FLIPKART", paymentId, orderId, capturedAmount = 500, firstAmount = 300, secondAmount = 350 } = req.body;
  const razorpay = getRazorpayClient(companyId);

  if (!paymentId) {
    return res.status(400).json({ error: "Missing paymentId parameter" });
  }

  if (!razorpay) {
    return res.status(400).json({
      error: "Razorpay not configured",
      message: "Cannot run a live test without real API keys configured.",
    });
  }

  let actualRefund1 = null;
  let actualRefund2 = null;
  let refund2Blocked = false;

  try {
    actualRefund1 = await razorpay.payments.refund(paymentId, { amount: firstAmount * 100 });
    addLiveRefund({ ...actualRefund1, companyId });
  } catch (e) {
    return res.status(502).json({
      error: "Razorpay first refund failed",
      message: `First refund attempt failed at gateway: ${e.message}`,
      gatewayError: e,
    });
  }

  try {
    actualRefund2 = await razorpay.payments.refund(paymentId, { amount: secondAmount * 100 });
    addLiveRefund({ ...actualRefund2, companyId });
  } catch (e) {
    refund2Blocked = true;
    actualRefund2 = { id: `rfd_blocked_${Date.now()}`, status: "blocked", gatewayReason: e.message };
  }

  const totalRefunded = firstAmount + (refund2Blocked ? 0 : secondAmount);
  const exposureAmount = Math.max(0, totalRefunded - capturedAmount);
  const simulatedId = `INC-OVER-${Date.now().toString().slice(-6)}`;
  const outcome = refund2Blocked ? "GATEWAY_BLOCKED" : "REFUNDGUARD_CAUGHT";

  const incident = {
    id: simulatedId,
    companyId,
    orderId: orderId || "ORD-LIVE-OVER",
    paymentId,
    refundIds: [actualRefund1.id, actualRefund2.id],
    types: ["OVER_REFUND"],
    exposureAmount,
    allRefundsProcessed: !refund2Blocked,
    detectedAt: new Date().toISOString(),
    severity: classifySeverity(exposureAmount),
    policy: decideAction({ exposureAmount, severity: classifySeverity(exposureAmount), types: ["OVER_REFUND"] }),
    exceptions: [
      {
        type: "OVER_REFUND",
        orderId: orderId || "ORD-LIVE-OVER",
        paymentId,
        refundIds: [actualRefund1.id, actualRefund2.id],
        exposureAmount,
        evidence: { paymentId, refund1Id: actualRefund1.id, refund2Id: actualRefund2.id, capturedAmount, totalRefunded },
      },
    ],
  };

  addLiveIncident(incident);

  addLiveEvent({
    companyId,
    event: "over_refund.attempted",
    orderId: orderId || "ORD-LIVE-OVER",
    paymentId,
    refundId: actualRefund2.id,
    amount: secondAmount,
    details: refund2Blocked
      ? `Second over-refund attempt blocked by Razorpay gateway`
      : `CRITICAL: Over-refund processed! Total (₹${totalRefunded}) > Captured (₹${capturedAmount}). Exposure: ₹${exposureAmount}`,
  });

  res.json({
    ok: true,
    companyId,
    outcome,
    incident,
    refund1: actualRefund1,
    refund2: actualRefund2,
    refund2Blocked,
    exposureAmount,
    message: refund2Blocked
      ? "Gateway anti-fraud check blocked over-refund."
      : `RefundGuard flagged ₹${exposureAmount} over-refund leakage!`,
  });
});

module.exports = router;
