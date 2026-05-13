import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
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
        <div style={s.logo}>🚿</div>
        <h1 style={s.title}>WashControl</h1>
        <p style={s.subtitle}>Система управления автомойкой</p>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Логин</label>
            <input
              style={s.input}
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="username"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Пароль</label>
            <input
              style={s.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && <div style={s.error}>{error}</div>}

          <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
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
    minHeight: '100vh', background: '#0f172a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Segoe UI', sans-serif",
  },
  card: {
    background: '#0d1b2e', border: '1px solid #1e3a5f',
    borderRadius: 16, padding: '40px 36px', width: 340,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
  },
  logo: { fontSize: 48, marginBottom: 8 },
  title: { color: '#38bdf8', fontSize: 24, fontWeight: 700, margin: 0 },
  subtitle: { color: '#475569', fontSize: 13, marginTop: 4, marginBottom: 32 },
  form: { width: '100%', display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, color: '#94a3b8', fontWeight: 500 },
  input: {
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: 8, padding: '10px 14px', color: '#e2e8f0',
    fontSize: 14, outline: 'none',
  },
  error: {
    background: '#450a0a', border: '1px solid #7f1d1d',
    borderRadius: 8, padding: '10px 14px',
    color: '#fca5a5', fontSize: 13,
  },
  btn: {
    background: '#0369a1', color: '#fff', border: 'none',
    borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 600,
    cursor: 'pointer', marginTop: 4,
    transition: 'background 0.2s',
  },
  hint: { marginTop: 20, fontSize: 11, color: '#334155' },
}
