/**
 * RefundGuard API Client
 */

const BASE_URL = '/api';

export async function fetchHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error('Failed to check health');
  return res.json();
}

export async function fetchSummary(companyId = null) {
  const activeToken = sessionStorage.getItem('refundguard_session_token') || localStorage.getItem('refundguard_session_token');
  const headers = activeToken ? {
    'x-session-token': activeToken,
    'Authorization': `Bearer ${activeToken}`
  } : {};
  const url = companyId ? `${BASE_URL}/summary?companyId=${companyId}` : `${BASE_URL}/summary`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('Failed to fetch summary');
  return res.json();
}

export async function fetchIncidents({ companyId = '', severity = '', type = '', search = '', limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (companyId) params.append('companyId', companyId);
  if (severity && severity !== 'undefined' && severity !== 'null') params.append('severity', severity);
  if (type && type !== 'undefined' && type !== 'null') params.append('type', type);
  if (search && search !== 'undefined' && search !== 'null') params.append('search', search);
  if (limit) params.append('limit', limit);

  const activeToken = sessionStorage.getItem('refundguard_session_token') || localStorage.getItem('refundguard_session_token');
  const headers = activeToken ? {
    'x-session-token': activeToken,
    'Authorization': `Bearer ${activeToken}`
  } : {};

  const res = await fetch(`${BASE_URL}/incidents?${params.toString()}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch incidents');
  return res.json();
}

export async function fetchIncidentDetail(id) {
  const activeToken = sessionStorage.getItem('refundguard_session_token') || localStorage.getItem('refundguard_session_token');
  const headers = activeToken ? {
    'x-session-token': activeToken,
    'Authorization': `Bearer ${activeToken}`
  } : {};
  const res = await fetch(`${BASE_URL}/incidents/${id}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch incident details');
  return res.json();
}

export async function fetchIncidentGraph(id) {
  const activeToken = sessionStorage.getItem('refundguard_session_token') || localStorage.getItem('refundguard_session_token');
  const headers = activeToken ? {
    'x-session-token': activeToken,
    'Authorization': `Bearer ${activeToken}`
  } : {};
  const res = await fetch(`${BASE_URL}/incidents/${id}/graph`, { headers });
  if (!res.ok) throw new Error('Failed to fetch incident evidence graph');
  return res.json();
}

export async function fetchAuditLogs(limit = 100, companyId = null) {
  const activeToken = sessionStorage.getItem('refundguard_session_token') || localStorage.getItem('refundguard_session_token');
  const headers = activeToken ? {
    'x-session-token': activeToken,
    'Authorization': `Bearer ${activeToken}`
  } : {};
  const url = companyId ? `${BASE_URL}/audit-logs?limit=${limit}&companyId=${companyId}` : `${BASE_URL}/audit-logs?limit=${limit}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  return res.json();
}

export async function fetchBenchmark() {
  const activeToken = sessionStorage.getItem('refundguard_session_token') || localStorage.getItem('refundguard_session_token');
  const headers = activeToken ? {
    'x-session-token': activeToken,
    'Authorization': `Bearer ${activeToken}`
  } : {};
  const res = await fetch(`${BASE_URL}/benchmark`, { headers });
  if (!res.ok) throw new Error('Failed to fetch benchmark evaluation');
  return res.json();
}

export async function triggerLiveSimulation() {
  const activeToken = sessionStorage.getItem('refundguard_session_token') || localStorage.getItem('refundguard_session_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(activeToken ? { 'x-session-token': activeToken, 'Authorization': `Bearer ${activeToken}` } : {})
  };
  const res = await fetch(`${BASE_URL}/simulate`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error('Failed to run live simulation');
  return res.json();
}

export async function triggerEngineRun() {
  const activeToken = sessionStorage.getItem('refundguard_session_token') || localStorage.getItem('refundguard_session_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(activeToken ? { 'x-session-token': activeToken, 'Authorization': `Bearer ${activeToken}` } : {})
  };
  const res = await fetch(`${BASE_URL}/run`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error('Failed to trigger engine run');
  return res.json();
}
