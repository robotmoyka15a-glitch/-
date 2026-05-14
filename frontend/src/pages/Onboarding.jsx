import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { settingsAPI } from '../api'
import RobotLogo from '../components/RobotLogo'

const C = {
  BRAND_GREEN:      '#3b82f6',
  BRAND_GREEN_DARK: '#1e3a5f',
  BRAND_GREEN_DIM:  'rgba(59,130,246,0.1)',
  BG_BASE:          '#0f172a',
  BG_CARD:          '#1e293b',
  BG_SIDEBAR:       '#0f172a',
  BORDER:           '#334155',
  TEXT_PRIMARY:     '#f8fafc',
  TEXT_SECONDARY:   '#94a3b8',
  TEXT_MUTED:       '#64748b',
  ACCENT_YELLOW:    '#fbbf24',
  ACCENT_RED:       '#ef4444',
}

const STEPS = [
  { id: 'welcome',  label: 'Добро пожаловать' },
  { id: 'shift',    label: 'Параметры смены'  },
  { id: 'telegram', label: 'Telegram'         },
  { id: 'vk',       label: 'VK'               },
  { id: 'trassir',  label: 'Камеры TRASSIR'   },
  { id: 'done',     label: 'Готово!'           },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep]       = useState(0)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)

  // Данные по всем шагам
  const [data, setData] = useState({
    shift_start_time:   '08:00',
    shift_end_time:     '23:00',
    late_threshold_min: '15',
    wash_mode_1: 'Экспресс',
    wash_mode_2: 'Стандарт',
    wash_mode_3: 'Комплекс',
    wash_mode_4: 'Премиум',
    tg_bot_token:      '',
    tg_admin_chat_id:  '',
    tg_group_chat_id:  '',
    vk_token:          '',
    vk_owner_id:       '',
    vk_group_id:       '',
    trassir_host:      '192.168.1.100',
    trassir_port:      '8080',
    trassir_login:     'admin',
    trassir_password:  '',
  })

  const set = (k, v) => setData(d => ({ ...d, [k]: v }))

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1))
  const prev = () => setStep(s => Math.max(s - 1, 0))

  const saveAndFinish = async () => {
    setSaving(true); setError(null)
    try {
      await settingsAPI.update(data)
      navigate('/')
    } catch (e) {
      setError('Ошибка сохранения настроек. Проверьте подключение к серверу.')
    } finally { setSaving(false) }
  }

  const skipAndFinish = () => navigate('/')

  const currentStep = STEPS[step]

  return (
    <div style={s.page}>
      {/* Прогресс-бар */}
      <div style={s.progressWrap}>
        {STEPS.map((st, i) => (
          <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              ...s.progressDot,
              background: i <= step ? C.BRAND_GREEN : C.BORDER,
              border: `2px solid ${i <= step ? C.BRAND_GREEN : C.BORDER}`,
            }}>
              {i < step ? <span style={{ fontSize: 10, color: C.BG_BASE }}>✓</span>
               : i === step ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.BG_BASE, display: 'block' }} />
               : null}
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                width: 40, height: 2,
                background: i < step ? C.BRAND_GREEN : C.BORDER,
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Карточка */}
      <div style={s.card}>

        {/* Шаг 0 — Приветствие */}
        {currentStep.id === 'welcome' && (
          <StepWelcome onNext={next} onSkip={skipAndFinish} />
        )}

        {/* Шаг 1 — Параметры смены */}
        {currentStep.id === 'shift' && (
          <StepShift data={data} set={set} />
        )}

        {/* Шаг 2 — Telegram */}
        {currentStep.id === 'telegram' && (
          <StepTelegram data={data} set={set} />
        )}

        {/* Шаг 3 — VK */}
        {currentStep.id === 'vk' && (
          <StepVK data={data} set={set} />
        )}

        {/* Шаг 4 — TRASSIR */}
        {currentStep.id === 'trassir' && (
          <StepTrassir data={data} set={set} />
        )}

        {/* Шаг 5 — Готово */}
        {currentStep.id === 'done' && (
          <StepDone />
        )}

        {error && <div style={s.errBox}>{error}</div>}

        {/* Кнопки навигации */}
        {currentStep.id !== 'welcome' && currentStep.id !== 'done' && (
          <div style={s.navRow}>
            <button style={s.btnBack} onClick={prev}>← Назад</button>
            <button style={s.btnSkipStep} onClick={next}>Пропустить →</button>
            <button style={s.btnNext} onClick={next}>Далее →</button>
          </div>
        )}

        {currentStep.id === 'done' && (
          <div style={s.navRow}>
            <button style={s.btnBack} onClick={prev}>← Назад</button>
            <button style={s.btnFinish} onClick={saveAndFinish} disabled={saving}>
              {saving ? 'Сохраняем...' : '✓ Сохранить и начать работу'}
            </button>
          </div>
        )}
      </div>

      {/* Ссылка пропустить всё */}
      <button style={s.skipAll} onClick={skipAndFinish}>
        Пропустить настройку → перейти в приложение
      </button>
    </div>
  )
}

