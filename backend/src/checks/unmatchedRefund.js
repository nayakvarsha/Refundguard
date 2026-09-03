/**
 * Check C - Unmatched refund
 * A refund record references a paymentId that does not exist in the
 * payments table at all - a dangling/orphaned refund.
 */
function checkUnmatchedRefund({ refunds, paymentsById }) {
  const exceptions = [];

  for (const refund of refunds) {
    if (!paymentsById.has(refund.paymentId)) {
      exceptions.push({
        type: "UNMATCHED_REFUND",
        orderId: refund.orderId,
        paymentId: refund.paymentId,
        refundIds: [refund.refundId],
        exposureAmount: refund.amount,
        description: `Refund ${refund.refundId} references payment ${refund.paymentId}, which does not exist in the payment ledger.`,
        evidence: {
          refundId: refund.refundId,
          referencedPaymentId: refund.paymentId,
          amount: refund.amount,
        },
        allRefundsProcessed: refund.status === "PROCESSED",
      });
    }
  }

  return exceptions;
}

module.exports = { checkUnmatchedRefund };
