import React, { useState, useEffect } from 'react';
import { X, Key, Copy, Check, ShieldCheck, Link2, Zap, Lock, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export default function CompanyConnectionModal({ isOpen, onClose, company, onSaveConnection }) {
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [copied, setCopied] = useState(false);
  const [isConnectingOAuth, setIsConnectingOAuth] = useState(false);
  const [isConnectedOAuth, setIsConnectedOAuth] = useState(false);
  const [showManualKeys, setShowManualKeys] = useState(false);

  // Test Connection State (Item 7 & 26!)
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (company?.id) {
      const sessionToken = sessionStorage.getItem('refundguard_session_token');
      fetch(`/api/companies/${company.id}/connection`, {
        headers: sessionToken ? { 'x-session-token': sessionToken } : {},
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.connection) {
            setKeyId(data.connection.razorpayKeyId || '');
            setKeySecret(data.connection.razorpayKeySecret || '');
            setWebhookSecret(data.connection.webhookSecret || '');
            if (data.connection.status === 'CONNECTED' || data.connection.status === 'DEMO_CONNECTED') {
              setIsConnectedOAuth(true);
            }
          }
        })
        .catch((err) => console.error('Failed to load company connection:', err));
    }
  }, [company]);

  if (!isOpen || !company) return null;

  const webhookUrl = `${window.location.origin}/api/webhooks/company/${company.id}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOAuthConnect = async () => {
    setIsConnectingOAuth(true);
    try {
      const sessionToken = sessionStorage.getItem('refundguard_session_token');
      const res = await fetch(`/api/companies/${company.id}/oauth`, {
        method: 'POST',
        headers: sessionToken ? { 'x-session-token': sessionToken } : {},
      });
      const data = await res.json();
      if (data.ok) {
        setIsConnectedOAuth(true);
        onSaveConnection(company.id, {});
      }
    } catch (err) {
      console.error('OAuth connection error:', err);
    } finally {
      setIsConnectingOAuth(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const sessionToken = sessionStorage.getItem('refundguard_session_token');
      const res = await fetch(`/api/companies/${company.id}/test-connection`, {
        method: 'POST',
        headers: sessionToken ? { 'x-session-token': sessionToken } : {},
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmitManual = (e) => {
    e.preventDefault();
    const secretLooksMasked = /^\*+/.test(keySecret);
    onSaveConnection(company.id, {
      razorpayKeyId: keyId,
      ...(secretLooksMasked ? {} : { razorpayKeySecret: keySecret }),
      webhookSecret,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-extrabold text-slate-900">Razorpay Payment Gateway Connection</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                  TEST MODE
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Merchant: <span className="text-blue-600 font-bold">{company.name}</span></p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-xs text-slate-700">
          
          {/* Primary Recommended: One-Click Razorpay Partner OAuth Button */}
          <div className="p-5 rounded-2xl bg-blue-50/80 border border-blue-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-blue-700 font-extrabold text-sm">
                <Zap className="w-4 h-4 text-blue-600" />
                <span>Recommended: Demo / Simulated Razorpay OAuth</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                SIMULATED OAUTH
              </span>
            </div>

            <p className="text-slate-600 leading-relaxed font-medium">
              Connect your Razorpay merchant account via Partner OAuth without typing raw secret API keys into web forms.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleOAuthConnect}
                disabled={isConnectingOAuth}
                className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-xs shadow-md transition flex items-center justify-center space-x-2 ${
                  isConnectedOAuth
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 cursor-pointer'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>
                  {isConnectingOAuth
                    ? 'Authenticating...'
                    : isConnectedOAuth
                    ? '✓ Connected (Demo OAuth)'
                    : '⚡ Connect with Razorpay'}
                </span>
              </button>

              {/* Item 7 & 26: Test Connection Button */}
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="py-3 px-4 rounded-xl font-extrabold text-xs bg-slate-800 hover:bg-slate-900 text-white shadow-sm transition flex items-center justify-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
              </button>
            </div>

            {/* Test Connection Output */}
            {testResult && (
              <div className={`p-3 rounded-xl text-xs font-bold flex items-center space-x-2 border ${
                testResult.ok
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                {testResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                <span>{testResult.message || testResult.error}</span>
              </div>
            )}
          </div>

          {/* Dedicated Webhook Address Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-800 flex items-center space-x-1.5">
                <Link2 className="w-4 h-4 text-blue-600" />
                <span>Your Dedicated Webhook Address</span>
              </span>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-blue-600 hover:bg-blue-600 hover:text-white transition text-[11px] font-bold flex items-center space-x-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy URL'}</span>
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-slate-200 font-mono text-[11px] text-slate-900 select-all font-bold break-all">
              {webhookUrl}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Webhook URL is reachable locally on dev or externally via a supported public HTTPS endpoint (e.g. ngrok).
            </p>
          </div>

          {/* Optional Collapsible Manual Keys Form */}
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowManualKeys(!showManualKeys)}
              className="text-slate-500 hover:text-slate-800 text-[11px] font-bold underline"
            >
              {showManualKeys ? 'Hide Manual API Key Form' : 'Show Advanced Manual API Key Entry (Demo Sandbox)'}
            </button>

            {showManualKeys && (
              <form onSubmit={handleSubmitManual} className="mt-3 space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Razorpay Key ID</label>
                  <input
                    type="text"
                    value={keyId}
                    onChange={(e) => setKeyId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-900 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Razorpay Key Secret</label>
                  <input
                    type="password"
                    value={keySecret}
                    onChange={(e) => setKeySecret(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-900 font-bold"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
                >
                  Save Manual Keys
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
