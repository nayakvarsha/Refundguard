import React, { useState, useEffect } from 'react';
import { Search, ArrowUpDown, Eye } from 'lucide-react';
import { fetchIncidents } from '../api/client';

export default function IncidentsView({ initialSeverity = '', onSelectIncident }) {
  const [incidents, setIncidents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [severityFilter, setSeverityFilter] = useState(initialSeverity);
  const [typeFilter, setTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // desc: highest exposure first

  useEffect(() => {
    setSeverityFilter(initialSeverity);
  }, [initialSeverity]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchIncidents({
      severity: severityFilter,
      type: typeFilter,
      search: searchTerm,
      limit: 100,
    })
      .then((res) => {
        if (isMounted) {
          let list = res.incidents || [];
          list.sort((a, b) => (sortOrder === 'desc' ? b.exposureAmount - a.exposureAmount : a.exposureAmount - b.exposureAmount));
          setIncidents(list);
          setTotalCount(res.total || 0);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch incidents list:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [severityFilter, typeFilter, searchTerm, sortOrder]);

  const formatRupees = (amt) => {
    if (!amt) return '₹0';
    return `₹${amt.toLocaleString('en-IN')}`;
  };

  const getSeverityBadge = (level) => {
    switch (level) {
      case 'CRITICAL':
        return <span className="px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">🔴 CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">🟠 HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-yellow-50 text-yellow-800 border border-yellow-200">🟡 MEDIUM</span>;
      case 'LOW':
        return <span className="px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">🟢 LOW</span>;
      default:
        return <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">{level}</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Order ID, Payment ID, or Refund ID..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Severity Dropdown */}
          <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500 font-medium">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer"
            >
              <option value="">All Levels</option>
              <option value="CRITICAL">CRITICAL (🔴)</option>
              <option value="HIGH">HIGH (🟠)</option>
              <option value="MEDIUM">MEDIUM (🟡)</option>
              <option value="LOW">LOW (🟢)</option>
            </select>
          </div>

          {/* Type Dropdown */}
          <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500 font-medium">Violation Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer"
            >
              <option value="">All Types</option>
              <option value="OVER_REFUND">OVER_REFUND</option>
              <option value="DUPLICATE_REFUND">DUPLICATE_REFUND</option>
              <option value="UNMATCHED_REFUND">UNMATCHED_REFUND</option>
              <option value="STATE_MISMATCH">STATE_MISMATCH</option>
              <option value="TIMING_RACE">TIMING_RACE</option>
            </select>
          </div>

          {/* Sort Order Toggle */}
          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="flex items-center space-x-1 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 hover:text-slate-900 transition font-mono hover:bg-slate-100"
            title="Toggle sort by exposure amount"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" />
            <span>{sortOrder === 'desc' ? 'Exposure: High → Low' : 'Exposure: Low → High'}</span>
          </button>

        </div>

      </div>

      {/* Incidents Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span className="font-mono">Showing {incidents.length} of {totalCount} detected exceptions</span>
          <span>Click any row to open full proof & evidence graph</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs">
            Loading exceptions dataset...
          </div>
        ) : incidents.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs space-y-2">
            <div>No incident exceptions match the selected filter criteria.</div>
            <button
              onClick={() => {
                setSeverityFilter('');
                setTypeFilter('');
                setSearchTerm('');
              }}
              className="text-blue-600 underline font-bold"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 font-mono">
                  <th className="py-3 px-4">Incident ID</th>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Violation Type(s)</th>
                  <th className="py-3 px-4 text-right">Exposure Amount</th>
                  <th className="py-3 px-4 text-center">Severity</th>
                  <th className="py-3 px-4">Policy Gate Action</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {incidents.map((incident) => (
                  <tr
                    key={incident.id}
                    onClick={() => onSelectIncident(incident.id)}
                    className="hover:bg-blue-50/50 cursor-pointer transition group"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 group-hover:text-blue-600">
                      {incident.id}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {incident.orderId}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {incident.types?.map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-rose-600">
                      {formatRupees(incident.exposureAmount)}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {getSeverityBadge(incident.severity?.level)}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-700">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 font-medium">
                        {incident.policy?.action || 'HUMAN_APPROVAL_REQUIRED'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIncident(incident.id);
                        }}
                        className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition flex items-center justify-center mx-auto border border-blue-200"
                        title="View Incident Proof"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
