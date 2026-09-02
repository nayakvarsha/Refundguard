/**
 * The "AI investigator" layer.
 *
 * IMPORTANT: this never decides WHETHER something is an exception - the
 * deterministic checks (src/checks/*) already proved that with hard data.
 * This layer only explains WHY, given the evidence the checks produced.
 *
 * This is implemented as transparent, rule-based reasoning so the demo is
 * reproducible and free to run. To upgrade to a real LLM investigator,
 * replace `investigate()`'s body with a call to POST /v1/messages, passing
 * `incident.exceptions` (the proven evidence) as context and keeping the
 * same return shape - the rest of the engine doesn't need to change.
 */

// Fields every incident lacks in this dataset - used to drive the
// "graceful failure / knows when it doesn't know" behavior.
const UNAVAILABLE_EVIDENCE = ["Merchant application logs", "PSP webhook delivery log"];

function investigateDuplicate(incident) {
  const ex = incident.exceptions.find((e) => e.type === "DUPLICATE_REFUND");
  return {
    confidence: "HIGH",
    likelyCause:
      "Duplicate refund requests generated within a few seconds of each other on the same payment.",
    evidenceUsed: [
      "Two refund records with matching (or near-identical) amounts",
      `Requests ${ex.evidence.deltaSeconds}s apart`,
      "Same payment ID on both",
    ],
    recommendation:
      "Enforce idempotency keys on the refund endpoint and add a duplicate-request lock keyed by payment ID.",
  };
}

function investigateOverRefund(incident) {
  const ex = incident.exceptions.find((e) => e.type === "OVER_REFUND");
  return {
    confidence: "HIGH",
    likelyCause:
      ex.evidence.refundCount > 1
        ? "Multiple separate refunds against the same payment were not checked against remaining refundable balance before processing."
        : "A single refund was processed for more than the captured amount, likely a manual override without a balance check.",
    evidenceUsed: [
      `Captured amount ₹${ex.evidence.capturedAmount.toLocaleString("en-IN")}`,
      `Total refunded ₹${ex.evidence.totalRefunded.toLocaleString("en-IN")}`,
      `${ex.evidence.refundCount} refund record(s) against this payment`,
    ],
    recommendation:
      "Add a hard server-side guard: reject any refund that would push cumulative refunds above the captured amount.",
  };
}

function investigateUnmatched(incident) {
  return {
    confidence: "UNCERTAIN",
    likelyCause:
      "Refund references a payment ID absent from the payment ledger - could be a data-sync failure, a manually fabricated refund, or a payment purged/archived out of band.",
    evidenceUsed: ["Refund record", "Absence of matching payment record"],
    missingEvidence: UNAVAILABLE_EVIDENCE,
    recommendation:
      "Route to human investigation. Do not auto-approve or auto-reverse this refund without confirming against the PSP directly.",
  };
}

function investigateStateMismatch(incident) {
  return {
    confidence: "UNCERTAIN",
    likelyCause:
      "Merchant ledger and payment record disagree on refund state - most often caused by a webhook that updated one system but failed silently on the other.",
    evidenceUsed: ["Ledger status", "Payment record status", "Timestamps of last update"],
    missingEvidence: UNAVAILABLE_EVIDENCE,
    recommendation:
      "Route to human investigation and re-sync both systems against the PSP's source-of-truth status before taking any action.",
  };
}

function investigateTimingRace(incident) {
  const ex = incident.exceptions.find((e) => e.type === "TIMING_RACE");
  return {
    confidence: "MEDIUM",
    likelyCause:
      "Two refund requests were processed within a window narrow enough to suggest they were handled by concurrent workers without a lock, rather than genuinely separate user actions.",
    evidenceUsed: [
      `Requests ${ex.evidence.deltaSeconds}s apart`,
      "Both marked PROCESSED",
    ],
    recommendation:
      "Add a per-payment mutex/lock during refund processing so concurrent requests are serialized, not both accepted.",
  };
}

function investigateReconciliation(incident) {
  return {
    confidence: "MEDIUM",
    likelyCause:
      "Order, payment, refund, and ledger records don't tie out - typically an integration gap between two of the four systems rather than a single bad transaction.",
    evidenceUsed: ["Cross-system comparison of order, payment, refund, and ledger records"],
    recommendation:
      "Add a nightly reconciliation job comparing all four systems and alert on any new mismatch within 24h.",
  };
}

const INVESTIGATORS = {
  DUPLICATE_REFUND: investigateDuplicate,
  OVER_REFUND: investigateOverRefund,
  UNMATCHED_REFUND: investigateUnmatched,
  STATE_MISMATCH: investigateStateMismatch,
  TIMING_RACE: investigateTimingRace,
  RECONCILIATION_MISMATCH: investigateReconciliation,
};

/**
 * Picks the investigator for the incident's primary (highest-priority) type
 * and returns its structured findings. Falls back to a graceful "can't
 * determine" response if an unrecognized type ever shows up.
 */
function investigate(incident) {
  const priority = [
    "UNMATCHED_REFUND",
    "STATE_MISMATCH",
    "DUPLICATE_REFUND",
    "OVER_REFUND",
    "TIMING_RACE",
    "RECONCILIATION_MISMATCH",
  ];
  const primaryType = priority.find((t) => incident.types.includes(t)) || incident.types[0];
  const fn = INVESTIGATORS[primaryType];

  if (!fn) {
    return {
      confidence: "UNCERTAIN",
      likelyCause: null,
      evidenceUsed: [],
      missingEvidence: UNAVAILABLE_EVIDENCE,
      recommendation: "Human investigation required. No automated financial action taken.",
    };
  }

  return fn(incident);
}

module.exports = { investigate };
