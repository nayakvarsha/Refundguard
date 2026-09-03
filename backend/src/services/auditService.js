/**
 * Audit Service - tracks chronological events in RefundGuard's pipeline.
 */

let auditLogs = [
  {
    id: "AUD-001",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    eventType: "ENGINE_RUN",
    orderId: "SYSTEM",
    actor: "SYSTEM_ENGINE",
    action: "ENGINE_RUN_COMPLETED",
    details: "Processed 10,000 transaction records. Identified 1,000 invariant exceptions.",
    severity: "INFO",
  },
  {
    id: "AUD-002",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    eventType: "BENCHMARK_SCORE",
    orderId: "SYSTEM",
    actor: "BENCHMARK_EVALUATOR",
    action: "BENCHMARK_EVALUATED",
    details: "100% recall achieved on 1,000 ground-truth anomalies. 0 false positives.",
    severity: "INFO",
  },
];

function getAuditLogs(limit = 100) {
  return auditLogs.slice(0, limit);
}

function addAuditLog(entry) {
  const logItem = {
    id: `AUD-${String(auditLogs.length + 1).padStart(3, "0")}`,
    timestamp: entry.timestamp || new Date().toISOString(),
    eventType: entry.eventType || "INCIDENT_EVENT",
    orderId: entry.orderId || "N/A",
    actor: entry.actor || "REFUNDGUARD_ENGINE",
    action: entry.action || "LOG_ENTRY",
    details: entry.details || "",
    severity: entry.severity || "INFO",
  };
  auditLogs.unshift(logItem); // Newest first
  return logItem;
}

function clearAuditLogs() {
  auditLogs = [];
}

module.exports = {
  getAuditLogs,
  addAuditLog,
  clearAuditLogs,
};
