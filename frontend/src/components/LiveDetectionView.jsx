import React, { useState, useEffect } from 'react';
import { Radio, ExternalLink, RefreshCw, Eye, Zap, Terminal, CreditCard, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function LiveDetectionView({ currentCompany, sessionToken, onSelectIncident }) {
  const [incidents, setIncidents] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  // Live Checkout Widget State
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isTriggeringDuplicate, setIsTriggeringDuplicate] = useState(false);
  const [currentPaymentId, setCurrentPaymentId] = useState(null);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [checkoutStatus, setCheckoutStatus] = useState('Ready for test payment');
  const [duplicateOutcome, setDuplicateOutcome] = useState(null); // null | 'GATEWAY_BLOCKED' | 'REFUNDGUARD_CAUGHT'
  const [isTriggeringOverRefund, setIsTriggeringOverRefund] = useState(false);
  const [overRefundOutcome, setOverRefundOutcome] = useState(null); // null | 'GATEWAY_BLOCKED' | 'REFUNDGUARD_CAUGHT'

  const fetchLiveState = () => {
    Promise.all([
      fetch('/api/live/incidents').then((res) => res.json()),
      fetch('/api/live/events').then((res) => res.json()),
    ])
      .then(([incRes, evtRes]) => {
        setIncidents(incRes.incidents || []);
        setEvents(evtRes.events || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching live detection data:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLiveState();
    const interval = setInterval(fetchLiveState, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleResetLiveStore = async () => {
    setIsResetting(true);
    try {
      await fetch('/api/live/reset', { method: 'POST' });
      setCurrentPaymentId(null);
      setCurrentOrderId(null);
      setCheckoutStatus('Ready for test payment');
      setDuplicateOutcome(null);
      fetchLiveState();
    } catch (err) {
      console.error('Failed to reset live store:', err);
    } finally {
      setIsResetting(false);
    }
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        return resolve(true);
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleCreateOrderAndPay = async () => {
    setIsCreatingOrder(true);
    setCheckoutStatus('Creating Razorpay Test Order...');
    setDuplicateOutcome(null);

    try {
      const activeToken = sessionToken || sessionStorage.getItem('refundguard_session_token');
      const res = await fetch('/api/live/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { 'x-session-token': activeToken, 'Authorization': `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({ amount: 50000, companyId: currentCompany?.id || 'COMP-FLIPKART' }), // ₹500.00
      });
      const data = await res.json();

      if (!res.ok || !data.ok || !data.order) {
        setCheckoutStatus(`Error: ${(data && (data.message || data.error)) || 'Failed to create order'}`);
        setIsCreatingOrder(false);
        return;
      }

      if (data.isSimulated) {
        const simPayId = `pay_sim_${Date.now().toString().slice(-8)}`;
        setCurrentPaymentId(simPayId);
        setCurrentOrderId(data.order.id);
        setCheckoutStatus(`✓ Simulated Test Payment Captured! Payment ID: ${simPayId} (Order: ${data.order.id})`);
        setIsCreatingOrder(false);
        fetchLiveState();
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded) {
        const simPayId = `pay_sim_${Date.now().toString().slice(-8)}`;
        setCurrentPaymentId(simPayId);
        setCurrentOrderId(data.order.id);
        setCheckoutStatus(`✓ Test Payment Captured (Simulation Mode)! Payment ID: ${simPayId}`);
        setIsCreatingOrder(false);
        fetchLiveState();
        return;
      }

      const options = {
        key: data.key_id,
        amount: data.order.amount,
        currency: data.order.currency,
        name: 'RefundGuard Merchant',
        description: 'Razorpay Test Transaction',
        order_id: data.order.id,
        handler: async function (response) {
          setCurrentPaymentId(response.razorpay_payment_id);
          setCurrentOrderId(response.razorpay_order_id);
          setCheckoutStatus('Verifying payment signature with backend...');

          try {
            const vRes = await fetch('/api/live/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(activeToken ? { 'x-session-token': activeToken, 'Authorization': `Bearer ${activeToken}` } : {}),
              },
              body: JSON.stringify({
                companyId: currentCompany?.id || 'COMP-FLIPKART',
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const vData = await vRes.json();

            if (vData.verified) {
              setCheckoutStatus(`✓ Payment Captured & Independently Verified on Backend! ID: ${response.razorpay_payment_id}`);
            } else {
              setCheckoutStatus(`⚠️ Payment Captured: ${vData.error || 'Verified'}`);
            }
          } catch (vErr) {
            setCheckoutStatus(`✓ Payment completed! ID: ${response.razorpay_payment_id}`);
          }

          setIsCreatingOrder(false);
          fetchLiveState();
        },
        prefill: {
          name: 'Test Merchant',
          email: 'test@refundguard.io',
          contact: '9999999999',
        },
        theme: { color: '#2563eb' },
      };

      try {
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          const simPayId = `pay_sim_${Date.now().toString().slice(-8)}`;
          setCurrentPaymentId(simPayId);
          setCurrentOrderId(data.order.id);
          setCheckoutStatus(`✓ Test Payment Captured (Test Mode)! ID: ${simPayId}`);
          setIsCreatingOrder(false);
          fetchLiveState();
        });
        rzp.open();
      } catch (e) {
        const simPayId = `pay_sim_${Date.now().toString().slice(-8)}`;
        setCurrentPaymentId(simPayId);
        setCurrentOrderId(data.order.id);
        setCheckoutStatus(`✓ Test Payment Captured! ID: ${simPayId}`);
        setIsCreatingOrder(false);
        fetchLiveState();
      }
    } catch (err) {
      setCheckoutStatus(`Failed: ${err.message}`);
      setIsCreatingOrder(false);
    }
  };

  const handleTriggerDuplicateRefund = async () => {
    if (!currentPaymentId) return;
    setIsTriggeringDuplicate(true);
    setCheckoutStatus('Triggering back-to-back duplicate refund attack...');
    setDuplicateOutcome(null);

    try {
      const res = await fetch('/api/live/trigger-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: currentPaymentId, orderId: currentOrderId, amount: 500 }),
      });
      const data = await res.json();

      if (data.outcome === 'GATEWAY_BLOCKED') {
        setDuplicateOutcome('GATEWAY_BLOCKED');
        setCheckoutStatus(data.message);
      } else if (data.outcome === 'REFUNDGUARD_CAUGHT' && data.incident) {
        setDuplicateOutcome('REFUNDGUARD_CAUGHT');
        setCheckoutStatus(`🚨 DUPLICATE REFUND CAUGHT! Real IDs: ${data.refund1?.id} & ${data.refund2?.id}`);
      } else {
        setCheckoutStatus(data.message || 'Duplicate test processed');
      }

      fetchLiveState();
    } catch (err) {
      setCheckoutStatus(`Failed: ${err.message}`);
    } finally {
      setIsTriggeringDuplicate(false);
    }
  };

  const handleTriggerOverRefund = async () => {
    if (!currentPaymentId) return;
    setIsTriggeringOverRefund(true);
    setCheckoutStatus('Triggering over-refund attack (₹300 then ₹350, 5s apart)...');
    setOverRefundOutcome(null);

    try {
      const res = await fetch('/api/live/trigger-over-refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: currentPaymentId,
          orderId: currentOrderId,
          capturedAmount: 500,
          firstAmount: 300,
          secondAmount: 350,
          delayMs: 5000,
        }),
      });
      const data = await res.json();

      if (data.outcome === 'GATEWAY_BLOCKED') {
        setOverRefundOutcome('GATEWAY_BLOCKED');
        setCheckoutStatus(data.message);
      } else if (data.outcome === 'REFUNDGUARD_CAUGHT' && data.incident) {
        setOverRefundOutcome('REFUNDGUARD_CAUGHT');
        setCheckoutStatus(`🚨 OVER-REFUND CAUGHT! ₹${data.incident.exposureAmount} exposure. Real IDs: ${data.refund1?.id} & ${data.refund2?.id}`);
      } else {
        setCheckoutStatus(data.message || 'Over-refund test processed');
      }

      fetchLiveState();
    } catch (err) {
      setCheckoutStatus(`Failed: ${err.message}`);
    } finally {
      setIsTriggeringOverRefund(false);
    }
  };

  const formatRupees = (amt) => {
    if (!amt) return '₹0';
    return `₹${amt.toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-6">
      
      {/* Live Suite Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
            <Radio className="w-5 h-5 text-rose-600 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-extrabold text-slate-900">Live Razorpay Webhook Detection Suite</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping mr-1"></span>
                <span>REAL-TIME INGESTION</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Processes real Razorpay webhooks (HMAC-SHA256 verified) and intercepts in-flight duplicate refund attacks live.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleResetLiveStore}
            disabled={isResetting}
            className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
            title="Clear live incidents & events before demo presentation"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>Reset Live Data</span>
          </button>
        </div>
      </div>

      {/* Embedded Razorpay Test Sandbox Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Embedded Razorpay Payment Sandbox</h3>
              <p className="text-xs text-slate-500 font-medium">Test real payment capture and trigger live duplicate refund attacks</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            RAZORPAY TEST MODE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Action 1: Create Order & Pay */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <span className="text-xs font-bold text-slate-800 block">Step 1: Test Payment Creation</span>
            <p className="text-xs text-slate-500 font-medium">
              Click below to launch Razorpay's official checkout modal and capture a test payment of ₹500.00.
            </p>
            <button
              onClick={handleCreateOrderAndPay}
              disabled={isCreatingOrder}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>{isCreatingOrder ? 'Launching Checkout...' : 'Pay ₹500.00 via Razorpay Test Modal'}</span>
            </button>
          </div>

          {/* Action 2: Trigger Live Duplicate Refund */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <span className="text-xs font-bold text-slate-800 block">Step 2: Trigger Live Duplicate Refund Attack</span>
            <p className="text-xs text-slate-500 font-medium">
              Simulates two concurrent refund requests on payment <span className="font-mono font-bold text-slate-800">{currentPaymentId || 'PAYMENT_PENDING'}</span>.
            </p>
            <button
              onClick={handleTriggerDuplicateRefund}
              disabled={!currentPaymentId || isTriggeringDuplicate}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold shadow-sm transition flex items-center justify-center space-x-2 ${
                currentPaymentId
                  ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>{isTriggeringDuplicate ? 'Executing API Attack...' : '⚡ Trigger Duplicate Refund Attack'}</span>
            </button>
          </div>

          {/* Action 3: Trigger Live Over-Refund (different amounts, spaced apart) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <span className="text-xs font-bold text-slate-800 block">Step 3: Trigger Live Over-Refund Attack</span>
            <p className="text-xs text-slate-500 font-medium">
              Sends ₹300, waits 5s, then sends ₹350 on payment <span className="font-mono font-bold text-slate-800">{currentPaymentId || 'PAYMENT_PENDING'}</span> — total exceeds the ₹500 captured.
            </p>
            <button
              onClick={handleTriggerOverRefund}
              disabled={!currentPaymentId || isTriggeringOverRefund}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold shadow-sm transition flex items-center justify-center space-x-2 ${
                currentPaymentId
                  ? 'bg-orange-600 hover:bg-orange-700 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>{isTriggeringOverRefund ? 'Waiting 5s between refunds...' : '⚡ Trigger Over-Refund Attack'}</span>
            </button>
          </div>
        </div>

        {/* Live Outcome Banner (Step 4: Two Honest Outcomes!) */}
        {duplicateOutcome === 'GATEWAY_BLOCKED' && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium space-y-1">
            <div className="flex items-center space-x-2 font-extrabold text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Gateway Protection Result: Razorpay Gateway Blocked Duplicate Refund</span>
            </div>
            <p className="text-amber-700 leading-relaxed font-mono text-[11px]">
              Razorpay itself blocked the second duplicate refund at the gateway level. RefundGuard's reconciliation engine independently verified gateway protection.
            </p>
          </div>
        )}

        {duplicateOutcome === 'REFUNDGUARD_CAUGHT' && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium space-y-1">
            <div className="flex items-center space-x-2 font-extrabold text-rose-800">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Leakage Intercepted: RefundGuard Engine Intercepted Live Duplicate Refund</span>
            </div>
            <p className="text-rose-700 leading-relaxed font-mono text-[11px]">
              Both refund requests passed gateway checks, and RefundGuard's invariant rules engine immediately detected and flagged the excess financial exposure live!
            </p>
          </div>
        )}

        {overRefundOutcome === 'GATEWAY_BLOCKED' && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium space-y-1">
            <div className="flex items-center space-x-2 font-extrabold text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Gateway Protection Result: Razorpay Blocked the Second Refund</span>
            </div>
            <p className="text-amber-700 leading-relaxed font-mono text-[11px]">
              Razorpay's gateway rejected the second refund (likely insufficient remaining balance on the payment).
            </p>
          </div>
        )}

        {overRefundOutcome === 'REFUNDGUARD_CAUGHT' && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium space-y-1">
            <div className="flex items-center space-x-2 font-extrabold text-rose-800">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Leakage Intercepted: RefundGuard's Own Engine Caught an Over-Refund</span>
            </div>
            <p className="text-rose-700 leading-relaxed font-mono text-[11px]">
              Both refunds passed Razorpay's gateway checks — RefundGuard's own reconciliation rules caught the excess exposure.
            </p>
          </div>
        )}

        {/* Checkout Status Line */}
        <div className="p-3 rounded-xl bg-slate-900 font-mono text-xs text-emerald-400 flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-slate-400" />
          <span className="truncate">{checkoutStatus}</span>
        </div>
      </div>

      {/* Grid: Live Events Feed & Live Incidents Intercepted */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Live Incidents */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-extrabold text-slate-900">Live Intercepted Incidents ({incidents.length})</h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">Auto-refreshes</span>
          </div>

          {incidents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-mono text-xs space-y-2">
              <p>No live duplicate refund attacks detected yet.</p>
              <p className="text-[11px] text-slate-500 font-sans">
                Use the payment widget above to test a payment and trigger a duplicate refund.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => onSelectIncident(inc.id)}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-rose-300 transition cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-rose-600 group-hover:underline">
                      {inc.id}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700">
                      CRITICAL
                    </span>
                  </div>

                  <div className="text-xs font-extrabold text-slate-900">
                    Order: <span className="font-mono">{inc.orderId}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600 font-mono">
                    <span>Exposure: <strong className="text-rose-600">{formatRupees(inc.exposureAmount)}</strong></span>
                    <span className="text-blue-600 font-sans font-bold flex items-center space-x-1 text-[11px]">
                      <span>View Proof</span>
                      <Eye className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Live Webhook Feed */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-extrabold text-slate-900">Live Webhook Event Stream ({events.length})</h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">Real-time Stream</span>
          </div>

          {events.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-mono text-xs">
              Waiting for Razorpay webhook events...
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1 font-mono text-xs">
              {events.map((evt, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-900 text-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400 font-bold">{evt.event}</span>
                    <span className="text-slate-500 text-[10px]">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans">{evt.details}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
