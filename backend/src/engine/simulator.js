/**
 * "What would have happened?" simulator.
 * For a given incident, contrasts the naive outcome (no RefundGuard) against
 * the outcome with RefundGuard's checks + policy engine in place.
 */
function simulate(incident) {
  const without = {
    description: "Refund(s) would have processed with no integrity check.",
    exposure: incident.exposureAmount,
  };

  const caughtBeforeCompletion = !incident.allRefundsProcessed;

  const withGuard = caughtBeforeCompletion
    ? {
        description: `Flagged as ${incident.severity.level} severity before completion; routed to "${incident.policy.action}".`,
        leakagePrevented: incident.exposureAmount,
        leakageAlreadyOccurred: 0,
      }
    : {
        description: `Refund(s) already PROCESSED before detection; flagged post-hoc for recovery/audit via "${incident.policy.action}".`,
        leakagePrevented: 0,
        leakageAlreadyOccurred: incident.exposureAmount,
      };

  return { without, with: withGuard };
}

module.exports = { simulate };
