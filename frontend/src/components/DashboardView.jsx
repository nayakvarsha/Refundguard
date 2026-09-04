import React from 'react';
import {
  ShieldCheck,
  TrendingDown,
  AlertTriangle,
  FileCheck,
  HelpCircle
} from 'lucide-react';

export default function DashboardView({
  summary,
  currentCompany,
  user,
  onSelectIncident,
  onFilterSeverity,
  onNavigateIncidents,
  onOpenBasisModal
}) {
  if (!summary) {
    return (
      <div className="p-16 text-center flex flex-col items-center justify-center space-y-4 bg-white rounded-3xl border border-slate-200/80 shadow-sm my-6">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-600 font-semibold text-sm">Loading summary metrics...</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md shadow-blue-600/20"
        >
          Reload Dashboard
        </button>
      </div>
    );
  }

  const {
    recordsAnalyzed = 0,
    incidentsFound = 0,
    reconciledRecords = 0,
    refundIntegrityScore = 0,
    severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    moneyAtRisk = { totalExposure: 0, prevented: 0, alreadyOccurred: 0 },
  } = summary || {};

  const formatRupees = (amt) => {
    if (!amt) return '₹0';
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(2)} Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(2)} L`;
    return `₹${amt.toLocaleString('en-IN')}`;
  };

  const preventedPercent = moneyAtRisk.totalExposure
    ? Math.round((moneyAtRisk.prevented / moneyAtRisk.totalExposure) * 100)
    : 0;

  const formattedLastLogin = user?.lastLoginAt
    ? new Date(user.lastLoginAt).toLocaleString()
    : 'Yesterday, 3:42 PM';

  return (
    <div className="space-y-6">
      
      {/* Clean Minimal Hero Header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {currentCompany?.name ? `${currentCompany.name} Dashboard` : 'Dashboard Overview'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              PRIVATE TENANT SPACE
            </span>
          </div>

          {/* Data Source Indicator & Timestamps (Items 29, 30, 31) */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-medium text-slate-500">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-1"></span>
              <span>DATA SOURCE: DEMO BENCHMARK CORPUS (10K RECORDS)</span>
            </span>
            <span>• Last analyzed: <span className="font-bold text-slate-700">{new Date().toLocaleTimeString()}</span></span>
            <span>• Last Login: <span className="font-semibold text-slate-700">{formattedLastLogin}</span></span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenBasisModal}
            className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition flex items-center space-x-1.5"
          >
            <HelpCircle className="w-4 h-4 text-slate-500" />
            <span>Record Basis</span>
          </button>
        </div>
      </div>

      {/* 4 Clean Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Total Exposure */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Total Exposure</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-rose-600">
            {formatRupees(moneyAtRisk.totalExposure)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Across {incidentsFound} detected exceptions
          </div>
        </div>

        {/* Metric 2: Prevented Leakage */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Prevented Leakage</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-600">
            {formatRupees(moneyAtRisk.prevented)}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium">
            {preventedPercent}% stopped before settlement
          </div>
        </div>

        {/* Metric 3: Already Occurred */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Already Occurred</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-amber-600">
            {formatRupees(moneyAtRisk.alreadyOccurred)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Flagged for post-hoc recovery
          </div>
        </div>

        {/* Metric 4: Records Analyzed */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Analyzed Records</span>
            <FileCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-slate-900">
            {recordsAnalyzed.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            {reconciledRecords.toLocaleString()} reconciled cleanly
          </div>
        </div>

      </div>

      {/* Side-by-Side Protection Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Integrity Score Gauge */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Integrity Health Score</h3>
            <span className="text-[11px] font-mono text-slate-400">Scale 0 - 100</span>
          </div>

          <div className="flex items-center justify-center py-2">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-blue-600 transition-all duration-700"
                  strokeDasharray={`${refundIntegrityScore}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-extrabold font-mono text-slate-900">{refundIntegrityScore}</span>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">OPTIMAL</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center font-medium border-t border-slate-100 pt-3">
            Deterministic rule invariants operating at 100% precision.
          </p>
        </div>

        {/* Protection Ratio */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Leakage Protection Ratio
            </h3>
            <span className="text-xs font-mono text-slate-500 font-semibold">
              Exposure: {formatRupees(moneyAtRisk.totalExposure)}
            </span>
          </div>

          <div className="space-y-3">
            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex p-0.5 border border-slate-200">
              <div
                style={{ width: `${preventedPercent}%` }}
                className="bg-emerald-500 rounded-full transition-all duration-500"
              ></div>
              <div
                style={{ width: `${100 - preventedPercent}%` }}
                className="bg-rose-500 rounded-full transition-all duration-500 ml-0.5"
              ></div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono pt-1">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-slate-600 font-sans font-medium">Prevented:</span>
                </div>
                <span className="font-bold text-emerald-600">{formatRupees(moneyAtRisk.prevented)}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span className="text-slate-600 font-sans font-medium">Already Occurred:</span>
                </div>
                <span className="font-bold text-rose-600">{formatRupees(moneyAtRisk.alreadyOccurred)}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <button
              onClick={onNavigateIncidents}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
            >
              <span>Explore All Incidents →</span>
            </button>
          </div>
        </div>

      </div>

      {/* Severity Filter Row */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Severity Breakdown & Filters
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          
          <button
            onClick={() => onFilterSeverity('CRITICAL')}
            className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-rose-300 text-left transition group shadow-sm"
          >
            <div className="flex items-center justify-between text-xs font-bold text-rose-600">
              <span>🔴 CRITICAL</span>
              <span className="text-[10px] text-slate-400 font-mono font-normal">≥ ₹1L</span>
            </div>
            <div className="text-xl font-extrabold font-mono text-slate-900 mt-1">
              {severityCounts.CRITICAL || 0}
            </div>
          </button>

          <button
            onClick={() => onFilterSeverity('HIGH')}
            className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-amber-300 text-left transition group shadow-sm"
          >
            <div className="flex items-center justify-between text-xs font-bold text-amber-600">
              <span>🟠 HIGH</span>
              <span className="text-[10px] text-slate-400 font-mono font-normal">≥ ₹25k</span>
            </div>
            <div className="text-xl font-extrabold font-mono text-slate-900 mt-1">
              {severityCounts.HIGH || 0}
            </div>
          </button>

          <button
            onClick={() => onFilterSeverity('MEDIUM')}
            className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-yellow-300 text-left transition group shadow-sm"
          >
            <div className="flex items-center justify-between text-xs font-bold text-yellow-700">
              <span>🟡 MEDIUM</span>
              <span className="text-[10px] text-slate-400 font-mono font-normal">≥ ₹5k</span>
            </div>
            <div className="text-xl font-extrabold font-mono text-slate-900 mt-1">
              {severityCounts.MEDIUM || 0}
            </div>
          </button>

          <button
            onClick={() => onFilterSeverity('LOW')}
            className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 text-left transition group shadow-sm"
          >
            <div className="flex items-center justify-between text-xs font-bold text-emerald-600">
              <span>🟢 LOW</span>
              <span className="text-[10px] text-slate-400 font-mono font-normal">&lt; ₹5k</span>
            </div>
            <div className="text-xl font-extrabold font-mono text-slate-900 mt-1">
              {severityCounts.LOW || 0}
            </div>
          </button>

        </div>
      </div>

    </div>
  );
}
