const crypto = require("crypto");

/**
 * Validates Razorpay Webhook HMAC SHA256 signature
 */
function validateWebhookSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  try {
    const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString("utf-8") : String(rawBody || "");
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(bodyString)
      .digest("hex");

    const sigBuffer = Buffer.from(String(signature).trim().toLowerCase());
    const expBuffer = Buffer.from(expectedSignature.toLowerCase());

    if (sigBuffer.length !== expBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, expBuffer);
  } catch (e) {
    return false;
  }
}

/**
 * Translates raw Razorpay webhook payload into RefundGuard event object
 */
function translateWebhookEvent(payload) {
  const event = payload.event || "unknown";

  let orderId = payload.payload?.payment?.entity?.order_id || payload.payload?.refund?.entity?.order_id || "ORD-LIVE-UNKNOWN";
  let paymentId = payload.payload?.payment?.entity?.id || payload.payload?.refund?.entity?.payment_id || "PAY-LIVE-UNKNOWN";
  let refundId = payload.payload?.refund?.entity?.id || null;
  let amount = payload.payload?.payment?.entity?.amount ? payload.payload.payment.entity.amount / 100 : (payload.payload?.refund?.entity?.amount ? payload.payload.refund.entity.amount / 100 : 0);

  return {
    event,
    orderId,
    paymentId,
    refundId,
    amount,
    rawPayload: payload,
  };
}

module.exports = {
  validateWebhookSignature,
  translateWebhookEvent,
};
