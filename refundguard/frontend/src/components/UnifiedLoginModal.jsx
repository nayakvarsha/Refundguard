import React, { useState } from 'react';
import { X, ShieldCheck, User, KeyRound, CheckCircle2 } from 'lucide-react';

export default function UnifiedLoginModal({ isOpen, onClose, onLoginSuccess }) {
  const role = 'ADMIN';

  // Form Fields
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const resetFormState = () => {
    setError('');
    setSuccessMsg('');
  };

  // Handle Administrator Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    resetFormState();

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role: 'ADMIN' }),
      });
      const data = await res.json();

      if (data.ok && data.token) {
        onLoginSuccess(data);
        setPassword('');
        onClose();
      } else {
        setError(data.error || 'Authentication failed. Please check administrator credentials.');
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl border bg-purple-50 border-purple-200 text-purple-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Administrator Portal Login</h3>
              <p className="text-xs text-slate-500 font-medium">RefundGuard System Administration</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs text-slate-700">
          
          {/* Administrator Badge */}
          <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 font-medium flex items-center space-x-2.5">
            <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
            <div className="text-[11px] leading-tight">
              <span className="font-extrabold block text-purple-900">Administrator Access</span>
              Enter system administrator credentials to access platform controls.
            </div>
          </div>

          {/* Alert Messages */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px]">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[11px] flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ADMINISTRATOR LOGIN FORM */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>Admin Username</span>
              </label>
              <input
                type="text"
                required
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-900 font-bold focus:outline-none focus:border-purple-500 focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                <span>Admin Password</span>
              </label>

              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-900 font-bold focus:outline-none focus:border-purple-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl text-white font-extrabold bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-600/20 transition"
              >
                {loading ? 'Authenticating...' : 'Log In as Administrator'}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
