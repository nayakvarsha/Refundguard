import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, X, ShieldCheck } from 'lucide-react';

export default function ImportDataModal({ isOpen, company, sessionToken, onClose, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [rawContent, setRawContent] = useState('');
  const [fileType, setFileType] = useState('CSV'); // 'CSV' or 'JSON'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen || !company) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    setFile(selected);
    setError('');
    setSuccess('');

    const isJson = selected.name.endsWith('.json');
    setFileType(isJson ? 'JSON' : 'CSV');

    const reader = new FileReader();
    reader.onload = (event) => {
      setRawContent(event.target.result);
    };
    reader.readAsText(selected);
  };

  const parseCsvToRecords = (csvText) => {
    const lines = csvText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      if (values.length < headers.length) continue;

      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx];
      });

      records.push({
        order_id: obj.order_id || obj.orderid || obj.order_number,
        payment_id: obj.payment_id || obj.paymentid || obj.transaction_id,
        order_amount: Number(obj.order_amount || obj.orderamount || obj.amount || 0),
        captured_amount: Number(obj.captured_amount || obj.capturedamount || obj.order_amount || 0),
        refund_amount: Number(obj.refund_amount || obj.refundamount || obj.refund || 0),
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
        records = JSON.parse(rawContent);
        if (!Array.isArray(records)) {
          records = records.records || records.data || [];
        }
      } else {
        records = parseCsvToRecords(rawContent);
      }

      if (records.length === 0) {
        setError('No valid transaction records found in file.');
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/companies/${company.id}/upload-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': sessionToken,
        },
        body: JSON.stringify({ records }),
      });

      const data = await res.json();

      if (data.ok) {
        setSuccess(`Successfully imported ${data.recordsImported} records! RefundGuard detected ${data.incidentsFound} incidents.`);
        setTimeout(() => {
          onUploadSuccess(data);
          onClose();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">+ Import Transaction Data</h3>
              <p className="text-xs text-slate-500 font-medium">Upload custom CSV or JSON files for {company.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
          
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {/* Sample Format Guide */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs text-slate-600">
            <span className="font-bold text-slate-800 block">Accepted CSV Format:</span>
            <pre className="p-2 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[10px] overflow-x-auto">
{`order_id,payment_id,order_amount,captured_amount,refund_amount
ORD001,PAY001,10000,10000,2000
ORD002,PAY002,5000,5000,5000
ORD003,PAY003,8000,8000,10000`}
            </pre>
          </div>

          {/* Dropzone */}
          <div className="relative border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center transition cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 group">
            <input
              type="file"
              accept=".csv, .json"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <FileText className="w-8 h-8 text-slate-400 group-hover:text-blue-600 mx-auto mb-2 transition" />
            <span className="text-xs font-bold text-slate-800 block">
              {file ? file.name : 'Click to choose or drag & drop CSV/JSON file'}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">Supports .csv and .json transaction files</span>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !rawContent}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-md transition flex items-center space-x-2 ${
                rawContent
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{loading ? 'Analyzing Transactions...' : 'Upload & Analyze Data'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
