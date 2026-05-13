import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useStore } from '../store'

const nav = [
  { to: '/',        icon: '🏠', label: 'Главная',    roles: ['admin','operator'] },
  { to: '/shift',   icon: '⏱️', label: 'Смена',      roles: ['admin','operator'] },
  { to: '/cars',    icon: '🚗', label: 'Машины',     roles: ['admin','operator'] },
  { to: '/events',  icon: '📋', label: 'События',    roles: ['admin','operator'] },
  { to: '/reports', icon: '📊', label: 'Отчёты',     roles: ['admin','operator'] },
  { to: '/cameras', icon: '📷', label: 'Камеры',     roles: ['admin'] },
  { to: '/ai',      icon: '🤖', label: 'AI-помощник',roles: ['admin','operator'] },
  { to: '/settings',icon: '⚙️', label: 'Настройки',  roles: ['admin'] },
]

export default function Layout() {
  const { user, activeShift, logout } = useStore()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const visibleNav = nav.filter(n => user && n.roles.includes(user.role))

  return (
    <div style={styles.root}>
      {/* Боковая панель */}
      <aside style={{ ...styles.sidebar, width: collapsed ? 64 : 220 }}>
        {/* Лого */}
        <div style={styles.sidebarHeader}>
          {!collapsed && (
            <div style={styles.logo}>
              <span style={styles.logoIcon}>🚿</span>
              <span style={styles.logoText}>WashControl</span>
            </div>
          )}
          <button style={styles.collapseBtn} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? '▶' : '◀'}
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
                background: isActive ? '#1e3a5f' : 'transparent',
                color: isActive ? '#38bdf8' : '#94a3b8',
                borderLeft: isActive ? '3px solid #38bdf8' : '3px solid transparent',
              })}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {!collapsed && <span style={styles.navLabel}>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Пользователь */}
        <div style={styles.sidebarFooter}>
          {activeShift && (
            <div style={styles.shiftBadge}>
              {!collapsed && <span>🟢 Смена активна</span>}
              {collapsed && <span title="Смена активна">🟢</span>}
            </div>
          )}
          {!collapsed && (
            <div style={styles.userInfo}>
              <div style={styles.userName}>{user?.full_name}</div>
              <div style={styles.userRole}>
                {user?.role === 'admin' ? '👑 Администратор' : '👤 Оператор'}
              </div>
            </div>
          )}
          <button style={styles.logoutBtn} onClick={handleLogout} title="Выйти">
            🚪
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
    display: 'flex', height: '100vh', background: '#0f172a',
    fontFamily: "'Segoe UI', -apple-system, sans-serif", color: '#e2e8f0',
    overflow: 'hidden',
  },
  sidebar: {
    background: '#0d1b2e', borderRight: '1px solid #1e3a5f',
    display: 'flex', flexDirection: 'column',
    transition: 'width 0.2s ease', flexShrink: 0,
  },
  sidebarHeader: {
    padding: '16px 12px', borderBottom: '1px solid #1e3a5f',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 64,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 8 },
  logoIcon: { fontSize: 22 },
  logoText: { fontWeight: 700, fontSize: 16, color: '#38bdf8', letterSpacing: '-0.3px' },
  collapseBtn: {
    background: 'none', border: 'none', color: '#475569',
    cursor: 'pointer', fontSize: 12, padding: 4,
  },
  nav: { flex: 1, padding: '8px 0', overflowY: 'auto' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 16px', textDecoration: 'none',
    fontSize: 14, fontWeight: 500, transition: 'all 0.15s',
    cursor: 'pointer', borderRadius: '0 6px 6px 0', marginRight: 8,
  },
  navIcon: { fontSize: 17, width: 22, textAlign: 'center', flexShrink: 0 },
  navLabel: { whiteSpace: 'nowrap' },
  sidebarFooter: {
    borderTop: '1px solid #1e3a5f', padding: '12px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  shiftBadge: {
    background: '#052e16', color: '#4ade80',
    borderRadius: 6, padding: '4px 8px', fontSize: 12, fontWeight: 600,
  },
  userInfo: { overflow: 'hidden' },
  userName: { fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRole: { fontSize: 11, color: '#64748b', marginTop: 2 },
  logoutBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 18, alignSelf: 'flex-start', padding: 2,
    opacity: 0.7,
  },
  main: {
    flex: 1, overflow: 'auto', background: '#0f172a',
  },
}
