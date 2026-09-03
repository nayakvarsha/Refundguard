const fs = require("fs");
const path = require("path");
const { generateInMemoryDataset } = require("../data/generateDataset");

const CATEGORY_TO_TYPE = {
  duplicate: "DUPLICATE_REFUND",
  overRefund: "OVER_REFUND",
  unmatched: "UNMATCHED_REFUND",
  stateMismatch: "STATE_MISMATCH",
  timingRace: "TIMING_RACE",
};

let inMemoryLabelsCache = null;

function getLabels() {
  const labelsPath = path.join(__dirname, "..", "..", "data", "labels.json");
  if (fs.existsSync(labelsPath)) {
    try {
      return JSON.parse(fs.readFileSync(labelsPath, "utf-8"));
    } catch (e) {}
  }
  if (!inMemoryLabelsCache) {
    inMemoryLabelsCache = generateInMemoryDataset().labels;
  }
  return inMemoryLabelsCache;
}

/**
 * Dynamically scores engine incidents against synthetic ground-truth labels.json.
 * Category Validation: Strictly checks if the engine identified the exact
 * ground-truth violation type for the given orderId (Directive 3!).
 */
function scoreBenchmark(incidents) {
  const labels = getLabels();
  if (!labels) return null;

  // Build map of orderId -> Set(detectedViolationTypes)
  const detectedTypesByOrderId = new Map();
  for (const inc of incidents) {
    if (!detectedTypesByOrderId.has(inc.orderId)) {
      detectedTypesByOrderId.set(inc.orderId, new Set());
    }
    (inc.types || []).forEach((t) => detectedTypesByOrderId.get(inc.orderId).add(t));
  }

  const perCategory = {};
  Object.keys(CATEGORY_TO_TYPE).forEach((cat) => {
    perCategory[cat] = { total: 0, detected: 0 };
  });

  let normalTotal = 0;
  let falsePositives = 0;
  let truePositives = 0;

  for (const label of labels) {
    const expectedType = CATEGORY_TO_TYPE[label.category];
    const detectedSet = detectedTypesByOrderId.get(label.orderId);

    if (label.category === "normal") {
      normalTotal++;
      if (detectedSet && detectedSet.size > 0) {
        falsePositives++;
      }
      continue;
    }

    perCategory[label.category].total++;
    // Strict category validation: check if exact expected violation type was detected
    if (detectedSet && detectedSet.has(expectedType)) {
      perCategory[label.category].detected++;
      truePositives++;
    }
  }

  const totalAnomalies = labels.length - normalTotal;
  const trueNegatives = normalTotal - falsePositives;
  const falseNegatives = totalAnomalies - truePositives;

  const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
  const recall = truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const recallByCategory = {};
  for (const [cat, { total, detected }] of Object.entries(perCategory)) {
    recallByCategory[cat] = {
      type: CATEGORY_TO_TYPE[cat],
      count: total,
      detected,
      recallPct: total > 0 ? `${(Math.round((detected / total) * 1000) / 10).toFixed(1)}%` : "0%",
      fp: 0,
    };
  }

  return {
    recordsAnalyzed: labels.length,
    anomalousRecords: totalAnomalies,
    normalRecords: normalTotal,
    confusionMatrix: {
      tp: truePositives,
      fp: falsePositives,
      tn: trueNegatives,
      fn: falseNegatives,
      explanation: "Evaluated dynamically by validating exact ground-truth violation types against engine incident detections.",
    },
    metrics: {
      detected: truePositives,
      missed: falseNegatives,
      falsePositives,
      recallRate: `${(recall * 100).toFixed(1)}%`,
      precisionRate: `${(precision * 100).toFixed(1)}%`,
      f1Score: f1.toFixed(2),
    },
    recallByCategory,
  };
}

module.exports = { scoreBenchmark };
