/**
 * Check A - Over-refund
 * Total PROCESSED refund amount against a payment exceeds the captured amount.
 */
function checkOverRefund({ payments, refundsByPaymentId }) {
  const exceptions = [];

  for (const payment of payments) {
    const refunds = (refundsByPaymentId.get(payment.paymentId) || []).filter(
      (r) => r.status === "PROCESSED"
    );
    if (refunds.length === 0) continue;

    const totalRefunded = refunds.reduce((sum, r) => sum + r.amount, 0);
    if (totalRefunded > payment.capturedAmount) {
      exceptions.push({
        type: "OVER_REFUND",
        orderId: payment.orderId,
        paymentId: payment.paymentId,
        refundIds: refunds.map((r) => r.refundId),
        exposureAmount: Math.round((totalRefunded - payment.capturedAmount) * 100) / 100,
        description: `Refunded ₹${totalRefunded.toLocaleString(
          "en-IN"
        )} against a captured amount of ₹${payment.capturedAmount.toLocaleString(
          "en-IN"
        )}.`,
        evidence: {
          capturedAmount: payment.capturedAmount,
          totalRefunded,
          refundCount: refunds.length,
        },
        allRefundsProcessed: true,
      });
    }
  }

  return exceptions;
}

module.exports = { checkOverRefund };
