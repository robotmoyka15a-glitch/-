import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import { shiftsAPI } from '../api'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
dayjs.extend(duration)

export default function Shift() {
  const { user, activeShift, startShift, endShift, fetchActiveShift } = useStore()
  const [note, setNote]       = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [history, setHistory] = useState([])
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    fetchActiveShift()
    shiftsAPI.history({ limit: 10 }).then(r => setHistory(r.data)).catch(() => {})
  }, [])

  // Таймер смены
  useEffect(() => {
    if (!activeShift) { setElapsed(''); return }
    const tick = () => {
      const start = dayjs(activeShift.started_at)
      const diff  = dayjs().diff(start, 'second')
      const h = Math.floor(diff / 3600)
      const m = Math.floor((diff % 3600) / 60)
      const s = diff % 60
      setElapsed(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [activeShift])

  const handleStart = async () => {
    setLoading(true); setMessage(null)
    try {
      const sh = await startShift(note)
      setNote('')
      const late = sh.is_late
        ? `\n⚠️ Опоздание: ${sh.late_minutes} мин.`
        : '\n✓ Вовремя'
      setMessage({ type: 'success', text: `Смена открыта в ${sh.started_at.slice(11,16)}${late}` })
      shiftsAPI.history({ limit: 10 }).then(r => setHistory(r.data))
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.detail || 'Ошибка' })
    } finally { setLoading(false) }
  }

  const handleEnd = async () => {
    if (!window.confirm('Закрыть смену?')) return
    setLoading(true); setMessage(null)
    try {
      const sh = await endShift(note)
      setNote('')
      setMessage({ type: 'success', text: `Смена закрыта в ${sh.ended_at.slice(11,16)}` })
      shiftsAPI.history({ limit: 10 }).then(r => setHistory(r.data))
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.detail || 'Ошибка' })
    } finally { setLoading(false) }
  }

  return (
    <div style={s.page}>
      <h2 style={s.title}>⏱️ Управление сменой</h2>

      {/* Текущий статус */}
      {activeShift ? (
        <div style={s.activeCard}>
          <div style={s.activeHeader}>
            <span style={s.dot}>🟢</span>
            <span style={s.activeLabel}>Смена открыта</span>
            <span style={s.timer}>{elapsed}</span>
          </div>
          <div style={s.activeInfo}>
            <span>Начало: <b>{activeShift.started_at?.slice(11,16)}</b></span>
            {activeShift.is_late && (
              <span style={s.lateTag}>⚠️ опоздание {activeShift.late_minutes} мин</span>
            )}
            <span>Машин: <b>{activeShift.car_count}</b></span>
            <span>Выручка: <b>{Math.round(activeShift.total_amount ?? 0)} ₽</b></span>
          </div>
        </div>
      ) : (
        <div style={s.inactiveCard}>
          <span style={s.dot}>⚫</span>
          <span>Смена не открыта</span>
        </div>
      )}

      {/* Кнопки */}
      <div style={s.actionBlock}>
        <div style={s.noteRow}>
          <label style={s.label}>Примечание (необязательно)</label>
          <input
            style={s.input}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Заметка к смене..."
            maxLength={200}
          />
        </div>

        {!activeShift ? (
          <button style={s.btnStart} onClick={handleStart} disabled={loading}>
            {loading ? 'Открываем...' : '🟢 Открыть смену'}
          </button>
        ) : (
          <button style={s.btnEnd} onClick={handleEnd} disabled={loading}>
            {loading ? 'Закрываем...' : '🔴 Закрыть смену'}
          </button>
        )}
      </div>

      {message && (
        <div style={message.type === 'success' ? s.msgOk : s.msgErr}>
          {message.text}
        </div>
      )}

      {/* История смен */}
      <div style={s.section}>
        <h3 style={s.sectionTitle}>История смен</h3>
        {history.length === 0 ? (
          <div style={s.empty}>Нет данных</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {['Дата','Оператор','Начало','Конец','Машин','Выручка','Статус'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((sh, i) => (
                <tr key={sh.id} style={{ background: i % 2 === 0 ? '#0d1b2e' : '#0f1f35' }}>
                  <td style={s.td}>{sh.date}</td>
                  <td style={s.td}>{sh.full_name}</td>
                  <td style={s.td}>{sh.started_at?.slice(11,16)}</td>
                  <td style={s.td}>{sh.ended_at ? sh.ended_at.slice(11,16) : '—'}</td>
                  <td style={{ ...s.td, textAlign: 'center' }}>{sh.car_count}</td>
                  <td style={s.td}>{Math.round(sh.total_amount ?? 0)} ₽</td>
                  <td style={s.td}>
                    {!sh.ended_at
                      ? <span style={s.openBadge}>открыта</span>
                      : sh.is_late
                        ? <span style={s.lateBadge}>⚠️ опоздал</span>
                        : <span style={s.okBadge}>✓</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const s = {
  page:      { padding: '24px 28px', maxWidth: 900, margin: '0 auto' },
  title:     { fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 },
  dot:       { fontSize: 16 },
  timer:     { fontSize: 28, fontWeight: 700, color: '#38bdf8', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', letterSpacing: 1 },
  activeCard:  { background: '#052e16', border: '1px solid #166534', borderRadius: 12, padding: '16px 20px', marginBottom: 24 },
  activeHeader:{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  activeLabel: { fontSize: 15, fontWeight: 600, color: '#4ade80' },
  activeInfo:  { display: 'flex', gap: 20, fontSize: 14, color: '#86efac', flexWrap: 'wrap' },
  lateTag:     { background: '#451a03', color: '#fb923c', borderRadius: 6, padding: '1px 8px', fontSize: 12 },
  inactiveCard:{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 10, fontSize: 14, color: '#64748b' },
  actionBlock: { background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 12, padding: '20px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14 },
  noteRow:    { display: 'flex', flexDirection: 'column', gap: 6 },
  label:      { fontSize: 13, color: '#94a3b8' },
  input:      { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 14, outline: 'none' },
  btnStart:   { background: '#166534', color: '#4ade80', border: '1px solid #166534', borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  btnEnd:     { background: '#450a0a', color: '#f87171', border: '1px solid #7f1d1d', borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  msgOk:      { background: '#052e16', border: '1px solid #166534', borderRadius: 8, padding: '12px 16px', color: '#4ade80', fontSize: 14, marginBottom: 20, whiteSpace: 'pre-line' },
  msgErr:     { background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '12px 16px', color: '#fca5a5', fontSize: 14, marginBottom: 20 },
  section:    { marginTop: 8 },
  sectionTitle:{ fontSize: 15, fontWeight: 600, color: '#94a3b8', marginBottom: 12 },
  empty:      { color: '#475569', fontSize: 13 },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:         { padding: '10px 12px', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #1e3a5f', fontWeight: 500 },
  td:         { padding: '9px 12px', color: '#cbd5e1', borderBottom: '1px solid #1e293b' },
  okBadge:    { color: '#4ade80', fontWeight: 600 },
  lateBadge:  { background: '#451a03', color: '#fb923c', borderRadius: 6, padding: '2px 8px', fontSize: 11 },
  openBadge:  { background: '#052e16', color: '#4ade80', borderRadius: 6, padding: '2px 8px', fontSize: 11 },
}
