import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DashboardView from './components/DashboardView';
import LiveDetectionView from './components/LiveDetectionView';
import IncidentsView from './components/IncidentsView';
import ReconciliationView from './components/ReconciliationView';
import AuditTrailView from './components/AuditTrailView';
import BenchmarkView from './components/BenchmarkView';
import AdminOverviewView from './components/AdminOverviewView';
import IncidentDetailModal from './components/IncidentDetailModal';
import DemoVideoModal from './components/DemoVideoModal';
import RecordBasisModal from './components/RecordBasisModal';
import CompanyLoginModal from './components/CompanyLoginModal';
import CompanyConnectionModal from './components/CompanyConnectionModal';
import UnifiedLoginModal from './components/UnifiedLoginModal';
import ImportDataModal from './components/ImportDataModal';
import { fetchHealth, triggerEngineRun } from './api/client';
import { ShieldCheck, Lock, ArrowRight } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isConnected, setIsConnected] = useState(false);
  const [summary, setSummary] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Multi-Company State
  const [companies, setCompanies] = useState([]);
  const [currentCompany, setCurrentCompany] = useState(() => {
    const storedComp = sessionStorage.getItem('refundguard_company');
    return storedComp ? JSON.parse(storedComp) : null;
  });

  // Session & Auth State
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem('refundguard_session_token') || '');
  const [userRole, setUserRole] = useState(() => sessionStorage.getItem('refundguard_user_role') || 'COMPANY');
  const [currentUser, setCurrentUser] = useState(() => {
    const stored = sessionStorage.getItem('refundguard_user');
    return stored ? JSON.parse(stored) : null;
  });

  const [isUnifiedLoginOpen, setIsUnifiedLoginOpen] = useState(false);
  const [isCompanyLoginOpen, setIsCompanyLoginOpen] = useState(false);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [connectionModalTarget, setConnectionModalTarget] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Selected incident for Detail Modal
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [isDemoVideoOpen, setIsDemoVideoOpen] = useState(false);
  const [isBasisModalOpen, setIsBasisModalOpen] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('');

  // Load Companies list
  const loadCompanies = async () => {
    try {
      const res = await fetch('/api/companies');
      const data = await res.json();
      if (data.companies) {
        setCompanies(data.companies);
        if (currentCompany?.id) {
          const active = data.companies.find((c) => c.id === currentCompany.id);
          if (active) setCurrentCompany(active);
        }
      }
    } catch (err) {
      console.error('Failed to load companies list:', err);
    }
  };

  // Initial load & health polling filtered by current company
  const loadData = async (comp = currentCompany) => {
    if (!comp || !comp.id) {
      setSummary(null);
      setIsRefreshing(false);
      return;
    }
    setIsRefreshing(true);
    try {
      const health = await fetchHealth();
      setIsConnected(Boolean(health.backendConnected));

      const sumRes = await fetch(`/api/summary?companyId=${comp.id}`, {
        headers: sessionToken ? { 'x-session-token': sessionToken } : {},
      });
      const sumData = await sumRes.json();

      if (!sumRes.ok) {
        throw new Error(sumData.error || 'Failed to load summary');
      }

      setSummary(sumData);
    } catch (err) {
      console.error('API connection failed:', err);
      setIsConnected(false);
      setSummary(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadCompanies();
    if (currentCompany) {
      loadData(currentCompany);
    }

    const timer = setInterval(() => {
      fetchHealth()
        .then(() => setIsConnected(true))
        .catch(() => setIsConnected(false));
    }, 10000);
    return () => clearInterval(timer);
  }, [currentCompany?.id, sessionToken]);

  const handleSelectCompany = (comp) => {
    sessionStorage.setItem('refundguard_company', JSON.stringify(comp));
    setCurrentCompany(comp);
    loadData(comp);
  };

  const handleUnifiedLoginSuccess = (loginData) => {
    const { token, role, user, company } = loginData;
    sessionStorage.setItem('refundguard_session_token', token);
    sessionStorage.setItem('refundguard_user_role', role);
    sessionStorage.setItem('refundguard_user', JSON.stringify(user));

    setSessionToken(token);
    setUserRole(role);
    setCurrentUser(user);

    if (role === 'ADMIN') {
      setActiveTab('admin');
    } else if (company) {
      sessionStorage.setItem('refundguard_company', JSON.stringify(company));
      setCurrentCompany(company);
      loadData(company);
      setActiveTab('dashboard');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'x-session-token': sessionToken },
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      sessionStorage.removeItem('refundguard_session_token');
      sessionStorage.removeItem('refundguard_user_role');
      sessionStorage.removeItem('refundguard_user');
      sessionStorage.removeItem('refundguard_company');

      setSessionToken('');
      setUserRole('COMPANY');
      setCurrentUser(null);
      setCurrentCompany(null);
      setSummary(null);
      setActiveTab('dashboard');
    }
  };

  const handleSaveConnection = async (companyId, keys) => {
    try {
      await fetch(`/api/companies/${companyId}/connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': sessionToken,
        },
        body: JSON.stringify(keys),
      });
      await loadCompanies();
    } catch (err) {
      console.error('Failed to save keys:', err);
    }
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      await triggerEngineRun();
      if (currentCompany) {
        await loadData(currentCompany);
      }
    } catch (err) {
      console.error('Error refreshing engine:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 selection:bg-blue-500 selection:text-white pb-12">
      
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
        currentCompany={currentCompany}
        onOpenUnifiedLoginModal={() => setIsUnifiedLoginOpen(true)}
        onRefreshData={handleRefreshData}
        isRefreshing={isRefreshing}
      />

      {/* Main View Area */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-6">
        {/* If no company selected and not logged in as Admin */}
        {!currentCompany && userRole !== 'ADMIN' && (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center max-w-2xl mx-auto shadow-sm space-y-6 my-12">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto text-blue-600">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900">Welcome to RefundGuard</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Log in with your company account or sign up to connect your Razorpay integration and monitor refund integrity live.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                onClick={() => setIsUnifiedLoginOpen(true)}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-600/30 transition flex items-center space-x-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Log In / Sign Up</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* Dashboard View */}
        {activeTab === 'dashboard' && currentCompany && (
          <DashboardView
            summary={summary}
            currentCompany={currentCompany}
            currentUser={currentUser}
            sessionToken={sessionToken}
            onSelectCompany={handleSelectCompany}
            onSelectIncident={(id) => setSelectedIncidentId(id)}
            onOpenConnectionModal={() => {
              setConnectionModalTarget(currentCompany);
              setIsConnectionModalOpen(true);
            }}
            onWatchDemo={() => setIsDemoVideoOpen(true)}
            onOpenBasisModal={() => setIsBasisModalOpen(true)}
            onNavigateIncidents={(severity) => {
              setSeverityFilter(severity);
              setActiveTab('incidents');
            }}
          />
        )}

        {/* Live Webhook Suite */}
        {activeTab === 'live' && (
          <LiveDetectionView
            currentCompany={currentCompany}
            sessionToken={sessionToken}
            onSelectIncident={(id) => setSelectedIncidentId(id)}
          />
        )}

        {/* Incidents & Exceptions View */}
        {activeTab === 'incidents' && currentCompany && (
          <IncidentsView
            currentCompany={currentCompany}
            sessionToken={sessionToken}
            severityFilter={severityFilter}
            onSelectIncident={(id) => setSelectedIncidentId(id)}
          />
        )}

        {/* 4-Way Reconciliation View */}
        {activeTab === 'reconciliation' && (
          <ReconciliationView
            currentCompany={currentCompany}
            sessionToken={sessionToken}
            onOpenImportModal={() => setIsImportModalOpen(true)}
            onOpenConnectionModal={() => {
              setConnectionModalTarget(currentCompany);
              setIsConnectionModalOpen(true);
            }}
          />
        )}

        {/* Audit Trail View */}
        {activeTab === 'audit' && <AuditTrailView />}

        {/* Benchmark Evaluation Set View */}
        {activeTab === 'benchmark' && <BenchmarkView />}

        {/* Super-Admin Command Center */}
        {activeTab === 'admin' && (
          <AdminOverviewView
            adminToken={sessionToken}
            onSelectCompany={(comp) => {
              handleSelectCompany(comp);
              setActiveTab('dashboard');
            }}
            onOpenConnectionModal={(comp) => {
              setConnectionModalTarget(comp);
              setIsConnectionModalOpen(true);
            }}
          />
        )}
      </main>

      {/* Modals */}
      {selectedIncidentId && (
        <IncidentDetailModal
          incidentId={selectedIncidentId}
          onClose={() => setSelectedIncidentId(null)}
        />
      )}

      {isDemoVideoOpen && (
        <DemoVideoModal onClose={() => setIsDemoVideoOpen(false)} />
      )}

      {isBasisModalOpen && (
        <RecordBasisModal onClose={() => setIsBasisModalOpen(false)} />
      )}

      {isCompanyLoginOpen && (
        <CompanyLoginModal
          isOpen={isCompanyLoginOpen}
          onClose={() => setIsCompanyLoginOpen(false)}
          onRegister={() => {}}
        />
      )}

      {isConnectionModalOpen && (
        <CompanyConnectionModal
          isOpen={isConnectionModalOpen}
          company={connectionModalTarget}
          onClose={() => setIsConnectionModalOpen(false)}
          onSaveConnection={handleSaveConnection}
        />
      )}

      {isUnifiedLoginOpen && (
        <UnifiedLoginModal
          isOpen={isUnifiedLoginOpen}
          onClose={() => setIsUnifiedLoginOpen(false)}
          onLoginSuccess={handleUnifiedLoginSuccess}
        />
      )}

      {isImportModalOpen && currentCompany && (
        <ImportDataModal
          isOpen={isImportModalOpen}
          company={currentCompany}
          sessionToken={sessionToken}
          onClose={() => setIsImportModalOpen(false)}
          onUploadSuccess={() => {
            loadData(currentCompany);
          }}
        />
      )}

    </div>
  );
}
