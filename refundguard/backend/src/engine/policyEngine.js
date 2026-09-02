/**
 * Bounded-action policy engine.
 *
 * The detection engine NEVER performs financial actions itself. It only
 * classifies what *should* happen next, and every decision is logged.
 *
 *   Detect -> Policy engine -> allowed automated action? -> Safe action | Human review -> Audit log
 */
const TYPES_REQUIRING_HUMAN_REVIEW = new Set([
  "UNMATCHED_REFUND", // possible fraud / broken integration - always escalate
  "STATE_MISMATCH", // systems disagree on money - always escalate
]);

function decideAction(incident, settings = null) {
  const { exposureAmount = 0, severity, types = [] } = incident;

  const autoInvestigateMax = settings?.autoInvestigateMax ?? 10000;
  const merchantReviewMax = settings?.merchantReviewMax ?? 50000;
  const requireHumanApprovalAbove = settings?.requireHumanApprovalAbove ?? 50000;

  const forcedEscalation = types.some((t) => TYPES_REQUIRING_HUMAN_REVIEW.has(t));

  let action;
  let reason;

  if (forcedEscalation || exposureAmount >= requireHumanApprovalAbove || severity?.level === "CRITICAL") {
    action = "HUMAN_APPROVAL_REQUIRED";
    reason = forcedEscalation
      ? "Incident type is classified as always requiring human review regardless of threshold."
      : `Exposure amount (₹${exposureAmount.toLocaleString('en-IN')}) exceeds human approval threshold (≥ ₹${requireHumanApprovalAbove.toLocaleString('en-IN')}).`;
  } else if (exposureAmount >= autoInvestigateMax && exposureAmount < merchantReviewMax) {
    action = "AUTO_INVESTIGATION_TICKET";
    reason = `Exposure (₹${exposureAmount.toLocaleString('en-IN')}) is between auto-investigate (₹${autoInvestigateMax.toLocaleString('en-IN')}) and merchant review threshold. Ticket auto-created for finance queue.`;
  } else {
    action = "AUTO_LOGGED_MONITOR";
    reason = `Exposure (₹${exposureAmount.toLocaleString('en-IN')}) is below investigation threshold (₹${autoInvestigateMax.toLocaleString('en-IN')}). Logged and monitored.`;
  }

  return {
    action,
    reason,
    auditLog: {
      incidentId: incident.id,
      decidedAt: new Date().toISOString(),
      severity: severity?.level || "MEDIUM",
      types,
      action,
      automatedFinancialActionTaken: false, // policy is intentionally never true in this engine
    },
  };
}

module.exports = { decideAction };
