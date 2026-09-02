import React, { useState } from 'react';
import { X, Lock, KeyRound } from 'lucide-react';

export default function AdminLoginModal({ isOpen, onClose, onUnlockAdmin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (data.ok && data.token) {
        onUnlockAdmin(data.token);
        onClose();
        setPassword('');
      } else {
        setError(data.error || 'Invalid administrator password');
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
        
        {/* Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center">
              <Lock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Administrator Door Access</h3>
              <p className="text-xs text-slate-500 font-medium">Protected Cross-Merchant Platform View</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs text-slate-700">
          
          <p className="text-slate-600 font-medium leading-relaxed">
            Enter the platform administrator password to authenticate via backend server check and unlock cross-company oversight:
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
              <KeyRound className="w-3.5 h-3.5 text-purple-600" />
              <span>Admin Password</span>
            </label>
            <input
              type="password"
              required
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-900 font-bold focus:outline-none focus:border-purple-500 focus:bg-white"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px]">
              {error}
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold shadow-sm transition"
            >
              {loading ? 'Authenticating...' : 'Unlock Super-Admin View'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
