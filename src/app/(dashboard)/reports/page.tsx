'use client'
// src/app/(dashboard)/reports/page.tsx
import { useState, useEffect } from 'react'
import Link from 'next/link'

const C = {
  bg: '#0C1117', surface: '#151C24', surface2: '#1C2532',
  border: '#2A3441', border2: '#3A4858',
  orange: '#F97316', blue: '#3B82F6', green: '#22C55E',
  red: '#EF4444', purple: '#A855F7', yellow: '#EAB308',
  text: '#E2EBF4', text2: '#94A3B8', text3: '#64748B',
}

interface ReportData {
  month: string
  monthLabel: string
  period: { start: string; end: string }
  generatedAt: string
  generatedBy: string
  overview: {
    totalCalls: number
    totalPositive: number
    totalNegative: number
    conversionRate: number
    newCustomers: number
    closedCustomers: number
    totalCustomers: number
  }
  staffStats: Array<{
    staff: { id: string; username: string; role: string }
    total_calls: number
    positive: number
    neutral: number
    negative: number
    active_days: number
    avg_per_day: string
    conversion_rate: number
    score: number
  }>
  hotLeads: Array<{
    id: string; phone_number: string; full_name?: string
    potential_score: number; status: string; total_contacts: number
  }>
}

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 70 ? C.green : score >= 40 ? C.orange : C.red
  return (
    <div style={{
      width: 42, height: 42, borderRadius: '50%',
      background: `${color}15`, border: `2px solid ${color}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 800, color }}>
        {score}
      </span>
    </div>
  )
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color, minWidth: 28, textAlign: 'right' }}>
        {value}
      </span>
      <div style={{ width: 64, height: 5, background: C.bg, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color, borderRadius: 3, transition: 'width 1s ease' }} />
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [data, setData]   = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports/kpi?month=${month}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [month])

  const maxCalls = data ? Math.max(...data.staffStats.map(s => s.total_calls), 1) : 1

  function openPrint() {
    setPrinting(true)
    window.open(`/api/reports/kpi/print?month=${month}`, '_blank')
    setTimeout(() => setPrinting(false), 2000)
  }

  const RANK_MEDALS = ['🥇', '🥈', '🥉']
  const RANK_COLORS = [C.yellow, '#94A3B8', '#CD7C2F']

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2.5, color: C.text3, marginBottom: 6 }}>
            BÁO CÁO
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: -0.5 }}>KPI Nhân viên</h1>
          {data && (
            <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>
              {data.period.start} → {data.period.end} · Lập bởi {data.generatedBy}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="month" className="input" style={{ maxWidth: 160 }}
            value={month} onChange={e => setMonth(e.target.value)} />
          <button
            onClick={openPrint}
            disabled={!data || printing}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: data ? C.orange : C.surface2,
              color: data ? '#fff' : C.text3,
              cursor: data ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 600,
              boxShadow: data ? `0 4px 14px ${C.orange}40` : 'none',
            }}
          >
            {printing ? '⏳' : '🖨️'} {printing ? 'Đang mở...' : 'In / Xuất PDF'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: 12 }}>
          <span className="spinner" style={{ width: 28, height: 28 }} />
          <span style={{ color: C.text3 }}>Đang tải báo cáo...</span>
        </div>
      ) : !data ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 48, textAlign: 'center', color: C.text3 }}>
          Không thể tải dữ liệu
        </div>
      ) : (
        <>
          {/* Overview cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
            {[
              { label: 'TỔNG CUỘC GỌI', value: data.overview.totalCalls, color: C.blue, icon: '📞', sub: 'toàn đội' },
              { label: 'TỈ LỆ TÍCH CỰC', value: `${data.overview.conversionRate}%`, color: data.overview.conversionRate >= 50 ? C.green : C.orange, icon: '😊', sub: `${data.overview.totalPositive} cuộc tích cực` },
              { label: 'KHÁCH HÀNG MỚI', value: data.overview.newCustomers, color: C.orange, icon: '👤', sub: `tổng ${data.overview.totalCustomers}` },
              { label: 'ĐÃ CHỐT HĐ', value: data.overview.closedCustomers, color: C.green, icon: '✅', sub: 'tháng này' },
            ].map(({ label, value, color, icon, sub }) => (
              <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: 2, color: C.text3, marginBottom: 8 }}>{label}</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color, letterSpacing: -1, lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: 11, color: C.text3, marginTop: 5 }}>{sub}</div>
                  </div>
                  <div style={{ fontSize: 22, width: 40, height: 40, borderRadius: 10, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Staff leaderboard table */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            {/* Table header */}
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2.5, color: C.text3 }}>
                CHI TIẾT TỪNG NHÂN VIÊN
              </div>
              <div style={{ fontSize: 11, color: C.text3 }}>
                {data.staffStats.length} nhân viên · {data.monthLabel}
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.surface2 }}>
                  {['#', 'Nhân viên', 'Cuộc gọi', 'Tích cực', 'Trung lập', 'Gay gắt', 'Tỉ lệ %', 'Ngày HĐ', 'TB/ngày', 'Điểm'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: 1.5, color: C.text3, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.staffStats.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 40, textAlign: 'center', color: C.text3, fontSize: 13 }}>
                      Chưa có dữ liệu tháng này
                    </td>
                  </tr>
                ) : (
                  data.staffStats.map((s, i) => {
                    const sentColor = (r: number) => r >= 60 ? C.green : r >= 30 ? C.orange : C.red
                    return (
                      <tr key={s.staff.id} style={{ borderBottom: `1px solid ${C.border}` }} className="table-row">
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, color: i < 3 ? RANK_COLORS[i] : C.text3 }}>
                            {i < 3 ? RANK_MEDALS[i] : `#${i + 1}`}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>{s.staff.username}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <MiniBar value={s.total_calls} max={maxCalls} color={C.blue} />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: C.green, background: '#22C55E15', padding: '2px 8px', borderRadius: 5 }}>
                            {s.positive}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: C.orange, background: '#F9731615', padding: '2px 8px', borderRadius: 5 }}>
                            {s.neutral}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: C.red, background: '#EF444415', padding: '2px 8px', borderRadius: 5 }}>
                            {s.negative}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 800, color: sentColor(s.conversion_rate) }}>
                            {s.conversion_rate}%
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: C.text2 }}>
                          {s.active_days} ngày
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: C.text2 }}>
                          {s.avg_per_day}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <ScoreCircle score={s.score} />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Hot leads */}
          {data.hotLeads.length > 0 && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2.5, color: C.text3 }}>
                  🔥 LEADS NÓNG CẦN THEO DÕI
                </div>
                <Link href="/customers" style={{ fontSize: 11, color: C.orange, textDecoration: 'none' }}>
                  Xem tất cả →
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
                {data.hotLeads.slice(0, 9).map((lead, i) => {
                  const sc = lead.potential_score
                  const scColor = sc >= 9 ? C.green : sc >= 7 ? C.orange : C.blue
                  return (
                    <Link key={lead.id} href={`/customers/${lead.id}`} style={{ textDecoration: 'none' }}>
                      <div className="table-row" style={{
                        padding: '14px 20px', cursor: 'pointer',
                        borderBottom: i < data.hotLeads.length - 1 ? `1px solid ${C.border}` : 'none',
                        borderRight: (i + 1) % 3 !== 0 ? `1px solid ${C.border}` : 'none',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${scColor}15`, border: `1.5px solid ${scColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 800, color: scColor }}>{sc}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lead.full_name || <span style={{ color: C.text3, fontStyle: 'italic' }}>Chưa có tên</span>}
                          </div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: C.blue }}>{lead.phone_number}</div>
                        </div>
                        <div style={{ fontSize: 10, color: C.orange, background: '#F9731615', padding: '2px 8px', borderRadius: 5, flexShrink: 0 }}>
                          {lead.status}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Print hint */}
          <div style={{ marginTop: 20, padding: '14px 20px', background: '#F9731608', border: `1px solid ${C.orange}20`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>💡</span>
            <div style={{ fontSize: 12, color: C.text2 }}>
              Nhấn <strong style={{ color: C.orange }}>"In / Xuất PDF"</strong> để mở trang báo cáo đầy đủ. Trong trang đó, dùng <strong>Ctrl+P</strong> (hoặc nút In) → chọn <strong>"Save as PDF"</strong> để lưu file.
            </div>
          </div>
        </>
      )}
    </div>
  )
}
