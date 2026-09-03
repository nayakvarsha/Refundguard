import React, { useState, useEffect } from 'react';
import { ShieldCheck, Building2, Radio, AlertTriangle, RefreshCw, Key, History, CheckCircle2, XCircle } from 'lucide-react';

export default function AdminOverviewView({ adminToken, onSelectCompany, onOpenConnectionModal }) {
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAdminOverview = () => {
    setLoading(true);
    const sessionToken = adminToken || sessionStorage.getItem('refundguard_session_token');
    if (!sessionToken) {
      setLoading(false);
      setAdminData(null);
      return;
    }
    fetch('/api/admin/overview', {
      headers: {
        'x-session-token': sessionToken,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setAdminData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch admin overview:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadAdminOverview();
  }, [adminToken]);

  const formatRupees = (amt) => {
    if (!amt) return '₹0';
    return `₹${amt.toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-extrabold text-slate-900">Platform Super-Admin Command Center</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                PROTECTED SERVER SESSION
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Complete cross-merchant platform overview: Manage onboarded companies, Razorpay connection health, and authentication audit logs.
            </p>
          </div>
        </div>

        <button
          onClick={loadAdminOverview}
          className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
          <span>Refresh Overview</span>
        </button>
      </div>

      {/* Top Stat Row */}
      {adminData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Onboarded Merchants</span>
            <div className="text-2xl font-black text-slate-900">{adminData.totalCompanies} Companies</div>
            <span className="text-[11px] text-emerald-600 font-bold">Multi-tenant Isolation</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Active Connections</span>
            <div className="text-2xl font-black text-emerald-600">{adminData.activeConnections} Connected</div>
            <span className="text-[11px] text-slate-500 font-medium">Verified Razorpay API Keys</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Platform Incidents</span>
            <div className="text-2xl font-black text-rose-600">{adminData.platformTotalIncidents} Flagged</div>
            <span className="text-[11px] text-rose-600 font-bold">Across All Merchants</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Exposure at Risk</span>
            <div className="text-2xl font-black text-rose-600">{formatRupees(adminData.platformTotalExposure)}</div>
            <span className="text-[11px] text-emerald-600 font-bold">100% Intercepted</span>
          </div>
        </div>
      )}

      {/* Companies Grid Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span className="font-mono">All Onboarded Merchants ({adminData?.companies?.length || 0})</span>
          <span>Click any row to switch active merchant dashboard view</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs">
            Loading platform multi-tenant company overview...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 font-mono">
                  <th className="py-3 px-4">Merchant Company</th>
                  <th className="py-3 px-4">Company ID</th>
                  <th className="py-3 px-4">Connection Health</th>
                  <th className="py-3 px-4 text-center">Incidents</th>
                  <th className="py-3 px-4 text-right">Exposure Amount</th>
                  <th className="py-3 px-4">Dedicated Webhook URL</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {adminData?.companies?.map((comp) => {
                  const isConnected = comp.connectionStatus === 'CONNECTED';

                  return (
                    <tr
                      key={comp.id}
                      onClick={() => onSelectCompany(comp)}
                      className="hover:bg-blue-50/50 cursor-pointer transition group"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 group-hover:text-blue-600">
                        <div className="flex items-center space-x-2.5">
                          <Building2 className="w-4 h-4 text-blue-600" />
                          <span>{comp.name}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500">{comp.id}</td>

                      <td className="py-3.5 px-4">
                        {isConnected ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping mr-1"></span>
                            <span>CONNECTED</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            KEYS PENDING
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center font-extrabold text-slate-900">{comp.incidents}</td>

                      <td className="py-3.5 px-4 text-right font-extrabold text-rose-600">{formatRupees(comp.exposure)}</td>

                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px] truncate max-w-[200px]">
                        {comp.webhookUrl}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenConnectionModal(comp);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition font-sans font-bold text-[11px] border border-blue-200 cursor-pointer"
                        >
                          Manage Keys
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Part 2: "Who Logged In, and When" Audit Log Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm space-y-3 p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-sm">
            <History className="w-4 h-4 text-purple-600" />
            <span>Authentication Audit Log (Who Logged In, and When)</span>
          </div>
          <span className="text-xs font-mono text-slate-400">Security Access Signal</span>
        </div>

        {adminData?.loginLogs ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 font-mono">
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Contact Email / Target</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Authentication Result</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {adminData.loginLogs.map((log) => {
                  const isSuccess = log.result === 'SUCCESS';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {log.actor}
                      </td>

                      <td className="py-3 px-4 text-slate-600">{log.email}</td>

                      <td className="py-3 px-4 text-slate-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>

                      <td className="py-3 px-4">
                        {isSuccess ? (
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 mr-1" />
                            <span>✅ SUCCESS</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center space-x-1">
                            <XCircle className="w-3 h-3 text-rose-600 mr-1" />
                            <span>❌ FAILED ATTEMPT</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600 text-[11px]">{log.details}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 font-mono text-xs">
            No authentication audit logs recorded yet.
          </div>
        )}
      </div>

    </div>
  );
}
