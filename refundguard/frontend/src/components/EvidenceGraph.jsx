import React from 'react';
import { ShoppingBag, CreditCard, RotateCcw, AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';

export default function EvidenceGraph({ graphData, exposure }) {
  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        No graph data available for this incident.
      </div>
    );
  }

  const { nodes, edges } = graphData;

  const nodeIcon = (type) => {
    switch (type) {
      case 'ORDER':
        return <ShoppingBag className="w-5 h-5 text-blue-400" />;
      case 'PAYMENT':
        return <CreditCard className="w-5 h-5 text-cyan-400" />;
      case 'REFUND':
        return <RotateCcw className="w-5 h-5 text-purple-400" />;
      case 'VIOLATION':
        return <AlertTriangle className="w-5 h-5 text-rose-400" />;
      default:
        return <ShieldAlert className="w-5 h-5 text-indigo-400" />;
    }
  };

  const nodeColor = (type) => {
    switch (type) {
      case 'ORDER':
        return 'bg-blue-950/60 border-blue-500/30 text-blue-200';
      case 'PAYMENT':
        return 'bg-cyan-950/60 border-cyan-500/30 text-cyan-200';
      case 'REFUND':
        return 'bg-purple-950/60 border-purple-500/30 text-purple-200';
      case 'VIOLATION':
        return 'bg-rose-950/80 border-rose-500/50 text-rose-200 ring-2 ring-rose-500/30';
      default:
        return 'bg-slate-900 border-slate-700 text-slate-200';
    }
  };

  // Organize nodes by type columns for horizontal pipeline layout
  const orderNodes = nodes.filter((n) => n.type === 'ORDER');
  const paymentNodes = nodes.filter((n) => n.type === 'PAYMENT');
  const refundNodes = nodes.filter((n) => n.type === 'REFUND');
  const violationNodes = nodes.filter((n) => n.type === 'VIOLATION');

  const formatRupees = (amt) => {
    if (!amt) return '';
    return `₹${amt.toLocaleString('en-IN')}`;
  };

  return (
    <div className="w-full bg-[#0d1322] border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden shadow-inner">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-indigo-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Interactive Transaction Topology (Evidence Graph)
          </h4>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Pipeline Flow: Order → Payment → Refund → Invariant Gate
        </div>
      </div>

      {/* Responsive Horizontal Pipeline Flow */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4 relative z-10">
        
        {/* Column 1: Order */}
        <div className="flex flex-col space-y-3 w-full md:w-1/4">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">1. Customer Order</div>
          {orderNodes.map((n) => (
            <div key={n.id} className={`p-3.5 rounded-xl border ${nodeColor(n.type)} shadow-lg flex flex-col space-y-1`}>
              <div className="flex items-center space-x-2">
                {nodeIcon(n.type)}
                <span className="font-mono text-xs font-bold text-white">{n.label}</span>
              </div>
              <span className="text-[11px] text-slate-400">{n.subtitle || 'Order Origin'}</span>
            </div>
          ))}
        </div>

        <ArrowRight className="w-5 h-5 text-slate-600 hidden md:block shrink-0" />

        {/* Column 2: Payment */}
        <div className="flex flex-col space-y-3 w-full md:w-1/4">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">2. Payment Capture</div>
          {paymentNodes.length > 0 ? (
            paymentNodes.map((n) => (
              <div key={n.id} className={`p-3.5 rounded-xl border ${nodeColor(n.type)} shadow-lg flex flex-col space-y-1`}>
                <div className="flex items-center space-x-2">
                  {nodeIcon(n.type)}
                  <span className="font-mono text-xs font-bold text-white">{n.label}</span>
                </div>
                <span className="text-[11px] text-slate-400">{n.subtitle || 'Razorpay Gateway'}</span>
              </div>
            ))
          ) : (
            <div className="p-3.5 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 text-slate-500 text-xs text-center font-mono">
              [No Matching Payment]
            </div>
          )}
        </div>

        <ArrowRight className="w-5 h-5 text-slate-600 hidden md:block shrink-0" />

        {/* Column 3: Refunds */}
        <div className="flex flex-col space-y-3 w-full md:w-1/4">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">3. Refund Event(s)</div>
          {refundNodes.map((n, idx) => (
            <div key={n.id} className={`p-3 rounded-xl border ${nodeColor(n.type)} shadow-lg flex flex-col space-y-1`}>
              <div className="flex items-center space-x-2">
                {nodeIcon(n.type)}
                <span className="font-mono text-xs font-bold text-white truncate">{n.label}</span>
              </div>
              <span className="text-[11px] text-slate-400">{n.subtitle || `Refund Event #${idx + 1}`}</span>
            </div>
          ))}
        </div>

        <ArrowRight className="w-5 h-5 text-rose-500/80 hidden md:block shrink-0 animate-pulse" />

        {/* Column 4: Invariant Violation */}
        <div className="flex flex-col space-y-3 w-full md:w-1/4">
          <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider text-center">4. Invariant Exception</div>
          {violationNodes.map((n) => (
            <div key={n.id} className={`p-4 rounded-xl border ${nodeColor(n.type)} shadow-xl flex flex-col space-y-2`}>
              <div className="flex items-center space-x-2">
                {nodeIcon(n.type)}
                <span className="font-bold text-xs text-rose-200">{n.label}</span>
              </div>
              {n.exposureAmount && (
                <div className="mt-1 pt-2 border-t border-rose-500/20 flex justify-between items-center">
                  <span className="text-[11px] text-slate-400">Proven Exposure:</span>
                  <span className="text-xs font-bold font-mono text-rose-300">{formatRupees(n.exposureAmount)}</span>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>

      {/* Graph Legend */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Order</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span>Payment</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            <span>Refund Request</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Proven Exception</span>
          </span>
        </div>
        <span className="text-slate-500 font-mono">Edges: {edges.length} connections verified</span>
      </div>
    </div>
  );
}
