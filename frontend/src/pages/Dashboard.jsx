import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { shiftsAPI, eventsAPI } from '../api'
import dayjs from 'dayjs'

const C = {
  BRAND_GREEN:    '#22c55e',
  BG_BASE:        '#0a0f0d',
  BG_CARD:        '#111827',
  BORDER:         '#1a3a25',
  TEXT_PRIMARY:   '#f0fdf4',
  TEXT_SECONDARY: '#86efac',
  TEXT_MUTED:     '#4b7a5c',
  ACCENT_YELLOW:  '#fbbf24',
  ACCENT_BLUE:    '#38bdf8',
}

// ── Карточка статистики ───────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{ ...s.card, borderTop: `3px solid ${color}` }}>
      <div style={s.cardIcon}>{icon}</div>
      <div style={{ ...s.cardValue, color: C.TEXT_PRIMARY }}>{value}</div>
      <div style={s.cardLabel}>{label}</div>
      {sub && <div style={s.cardSub}>{sub}</div>}
    </div>
  )
}

// ── Основной компонент ────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, activeShift, todayStats, fetchTodayStats, fetchActiveShift } = useStore()
  const [events, setEvents] = useState([])
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick]     = useState(0)   // счётчик для принудительного обновления времени
  const navigate = useNavigate()
  const pollRef  = useRef(null)

  // Загрузка данных
  const reload = async (showLoader = false) => {
    if (showLoader) setLoading(true)
    await Promise.all([
      fetchTodayStats(),
      fetchActiveShift(),
      eventsAPI.today().then(r => setEvents(r.data.slice(0, 10))).catch(() => {}),
      shiftsAPI.today().then(r => setShifts(r.data)).catch(() => {}),
    ])
    if (showLoader) setLoading(false)
  }

  useEffect(() => {
    reload(true)

    // Автообновление каждые 20 сек (лёгкий polling)
    pollRef.current = setInterval(() => reload(false), 20_000)

    // Обновление отображаемого времени каждую секунду
    const clockId = setInterval(() => setTick(t => t + 1), 1000)

    return () => {
      clearInterval(pollRef.current)
      clearInterval(clockId)
    }
  }, [])

  const stats = todayStats?.summary || {}
  const now   = dayjs().format('DD.MM.YYYY HH:mm:ss')

  return (
    <div style={s.page}>
      {/* Заголовок */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>
            {user ? `${user.full_name.split(' ')[0]}, добрый день` : 'WashControl'}
          </h1>
          <div style={s.date}>{now}</div>
        </div>
        {user?.role === 'admin' && (
          <div style={s.adminBadge}>Администратор</div>
        )}
      </div>

      {/* Статус смены */}
      {activeShift ? (
        <div style={s.shiftActive}>
          <span style={s.dot} />
          <span style={{ color: C.TEXT_SECONDARY }}>
            Смена открыта с{' '}
            <strong style={{ color: C.BRAND_GREEN }}>
              {activeShift.started_at?.slice(11,16)}
            </strong>
          </span>
          {activeShift.is_late && (
            <span style={s.lateBadge}>⚠ Опоздание {activeShift.late_minutes} мин</span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.TEXT_MUTED }}>
            Машин: {activeShift.car_count}  ·  {Math.round(activeShift.total_amount ?? 0)} ₽
          </span>
        </div>
      ) : (
        <div style={s.shiftInactive}>
          <span style={{ ...s.dot, background: '#334155' }} />
          <span style={{ color: C.TEXT_MUTED }}>Смена не открыта</span>
          {user?.role === 'operator' && (
            <button style={s.quickBtn} onClick={() => navigate('/shift')}>
              Открыть смену →
            </button>
          )}
        </div>
      )}

      {/* Карточки */}
      <div style={s.statsGrid}>
        <StatCard icon={<CarSvg />} label="Машин сегодня"
          value={loading ? '…' : (stats.total_cars ?? 0)}
          color={C.BRAND_GREEN} />
        <StatCard icon="💰" label="Выручка"
          value={loading ? '…' : `${Math.round(stats.total_revenue ?? 0)} ₽`}
          sub={`осн. ${Math.round(stats.main_revenue ?? 0)} ₽`}
          color={C.ACCENT_YELLOW} />
        <StatCard icon="⭐" label="Доп. услуги"
          value={loading ? '…' : (stats.extra_count ?? 0)}
          sub={`+${Math.round(stats.extra_revenue ?? 0)} ₽`}
          color="#a78bfa" />
        <StatCard icon="🪟" label="Стёкла"
          value={loading ? '…' : (stats.wiped_count ?? 0)}
          color={C.ACCENT_BLUE} />
      </div>

      {/* Нижняя панель */}
      <div style={s.bottom}>
        <div style={s.panel}>
          <div style={s.panelTitle}>Смены сегодня</div>
          {shifts.length === 0 ? (
            <div style={s.empty}>Смен ещё нет</div>
          ) : shifts.map(sh => (
            <div key={sh.id} style={s.shiftRow}>
              <div>
                <span style={s.shiftName}>{sh.full_name}</span>
                <span style={s.shiftTime}>
                  {sh.started_at?.slice(11,16)}–{sh.ended_at ? sh.ended_at.slice(11,16) : '…'}
                </span>
              </div>
              <div style={s.shiftMeta}>
                <span style={{ color: C.TEXT_SECONDARY }}>🚗 {sh.car_count}</span>
                <span style={{ color: C.ACCENT_YELLOW }}>
                  {Math.round(sh.total_amount ?? 0)} ₽
                </span>
                {sh.is_late && <span style={s.lateBadge}>⚠</span>}
                {!sh.ended_at && <span style={s.openBadge}>активна</span>}
              </div>
            </div>
          ))}
        </div>

        <div style={s.panel}>
          <div style={s.panelTitle}>Последние события</div>
          {events.length === 0 ? (
            <div style={s.empty}>Событий ещё нет</div>
          ) : events.map(ev => (
            <div key={ev.id} style={s.eventRow}>
              <span style={s.eventTime}>{ev.created_at?.slice(11,16)}</span>
              <span style={s.eventTitle}>{ev.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CarSvg() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3v-5l2.5-6h13L21 12v5h-2"/>
      <circle cx="7.5" cy="17.5" r="2.5"/>
      <circle cx="16.5" cy="17.5" r="2.5"/>
    </svg>
  )
}

const s = {
  page:         { padding:'24px 28px', maxWidth:1100, margin:'0 auto' },
  header:       { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 },
  title:        { fontSize:22, fontWeight:700, color:C.TEXT_PRIMARY, margin:0 },
  date:         { fontSize:13, color:C.TEXT_MUTED, marginTop:4, fontVariantNumeric:'tabular-nums' },
  adminBadge:   { background:'#14532d', color:'#22c55e', borderRadius:8, padding:'6px 14px', fontSize:13, fontWeight:600, border:'1px solid #1a3a25' },
  dot:          { width:10, height:10, borderRadius:'50%', background:'#22c55e', display:'inline-block', flexShrink:0 },
  shiftActive:  { background:'#0d1a12', border:'1px solid #1a3a25', borderRadius:10, padding:'12px 16px', display:'flex', gap:10, alignItems:'center', marginBottom:20, fontSize:14 },
  shiftInactive:{ background:'#111827', border:'1px solid #1a3a25', borderRadius:10, padding:'12px 16px', display:'flex', gap:10, alignItems:'center', marginBottom:20, fontSize:14 },
  lateBadge:    { background:'#451a03', color:'#fbbf24', borderRadius:6, padding:'2px 8px', fontSize:12, fontWeight:600 },
  openBadge:    { background:'#14532d', color:'#22c55e', borderRadius:6, padding:'2px 8px', fontSize:11 },
  quickBtn:     { marginLeft:'auto', background:'#22c55e', color:'#0a0f0d', border:'none', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontSize:13, fontWeight:700 },
  statsGrid:    { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 },
  card:         { background:C.BG_CARD, border:'1px solid #1a3a25', borderRadius:12, padding:'20px 16px', display:'flex', flexDirection:'column', gap:4 },
  cardIcon:     { fontSize:26, marginBottom:4 },
  cardValue:    { fontSize:28, fontWeight:700, lineHeight:1 },
  cardLabel:    { fontSize:12, color:C.TEXT_MUTED, fontWeight:500 },
  cardSub:      { fontSize:11, color:C.TEXT_MUTED, marginTop:2 },
  bottom:       { display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 },
  panel:        { background:C.BG_CARD, border:'1px solid #1a3a25', borderRadius:12, padding:20 },
  panelTitle:   { fontSize:14, fontWeight:600, color:'#86efac', marginBottom:16 },
  empty:        { color:C.TEXT_MUTED, fontSize:13 },
  shiftRow:     { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #1a3a25' },
  shiftName:    { fontSize:13, fontWeight:600, color:C.TEXT_PRIMARY, marginRight:8 },
  shiftTime:    { fontSize:12, color:C.TEXT_MUTED },
  shiftMeta:    { display:'flex', gap:8, fontSize:12, alignItems:'center' },
  eventRow:     { display:'flex', gap:10, padding:'7px 0', borderBottom:'1px solid #1a3a25', alignItems:'flex-start' },
  eventTime:    { fontSize:11, color:C.TEXT_MUTED, flexShrink:0, marginTop:1 },
  eventTitle:   { fontSize:13, color:'#86efac' },
}
