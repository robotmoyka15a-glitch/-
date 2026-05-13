import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store'

import Layout      from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import Login       from './pages/Login'
import Dashboard   from './pages/Dashboard'
import Shift       from './pages/Shift'
import Cars        from './pages/Cars'
import Events      from './pages/Events'
import Reports     from './pages/Reports'
import Cameras     from './pages/Cameras'
import AIChat      from './pages/AIChat'
import Settings    from './pages/Settings'
import Onboarding  from './pages/Onboarding'
import NotFound    from './pages/NotFound'

// ── Страница-заглушка 404 ─────────────────────────────────────────────────────
// (импортируется из pages/NotFound.jsx)

// ── Guards ────────────────────────────────────────────────────────────────────

function RequireAuth({ children }) {
  const token = useStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return children
}

function RequireAdmin({ children }) {
  const user = useStore(s => s.user)
  if (!user)                return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return children
}

// ── Корневой компонент ────────────────────────────────────────────────────────

export default function App() {
  const { token, fetchActiveShift, fetchTodayStats } = useStore()

  useEffect(() => {
    if (token) {
      fetchActiveShift()
      fetchTodayStats()
    }
  }, [token])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Публичный */}
          <Route path="/login" element={<Login />} />

          {/* Онбординг — только для admin, когда настройки пусты */}
          <Route path="/onboarding" element={
            <RequireAdmin><Onboarding /></RequireAdmin>
          } />

          {/* Приложение */}
          <Route path="/" element={
            <RequireAuth><Layout /></RequireAuth>
          }>
            <Route index           element={<Dashboard />} />
            <Route path="shift"    element={<Shift />} />
            <Route path="cars"     element={<Cars />} />
            <Route path="events"   element={<Events />} />
            <Route path="reports"  element={<Reports />} />
            <Route path="cameras"  element={<Cameras />} />
            <Route path="ai"       element={<AIChat />} />
            <Route path="settings" element={
              <RequireAdmin><Settings /></RequireAdmin>
            } />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
