import React from 'react';
import { RefreshCw, Download, Lock, User, LogOut } from 'lucide-react';

function CustomRefundGuardLogo({ className = "w-6 h-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M12 2L4 5.5V11.5C4 16.5 7.4 20.8 12 22C16.6 20.8 20 16.5 20 11.5V5.5L12 2Z"
        fill="url(#shield-grad)"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 10C9.5 8.6 10.6 7.5 12 7.5C13.4 7.5 14.5 8.6 12.6 12.4L9 13.5H15"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 15.5L11 17.5L15.5 13"
        stroke="#4ade80"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="shield-grad" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#1E1B4B" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Navbar({
  activeTab,
  setActiveTab,
  userRole,
  currentUser,
  sessionToken,
  currentCompany,
  onOpenUnifiedLoginModal,
  onLogout,
  onRefreshData,
  isRefreshing
}) {
  const isAdmin = userRole === 'ADMIN';

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'live', label: '⚡ Live Detection' },
    { id: 'incidents', label: 'Incidents & Exceptions' },
    { id: 'reconciliation', label: '4-Way Reconciliation' },
    { id: 'audit', label: 'Audit Trail' },
    { id: 'benchmark', label: 'Benchmark Evaluation' },
    ...(isAdmin ? [{ id: 'admin', label: '👑 Super-Admin' }] : []),
  ];

  const handleDownloadReport = () => {
    const compId = currentCompany?.id || 'COMP-FLIPKART';
    const activeToken = sessionToken || sessionStorage.getItem('refundguard_session_token') || localStorage.getItem('refundguard_session_token');
    const tokenParam = activeToken ? `&token=${encodeURIComponent(activeToken)}` : '';
    window.open(`/api/incidents/export/csv?companyId=${encodeURIComponent(compId)}${tokenParam}`, '_blank');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-8 py-3.5 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* Left: Custom Brand Logo */}
        <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 flex items-center justify-center shadow-lg shadow-blue-500/25 ring-4 ring-blue-500/10 transform group-hover:scale-105 transition-all duration-200">
              <CustomRefundGuardLogo className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-400"></span>
          </div>

          <div>
            <span className="font-black text-xl tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
              RefundGuard
            </span>
            <span className="text-[10px] text-slate-500 font-medium block">
              {isAdmin ? 'Super-Admin Mode' : 'Multi-Company SaaS'}
            </span>
          </div>
        </div>

        {/* Center: Navigation Tabs */}
        <nav className="flex items-center space-x-1 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Right: Action Buttons in exact requested order: User/Login -> Refresh -> Download CSV */}
        <div className="flex items-center space-x-2">
          
          {/* 1. Logged-in User profile badge or Guest Log In Button */}
          {sessionToken || currentUser ? (
            <div className="flex items-center space-x-2 bg-blue-50/80 border border-blue-200/80 px-3 py-1.5 rounded-xl">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs font-bold text-blue-950">
                {currentUser?.username || (isAdmin ? 'Admin' : 'Logged In')}
              </span>
              <button
                onClick={onLogout}
                className="ml-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                title="Log Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenUnifiedLoginModal}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold transition flex items-center space-x-1.5 shadow-md shadow-blue-600/30 cursor-pointer"
              title="Log in or switch account"
            >
              <Lock className="w-3.5 h-3.5 text-white" />
              <span>Log In</span>
            </button>
          )}

          {/* 2. Refresh Button */}
          <button
            onClick={onRefreshData}
            disabled={isRefreshing}
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs hover:border-blue-300 cursor-pointer"
            title="Re-run engine analysis"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>

          {/* 3. Download CSV Button */}
          <button
            onClick={handleDownloadReport}
            className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-extrabold transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
            title="Download company incident report as CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Download CSV</span>
          </button>

        </div>

      </div>
    </header>
  );
}
