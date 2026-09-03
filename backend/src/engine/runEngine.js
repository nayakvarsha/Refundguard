const fs = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");

const { loadData } = require("./loadData");
const { classifySeverity } = require("./severity");
const { decideAction } = require("./policyEngine");
const { investigate } = require("./investigator");
const { simulate } = require("./simulator");
const { computeMoneyAtRisk } = require("./moneyAtRisk");
const { scoreBenchmark } = require("./benchmark");

const { checkOverRefund } = require("../checks/overRefund");
const { checkDuplicateRefund } = require("../checks/duplicateRefund");
const { checkUnmatchedRefund } = require("../checks/unmatchedRefund");
const { checkStateMismatch } = require("../checks/stateMismatch");
const { checkTimingRace } = require("../checks/timingRace");
const { checkReconciliationMismatch } = require("../checks/reconciliationMismatch");

const OUT_DIR = path.join(__dirname, "..", "..", "data");

/**
 * Groups raw check exceptions by orderId into a single "incident" per order.
 */
function groupIntoIncidents(rawExceptions) {
  const byOrder = new Map();

  for (const ex of rawExceptions) {
    if (!byOrder.has(ex.orderId)) byOrder.set(ex.orderId, []);
    byOrder.get(ex.orderId).push(ex);
  }

  const incidents = [];
  for (const [orderId, exceptions] of byOrder.entries()) {
    const types = [...new Set(exceptions.map((e) => e.type))];
    const exposureAmount =
      Math.round(Math.max(...exceptions.map((e) => e.exposureAmount)) * 100) / 100;
    const allRefundsProcessed = exceptions.some((e) => e.allRefundsProcessed);
    const paymentId = exceptions.find((e) => e.paymentId)?.paymentId || null;
    const refundIds = [...new Set(exceptions.flatMap((e) => e.refundIds || []))];

    incidents.push({
      id: `INC-${uuid().slice(0, 8).toUpperCase()}`,
      orderId,
      paymentId,
      refundIds,
      types,
      exceptions,
      exposureAmount,
      allRefundsProcessed,
      detectedAt: new Date().toISOString(),
    });
  }

  return incidents;
}

function runEngine(companyId = null, sourceType = "DEMO", settings = null) {
  const data = loadData(companyId, sourceType);

  const rawExceptions = [
    ...checkOverRefund(data),
    ...checkDuplicateRefund(data),
    ...checkUnmatchedRefund(data),
    ...checkStateMismatch(data),
    ...checkTimingRace(data),
    ...checkReconciliationMismatch(data),
  ];

  let incidents = groupIntoIncidents(rawExceptions);

  // Enrich each incident: severity -> policy decision -> AI investigation -> simulation
  incidents = incidents.map((incident) => {
    const severity = classifySeverity(incident.exposureAmount);
    const withSeverity = { ...incident, severity };
    const policy = decideAction(withSeverity, settings);
    const withPolicy = { ...withSeverity, policy };
    const investigation = investigate(withPolicy);
    const withInvestigation = { ...withPolicy, investigation };
    const simulation = simulate(withInvestigation);
    return { ...withInvestigation, simulation };
  });

  // Highest exposure first
  incidents.sort((a, b) => b.exposureAmount - a.exposureAmount);

  const moneyAtRisk = computeMoneyAtRisk(incidents);
  const benchmark = scoreBenchmark(incidents);

  const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  incidents.forEach((i) => severityCounts[i.severity.level]++);

  const typeCounts = {};
  incidents.forEach((i) =>
    i.types.forEach((t) => (typeCounts[t] = (typeCounts[t] || 0) + 1))
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    recordsAnalyzed: data.orders.length,
    incidentsFound: incidents.length,
    rawExceptionsFound: rawExceptions.length,
    severityCounts,
    typeCounts,
    moneyAtRisk,
    benchmark,
  };

  if (!companyId && sourceType === "DEMO") {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(OUT_DIR, "incidents.json"),
      JSON.stringify(incidents, null, 2)
    );
    fs.writeFileSync(
      path.join(OUT_DIR, "summary.json"),
      JSON.stringify(summary, null, 2)
    );
  }

  return { summary, incidents, rawExceptions };
}

module.exports = { runEngine, groupIntoIncidents };
