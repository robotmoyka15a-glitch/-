import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div style={s.page}>
      <div style={s.card}>
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 16 }}>
          <path d="M32 4 L56 16 L56 36 Q56 52 32 60 Q8 52 8 36 L8 16 Z"
                fill="#111827" stroke="#22c55e" strokeWidth="2"/>
          <rect x="16" y="34" width="32" height="10" rx="3" fill="#22c55e"/>
          <rect x="20" y="26" width="24" height="12" rx="3" fill="#22c55e"/>
          <circle cx="21" cy="44" r="4" fill="#0a0f0d" stroke="#22c55e" strokeWidth="1.5"/>
          <circle cx="43" cy="44" r="4" fill="#0a0f0d" stroke="#22c55e" strokeWidth="1.5"/>
        </svg>
        <div style={s.code}>404</div>
        <h2 style={s.title}>Страница не найдена</h2>
        <p style={s.sub}>Такой раздел не существует в WashControl.</p>
        <button style={s.btn} onClick={() => navigate('/')}>
          ← На главную
        </button>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh', background: '#0a0f0d',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Segoe UI', sans-serif",
  },
  card: {
    background: '#111827', border: '1px solid #1a3a25',
    borderRadius: 16, padding: '48px 40px', maxWidth: 380,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    boxShadow: '0 0 40px rgba(34,197,94,0.06)',
  },
  code:  { fontSize: 72, fontWeight: 900, color: '#22c55e', lineHeight: 1, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: 700, color: '#f0fdf4', margin: 0 },
  sub:   { fontSize: 13, color: '#4b7a5c', marginTop: 8, marginBottom: 28, textAlign: 'center' },
  btn:   {
    background: '#22c55e', color: '#0a0f0d', border: 'none',
    borderRadius: 8, padding: '11px 28px', fontWeight: 700, fontSize: 14,
    cursor: 'pointer',
  },
}