// ── Шаги ──────────────────────────────────────────────────────────────────────

function StepWelcome({ onNext, onSkip }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0' }}>
      <RobotLogo size={72} showText={true} />
      <h1 style={{ fontSize: 26, fontWeight: 800, color: C.TEXT_PRIMARY, margin: 0, textAlign: 'center' }}>
        Добро пожаловать в WashControl
      </h1>
      <p style={{ color: C.TEXT_MUTED, fontSize: 14, textAlign: 'center', lineHeight: 1.7, maxWidth: 400 }}>
        Система управления автомойкой <strong style={{ color: C.TEXT_SECONDARY }}>Робот-Мойка</strong>.
        <br />
        Давайте настроим самое важное — займёт 2 минуты.
      </p>

      <div style={s.featureList}>
        {[
          ['🚗', 'Журнал машин — режимы, оплата, доп.услуги'],
          ['⏱️', 'Контроль смен и опозданий'],
          ['📊', 'Отчёты и экспорт в Excel'],
          ['✈️', 'Уведомления в Telegram и VK'],
          ['📷', 'Интеграция с TRASSIR'],
          ['🤖', 'AI-помощник без GPU'],
        ].map(([icon, txt]) => (
          <div key={txt} style={s.featureItem}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span style={{ fontSize: 13, color: C.TEXT_SECONDARY }}>{txt}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button style={s.btnFinish} onClick={onNext}>
          Начать настройку →
        </button>
        <button style={s.btnSkipStep} onClick={onSkip}>
          Пропустить, войти сразу
        </button>
      </div>
    </div>
  )
}

function StepShift({ data, set }) {
  return (
    <StepLayout
      icon="⏱️"
      title="Параметры рабочей смены"
      hint="Настройте время работы и названия режимов мойки. Можно изменить позже в Настройках."
    >
      <Row label="Время начала смены">
        <input style={s.input} type="time" value={data.shift_start_time}
          onChange={e => set('shift_start_time', e.target.value)} />
      </Row>
      <Row label="Время конца смены">
        <input style={s.input} type="time" value={data.shift_end_time}
          onChange={e => set('shift_end_time', e.target.value)} />
      </Row>
      <Row label="Порог опоздания (минут)">
        <input style={{ ...s.input, width: 100 }} type="number" min="0" max="120"
          value={data.late_threshold_min}
          onChange={e => set('late_threshold_min', e.target.value)} />
        <span style={{ fontSize: 12, color: C.TEXT_MUTED }}>мин после начала смены</span>
      </Row>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, color: C.TEXT_SECONDARY, marginBottom: 8, fontWeight: 600 }}>
          Названия режимов мойки (4 режима)
        </div>
        {[1,2,3,4].map(n => (
          <Row key={n} label={`Режим ${n}`}>
            <input style={s.input} value={data[`wash_mode_${n}`]}
              onChange={e => set(`wash_mode_${n}`, e.target.value)}
              placeholder={['Экспресс','Стандарт','Комплекс','Премиум'][n-1]} />
          </Row>
        ))}
      </div>
    </StepLayout>
  )
}

