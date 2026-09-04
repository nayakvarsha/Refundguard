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
    const storedComp = sessionStorage.getItem('refundguard_company') || localStorage.getItem('refundguard_company');
    return storedComp ? JSON.parse(storedComp) : null;
  });

  // Session & Auth State
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem('refundguard_session_token') || localStorage.getItem('refundguard_session_token') || '');
  const [userRole, setUserRole] = useState(() => sessionStorage.getItem('refundguard_user_role') || localStorage.getItem('refundguard_user_role') || 'COMPANY');
  const [currentUser, setCurrentUser] = useState(() => {
    const stored = sessionStorage.getItem('refundguard_user') || localStorage.getItem('refundguard_user');
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
  const loadData = async (comp = currentCompany, overrideToken = null) => {
    setIsRefreshing(true);
    try {
      const health = await fetchHealth();
      setIsConnected(Boolean(health.backendConnected));

      const targetCompId = comp?.id || 'COMP-FLIPKART';
      const activeToken = overrideToken || sessionToken || localStorage.getItem('refundguard_session_token') || sessionStorage.getItem('refundguard_session_token');

      const headers = activeToken ? {
        'x-session-token': activeToken,
        'Authorization': `Bearer ${activeToken}`,
      } : {};

      const sumRes = await fetch(`/api/summary?companyId=${targetCompId}`, { headers });
      const sumData = await sumRes.json();

      if (sumRes.ok && sumData && !sumData.error) {
        setSummary(sumData);
      } else {
        const fallbackRes = await fetch('/api/summary', { headers });
        const fallbackData = await fallbackRes.json();
        setSummary(fallbackData);
      }
    } catch (err) {
      console.error('API connection failed:', err);
      setIsConnected(false);
      try {
        const fallbackRes = await fetch('/api/summary');
        const fallbackData = await fallbackRes.json();
        setSummary(fallbackData);
      } catch (fErr) {
        setSummary({
          recordsAnalyzed: 10000,
          incidentsFound: 1000,
          reconciledRecords: 9000,
          refundIntegrityScore: 90.0,
          severityCounts: { CRITICAL: 150, HIGH: 250, MEDIUM: 300, LOW: 300 },
          moneyAtRisk: { totalExposure: 15420000, prevented: 13878000, alreadyOccurred: 1542000 },
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadCompanies();
    loadData(currentCompany);

    const timer = setInterval(() => {
      fetchHealth()
        .then(() => setIsConnected(true))
        .catch(() => setIsConnected(false));
    }, 10000);
    return () => clearInterval(timer);
  }, [currentCompany?.id, sessionToken]);

  const handleSelectCompany = (comp) => {
    setCurrentCompany(comp);
    sessionStorage.setItem('refundguard_company', JSON.stringify(comp));
    localStorage.setItem('refundguard_company', JSON.stringify(comp));
    loadData(comp);
  };

  const handleUnifiedLoginSuccess = (loginData) => {
    const { token, role, user, company } = loginData;
    sessionStorage.setItem('refundguard_session_token', token);
    localStorage.setItem('refundguard_session_token', token);
    sessionStorage.setItem('refundguard_user_role', role);
    localStorage.setItem('refundguard_user_role', role);
    sessionStorage.setItem('refundguard_user', JSON.stringify(user));
    localStorage.setItem('refundguard_user', JSON.stringify(user));

    setSessionToken(token);
    setUserRole(role);
    setCurrentUser(user);

    if (role === 'ADMIN') {
      setActiveTab('admin');
    } else if (company) {
      sessionStorage.setItem('refundguard_company', JSON.stringify(company));
      localStorage.setItem('refundguard_company', JSON.stringify(company));
      setCurrentCompany(company);
      loadData(company, token);
      setActiveTab('dashboard');
    }
  };

  const handleLogout = async () => {
    try {
      const activeToken = sessionToken || localStorage.getItem('refundguard_session_token');
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'x-session-token': activeToken,
          'Authorization': `Bearer ${activeToken}`,
        },
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      sessionStorage.removeItem('refundguard_session_token');
      localStorage.removeItem('refundguard_session_token');
      sessionStorage.removeItem('refundguard_user_role');
      localStorage.removeItem('refundguard_user_role');
      sessionStorage.removeItem('refundguard_user');
      localStorage.removeItem('refundguard_user');
      sessionStorage.removeItem('refundguard_company');
      localStorage.removeItem('refundguard_company');

      setSessionToken('');
      setUserRole('COMPANY');
      setCurrentUser(null);
      setCurrentCompany(null);
      loadData(null);
      setActiveTab('dashboard');
    }
  };

  const handleSaveConnection = async (companyId, keys) => {
    try {
      const activeToken = sessionToken || localStorage.getItem('refundguard_session_token');
      await fetch(`/api/companies/${companyId}/connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': activeToken,
          'Authorization': `Bearer ${activeToken}`,
        },
        body: JSON.stringify(keys),
      });
      await loadCompanies();
    } catch (err) {
      console.error('Failed to save keys:', err);
    }
  };

  const handleOpenConnectionModalForCompany = (comp) => {
    setConnectionModalTarget(comp);
    setIsConnectionModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
        currentUser={currentUser}
        sessionToken={sessionToken}
        currentCompany={currentCompany}
        onOpenUnifiedLoginModal={() => setIsUnifiedLoginOpen(true)}
        onLogout={handleLogout}
        onRefreshData={() => loadData(currentCompany)}
        isRefreshing={isRefreshing}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            summary={summary}
            currentCompany={currentCompany}
            user={currentUser}
            onSelectIncident={(id) => setSelectedIncidentId(id)}
            onFilterSeverity={(sev) => {
              setSeverityFilter(sev);
              setActiveTab('incidents');
            }}
            onNavigateIncidents={() => setActiveTab('incidents')}
            onOpenBasisModal={() => setIsBasisModalOpen(true)}
          />
        )}

        {activeTab === 'live' && (
          <LiveDetectionView
            currentCompany={currentCompany}
            onOpenConnectionModal={() => setIsConnectionModalOpen(true)}
          />
        )}

        {activeTab === 'incidents' && (
          <IncidentsView
            currentCompany={currentCompany}
            sessionToken={sessionToken}
            onSelectIncident={(id) => setSelectedIncidentId(id)}
            initialSeverityFilter={severityFilter}
            onClearInitialSeverity={() => setSeverityFilter('')}
          />
        )}

        {activeTab === 'reconciliation' && (
          <ReconciliationView
            currentCompany={currentCompany}
            sessionToken={sessionToken}
            onOpenImportModal={() => setIsImportModalOpen(true)}
            onOpenConnectionModal={() => setIsConnectionModalOpen(true)}
          />
        )}

        {activeTab === 'audit' && (
          <AuditTrailView
            sessionToken={sessionToken}
            currentCompany={currentCompany}
          />
        )}

        {activeTab === 'benchmark' && (
          <BenchmarkView
            onOpenDemoVideo={() => setIsDemoVideoOpen(true)}
          />
        )}

        {activeTab === 'admin' && (
          <AdminOverviewView
            sessionToken={sessionToken}
            companies={companies}
            onSelectCompany={(comp) => handleSelectCompany(comp)}
            onOpenConnectionModal={(comp) => handleOpenConnectionModalForCompany(comp)}
            onRefreshCompanies={loadCompanies}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-slate-700">RefundGuard v1.0.0</span>
            <span>•</span>
            <span>Multi-Tenant AI Refund Integrity Engine</span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsBasisModalOpen(true)}
              className="hover:text-blue-600 font-semibold cursor-pointer"
            >
              Dataset Basis
            </button>
            <button
              onClick={() => setIsDemoVideoOpen(true)}
              className="hover:text-blue-600 font-semibold cursor-pointer"
            >
              Demo Walkthrough
            </button>
          </div>
        </div>
      </footer>

      {/* Incident Detail Modal */}
      {selectedIncidentId && (
        <IncidentDetailModal
          incidentId={selectedIncidentId}
          sessionToken={sessionToken}
          onClose={() => setSelectedIncidentId(null)}
        />
      )}

      {/* Demo Video Modal */}
      {isDemoVideoOpen && (
        <DemoVideoModal onClose={() => setIsDemoVideoOpen(false)} />
      )}

      {/* Dataset Basis Modal */}
      {isBasisModalOpen && (
        <RecordBasisModal onClose={() => setIsBasisModalOpen(false)} />
      )}

      {/* Unified Login Modal */}
      {isUnifiedLoginOpen && (
        <UnifiedLoginModal
          onClose={() => setIsUnifiedLoginOpen(false)}
          onLoginSuccess={handleUnifiedLoginSuccess}
        />
      )}

      {/* Razorpay Key Settings Modal */}
      {isConnectionModalOpen && (
        <CompanyConnectionModal
          company={connectionModalTarget || currentCompany || { id: 'COMP-FLIPKART', name: 'Flipkart E-Commerce' }}
          onClose={() => {
            setIsConnectionModalOpen(false);
            setConnectionModalTarget(null);
          }}
          onSave={handleSaveConnection}
        />
      )}

      {/* Custom Transaction Import CSV/JSON Modal */}
      {isImportModalOpen && (
        <ImportDataModal
          currentCompany={currentCompany || { id: 'COMP-FLIPKART', name: 'Flipkart E-Commerce' }}
          sessionToken={sessionToken}
          onClose={() => setIsImportModalOpen(false)}
          onImportSuccess={() => loadData(currentCompany)}
        />
      )}
    </div>
  );
}
