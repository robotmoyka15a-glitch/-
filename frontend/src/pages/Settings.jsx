import React, { useState, useEffect } from 'react'
import { settingsAPI, systemAPI } from '../api'

const SECTIONS = [
  { key: 'shift',    label: '⏱️ Смены' },
  { key: 'telegram', label: '✈️ Telegram' },
  { key: 'vk',       label: '🔵 VK' },
  { key: 'trassir',  label: '📷 TRASSIR' },
  { key: 'ai',       label: '🤖 AI' },
  { key: 'backup',   label: '💾 Бэкап' },
  { key: 'users',    label: '👥 Пользователи' },
]

export default function Settings() {
  const [tab, setTab]         = useState('shift')
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState(null)
  const [backups, setBackups] = useState([])

  useEffect(() => {
    settingsAPI.get().then(r => { setSettings(r.data); setLoading(false) }).catch(() => setLoading(false))
    settingsAPI.backups().then(r => setBackups(r.data)).catch(() => {})
  }, [])

  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }))

  const save = async (keys) => {
    setSaving(true); setMsg(null)
    const data = {}
    keys.forEach(k => { if (settings[k] !== '***') data[k] = settings[k] || '' })
    try {
      await settingsAPI.update(data)
      setMsg({ type: 'ok', text: '✓ Настройки сохранены' })
    } catch { setMsg({ type: 'err', text: 'Ошибка сохранения' }) }
    finally { setSaving(false) }
  }

  const doBackup = async () => {
    setSaving(true)
    try {
      const r = await settingsAPI.backup()
      setMsg({ type: 'ok', text: `✓ Бэкап: ${r.data.backup_file}` })
      settingsAPI.backups().then(r => setBackups(r.data))
    } catch { setMsg({ type: 'err', text: 'Ошибка бэкапа' }) }
    finally { setSaving(false) }
  }

  const testNotify = async () => {
    try {
      await systemAPI.testNotify()
      setMsg({ type: 'ok', text: '✓ Тестовые уведомления отправлены' })
    } catch { setMsg({ type: 'err', text: 'Ошибка отправки' }) }
  }

  if (loading) return <div style={s.loading}>Загрузка настроек...</div>

  return (
    <div style={s.page}>
      <h2 style={s.title}>⚙️ Настройки</h2>

      <div style={s.layout}>
        {/* Боковое меню разделов */}
        <div style={s.sidebar}>
          {SECTIONS.map(sec => (
            <button key={sec.key}
              style={{ ...s.secBtn, ...(tab === sec.key ? s.secActive : {}) }}
              onClick={() => { setTab(sec.key); setMsg(null) }}
            >
              {sec.label}
            </button>
          ))}
        </div>

        {/* Содержимое */}
        <div style={s.content}>
          {msg && <div style={msg.type === 'ok' ? s.ok : s.err}>{msg.text}</div>}

          {/* ── Смены ── */}
          {tab === 'shift' && (
            <Section title="Параметры смены">
              <Field label="Время начала смены" hint="Формат ЧЧ:ММ">
                <input style={s.input} value={settings.shift_start_time || ''} onChange={e => set('shift_start_time', e.target.value)} placeholder="08:00" />
              </Field>
              <Field label="Время конца смены">
                <input style={s.input} value={settings.shift_end_time || ''} onChange={e => set('shift_end_time', e.target.value)} placeholder="23:00" />
              </Field>
              <Field label="Порог опоздания (мин)">
                <input style={s.input} type="number" value={settings.late_threshold_min || ''} onChange={e => set('late_threshold_min', e.target.value)} />
              </Field>
              <Field label="Режим мойки 1">
                <input style={s.input} value={settings.wash_mode_1 || ''} onChange={e => set('wash_mode_1', e.target.value)} />
              </Field>
              <Field label="Режим мойки 2">
                <input style={s.input} value={settings.wash_mode_2 || ''} onChange={e => set('wash_mode_2', e.target.value)} />
              </Field>
              <Field label="Режим мойки 3">
                <input style={s.input} value={settings.wash_mode_3 || ''} onChange={e => set('wash_mode_3', e.target.value)} />
              </Field>
              <Field label="Режим мойки 4">
                <input style={s.input} value={settings.wash_mode_4 || ''} onChange={e => set('wash_mode_4', e.target.value)} />
              </Field>
              <SaveBtn onClick={() => save(['shift_start_time','shift_end_time','late_threshold_min','wash_mode_1','wash_mode_2','wash_mode_3','wash_mode_4'])} loading={saving} />
            </Section>
          )}

          {/* ── Telegram ── */}
          {tab === 'telegram' && (
            <Section title="Telegram бот">
              <div style={s.hint}>
                1. Создайте бота через @BotFather<br/>
                2. Получите токен и Chat ID администратора<br/>
                3. Сохраните — бот перезапустится автоматически
              </div>
              <Field label="Bot Token">
                <input style={s.input} value={settings.tg_bot_token || ''} onChange={e => set('tg_bot_token', e.target.value)} placeholder="123456:ABC-..." />
              </Field>
              <Field label="Chat ID администратора">
                <input style={s.input} value={settings.tg_admin_chat_id || ''} onChange={e => set('tg_admin_chat_id', e.target.value)} placeholder="-100..." />
              </Field>
              <Field label="Chat ID группы (необязательно)">
                <input style={s.input} value={settings.tg_group_chat_id || ''} onChange={e => set('tg_group_chat_id', e.target.value)} placeholder="-100..." />
              </Field>
              <div style={s.btnRow}>
                <SaveBtn onClick={() => save(['tg_bot_token','tg_admin_chat_id','tg_group_chat_id'])} loading={saving} />
                <button style={s.testBtn} onClick={testNotify}>📤 Тест</button>
              </div>
            </Section>
          )}

          {/* ── VK ── */}
          {tab === 'vk' && (
            <Section title="VK уведомления">
              <div style={s.hint}>
                Получите токен через VK API (сообщества → Управление → API).
                Для личных сообщений нужен токен с правом messages.
              </div>
              <Field label="VK Access Token">
                <input style={s.input} value={settings.vk_token || ''} onChange={e => set('vk_token', e.target.value)} placeholder="vk1.a...." />
              </Field>
              <Field label="ID владельца (user_id для личных сообщений)">
                <input style={s.input} value={settings.vk_owner_id || ''} onChange={e => set('vk_owner_id', e.target.value)} placeholder="123456789" />
              </Field>
              <Field label="ID группы (для постов на стену)">
                <input style={s.input} value={settings.vk_group_id || ''} onChange={e => set('vk_group_id', e.target.value)} placeholder="12345678 (без минуса)" />
              </Field>
              <div style={s.btnRow}>
                <SaveBtn onClick={() => save(['vk_token','vk_owner_id','vk_group_id'])} loading={saving} />
                <button style={s.testBtn} onClick={testNotify}>📤 Тест</button>
              </div>
            </Section>
          )}

          {/* ── TRASSIR ── */}
          {tab === 'trassir' && (
            <Section title="TRASSIR видеонаблюдение">
              <div style={s.hint}>
                TRASSIR SDK HTTP API. Порт по умолчанию 8080.
                Версия: TRASSIR 4.7.9.0+
              </div>
              <Field label="IP-адрес TRASSIR сервера">
                <input style={s.input} value={settings.trassir_host || ''} onChange={e => set('trassir_host', e.target.value)} placeholder="192.168.1.100" />
              </Field>
              <Field label="Порт">
                <input style={s.input} type="number" value={settings.trassir_port || ''} onChange={e => set('trassir_port', e.target.value)} placeholder="8080" />
              </Field>
              <Field label="Логин">
                <input style={s.input} value={settings.trassir_login || ''} onChange={e => set('trassir_login', e.target.value)} placeholder="admin" />
              </Field>
              <Field label="Пароль">
                <input style={{ ...s.input }} type="password" value={settings.trassir_password === '***' ? '' : (settings.trassir_password || '')} onChange={e => set('trassir_password', e.target.value)} placeholder="••••••" />
              </Field>
              <SaveBtn onClick={() => save(['trassir_host','trassir_port','trassir_login','trassir_password'])} loading={saving} />
            </Section>
          )}

          {/* ── AI ── */}
          {tab === 'ai' && (
            <Section title="AI-помощник (локальный)">
              <div style={s.hint}>
                Используется модель Qwen2.5-3B-Instruct (GGUF, CPU-only, ~2.5 ГБ RAM).<br/>
                Скачайте файл <b>qwen2.5-3b-instruct-q4_k_m.gguf</b> и поместите в папку <b>data/models/</b><br/>
                Ссылка: huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF
              </div>
              <Field label="Включить AI">
                <label style={s.checkbox}>
                  <input type="checkbox"
                    checked={settings.ai_enabled === '1'}
                    onChange={e => set('ai_enabled', e.target.checked ? '1' : '0')}
                  />
                  <span>AI включён</span>
                </label>
              </Field>
              <Field label="Путь к модели (оставьте пустым для автопоиска)">
                <input style={s.input} value={settings.ai_model_path || ''} onChange={e => set('ai_model_path', e.target.value)} placeholder="C:\...\data\models\qwen2.5-3b-instruct-q4_k_m.gguf" />
              </Field>
              <SaveBtn onClick={() => save(['ai_enabled','ai_model_path'])} loading={saving} />
            </Section>
          )}

          {/* ── Бэкап ── */}
          {tab === 'backup' && (
            <Section title="Резервное копирование">
              <Field label="Автоматический бэкап">
                <label style={s.checkbox}>
                  <input type="checkbox"
                    checked={settings.backup_enabled === '1'}
                    onChange={e => set('backup_enabled', e.target.checked ? '1' : '0')}
                  />
                  <span>Ежедневный бэкап в 03:00</span>
                </label>
              </Field>
              <div style={s.btnRow}>
                <SaveBtn onClick={() => save(['backup_enabled'])} loading={saving} />
                <button style={s.testBtn} onClick={doBackup} disabled={saving}>
                  💾 Создать бэкап сейчас
                </button>
              </div>
              {backups.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={s.subTitle}>Существующие бэкапы ({backups.length})</div>
                  {backups.map(b => (
                    <div key={b.filename} style={s.backupRow}>
                      <span style={s.backupName}>{b.filename}</span>
                      <span style={s.backupMeta}>{b.created_at?.slice(0,16)} · {b.size_kb} KB</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* ── Пользователи ── */}
          {tab === 'users' && <UsersTab />}
        </div>
      </div>
    </div>
  )
}

function UsersTab() {
  const { authAPI } = require('../api')
  const [users, setUsers]   = useState([])
  const [form, setForm]     = useState({ username: '', full_name: '', password: '', role: 'operator' })
  const [msg, setMsg]       = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    authAPI.users().then(r => setUsers(r.data)).catch(() => {})
  }, [])

  const createUser = async (e) => {
    e.preventDefault()
    setLoading(true); setMsg(null)
    try {
      await authAPI.createUser(form)
      authAPI.users().then(r => setUsers(r.data))
      setForm({ username: '', full_name: '', password: '', role: 'operator' })
      setMsg({ type: 'ok', text: 'Пользователь создан' })
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.detail || 'Ошибка' })
    } finally { setLoading(false) }
  }

  const toggle = async (id) => {
    await authAPI.toggleUser(id)
    authAPI.users().then(r => setUsers(r.data))
  }

  return (
    <Section title="Пользователи">
      {msg && <div style={msg.type === 'ok' ? s.ok : s.err}>{msg.text}</div>}
      {/* Список */}
      <div style={{ marginBottom: 20 }}>
        {users.map(u => (
          <div key={u.id} style={s.userRow}>
            <div>
              <span style={s.uName}>{u.full_name}</span>
              <span style={s.uLogin}>@{u.username}</span>
              <span style={u.role === 'admin' ? s.roleAdmin : s.roleOp}>
                {u.role === 'admin' ? '👑 admin' : '👤 operator'}
              </span>
            </div>
            <button
              style={u.is_active ? s.toggleActive : s.toggleOff}
              onClick={() => toggle(u.id)}
            >
              {u.is_active ? 'Активен' : 'Отключён'}
            </button>
          </div>
        ))}
      </div>

      {/* Форма добавления */}
      <div style={s.subTitle}>Добавить пользователя</div>
      <form onSubmit={createUser} style={s.userForm}>
        <input style={s.input} placeholder="Логин" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
        <input style={s.input} placeholder="Полное имя" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
        <input style={s.input} placeholder="Пароль" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        <select style={s.input} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
          <option value="operator">Оператор</option>
          <option value="admin">Администратор</option>
        </select>
        <button style={s.saveBtn} type="submit" disabled={loading}>Создать</button>
      </form>
    </Section>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <div style={s.secTitle}>{title}</div>
      <div style={s.secBody}>{children}</div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={s.field}>
      <label style={s.fieldLabel}>{label}</label>
      {children}
      {hint && <span style={s.fieldHint}>{hint}</span>}
    </div>
  )
}