function StepTelegram({ data, set }) {
  return (
    <StepLayout
      icon="✈️"
      title="Telegram уведомления"
      hint="Получайте мгновенные уведомления в Telegram: начало смены, новые машины, опоздания, ежедневный отчёт."
    >
      <div style={s.instrBox}>
        <div style={{ fontWeight: 600, color: C.TEXT_SECONDARY, marginBottom: 6 }}>Как получить токен:</div>
        <ol style={{ margin: 0, paddingLeft: 18, color: C.TEXT_MUTED, fontSize: 12, lineHeight: 1.8 }}>
          <li>Напишите <span style={{ color: C.BRAND_GREEN }}>@BotFather</span> в Telegram</li>
          <li>Отправьте команду <code style={s.code}>/newbot</code></li>
          <li>Следуйте инструкции, скопируйте токен</li>
          <li>Ваш Chat ID — напишите <span style={{ color: C.BRAND_GREEN }}>@userinfobot</span></li>
        </ol>
      </div>
      <Row label="Bot Token">
        <input style={s.input} value={data.tg_bot_token} placeholder="123456789:AAF..."
          onChange={e => set('tg_bot_token', e.target.value)} />
      </Row>
      <Row label="Ваш Chat ID (для уведомлений вам)">
        <input style={s.input} value={data.tg_admin_chat_id} placeholder="123456789"
          onChange={e => set('tg_admin_chat_id', e.target.value)} />
      </Row>
      <Row label="Chat ID группы (необязательно)">
        <input style={s.input} value={data.tg_group_chat_id} placeholder="-100..."
          onChange={e => set('tg_group_chat_id', e.target.value)} />
      </Row>
    </StepLayout>
  )
}

function StepVK({ data, set }) {
  return (
    <StepLayout
      icon="🔵"
      title="VK уведомления"
      hint="Публикуйте события на стену группы ВКонтакте и отправляйте личные сообщения владельцу."
    >
      <div style={s.instrBox}>
        <div style={{ fontWeight: 600, color: C.TEXT_SECONDARY, marginBottom: 6 }}>Как получить токен:</div>
        <ol style={{ margin: 0, paddingLeft: 18, color: C.TEXT_MUTED, fontSize: 12, lineHeight: 1.8 }}>
          <li>Перейдите в управление вашим сообществом VK</li>
          <li>Раздел <strong>API → Ключи доступа → Создать</strong></li>
          <li>Разрешите: <code style={s.code}>messages</code>, <code style={s.code}>wall</code></li>
        </ol>
      </div>
      <Row label="VK Access Token">
        <input style={s.input} value={data.vk_token} placeholder="vk1.a...."
          onChange={e => set('vk_token', e.target.value)} />
      </Row>
      <Row label="ID владельца (ваш user_id VK)">
        <input style={s.input} value={data.vk_owner_id} placeholder="123456789"
          onChange={e => set('vk_owner_id', e.target.value)} />
      </Row>
      <Row label="ID группы (без минуса)">
        <input style={s.input} value={data.vk_group_id} placeholder="12345678"
          onChange={e => set('vk_group_id', e.target.value)} />
      </Row>
    </StepLayout>
  )
}

function StepTrassir({ data, set }) {
  return (
    <StepLayout
      icon="📷"
      title="Камеры TRASSIR"
      hint="Подключите систему видеонаблюдения TRASSIR для просмотра каналов и снятия скриншотов прямо в WashControl."
    >
      <div style={s.instrBox}>
        <div style={{ fontSize: 12, color: C.TEXT_MUTED, lineHeight: 1.7 }}>
          Версия: <strong>TRASSIR 4.7.9.0+</strong><br />
          HTTP API по умолчанию на порту <strong>8080</strong>.<br />
          Убедитесь что WashControl и TRASSIR в одной сети.
        </div>
      </div>
      <Row label="IP-адрес сервера TRASSIR">
        <input style={s.input} value={data.trassir_host} placeholder="192.168.1.100"
          onChange={e => set('trassir_host', e.target.value)} />
      </Row>
      <Row label="Порт">
        <input style={{ ...s.input, width: 100 }} value={data.trassir_port} placeholder="8080"
          onChange={e => set('trassir_port', e.target.value)} />
      </Row>
      <Row label="Логин">
        <input style={s.input} value={data.trassir_login} placeholder="admin"
          onChange={e => set('trassir_login', e.target.value)} />
      </Row>
      <Row label="Пароль">
        <input style={s.input} type="password" value={data.trassir_password}
          placeholder="••••••"
          onChange={e => set('trassir_password', e.target.value)} />
      </Row>
    </StepLayout>
  )
}

