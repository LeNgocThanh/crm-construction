'use client'
// src/app/(dashboard)/analytics/page.tsx
import { useState, useEffect } from 'react'

const C = {
  bg: '#0C1117', surface: '#151C24', surface2: '#1C2532',
  border: '#2A3441', border2: '#3A4858',
  orange: '#F97316', blue: '#3B82F6', green: '#22C55E',
  red: '#EF4444', purple: '#A855F7', yellow: '#EAB308',
  teal: '#14B8A6',
  text: '#E2EBF4', text2: '#94A3B8', text3: '#64748B',
}

const HOUSE_ICONS: Record<string, string> = {
  'Nhà phố': '🏘️', 'Biệt thự': '🏰', 'Nhà cấp 4': '🏠', 'Chung cư': '🏢', 'Khác': '🏗️',
}
const DOW_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const STATUS_ORDER = ['Mới', 'Đang tìm hiểu', 'Hẹn gặp', 'Đang thương thảo', 'Chờ ký HĐ', 'Đã ký HĐ', 'Đang thi công', 'Hoàn công', 'Bảo hành', 'Hoàn tất', 'Tạm ngưng', 'Từ chối']
const STATUS_COLORS: Record<string, string> = {
  'Mới': C.blue,
  'Đang tìm hiểu': C.purple,
  'Hẹn gặp': C.yellow,
  'Đang thương thảo': C.orange,
  'Chờ ký HĐ': C.red,
  'Đã ký HĐ': C.green,
  'Đang thi công': C.teal,
  'Hoàn công': '#06B6D4',
  'Bảo hành': '#6366F1',
  'Hoàn tất': '#1D9E75',
  'Tạm ngưng': C.text3,
  'Từ chối': '#475569',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, ...style }}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2.5, color: C.text3, marginBottom: 16 }}>
      {children}
    </div>
  )
}

// Dual-line area chart (12 months)
function AreaChart({ series }: {
  series: Array<{ label: string; color: string; data: Array<{ label: string; count: number }> }>
}) {
  const W = 660, H = 160
  const PAD = { t: 12, r: 16, b: 32, l: 36 }
  const inner = { w: W - PAD.l - PAD.r, h: H - PAD.t - PAD.b }
  const allVals = series.flatMap(s => s.data.map(d => d.count))
  const maxVal = Math.max(...allVals, 1)
  const n = series[0]?.data.length || 1

  const pts = (data: typeof series[0]['data']) =>
    data.map((d, i) => ({
      x: PAD.l + (i / (n - 1)) * inner.w,
      y: PAD.t + inner.h - (d.count / maxVal) * inner.h,
      v: d.count,
      label: d.label,
    }))

  const line = (ps: ReturnType<typeof pts>) =>
    ps.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  const area = (ps: ReturnType<typeof pts>, id: string, color: string) => {
    const bot = PAD.t + inner.h
    const d = `${line(ps)} L ${ps[ps.length-1].x},${bot} L ${ps[0].x},${bot} Z`
    return (
      <>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path d={d} fill={`url(#${id})`} />
      </>
    )
  }

  const yTicks = [0, 0.5, 1].map(r => ({
    y: PAD.t + inner.h * (1 - r),
    label: Math.round(maxVal * r),
  }))

  // X labels: every 3 months
  const xLabels = series[0]?.data.filter((_, i) => i % 3 === 0 || i === n - 1) || []

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {yTicks.map(t => (
        <g key={t.label}>
          <line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y} stroke={C.border} strokeWidth="1" strokeDasharray="3 5" />
          <text x={PAD.l - 5} y={t.y + 4} textAnchor="end" fontSize="9" fill={C.text3} fontFamily="JetBrains Mono,monospace">{t.label}</text>
        </g>
      ))}
      {xLabels.map(d => {
        const i = series[0].data.findIndex(x => x.label === d.label)
        const x = PAD.l + (i / (n - 1)) * inner.w
        return (
          <text key={d.label} x={x} y={H - 4} textAnchor="middle" fontSize="9" fill={C.text3} fontFamily="JetBrains Mono,monospace">{d.label}</text>
        )
      })}
      {series.map((s, si) => {
        const p = pts(s.data)
        return (
          <g key={s.label}>
            {area(p, `ag-${si}`, s.color)}
            <path d={line(p)} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={p[p.length - 1].x} cy={p[p.length - 1].y} r="3" fill={s.color} />
          </g>
        )
      })}
    </svg>
  )
}

