/**
 * Check D - State mismatch
 * Merchant ledger status disagrees with the payment record's status in a
 * way that implies money moved (or didn't) without both systems agreeing.
 */
const CONFLICTING_STATES = new Set([
  "REFUNDED:PROCESSING",
  "PARTIALLY_REFUNDED:PROCESSING",
  "REFUNDED:FAILED",
]);

function checkStateMismatch({ orders, ledgerByOrderId, paymentsByOrderId }) {
  const exceptions = [];

  for (const order of orders) {
    const ledgerEntry = ledgerByOrderId.get(order.orderId);
    const payment = paymentsByOrderId.get(order.orderId);
    if (!ledgerEntry || !payment) continue;

    const key = `${ledgerEntry.ledgerStatus}:${payment.status}`;
    if (CONFLICTING_STATES.has(key)) {
      exceptions.push({
        type: "STATE_MISMATCH",
        orderId: order.orderId,
        paymentId: payment.paymentId,
        refundIds: [],
        exposureAmount: payment.capturedAmount,
        description: `Merchant ledger shows "${ledgerEntry.ledgerStatus}" but the payment record shows "${payment.status}" for the same order.`,
        evidence: {
          ledgerStatus: ledgerEntry.ledgerStatus,
          paymentStatus: payment.status,
          capturedAmount: payment.capturedAmount,
        },
        allRefundsProcessed: false,
      });
    }
  }

  return exceptions;
}

module.exports = { checkStateMismatch };