function StepDone() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '16px 0' }}>
      <div style={{ fontSize: 56 }}>🎉</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: C.BRAND_GREEN, margin: 0 }}>
        Всё готово!
      </h2>
      <p style={{ color: C.TEXT_MUTED, fontSize: 14, textAlign: 'center', lineHeight: 1.7, maxWidth: 380 }}>
        Настройки будут сохранены. Вы можете изменить любой параметр
        позже в разделе <strong style={{ color: C.TEXT_SECONDARY }}>Настройки</strong>.
      </p>
      <div style={s.summaryList}>
        {[
          'Смены и режимы мойки',
          'Telegram уведомления',
          'VK уведомления',
          'Камеры TRASSIR',
        ].map(item => (
          <div key={item} style={s.summaryItem}>
            <span style={{ color: C.BRAND_GREEN, fontSize: 14 }}>✓</span>
            <span style={{ fontSize: 13, color: C.TEXT_SECONDARY }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Вспомогательные компоненты ───────────────────────────────────────────────

function StepLayout({ icon, title, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.TEXT_PRIMARY, margin: 0 }}>{title}</h2>
      </div>
      {hint && <p style={{ fontSize: 13, color: C.TEXT_MUTED, margin: 0, lineHeight: 1.6 }}>{hint}</p>}
      {children}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, color: C.TEXT_SECONDARY, fontWeight: 500 }}>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{children}</div>
    </div>
  )
}

// ── Стили ─────────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight: '100vh', background: C.BG_BASE,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '24px 16px',
    fontFamily: "'Segoe UI', sans-serif",
  },
  progressWrap: {
    display: 'flex', alignItems: 'center', gap: 0,
    marginBottom: 28,
  },
  progressDot: {
    width: 22, height: 22, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s',
  },
  card: {
    background: C.BG_CARD, border: `1px solid ${C.BORDER}`,
    borderRadius: 16, padding: '36px 40px', width: '100%', maxWidth: 520,
    boxShadow: '0 0 40px rgba(34,197,94,0.07)',
    display: 'flex', flexDirection: 'column', gap: 20,
  },
  navRow: {
    display: 'flex', gap: 10, alignItems: 'center',
    marginTop: 8, paddingTop: 16,
    borderTop: `1px solid ${C.BORDER}`,
  },
  btnNext: {
    background: C.BRAND_GREEN, color: C.BG_BASE,
    border: 'none', borderRadius: 8, padding: '10px 22px',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    marginLeft: 'auto',
  },
  btnFinish: {
    background: C.BRAND_GREEN, color: C.BG_BASE,
    border: 'none', borderRadius: 8, padding: '11px 26px',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  btnBack: {
    background: 'transparent', color: C.TEXT_MUTED,
    border: `1px solid ${C.BORDER}`, borderRadius: 8,
    padding: '10px 16px', fontSize: 14, cursor: 'pointer',
  },
  btnSkipStep: {
    background: 'transparent', color: C.TEXT_MUTED,
    border: 'none', fontSize: 13, cursor: 'pointer',
    padding: '10px 4px', textDecoration: 'underline',
  },
  skipAll: {
    background: 'none', border: 'none', color: C.TEXT_MUTED,
    fontSize: 12, cursor: 'pointer', marginTop: 16,
    textDecoration: 'underline',
  },
  input: {
    background: C.BG_SIDEBAR, border: `1px solid ${C.BORDER}`,
    borderRadius: 8, padding: '9px 12px', color: C.TEXT_PRIMARY,
    fontSize: 13, outline: 'none', flex: 1, minWidth: 0,
  },
  instrBox: {
    background: C.BG_SIDEBAR, border: `1px solid ${C.BORDER}`,
    borderRadius: 8, padding: '12px 14px',
  },
  code: {
    background: '#0f172a', border: `1px solid ${C.BORDER}`,
    borderRadius: 4, padding: '1px 5px', fontSize: 11,
    color: C.BRAND_GREEN, fontFamily: 'monospace',
  },
  errBox: {
    background: '#450a0a', border: '1px solid #7f1d1d',
    borderRadius: 8, padding: '10px 14px',
    color: '#fca5a5', fontSize: 13,
  },
  featureList: {
    display: 'flex', flexDirection: 'column', gap: 8,
    width: '100%', maxWidth: 380,
  },
  featureItem: {
    display: 'flex', gap: 10, alignItems: 'center',
    background: C.BG_SIDEBAR, border: `1px solid ${C.BORDER}`,
    borderRadius: 8, padding: '8px 12px',
  },
  summaryList: {
    display: 'flex', flexDirection: 'column', gap: 6,
    width: '100%', maxWidth: 300,
  },
  summaryItem: {
    display: 'flex', gap: 10, alignItems: 'center',
  },
}
