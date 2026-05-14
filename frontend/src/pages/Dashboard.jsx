import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import { shiftAPI, eventAPI } from '../api'

const C = {
  BRAND_GREEN:      '#3b82f6',
  BRAND_GREEN_DARK: '#1e3a5f',
  BRAND_GREEN_DIM:  'rgba(59,130,246,0.1)',
  BG_BASE:          '#0f172a',
  BG_CARD:          '#1e293b',
  BORDER:           '#334155',
  TEXT_PRIMARY:     '#f8fafc',
  TEXT_SECONDARY:   '#94a3b8',
  TEXT_MUTED:       '#64748b',
  SUCCESS:          '#10b981',
  WARNING:          '#f59e0b',
  DANGER:           '#ef4444',
}

export default function Dashboard() {
  const { activeShift, setActiveShift } = useStore()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
    const interval = setInterval(loadDashboard, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadDashboard = async () => {
    try {
      if (!activeShift) {
        const shifts = await shiftAPI.getActive()
        if (shifts.data.length > 0) setActiveShift(shifts.data[0])
      }
      
      const events = await eventAPI.list({ limit: 5 })
      setStats({
        todayEvents: events.data.length,
        activeShift: !!activeShift,
        lastUpdate: new Date().toLocaleTimeString('ru-RU'),
      })
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={s.loading}>
        <div style={s.spinner}></div>
        <p style={s.loadingText}>Загрузка...</p>
      </div>
    )
  }

  return (
    <div style={s.root} className="animate-fade-in">
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>Главная</h1>
        <div style={s.dateTime}>{new Date().toLocaleDateString('ru-RU', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</div>
      </div>

      {/* Stats Cards */}
      <div style={s.grid}>
        <Card 
          title="Активная смена" 
          value={activeShift ? 'Открыта' : 'Закрыта'}
          icon="🔄"
          color={activeShift ? C.SUCCESS : C.TEXT_MUTED}
          bg={activeShift ? 'rgba(16,185,129,0.1)' : C.BG_CARD}
        />
        <Card 
          title="Событий сегодня" 
          value={stats?.todayEvents || 0}
          icon="📊"
          color={C.BRAND_GREEN}
          bg={C.BRAND_GREEN_DIM}
        />
        <Card 
          title="Статус системы" 
          value="Норма"
          icon="✅"
          color={C.SUCCESS}
          bg="rgba(16,185,129,0.1)"
        />
        <Card 
          title="Последнее обновление" 
          value={stats?.lastUpdate || '--:--'}
          icon="⏰"
          color={C.TEXT_SECONDARY}
          bg={C.BG_CARD}
        />
      </div>

      {/* Quick Actions */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Быстрые действия</h2>
        <div style={s.actions}>
          <ActionButton 
            label={activeShift ? 'Закрыть смену' : 'Открыть смену'}
            icon={activeShift ? '🔒' : '🔓'}
            color={activeShift ? C.DANGER : C.SUCCESS}
            onClick={() => console.log('Toggle shift')}
          />
          <ActionButton 
            label="Добавить событие"
            icon="➕"
            color={C.BRAND_GREEN}
            onClick={() => console.log('Add event')}
          />
          <ActionButton 
            label="Отчёт за день"
            icon="📋"
            color={C.WARNING}
            onClick={() => console.log('Daily report')}
          />
        </div>
      </div>
    </div>
  )
}

function Card({ title, value, icon, color, bg }) {
  return (
    <div style={{...s.card, background: bg}}>
      <div style={s.cardHeader}>
        <span style={s.cardIcon}>{icon}</span>
        <span style={s.cardTitle}>{title}</span>
      </div>
      <div style={{...s.cardValue, color}}>{value}</div>
    </div>
  )
}

function ActionButton({ label, icon, color, onClick }) {
  const [hover, setHover] = useState(false)
  
  return (
    <button
      style={{
        ...s.actionBtn,
        background: hover ? `${color}22` : 'transparent',
        borderColor: hover ? color : C.BORDER,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      <span style={{fontSize: 24}}>{icon}</span>
      <span style={{...s.actionLabel, color: hover ? color : C.TEXT_SECONDARY}}>{label}</span>
    </button>
  )
}

const s = {
  root: {
    padding: 32,
    minHeight: '100%',
    background: C.BG_BASE,
  },
  loading: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '100vh',
    background: C.BG_BASE,
  },
  spinner: {
    width: 40, height: 40,
    border: `3px solid ${C.BORDER}`,
    borderTop: `3px solid ${C.BRAND_GREEN}`,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: 16, color: C.TEXT_SECONDARY, fontSize: 14,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28, fontWeight: 700, color: C.TEXT_PRIMARY,
    margin: '0 0 8px 0',
  },
  dateTime: {
    fontSize: 14, color: C.TEXT_MUTED, textTransform: 'capitalize',
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220, 1fr))',
    gap: 20, marginBottom: 32,
  },
  card: {
    background: C.BG_CARD,
    border: `1px solid ${C.BORDER}`,
    borderRadius: 16,
    padding: 20,
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
  },
  cardIcon: { fontSize: 20 },
  cardTitle: { fontSize: 13, color: C.TEXT_SECONDARY, fontWeight: 500 },
  cardValue: { fontSize: 24, fontWeight: 700 },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18, fontWeight: 600, color: C.TEXT_PRIMARY,
    margin: '0 0 16px 0',
  },
  actions: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180, 1fr))',
    gap: 16,
  },
  actionBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    padding: 24,
    border: `1px solid ${C.BORDER}`,
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  actionLabel: {
    fontSize: 13, fontWeight: 600,
  },
}
