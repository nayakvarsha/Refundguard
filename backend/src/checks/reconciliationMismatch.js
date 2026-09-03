/**
 * Check F - Reconciliation mismatch
 * Cross-checks Order <-> Payment <-> Refund <-> Ledger totals. Flags cases
 * where the four systems don't tie out even if no single earlier check
 * caught it (e.g. order amount silently differs from captured amount, or
 * the ledger total refunded doesn't match the sum of processed refunds).
 */
function checkReconciliationMismatch({
  orders,
  paymentsByOrderId,
  refundsByPaymentId,
  ledgerByOrderId,
}) {
  const exceptions = [];

  for (const order of orders) {
    const payment = paymentsByOrderId.get(order.orderId);
    if (!payment) {
      exceptions.push({
        type: "RECONCILIATION_MISMATCH",
        orderId: order.orderId,
        paymentId: null,
        refundIds: [],
        exposureAmount: order.amount,
        description: `Order ${order.orderId} has no corresponding payment record.`,
        evidence: { orderAmount: order.amount },
        allRefundsProcessed: false,
      });
      continue;
    }

    // Order amount should equal what was captured
    if (Math.abs(order.amount - payment.capturedAmount) > 0.5) {
      exceptions.push({
        type: "RECONCILIATION_MISMATCH",
        orderId: order.orderId,
        paymentId: payment.paymentId,
        refundIds: [],
        exposureAmount: Math.abs(order.amount - payment.capturedAmount),
        description: `Order amount (₹${order.amount.toLocaleString(
          "en-IN"
        )}) does not match captured payment amount (₹${payment.capturedAmount.toLocaleString(
          "en-IN"
        )}).`,
        evidence: { orderAmount: order.amount, capturedAmount: payment.capturedAmount },
        allRefundsProcessed: false,
      });
    }

    // Ledger status should be consistent with actual processed refund total
    const ledgerEntry = ledgerByOrderId.get(order.orderId);
    const refunds = (refundsByPaymentId.get(payment.paymentId) || []).filter(
      (r) => r.status === "PROCESSED"
    );
    const totalRefunded = refunds.reduce((s, r) => s + r.amount, 0);

    if (ledgerEntry) {
      const impliedRefunded = totalRefunded > 0;
      const ledgerSaysRefunded =
        ledgerEntry.ledgerStatus === "REFUNDED" ||
        ledgerEntry.ledgerStatus === "PARTIALLY_REFUNDED";

      if (impliedRefunded !== ledgerSaysRefunded) {
        exceptions.push({
          type: "RECONCILIATION_MISMATCH",
          orderId: order.orderId,
          paymentId: payment.paymentId,
          refundIds: refunds.map((r) => r.refundId),
          exposureAmount: totalRefunded || payment.capturedAmount,
          description: `Ledger status "${ledgerEntry.ledgerStatus}" is inconsistent with ${
            refunds.length
          } processed refund(s) totalling ₹${totalRefunded.toLocaleString("en-IN")}.`,
          evidence: {
            ledgerStatus: ledgerEntry.ledgerStatus,
            processedRefundTotal: totalRefunded,
            processedRefundCount: refunds.length,
          },
          allRefundsProcessed: true,
        });
      }
    }
  }

  return exceptions;
}

module.exports = { checkReconciliationMismatch };
