import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { shiftsAPI, eventsAPI } from '../api'
import dayjs from 'dayjs'

function StatCard({ icon, label, value, sub, color = '#38bdf8' }) {
  return (
    <div style={{ ...s.card, borderTop: `3px solid ${color}` }}>
      <div style={s.cardIcon}>{icon}</div>
      <div style={s.cardValue} title={value}>{value}</div>
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
          <div style={s.adminBadge}>👑 Администратор</div>
        )}
      </div>

      {/* Статус смены */}
      {activeShift ? (
        <div style={s.shiftActive}>
          <span>🟢</span>
          <span>Смена открыта с <b>{activeShift.started_at?.slice(11, 16)}</b></span>
          {activeShift.is_late ? (
            <span style={s.lateBadge}>⚠️ Опоздание {activeShift.late_minutes} мин</span>
          ) : null}
        </div>
      ) : (
        <div style={s.shiftInactive}>
          <span>⚪</span>
          <span>Смена не открыта</span>
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
          icon="🚗" label="Машин сегодня"
          value={loading ? '...' : (stats.total_cars ?? 0)}
          color="#38bdf8"
        />
        <StatCard
          icon="💰" label="Выручка"
          value={loading ? '...' : `${Math.round(stats.total_revenue ?? 0)} ₽`}
          sub={`осн: ${Math.round(stats.main_revenue ?? 0)} ₽`}
          color="#4ade80"
        />
        <StatCard
          icon="⭐" label="Доп. услуги"
          value={loading ? '...' : (stats.extra_count ?? 0)}
          sub={`+${Math.round(stats.extra_revenue ?? 0)} ₽`}
          color="#f59e0b"
        />
        <StatCard
          icon="🪟" label="Стёкла протёрты"
          value={loading ? '...' : (stats.wiped_count ?? 0)}
          color="#a78bfa"
        />
      </div>

      {/* Смены + события */}
      <div style={s.bottom}>
        {/* Смены сегодня */}
        <div style={s.panel}>
          <div style={s.panelTitle}>⏱️ Смены сегодня</div>
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
                <span>🚗 {sh.car_count}</span>
                <span>💰 {Math.round(sh.total_amount)} ₽</span>
                {sh.is_late ? <span style={s.lateBadge}>⚠️ опоздал</span> : null}
                {!sh.ended_at ? <span style={s.openBadge}>открыта</span> : null}
              </div>
            </div>
          ))}
        </div>

        {/* Последние события */}
        <div style={s.panel}>
          <div style={s.panelTitle}>📋 Последние события</div>
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

const s = {
  page:         { padding: '24px 28px', maxWidth: 1100, margin: '0 auto' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title:        { fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 },
  date:         { fontSize: 13, color: '#64748b', marginTop: 4 },
  adminBadge:   { background: '#1e3a5f', color: '#38bdf8', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600 },

  shiftActive:  { background: '#052e16', border: '1px solid #166534', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, fontSize: 14, color: '#4ade80' },
  shiftInactive:{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, fontSize: 14, color: '#64748b' },
  lateBadge:    { background: '#451a03', color: '#fb923c', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 },
  openBadge:    { background: '#052e16', color: '#4ade80', borderRadius: 6, padding: '2px 8px', fontSize: 11 },
  quickBtn:     { marginLeft: 'auto', background: '#0369a1', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 },

  statsGrid:    { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 },
  card:         { background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 12, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 4 },
  cardIcon:     { fontSize: 26, marginBottom: 4 },
  cardValue:    { fontSize: 28, fontWeight: 700, color: '#e2e8f0', lineHeight: 1 },
  cardLabel:    { fontSize: 12, color: '#64748b', fontWeight: 500 },
  cardSub:      { fontSize: 11, color: '#475569', marginTop: 2 },

  bottom:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  panel:        { background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 12, padding: 20 },
  panelTitle:   { fontSize: 14, fontWeight: 600, color: '#38bdf8', marginBottom: 16 },
  empty:        { color: '#475569', fontSize: 13 },

  shiftRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1e293b' },
  shiftName:    { fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginRight: 8 },
  shiftTime:    { fontSize: 12, color: '#64748b' },
  shiftMeta:    { display: 'flex', gap: 8, fontSize: 12, color: '#94a3b8', alignItems: 'center' },

  eventRow:     { display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid #1e293b', alignItems: 'flex-start' },
  eventTime:    { fontSize: 11, color: '#475569', flexShrink: 0, marginTop: 1 },
  eventTitle:   { fontSize: 13, color: '#cbd5e1' },
}
