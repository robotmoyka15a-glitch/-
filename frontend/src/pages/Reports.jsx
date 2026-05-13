import React, { useState, useEffect } from 'react'
import { reportsAPI } from '../api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import dayjs from 'dayjs'

const WASH_MODES  = { 1: 'Экспресс', 2: 'Стандарт', 3: 'Комплекс', 4: 'Премиум' }
const PAY_METHODS = { cash: 'Наличные', card: 'Карта', qr: 'QR-код' }
const COLORS = ['#38bdf8','#4ade80','#f59e0b','#a78bfa','#f87171','#34d399']

export default function Reports() {
  const today = dayjs().format('YYYY-MM-DD')
  const [tab, setTab]         = useState('day')
  const [date, setDate]       = useState(today)
  const [rangeFrom, setFrom]  = useState(dayjs().startOf('week').format('YYYY-MM-DD'))
  const [rangeTo, setTo]      = useState(today)
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      let res
      if (tab === 'day')   res = await reportsAPI.day(date)
      if (tab === 'week')  res = await reportsAPI.week()
      if (tab === 'month') res = await reportsAPI.month()
      if (tab === 'range') res = await reportsAPI.range(rangeFrom, rangeTo)
      setReport(res.data)
    } catch { setReport(null) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tab])

  const handleExcel = () => {
    let url
    if (tab === 'day')   url = reportsAPI.dayExcel(date)
    if (tab === 'range') url = reportsAPI.rangeExcel(rangeFrom, rangeTo)
    if (url) window.open(url)
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h2 style={s.title}>📊 Отчёты</h2>
        <button style={s.excelBtn} onClick={handleExcel}>
          📥 Скачать Excel
        </button>
      </div>

      {/* Вкладки */}
      <div style={s.tabs}>
        {[['day','День'],['week','Неделя'],['month','Месяц'],['range','Период']].map(([k,v]) => (
          <button key={k}
            style={{ ...s.tab, ...(tab === k ? s.tabActive : {}) }}
            onClick={() => setTab(k)}
          >{v}</button>
        ))}
      </div>

      {/* Параметры */}
      <div style={s.params}>
        {tab === 'day' && (
          <div style={s.paramRow}>
            <label style={s.label}>Дата</label>
            <input type="date" style={s.input} value={date}
              onChange={e => setDate(e.target.value)} />
            <button style={s.loadBtn} onClick={load}>Загрузить</button>
          </div>
        )}
        {tab === 'range' && (
          <div style={s.paramRow}>
            <label style={s.label}>С</label>
            <input type="date" style={s.input} value={rangeFrom} onChange={e => setFrom(e.target.value)} />
            <label style={s.label}>По</label>
            <input type="date" style={s.input} value={rangeTo} onChange={e => setTo(e.target.value)} />
            <button style={s.loadBtn} onClick={load}>Загрузить</button>
          </div>
        )}
      </div>

      {loading && <div style={s.loading}>Загрузка...</div>}

      {/* Дневной отчёт */}
      {!loading && report && (tab === 'day') && <DayReport report={report} />}

      {/* Период / неделя / месяц */}
      {!loading && report && (tab !== 'day') && <RangeReport report={report} />}
    </div>
  )
}

