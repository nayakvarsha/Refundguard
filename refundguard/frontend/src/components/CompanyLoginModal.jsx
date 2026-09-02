import React, { useState } from 'react';
import { X, Building2, CheckCircle2, AlertCircle, PlusCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function CompanyLoginModal({ isOpen, onClose, companies, currentCompany, onSelectCompany, onRegisterCompany }) {
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  if (!isOpen) return null;

  const handleSignupSubmit = (e) => {
    e.preventDefault();
    if (!newName || !newEmail) return;
    onRegisterCompany(newName, newEmail);
    setIsSigningUp(false);
    setNewName('');
    setNewEmail('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {isSigningUp ? 'Step 2: Sign Up New Company' : 'Select Active Merchant Account'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">Multi-Tenant Isolated Data Isolation</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 text-xs text-slate-700">
          
          {!isSigningUp ? (
            <div className="space-y-4">
              <p className="text-slate-600 font-medium">
                Select a merchant account to filter all dashboard views, incidents, and reconciliation data:
              </p>

              <div className="space-y-2.5">
                {companies.map((comp) => {
                  const isSelected = currentCompany?.id === comp.id;
                  const isConnected = comp.connectionStatus === 'CONNECTED';

                  return (
                    <div
                      key={comp.id}
                      onClick={() => {
                        onSelectCompany(comp);
                        onClose();
                      }}
                      className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20'
                          : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-800 shadow-2xs">
                          {comp.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
                            <span>{comp.name}</span>
                            {isSelected && <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full">ACTIVE</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">{comp.email}</div>
                        </div>
                      </div>

                      {/* Connection Health Indicator */}
                      <div className="flex items-center space-x-2">
                        {isConnected ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                            <span>CONNECTED</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            KEYS PENDING
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setIsSigningUp(true)}
                className="w-full py-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-blue-600 font-extrabold text-xs transition flex items-center justify-center space-x-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Register New Company</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Swiggy, Zomato, Nykaa"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">Finance Contact Email</label>
                <input
                  type="email"
                  required
                  placeholder="finance@merchant.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setIsSigningUp(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Back to List
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-sm transition"
                >
                  Create Account & Connect
                </button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}
