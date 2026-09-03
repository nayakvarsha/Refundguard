import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, FileSpreadsheet, Search, Upload, Lock, Layers, ArrowRight, X, AlertCircle } from 'lucide-react';

export default function ReconciliationView({ currentCompany, sessionToken, onOpenImportModal, onOpenConnectionModal }) {
  const [sourceType, setSourceType] = useState('DEMO'); // 'UPLOADED' | 'RAZORPAY' | 'DEMO'
  const [records, setRecords] = useState([]);
  const [summaryMetrics, setSummaryMetrics] = useState({ total: 0, matchedCount: 0, mismatchedCount: 0, potentialLeakage: 0 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL | MATCHED | MISMATCHED
  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState(null);

  const loadReconciliation = () => {
    if (!currentCompany) return;
    setLoading(true);
    fetch(`/api/reconciliation?companyId=${currentCompany.id}&sourceType=${sourceType}`, {
      headers: sessionToken ? { 'x-session-token': sessionToken } : {},
    })
      .then((res) => res.json())
      .then((data) => {
        setRecords(data.records || []);
        setSummaryMetrics({
          total: data.total || 0,
          matchedCount: data.matchedCount || 0,
          mismatchedCount: data.mismatchedCount || 0,
          potentialLeakage: data.potentialLeakage || 0,
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch reconciliation records:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadReconciliation();
  }, [currentCompany?.id, sourceType]);

  const formatRupees = (amt) => {
    if (!amt) return '₹0';
    return `₹${amt.toLocaleString('en-IN')}`;
  };

  const filteredRecords = records.filter((r) => {
    const matchesFilter = filterStatus === 'ALL' || r.reconciliationStatus === filterStatus;
    const matchesSearch =
      !search ||
      r.orderId.toLowerCase().includes(search.toLowerCase()) ||
      r.paymentId.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* Header Banner & Data Source Selector */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">4-Way Cross-System Ledger Reconciliation</h2>
            <p className="text-xs text-slate-500 font-medium">
              Order System → Gateway Payment (Razorpay) → Refund Service → Merchant Ledger
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Data Source Selector */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold font-mono">
            <button
              onClick={() => setSourceType('UPLOADED')}
              className={`px-2.5 py-1.5 rounded-lg transition ${
                sourceType === 'UPLOADED' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ○ My Uploaded Data
            </button>
            <button
              onClick={() => setSourceType('RAZORPAY')}
              className={`px-2.5 py-1.5 rounded-lg transition ${
                sourceType === 'RAZORPAY' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ○ Razorpay Integration
            </button>
            <button
              onClick={() => setSourceType('DEMO')}
              className={`px-2.5 py-1.5 rounded-lg transition ${
                sourceType === 'DEMO' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ○ Demo Dataset (10K)
            </button>
          </div>

          {/* Import Data Action Button */}
          <button
            onClick={onOpenImportModal}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-600/20 transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>+ Import Data</span>
          </button>
        </div>
      </div>

      {/* Empty State when no data exists for selected source */}
      {!loading && records.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center max-w-xl mx-auto shadow-sm space-y-6 my-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <Layers className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900">4-Way Reconciliation</h3>
            <p className="text-xs text-slate-400 font-mono">Order → Payment → Refund → Ledger</p>
          </div>
          <div className="py-4 space-y-2 border-t border-b border-slate-100">
            <span className="text-base font-extrabold text-slate-800 block">No Data Yet</span>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Upload your transaction data or connect your gateway to begin cross-system reconciliation.
            </p>
          </div>
          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              onClick={onOpenImportModal}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-600/30 transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload CSV / JSON</span>
            </button>
            <span className="text-xs text-slate-400 font-bold">or</span>
            <button
              onClick={onOpenConnectionModal}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Lock className="w-4 h-4 text-blue-600" />
              <span>Connect Razorpay</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Post-Upload Top Metrics Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Transactions</span>
              <span className="text-2xl font-black text-slate-900 block mt-1">{summaryMetrics.total.toLocaleString()}</span>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] font-extrabold text-emerald-600 uppercase tracking-wider block">Matched</span>
              <span className="text-2xl font-black text-emerald-600 block mt-1">{summaryMetrics.matchedCount.toLocaleString()}</span>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] font-extrabold text-rose-600 uppercase tracking-wider block">Mismatched</span>
              <span className="text-2xl font-black text-rose-600 block mt-1">{summaryMetrics.mismatchedCount.toLocaleString()}</span>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] font-extrabold text-amber-600 uppercase tracking-wider block">Potential Leakage</span>
              <span className="text-2xl font-black text-amber-600 block mt-1">{formatRupees(summaryMetrics.potentialLeakage)}</span>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Order or Payment ID..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            <div className="flex items-center space-x-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200">
              {['ALL', 'MATCHED', 'MISMATCHED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold font-mono transition ${
                    filterStatus === st
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Reconciliation Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center text-slate-500 font-mono text-xs">
                Performing 4-way cross-system reconciliation...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-4">PSP Payment ID</th>
                      <th className="py-3 px-4 text-right">Order Amount</th>
                      <th className="py-3 px-4 text-right">Captured Amount</th>
                      <th className="py-3 px-4 text-center">Refund Count</th>
                      <th className="py-3 px-4 text-right">Refunded Amount</th>
                      <th className="py-3 px-4 text-center">Reconciliation Tie-Out</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecords.map((r, idx) => (
                      <tr
                        key={idx}
                        onClick={() => setSelectedTx(r)}
                        className="hover:bg-blue-50/50 transition cursor-pointer"
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center space-x-2">
                          <span>{r.orderId}</span>
                          <span className="text-[10px] text-blue-600 font-normal hover:underline">View 4-Way</span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">{r.paymentId}</td>
                        <td className="py-3.5 px-4 text-right text-slate-600">{formatRupees(r.orderAmount)}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-600">{formatRupees(r.capturedAmount)}</td>
                        <td className="py-3.5 px-4 text-center text-slate-500 font-bold">{r.refundCount}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-rose-600">{formatRupees(r.refundedAmount)}</td>
                        <td className="py-3.5 px-4 text-center">
                          {r.reconciliationStatus === 'MATCHED' ? (
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center space-x-1">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              <span>MATCHED</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center space-x-1">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              <span>MISMATCH</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Explicit 4-Way Transaction System Comparison Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Transaction Breakdown</span>
                <h3 className="text-lg font-black">{selectedTx.orderId}</h3>
              </div>
              <button onClick={() => setSelectedTx(null)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 font-mono text-xs">
              
              {/* 4 Systems Comparison Cards */}
              <div className="grid grid-cols-2 gap-3">
                {/* 1. ORDER */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">1. Order System</span>
                  <span className="text-base font-black text-slate-900 block">{formatRupees(selectedTx.systems?.order?.amount || selectedTx.orderAmount)}</span>
                  <span className="text-[10px] text-emerald-600 font-bold block">Status: {selectedTx.systems?.order?.status || 'COMPLETED'} ✅</span>
                </div>

                {/* 2. RAZORPAY PAYMENT */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">2. Razorpay Payment</span>
                  <span className="text-base font-black text-slate-900 block">{formatRupees(selectedTx.systems?.payment?.amount || selectedTx.capturedAmount)}</span>
                  <span className="text-[10px] text-emerald-600 font-bold block">
                    {selectedTx.paymentId} {selectedTx.systems?.payment?.isMatched ? '✅' : '🚨'}
                  </span>
                </div>

                {/* 3. REFUND SERVICE */}
                <div className={`p-3.5 rounded-2xl border space-y-1 ${
                  selectedTx.refundedAmount > selectedTx.capturedAmount
                    ? 'bg-rose-50 border-rose-200'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">3. Refund Service</span>
                  <span className={`text-base font-black block ${
                    selectedTx.refundedAmount > selectedTx.capturedAmount ? 'text-rose-600' : 'text-slate-900'
                  }`}>
                    {formatRupees(selectedTx.refundedAmount)}
                  </span>
                  <span className="text-[10px] font-bold block">
                    {selectedTx.refundedAmount > selectedTx.capturedAmount ? '🚨 OVER-REFUNDED' : '✅ PROCESSED'}
                  </span>
                </div>

                {/* 4. MERCHANT LEDGER */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">4. Merchant Ledger</span>
                  <span className="text-base font-black text-slate-900 block">{formatRupees(selectedTx.capturedAmount - selectedTx.refundedAmount)}</span>
                  <span className="text-[10px] text-amber-600 font-bold block">
                    Status: {selectedTx.ledgerStatus} ⚠️
                  </span>
                </div>
              </div>

              {/* Mismatch & Leakage Summary Banner */}
              <div className={`p-4 rounded-2xl border ${
                selectedTx.reconciliationStatus === 'MISMATCHED'
                  ? 'bg-rose-50/80 border-rose-200 text-rose-800'
                  : 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
              }`}>
                <div className="flex items-center space-x-2 font-bold">
                  {selectedTx.reconciliationStatus === 'MISMATCHED' ? (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>{selectedTx.reconciliationStatus === 'MISMATCHED' ? 'MISMATCH DETECTED' : 'MATCHED TIE-OUT'}</span>
                </div>
                {selectedTx.reconciliationStatus === 'MISMATCHED' && (
                  <div className="mt-2 space-y-1 text-xs font-medium">
                    <p className="font-bold text-rose-700">
                      Potential leakage: {formatRupees(Math.max(0, selectedTx.refundedAmount - selectedTx.capturedAmount))}
                    </p>
                    <p className="text-slate-600">
                      Reason: {selectedTx.anomalyReason === 'DUPLICATE_REFUND' ? 'Multiple refund requests processed on payment.' : 'Refund amount exceeds captured payment amount.'}
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
