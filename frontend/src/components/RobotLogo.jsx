import React from 'react'

export default function RobotLogo({ size = 32, showText = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        {/* Щит */}
        <path d="M32 4 L56 16 L56 36 Q56 52 32 60 Q8 52 8 36 L8 16 Z"
              fill="#111827" stroke="#22c55e" strokeWidth="2"/>
        {/* Машина силуэт */}
        <rect x="16" y="34" width="32" height="10" rx="3" fill="#22c55e"/>
        <rect x="20" y="26" width="24" height="12" rx="3" fill="#22c55e"/>
        <circle cx="21" cy="44" r="4" fill="#0a0f0d" stroke="#22c55e" strokeWidth="1.5"/>
        <circle cx="43" cy="44" r="4" fill="#0a0f0d" stroke="#22c55e" strokeWidth="1.5"/>
        {/* Искры */}
        <path d="M26 14 L28 20 L32 18 L30 24 L34 22" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="38" cy="15" r="1.5" fill="#22c55e"/>
        <circle cx="42" cy="20" r="1" fill="#22c55e"/>
      </svg>
      {showText && (
        <span style={{
          fontWeight: 800,
          fontSize: size * 0.45,
          color: '#22c55e',
          letterSpacing: 1,
          textTransform: 'uppercase',
          fontFamily: "'Segoe UI', sans-serif",
        }}>
          Робот-Мойка
        </span>
      )}
    </div>
  )
}
