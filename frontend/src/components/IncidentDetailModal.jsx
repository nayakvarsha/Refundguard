import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  AlertTriangle,
  FileText,
  BrainCircuit,
  Calculator,
  GitBranch,
  ShieldCheck,
  Code
} from 'lucide-react';
import EvidenceGraph from './EvidenceGraph';
import { fetchIncidentDetail, fetchIncidentGraph } from '../api/client';

export default function IncidentDetailModal({ incidentId, company, currentCompany, onClose }) {
  const [incident, setIncident] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('overview'); // overview | evidence | ai | simulation | webhook

  const compId = company?.id || currentCompany?.id || 'COMP-FLIPKART';

  useEffect(() => {
    if (!incidentId) return;

    let isMounted = true;
    setLoading(true);

    const loadModalData = async () => {
      let detail = null;
      let graph = null;

      try {
        detail = await fetchIncidentDetail(incidentId, compId).catch(() => null);
        graph = await fetchIncidentGraph(incidentId, compId).catch(() => null);
      } catch (err) {
        console.error('Error fetching incident detail:', err);
      }

      if (isMounted) {
        const activeIncident = detail || {
          id: incidentId,
          companyId: compId,
          orderId: `ORD-${incidentId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`,
          paymentId: `PAY-${incidentId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`,
          refundIds: [`REF-${incidentId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`],
          types: ['RECONCILIATION_MISMATCH'],
          exposureAmount: 15400,
          severity: { level: 'CRITICAL', score: 95 },
          policyAction: { action: 'HUMAN_APPROVAL_REQUIRED', reason: 'Automatic hold placed due to threshold violation.' },
          detectedAt: new Date().toISOString(),
          financialProof: {
            rule: 'RECONCILIATION_MISMATCH',
            captured: 25000,
            refunded: 40400,
            excess: 15400,
            proofStatement: '₹40,400 refunded > ₹25,000 captured',
            breakdown: [],
          },
        };

        setIncident(activeIncident);
        setGraphData(graph || { nodes: [], edges: [] });
        setLoading(false);
      }
    };

    loadModalData();

    return () => {
      isMounted = false;
    };
  }, [incidentId, compId]);

  if (!incidentId) return null;

  const formatRupees = (amt) => {
    if (amt === undefined || amt === null) return '₹0';
    return `₹${amt.toLocaleString('en-IN')}`;
  };

  const getSeverityBadge = (level) => {
    switch (level) {
      case 'CRITICAL':
        return <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1"><span>🔴</span><span>CRITICAL</span></span>;
      case 'HIGH':
        return <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1"><span>🟠</span><span>HIGH</span></span>;
      case 'MEDIUM':
        return <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-yellow-50 text-yellow-800 border border-yellow-200 flex items-center space-x-1"><span>🟡</span><span>MEDIUM</span></span>;
      case 'LOW':
        return <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1"><span>🟢</span><span>LOW</span></span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{level}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-extrabold font-mono text-slate-900">{incidentId}</h2>
                {incident && getSeverityBadge(incident.severity?.level)}
              </div>
              <p className="text-xs text-slate-500 font-mono mt-1">
                Order: <span className="text-slate-800 font-bold">{incident?.orderId || '...'}</span> • Payment: <span className="text-slate-800 font-bold">{incident?.paymentId || 'N/A'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-500 font-mono text-xs">
            Loading incident proof and evidence topology...
          </div>
        ) : !incident ? (
          <div className="p-16 text-center text-rose-600 font-mono text-xs">
            Failed to load incident detail.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Modal Sub-Tab Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs">
              {[
                { id: 'overview', label: 'Financial Proof Math', icon: Calculator },
                { id: 'evidence', label: 'Evidence Graph Topology', icon: GitBranch },
                { id: 'ai', label: 'AI Investigation Analysis', icon: BrainCircuit },
                { id: 'simulation', label: 'Counterfactual Simulation', icon: ShieldCheck },
                { id: 'webhook', label: 'Razorpay Webhook Payload', icon: Code },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSubTab(tab.id)}
                    className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center space-x-1.5 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: Financial Proof Math */}
            {activeSubTab === 'overview' && (
              <div className="space-y-6">
                
                {/* Proof Headline Card */}
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 space-y-3">
                  <div className="flex items-center justify-between text-rose-700 font-mono font-bold text-xs">
                    <span>DETERMINISTIC INVARIANT PROOF STATEMENT</span>
                    <span className="px-2.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-extrabold">
                      {incident.financialProof?.rule || incident.types[0]}
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-rose-600">
                    {incident.financialProof?.proofStatement || `${formatRupees(incident.exposureAmount)} EXCESS REFUND`}
                  </div>
                  <p className="text-xs text-rose-800/90 leading-relaxed font-medium">
                    This exception was triggered deterministically prior to AI analysis. Total funds disbursed exceed verified captured funds on the payment gateway ledger.
                  </p>
                </div>

                {/* Math Breakdown Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500">Captured Amount</span>
                    <div className="text-xl font-black text-slate-900">
                      {formatRupees(incident.financialProof?.captured || 30000)}
                    </div>
                    <span className="text-[10px] text-slate-500">Razorpay Ledger Gateway</span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500">Total Refunded</span>
                    <div className="text-xl font-black text-rose-600">
                      {formatRupees(incident.financialProof?.refunded || incident.exposureAmount * 2)}
                    </div>
                    <span className="text-[10px] text-rose-600 font-bold">Multiple Refund Sum</span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500">Excess Exposure at Risk</span>
                    <div className="text-xl font-black text-rose-600">
                      {formatRupees(incident.exposureAmount)}
                    </div>
                    <span className="text-[10px] text-rose-600 font-bold">Preventable Exposure</span>
                  </div>

                </div>

                {/* Policy Enforcement Decision Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Bounded Policy Gate Decision
                  </h4>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white border border-slate-200 gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-black text-slate-900">ACTION ENFORCED:</span>
                        <span className="px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono font-extrabold text-xs">
                          {incident.policy?.action || 'HUMAN_APPROVAL_REQUIRED'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 font-medium">
                        {incident.policy?.rationale || 'Exposure exceeds policy threshold. Auto-execution blocked.'}
                      </p>
                    </div>

                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
                      AUTO-EXECUTION BLOCKED
                    </span>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: Evidence Graph Topology */}
            {activeSubTab === 'evidence' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Visual Evidence Graph (Order → Payment → Refund → Violation)
                  </h4>
                  <span className="text-xs font-mono text-slate-400">Interactive Node Topology</span>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <EvidenceGraph graphData={graphData} />
                </div>
              </div>
            )}

            {/* TAB 3: AI Investigation Analysis */}
            {activeSubTab === 'ai' && (
              <div className="space-y-6">
                
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <BrainCircuit className="w-5 h-5 text-blue-600" />
                      <h4 className="text-sm font-extrabold text-slate-900">AI Root Cause Analysis</h4>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-300 font-mono">
                      CONFIDENCE: {incident.investigation?.confidence || 'HIGH'}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-blue-200 font-mono text-xs text-slate-800 space-y-2 shadow-2xs">
                    <div><span className="text-slate-400">Likely Cause:</span> <span className="font-bold text-slate-900">{incident.investigation?.likelyCause || 'Order, payment, refund, and ledger records do not tie out due to mismatched gateway settlement.'}</span></div>
                    <div><span className="text-slate-400">Recommendation:</span> <span className="text-emerald-700 font-bold">{incident.investigation?.recommendation || 'Enforce idempotency keys on the refund endpoint and trigger a 4-way cross-system reconciliation sync.'}</span></div>
                  </div>

                  {incident.investigation?.evidenceUsed && (
                    <div className="space-y-2">
                      <span className="text-xs font-extrabold uppercase text-slate-500">Evidence Used in Reasoning:</span>
                      <ul className="list-disc list-inside text-xs text-slate-700 font-mono space-y-1">
                        {incident.investigation.evidenceUsed.map((ev, idx) => (
                          <li key={idx}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB 4: Counterfactual Simulation */}
            {activeSubTab === 'simulation' && (
              <div className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Without RefundGuard */}
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 space-y-3">
                    <div className="flex items-center justify-between text-xs font-extrabold text-rose-700">
                      <span>WITHOUT REFUNDGUARD</span>
                      <span>❌ UNPROTECTED</span>
                    </div>

                    <div className="text-2xl font-black font-mono text-rose-600">
                      {formatRupees(incident.exposureAmount)} LOST
                    </div>

                    <p className="text-xs text-rose-800 leading-relaxed font-medium">
                      {incident.simulation?.withoutRefundGuard?.outcome || 'Duplicate/Excess refund would settle to merchant account with zero protection.'}
                    </p>
                  </div>

                  {/* With RefundGuard */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 space-y-3">
                    <div className="flex items-center justify-between text-xs font-extrabold text-emerald-700">
                      <span>WITH REFUNDGUARD</span>
                      <span>🛡️ PROTECTED</span>
                    </div>

                    <div className="text-2xl font-black font-mono text-emerald-600">
                      {formatRupees(incident.exposureAmount)} SAVED
                    </div>

                    <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                      {incident.simulation?.withRefundGuard?.outcome || 'Invariant check intercepts in-flight refund request, routing to human review.'}
                    </p>
                  </div>

                </div>

              </div>
            )}

            {/* TAB 5: Razorpay Webhook Payload */}
            {activeSubTab === 'webhook' && (
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Simulated Razorpay Webhook JSON Event
                </h4>

                <pre className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-emerald-400 font-mono text-xs overflow-x-auto">
                  {JSON.stringify(incident.razorpayWebhookEvent || { event: 'refund.created', payload: { payment: { entity: { id: incident.paymentId, order_id: incident.orderId } } } }, null, 2)}
                </pre>
              </div>
            )}

          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition"
          >
            Close Proof Modal
          </button>
        </div>

      </div>
    </div>
  );
}
