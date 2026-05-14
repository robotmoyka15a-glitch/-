import React, { useState, useEffect } from 'react'
import { camerasAPI } from '../api'

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
  ACCENT_RED:      '#ef4444',
}

export default function Cameras() {
  const [status, setStatus]     = useState(null)
  const [channels, setChannels] = useState([])
  const [shots, setShots]       = useState([])
  const [loading, setLoading]   = useState(false)
  const [msg, setMsg]           = useState(null)
  const [preview, setPreview]   = useState(null)

  useEffect(() => {
    camerasAPI.status().then(r => setStatus(r.data)).catch(() => {})
    camerasAPI.screenshots().then(r => setShots(r.data)).catch(() => {})
  }, [])

  const loadChannels = async () => {
    setLoading(true)
    try {
      const r = await camerasAPI.channels()
      setChannels(r.data)
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || 'Ошибка подключения к TRASSIR' })
    } finally { setLoading(false) }
  }

  const takeShot = async (guid, sendTg = false) => {
    setLoading(true); setMsg(null)
    try {
      const r = await camerasAPI.screenshot(guid, sendTg)
      setMsg({ type: 'success', text: `✓ Снимок сохранён: ${r.data.filename}` })
      camerasAPI.screenshots().then(r => setShots(r.data))
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || 'Ошибка скриншота' })
    } finally { setLoading(false) }
  }

  return (
    <div style={s.page}>
      <h2 style={s.title}>Камеры (TRASSIR)</h2>

      {/* Статус подключения */}
      <div style={status?.connected ? s.connected : s.disconnected}>
        <span style={{
          width: 10, height: 10, borderRadius: '50%',
          background: status?.connected ? C.BRAND_GREEN : C.TEXT_MUTED,
          display: 'inline-block', flexShrink: 0,
        }} />
        {status === null
          ? 'Проверяем подключение...'
          : status.connected
            ? 'TRASSIR подключён'
            : `Нет подключения: ${status.reason || '?'}`
        }
        {!status?.connected && (
          <span style={{ fontSize: 12, marginLeft: 8, color: C.TEXT_MUTED }}>
            Настройте параметры в разделе «Настройки»
          </span>
        )}
      </div>

      {msg && (
        <div style={msg.type === 'success' ? s.ok : s.err}>{msg.text}</div>
      )}

      {/* Кнопка загрузки каналов */}
      <div style={s.actions}>
        <button style={s.btn} onClick={loadChannels} disabled={loading || !status?.connected}>
          {loading ? 'Загружаем...' : 'Загрузить каналы'}
        </button>
      </div>

      {/* Каналы */}
      {channels.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Каналы ({channels.length})</div>
          <div style={s.channelGrid}>
            {channels.map(ch => (
              <div key={ch.guid} style={s.channelCard}>
                <div style={s.channelName}>{ch.name || ch.guid?.slice(0, 12)}</div>
                <div style={s.channelGuid}>{ch.guid?.slice(0, 16)}...</div>
                <div style={s.channelBtns}>
                  <button style={s.shotBtn} onClick={() => takeShot(ch.guid, false)} disabled={loading}>
                    Снимок
                  </button>
                  <button
                    style={{ ...s.shotBtn, background: C.BRAND_GREEN_DIM, color: C.BRAND_GREEN, border: `1px solid ${C.BORDER}` }}
                    onClick={() => takeShot(ch.guid, true)} disabled={loading}
                  >
                    → Telegram
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Последние скриншоты */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Последние снимки ({shots.length})</div>
        {shots.length === 0 ? (
          <div style={s.empty}>Снимков пока нет</div>
        ) : (
          <div style={s.shotGrid}>
            {shots.map(f => (
              <div key={f.filename} style={s.shotCard}
                onClick={() => setPreview(camerasAPI.imgUrl(f.filename))}
              >
                <img
                  src={camerasAPI.imgUrl(f.filename)}
                  alt={f.filename}
                  style={s.thumb}
                  onError={e => { e.target.style.display = 'none' }}
                />
                <div style={s.shotName}>{f.filename.slice(0, 20)}</div>
                <div style={s.shotMeta}>{f.created_at?.slice(11, 16)} · {f.size_kb} KB</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Лайтбокс */}
      {preview && (
        <div style={s.overlay} onClick={() => setPreview(null)}>
          <img src={preview} alt="preview" style={s.preview} onClick={e => e.stopPropagation()} />
          <button style={s.closeBtn} onClick={() => setPreview(null)}>✕</button>
        </div>
      )}
    </div>
  )
}

const s = {
  page:        { padding: '24px 28px', maxWidth: 1000, margin: '0 auto' },
  title:       { fontSize: 20, fontWeight: 700, color: '#f8fafc', marginBottom: 16 },
  connected:   { background: '#0f172a', border: '1px solid #1a3a25', borderRadius: 10, padding: '12px 16px', color: '#3b82f6', fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 },
  disconnected:{ background: '#1e293b', border: '1px solid #1a3a25', borderRadius: 10, padding: '12px 16px', color: '#64748b', fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 },
  ok:          { background: 'rgba(59,130,246,0.1)', border: '1px solid #22c55e', borderRadius: 8, padding: '10px 14px', color: '#3b82f6', fontSize: 13, marginBottom: 16 },
  err:         { background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16 },
  actions:     { marginBottom: 20 },
  btn:         { background: '#3b82f6', color: '#0f172a', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 },
  section:     { marginBottom: 24 },
  sectionTitle:{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 12 },
  empty:       { color: '#64748b', fontSize: 13 },
  channelGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 },
  channelCard: { background: '#1e293b', border: '1px solid #1a3a25', borderRadius: 10, padding: 16 },
  channelName: { fontSize: 14, fontWeight: 600, color: '#f8fafc', marginBottom: 4 },
  channelGuid: { fontSize: 11, color: '#64748b', marginBottom: 12, fontFamily: 'monospace' },
  channelBtns: { display: 'flex', gap: 8 },
  shotBtn:     { background: '#0f172a', color: '#94a3b8', border: '1px solid #1a3a25', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12 },
  shotGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 },
  shotCard:    { background: '#1e293b', border: '1px solid #1a3a25', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s' },
  thumb:       { width: '100%', height: 100, objectFit: 'cover', display: 'block' },
  shotName:    { fontSize: 10, color: '#64748b', padding: '6px 8px 2px', fontFamily: 'monospace' },
  shotMeta:    { fontSize: 10, color: '#334155', padding: '0 8px 8px' },
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  preview:     { maxWidth: '90vw', maxHeight: '85vh', borderRadius: 8, border: '2px solid #1a3a25' },
  closeBtn:    { position: 'fixed', top: 20, right: 20, background: '#1e293b', border: '1px solid #1a3a25', color: '#f8fafc', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: 16 },
}
