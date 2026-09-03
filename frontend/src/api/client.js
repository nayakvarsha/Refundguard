/**
 * RefundGuard API Client
 */

const BASE_URL = '/api';

export async function fetchHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error('Failed to check health');
  return res.json();
}

export async function fetchSummary() {
  const res = await fetch(`${BASE_URL}/summary`);
  if (!res.ok) throw new Error('Failed to fetch summary');
  return res.json();
}

export async function fetchIncidents({ severity = '', type = '', search = '', limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (severity) params.append('severity', severity);
  if (type) params.append('type', type);
  if (search) params.append('search', search);
  if (limit) params.append('limit', limit);

  const res = await fetch(`${BASE_URL}/incidents?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch incidents');
  return res.json();
}

export async function fetchIncidentDetail(id) {
  const res = await fetch(`${BASE_URL}/incidents/${id}`);
  if (!res.ok) throw new Error('Failed to fetch incident details');
  return res.json();
}

export async function fetchIncidentGraph(id) {
  const res = await fetch(`${BASE_URL}/incidents/${id}/graph`);
  if (!res.ok) throw new Error('Failed to fetch incident evidence graph');
  return res.json();
}

export async function triggerLiveSimulation() {
  const res = await fetch(`${BASE_URL}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to run live simulation');
  return res.json();
}

export async function triggerEngineRun() {
  const res = await fetch(`${BASE_URL}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to run engine');
  return res.json();
}

export async function fetchAuditLogs(limit = 100) {
  const res = await fetch(`${BASE_URL}/audit?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  return res.json();
}

export async function fetchBenchmark() {
  const res = await fetch(`${BASE_URL}/benchmark`);
  if (!res.ok) throw new Error('Failed to fetch benchmark');
  return res.json();
}

export async function triggerReset() {
  const res = await fetch(`${BASE_URL}/reset`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to reset system');
  return res.json();
}