function SaveBtn({ onClick, loading }) {
  return (
    <button style={s.saveBtn} onClick={onClick} disabled={loading}>
      {loading ? 'Сохраняем...' : '✓ Сохранить'}
    </button>
  )
}

const s = {
  page:    { padding: '24px 28px', maxWidth: 900, margin: '0 auto' },
  title:   { fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 },
  loading: { padding: 40, color: '#64748b' },
  layout:  { display: 'flex', gap: 20 },
  sidebar: { width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 },
  secBtn:  { background: 'transparent', border: 'none', borderRadius: 8, padding: '9px 14px', cursor: 'pointer', color: '#64748b', fontSize: 13, fontWeight: 500, textAlign: 'left' },
  secActive:{ background: '#1e3a5f', color: '#38bdf8' },
  content: { flex: 1 },
  secTitle:{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid #1e3a5f' },
  secBody: { display: 'flex', flexDirection: 'column', gap: 16 },
  field:   { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel:{ fontSize: 13, color: '#94a3b8', fontWeight: 500 },
  fieldHint: { fontSize: 11, color: '#475569' },
  hint:    { background: '#1e293b', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#64748b', lineHeight: 1.7 },
  input:   { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none' },
  checkbox:{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#cbd5e1', cursor: 'pointer' },
  saveBtn: { background: '#0369a1', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600, alignSelf: 'flex-start' },
  btnRow:  { display: 'flex', gap: 10, flexWrap: 'wrap' },
  testBtn: { background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontSize: 13 },
  ok:      { background: '#052e16', border: '1px solid #166534', borderRadius: 8, padding: '10px 14px', color: '#4ade80', fontSize: 13, marginBottom: 16 },
  err:     { background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16 },
  subTitle:{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 10 },
  backupRow:{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1e293b', fontSize: 12 },
  backupName:{ color: '#94a3b8', fontFamily: 'monospace' },
  backupMeta:{ color: '#475569' },
  userRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #1e293b' },
  uName:   { fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginRight: 8 },
  uLogin:  { fontSize: 12, color: '#64748b', marginRight: 8 },
  roleAdmin:{ background: '#1e3a5f', color: '#38bdf8', borderRadius: 6, padding: '2px 8px', fontSize: 11 },
  roleOp:  { background: '#1e293b', color: '#64748b', borderRadius: 6, padding: '2px 8px', fontSize: 11 },
  toggleActive:{ background: '#052e16', color: '#4ade80', border: '1px solid #166534', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11 },
  toggleOff:  { background: '#1e293b', color: '#475569', border: '1px solid #334155', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11 },
  userForm:{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
}
