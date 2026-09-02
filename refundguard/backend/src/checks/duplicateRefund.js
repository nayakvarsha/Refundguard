/**
 * Check B - Duplicate refund
 * Same payment, same (or near-identical) amount, requested within a short
 * window of each other - a strong signature of a retried/duplicated request
 * rather than two intentional separate refunds.
 */
const DUPLICATE_WINDOW_MS = 10 * 1000; // 10 seconds
const AMOUNT_TOLERANCE = 0.01; // 1%

function checkDuplicateRefund({ payments, refundsByPaymentId }) {
  const exceptions = [];

  for (const payment of payments) {
    const refunds = (refundsByPaymentId.get(payment.paymentId) || [])
      .slice()
      .sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt));

    for (let i = 0; i < refunds.length; i++) {
      for (let j = i + 1; j < refunds.length; j++) {
        const a = refunds[i];
        const b = refunds[j];
        const deltaMs = Math.abs(
          new Date(b.requestedAt) - new Date(a.requestedAt)
        );
        if (deltaMs > DUPLICATE_WINDOW_MS) break; // sorted, so no later pair will be closer

        const amountDiff = Math.abs(a.amount - b.amount) / Math.max(a.amount, b.amount);
        if (amountDiff <= AMOUNT_TOLERANCE) {
          exceptions.push({
            type: "DUPLICATE_REFUND",
            orderId: payment.orderId,
            paymentId: payment.paymentId,
            refundIds: [a.refundId, b.refundId],
            exposureAmount: Math.round(Math.min(a.amount, b.amount) * 100) / 100,
            description: `Two refund requests of ~₹${a.amount.toLocaleString(
              "en-IN"
            )} were made ${(deltaMs / 1000).toFixed(
              1
            )}s apart on the same payment.`,
            evidence: {
              refundA: { id: a.refundId, amount: a.amount, requestedAt: a.requestedAt },
              refundB: { id: b.refundId, amount: b.amount, requestedAt: b.requestedAt },
              deltaSeconds: Math.round(deltaMs / 100) / 10,
            },
            allRefundsProcessed: a.status === "PROCESSED" && b.status === "PROCESSED",
          });
        }
      }
    }
  }

  return exceptions;
}

module.exports = { checkDuplicateRefund };