// Funnel chart
function FunnelChart({ data }: { data: Record<string, number> }) {
  const stages = ['Mới', 'Đang tư vấn', 'Đã chốt', 'Tạm ngưng']
  const colors = [C.blue, C.orange, C.green, C.text3]
  const total  = Object.values(data).reduce((s, v) => s + v, 0)
  const max    = Math.max(...Object.values(data), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {stages.map((stage, i) => {
        const val = data[stage] || 0
        const pct = total > 0 ? Math.round((val / total) * 100) : 0
        const w   = max > 0 ? (val / max) * 100 : 0
        return (
          <div key={stage}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[i], flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: C.text2 }}>{stage}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: C.text3 }}>{pct}%</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: colors[i], minWidth: 28, textAlign: 'right' }}>{val}</span>
              </div>
            </div>
            <div style={{ height: 7, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${w}%`, background: colors[i], borderRadius: 4, transition: 'width 1.2s ease' }} />
            </div>
          </div>
        )
      })}
      <div style={{ marginTop: 6, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.text3 }}>
        <span>Tổng</span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: C.text }}>{total}</span>
      </div>
    </div>
  )
}

// Activity heatmap 7 × 24
function StatusDistributionChart({ data }: { data: Record<string, number> }) {
  const total = STATUS_ORDER.reduce((sum, status) => sum + (data[status] || 0), 0)
  const max = Math.max(...STATUS_ORDER.map((status) => data[status] || 0), 1)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {STATUS_ORDER.map((status) => {
        const value = data[status] || 0
        const pct = total > 0 ? Math.round((value / total) * 100) : 0
        const width = max > 0 ? (value / max) * 100 : 0
        const color = STATUS_COLORS[status] || C.text3

        return (
          <div key={status}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: C.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{status}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 10, color: C.text3 }}>{pct}%</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color, minWidth: 24, textAlign: 'right' }}>{value}</span>
              </div>
            </div>
            <div style={{ height: 6, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${width}%`, background: color, borderRadius: 4, transition: 'width 1.2s ease' }} />
            </div>
          </div>
        )
      })}
      <div style={{ gridColumn: '1 / -1', marginTop: 6, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.text3 }}>
        <span>Tổng</span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: C.text }}>{total}</span>
      </div>
    </div>
  )
}

function ActivityHeatmap({ heatmap }: { heatmap: number[][] }) {
  const allVals = heatmap.flat()
  const max = Math.max(...allVals, 1)

  const cellW = 20, cellH = 16, gap = 2
  const labelW = 22, labelH = 14

  const W = labelW + 24 * (cellW + gap)
  const H = labelH + 7  * (cellH + gap)

  const heatColor = (v: number) => {
    if (v === 0) return C.surface2
    const intensity = v / max
    if (intensity < 0.25) return `${C.blue}40`
    if (intensity < 0.5)  return `${C.blue}80`
    if (intensity < 0.75) return C.blue
    return C.orange
  }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {/* Hour labels */}
      {[0,6,12,18,23].map(h => (
        <text key={h}
          x={labelW + h * (cellW + gap) + cellW / 2}
          y={labelH - 2}
          textAnchor="middle" fontSize="8" fill={C.text3}
          fontFamily="JetBrains Mono,monospace">
          {String(h).padStart(2,'0')}h
        </text>
      ))}
      {/* Day labels + cells */}
      {DOW_LABELS.map((day, dow) => (
        <g key={dow}>
          <text
            x={labelW - 4} y={labelH + dow * (cellH + gap) + cellH / 2 + 3}
            textAnchor="end" fontSize="8" fill={C.text3}
            fontFamily="JetBrains Mono,monospace">
            {day}
          </text>
          {Array.from({ length: 24 }, (_, h) => (
            <rect key={h}
              x={labelW + h * (cellW + gap)}
              y={labelH + dow * (cellH + gap)}
              width={cellW} height={cellH}
              rx="3"
              fill={heatColor(heatmap[dow]?.[h] || 0)}>
              <title>{DOW_LABELS[dow]} {String(h).padStart(2,'0')}:00 — {heatmap[dow]?.[h] || 0} cuộc</title>
            </rect>
          ))}
        </g>
      ))}
      {/* Legend */}
      {[{label:'0',color:C.surface2},{label:'thấp',color:`${C.blue}60`},{label:'TB',color:C.blue},{label:'cao',color:C.orange}].map(({label,color},i) => (
        <g key={label}>
          <rect x={W - 140 + i*34} y={H - 10} width={12} height={8} rx="2" fill={color} />
          <text x={W - 140 + i*34 + 14} y={H - 3} fontSize="7" fill={C.text3} fontFamily="JetBrains Mono,monospace">{label}</text>
        </g>
      ))}
    </svg>
  )
}

