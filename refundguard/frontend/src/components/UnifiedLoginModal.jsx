import React, { useState } from 'react';
import { X, Building2, ShieldCheck, User, KeyRound, ArrowRight, CheckCircle2, Key } from 'lucide-react';

export default function UnifiedLoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [role, setRole] = useState('COMPANY'); // 'COMPANY' | 'ADMIN'
  const [viewMode, setViewMode] = useState('LOGIN'); // 'LOGIN' | 'SIGNUP' | 'FORGOT' | 'RESET'

  // Form Fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  
  // Forgot Password state
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const resetFormState = () => {
    setError('');
    setSuccessMsg('');
    setGeneratedCode('');
  };

  // Handle Login (Customer or Admin)
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    resetFormState();

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role }),
      });
      const data = await res.json();

      if (data.ok && data.token) {
        onLoginSuccess(data);
        setPassword('');
        onClose();
      } else {
        setError(data.error || 'Authentication failed.');
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Customer Self-Serve Signup
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    resetFormState();

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: companyName, email, username, password }),
      });
      const data = await res.json();

      if (data.ok) {
        setSuccessMsg('Account created successfully! Logging you in...');
        setTimeout(() => {
          handleLoginSubmit(e);
        }, 1200);
      } else {
        setError(data.error || 'Signup failed.');
      }
    } catch (err) {
      setError('Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Customer Forgot Password Code Request
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    resetFormState();

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: username || email }),
      });
      const data = await res.json();

      if (data.ok && data.resetCode) {
        setGeneratedCode(data.resetCode);
        setResetCode(data.resetCode);
        setViewMode('RESET');
      } else {
        setError(data.error || 'Account not found.');
      }
    } catch (err) {
      setError('Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Customer Reset Password Completion
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    resetFormState();

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: resetCode, newPassword }),
      });
      const data = await res.json();

      if (data.ok) {
        setSuccessMsg('Password updated successfully! You can now log in.');
        setViewMode('LOGIN');
        setPassword(newPassword);
      } else {
        setError(data.error || 'Password reset failed.');
      }
    } catch (err) {
      setError('Reset failed. Please try again.');
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
            <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${
              role === 'ADMIN' ? 'bg-purple-50 border-purple-200 text-purple-600' : 'bg-blue-50 border-blue-200 text-blue-600'
            }`}>
              {role === 'ADMIN' ? <ShieldCheck className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">RefundGuard Portal</h3>
              <p className="text-xs text-slate-500 font-medium">
                {viewMode === 'LOGIN' && 'Unified Access System'}
                {viewMode === 'SIGNUP' && 'Create Customer Account'}
                {viewMode === 'FORGOT' && 'Forgot Password Recovery'}
                {viewMode === 'RESET' && 'Set New Password'}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs text-slate-700">
          
          {/* Role Toggle Pills (Only toggle role when in LOGIN mode) */}
          {viewMode === 'LOGIN' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Select Account Access Role</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setRole('COMPANY');
                    resetFormState();
                  }}
                  className={`py-2 px-3 rounded-xl font-extrabold transition flex items-center justify-center space-x-2 ${
                    role === 'COMPANY'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Customer</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRole('ADMIN');
                    resetFormState();
                  }}
                  className={`py-2 px-3 rounded-xl font-extrabold transition flex items-center justify-center space-x-2 ${
                    role === 'ADMIN'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Administrator</span>
                </button>
              </div>
            </div>
          )}

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

          {/* VIEW 1: LOGIN FORM */}
          {viewMode === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>{role === 'ADMIN' ? 'Admin Username' : 'Customer Username or Email'}</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={role === 'ADMIN' ? 'admin' : 'flipkart or finance@flipkart.com'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-900 font-bold focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                    <span>Password</span>
                  </label>

                  {/* Show "Forgot password?" ONLY when Customer role is selected! */}
                  {role === 'COMPANY' && (
                    <button
                      type="button"
                      onClick={() => {
                        resetFormState();
                        setViewMode('FORGOT');
                      }}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>

                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-900 font-bold focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              {/* Show "Sign up" link ONLY when Customer role is selected! */}
              {role === 'COMPANY' && (
                <div className="pt-1 text-center text-[11px] text-slate-500">
                  New company?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      resetFormState();
                      setViewMode('SIGNUP');
                    }}
                    className="font-extrabold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  >
                    Sign up for a new account
                  </button>
                </div>
              )}

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
                  className={`px-5 py-2.5 rounded-xl text-white font-extrabold shadow-sm transition ${
                    role === 'ADMIN' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loading ? 'Authenticating...' : `Log In as ${role === 'ADMIN' ? 'Administrator' : 'Customer'}`}
                </button>
              </div>
            </form>
          )}

          {/* VIEW 2: CUSTOMER SIGNUP FORM */}
          {viewMode === 'SIGNUP' && (
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Swiggy, Zomato"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">Business Email</label>
                <input
                  type="email"
                  required
                  placeholder="finance@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">Chosen Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. swiggy_finance"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    resetFormState();
                    setViewMode('LOGIN');
                  }}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  ← Back to Login
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-sm"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>
          )}

          {/* VIEW 3: FORGOT PASSWORD FORM */}
          {viewMode === 'FORGOT' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium leading-relaxed">
                Enter your registered Customer Username or Email address to generate a 6-digit recovery code.
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">Username or Email</label>
                <input
                  type="text"
                  required
                  placeholder="flipkart or finance@flipkart.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    resetFormState();
                    setViewMode('LOGIN');
                  }}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  ← Back to Login
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold shadow-sm"
                >
                  {loading ? 'Generating Code...' : 'Get Reset Code'}
                </button>
              </div>
            </form>
          )}

          {/* VIEW 4: RESET PASSWORD FORM */}
          {viewMode === 'RESET' && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              {generatedCode && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold text-center">
                  🔑 Recovery Code Generated: <span className="font-mono text-emerald-700 text-sm tracking-widest">{generatedCode}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">6-Digit Reset Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 849201"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-extrabold text-center tracking-widest text-base"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    resetFormState();
                    setViewMode('LOGIN');
                  }}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  ← Back to Login
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-sm"
                >
                  {loading ? 'Updating Password...' : 'Reset Password'}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
