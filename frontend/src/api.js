const BASE = import.meta.env.VITE_API_URL || '/api'

function getToken() {
  return localStorage.getItem('famboard_token')
}

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) {
    localStorage.removeItem('famboard_token')
    localStorage.removeItem('famboard_user')
    window.location.href = '/login'
    return
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // auth
  login: (username, password) => {
    const form = new URLSearchParams({ username, password })
    return fetch(`${BASE}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    }).then(r => {
      if (!r.ok) throw new Error('Invalid credentials')
      return r.json()
    })
  },
  me: () => req('GET', '/auth/me'),

  // tasks
  getTasks: () => req('GET', '/tasks/'),
  createTask: (data) => req('POST', '/tasks/', data),
  updateTask: (id, data) => req('PUT', `/tasks/${id}`, data),
  deleteTask: (id) => req('DELETE', `/tasks/${id}`),

  // logs
  getLogs: (date) => req('GET', `/logs/${date}`),
  getLogsForKid: (userId, date) => req('GET', `/logs/parent/${userId}/${date}`),
  updateLog: (id, data) => req('PATCH', `/logs/${id}`, data),

  // points
  getPoints: (userId) => req('GET', `/points/summary/${userId}`),
  addBonus: (data) => req('POST', '/points/bonus', data),

  // rewards
  getRewards: () => req('GET', '/rewards/'),
  createReward: (data) => req('POST', '/rewards/', data),
  redeemReward: (id) => req('POST', `/rewards/redeem/${id}`),
  approveRedemption: (id) => req('POST', `/rewards/approve/${id}`),
  getRedemptions: () => req('GET', '/rewards/redemptions'),

  // analytics
  getWeekly: (userId, weeks = 4) => req('GET', `/analytics/weekly/${userId}?weeks=${weeks}`),
  getCategory: (userId, days = 7) => req('GET', `/analytics/category/${userId}?days=${days}`),
  getStreak: (userId) => req('GET', `/analytics/streak/${userId}`),

  // admin
  getUsers: () => req('GET', '/admin/users'),
  seedData: () => req('POST', '/admin/seed'),
}
