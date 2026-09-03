/**
 * Razorpay Test Mode Service Layer
 * Abstracts webhook event ingestion and test mode transactions.
 */

const { v4: uuid } = require("uuid");

function createMockRazorpayEvent(eventType = "refund.created", customData = {}) {
  const orderId = customData.orderId || `ord_test_${uuid().slice(0, 8)}`;
  const paymentId = customData.paymentId || `pay_test_${uuid().slice(0, 8)}`;
  const refundId = customData.refundId || `rfd_test_${uuid().slice(0, 8)}`;
  const amount = customData.amount || 3000000; // in paise (₹30,000)

  return {
    entity: "event",
    account_id: "acc_demo_store_rzp",
    event: eventType,
    contains: ["refund", "payment"],
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: orderId,
          amount: amount,
          currency: "INR",
          status: "captured",
          method: "card",
          captured: true,
          created_at: Math.floor(Date.now() / 1000) - 10,
        },
      },
      refund: {
        entity: {
          id: refundId,
          payment_id: paymentId,
          amount: amount,
          currency: "INR",
          status: "processed",
          speed_processed: "instant",
          created_at: Math.floor(Date.now() / 1000),
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  };
}

module.exports = {
  createMockRazorpayEvent,
};