// Score histogram
function ScoreHistogram({ data }: { data: Array<{ score: number; count: number }> }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const H = 90, W = 380, PAD = { t: 8, r: 8, b: 22, l: 28 }
  const inner = { w: W - PAD.l - PAD.r, h: H - PAD.t - PAD.b }
  const barW = (inner.w / 10) - 3

  const scoreColor = (s: number) =>
    s >= 9 ? C.green : s >= 7 ? C.blue : s >= 4 ? C.orange : C.red

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const barH = (d.count / max) * inner.h
        const x = PAD.l + i * (inner.w / 10) + 1.5
        const y = PAD.t + inner.h - barH
        return (
          <g key={d.score}>
            <rect x={x} y={y} width={barW} height={barH} rx="3" fill={scoreColor(d.score)} opacity="0.85" />
            {d.count > 0 && barH > 12 && (
              <text x={x + barW / 2} y={y + 11} textAnchor="middle" fontSize="8" fill="#fff" fontFamily="JetBrains Mono,monospace" fontWeight="600">{d.count}</text>
            )}
            <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize="9" fill={scoreColor(d.score)} fontFamily="JetBrains Mono,monospace">{d.score}</text>
          </g>
        )
      })}
      {/* Y axis */}
      {[0, 0.5, 1].map(r => {
        const y = PAD.t + inner.h * (1 - r)
        return (
          <g key={r}>
            <line x1={PAD.l - 2} y1={y} x2={W - PAD.r} y2={y} stroke={C.border} strokeWidth="1" strokeDasharray="3 4" />
            <text x={PAD.l - 4} y={y + 3} textAnchor="end" fontSize="8" fill={C.text3} fontFamily="JetBrains Mono,monospace">{Math.round(max * r)}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
      <span className="spinner" style={{ width: 28, height: 28 }} />
      <span style={{ color: C.text3 }}>Đang tải phân tích...</span>
    </div>
  )

  if (!data) return (
    <div style={{ textAlign: 'center', color: C.text3, paddingTop: 80 }}>Không tải được dữ liệu</div>
  )

  const totalHeatmap = data.heatmap.flat().reduce((s: number, v: number) => s + v, 0)
  const peakHour = (() => {
    let maxV = 0, maxH = 0
    for (let h = 0; h < 24; h++) {
      const sum = data.heatmap.reduce((s: number, row: number[]) => s + (row[h] || 0), 0)
      if (sum > maxV) { maxV = sum; maxH = h }
    }
    return maxH
  })()

  const houseEntries = Object.entries(data.houseTypeDist as Record<string,number>)
    .sort(([,a],[,b]) => b - a)
  const totalHouse = houseEntries.reduce((s,[,v]) => s+v, 0)
  const HOUSE_COLORS = [C.orange, C.blue, C.green, C.purple, C.text3]

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2.5, color: C.text3, marginBottom: 6 }}>PHÂN TÍCH</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: -0.5 }}>Analytics</h1>
        <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>
          {data.totals.customers} khách hàng · {data.totals.projects} dự án · 90 ngày gần nhất
        </div>
      </div>

      {/* Growth summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'KH THÁNG NÀY', value: data.monthlyCustomers.at(-1)?.count ?? 0, color: C.blue, growth: data.growth.customers, icon: '👤' },
          { label: 'GỌI THÁNG NÀY', value: data.monthlyCalls.at(-1)?.count ?? 0, color: C.orange, growth: data.growth.calls, icon: '📞' },
          { label: 'GIỜ CAO ĐIỂM', value: `${String(peakHour).padStart(2,'0')}:00`, color: C.purple, growth: null, icon: '⏰', sub: 'nhiều cuộc gọi nhất' },
          { label: 'TỔNG 90 NGÀY', value: totalHeatmap, color: C.green, growth: null, icon: '📊', sub: 'cuộc gọi ghi nhận' },
        ].map(({ label, value, color, growth, icon, sub }) => (
          <Card key={label} style={{ padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: 2, color: C.text3, marginBottom: 7 }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: -1, lineHeight: 1 }}>{value}</div>
              <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                {growth !== null && growth !== undefined && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: growth >= 0 ? C.green : C.red, background: growth >= 0 ? '#22C55E12' : '#EF444412', padding: '1px 6px', borderRadius: 5, fontFamily: "'JetBrains Mono',monospace" }}>
                    {growth >= 0 ? '↑' : '↓'} {Math.abs(growth)}%
                  </span>
                )}
                {sub && <span style={{ fontSize: 10, color: C.text3 }}>{sub}</span>}
              </div>
            </div>
            <div style={{ fontSize: 22, width: 42, height: 42, borderRadius: 10, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
          </Card>
        ))}
      </div>

      {/* 12-month trend chart */}
      <Card style={{ padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <SectionLabel>TĂNG TRƯỞNG 12 THÁNG</SectionLabel>
          <div style={{ display: 'flex', gap: 16 }}>
            {[{c: C.blue, l:'KH mới'},{c: C.orange, l:'Cuộc gọi'}].map(({c,l}) => (
              <div key={l} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <div style={{ width: 20, height: 2, background: c, borderRadius: 1 }} />
                <span style={{ fontSize: 11, color: C.text3 }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <AreaChart series={[
          { label: 'KH mới', color: C.blue,   data: data.monthlyCustomers.map((m: any) => ({ label: m.label, count: m.count })) },
          { label: 'Cuộc gọi', color: C.orange, data: data.monthlyCalls.map((m: any) => ({ label: m.label, count: m.count })) },
        ]} />
      </Card>

      {/* Row: Funnel + House type + Score histogram */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Customer funnel */}
        <Card style={{ padding: '20px 22px' }}>
          <SectionLabel>PHÂN BỔ TRẠNG THÁI KHÁCH HÀNG</SectionLabel>
          <StatusDistributionChart data={data.funnel} />
        </Card>

        {/* House type donut */}
        <Card style={{ padding: '20px 22px' }}>
          <SectionLabel>LOẠI CÔNG TRÌNH</SectionLabel>
          {houseEntries.length === 0 ? (
            <div style={{ color: C.text3, fontSize: 12, textAlign: 'center', paddingTop: 24 }}>Chưa có dữ liệu</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {houseEntries.map(([type, count], i) => (
                <div key={type}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                      <span style={{ fontSize: 16 }}>{HOUSE_ICONS[type] || '🏗️'}</span>
                      <span style={{ fontSize: 12, color: C.text2 }}>{type}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: C.text3 }}>{totalHouse > 0 ? Math.round((count/totalHouse)*100) : 0}%</span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: HOUSE_COLORS[i % HOUSE_COLORS.length] }}>{count}</span>
                    </div>
                  </div>
                  <div style={{ height: 5, background: C.bg, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${totalHouse > 0 ? (count/totalHouse)*100 : 0}%`, background: HOUSE_COLORS[i % HOUSE_COLORS.length], borderRadius: 3, transition: 'width 1.2s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Lead score histogram */}
        <Card style={{ padding: '20px 22px' }}>
          <SectionLabel>PHÂN BỐ LEAD SCORE</SectionLabel>
          <ScoreHistogram data={data.scoreHistogram} />
          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: '🔴 Lạnh (1-3)', color: C.red,    val: data.scoreHistogram.slice(0,3).reduce((s: number,d: any)=>s+d.count,0) },
              { label: '🟠 Ấm (4-6)',   color: C.orange, val: data.scoreHistogram.slice(3,6).reduce((s: number,d: any)=>s+d.count,0) },
              { label: '🔵 Nóng (7-8)', color: C.blue,   val: data.scoreHistogram.slice(6,8).reduce((s: number,d: any)=>s+d.count,0) },
              { label: '🟢 🔥 (9-10)',  color: C.green,  val: data.scoreHistogram.slice(8).reduce((s: number,d: any)=>s+d.count,0) },
            ].map(({label, color, val}) => (
              <div key={label} style={{ fontSize: 11, color: C.text3 }}>
                {label}: <strong style={{ color }}>{val}</strong>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Budget distribution */}
      <Card style={{ padding: '20px 24px', marginBottom: 20 }}>
        <SectionLabel>PHÂN BỐ NGÂN SÁCH DỰ ÁN</SectionLabel>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', height: 100 }}>
          {data.budgetBuckets.map((b: any, i: number) => {
            const maxCount = Math.max(...data.budgetBuckets.map((x: any) => x.count), 1)
            const pct = (b.count / maxCount) * 100
            const clrs = [C.blue, C.orange, C.green, C.purple, C.red]
            return (
              <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: clrs[i] }}>{b.count}</div>
                <div style={{ width: '100%', height: `${Math.max(pct, 4)}%`, background: `${clrs[i]}80`, borderRadius: '4px 4px 0 0', border: `1px solid ${clrs[i]}40`, transition: 'height 1.2s ease', minHeight: 4 }} />
                <div style={{ fontSize: 10, color: C.text3, textAlign: 'center', fontFamily: "'JetBrains Mono',monospace" }}>{b.label}</div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Activity heatmap */}
      <Card style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <SectionLabel>HOẠT ĐỘNG THEO GIỜ (90 NGÀY GẦN NHẤT)</SectionLabel>
          <div style={{ fontSize: 11, color: C.text3 }}>
            Giờ cao điểm: <span style={{ color: C.orange, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{String(peakHour).padStart(2,'0')}:00</span>
          </div>
        </div>
        <ActivityHeatmap heatmap={data.heatmap} />
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8 }}>
          {DOW_LABELS.map((day, dow) => {
            const total = data.heatmap[dow]?.reduce((s: number, v: number) => s + v, 0) || 0
            return (
              <div key={day} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: C.text3, marginBottom: 2 }}>{day}</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: total > 0 ? C.blue : C.text3 }}>{total}</div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
