import React from 'react'

/**
 * ErrorBoundary — перехватывает ошибки рендера React и показывает
 * понятный экран вместо белого экрана смерти.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    console.error('[ErrorBoundary]', error, info)
  }

  handleReload() {
    window.location.href = '/'
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const msg = this.state.error?.message || 'Неизвестная ошибка'

    return (
      <div style={s.page}>
        <div style={s.card}>
          {/* Лого */}
          <svg width="56" height="56" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 16 }}>
            <path d="M32 4 L56 16 L56 36 Q56 52 32 60 Q8 52 8 36 L8 16 Z"
                  fill="#111827" stroke="#22c55e" strokeWidth="2"/>
            <rect x="16" y="34" width="32" height="10" rx="3" fill="#22c55e"/>
            <rect x="20" y="26" width="24" height="12" rx="3" fill="#22c55e"/>
            <circle cx="21" cy="44" r="4" fill="#0a0f0d" stroke="#22c55e" strokeWidth="1.5"/>
            <circle cx="43" cy="44" r="4" fill="#0a0f0d" stroke="#22c55e" strokeWidth="1.5"/>
          </svg>

          <h2 style={s.title}>Что-то пошло не так</h2>
          <p style={s.subtitle}>Произошла внутренняя ошибка приложения.</p>

          <div style={s.errorBox}>
            <code style={s.errorMsg}>{msg}</code>
          </div>

          <div style={s.actions}>
            <button style={s.btnPrimary} onClick={this.handleReload}>
              Перезагрузить
            </button>
            <button style={s.btnSecondary}
              onClick={() => this.setState({ hasError: false, error: null })}>
              Попробовать снова
            </button>
          </div>

          <p style={s.hint}>
            Если ошибка повторяется — проверьте, что сервер запущен,
            или перезапустите WashControl.
          </p>
        </div>
      </div>
    )
  }
}

const s = {
  page: {
    minHeight: '100vh', background: '#0f172a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Segoe UI', sans-serif", padding: 24,
  },
  card: {
    background: '#1e293b', border: '1px solid #1a3a25',
    borderRadius: 16, padding: '40px 36px', maxWidth: 440, width: '100%',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    boxShadow: '0 0 40px rgba(34,197,94,0.06)',
  },
  title:    { fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 8, marginBottom: 20, textAlign: 'center' },
  errorBox: {
    background: '#0f172a', border: '1px solid #1a3a25',
    borderRadius: 8, padding: '10px 14px', width: '100%', marginBottom: 20,
    maxHeight: 80, overflow: 'auto',
  },
  errorMsg: { fontSize: 12, color: '#ef4444', fontFamily: 'monospace', wordBreak: 'break-all' },
  actions:  { display: 'flex', gap: 10, marginBottom: 16 },
  btnPrimary: {
    background: '#3b82f6', color: '#0f172a', border: 'none',
    borderRadius: 8, padding: '10px 22px', fontWeight: 700, fontSize: 14,
    cursor: 'pointer',
  },
  btnSecondary: {
    background: 'transparent', color: '#94a3b8',
    border: '1px solid #1a3a25', borderRadius: 8,
    padding: '10px 18px', fontSize: 14, cursor: 'pointer',
  },
  hint: { fontSize: 11, color: '#64748b', textAlign: 'center', lineHeight: 1.6 },
}
