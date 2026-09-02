import React from 'react';
import { X, ShieldCheck, Database, Layers, Calculator, BrainCircuit } from 'lucide-react';

export default function RecordBasisModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Detection & Record Basis Methodology</h3>
              <p className="text-xs text-slate-500 font-medium">On what basis are transactions and exception records identified?</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
          
          {/* Core Architectural Banner */}
          <div className="p-5 rounded-2xl bg-blue-50/80 border border-blue-200 space-y-2">
            <div className="flex items-center space-x-2 text-blue-700 font-extrabold text-sm">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span>Core Architectural Principle</span>
            </div>
            <p className="text-sm font-bold text-slate-900">
              "Rules prove the financial problem. AI explains the problem. Policy controls the action. Audit records everything."
            </p>
            <p className="text-slate-600 leading-relaxed font-medium">
              RefundGuard does NOT use fuzzy AI scoring or black-box ML to flag transactions. Exceptions are flagged exclusively on 100% deterministic mathematical invariant violations.
            </p>
          </div>

          {/* 1. Dataset Generation Basis */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>1. Dataset Basis (10,000 Synthetic Records)</span>
            </h4>

            <p className="text-slate-600 leading-relaxed font-medium">
              The records analyzed by RefundGuard are generated reproducibly using a seeded synthetic dataset generator (<code className="text-blue-600 font-mono font-bold">generateDataset.js</code>):
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-emerald-700">9,000 Normal Transactions</div>
                <div className="text-[11px] text-slate-500 mt-1">Clean Order → Payment → Single Refund cycles that satisfy all financial invariants.</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-rose-600">1,000 Injected Invariant Anomalies</div>
                <div className="text-[11px] text-slate-500 mt-1">Known ground-truth anomalies introduced to benchmark detection recall.</div>
              </div>
            </div>
          </div>

          {/* 2. The 6 Deterministic Checks */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
              <Calculator className="w-4 h-4 text-blue-600" />
              <span>2. The 6 Invariant Check Rules (Basis for Exceptions)</span>
            </h4>

            <div className="space-y-2 font-sans">
              
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-extrabold text-blue-700 font-mono">Rule A — Over-Refund Check</div>
                <div className="text-slate-800 font-medium">Invariant: Cumulative Refunds ≤ Captured Payment Amount</div>
                <div className="text-[11px] text-slate-500 font-mono">Example: ₹30,000 Captured, ₹60,000 Refunded → ₹30,000 Excess Exposure.</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-extrabold text-blue-700 font-mono">Rule B — Duplicate Refund Check</div>
                <div className="text-slate-800 font-medium">Invariant: Multiple refunds against same Payment ID with near-identical timestamp (&lt; 5s) and amount</div>
                <div className="text-[11px] text-slate-500 font-mono">Flags duplicate API requests caused by un-locked retry loops.</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-extrabold text-blue-700 font-mono">Rule C — Valid Payment Check (Unmatched Refund)</div>
                <div className="text-slate-800 font-medium">Invariant: Every refund MUST map to a valid captured payment in the PSP ledger</div>
                <div className="text-[11px] text-slate-500 font-mono">Flags orphaned refunds referencing missing or purged payment IDs.</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-extrabold text-blue-700 font-mono">Rule D — State Consistency Check</div>
                <div className="text-slate-800 font-medium">Invariant: Merchant internal ledger status MUST agree with payment gateway status</div>
                <div className="text-[11px] text-slate-500 font-mono">Flags status mismatches caused by dropped webhook callbacks.</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-extrabold text-blue-700 font-mono">Rule E — Timing Race Check</div>
                <div className="text-slate-800 font-medium">Invariant: Rapid refund requests (&lt; 2s window) processed by concurrent worker threads</div>
                <div className="text-[11px] text-slate-500 font-mono">Signals concurrent race condition risk.</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-extrabold text-blue-700 font-mono">Rule F — 4-Way Cross-System Reconciliation</div>
                <div className="text-slate-800 font-medium">Invariant: Cross-system tie-out across Order, Payment, Refund, and Merchant Ledger</div>
                <div className="text-[11px] text-slate-500 font-mono">Ensures all 4 data stores match perfectly.</div>
              </div>

            </div>
          </div>

          {/* 3. Role of AI */}
          <div className="space-y-2 p-4 rounded-2xl bg-purple-50/80 border border-purple-200">
            <div className="flex items-center space-x-2 text-purple-700 font-extrabold text-xs uppercase">
              <BrainCircuit className="w-4 h-4 text-purple-600" />
              <span>Role of AI Investigator</span>
            </div>
            <p className="text-slate-700 text-xs leading-relaxed font-medium">
              The AI layer only runs AFTER deterministic invariant checks have proven an exception. It receives proven evidence and answers:
              <br />
              1. <em>What likely caused this event sequence?</em>
              <br />
              2. <em>What evidence supports that deduction?</em>
              <br />
              3. <em>What actionable recommendation should the merchant implement?</em>
              <br />
              If evidence is insufficient, the AI returns <strong className="text-rose-600 font-bold">UNCERTAIN</strong> with a missing evidence list to route to human review.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs transition"
          >
            Got It
          </button>
        </div>

      </div>
    </div>
  );
}
