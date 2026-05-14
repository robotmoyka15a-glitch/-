import React, { useState, useEffect, useRef } from 'react'
import { carsAPI } from '../api'
import { useStore } from '../store'
import dayjs from 'dayjs'

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

const WASH_MODES    = { 1: 'Экспресс', 2: 'Стандарт', 3: 'Комплекс', 4: 'Премиум' }
const PAY_METHODS   = { cash: 'Наличные', card: 'Карта', qr: 'QR-код' }
const MODE_COLORS   = { 1: '#38bdf8', 2: C.BRAND_GREEN, 3: C.ACCENT_YELLOW, 4: '#a78bfa' }

function Badge({ children, color }) {
  return (
    <span style={{
      background: color + '22', color,
      borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
    }}>
      {children}
    </span>
  )
}

const emptyForm = {
  arrived_at: '',
  wash_mode: 1,
  payment_method: 'cash',
  amount: '',
  extra_service: 0,
  extra_service_name: '',
  extra_payment: 'cash',
  extra_amount: '',
  windows_wiped: 0,
  note: '',
}

export default function Cars() {
  const { activeShift, fetchTodayStats, user } = useStore()
  const [cars, setCars]         = useState([])
  const [form, setForm]         = useState(emptyForm)
  const [loading, setLoading]   = useState(false)
  const [msg, setMsg]           = useState(null)
  const [showForm, setShowForm] = useState(false)

  const pollRef = useRef(null)

  const loadCars = () => {
    carsAPI.today().then(r => setCars(r.data)).catch(() => {})
  }

  useEffect(() => {
    loadCars()
    // Автообновление каждые 15 сек — актуально когда у оператора открыта эта вкладка
    pollRef.current = setInterval(loadCars, 15_000)
    return () => clearInterval(pollRef.current)
  }, [])

  const setField = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!activeShift) { setMsg({ type: 'error', text: 'Нет открытой смены!' }); return }
    // Предупреждение при нулевой сумме (не блокируем)
    if (!form.amount || parseFloat(form.amount) === 0) {
      setMsg({ type: 'warn', text: 'Укажите сумму больше нуля' })
      // продолжаем — это предупреждение, не блокировка
    }
    setLoading(true)
    if (form.amount && parseFloat(form.amount) !== 0) setMsg(null)
    try {
      const payload = {
        ...form,
        arrived_at:   form.arrived_at || dayjs().format('YYYY-MM-DDTHH:mm:ss'),
        amount:       parseFloat(form.amount) || 0,
        extra_amount: parseFloat(form.extra_amount) || 0,
        extra_service: form.extra_service ? 1 : 0,
        windows_wiped: form.windows_wiped ? 1 : 0,
      }
      await carsAPI.add(payload)
      setForm(emptyForm)
      setShowForm(false)
      loadCars()
      fetchTodayStats()
      setMsg({ type: 'success', text: '✓ Машина добавлена' })
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Ошибка добавления' })
    } finally { setLoading(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить запись?')) return
    await carsAPI.delete(id)
    loadCars(); fetchTodayStats()
  }

  const totalRevenue = cars.reduce((acc, c) => acc + (c.amount || 0) + (c.extra_amount || 0), 0)

  return (
    <div style={p.page}>
      {/* Заголовок */}
      <div style={p.header}>
        <h2 style={p.title}>Журнал машин</h2>
        <div style={p.headerRight}>
          <span style={p.counter}>{cars.length} машин · {Math.round(totalRevenue)} ₽</span>
          {activeShift && (
            <button
              style={{
                ...p.addBtn,
                background: showForm ? '#334155' : C.BRAND_GREEN,
                color: showForm ? C.TEXT_SECONDARY : '#0f172a',
              }}
              onClick={() => { setShowForm(!showForm); setMsg(null) }}
            >
              {showForm ? '✕ Отмена' : '+ Добавить машину'}
            </button>
          )}
        </div>
      </div>

      {!activeShift && user?.role === 'operator' && (
        <div style={p.warnBlock}>⚠ Чтобы добавлять машины, сначала откройте смену</div>
      )}

      {msg && (
        <div style={
          msg.type === 'success' ? p.msgOk
          : msg.type === 'warn' ? p.msgWarn
          : p.msgErr
        }>
          {msg.text}
        </div>
      )}

      {/* Форма добавления */}
      {showForm && (
        <form onSubmit={handleSubmit} style={p.form}>
          <div style={p.formTitle}>Новая машина</div>
          <div style={p.grid}>
            {/* Время приезда */}
            <div style={p.field}>
              <label style={p.label}>Время приезда</label>
              <input type="datetime-local" style={p.input}
                value={form.arrived_at}
                onChange={e => setField('arrived_at', e.target.value)}
              />
              <span style={p.hint}>Оставьте пустым — будет текущее время</span>
            </div>

            {/* Режим мойки */}
            <div style={p.field}>
              <label style={p.label}>Режим мойки *</label>
              <div style={p.modeGrid}>
                {Object.entries(WASH_MODES).map(([k, v]) => (
                  <button key={k} type="button"
                    style={{
                      ...p.modeBtn,
                      background: form.wash_mode == k ? MODE_COLORS[k] + '33' : C.BG_SIDEBAR,
                      border: `1px solid ${form.wash_mode == k ? MODE_COLORS[k] : C.BORDER}`,
                      color: form.wash_mode == k ? MODE_COLORS[k] : C.TEXT_MUTED,
                    }}
                    onClick={() => setField('wash_mode', parseInt(k))}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Оплата */}
            <div style={p.field}>
              <label style={p.label}>Способ оплаты *</label>
              <div style={p.payGrid}>
                {Object.entries(PAY_METHODS).map(([k, v]) => (
                  <button key={k} type="button"
                    style={{
                      ...p.payBtn,
                      background: form.payment_method === k ? C.BRAND_GREEN_DIM : C.BG_SIDEBAR,
                      border: `1px solid ${form.payment_method === k ? C.BRAND_GREEN : C.BORDER}`,
                      color: form.payment_method === k ? C.BRAND_GREEN : C.TEXT_MUTED,
                    }}
                    onClick={() => setField('payment_method', k)}
                  >
                    {k === 'cash' ? '💵' : k === 'card' ? '💳' : '📱'} {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Сумма */}
            <div style={p.field}>
              <label style={p.label}>Сумма оплаты (₽) *</label>
              <input style={p.input} type="number" min="0" step="10"
                value={form.amount}
                onChange={e => setField('amount', e.target.value)}
                placeholder="500"
              />
              {(!form.amount || parseFloat(form.amount) === 0) && (
                <span style={{ fontSize: 11, color: C.ACCENT_YELLOW }}>
                  ⚠ Укажите сумму больше нуля
                </span>
              )}
            </div>

            {/* Доп. услуга */}
            <div style={p.field}>
              <label style={p.label}>Доп. услуга</label>
              <label style={p.checkbox}>
                <input type="checkbox"
                  checked={!!form.extra_service}
                  onChange={e => setField('extra_service', e.target.checked ? 1 : 0)}
                />
                <span>Есть доп. услуга</span>
              </label>
              {!!form.extra_service && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  <input style={p.input} placeholder="Название услуги"
                    value={form.extra_service_name}
                    onChange={e => setField('extra_service_name', e.target.value)}
                  />
                  <div style={p.payGrid}>
                    {Object.entries(PAY_METHODS).map(([k, v]) => (
                      <button key={k} type="button"
                        style={{
                          ...p.payBtn,
                          background: form.extra_payment === k ? C.BRAND_GREEN_DIM : C.BG_SIDEBAR,
                          border: `1px solid ${form.extra_payment === k ? C.BRAND_GREEN : C.BORDER}`,
                          color: form.extra_payment === k ? C.BRAND_GREEN : C.TEXT_MUTED,
                        }}
                        onClick={() => setField('extra_payment', k)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <input style={p.input} type="number" min="0" placeholder="Сумма доп."
                    value={form.extra_amount}
                    onChange={e => setField('extra_amount', e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Стёкла */}
            <div style={p.field}>
              <label style={p.label}>Стёкла</label>
              <label style={p.checkbox}>
                <input type="checkbox"
                  checked={!!form.windows_wiped}
                  onChange={e => setField('windows_wiped', e.target.checked ? 1 : 0)}
                />
                <span>Протёрли стёкла</span>
              </label>
            </div>

            {/* Примечание */}
            <div style={{ ...p.field, gridColumn: '1 / -1' }}>
              <label style={p.label}>Примечание</label>
              <input style={p.input} placeholder="Необязательно"
                value={form.note}
                onChange={e => setField('note', e.target.value)}
              />
            </div>
          </div>

          <button style={p.submitBtn} type="submit" disabled={loading}>
            {loading ? 'Сохраняем...' : '✓ Сохранить машину'}
          </button>
        </form>
      )}

      {/* Таблица машин */}
      <div style={p.tableWrap}>
        {cars.length === 0 ? (
          <div style={p.empty}>Машин за сегодня ещё нет</div>
        ) : (
          <table style={p.table}>
            <thead>
              <tr>
                {['#','Время','Режим','Оплата','Сумма','Доп. услуга','Стёкла','Оператор', user?.role === 'admin' ? '⚙' : ''].map((h, i) => (
                  <th key={i} style={p.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cars.map((car, i) => (
                <tr key={car.id} style={{ background: i % 2 === 0 ? C.BG_BASE : C.BG_CARD }}>
                  <td style={{ ...p.td, color: C.TEXT_MUTED }}>{car.car_number}</td>
                  <td style={p.td}>{car.arrived_at?.slice(11, 16)}</td>
                  <td style={p.td}>
                    <Badge color={MODE_COLORS[car.wash_mode] || '#94a3b8'}>
                      {car.wash_mode_name}
                    </Badge>
                  </td>
                  <td style={p.td}>
                    <span style={{ fontSize: 13 }}>
                      {car.payment_method === 'cash' ? '💵' : car.payment_method === 'card' ? '💳' : '📱'}{' '}
                      {car.payment_method_name}
                    </span>
                  </td>
                  <td style={{ ...p.td, fontWeight: 600, color: C.BRAND_GREEN }}>
                    {car.amount} ₽
                    {car.extra_amount > 0 && (
                      <span style={{ color: C.ACCENT_YELLOW, fontSize: 11 }}> +{car.extra_amount}</span>
                    )}
                  </td>
                  <td style={p.td}>
                    {car.extra_service
                      ? <span style={{ color: C.ACCENT_YELLOW }}>⭐ {car.extra_service_name || 'Да'}</span>
                      : <span style={{ color: C.BORDER }}>—</span>
                    }
                  </td>
                  <td style={{ ...p.td, textAlign: 'center' }}>
                    {car.windows_wiped ? <span style={{ color: C.BRAND_GREEN }}>✓</span> : <span style={{ color: C.BORDER }}>—</span>}
                  </td>
                  <td style={{ ...p.td, fontSize: 12, color: C.TEXT_MUTED }}>{car.full_name}</td>
                  {user?.role === 'admin' && (
                    <td style={p.td}>
                      <button style={p.delBtn} onClick={() => handleDelete(car.id)}>✕</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const p = {
  page:       { padding: '24px 28px', maxWidth: 1100, margin: '0 auto' },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerRight:{ display: 'flex', gap: 12, alignItems: 'center' },
  title:      { fontSize: 20, fontWeight: 700, color: '#f8fafc', margin: 0 },
  counter:    { fontSize: 13, color: '#64748b' },
  addBtn:     { border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'background 0.2s' },
  warnBlock:  { background: '#451a03', border: '1px solid #78350f', borderRadius: 8, padding: '10px 14px', color: '#fbbf24', fontSize: 13, marginBottom: 16 },
  msgOk:      { background: 'rgba(59,130,246,0.1)', border: '1px solid #22c55e', borderRadius: 8, padding: '10px 14px', color: '#3b82f6', fontSize: 13, marginBottom: 16 },
  msgWarn:    { background: '#451a03', border: '1px solid #fbbf24', borderRadius: 8, padding: '10px 14px', color: '#fbbf24', fontSize: 13, marginBottom: 16 },
  msgErr:     { background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16 },
  form:       { background: '#1e293b', border: '1px solid #1a3a25', borderRadius: 12, padding: 24, marginBottom: 24 },
  formTitle:  { fontSize: 15, fontWeight: 600, color: '#94a3b8', marginBottom: 20 },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 },
  field:      { display: 'flex', flexDirection: 'column', gap: 6 },
  label:      { fontSize: 12, color: '#94a3b8', fontWeight: 500 },
  hint:       { fontSize: 11, color: '#64748b' },
  input:      { background: '#0f172a', border: '1px solid #1a3a25', borderRadius: 8, padding: '9px 12px', color: '#f8fafc', fontSize: 13, outline: 'none' },
  modeGrid:   { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 },
  modeBtn:    { padding: '8px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s' },
  payGrid:    { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 },
  payBtn:     { padding: '8px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s' },
  checkbox:   { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#94a3b8', cursor: 'pointer' },
  submitBtn:  { background: '#3b82f6', color: '#0f172a', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8, width: '100%' },
  tableWrap:  { overflowX: 'auto' },
  empty:      { color: '#64748b', fontSize: 13, padding: '20px 0' },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:         { padding: '10px 12px', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #1a3a25', fontWeight: 500, whiteSpace: 'nowrap' },
  td:         { padding: '8px 12px', color: '#94a3b8', borderBottom: '1px solid #1a3a25', whiteSpace: 'nowrap' },
  delBtn:     { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14, padding: 2 },
}
