import React, { useState, useEffect, useRef } from 'react'
import { aiAPI } from '../api'

export default function AIChat() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Привет! Я AI-помощник автомойки. Спросите меня что-нибудь: сколько машин за сегодня, какова выручка, кто на смене, или любой другой вопрос.' }
  ])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [aiStatus, setStatus] = useState(null)
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
      setMessages(m => [...m, { role: 'ai', text: '⚠️ Не удалось получить ответ. Попробуйте позже.' }])
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

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h2 style={s.title}>🤖 AI-помощник</h2>
        <div style={aiStatus?.available ? s.aiOn : s.aiOff}>
          {aiStatus === null ? '...' : aiStatus.available ? '✓ AI активен' : '○ Режим запросов БД'}
        </div>
      </div>

      {!aiStatus?.available && (
        <div style={s.aiHint}>
          💡 AI-модель не загружена. Работает упрощённый режим — запросы напрямую к данным системы.
          Чтобы включить полный AI, скачайте модель и укажите путь в Настройках.
        </div>
      )}

      {/* Быстрые вопросы */}
      <div style={s.quickRow}>
        {quickQuestions.map(q => (
          <button key={q} style={s.quickBtn} onClick={() => { setInput(q); }}>
            {q}
          </button>
        ))}
        <button style={{ ...s.quickBtn, background: '#1e3a5f', color: '#38bdf8' }} onClick={getSummary} disabled={loading}>
          📊 Сводка дня
        </button>
      </div>

      {/* Чат */}
      <div style={s.chat}>
        {messages.map((m, i) => (
          <div key={i} style={m.role === 'user' ? s.userMsg : s.aiMsg}>
            {m.role === 'ai' && <div style={s.aiLabel}>🤖</div>}
            <div style={m.role === 'user' ? s.userBubble : s.aiBubble}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={s.aiMsg}>
            <div style={s.aiLabel}>🤖</div>
            <div style={s.aiBubble}>
              <span style={s.typing}>●●●</span>
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
        <button style={s.sendBtn} onClick={send} disabled={loading || !input.trim()}>
          {loading ? '...' : '▶'}
        </button>
      </div>
    </div>
  )
}

const s = {
  page:    { padding: '24px 28px', maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 0px)' },
  header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title:   { fontSize: 20, fontWeight: 700, color: '#e2e8f0' },
  aiOn:    { background: '#052e16', color: '#4ade80', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 600 },
  aiOff:   { background: '#1e293b', color: '#64748b', borderRadius: 8, padding: '4px 12px', fontSize: 12 },
  aiHint:  { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#64748b', marginBottom: 12 },
  quickRow:{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  quickBtn:{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '6px 12px', color: '#94a3b8', cursor: 'pointer', fontSize: 12, fontWeight: 500 },
  chat:    { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 12, maxHeight: 'calc(100vh - 320px)', minHeight: 200 },
  userMsg: { display: 'flex', justifyContent: 'flex-end' },
  aiMsg:   { display: 'flex', gap: 8, alignItems: 'flex-start' },
  aiLabel: { fontSize: 20, flexShrink: 0 },
  userBubble:{ background: '#0369a1', color: '#fff', borderRadius: '12px 12px 2px 12px', padding: '10px 14px', fontSize: 14, maxWidth: '70%', lineHeight: 1.5 },
  aiBubble:  { background: '#0d1b2e', border: '1px solid #1e3a5f', color: '#e2e8f0', borderRadius: '12px 12px 12px 2px', padding: '10px 14px', fontSize: 14, maxWidth: '80%', lineHeight: 1.6, whiteSpace: 'pre-wrap' },
  typing:  { color: '#475569', letterSpacing: 3, animation: 'pulse 1s infinite' },
  inputRow:{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'flex-end' },
  input:   { flex: 1, background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 10, padding: '10px 14px', color: '#e2e8f0', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit' },
  sendBtn: { background: '#0369a1', color: '#fff', border: 'none', borderRadius: 10, width: 44, height: 44, cursor: 'pointer', fontSize: 16, fontWeight: 700, flexShrink: 0 },
}
