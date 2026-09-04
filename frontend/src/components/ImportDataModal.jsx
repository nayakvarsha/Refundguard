import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, X, ShieldCheck } from 'lucide-react';

export default function ImportDataModal({
  isOpen = true,
  company,
  currentCompany,
  sessionToken,
  onClose,
  onUploadSuccess,
  onImportSuccess
}) {
  const [file, setFile] = useState(null);
  const [rawContent, setRawContent] = useState('');
  const [fileType, setFileType] = useState('CSV'); // 'CSV' or 'JSON'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (isOpen === false) return null;

  const targetCompany = company || currentCompany || { id: 'COMP-FLIPKART', name: 'Flipkart E-Commerce' };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    setFile(selected);
    setError('');
    setSuccess('');

    const isJson = selected.name.toLowerCase().endsWith('.json');
    setFileType(isJson ? 'JSON' : 'CSV');

    const reader = new FileReader();
    reader.onload = (event) => {
      setRawContent(event.target.result);
    };
    reader.readAsText(selected);
  };

  const parseCsvToRecords = (csvText) => {
    const rawLines = csvText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (rawLines.length <= 1) return [];

    // Determine delimiter (, or ; or tab)
    const firstLine = rawLines[0];
    let delimiter = ',';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

    const parseLine = (line) => {
      return line.split(delimiter).map((col) => col.replace(/^["']|["']$/g, '').trim());
    };

    const headers = parseLine(rawLines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const records = [];

    for (let i = 1; i < rawLines.length; i++) {
      const values = parseLine(rawLines[i]);
      if (values.length === 0 || (values.length === 1 && !values[0])) continue;

      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] || '';
      });

      const getVal = (...keys) => {
        for (const k of keys) {
          const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (obj[cleanK] !== undefined && obj[cleanK] !== '') return obj[cleanK];
        }
        return '';
      };

      const orderId = getVal('order_id', 'orderid', 'order_number', 'order', 'id') || `ORD-${String(i).padStart(6, '0')}`;
      const paymentId = getVal('payment_id', 'paymentid', 'transaction_id', 'txnid', 'payment') || `PAY-${String(i).padStart(6, '0')}`;
      const orderAmount = Number(getVal('order_amount', 'orderamount', 'amount', 'total', 'captured_amount', 'captured') || 0);
      const refundAmount = Number(getVal('refund_amount', 'refundamount', 'refund', 'refunds') || 0);

      records.push({
        order_id: orderId,
        payment_id: paymentId,
        order_amount: orderAmount,
        captured_amount: orderAmount,
        refund_amount: refundAmount,
      });
    }

    return records;
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!rawContent) {
      setError('Please select a valid CSV or JSON file.');
      return;
    }

    setLoading(true);
    setError('');

    let records = [];
    try {
      if (fileType === 'JSON') {
        const parsed = JSON.parse(rawContent);
        if (Array.isArray(parsed)) {
          records = parsed;
        } else if (parsed.records || parsed.data || parsed.orders) {
          records = parsed.records || parsed.data || parsed.orders || [];
        }
      } else {
        records = parseCsvToRecords(rawContent);
      }

      if (records.length === 0) {
        setError('No valid transaction records found in file. Please ensure your CSV has headers like order_id, amount, refund_amount.');
        setLoading(false);
        return;
      }

      const activeToken = sessionToken || sessionStorage.getItem('refundguard_session_token') || localStorage.getItem('refundguard_session_token');

      const res = await fetch('/api/upload-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { 'x-session-token': activeToken, 'Authorization': `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          companyId: targetCompany?.id || targetCompany?.companyId,
          records,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server returned status ${res.status}: ${text.slice(0, 120)}`);
      }

      if (data.ok) {
        setSuccess(`Successfully imported ${data.recordsImported} records! RefundGuard detected ${data.incidentsFound} incidents.`);
        setTimeout(() => {
          const callback = onUploadSuccess || onImportSuccess;
          if (callback) callback(data);
          if (onClose) onClose();
        }, 1500);
      } else {
        setError(data.error || 'Upload failed.');
      }
    } catch (err) {
      console.error('Upload processing error:', err);
      setError('Failed to parse file: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">Import Transaction Data</h3>
              <p className="text-xs text-slate-500 font-medium">
                Upload CSV or JSON for <span className="font-bold text-blue-600">{targetCompany.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* File Drop Area */}
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-blue-400 bg-slate-50/50 transition relative">
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            {file ? (
              <div>
                <span className="font-bold text-xs text-slate-800 block">{file.name}</span>
                <span className="text-[10px] text-blue-600 font-mono">{(file.size / 1024).toFixed(1)} KB ({fileType})</span>
              </div>
            ) : (
              <div>
                <span className="font-extrabold text-xs text-slate-700 block">Click or drag CSV / JSON file here</span>
                <span className="text-[10px] text-slate-400 font-medium">Supports CSV formats with order_id, order_amount, refund_amount</span>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center space-x-2 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center space-x-2 text-emerald-700 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !file}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-extrabold transition flex items-center space-x-1.5 shadow-md shadow-blue-600/30 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Import & Run Detection</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
