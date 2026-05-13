import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import { shiftsAPI } from '../api'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
dayjs.extend(duration)

const C = {
  BRAND_GREEN:      '#22c55e',
  BRAND_GREEN_DARK: '#16a34a',
  BRAND_GREEN_DIM:  '#14532d',
  BG_BASE:          '#0a0f0d',
  BG_CARD:          '#111827',
  BG_SIDEBAR:       '#0d1a12',
  BORDER:           '#1a3a25',
  TEXT_PRIMARY:     '#f0fdf4',
  TEXT_SECONDARY:   '#86efac',
  TEXT_MUTED:       '#4b7a5c',
  ACCENT_YELLOW:    '#fbbf24',
  ACCENT_RED:       '#ef4444',
}

export default function Shift() {
  const { activeShift, startShift, endShift, fetchActiveShift } = useStore()
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
      const sec = diff % 60
      setElapsed(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      )
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
      const lateText = sh.is_late ? `\n⚠ Опоздание: ${sh.late_minutes} мин.` : '\n✓ Вовремя'
      setMessage({ type: 'success', text: `Смена открыта в ${sh.started_at.slice(11, 16)}${lateText}` })
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
      setMessage({ type: 'success', text: `Смена закрыта в ${sh.ended_at.slice(11, 16)}` })
      shiftsAPI.history({ limit: 10 }).then(r => setHistory(r.data))
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.detail || 'Ошибка' })
    } finally { setLoading(false) }
  }

  return (
    <div style={s.page}>
      <h2 style={s.title}>Управление сменой</h2>

      {/* Текущий статус */}
      {activeShift ? (
        <div style={s.activeCard}>
          <div style={s.activeHeader}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: C.BRAND_GREEN, display: 'inline-block' }} />
            <span style={s.activeLabel}>Смена открыта</span>
            <span style={s.timer}>{elapsed}</span>
          </div>
          <div style={s.activeInfo}>
            <span>Начало: <b style={{ color: C.BRAND_GREEN }}>{activeShift.started_at?.slice(11, 16)}</b></span>
            {activeShift.is_late && (
              <span style={s.lateTag}>⚠ опоздание {activeShift.late_minutes} мин</span>
            )}
            <span>Машин: <b style={{ color: C.TEXT_SECONDARY }}>{activeShift.car_count}</b></span>
            <span>Выручка: <b style={{ color: C.BRAND_GREEN }}>{Math.round(activeShift.total_amount ?? 0)} ₽</b></span>
          </div>
        </div>
      ) : (
        <div style={s.inactiveCard}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#334155', display: 'inline-block' }} />
          <span style={{ color: C.TEXT_MUTED }}>Смена не открыта</span>
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
            {loading ? 'Открываем...' : 'Открыть смену'}
          </button>
        ) : (
          <button style={s.btnEnd} onClick={handleEnd} disabled={loading}>
            {loading ? 'Закрываем...' : 'Закрыть смену'}
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
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Дата', 'Оператор', 'Начало', 'Конец', 'Машин', 'Выручка', 'Статус'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((sh, i) => (
                  <tr key={sh.id} style={{ background: i % 2 === 0 ? C.BG_BASE : C.BG_CARD }}>
                    <td style={s.td}>{sh.date}</td>
                    <td style={s.td}>{sh.full_name}</td>
                    <td style={s.td}>{sh.started_at?.slice(11, 16)}</td>
                    <td style={s.td}>{sh.ended_at ? sh.ended_at.slice(11, 16) : '—'}</td>
                    <td style={{ ...s.td, textAlign: 'center', color: C.TEXT_SECONDARY }}>{sh.car_count}</td>
                    <td style={{ ...s.td, color: C.BRAND_GREEN, fontWeight: 600 }}>{Math.round(sh.total_amount ?? 0)} ₽</td>
                    <td style={s.td}>
                      {!sh.ended_at
                        ? <span style={s.openBadge}>открыта</span>
                        : sh.is_late
                          ? <span style={s.lateBadge}>⚠ опоздал</span>
                          : <span style={s.okBadge}>✓</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  page:        { padding: '24px 28px', maxWidth: 900, margin: '0 auto' },
  title:       { fontSize: 20, fontWeight: 700, color: '#f0fdf4', marginBottom: 20 },
  timer:       { fontSize: 28, fontWeight: 700, color: '#22c55e', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', letterSpacing: 1 },
  activeCard:  { background: '#0d1a12', border: '1px solid #1a3a25', borderRadius: 12, padding: '16px 20px', marginBottom: 24 },
  activeHeader:{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  activeLabel: { fontSize: 15, fontWeight: 600, color: '#22c55e' },
  activeInfo:  { display: 'flex', gap: 20, fontSize: 14, color: '#86efac', flexWrap: 'wrap' },
  lateTag:     { background: '#451a03', color: '#fbbf24', borderRadius: 6, padding: '1px 8px', fontSize: 12 },
  inactiveCard:{ background: '#111827', border: '1px solid #1a3a25', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 10, fontSize: 14 },
  actionBlock: { background: '#111827', border: '1px solid #1a3a25', borderRadius: 12, padding: '20px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14 },
  noteRow:     { display: 'flex', flexDirection: 'column', gap: 6 },
  label:       { fontSize: 13, color: '#86efac' },
  input:       { background: '#0d1a12', border: '1px solid #1a3a25', borderRadius: 8, padding: '10px 14px', color: '#f0fdf4', fontSize: 14, outline: 'none' },
  btnStart:    { background: '#22c55e', color: '#0a0f0d', border: 'none', borderRadius: 8, padding: '14px', fontSize: 16, fontWeight: 800, cursor: 'pointer', letterSpacing: 0.5 },
  btnEnd:      { background: '#ef444415', color: '#ef4444', border: '1px solid #ef444440', borderRadius: 8, padding: '14px', fontSize: 16, fontWeight: 800, cursor: 'pointer' },
  msgOk:       { background: '#0d1a12', border: '1px solid #1a3a25', borderRadius: 8, padding: '12px 16px', color: '#22c55e', fontSize: 14, marginBottom: 20, whiteSpace: 'pre-line' },
  msgErr:      { background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '12px 16px', color: '#fca5a5', fontSize: 14, marginBottom: 20 },
  section:     { marginTop: 8 },
  sectionTitle:{ fontSize: 15, fontWeight: 600, color: '#86efac', marginBottom: 12 },
  empty:       { color: '#4b7a5c', fontSize: 13 },
  table:       { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:          { padding: '10px 12px', textAlign: 'left', color: '#4b7a5c', borderBottom: '1px solid #1a3a25', fontWeight: 500 },
  td:          { padding: '9px 12px', color: '#86efac', borderBottom: '1px solid #1a3a25' },
  okBadge:     { color: '#22c55e', fontWeight: 600 },
  lateBadge:   { background: '#451a03', color: '#fbbf24', borderRadius: 6, padding: '2px 8px', fontSize: 11 },
  openBadge:   { background: '#14532d', color: '#22c55e', borderRadius: 6, padding: '2px 8px', fontSize: 11 },
}
