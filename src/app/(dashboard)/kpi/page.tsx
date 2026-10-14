'use client'
// src/app/(dashboard)/kpi/page.tsx  — V1.1
import { useState, useEffect } from 'react'

interface KPIItem {
  staff: { id: string; username: string; role: string }
  total_calls: number
  successful_leads: number
  closed_deals: number
  conversion_rate: number
}
interface MonthData {
  month: string; label: string; data: KPIItem[]; period: { start: string; end: string }
}

const C = {
  bg: '#0C1117', surface: '#151C24', surface2: '#1C2532',
  border: '#2A3441', border2: '#3A4858',
  orange: '#F97316', blue: '#3B82F6', green: '#22C55E',
  red: '#EF4444', purple: '#A855F7', yellow: '#EAB308',
  text: '#E2EBF4', text2: '#94A3B8', text3: '#64748B',
}

function ColumnChart({ salesList, months }: { salesList: string[]; months: MonthData[] }) {
  if (!months.length || !salesList.length) return null
  const W = 640, H = 200, PAD = { t: 16, r: 20, b: 40, l: 40 }
  const inner = { w: W - PAD.l - PAD.r, h: H - PAD.t - PAD.b }
  const allVals = months.flatMap(m => m.data.map(d => d.total_calls))
  const maxVal = Math.max(...allVals, 1)
  const groupW = inner.w / salesList.length
  const barW = Math.min(18, (groupW - 6) / months.length)
  const gap = 3
  const MCLR = [C.blue, C.orange, C.green, C.purple]
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(r => ({ y: PAD.t + inner.h * (1 - r), label: Math.round(maxVal * r) }))
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {yTicks.map(t => (
        <g key={t.label}>
          <line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y} stroke={C.border} strokeWidth="1" strokeDasharray="3 5" />
          <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fontSize="9" fill={C.text3} fontFamily="JetBrains Mono,monospace">{t.label}</text>
        </g>
      ))}
      {salesList.map((username, gi) => {
        const cx = PAD.l + gi * groupW + groupW / 2
        const totalBarW = months.length * (barW + gap) - gap
        const startX = cx - totalBarW / 2
        return (
          <g key={username}>
            {months.map((m, mi) => {
              const item = m.data.find(d => d.staff.username === username)
              const val = item?.total_calls || 0
              const barH = (val / maxVal) * inner.h
              const x = startX + mi * (barW + gap)
              const y = PAD.t + inner.h - barH
              return (
                <g key={m.month}>
                  <rect x={x} y={y} width={barW} height={barH} fill={MCLR[mi % MCLR.length]} rx="3" opacity="0.85" />
                  {val > 0 && barH > 16 && (
                    <text x={x + barW / 2} y={y + 11} textAnchor="middle" fontSize="8" fill="#fff" fontFamily="JetBrains Mono,monospace" fontWeight="600">{val}</text>
                  )}
                </g>
              )
            })}
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="9" fill={C.text3} fontFamily="DM Sans,sans-serif">
              {username.length > 8 ? username.slice(0, 7) + '…' : username}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function MiniRadar({ pctTarget, rate }: { pctTarget: number; rate: number }) {
  const vals = [Math.min(pctTarget, 100), rate, Math.min((pctTarget + rate) / 2, 100)]
  const labels = ['Target', 'Tỉ lệ', 'Tổng']
  const R = 32, cx = 40, cy = 40, n = 3
  const toXY = (i: number, r: number) => {
    const angle = (i * 2 * Math.PI) / n - Math.PI / 2
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  }
  const gridPts = (r: number) => Array.from({ length: n }, (_, i) => toXY(i, r)).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const dataPts = vals.map((v, i) => toXY(i, (v / 100) * R)).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  return (
    <svg width="80" height="80">
      {[0.33, 0.66, 1].map(r => <polygon key={r} points={gridPts(r * R)} fill="none" stroke={C.border} strokeWidth="1" />)}
      {Array.from({ length: n }, (_, i) => { const p = toXY(i, R); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={C.border2} strokeWidth="1" /> })}
      <polygon points={dataPts} fill={`${C.orange}30`} stroke={C.orange} strokeWidth="1.5" />
      {labels.map((l, i) => { const p = toXY(i, R + 10); return <text key={l} x={p.x} y={p.y + 3} textAnchor="middle" fontSize="7" fill={C.text3} fontFamily="JetBrains Mono,monospace">{l}</text> })}
    </svg>
  )
}

export default function KPIPage() {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [month, setMonth] = useState(currentMonth)
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState<MonthData | null>(null)
  const [prevData, setPrevData] = useState<MonthData[]>([])
  const [view, setView] = useState<'cards' | 'chart' | 'compare'>('cards')
  const [targetCalls, setTargetCalls] = useState(30)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/kpi?month=${month}`).then(r => r.json()).then(json => {
      const label = new Date(month + '-01').toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
      setCurrent({ month, label, data: json.data || [], period: json.period })
      setLoading(false)
    })
  }, [month])

  useEffect(() => {
    const months = [-1, -2, -3].map(offset => {
      const d = new Date(month + '-01'); d.setMonth(d.getMonth() + offset)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
    Promise.all(months.map(m =>
      fetch(`/api/kpi?month=${m}`).then(r => r.json()).then(json => ({
        month: m,
        label: new Date(m + '-01').toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }),
        data: json.data || [], period: json.period,
      }))
    )).then(setPrevData)
  }, [month])

  const allMonths = current ? [current, ...prevData] : prevData
  const salesList = [...new Set(allMonths.flatMap(m => m.data.map(d => d.staff.username)))]
  const maxCalls = Math.max(...(current?.data.map(d => d.total_calls) ?? []), 1)
  const RANK_CLR = [C.yellow, '#94A3B8', '#CD7C2F']

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text }}>KPI Nhân viên</h1>
          {current?.period && <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>{current.period.start} → {current.period.end}</div>}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 12px' }}>
            <span style={{ fontSize: 12, color: C.text3 }}>🎯 Target:</span>
            <input type="number" min="1" max="999" value={targetCalls} onChange={e => setTargetCalls(Number(e.target.value))}
              style={{ width: 48, background: 'transparent', border: 'none', outline: 'none', color: C.orange, fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", textAlign: 'center' }} />
            <span style={{ fontSize: 11, color: C.text3 }}>cuộc</span>
          </div>
          <input type="month" className="input" style={{ maxWidth: 160 }} value={month} onChange={e => setMonth(e.target.value)} />
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content' }}>
        {(['cards', 'chart', 'compare'] as const).map(k => (
          <button key={k} onClick={() => setView(k)}
            style={{ padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
              fontWeight: view === k ? 600 : 400, background: view === k ? C.orange : 'transparent',
              color: view === k ? '#fff' : C.text2 }}>
            {k === 'cards' ? '📋 Thẻ' : k === 'chart' ? '📊 Biểu đồ' : '📈 So sánh'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : !current || current.data.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 48, textAlign: 'center', color: C.text3 }}>
          Không có dữ liệu
        </div>
      ) : (
        <>
          {/* CARDS */}
          {view === 'cards' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {current.data.sort((a, b) => b.total_calls - a.total_calls).map((item, i) => {
                const pct = Math.min((item.total_calls / targetCalls) * 100, 100)
                const reached = item.total_calls >= targetCalls
                const effScore = Math.min(Math.round((item.total_calls / Math.max(targetCalls, 1)) * 50 + (item.conversion_rate / 100) * 50), 100)
                return (
                  <div key={item.staff.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {/* Rank */}
                      <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, background: i < 3 ? `${RANK_CLR[i]}20` : C.surface2, border: `1px solid ${i < 3 ? RANK_CLR[i] + '40' : C.border}`, color: i < 3 ? RANK_CLR[i] : C.text3 }}>#{i + 1}</div>
                      {/* Radar */}
                      <div style={{ flexShrink: 0 }}>
                        <MiniRadar pctTarget={pct} rate={item.conversion_rate} />
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{item.staff.username}</span>
                          {reached && <span style={{ fontSize: 11, color: C.green, background: '#22C55E15', padding: '2px 8px', borderRadius: 5, border: '1px solid #22C55E30' }}>✅ Đạt target</span>}
                        </div>
                        {/* Progress */}
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.text3, marginBottom: 5 }}>
                            <span>Tiến độ: {item.total_calls}/{targetCalls} cuộc</span>
                            <span style={{ color: reached ? C.green : C.orange, fontWeight: 600 }}>{Math.round(pct)}%</span>
                          </div>
                          <div style={{ height: 7, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: reached ? `linear-gradient(90deg, ${C.green}, #4ade80)` : `linear-gradient(90deg, ${C.orange}, ${C.yellow})`, transition: 'width 1.2s cubic-bezier(.4,0,.2,1)' }} />
                          </div>
                        </div>
                        {/* Stats */}
                        <div style={{ display: 'flex', gap: 24 }}>
                          {[
                            { l: 'Cuộc gọi', v: item.total_calls, c: C.blue },
                            { l: 'Tích cực', v: item.successful_leads, c: C.green },
                            { l: 'Tỉ lệ %', v: `${item.conversion_rate}%`, c: item.conversion_rate >= 50 ? C.green : C.orange },
                          ].map(({ l, v, c }) => (
                            <div key={l} style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: c, letterSpacing: -0.5 }}>{v}</div>
                              <div style={{ fontSize: 10, color: C.text3, marginTop: 1 }}>{l}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Score */}
                      <div style={{ flexShrink: 0, textAlign: 'center' }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: effScore >= 70 ? '#22C55E15' : effScore >= 40 ? '#F9731615' : '#EF444415', border: `2px solid ${effScore >= 70 ? C.green : effScore >= 40 ? C.orange : C.red}40`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 800, color: effScore >= 70 ? C.green : effScore >= 40 ? C.orange : C.red }}>{effScore}</span>
                        </div>
                        <div style={{ fontSize: 9, color: C.text3 }}>ĐIỂM</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* CHART */}
          {view === 'chart' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Calls bar */}
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2, color: C.text3, marginBottom: 16 }}>CUỘC GỌI — {current.label.toUpperCase()}</div>
                {current.data.sort((a, b) => b.total_calls - a.total_calls).map((d, i) => {
                  const pct = (d.total_calls / maxCalls) * 100
                  const reached = d.total_calls >= targetCalls
                  return (
                    <div key={d.staff.id} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: i < 3 ? RANK_CLR[i] : C.text3 }}>#{i + 1}</span>
                          <span style={{ fontSize: 13, color: C.text }}>{d.staff.username}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {reached && <span style={{ fontSize: 10, color: C.green }}>✅</span>}
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: reached ? C.green : C.blue }}>{d.total_calls}</span>
                        </div>
                      </div>
                      <div style={{ height: 8, background: C.bg, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: reached ? `linear-gradient(90deg, ${C.green}, #4ade80)` : C.blue, transition: 'width 1.2s ease' }} />
                      </div>
                    </div>
                  )
                })}
                <div style={{ marginTop: 8, fontSize: 11, color: C.text3 }}>🎯 Target: {targetCalls} cuộc/tháng</div>
              </div>

              {/* Conversion bar */}
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2, color: C.text3, marginBottom: 16 }}>TỈ LỆ TÍCH CỰC — {current.label.toUpperCase()}</div>
                {current.data.sort((a, b) => b.conversion_rate - a.conversion_rate).map((d) => {
                  const clr = d.conversion_rate >= 60 ? C.green : d.conversion_rate >= 30 ? C.orange : C.red
                  return (
                    <div key={d.staff.id} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <span style={{ fontSize: 13, color: C.text }}>{d.staff.username}</span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: clr }}>{d.conversion_rate}%</span>
                      </div>
                      <div style={{ height: 8, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 4, width: `${d.conversion_rate}%`, background: clr, transition: 'width 1.2s ease' }} />
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, color: C.text3 }}>{d.successful_leads}/{d.total_calls} cuộc tích cực</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* COMPARE */}
          {view === 'compare' && (
            <div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2, color: C.text3 }}>SO SÁNH 4 THÁNG GẦN NHẤT</div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {allMonths.slice(0, 4).map((m, i) => {
                      const clrs = [C.blue, C.orange, C.green, C.purple]
                      return (
                        <div key={m.month} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: clrs[i] }} />
                          <span style={{ fontSize: 11, color: C.text3 }}>{m.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <ColumnChart salesList={salesList} months={allMonths.slice(0, 4)} />
              </div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: C.surface2 }}>
                      {['Nhân viên', ...allMonths.slice(0, 4).map(m => m.label), 'Xu hướng'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 1.5, color: C.text3, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {salesList.map(username => {
                      const vals = allMonths.slice(0, 4).map(m => m.data.find(d => d.staff.username === username)?.total_calls || 0)
                      const trend = vals.length >= 2 ? vals[0] - vals[1] : 0
                      return (
                        <tr key={username} className="table-row">
                          <td style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, color: C.text, fontSize: 13 }}>{username}</td>
                          {vals.map((v, i) => (
                            <td key={i} style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: i === 0 ? C.blue : C.text2 }}>{v}</td>
                          ))}
                          <td style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                            {trend !== 0 ? (
                              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: trend > 0 ? C.green : C.red }}>
                                {trend > 0 ? '↑ +' : '↓ '}{trend}
                              </span>
                            ) : <span style={{ fontSize: 11, color: C.text3 }}>—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
