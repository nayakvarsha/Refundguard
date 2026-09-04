const Razorpay = require("razorpay");
const { getConnection } = require("./dbService");
require("dotenv").config();

/**
 * Returns a Razorpay client instance.
 * Dynamic Resolution:
 * 1. Checks if companyId has valid custom Razorpay API credentials saved in SQLite/in-memory store.
 * 2. If present, initializes SDK dynamically with company's credentials.
 * 3. Fallback: Uses global process.env.RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET.
 */
function getRazorpayClient(companyId = null) {
  if (companyId) {
    const conn = getConnection(companyId);
    if (
      conn &&
      conn.razorpayKeyId &&
      conn.razorpayKeySecret &&
      !conn.razorpayKeyId.includes("flipkart") &&
      !conn.razorpayKeyId.includes("myntra") &&
      conn.razorpayKeyId.length > 15
    ) {
      try {
        const keySecret = conn.razorpayKeySecret.startsWith("Bearer ")
          ? conn.razorpayKeySecret.replace("Bearer ", "").trim()
          : conn.razorpayKeySecret;
        return new Razorpay({
          key_id: conn.razorpayKeyId,
          key_secret: keySecret,
        });
      } catch (err) {
        console.warn(`Failed to initialize Razorpay SDK for company ${companyId}:`, err.message);
      }
    }
  }

  // Fallback to global environment variables
  const globalKeyId = process.env.RAZORPAY_KEY_ID;
  const globalKeySecret = process.env.RAZORPAY_KEY_SECRET;

  if (globalKeyId && globalKeySecret && globalKeyId !== "rzp_test_your_key_id") {
    try {
      return new Razorpay({
        key_id: globalKeyId,
        key_secret: globalKeySecret,
      });
    } catch (err) {
      console.warn("Failed to initialize global Razorpay SDK:", err.message);
    }
  }

  return null;
}

module.exports = { getRazorpayClient };
