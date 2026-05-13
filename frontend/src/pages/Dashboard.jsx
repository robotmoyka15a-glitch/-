import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { shiftsAPI, eventsAPI } from '../api'
import dayjs from 'dayjs'

const C = {
  BRAND_GREEN:     '#22c55e',
  BG_BASE:         '#0a0f0d',
  BG_CARD:         '#111827',
  BORDER:          '#1a3a25',
  TEXT_PRIMARY:    '#f0fdf4',
  TEXT_SECONDARY:  '#86efac',
  TEXT_MUTED:      '#4b7a5c',
  ACCENT_YELLOW:   '#fbbf24',
  ACCENT_RED:      '#ef4444',
  ACCENT_BLUE:     '#38bdf8',
}

function StatCard({ icon, label, value, sub, color = C.ACCENT_BLUE }) {
  return (
    <div style={{ ...s.card, borderTop: `3px solid ${color}` }}>
      <div style={s.cardIcon}>{icon}</div>
      <div style={{ ...s.cardValue, color: C.TEXT_PRIMARY }} title={String(value)}>{value}</div>
      <div style={s.cardLabel}>{label}</div>
      {sub && <div style={s.cardSub}>{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { user, activeShift, todayStats, fetchTodayStats, fetchActiveShift } = useStore()
  const [events, setEvents]   = useState([])
  const [shifts, setShifts]   = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      fetchTodayStats(),
      fetchActiveShift(),
      eventsAPI.today().then(r => setEvents(r.data.slice(0, 8))).catch(() => {}),
      shiftsAPI.today().then(r => setShifts(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false))

    const interval = setInterval(() => {
      fetchTodayStats()
      fetchActiveShift()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const stats = todayStats?.summary || {}
  const now = dayjs().format('DD.MM.YYYY HH:mm')

  return (
    <div style={s.page}>
      {/* Заголовок */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>
            Добро пожаловать{user ? `, ${user.full_name.split(' ')[0]}` : ''}
          </h1>
          <div style={s.date}>{now} · Сегодня</div>
        </div>
        {user?.role === 'admin' && (
          <div style={s.adminBadge}>Администратор</div>
        )}
      </div>

      {/* Статус смены */}
      {activeShift ? (
        <div style={s.shiftActive}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: C.BRAND_GREEN, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: C.TEXT_SECONDARY }}>
            Смена открыта с <b style={{ color: C.BRAND_GREEN }}>{activeShift.started_at?.slice(11, 16)}</b>
          </span>
          {activeShift.is_late ? (
            <span style={s.lateBadge}>⚠ Опоздание {activeShift.late_minutes} мин</span>
          ) : null}
        </div>
      ) : (
        <div style={s.shiftInactive}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#334155', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: C.TEXT_MUTED }}>Смена не открыта</span>
          {user?.role === 'operator' && (
            <button style={s.quickBtn} onClick={() => navigate('/shift')}>
              Открыть смену →
            </button>
          )}
        </div>
      )}

      {/* Карточки статистики */}
      <div style={s.statsGrid}>
        <StatCard
          icon={<CarIcon />}
          label="Машин сегодня"
          value={loading ? '...' : (stats.total_cars ?? 0)}
          color={C.BRAND_GREEN}
        />
        <StatCard
          icon="💰"
          label="Выручка"
          value={loading ? '...' : `${Math.round(stats.total_revenue ?? 0)} ₽`}
          sub={`осн: ${Math.round(stats.main_revenue ?? 0)} ₽`}
          color={C.ACCENT_YELLOW}
        />
        <StatCard
          icon="⭐"
          label="Доп. услуги"
          value={loading ? '...' : (stats.extra_count ?? 0)}
          sub={`+${Math.round(stats.extra_revenue ?? 0)} ₽`}
          color="#a78bfa"
        />
        <StatCard
          icon="🪟"
          label="Стёкла протёрты"
          value={loading ? '...' : (stats.wiped_count ?? 0)}
          color={C.ACCENT_BLUE}
        />
      </div>

      {/* Смены + события */}
      <div style={s.bottom}>
        {/* Смены сегодня */}
        <div style={s.panel}>
          <div style={s.panelTitle}>Смены сегодня</div>
          {shifts.length === 0 ? (
            <div style={s.empty}>Смен ещё нет</div>
          ) : shifts.map(sh => (
            <div key={sh.id} style={s.shiftRow}>
              <div>
                <span style={s.shiftName}>{sh.full_name}</span>
                <span style={s.shiftTime}>
                  {sh.started_at?.slice(11, 16)}–{sh.ended_at ? sh.ended_at.slice(11, 16) : '...'}
                </span>
              </div>
              <div style={s.shiftMeta}>
                <span style={{ color: C.TEXT_SECONDARY }}>🚗 {sh.car_count}</span>
                <span style={{ color: C.ACCENT_YELLOW }}>💰 {Math.round(sh.total_amount)} ₽</span>
                {sh.is_late ? <span style={s.lateBadge}>⚠ опоздал</span> : null}
                {!sh.ended_at ? <span style={s.openBadge}>открыта</span> : null}
              </div>
            </div>
          ))}
        </div>

        {/* Последние события */}
        <div style={s.panel}>
          <div style={s.panelTitle}>Последние события</div>
          {events.length === 0 ? (
            <div style={s.empty}>Событий ещё нет</div>
          ) : events.map(ev => (
            <div key={ev.id} style={s.eventRow}>
              <span style={s.eventTime}>{ev.created_at?.slice(11, 16)}</span>
              <span style={s.eventTitle}>{ev.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3v-5l2.5-6h13L21 12v5h-2"/>
      <circle cx="7.5" cy="17.5" r="2.5"/>
      <circle cx="16.5" cy="17.5" r="2.5"/>
    </svg>
  )
}

const s = {
  page:         { padding: '24px 28px', maxWidth: 1100, margin: '0 auto' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title:        { fontSize: 22, fontWeight: 700, color: '#f0fdf4', margin: 0 },
  date:         { fontSize: 13, color: '#4b7a5c', marginTop: 4 },
  adminBadge:   { background: '#14532d', color: '#22c55e', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, border: '1px solid #1a3a25' },

  shiftActive:  { background: '#0d1a12', border: '1px solid #1a3a25', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, fontSize: 14 },
  shiftInactive:{ background: '#111827', border: '1px solid #1a3a25', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, fontSize: 14 },
  lateBadge:    { background: '#451a03', color: '#fbbf24', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 },
  openBadge:    { background: '#14532d', color: '#22c55e', borderRadius: 6, padding: '2px 8px', fontSize: 11 },
  quickBtn:     { marginLeft: 'auto', background: '#22c55e', color: '#0a0f0d', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700 },

  statsGrid:    { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 },
  card:         { background: '#111827', border: '1px solid #1a3a25', borderRadius: 12, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 4 },
  cardIcon:     { fontSize: 26, marginBottom: 4 },
  cardValue:    { fontSize: 28, fontWeight: 700, lineHeight: 1 },
  cardLabel:    { fontSize: 12, color: '#4b7a5c', fontWeight: 500 },
  cardSub:      { fontSize: 11, color: '#4b7a5c', marginTop: 2 },

  bottom:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  panel:        { background: '#111827', border: '1px solid #1a3a25', borderRadius: 12, padding: 20 },
  panelTitle:   { fontSize: 14, fontWeight: 600, color: '#86efac', marginBottom: 16 },
  empty:        { color: '#4b7a5c', fontSize: 13 },

  shiftRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a3a25' },
  shiftName:    { fontSize: 13, fontWeight: 600, color: '#f0fdf4', marginRight: 8 },
  shiftTime:    { fontSize: 12, color: '#4b7a5c' },
  shiftMeta:    { display: 'flex', gap: 8, fontSize: 12, alignItems: 'center' },

  eventRow:     { display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid #1a3a25', alignItems: 'flex-start' },
  eventTime:    { fontSize: 11, color: '#4b7a5c', flexShrink: 0, marginTop: 1 },
  eventTitle:   { fontSize: 13, color: '#86efac' },
}
