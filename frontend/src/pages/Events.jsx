import React, { useState, useEffect } from 'react'
import { eventsAPI } from '../api'
import { useStore } from '../store'

const C = {
  BRAND_GREEN:     '#3b82f6',
  BRAND_GREEN_DIM: 'rgba(59,130,246,0.1)',
  BG_BASE:         '#0f172a',
  BG_CARD:         '#1e293b',
  BG_SIDEBAR:      '#0f172a',
  BORDER:          '#334155',
  TEXT_PRIMARY:    '#f8fafc',
  TEXT_SECONDARY:  '#94a3b8',
  TEXT_MUTED:      '#64748b',
  ACCENT_YELLOW:   '#fbbf24',
  ACCENT_RED:      '#ef4444',
}

const TYPE_ICONS = {
  shift_start: '▶',
  shift_end:   '■',
  car_added:   '🚗',
  late:        '⚠',
  camera:      '📷',
  admin_note:  '📝',
  system:      '⚙',
  ai_query:    '🤖',
}
const TYPE_LABELS = {
  shift_start: 'Начало смены',
  shift_end:   'Конец смены',
  car_added:   'Машина',
  late:        'Опоздание',
  camera:      'Камера',
  admin_note:  'Заметка',
  system:      'Система',
  ai_query:    'AI',
}
const TYPE_COLORS = {
  shift_start: '#3b82f6',
  shift_end:   '#ef4444',
  car_added:   '#38bdf8',
  late:        '#fbbf24',
  camera:      '#a78bfa',
  admin_note:  '#fbbf24',
  system:      '#64748b',
  ai_query:    '#34d399',
}

export default function Events() {
  const { user } = useStore()
  const [events, setEvents]     = useState([])
  const [filter, setFilter]     = useState('')
  const [note, setNote]         = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [loading, setLoading]   = useState(false)
  const [msg, setMsg]           = useState(null)

  const load = (type = filter) => {
    const params = { limit: 100 }
    if (type) params.event_type = type
    eventsAPI.list(params).then(r => setEvents(r.data)).catch(() => {})
  }

  useEffect(() => { load() }, [filter])

  const handleNote = async (e) => {
    e.preventDefault()
    if (!noteTitle.trim()) return
    setLoading(true)
    try {
      await eventsAPI.addNote({ title: noteTitle, body: note })
      setNoteTitle(''); setNote('')
      setMsg({ type: 'success', text: 'Заметка добавлена' })
      load()
    } catch { setMsg({ type: 'error', text: 'Ошибка' }) }
    finally { setLoading(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить событие?')) return
    await eventsAPI.delete(id)
    load()
  }

  return (
    <div style={s.page}>
      <h2 style={s.title}>Журнал событий</h2>

      {/* Фильтры */}
      <div style={s.filters}>
        {[['', 'Все'], ...Object.entries(TYPE_LABELS)].map(([k, v]) => (
          <button key={k}
            style={{
              ...s.filterBtn,
              background: filter === k ? C.BRAND_GREEN_DIM : 'transparent',
              color: filter === k ? C.BRAND_GREEN : C.TEXT_MUTED,
              border: `1px solid ${filter === k ? C.BRAND_GREEN : C.BORDER}`,
            }}
            onClick={() => setFilter(k)}
          >
            {k ? (TYPE_ICONS[k] + ' ') : ''}{v}
          </button>
        ))}
      </div>

      {/* Добавить заметку (только admin) */}
      {user?.role === 'admin' && (
        <form onSubmit={handleNote} style={s.noteForm}>
          <div style={s.noteFormTitle}>Добавить заметку</div>
          <input style={s.input} placeholder="Заголовок заметки *"
            value={noteTitle} onChange={e => setNoteTitle(e.target.value)} />
          <textarea style={{ ...s.input, height: 60, resize: 'vertical' }}
            placeholder="Подробности (необязательно)"
            value={note} onChange={e => setNote(e.target.value)} />
          {msg && <div style={msg.type === 'success' ? s.ok : s.err}>{msg.text}</div>}
          <button style={s.noteBtn} type="submit" disabled={loading}>
            {loading ? '...' : '+ Добавить'}
          </button>
        </form>
      )}

      {/* Список событий */}
      <div style={s.list}>
        {events.length === 0 ? (
          <div style={s.empty}>Событий нет</div>
        ) : events.map(ev => (
          <div key={ev.id} style={s.item}>
            <div style={{
              ...s.typeDot,
              background: (TYPE_COLORS[ev.event_type] || '#64748b') + '22',
              color: TYPE_COLORS[ev.event_type] || '#64748b',
            }}>
              {TYPE_ICONS[ev.event_type] || '●'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.itemHeader}>
                <span style={s.itemTitle}>{ev.title}</span>
                <span style={s.itemTime}>{ev.created_at?.slice(0, 16).replace('T', ' ')}</span>
              </div>
              {ev.body && <div style={s.itemBody}>{ev.body}</div>}
              {ev.full_name && <div style={s.itemUser}>👤 {ev.full_name}</div>}
            </div>
            {user?.role === 'admin' && ev.event_type === 'admin_note' && (
              <button style={s.delBtn} onClick={() => handleDelete(ev.id)} title="Удалить">✕</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const s = {
  page:          { padding: '24px 28px', maxWidth: 860, margin: '0 auto' },
  title:         { fontSize: 20, fontWeight: 700, color: '#f8fafc', marginBottom: 16 },
  filters:       { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  filterBtn:     { borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all 0.15s' },
  noteForm:      { background: '#1e293b', border: '1px solid #1a3a25', borderRadius: 12, padding: 20, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 },
  noteFormTitle: { fontSize: 14, fontWeight: 600, color: '#fbbf24' },
  input:         { background: '#0f172a', border: '1px solid #1a3a25', borderRadius: 8, padding: '9px 12px', color: '#f8fafc', fontSize: 13, outline: 'none', fontFamily: 'inherit' },
  noteBtn:       { background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid #1a3a25', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, alignSelf: 'flex-start' },
  ok:            { color: '#3b82f6', fontSize: 13 },
  err:           { color: '#ef4444', fontSize: 13 },
  list:          { display: 'flex', flexDirection: 'column', gap: 2 },
  empty:         { color: '#64748b', fontSize: 13 },
  item:          { display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid #1a3a25', alignItems: 'flex-start' },
  typeDot:       { width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, fontWeight: 700 },
  itemHeader:    { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  itemTitle:     { fontSize: 13, fontWeight: 500, color: '#f8fafc' },
  itemTime:      { fontSize: 11, color: '#64748b', flexShrink: 0 },
  itemBody:      { fontSize: 12, color: '#64748b', marginTop: 3 },
  itemUser:      { fontSize: 11, color: '#64748b', marginTop: 3 },
  delBtn:        { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14, padding: '4px 6px' },
}
