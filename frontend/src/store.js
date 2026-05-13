/**
 * WashControl — Zustand store
 * Глобальное состояние: пользователь, активная смена, статистика, aiProvider
 */

import { create } from 'zustand'
import { authAPI, shiftsAPI, carsAPI } from './api'

export const useStore = create((set, get) => ({
  // ── Пользователь ──────────────────────────────────────────────────────────
  user: JSON.parse(localStorage.getItem('wc_user') || 'null'),
  token: localStorage.getItem('wc_token') || null,

  login: async (username, password) => {
    const res = await authAPI.login(username, password)
    const { access_token, ...user } = res.data
    localStorage.setItem('wc_token', access_token)
    localStorage.setItem('wc_user', JSON.stringify(user))
    set({ token: access_token, user })
    return user
  },

  logout: () => {
    localStorage.removeItem('wc_token')
    localStorage.removeItem('wc_user')
    set({ token: null, user: null, activeShift: null })
  },

  // ── Активная смена ─────────────────────────────────────────────────────────
  activeShift: null,
  shiftLoading: false,

  fetchActiveShift: async () => {
    set({ shiftLoading: true })
    try {
      const res = await shiftsAPI.active()
      set({ activeShift: res.data })
    } catch (err) {
      // При 401 — выход
      if (err.response?.status === 401) {
        get().logout()
      } else {
        set({ activeShift: null })
      }
    } finally {
      set({ shiftLoading: false })
    }
  },

  startShift: async (note = '') => {
    const res = await shiftsAPI.start(note)
    set({ activeShift: res.data })
    return res.data
  },

  endShift: async (note = '') => {
    const res = await shiftsAPI.end(note)
    set({ activeShift: null })
    return res.data
  },

  // ── Статистика дня ─────────────────────────────────────────────────────────
  todayStats: null,

  fetchTodayStats: async () => {
    try {
      const res = await carsAPI.stats()
      set({ todayStats: res.data })
    } catch {
      set({ todayStats: null })
    }
  },

  // ── Машины сегодня ─────────────────────────────────────────────────────────
  todayCars: [],

  fetchTodayCars: async () => {
    try {
      const res = await carsAPI.today()
      set({ todayCars: res.data })
    } catch {
      set({ todayCars: [] })
    }
  },

  // ── AI провайдер ───────────────────────────────────────────────────────────
  // Читается из localStorage при старте, обновляется при изменении настроек
  aiProvider: localStorage.getItem('wc_ai_provider') || 'builtin',

  setAiProvider: (provider) => {
    localStorage.setItem('wc_ai_provider', provider)
    set({ aiProvider: provider })
  },
}))
