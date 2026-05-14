import React from 'react'

export default function RobotLogo({ size = 40, showText = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {/* Water drop logo with modern design */}
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        {/* Main water drop */}
        <path 
          d="M32 4 C32 4 12 28 12 42 C12 53.046 20.954 62 32 62 C43.046 62 52 53.046 52 42 C52 28 32 4 32 4Z" 
          fill="#3b82f6" 
          stroke="#60a5fa" 
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Inner highlight */}
        <ellipse cx="26" cy="38" rx="6" ry="8" fill="rgba(255,255,255,0.3)"/>
        {/* Small bubble */}
        <circle cx="38" cy="48" r="3" fill="rgba(255,255,255,0.4)"/>
        {/* Sparkle */}
        <circle cx="22" cy="32" r="2" fill="rgba(255,255,255,0.6)"/>
      </svg>
      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{
            fontWeight: 700,
            fontSize: Math.max(18, size * 0.45),
            color: '#f8fafc',
            letterSpacing: 0.5,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            Wash<span style={{ color: '#3b82f6' }}>Control</span>
          </span>
          {size >= 40 && (
            <span style={{
              fontSize: 9,
              color: '#94a3b8',
              letterSpacing: 1,
              textTransform: 'uppercase',
              fontFamily: "'Inter', system-ui, sans-serif",
            }}>
              Система управления автомойкой
            </span>
          )}
        </div>
      )}
    </div>
  )
}