function DayReport({ report }) {
  const s2 = report.summary || {}
  const modeData  = (report.by_mode || []).map(r => ({
    name: WASH_MODES[r.wash_mode] || `Режим ${r.wash_mode}`,
    count: r.cnt, revenue: Math.round(r.revenue),
  }))
  const payData = (report.by_payment || []).map(r => ({
    name: PAY_METHODS[r.payment_method] || r.payment_method,
    count: r.cnt, revenue: Math.round(r.revenue),
  }))

  return (
    <div>
      {/* Сводка */}
      <div style={s.statsGrid}>
        <Stat icon="🚗" label="Всего машин" value={s2.total_cars ?? 0} />
        <Stat icon="💰" label="Общая выручка" value={`${Math.round(s2.total_revenue ?? 0)} ₽`} color="#4ade80" />
        <Stat icon="📦" label="Осн. выручка" value={`${Math.round(s2.main_revenue ?? 0)} ₽`} />
        <Stat icon="⭐" label="Доп. услуги" value={`${Math.round(s2.extra_revenue ?? 0)} ₽`} color="#f59e0b" />
        <Stat icon="🪟" label="Стёкла" value={s2.wiped_count ?? 0} />
        <Stat icon="🔧" label="Доп. заказов" value={s2.extra_count ?? 0} />
      </div>

      {/* Графики */}
      <div style={s.charts}>
        <div style={s.chartBox}>
          <div style={s.chartTitle}>По режимам мойки</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={modeData} barSize={28}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
              <Bar dataKey="count" name="Машин">
                {modeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={s.chartBox}>
          <div style={s.chartTitle}>По типу оплаты</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={payData} barSize={28}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
              <Bar dataKey="revenue" name="Выручка ₽">
                {payData.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Смены */}
      {(report.shifts || []).length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Смены</div>
          {report.shifts.map(sh => (
            <div key={sh.id} style={s.shiftRow}>
              <span>{sh.full_name}</span>
              <span style={{ color: '#64748b' }}>{sh.started_at?.slice(11,16)} – {sh.ended_at ? sh.ended_at.slice(11,16) : 'открыта'}</span>
              {sh.is_late && <span style={s.late}>⚠️ опоздание {sh.late_minutes} мин</span>}
            </div>
          ))}
        </div>
      )}

      {/* Машины */}
      {(report.cars || []).length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Журнал машин ({report.cars.length})</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>{['#','Время','Оператор','Режим','Оплата','Сумма','Доп.','Стёкла'].map(h =>
                  <th key={h} style={s.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {report.cars.map((c, i) => (
                  <tr key={c.id} style={{ background: i%2===0 ? '#0d1b2e' : '#0f1f35' }}>
                    <td style={s.td}>{i+1}</td>
                    <td style={s.td}>{c.arrived_at?.slice(11,16)}</td>
                    <td style={s.td}>{c.full_name}</td>
                    <td style={s.td}>{WASH_MODES[c.wash_mode]}</td>
                    <td style={s.td}>{PAY_METHODS[c.payment_method]}</td>
                    <td style={{ ...s.td, color: '#4ade80', fontWeight: 600 }}>{c.amount} ₽</td>
                    <td style={s.td}>{c.extra_service ? `⭐ ${c.extra_service_name || ''}` : '—'}</td>
                    <td style={{ ...s.td, textAlign: 'center' }}>{c.windows_wiped ? '✅' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function RangeReport({ report }) {
  const s2 = report.summary || {}
  const daily = (report.daily || []).map(r => ({
    name: r.date?.slice(5), cars: r.cars, revenue: Math.round(r.revenue)
  }))
  return (
    <div>
      <div style={s.statsGrid}>
        <Stat icon="🚗" label="Всего машин" value={s2.total_cars ?? 0} />
        <Stat icon="💰" label="Итого выручка" value={`${Math.round(s2.total_revenue ?? 0)} ₽`} color="#4ade80" />
        <Stat icon="📈" label="Среднее/машина" value={`${Math.round(s2.avg_per_car ?? 0)} ₽`} />
      </div>
      {daily.length > 0 && (
        <div style={s.chartBox}>
          <div style={s.chartTitle}>Выручка по дням</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={daily} barSize={20}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
              <Bar dataKey="revenue" name="Выручка ₽" fill="#38bdf8" />
            </BarChart>
          </ResponsiveContainer>
          <div style={s.chartTitle}>Машин по дням</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={daily} barSize={20}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
              <Bar dataKey="cars" name="Машин" fill="#4ade80" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function Stat({ icon, label, value, color = '#e2e8f0' }) {
  return (
    <div style={s.statCard}>
      <span style={s.statIcon}>{icon}</span>
      <span style={{ ...s.statValue, color }}>{value}</span>
      <span style={s.statLabel}>{label}</span>
    </div>
  )
}

const s = {
  page:      { padding: '24px 28px', maxWidth: 1000, margin: '0 auto' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title:     { fontSize: 20, fontWeight: 700, color: '#e2e8f0' },
  excelBtn:  { background: '#166534', color: '#4ade80', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  tabs:      { display: 'flex', gap: 8, marginBottom: 16 },
  tab:       { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '7px 18px', cursor: 'pointer', color: '#64748b', fontSize: 13, fontWeight: 500 },
  tabActive: { background: '#1e3a5f', border: '1px solid #38bdf8', color: '#38bdf8' },
  params:    { marginBottom: 16 },
  paramRow:  { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  label:     { fontSize: 13, color: '#64748b' },
  input:     { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none' },
  loadBtn:   { background: '#0369a1', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 },
  loading:   { color: '#64748b', padding: 20 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 },
  statCard:  { background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 },
  statIcon:  { fontSize: 20 },
  statValue: { fontSize: 22, fontWeight: 700, lineHeight: 1 },
  statLabel: { fontSize: 12, color: '#64748b' },
  charts:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 },
  chartBox:  { background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 12, padding: '16px 20px' },
  chartTitle:{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12 },
  section:   { marginBottom: 20 },
  sectionTitle:{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 10 },
  shiftRow:  { display: 'flex', gap: 16, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #1e293b', fontSize: 13 },
  late:      { background: '#451a03', color: '#fb923c', borderRadius: 6, padding: '2px 8px', fontSize: 11 },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th:        { padding: '8px 10px', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #1e3a5f', whiteSpace: 'nowrap' },
  td:        { padding: '7px 10px', color: '#cbd5e1', borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap' },
}
