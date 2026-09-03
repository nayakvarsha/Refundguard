/**
 * Generates a synthetic 10,000-record benchmark:
 *   9000 normal | 250 duplicate | 200 over-refund | 200 unmatched
 *   150 state-mismatch | 200 timing/race
 *
 * Output (backend/data/*.json):
 *   orders.json    - order records
 *   payments.json  - payment/capture records
 *   refunds.json   - refund request/processing records
 *   ledger.json    - merchant ledger snapshot per order
 *   labels.json    - ground-truth category per order
 */
const fs = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");
const { makeRng } = require("../utils/rng");

const OUT_DIR = path.join(__dirname, "..", "..", "data");
const TOTAL = 10000;
const COUNTS = {
  normal: 9000,
  duplicate: 250,
  overRefund: 200,
  unmatched: 200,
  stateMismatch: 150,
  timingRace: 200,
};

function buildCategoryList() {
  const list = [];
  Object.entries(COUNTS).forEach(([cat, n]) => {
    for (let i = 0; i < n; i++) list.push(cat);
  });
  return list;
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateInMemoryDataset(seed = 42) {
  const rng = makeRng(seed);
  const categories = shuffle(buildCategoryList(), rng);

  const orders = [];
  const payments = [];
  const refunds = [];
  const ledger = [];
  const labels = [];

  const baseTime = new Date("2026-06-01T00:00:00Z").getTime();

  for (let i = 0; i < TOTAL; i++) {
    const category = categories[i];
    const companyId = i < 8000 ? "COMP-FLIPKART" : "COMP-MYNTRA";
    const orderId = `ORD-${String(i + 1).padStart(6, "0")}`;
    const orderAmount = rng.amount(500, 100000);
    const orderCreatedAt = new Date(baseTime + i * 60000).toISOString();

    orders.push({
      companyId,
      orderId,
      amount: orderAmount,
      status: "COMPLETED",
      createdAt: orderCreatedAt,
    });

    const paymentId = `PAY-${String(i + 1).padStart(6, "0")}`;
    let paymentStatus = category === "stateMismatch" ? "PROCESSING" : "CAPTURED";
    
    // For unmatched refund, do not include paymentId in payments table!
    if (category !== "unmatched") {
      payments.push({
        companyId,
        paymentId,
        orderId,
        capturedAmount: orderAmount,
        status: paymentStatus,
        createdAt: orderCreatedAt,
      });
    }

    let ledgerStatus = "CAPTURED";

    switch (category) {
      case "normal": {
        const wantsRefund = rng.float() < 0.55;
        if (wantsRefund) {
          const refundAmount = rng.amount(
            Math.round(orderAmount * 0.1),
            orderAmount
          );
          const reqTime = baseTime + i * 60000 + rng.int(3600000, 172800000);
          refunds.push({
            companyId,
            refundId: `REF-${uuid().slice(0, 8).toUpperCase()}`,
            paymentId,
            orderId,
            amount: refundAmount,
            status: "PROCESSED",
            requestedAt: new Date(reqTime).toISOString(),
            processedAt: new Date(reqTime + 5000).toISOString(),
          });
          ledgerStatus =
            refundAmount >= orderAmount ? "REFUNDED" : "PARTIALLY_REFUNDED";
        }
        break;
      }

      case "duplicate": {
        const refundAmount = rng.amount(
          Math.round(orderAmount * 0.3),
          orderAmount
        );
        const reqTime = baseTime + i * 60000 + rng.int(3600000, 172800000);
        const caughtInTime = rng.float() < 0.3;
        for (let k = 0; k < 2; k++) {
          const t = reqTime + k * rng.int(500, 2000);
          const isSecondLeg = k === 1;
          refunds.push({
            companyId,
            refundId: `REF-${uuid().slice(0, 8).toUpperCase()}`,
            paymentId,
            orderId,
            amount: refundAmount,
            status: isSecondLeg && caughtInTime ? "PROCESSING" : "PROCESSED",
            requestedAt: new Date(t).toISOString(),
            processedAt:
              isSecondLeg && caughtInTime
                ? null
                : new Date(t + 2000).toISOString(),
          });
        }
        ledgerStatus = caughtInTime ? "PARTIALLY_REFUNDED" : "REFUNDED";
        break;
      }

      case "overRefund": {
        const totalToRefund = rng.amount(
          Math.round(orderAmount * 1.1),
          Math.round(orderAmount * 1.8)
        );
        const reqTime = baseTime + i * 60000 + rng.int(3600000, 172800000);
        refunds.push({
          companyId,
          refundId: `REF-${uuid().slice(0, 8).toUpperCase()}`,
          paymentId,
          orderId,
          amount: totalToRefund,
          status: "PROCESSED",
          requestedAt: new Date(reqTime).toISOString(),
          processedAt: new Date(reqTime + 3000).toISOString(),
        });
        ledgerStatus = "REFUNDED";
        break;
      }

      case "unmatched": {
        const reqTime = baseTime + i * 60000 + rng.int(3600000, 172800000);
        const phantomPaymentId = `PAY-PHANTOM-${uuid().slice(0, 8).toUpperCase()}`;
        refunds.push({
          companyId,
          refundId: `REF-${uuid().slice(0, 8).toUpperCase()}`,
          paymentId: phantomPaymentId,
          orderId: orderId,
          amount: orderAmount,
          status: "PROCESSED",
          requestedAt: new Date(reqTime).toISOString(),
          processedAt: new Date(reqTime + 4000).toISOString(),
        });
        break;
      }

      case "stateMismatch": {
        const refundAmount = rng.amount(
          Math.round(orderAmount * 0.2),
          orderAmount
        );
        const reqTime = baseTime + i * 60000 + rng.int(3600000, 172800000);
        refunds.push({
          companyId,
          refundId: `REF-${uuid().slice(0, 8).toUpperCase()}`,
          paymentId,
          orderId,
          amount: refundAmount,
          status: "PROCESSED",
          requestedAt: new Date(reqTime).toISOString(),
          processedAt: new Date(reqTime + 2000).toISOString(),
        });
        ledgerStatus = "REFUNDED"; // Contradicts payment status "PROCESSING"!
        break;
      }

      case "timingRace": {
        const t = baseTime + i * 60000 + rng.int(3600000, 172800000);
        const amt1 = rng.amount(
          Math.round(orderAmount * 0.2),
          Math.round(orderAmount * 0.5)
        );
        const amt2 = rng.amount(
          Math.round(orderAmount * 0.2),
          Math.round(orderAmount * 0.5)
        );
        const caughtInTime = rng.float() < 0.3;
        refunds.push({
          companyId,
          refundId: `REF-${uuid().slice(0, 8).toUpperCase()}`,
          paymentId,
          orderId,
          amount: amt1,
          status: "PROCESSED",
          requestedAt: new Date(t).toISOString(),
          processedAt: new Date(t + 1200).toISOString(),
        });
        refunds.push({
          companyId,
          refundId: `REF-${uuid().slice(0, 8).toUpperCase()}`,
          paymentId,
          orderId,
          amount: amt2,
          status: caughtInTime ? "PROCESSING" : "PROCESSED",
          requestedAt: new Date(t + rng.int(200, 1500)).toISOString(),
          processedAt: caughtInTime ? null : new Date(t + 1800).toISOString(),
        });
        ledgerStatus =
          amt1 + amt2 >= orderAmount
            ? caughtInTime
              ? "PARTIALLY_REFUNDED"
              : "REFUNDED"
            : "PARTIALLY_REFUNDED";
        break;
      }
    }

    ledger.push({ companyId, orderId, ledgerStatus });
    labels.push({ companyId, orderId, category });
  }

  return { orders, payments, refunds, ledger, labels };
}

function generate(seed = 42) {
  const data = generateInMemoryDataset(seed);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "orders.json"), JSON.stringify(data.orders));
  fs.writeFileSync(path.join(OUT_DIR, "payments.json"), JSON.stringify(data.payments));
  fs.writeFileSync(path.join(OUT_DIR, "refunds.json"), JSON.stringify(data.refunds));
  fs.writeFileSync(path.join(OUT_DIR, "ledger.json"), JSON.stringify(data.ledger));
  fs.writeFileSync(path.join(OUT_DIR, "labels.json"), JSON.stringify(data.labels));

  console.log(`Generated ${data.orders.length} orders, ${data.payments.length} payments, ${data.refunds.length} refunds`);
}

if (require.main === module) {
  generate();
}

module.exports = { generate, generateInMemoryDataset, COUNTS };
