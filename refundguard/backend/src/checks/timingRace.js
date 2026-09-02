/**
 * Check E - Timing / race-condition detection
 * Two refund requests on the same payment processed within a very tight
 * window (regardless of amount) - a signature of concurrent/racing writes
 * that could bypass a naive "already refunded" guard.
 */
const RACE_WINDOW_MS = 3 * 1000; // 3 seconds

function checkTimingRace({ payments, refundsByPaymentId }) {
  const exceptions = [];

  for (const payment of payments) {
    const refunds = (refundsByPaymentId.get(payment.paymentId) || [])
      .slice()
      .sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt));

    for (let i = 0; i < refunds.length - 1; i++) {
      const a = refunds[i];
      const b = refunds[i + 1];
      const deltaMs = Math.abs(new Date(b.requestedAt) - new Date(a.requestedAt));

      const bothSettledOrSettling =
        (a.status === "PROCESSED" || a.status === "PROCESSING") &&
        (b.status === "PROCESSED" || b.status === "PROCESSING");

      if (deltaMs <= RACE_WINDOW_MS && bothSettledOrSettling) {
        exceptions.push({
          type: "TIMING_RACE",
          orderId: payment.orderId,
          paymentId: payment.paymentId,
          refundIds: [a.refundId, b.refundId],
          exposureAmount: Math.round((a.amount + b.amount) * 100) / 100,
          description: `Refund requests ${a.refundId} and ${b.refundId} were both processed within ${(
            deltaMs / 1000
          ).toFixed(1)}s of each other, indicating a possible race condition.`,
          evidence: {
            refundA: { id: a.refundId, amount: a.amount, requestedAt: a.requestedAt, processedAt: a.processedAt },
            refundB: { id: b.refundId, amount: b.amount, requestedAt: b.requestedAt, processedAt: b.processedAt },
            deltaSeconds: Math.round(deltaMs / 100) / 10,
          },
          allRefundsProcessed: a.status === "PROCESSED" && b.status === "PROCESSED",
        });
      }
    }
  }

  return exceptions;
}

module.exports = { checkTimingRace };
