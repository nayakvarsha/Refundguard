const THRESHOLDS = [
  { level: "CRITICAL", min: 100000, icon: "🔴" },
  { level: "HIGH", min: 25000, icon: "🟠" },
  { level: "MEDIUM", min: 5000, icon: "🟡" },
  { level: "LOW", min: 0, icon: "🟢" },
];

function classifySeverity(exposureAmount) {
  for (const t of THRESHOLDS) {
    if (exposureAmount >= t.min) return { level: t.level, icon: t.icon };
  }
  return { level: "LOW", icon: "🟢" };
}

module.exports = { classifySeverity, THRESHOLDS };
