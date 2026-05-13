/**
 * WashControl — axios API клиент
 * Все запросы к бэкенду через этот модуль
 */

import axios from 'axios'

const BASE_URL = 'http://127.0.0.1:8765'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
})

// Подставляем JWT токен автоматически
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('wc_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Если 401 — выкидываем на логин
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('wc_token')
      localStorage.removeItem('wc_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login:          (username, password) => api.post('/auth/login', new URLSearchParams({ username, password })),
  me:             ()                   => api.get('/auth/me'),
  users:          ()                   => api.get('/auth/users'),
  createUser:     (data)               => api.post('/auth/users', data),
  toggleUser:     (id)                 => api.put(`/auth/users/${id}/toggle`),
  resetPassword:  (id, pw)             => api.put(`/auth/users/${id}/password`, { new_password: pw }),
  changePassword: (old_pw, new_pw)     => api.post('/auth/change-password', { old_password: old_pw, new_password: new_pw }),
}

// ── Shifts ────────────────────────────────────────────────────────────────────
export const shiftsAPI = {
  start:   (note = '') => api.post('/shifts/start', { note }),
  end:     (note = '') => api.post('/shifts/end',   { note }),
  active:  ()          => api.get('/shifts/active'),
  today:   ()          => api.get('/shifts/today'),
  history: (params)    => api.get('/shifts/history', { params }),
  get:     (id)        => api.get(`/shifts/${id}`),
}

// ── Cars ──────────────────────────────────────────────────────────────────────
export const carsAPI = {
  add:     (data)     => api.post('/cars', data),
  today:   ()         => api.get('/cars/today'),
  byShift: (shiftId)  => api.get(`/cars/shift/${shiftId}`),
  stats:   ()         => api.get('/cars/stats/today'),
  update:  (id, data) => api.put(`/cars/${id}`, data),
  delete:  (id)       => api.delete(`/cars/${id}`),
}

// ── Events ────────────────────────────────────────────────────────────────────
export const eventsAPI = {
  list:    (params) => api.get('/events', { params }),
  today:   ()       => api.get('/events/today'),
  addNote: (data)   => api.post('/events/note', data),
  delete:  (id)     => api.delete(`/events/${id}`),
}

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsAPI = {
  day:        (date)        => api.get('/reports/day', { params: { target_date: date } }),
  dayExcel:   (date)        => `${BASE_URL}/reports/day/excel?target_date=${date}&token=${localStorage.getItem('wc_token')}`,
  week:       ()            => api.get('/reports/week'),
  month:      (year, month) => api.get('/reports/month', { params: { year, month } }),
  range:      (from, to)    => api.get('/reports/range', { params: { date_from: from, date_to: to } }),
  rangeExcel: (from, to)    => `${BASE_URL}/reports/range/excel?date_from=${from}&date_to=${to}&token=${localStorage.getItem('wc_token')}`,
}

// ── Cameras ───────────────────────────────────────────────────────────────────
export const camerasAPI = {
  status:      ()          => api.get('/cameras/status'),
  channels:    ()          => api.get('/cameras/channels'),
  screenshot:  (guid, tg)  => api.post(`/cameras/screenshot/${guid}`, null, { params: { send_telegram: tg } }),
  screenshots: ()          => api.get('/cameras/screenshots'),
  imgUrl:      (filename)  => `${BASE_URL}/screenshots/${filename}`,
}

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiAPI = {
  status:       ()          => api.get('/ai/status'),
  ask:          (question)  => api.post('/ai/ask', { question }),
  summary:      ()          => api.get('/ai/summary'),
  history:      ()          => api.get('/ai/history'),
  testQuestion: ()          => api.post('/ai/ask', { question: 'Скажи "OK" если ты работаешь.' }),
}

// ── Settings ──────────────────────────────────────────────────────────────────
export const settingsAPI = {
  get:       ()     => api.get('/settings'),
  update:    (data) => api.put('/settings', { data }),
  washModes: ()     => api.get('/settings/wash-modes'),
  backup:    ()     => api.post('/settings/backup'),
  backups:   ()     => api.get('/settings/backups'),
}

// ── System ────────────────────────────────────────────────────────────────────
export const systemAPI = {
  health:     () => api.get('/health'),
  testNotify: () => api.post('/notify/test'),
}
