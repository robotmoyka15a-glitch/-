import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import RobotLogo from '../components/RobotLogo'

const C = {
  BRAND_GREEN:      '#22c55e',
  BRAND_GREEN_DARK: '#16a34a',
  BG_BASE:          '#0a0f0d',
  BG_CARD:          '#111827',
  BG_SIDEBAR:       '#0d1a12',
  BORDER:           '#1a3a25',
  TEXT_PRIMARY:     '#f0fdf4',
  TEXT_SECONDARY:   '#86efac',
  TEXT_MUTED:       '#4b7a5c',
  ACCENT_RED:       '#ef4444',
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
    background: '#0a0f0d',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Segoe UI', sans-serif",
  },
  card: {
    background: '#111827',
    border: '1px solid #1a3a25',
    borderRadius: 16, padding: '40px 36px', width: 340,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    boxShadow: '0 0 40px rgba(34,197,94,0.1), 0 24px 48px rgba(0,0,0,0.6)',
  },
  logoWrap: {
    marginBottom: 16,
  },
  subtitle: {
    color: '#4b7a5c', fontSize: 13, marginTop: 4, marginBottom: 32,
    textAlign: 'center',
  },
  form: { width: '100%', display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, color: '#86efac', fontWeight: 500 },
  input: {
    background: '#0d1a12',
    border: '1px solid #1a3a25',
    borderRadius: 8, padding: '10px 14px', color: '#f0fdf4',
    fontSize: 14, outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  error: {
    background: '#450a0a', border: '1px solid #7f1d1d',
    borderRadius: 8, padding: '10px 14px',
    color: '#fca5a5', fontSize: 13,
  },
  btn: {
    color: '#0a0f0d', border: 'none',
    borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', marginTop: 4,
    transition: 'background 0.2s',
  },
  hint: { marginTop: 20, fontSize: 11, color: '#1a3a25' },
}
