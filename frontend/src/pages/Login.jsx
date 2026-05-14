import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import RobotLogo from '../components/RobotLogo'

const C = {
  // Dark theme colors matching index.css variables
  BRAND_GREEN:      '#3b82f6',       // Blue accent (primary)
  BRAND_GREEN_DARK: '#1e3a5f',       // Darker blue for backgrounds
  BRAND_GREEN_DIM:  'rgba(59,130,246,0.1)', // Dimmed blue
  BG_BASE:          '#0f172a',       // Slate 900
  BG_CARD:          '#1e293b',       // Slate 800
  BG_SIDEBAR:       '#0f172a',       // Same as base
  BORDER:           '#334155',       // Slate 700
  TEXT_PRIMARY:     '#f8fafc',       // Slate 50
  TEXT_SECONDARY:   '#94a3b8',       // Slate 400
  TEXT_MUTED:       '#64748b',       // Slate 500
  ACCENT_RED:       '#ef4444',       // Red 500
  SUCCESS:          '#10b981',       // Emerald 500
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [userFocus, setUserFocus] = useState(false)
  const [passFocus, setPassFocus] = useState(false)
  const { login }  = useStore()
  const navigate   = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username || !password) { setError('Введите логин и пароль'); return }
    setLoading(true)
    setError('')
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Неверный логин или пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Логотип */}
        <div style={s.logoWrap}>
          <RobotLogo size={72} showText={true} />
        </div>

        <p style={s.subtitle}>Система управления автомойкой</p>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Логин</label>
            <input
              style={{
                ...s.input,
                borderColor: userFocus ? C.BRAND_GREEN : C.BORDER,
                boxShadow: userFocus ? `0 0 0 2px ${C.BRAND_GREEN}33` : 'none',
              }}
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onFocus={() => setUserFocus(true)}
              onBlur={() => setUserFocus(false)}
              placeholder="username"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Пароль</label>
            <input
              style={{
                ...s.input,
                borderColor: passFocus ? C.BRAND_GREEN : C.BORDER,
                boxShadow: passFocus ? `0 0 0 2px ${C.BRAND_GREEN}33` : 'none',
              }}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setPassFocus(true)}
              onBlur={() => setPassFocus(false)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && <div style={s.error}>{error}</div>}

          <button
            style={{
              ...s.btn,
              opacity: loading ? 0.7 : 1,
              background: loading ? C.BRAND_GREEN_DARK : C.BRAND_GREEN,
            }}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>

        <div style={s.hint}>
          По умолчанию: admin / admin123
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  card: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 16, padding: '40px 36px', width: 380,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    boxShadow: '0 0 40px rgba(59,130,246,0.1), 0 24px 48px rgba(0,0,0,0.6)',
  },
  logoWrap: {
    marginBottom: 24,
  },
  subtitle: {
    color: '#94a3b8', fontSize: 14, marginTop: 8, marginBottom: 32,
    textAlign: 'center', fontWeight: 500,
  },
  form: { width: '100%', display: 'flex', flexDirection: 'column', gap: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 14, color: '#cbd5e1', fontWeight: 600, letterSpacing: 0.3 },
  input: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 10, padding: '12px 16px', color: '#f8fafc',
    fontSize: 15, outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  error: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 10, padding: '12px 16px',
    color: '#fca5a5', fontSize: 14, fontWeight: 500,
  },
  btn: {
    color: '#0f172a', border: 'none',
    borderRadius: 10, padding: '14px', fontSize: 16, fontWeight: 700,
    cursor: 'pointer', marginTop: 8,
    transition: 'background 0.2s, transform 0.1s',
  },
  hint: { marginTop: 24, fontSize: 12, color: '#475569', fontWeight: 500 },
}
