# RefundGuard — Refund Integrity & Financial Leakage Detection Engine

Detect → Reconcile → Prove → Investigate → Audit

**RefundGuard** is a full-stack financial refund integrity engine and dashboard built for high-volume payment processing environments (e.g. Razorpay ecosystem). It monitors merchants and payment gateways for duplicate refunds, over-refunds, state mismatches, and reconciliation leakage across thousands of transactions using deterministic invariant checks.

---

## 🏛️ System Architecture

```
refundguard/
├── backend/
│   ├── src/
│   │   ├── checks/            # 6 deterministic invariant checks (Checks A–F)
│   │   ├── engine/            # Data loader, orchestrator, severity, policy, investigator, simulator
│   │   ├── routes/api.js      # REST API (/summary, /incidents, /reconciliation, /benchmark, /webhooks/company/*)
│   │   ├── routes/live.js     # Live Razorpay API order creation, payment verification & refund routes
│   │   ├── services/          # SQLite database (better-sqlite3), audit logger & Razorpay client resolver
│   │   └── server.js          # Express app serving backend API + frontend dist assets on single port 4000
│   └── data/                  # 10,000 synthetic benchmark transactions (JSON store)
└── frontend/                  # React 18 + Tailwind CSS + Lucide Icons
    ├── src/
    │   ├── api/client.js      # Unified REST client
    │   ├── components/        # DashboardView, IncidentsView, ReconciliationView, AuditTrailView, BenchmarkView, LiveDetectionView
    │   └── App.jsx            # Tab navigation, modals, and single-port app shell
```

---

## ⚡ Quick Start

### 1. Install Dependencies & Build Frontend
```cmd
cd backend
npm install

cd ../frontend
npm install
npm run build

cd ../backend
npm run generate-data   # Writes 10,000 synthetic records to backend/data/*.json
```

### 2. Start Unified Server
```cmd
cd backend
npm start
```

Open your browser at **[http://localhost:4000](http://localhost:4000)**!

---

## 🔌 API Reference (Served on `http://localhost:4000/api`)

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | System status & backend connection check |
| `/api/summary` | GET | Top-line dashboard metrics & Refund Integrity Score |
| `/api/incidents` | GET | List incidents with optional `severity`, `type`, `search`, and `limit` query params |
| `/api/incidents/:id` | GET | Complete incident details & financial proof calculations |
| `/api/incidents/:id/graph` | GET | Evidence Graph node/edge topology structure (`ORDER → PAYMENT → REFUND → VIOLATION`) |
| `/api/reconciliation` | GET | 4-Way cross-system ledger tie-out explorer |
| `/api/benchmark` | GET | Dynamic benchmark evaluation metrics & confusion matrix |
| `/api/audit` | GET | Chronological audit trail logs |
| `/api/settings` | GET / POST | Protected policy threshold settings |
| `/api/simulate` | POST | Live interactive demo anomaly generator |
| `/api/webhooks/company/:id` | POST | Multi-tenant Razorpay webhook receiver with HMAC signature verification & idempotency |

---

## 🎯 Ground-Truth Benchmark Results

Evaluated dynamically on the **10,000 Synthetic Transaction Benchmark Dataset** (9,000 clean + 1,000 seeded ground-truth anomalies):

- **Recall Rate**: `100.0%` (1,000 / 1,000 detected)
- **False Positive Rate**: `0.0%` (0 false alarms)
- **Precision Rate**: `100.0%`
- **F1 Score**: `1.00`

### Confusion Matrix Breakdown:
- **True Positives (TP)**: `1,000` (Actual Anomaly → Detected Anomaly)
- **False Positives (FP)**: `0` (Actual Normal → Detected Anomaly)
- **True Negatives (TN)**: `9,000` (Actual Normal → Detected Normal)
- **False Negatives (FN)**: `0` (Actual Anomaly → Detected Normal)

### Exact Anomaly Category Breakdown:
1. **DUPLICATE_REFUND (Check B)**: 250 records (`100.0% recall`)
2. **OVER_REFUND (Check A)**: 200 records (`100.0% recall`)
3. **UNMATCHED_REFUND (Check C)**: 200 records (`100.0% recall`)
4. **STATE_MISMATCH (Check D)**: 150 records (`100.0% recall`)
5. **TIMING_RACE (Check E)**: 200 records (`100.0% recall`)

---

## 🧠 Investigation Layer & AI Roadmap

- **Current Implementation**: Rule-based, deterministic explainability engine that extracts exact financial evidence trace-backs, calculates exposure delta, and constructs root-cause reasoning trees.
- **Future Roadmap**: Integration with Large Language Models (LLMs) to ingest free-text merchant support tickets and generate automated conversational root-cause summaries.

---

## 🛡️ Severity & Bounded Policy Engine

RefundGuard enforces strict bounded actions. The engine **never** auto-executes financial money moves:

### Financial Severity Classification:
- **`LOW`**: Exposure < ₹5,000
- **`MEDIUM`**: Exposure ₹5,000 – ₹24,999
- **`HIGH`**: Exposure ₹25,000 – ₹99,999
- **`CRITICAL`**: Exposure $\ge$ ₹100,000

### Policy Action Thresholds (Dynamically Configurable via `/api/settings`):
- **`AUTO_LOGGED_MONITOR`**: Exposure < ₹10,000
- **`AUTO_INVESTIGATION_TICKET`**: Exposure ₹10,000 – ₹49,999
- **`HUMAN_APPROVAL_REQUIRED`**: Exposure $\ge$ ₹50,000 or Critical Severity (*Note: `UNMATCHED_REFUND` and `STATE_MISMATCH` always require human review regardless of amount*).
