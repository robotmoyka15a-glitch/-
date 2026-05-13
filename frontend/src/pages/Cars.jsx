import React, { useState, useEffect } from 'react'
import { carsAPI, settingsAPI } from '../api'
import { useStore } from '../store'
import dayjs from 'dayjs'

const WASH_MODES    = { 1: 'Экспресс', 2: 'Стандарт', 3: 'Комплекс', 4: 'Премиум' }
const PAY_METHODS   = { cash: 'Наличные', card: 'Карта', qr: 'QR-код' }
const MODE_COLORS   = { 1: '#0ea5e9', 2: '#10b981', 3: '#f59e0b', 4: '#8b5cf6' }

function Badge({ children, color }) {
  return (
    <span style={{ background: color + '22', color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
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
  const [cars, setCars]       = useState([])
  const [form, setForm]       = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState(null)
  const [showForm, setShowForm] = useState(false)

  const loadCars = () => {
    carsAPI.today().then(r => setCars(r.data)).catch(() => {})
  }

  useEffect(() => { loadCars() }, [])

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!activeShift) { setMsg({ type: 'error', text: 'Нет открытой смены!' }); return }
    if (!form.amount) { setMsg({ type: 'error', text: 'Укажите сумму оплаты' }); return }
    setLoading(true); setMsg(null)
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

  const totalRevenue = cars.reduce((s, c) => s + (c.amount || 0) + (c.extra_amount || 0), 0)

  return (
    <div style={p.page}>
      {/* Заголовок */}
      <div style={p.header}>
        <h2 style={p.title}>🚗 Журнал машин</h2>
        <div style={p.headerRight}>
          <span style={p.counter}>{cars.length} машин · {Math.round(totalRevenue)} ₽</span>
          {activeShift && (
            <button style={p.addBtn} onClick={() => { setShowForm(!showForm); setMsg(null) }}>
              {showForm ? '✕ Отмена' : '+ Добавить машину'}
            </button>
          )}
        </div>
      </div>

      {!activeShift && user?.role === 'operator' && (
        <div style={p.warn}>⚠️ Чтобы добавлять машины, сначала откройте смену</div>
      )}

      {msg && (
        <div style={msg.type === 'success' ? p.msgOk : p.msgErr}>{msg.text}</div>
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
                onChange={e => set('arrived_at', e.target.value)}
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
                      background: form.wash_mode == k ? MODE_COLORS[k] + '33' : '#1e293b',
                      border: `1px solid ${form.wash_mode == k ? MODE_COLORS[k] : '#334155'}`,
                      color: form.wash_mode == k ? MODE_COLORS[k] : '#94a3b8',
                    }}
                    onClick={() => set('wash_mode', parseInt(k))}
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
                      background: form.payment_method === k ? '#0369a1' : '#1e293b',
                      border: `1px solid ${form.payment_method === k ? '#38bdf8' : '#334155'}`,
                      color: form.payment_method === k ? '#38bdf8' : '#94a3b8',
                    }}
                    onClick={() => set('payment_method', k)}
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
                onChange={e => set('amount', e.target.value)}
                placeholder="500"
              />
            </div>

            {/* Доп. услуга */}
            <div style={p.field}>
              <label style={p.label}>Доп. услуга</label>
              <label style={p.checkbox}>
                <input type="checkbox"
                  checked={!!form.extra_service}
                  onChange={e => set('extra_service', e.target.checked ? 1 : 0)}
                />
                <span>Есть доп. услуга</span>
              </label>
              {!!form.extra_service && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  <input style={p.input} placeholder="Название услуги"
                    value={form.extra_service_name}
                    onChange={e => set('extra_service_name', e.target.value)}
                  />
                  <div style={p.payGrid}>
                    {Object.entries(PAY_METHODS).map(([k, v]) => (
                      <button key={k} type="button"
                        style={{
                          ...p.payBtn,
                          background: form.extra_payment === k ? '#0369a1' : '#1e293b',
                          border: `1px solid ${form.extra_payment === k ? '#38bdf8' : '#334155'}`,
                          color: form.extra_payment === k ? '#38bdf8' : '#94a3b8',
                        }}
                        onClick={() => set('extra_payment', k)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <input style={p.input} type="number" min="0" placeholder="Сумма доп."
                    value={form.extra_amount}
                    onChange={e => set('extra_amount', e.target.value)}
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
                  onChange={e => set('windows_wiped', e.target.checked ? 1 : 0)}
                />
                <span>Протёрли стёкла</span>
              </label>
            </div>

            {/* Примечание */}
            <div style={{ ...p.field, gridColumn: '1 / -1' }}>
              <label style={p.label}>Примечание</label>
              <input style={p.input} placeholder="Необязательно"
                value={form.note}
                onChange={e => set('note', e.target.value)}
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
                {['#','Время','Режим','Оплата','Сумма','Доп. услуга','Стёкла','Оператор',user?.role==='admin' ? '⚙' : ''].map((h, i) => (
                  <th key={i} style={p.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cars.map((car, i) => (
                <tr key={car.id} style={{ background: i % 2 === 0 ? '#0d1b2e' : '#0f1f35' }}>
                  <td style={{ ...p.td, color: '#64748b' }}>{car.car_number}</td>
                  <td style={p.td}>{car.arrived_at?.slice(11,16)}</td>
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
                  <td style={{ ...p.td, fontWeight: 600, color: '#4ade80' }}>
                    {car.amount} ₽
                    {car.extra_amount > 0 && (
                      <span style={{ color: '#f59e0b', fontSize: 11 }}> +{car.extra_amount}</span>
                    )}
                  </td>
                  <td style={p.td}>
                    {car.extra_service
                      ? <span style={{ color: '#f59e0b' }}>⭐ {car.extra_service_name || 'Да'}</span>
                      : <span style={{ color: '#334155' }}>—</span>
                    }
                  </td>
                  <td style={{ ...p.td, textAlign: 'center' }}>
                    {car.windows_wiped ? '✅' : '—'}
                  </td>
                  <td style={{ ...p.td, fontSize: 12, color: '#64748b' }}>{car.full_name}</td>
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
  page:      { padding: '24px 28px', maxWidth: 1100, margin: '0 auto' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerRight:{ display: 'flex', gap: 12, alignItems: 'center' },
  title:     { fontSize: 20, fontWeight: 700, color: '#e2e8f0' },
  counter:   { fontSize: 13, color: '#64748b' },
  addBtn:    { background: '#0369a1', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  warn:      { background: '#451a03', border: '1px solid #78350f', borderRadius: 8, padding: '10px 14px', color: '#fbbf24', fontSize: 13, marginBottom: 16 },
  msgOk:     { background: '#052e16', border: '1px solid #166534', borderRadius: 8, padding: '10px 14px', color: '#4ade80', fontSize: 13, marginBottom: 16 },
  msgErr:    { background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16 },
  form:      { background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 12, padding: 24, marginBottom: 24 },
  formTitle: { fontSize: 15, fontWeight: 600, color: '#38bdf8', marginBottom: 20 },
  grid:      { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 },
  field:     { display: 'flex', flexDirection: 'column', gap: 6 },
  label:     { fontSize: 12, color: '#94a3b8', fontWeight: 500 },
  hint:      { fontSize: 11, color: '#475569' },
  input:     { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none' },
  modeGrid:  { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 },
  modeBtn:   { padding: '8px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s' },
  payGrid:   { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 },
  payBtn:    { padding: '8px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s' },
  checkbox:  { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#cbd5e1', cursor: 'pointer' },
  submitBtn: { background: '#166534', color: '#4ade80', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8, width: '100%' },
  tableWrap: { overflowX: 'auto' },
  empty:     { color: '#475569', fontSize: 13, padding: '20px 0' },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:        { padding: '10px 12px', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #1e3a5f', fontWeight: 500, whiteSpace: 'nowrap' },
  td:        { padding: '8px 12px', color: '#cbd5e1', borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap' },
  delBtn:    { background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, padding: 2 },
}
