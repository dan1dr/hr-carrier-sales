const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-api-key'

const headers = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
}

export async function fetchMetrics() {
  const res = await fetch(`${BASE_URL}/api/v1/dashboard/metrics`, { headers })
  if (!res.ok) throw new Error(`Metrics fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchConfig() {
  const res = await fetch(`${BASE_URL}/api/v1/dashboard/config`, { headers })
  if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`)
  return res.json()
}

export async function updateConfig(config) {
  const res = await fetch(`${BASE_URL}/api/v1/dashboard/config`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(config),
  })
  if (!res.ok) throw new Error(`Config update failed: ${res.status}`)
  return res.json()
}
