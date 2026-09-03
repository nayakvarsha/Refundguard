import React, { useState, useEffect } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { fetchAuditLogs } from '../api/client';

export default function AuditTrailView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = () => {
    setLoading(true);
    fetchAuditLogs(100)
      .then((data) => {
        setLogs(data.logs || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load audit logs:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
            <History className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">RefundGuard Complete Audit Trail</h2>
            <p className="text-xs text-slate-500 font-medium">
              Immutable event sequence tracking: Payment Events → Invariant Violations → AI Evaluations → Policy Gate Decisions
            </p>
          </div>
        </div>

        <button
          onClick={loadLogs}
          className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center space-x-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
          <span>Refresh Trail</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        {loading ? (
          <div className="p-8 text-center text-slate-500 font-mono text-xs">
            Loading chronological audit events...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-mono text-xs">
            No audit events recorded yet. Run live demo or re-execute engine to generate logs.
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-200 pl-6 ml-4 space-y-6">
            {logs.map((log) => (
              <div key={log.id} className="relative group">
                {/* Point Node */}
                <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-blue-600 ring-4 ring-white group-hover:scale-125 transition"></div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                      {log.eventType}
                    </span>
                    <span className="font-mono text-slate-500 text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-800 font-sans font-medium">{log.details}</p>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Order: {log.orderId}</span>
                    <span>Actor: {log.actor}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
