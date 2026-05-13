import React, { useState, useEffect, useRef } from 'react'
import { aiAPI } from '../api'

const C = {
  BRAND_GREEN:     '#22c55e',
  BRAND_GREEN_DIM: '#14532d',
  BG_BASE:         '#0a0f0d',
  BG_CARD:         '#111827',
  BG_SIDEBAR:      '#0d1a12',
  BORDER:          '#1a3a25',
  TEXT_PRIMARY:    '#f0fdf4',
  TEXT_SECONDARY:  '#86efac',
  TEXT_MUTED:      '#4b7a5c',
  ACCENT_YELLOW:   '#fbbf24',
}

const PROVIDER_LABELS = {
  builtin:   'builtin (llama_cpp)',
  llama_cpp: 'llama_cpp',
  ollama:    'Ollama',
  clo:       'CLO API',
}

export default function AIChat() {
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: 'Привет! Я AI-помощник автомойки. Спросите меня что-нибудь: сколько машин за сегодня, какова выручка, кто на смене, или любой другой вопрос.',
    },
  ])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [aiStatus, setStatus]   = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    aiAPI.status().then(r => setStatus(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const q = input.trim()
    if (!q) return
    setInput('')
    setMessages(m => [...m, { role: 'user', text: q }])
    setLoading(true)
    try {
      const r = await aiAPI.ask(q)
      setMessages(m => [...m, { role: 'ai', text: r.data.answer }])
    } catch {
      setMessages(m => [...m, { role: 'ai', text: '⚠ Не удалось получить ответ. Попробуйте позже.' }])
    } finally { setLoading(false) }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const getSummary = async () => {
    setLoading(true)
    setMessages(m => [...m, { role: 'user', text: 'Составь краткую сводку за сегодня' }])
    try {
      const r = await aiAPI.summary()
      setMessages(m => [...m, { role: 'ai', text: r.data.summary }])
    } catch {
      setMessages(m => [...m, { role: 'ai', text: 'Не удалось получить сводку.' }])
    } finally { setLoading(false) }
  }

  const quickQuestions = [
    'Сколько машин сегодня?',
    'Какова выручка за день?',
    'Кто сейчас на смене?',
    'Сколько доп. услуг продали?',
  ]

  const providerName = aiStatus?.provider ? (PROVIDER_LABELS[aiStatus.provider] || aiStatus.provider) : null

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h2 style={s.title}>AI-помощник</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {providerName && (
            <span style={s.providerBadge}>{providerName}</span>
          )}
          <div style={aiStatus?.available ? s.aiOn : s.aiOff}>
            {aiStatus === null ? '...' : aiStatus.available ? '✓ AI активен' : '○ Режим БД'}
          </div>
        </div>
      </div>

      {!aiStatus?.available && (
        <div style={s.aiHint}>
          💡 AI-модель не загружена. Работает упрощённый режим — запросы напрямую к данным системы.
          Чтобы включить полный AI, настройте провайдера в разделе «Настройки → AI-интеграции».
        </div>
      )}

      {/* Быстрые вопросы */}
      <div style={s.quickRow}>
        {quickQuestions.map(q => (
          <button key={q} style={s.quickBtn} onClick={() => setInput(q)}>
            {q}
          </button>
        ))}
        <button
          style={{ ...s.quickBtn, background: C.BRAND_GREEN_DIM, color: C.BRAND_GREEN, border: `1px solid ${C.BORDER}` }}
          onClick={getSummary} disabled={loading}
        >
          📊 Сводка дня
        </button>
      </div>

      {/* Чат */}
      <div style={s.chat}>
        {messages.map((m, i) => (
          <div key={i} style={m.role === 'user' ? s.userMsg : s.aiMsg}>
            {m.role === 'ai' && (
              <div style={s.aiAvatar}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <path d="M8 21h8M12 17v4"/>
                  <path d="M9 8h.01M15 8h.01M9 12h6"/>
                </svg>
              </div>
            )}
            <div style={m.role === 'user' ? s.userBubble : s.aiBubble}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={s.aiMsg}>
            <div style={s.aiAvatar}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <div style={s.aiBubble}>
              <span style={s.typing}>● ● ●</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Ввод */}
      <div style={s.inputRow}>
        <textarea
          style={s.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Введите вопрос... (Enter — отправить)"
          rows={2}
          disabled={loading}
        />
        <button style={{
          ...s.sendBtn,
          background: loading || !input.trim() ? C.BRAND_GREEN_DIM : C.BRAND_GREEN,
          color: loading || !input.trim() ? '#4b7a5c' : '#0a0f0d',
        }} onClick={send} disabled={loading || !input.trim()}>
          {loading ? '...' : '▶'}
        </button>
      </div>
    </div>
  )
}

const s = {
  page:        { padding: '24px 28px', maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 0px)' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title:       { fontSize: 20, fontWeight: 700, color: '#f0fdf4', margin: 0 },
  providerBadge: { background: '#111827', border: '1px solid #1a3a25', color: '#86efac', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 600 },
  aiOn:        { background: '#14532d', color: '#22c55e', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #1a3a25' },
  aiOff:       { background: '#111827', color: '#4b7a5c', borderRadius: 8, padding: '4px 12px', fontSize: 12, border: '1px solid #1a3a25' },
  aiHint:      { background: '#111827', border: '1px solid #1a3a25', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#4b7a5c', marginBottom: 12 },
  quickRow:    { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  quickBtn:    { background: '#111827', border: '1px solid #1a3a25', borderRadius: 8, padding: '6px 12px', color: '#86efac', cursor: 'pointer', fontSize: 12, fontWeight: 500 },
  chat:        { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 12, maxHeight: 'calc(100vh - 320px)', minHeight: 200 },
  userMsg:     { display: 'flex', justifyContent: 'flex-end' },
  aiMsg:       { display: 'flex', gap: 8, alignItems: 'flex-start' },
  aiAvatar:    { width: 32, height: 32, borderRadius: 8, background: '#14532d', border: '1px solid #1a3a25', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  userBubble:  { background: '#14532d', color: '#f0fdf4', borderRadius: '12px 12px 2px 12px', padding: '10px 14px', fontSize: 14, maxWidth: '70%', lineHeight: 1.5, border: '1px solid #1a3a25' },
  aiBubble:    { background: '#111827', border: '1px solid #1a3a25', color: '#f0fdf4', borderRadius: '12px 12px 12px 2px', padding: '10px 14px', fontSize: 14, maxWidth: '80%', lineHeight: 1.6, whiteSpace: 'pre-wrap' },
  typing:      { color: '#4b7a5c', letterSpacing: 4 },
  inputRow:    { display: 'flex', gap: 10, marginTop: 12, alignItems: 'flex-end' },
  input:       { flex: 1, background: '#111827', border: '1px solid #1a3a25', borderRadius: 10, padding: '10px 14px', color: '#f0fdf4', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit' },
  sendBtn:     { border: 'none', borderRadius: 10, width: 48, height: 48, cursor: 'pointer', fontSize: 16, fontWeight: 700, flexShrink: 0, transition: 'background 0.2s' },
}
