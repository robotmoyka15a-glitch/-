import React, { useState, useEffect } from 'react'
import { settingsAPI, systemAPI, authAPI, aiAPI } from '../api'

// Палитра — объявлена в начале файла, доступна всем компонентам
const C = {
  BRAND_GREEN:      '#22c55e',
  BRAND_GREEN_DARK: '#16a34a',
  BRAND_GREEN_DIM:  '#14532d',
  BG_BASE:          '#0a0f0d',
  BG_CARD:          '#111827',
  BG_SIDEBAR:       '#0d1a12',
  BORDER:           '#1a3a25',
  TEXT_PRIMARY:     '#f0fdf4',
  TEXT_SECONDARY:   '#86efac',
  TEXT_MUTED:       '#4b7a5c',
  ACCENT_YELLOW:    '#fbbf24',
  ACCENT_RED:       '#ef4444',
}

const SECTIONS = [
  { key: 'shift',    label: 'Смены' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'vk',       label: 'VK' },
  { key: 'trassir',  label: 'TRASSIR' },
  { key: 'ai',       label: 'AI-интеграции' },
  { key: 'backup',   label: 'Бэкап' },
  { key: 'users',    label: 'Пользователи' },
]

export default function Settings() {
  const [tab, setTab]           = useState('shift')
  const [settings, setSettings] = useState({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState(null)
  const [backups, setBackups]   = useState([])

  useEffect(() => {
    settingsAPI.get().then(r => { setSettings(r.data); setLoading(false) }).catch(() => setLoading(false))
    settingsAPI.backups().then(r => setBackups(r.data)).catch(() => {})
  }, [])

  const setSetting = (k, v) => setSettings(s => ({ ...s, [k]: v }))

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
      <h2 style={s.title}>Настройки</h2>

      <div style={s.layout}>
        {/* Боковое меню разделов */}
        <div style={s.sidebar}>
          {SECTIONS.map(sec => (
            <button key={sec.key}
              style={{
                ...s.secBtn,
                background: tab === sec.key ? C.BRAND_GREEN_DIM : 'transparent',
                color: tab === sec.key ? C.BRAND_GREEN : C.TEXT_MUTED,
                borderLeft: tab === sec.key ? `3px solid ${C.BRAND_GREEN}` : '3px solid transparent',
              }}
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
                <input style={s.input} value={settings.shift_start_time || ''} onChange={e => setSetting('shift_start_time', e.target.value)} placeholder="08:00" />
              </Field>
              <Field label="Время конца смены">
                <input style={s.input} value={settings.shift_end_time || ''} onChange={e => setSetting('shift_end_time', e.target.value)} placeholder="23:00" />
              </Field>
              <Field label="Порог опоздания (мин)">
                <input style={s.input} type="number" value={settings.late_threshold_min || ''} onChange={e => setSetting('late_threshold_min', e.target.value)} />
              </Field>
              <Field label="Режим мойки 1">
                <input style={s.input} value={settings.wash_mode_1 || ''} onChange={e => setSetting('wash_mode_1', e.target.value)} />
              </Field>
              <Field label="Режим мойки 2">
                <input style={s.input} value={settings.wash_mode_2 || ''} onChange={e => setSetting('wash_mode_2', e.target.value)} />
              </Field>
              <Field label="Режим мойки 3">
                <input style={s.input} value={settings.wash_mode_3 || ''} onChange={e => setSetting('wash_mode_3', e.target.value)} />
              </Field>
              <Field label="Режим мойки 4">
                <input style={s.input} value={settings.wash_mode_4 || ''} onChange={e => setSetting('wash_mode_4', e.target.value)} />
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
                <input style={s.input} value={settings.tg_bot_token || ''} onChange={e => setSetting('tg_bot_token', e.target.value)} placeholder="123456:ABC-..." />
              </Field>
              <Field label="Chat ID администратора">
                <input style={s.input} value={settings.tg_admin_chat_id || ''} onChange={e => setSetting('tg_admin_chat_id', e.target.value)} placeholder="-100..." />
              </Field>
              <Field label="Chat ID группы (необязательно)">
                <input style={s.input} value={settings.tg_group_chat_id || ''} onChange={e => setSetting('tg_group_chat_id', e.target.value)} placeholder="-100..." />
              </Field>
              <div style={s.btnRow}>
                <SaveBtn onClick={() => save(['tg_bot_token','tg_admin_chat_id','tg_group_chat_id'])} loading={saving} />
                <button style={s.testBtn} onClick={testNotify}>Тест уведомлений</button>
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
                <input style={s.input} value={settings.vk_token || ''} onChange={e => setSetting('vk_token', e.target.value)} placeholder="vk1.a...." />
              </Field>
              <Field label="ID владельца (user_id для личных сообщений)">
                <input style={s.input} value={settings.vk_owner_id || ''} onChange={e => setSetting('vk_owner_id', e.target.value)} placeholder="123456789" />
              </Field>
              <Field label="ID группы (для постов на стену)">
                <input style={s.input} value={settings.vk_group_id || ''} onChange={e => setSetting('vk_group_id', e.target.value)} placeholder="12345678 (без минуса)" />
              </Field>
              <div style={s.btnRow}>
                <SaveBtn onClick={() => save(['vk_token','vk_owner_id','vk_group_id'])} loading={saving} />
                <button style={s.testBtn} onClick={testNotify}>Тест уведомлений</button>
              </div>
            </Section>
          )}

          {/* ── TRASSIR ── */}
          {tab === 'trassir' && (
            <Section title="TRASSIR видеонаблюдение">
              <div style={s.hint}>
                TRASSIR SDK HTTP API. Порт по умолчанию 8080.<br/>
                Версия: TRASSIR 4.7.9.0+
              </div>
              <Field label="IP-адрес TRASSIR сервера">
                <input style={s.input} value={settings.trassir_host || ''} onChange={e => setSetting('trassir_host', e.target.value)} placeholder="192.168.1.100" />
              </Field>
              <Field label="Порт">
                <input style={s.input} type="number" value={settings.trassir_port || ''} onChange={e => setSetting('trassir_port', e.target.value)} placeholder="8080" />
              </Field>
              <Field label="Логин">
                <input style={s.input} value={settings.trassir_login || ''} onChange={e => setSetting('trassir_login', e.target.value)} placeholder="admin" />
              </Field>
              <Field label="Пароль">
                <input style={s.input} type="password"
                  value={settings.trassir_password === '***' ? '' : (settings.trassir_password || '')}
                  onChange={e => setSetting('trassir_password', e.target.value)}
                  placeholder="••••••" />
              </Field>
              <SaveBtn onClick={() => save(['trassir_host','trassir_port','trassir_login','trassir_password'])} loading={saving} />
            </Section>
          )}

          {/* ── AI-интеграции ── */}
          {tab === 'ai' && (
            <AITab settings={settings} setSetting={setSetting} save={save} saving={saving} setMsg={setMsg} />
          )}

          {/* ── Бэкап ── */}
          {tab === 'backup' && (
            <Section title="Резервное копирование">
              <Field label="Автоматический бэкап">
                <label style={s.checkbox}>
                  <input type="checkbox"
                    checked={settings.backup_enabled === '1'}
                    onChange={e => setSetting('backup_enabled', e.target.checked ? '1' : '0')}
                  />
                  <span>Ежедневный бэкап в 03:00</span>
                </label>
              </Field>
              <div style={s.btnRow}>
                <SaveBtn onClick={() => save(['backup_enabled'])} loading={saving} />
                <button style={s.testBtn} onClick={doBackup} disabled={saving}>
                  Создать бэкап сейчас
                </button>
              </div>
              {backups.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={s.subTitle}>Существующие бэкапы ({backups.length})</div>
                  {backups.map(b => (
                    <div key={b.filename} style={s.backupRow}>
                      <span style={s.backupName}>{b.filename}</span>
                      <span style={s.backupMeta}>{b.created_at?.slice(0, 16)} · {b.size_kb} KB</span>
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

// ── AI Tab ────────────────────────────────────────────────────────────────────
function AITab({ settings, setSetting, save, saving, setMsg }) {
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult]   = useState(null)

  const provider = settings.ai_provider || 'builtin'

  const handleTest = async () => {
    setTestLoading(true); setTestResult(null)
    try {
      const r = await aiAPI.testQuestion()
      setTestResult({ type: 'ok', text: r.data.answer || '✓ AI отвечает' })
    } catch (e) {
      setTestResult({ type: 'err', text: e.response?.data?.detail || 'Ошибка теста AI' })
    } finally { setTestLoading(false) }
  }

  const AI_PROVIDERS = [
    { key: 'builtin',   label: 'Встроенный (llama_cpp)' },
    { key: 'llama_cpp', label: 'llama_cpp (внешний)' },
    { key: 'ollama',    label: 'Ollama' },
    { key: 'clo',       label: 'CLO (API)' },
  ]

  return (
    <Section title="AI-интеграции">
      <div style={s.hint}>
        Выберите провайдера AI и настройте подключение.
        Встроенный режим использует llama_cpp с локальной GGUF-моделью.
      </div>

      <Field label="Включить AI">
        <label style={s.checkbox}>
          <input type="checkbox"
            checked={settings.ai_enabled === '1'}
            onChange={e => setSetting('ai_enabled', e.target.checked ? '1' : '0')}
          />
          <span>AI включён</span>
        </label>
      </Field>

      <Field label="Провайдер AI">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {AI_PROVIDERS.map(p => (
            <label key={p.key} style={s.radioRow}>
              <input
                type="radio"
                name="ai_provider"
                value={p.key}
                checked={provider === p.key}
                onChange={() => setSetting('ai_provider', p.key)}
                style={{ accentColor: C.BRAND_GREEN }}
              />
              <span style={{ color: provider === p.key ? C.BRAND_GREEN : C.TEXT_SECONDARY }}>
                {p.label}
              </span>
            </label>
          ))}
        </div>
      </Field>

      {/* builtin / llama_cpp — путь к файлу модели */}
      {(provider === 'builtin' || provider === 'llama_cpp') && (
        <Field label="Путь к файлу модели (.gguf)" hint="Оставьте пустым для автопоиска в data/models/">
          <input style={s.input}
            value={settings.ai_model_path || ''}
            onChange={e => setSetting('ai_model_path', e.target.value)}
            placeholder="C:\...\data\models\qwen2.5-3b-instruct-q4_k_m.gguf"
          />
          <span style={{ fontSize: 11, color: C.TEXT_MUTED }}>
            Рекомендуем: qwen2.5-3b-instruct-q4_k_m.gguf (~2.5 ГБ)
          </span>
        </Field>
      )}

      {/* ollama — URL и модель */}
      {provider === 'ollama' && (
        <>
          <Field label="URL Ollama сервера">
            <input style={s.input}
              value={settings.ollama_url || ''}
              onChange={e => setSetting('ollama_url', e.target.value)}
              placeholder="http://localhost:11434"
            />
          </Field>
          <Field label="Модель Ollama">
            <input style={s.input}
              value={settings.ollama_model || ''}
              onChange={e => setSetting('ollama_model', e.target.value)}
              placeholder="llama3, mistral, qwen2.5..."
            />
          </Field>
        </>
      )}

      {/* clo — API Key и модель */}
      {provider === 'clo' && (
        <>
          <Field label="CLO API Key">
            <input style={s.input} type="password"
              value={settings.clo_api_key === '***' ? '' : (settings.clo_api_key || '')}
              onChange={e => setSetting('clo_api_key', e.target.value)}
              placeholder="sk-..."
            />
          </Field>
          <Field label="Модель CLO">
            <select style={s.input}
              value={settings.clo_model || 'GigaChat'}
              onChange={e => setSetting('clo_model', e.target.value)}
            >
              <option value="GigaChat">GigaChat</option>
              <option value="GigaChat-Pro">GigaChat-Pro</option>
              <option value="GigaChat-Max">GigaChat-Max</option>
            </select>
          </Field>
        </>
      )}

      <div style={s.btnRow}>
        <SaveBtn
          onClick={() => save(['ai_enabled','ai_provider','ai_model_path','ollama_url','ollama_model','clo_api_key','clo_model'])}
          loading={saving}
        />
        <button style={s.testBtn} onClick={handleTest} disabled={testLoading}>
          {testLoading ? 'Тестируем...' : 'Тест AI'}
        </button>
      </div>

      {testResult && (
        <div style={testResult.type === 'ok' ? s.ok : s.err}>
          {testResult.text}
        </div>
      )}
    </Section>
  )
}

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers]     = useState([])
  const [form, setForm]       = useState({ username: '', full_name: '', password: '', role: 'operator' })
  const [msg, setMsg]         = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    authAPI.users().then(r => setUsers(r.data)).catch(() => {})
  }, [])

  const setFormField = (k, v) => setForm(f => ({ ...f, [k]: v }))

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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={s.uName}>{u.full_name}</span>
              <span style={s.uLogin}>@{u.username}</span>
              <span style={u.role === 'admin' ? s.roleAdmin : s.roleOp}>
                {u.role === 'admin' ? 'admin' : 'operator'}
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
        <input style={s.input} placeholder="Логин" value={form.username} onChange={e => setFormField('username', e.target.value)} />
        <input style={s.input} placeholder="Полное имя" value={form.full_name} onChange={e => setFormField('full_name', e.target.value)} />
        <input style={s.input} placeholder="Пароль" type="password" value={form.password} onChange={e => setFormField('password', e.target.value)} />
        <select style={s.input} value={form.role} onChange={e => setFormField('role', e.target.value)}>
          <option value="operator">Оператор</option>
          <option value="admin">Администратор</option>
        </select>
        <button style={{ ...s.saveBtn, gridColumn: '1 / -1' }} type="submit" disabled={loading}>Создать</button>
      </form>
    </Section>
  )
}

// ── Вспомогательные компоненты ───────────────────────────────────────────────
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
  page:       { padding: '24px 28px', maxWidth: 900, margin: '0 auto' },
  title:      { fontSize: 20, fontWeight: 700, color: '#f0fdf4', marginBottom: 20 },
  loading:    { padding: 40, color: '#4b7a5c' },
  layout:     { display: 'flex', gap: 20 },
  sidebar:    { width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  secBtn:     {
    background: 'transparent', border: 'none',
    padding: '9px 14px', cursor: 'pointer',
    fontSize: 13, fontWeight: 500, textAlign: 'left',
    borderRadius: '0 8px 8px 0',
    transition: 'all 0.15s',
  },
  content:    { flex: 1 },
  secTitle:   { fontSize: 15, fontWeight: 600, color: '#f0fdf4', marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid #1a3a25' },
  secBody:    { display: 'flex', flexDirection: 'column', gap: 16 },
  field:      { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: { fontSize: 13, color: '#86efac', fontWeight: 500 },
  fieldHint:  { fontSize: 11, color: '#4b7a5c' },
  hint:       { background: '#0d1a12', border: '1px solid #1a3a25', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#4b7a5c', lineHeight: 1.7 },
  input:      { background: '#0d1a12', border: '1px solid #1a3a25', borderRadius: 8, padding: '9px 12px', color: '#f0fdf4', fontSize: 13, outline: 'none' },
  checkbox:   { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#86efac', cursor: 'pointer' },
  radioRow:   { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' },
  saveBtn:    { background: '#22c55e', color: '#0a0f0d', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 700, alignSelf: 'flex-start' },
  btnRow:     { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  testBtn:    { background: '#0d1a12', color: '#86efac', border: '1px solid #1a3a25', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontSize: 13 },
  ok:         { background: '#14532d', border: '1px solid #22c55e', borderRadius: 8, padding: '10px 14px', color: '#22c55e', fontSize: 13, marginBottom: 4 },
  err:        { background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 4 },
  subTitle:   { fontSize: 13, fontWeight: 600, color: '#86efac', marginBottom: 10 },
  backupRow:  { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1a3a25', fontSize: 12 },
  backupName: { color: '#86efac', fontFamily: 'monospace' },
  backupMeta: { color: '#4b7a5c' },
  userRow:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #1a3a25' },
  uName:      { fontSize: 13, fontWeight: 600, color: '#f0fdf4' },
  uLogin:     { fontSize: 12, color: '#4b7a5c' },
  roleAdmin:  { background: '#14532d', color: '#22c55e', borderRadius: 6, padding: '2px 8px', fontSize: 11, border: '1px solid #1a3a25' },
  roleOp:     { background: '#111827', color: '#4b7a5c', borderRadius: 6, padding: '2px 8px', fontSize: 11, border: '1px solid #1a3a25' },
  toggleActive: { background: '#14532d', color: '#22c55e', border: '1px solid #1a3a25', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11 },
  toggleOff:    { background: '#111827', color: '#4b7a5c', border: '1px solid #1a3a25', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11 },
  userForm:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
}
