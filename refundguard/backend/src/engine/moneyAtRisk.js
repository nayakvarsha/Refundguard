/**
 * Aggregates exposure across incidents into:
 *   - totalExposure
 *   - prevented   (linked refunds not yet fully PROCESSED - still stoppable)
 *   - alreadyOccurred (linked refunds already PROCESSED - money has moved)
 */
function computeMoneyAtRisk(incidents) {
  let totalExposure = 0;
  let prevented = 0;
  let alreadyOccurred = 0;

  for (const incident of incidents) {
    totalExposure += incident.exposureAmount;
    if (incident.allRefundsProcessed) {
      alreadyOccurred += incident.exposureAmount;
    } else {
      prevented += incident.exposureAmount;
    }
  }

  const round = (n) => Math.round(n * 100) / 100;

  return {
    totalExposure: round(totalExposure),
    prevented: round(prevented),
    alreadyOccurred: round(alreadyOccurred),
  };
}

module.exports = { computeMoneyAtRisk };
