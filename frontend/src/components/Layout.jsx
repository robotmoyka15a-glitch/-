import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import RobotLogo from './RobotLogo'
import { settingsAPI } from '../api'

// SVG иконки навигации
function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  )
}
function IconShift() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}
function IconCar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3v-5l2.5-6h13L21 12v5h-2"/>
      <circle cx="7.5" cy="17.5" r="2.5"/>
      <circle cx="16.5" cy="17.5" r="2.5"/>
    </svg>
  )
}
function IconEvents() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  )
}
function IconReports() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}
function IconCamera() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}
function IconAI() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
      <path d="M9 8h.01M15 8h.01M9 12h6"/>
    </svg>
  )
}
function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )
}
function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}
function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}
function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

const nav = [
  { to: '/',         Icon: IconHome,     label: 'Главная',     roles: ['admin','operator'] },
  { to: '/shift',    Icon: IconShift,    label: 'Смена',       roles: ['admin','operator'] },
  { to: '/cars',     Icon: IconCar,      label: 'Машины',      roles: ['admin','operator'] },
  { to: '/events',   Icon: IconEvents,   label: 'События',     roles: ['admin','operator'] },
  { to: '/reports',  Icon: IconReports,  label: 'Отчёты',      roles: ['admin','operator'] },
  { to: '/cameras',  Icon: IconCamera,   label: 'Камеры',      roles: ['admin'] },
  { to: '/ai',       Icon: IconAI,       label: 'AI-помощник', roles: ['admin','operator'] },
  { to: '/settings', Icon: IconSettings, label: 'Настройки',   roles: ['admin'] },
]

const C = {
  // Dark theme colors matching index.css variables
  BRAND_GREEN:      '#3b82f6',       // Blue accent (primary)
  BRAND_GREEN_DARK: '#1e3a5f',       // Darker blue for backgrounds
  BRAND_GREEN_DIM:  'rgba(59,130,246,0.1)', // Dimmed blue
  BG_BASE:          '#0f172a',       // Slate 900
  BG_CARD:          '#1e293b',       // Slate 800
  BG_SIDEBAR:       '#0f172a',       // Same as base
  BORDER:           '#334155',       // Slate 700
  TEXT_PRIMARY:     '#f8fafc',       // Slate 50
  TEXT_SECONDARY:   '#94a3b8',       // Slate 400
  TEXT_MUTED:       '#64748b',       // Slate 500
  ACCENT_RED:       '#ef4444',       // Red 500
  SUCCESS:          '#10b981',       // Emerald 500
  WARNING:          '#f59e0b',       // Amber 500
}

export default function Layout() {
  const { user, activeShift, logout } = useStore()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  // Автоматический онбординг: если admin и Telegram не настроен — показываем мастер
  useEffect(() => {
    if (user?.role === 'admin') {
      settingsAPI.get().then(r => {
        const cfg = r.data
        const isEmpty = !cfg.tg_bot_token && !cfg.tg_admin_chat_id
        if (isEmpty) navigate('/onboarding')
      }).catch(() => {})
    }
  }, [user])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const visibleNav = nav.filter(n => user && n.roles.includes(user.role))

  return (
    <div style={styles.root}>
      {/* Боковая панель */}
      <aside style={{ ...styles.sidebar, width: collapsed ? 64 : 224 }}>
        {/* Лого */}
        <div style={styles.sidebarHeader}>
          {!collapsed && (
            <RobotLogo size={32} showText={true} />
          )}
          {collapsed && (
            <RobotLogo size={32} showText={false} />
          )}
          <button style={styles.collapseBtn} onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Развернуть' : 'Свернуть'}>
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        </div>

        {/* Навигация */}
        <nav style={styles.nav}>
          {visibleNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              style={({ isActive }) => ({
                ...styles.navItem,
                background: isActive ? C.BRAND_GREEN_DIM : 'transparent',
                color: isActive ? C.BRAND_GREEN : C.TEXT_MUTED,
                borderLeft: isActive ? `3px solid ${C.BRAND_GREEN}` : '3px solid transparent',
              })}
              title={collapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  <span style={{ ...styles.navIcon, color: isActive ? C.BRAND_GREEN : C.TEXT_MUTED }}>
                    <item.Icon />
                  </span>
                  {!collapsed && <span style={styles.navLabel}>{item.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Пользователь */}
        <div style={styles.sidebarFooter}>
          {activeShift && (
            <div style={styles.shiftBadge} title="Смена активна">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.BRAND_GREEN, display: 'inline-block', flexShrink: 0 }} />
              {!collapsed && <span style={{ fontSize: 12, fontWeight: 600, color: C.BRAND_GREEN }}>Смена активна</span>}
            </div>
          )}
          {!collapsed && (
            <div style={styles.userInfo}>
              <div style={styles.userName}>{user?.full_name}</div>
              <div style={styles.userRole}>
                {user?.role === 'admin' ? 'Администратор' : 'Оператор'}
              </div>
            </div>
          )}
          <button style={styles.logoutBtn} onClick={handleLogout} title="Выйти">
            <IconLogout />
          </button>
        </div>
      </aside>

      {/* Основной контент */}
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

const styles = {
  root: {
    display: 'flex', height: '100vh',
    background: C.BG_BASE,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    color: C.TEXT_PRIMARY,
    overflow: 'hidden',
  },
  sidebar: {
    background: C.BG_SIDEBAR,
    borderRight: `1px solid ${C.BORDER}`,
    display: 'flex', flexDirection: 'column',
    transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)', flexShrink: 0,
  },
  sidebarHeader: {
    padding: '16px 14px',
    borderBottom: `1px solid ${C.BORDER}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 72, gap: 8,
  },
  collapseBtn: {
    background: 'transparent', border: 'none',
    color: C.TEXT_MUTED,
    cursor: 'pointer', padding: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, flexShrink: 0,
    transition: 'all 0.2s',
  },
  nav: { flex: 1, padding: '12px 0', overflowY: 'auto' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px', textDecoration: 'none',
    fontSize: 14, fontWeight: 500, transition: 'all 0.2s',
    cursor: 'pointer',
    borderRadius: 8, margin: '2px 8px',
  },
  navIcon: {
    width: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    transition: 'color 0.2s',
  },
  navLabel: { whiteSpace: 'nowrap', overflow: 'hidden' },
  sidebarFooter: {
    borderTop: `1px solid ${C.BORDER}`, padding: '14px',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  shiftBadge: {
    background: C.BRAND_GREEN_DIM,
    border: `1px solid ${C.BRAND_GREEN}33`,
    borderRadius: 8, padding: '8px 10px',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  userInfo: { overflow: 'hidden' },
  userName: {
    fontSize: 14, fontWeight: 600, color: C.TEXT_PRIMARY,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  userRole: { fontSize: 12, color: C.TEXT_MUTED, marginTop: 2, fontWeight: 500 },
  logoutBtn: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', 
    cursor: 'pointer',
    color: '#f87171', padding: 8, alignSelf: 'stretch',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 8,
    transition: 'all 0.2s',
  },
  main: {
    flex: 1, overflow: 'auto', background: C.BG_BASE,
  },
}
