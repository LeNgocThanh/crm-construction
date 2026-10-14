'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { CSSProperties } from 'react'

type ReportRow = {
  id: string
  project_name: string | null
  status: string | null
  house_type: string | null
  floors: number | null
  floor_area: number | null
  contract_value: number | null
  budget_current: number | null
  cost_actual: number | null
  cost_committed: number | null
  progress_planned_percent: number | null
  progress_actual_percent: number | null
  delay_days: number | null
  risk_level: string | null
  expected_end_date: string | null
  customer: { id: string; full_name: string | null; phone_number: string | null } | null
  latest_diary_at: string | null
  latest_diary_title: string | null
  latest_progress_total: number | null
  diary_recent_ok: boolean
  progress_stalled: boolean
  repeated_quality_blocked: boolean
  repeated_safety_incident: boolean
  capital_state: 'enough' | 'tight' | 'missing'
  cashflow_warning_level: string | null
  gap_30d: number | null
  demand_30d: number | null
  supply_30d: number | null
  labor_finance_summary?: {
    planned_cost: number
    planned_qty: number
    actual_cost: number
    actual_qty: number
    paid_amount: number
    payable_amount: number
    planned_gap_amount: number
    cash_gap_for_payable: number
    warning_state: string
  } | null
  asset_count: number
  warning_count: number
  warning_items: string[]
  upcoming_milestone?: { milestone_name: string; due_date?: string | null; status_key?: string | null } | null
  completed_milestone?: { milestone_name: string; completed_at?: string | null } | null
}

type Summary = {
  total_projects: number
  in_progress_count: number
  completed_count: number
  paused_count: number
  contract_total: number
  budget_current_total: number
  cost_actual_total: number
  warning_projects_count: number
  delay_projects_count: number
  capital_missing_count: number
  capital_tight_count: number
  diary_missing_count: number
  labor_missing_count: number
}

type Breakdown = {
  by_status: Array<{ status: string; count: number; contract_value: number }>
  by_risk_level: Array<{ risk_level: string; count: number }>
  top_warning_projects: ReportRow[]
  top_capital_gap_projects: ReportRow[]
}

function fmtVnd(v?: number | null) {
  if (v == null) return '-'
  return `${Number(v).toLocaleString('vi-VN')} đ`
}

function fmtDate(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('vi-VN')
}

function statusLabel(value?: string | null) {
  switch (value) {
    case 'draft': return 'Nháp'
    case 'confirmed': return 'Đã xác nhận'
    case 'in_progress': return 'Đang thi công'
    case 'completed': return 'Hoàn thành'
    case 'paused': return 'Tạm ngưng'
    case 'cancelled': return 'Đã hủy'
    default: return value || '-'
  }
}

function riskLabel(value?: string | null) {
  switch (value) {
    case 'low': return 'Thấp'
    case 'medium': return 'Trung bình'
    case 'high': return 'Cao'
    case 'critical': return 'Rất cao'
    case 'none': return 'Chưa gán'
    default: return value || '-'
  }
}

function capitalStateLabel(value?: string | null) {
  switch (value) {
    case 'missing': return 'Thiếu vốn'
    case 'tight': return 'Sắp thiếu vốn'
    default: return 'Đủ vốn'
  }
}

function capitalStateColor(value?: string | null) {
  switch (value) {
    case 'missing': return 'var(--red)'
    case 'tight': return 'var(--orange)'
    default: return 'var(--green)'
  }
}

function laborWarningLabel(value?: string | null) {
  switch (value) {
    case 'missing': return 'Thiếu tiền trả công'
    case 'tight': return 'Sắp thiếu tiền trả công'
    default: return 'Đủ tiền trả công'
  }
}

export default function ProjectReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: '',
    house_type: '',
    risk_level: '',
    capital_state: '',
    issue_only: false,
  })

  async function load() {
    setLoading(true)
    const qs = new URLSearchParams({ limit: '400' })
    if (filters.status) qs.set('status', filters.status)
    if (filters.house_type) qs.set('house_type', filters.house_type)
    if (filters.risk_level) qs.set('risk_level', filters.risk_level)
    if (filters.capital_state) qs.set('capital_state', filters.capital_state)
    if (filters.issue_only) qs.set('issue_only', '1')
    const res = await fetch(`/api/projects/reports?${qs.toString()}`, { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    setRows(Array.isArray(json?.data) ? json.data : [])
    setSummary(json?.summary || null)
    setBreakdown(json?.breakdown || null)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [filters])

  const houseTypeOptions = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) {
      if (row.house_type) set.add(row.house_type)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))
  }, [rows])

  const warningRows = useMemo(() => [...rows].filter((x) => x.warning_count > 0).sort((a, b) => b.warning_count - a.warning_count), [rows])

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>DỰ ÁN / BÁO CÁO</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Báo cáo quản trị dự án</h1>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text3)' }}>
            Tập trung vào tiến độ, tài chính và cảnh báo vận hành trên toàn bộ danh mục dự án
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn-ghost" href="/projects">Danh sách dự án</Link>
          <Link className="btn-ghost" href="/projects/dashboard">Dashboard dự án</Link>
          <Link className="btn-ghost" href="/projects/diary-manager">Giám sát nhật ký</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Bộ lọc báo cáo</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(170px, 1fr))', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Trạng thái dự án</div>
            <select className="select" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
              <option value="">Tất cả trạng thái</option>
              <option value="draft">Nháp</option>
              <option value="confirmed">Đã xác nhận</option>
              <option value="in_progress">Đang thi công</option>
              <option value="completed">Hoàn thành</option>
              <option value="paused">Tạm ngưng</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Loại nhà</div>
            <select className="select" value={filters.house_type} onChange={(e) => setFilters((p) => ({ ...p, house_type: e.target.value }))}>
              <option value="">Tất cả loại nhà</option>
              {houseTypeOptions.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mức độ rủi ro</div>
            <select className="select" value={filters.risk_level} onChange={(e) => setFilters((p) => ({ ...p, risk_level: e.target.value }))}>
              <option value="">Tất cả mức độ</option>
              <option value="low">Thấp</option>
              <option value="medium">Trung bình</option>
              <option value="high">Cao</option>
              <option value="critical">Rất cao</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tình trạng vốn</div>
            <select className="select" value={filters.capital_state} onChange={(e) => setFilters((p) => ({ ...p, capital_state: e.target.value }))}>
              <option value="">Tất cả tình trạng</option>
              <option value="enough">Đủ vốn</option>
              <option value="tight">Sắp thiếu vốn</option>
              <option value="missing">Thiếu vốn</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, minHeight: 36 }}>
              <input type="checkbox" checked={filters.issue_only} onChange={(e) => setFilters((p) => ({ ...p, issue_only: e.target.checked }))} />
              Chỉ hiện dự án có cảnh báo
            </label>
          </div>
        </div>
        <div>
          <button className="btn-ghost" onClick={() => setFilters({ status: '', house_type: '', risk_level: '', capital_state: '', issue_only: false })}>
            Xóa toàn bộ lọc
          </button>
        </div>
      </div>

      {loading ? <div className="card" style={{ padding: 20 }}>Đang tải báo cáo...</div> : null}

      {!loading && summary ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
            <div className="card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Tổng số dự án</div><div style={{ fontSize: 20, fontWeight: 800 }}>{summary.total_projects.toLocaleString('vi-VN')}</div></div>
            <div className="card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Đang thi công</div><div style={{ fontSize: 20, fontWeight: 800 }}>{summary.in_progress_count.toLocaleString('vi-VN')}</div></div>
            <div className="card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Hoàn thành</div><div style={{ fontSize: 20, fontWeight: 800 }}>{summary.completed_count.toLocaleString('vi-VN')}</div></div>
            <div className="card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Tạm ngưng</div><div style={{ fontSize: 20, fontWeight: 800 }}>{summary.paused_count.toLocaleString('vi-VN')}</div></div>
            <div className="card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Tổng giá trị hợp đồng</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmtVnd(summary.contract_total)}</div></div>
            <div className="card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Tổng ngân sách hiện tại</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmtVnd(summary.budget_current_total)}</div></div>
            <div className="card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Tổng chi phí thực tế</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmtVnd(summary.cost_actual_total)}</div></div>
            <div className="card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Dự án có cảnh báo</div><div style={{ fontSize: 20, fontWeight: 800, color: summary.warning_projects_count > 0 ? 'var(--orange)' : 'var(--text)' }}>{summary.warning_projects_count.toLocaleString('vi-VN')}</div></div>
            <div className="card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Dự án trễ tiến độ</div><div style={{ fontSize: 20, fontWeight: 800, color: summary.delay_projects_count > 0 ? 'var(--red)' : 'var(--text)' }}>{summary.delay_projects_count.toLocaleString('vi-VN')}</div></div>
            <div className="card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Thiếu vốn 30 ngày</div><div style={{ fontSize: 20, fontWeight: 800, color: summary.capital_missing_count > 0 ? 'var(--red)' : 'var(--text)' }}>{summary.capital_missing_count.toLocaleString('vi-VN')}</div></div>
            <div className="card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Sắp thiếu vốn</div><div style={{ fontSize: 20, fontWeight: 800, color: summary.capital_tight_count > 0 ? 'var(--orange)' : 'var(--text)' }}>{summary.capital_tight_count.toLocaleString('vi-VN')}</div></div>
            <div className="card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Thiếu nhật ký 3 ngày</div><div style={{ fontSize: 20, fontWeight: 800, color: summary.diary_missing_count > 0 ? 'var(--orange)' : 'var(--text)' }}>{summary.diary_missing_count.toLocaleString('vi-VN')}</div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Phân bổ theo trạng thái</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {(breakdown?.by_status || []).map((item) => (
                  <div key={item.status} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 12 }}>{statusLabel(item.status)}</div>
                    <div style={{ fontWeight: 700 }}>{item.count.toLocaleString('vi-VN')} dự án</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtVnd(item.contract_value)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Top dự án nhiều cảnh báo</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {(breakdown?.top_warning_projects || []).map((item) => (
                  <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontWeight: 700 }}>{item.project_name || item.id}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{item.warning_count} cảnh báo | Trễ {item.delay_days || 0} ngày</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{item.warning_items.slice(0, 2).join(' | ') || 'Không có chi tiết'}</div>
                  </div>
                ))}
                {!(breakdown?.top_warning_projects || []).length ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Không có dự án cảnh báo cao.</div> : null}
              </div>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Top dự án thiếu vốn 30 ngày</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {(breakdown?.top_capital_gap_projects || []).map((item) => (
                  <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontWeight: 700 }}>{item.project_name || item.id}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Chênh lệch 30 ngày: <span style={{ color: 'var(--red)' }}>{fmtVnd(item.gap_30d)}</span></div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Nhu cầu: {fmtVnd(item.demand_30d)} | Cung ứng: {fmtVnd(item.supply_30d)}</div>
                  </div>
                ))}
                {!(breakdown?.top_capital_gap_projects || []).length ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Không có dự án thiếu vốn theo snapshot gần nhất.</div> : null}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Bảng chi tiết quản trị dự án</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  Theo dõi tiến độ, tài chính, nhật ký và nhân công ở cùng một bảng
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{rows.length.toLocaleString('vi-VN')} dự án</div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1600 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <th style={thStyle}>Dự án</th>
                    <th style={thStyle}>Khách hàng</th>
                    <th style={thStyle}>Trạng thái</th>
                    <th style={thStyle}>Tiến độ KH / TT</th>
                    <th style={thStyle}>Trễ (ngày)</th>
                    <th style={thStyle}>Mốc gần</th>
                    <th style={thStyle}>Giá trị HĐ</th>
                    <th style={thStyle}>Ngân sách hiện tại</th>
                    <th style={thStyle}>Chi phí thực tế</th>
                    <th style={thStyle}>Tình trạng vốn</th>
                    <th style={thStyle}>Còn phải trả công</th>
                    <th style={thStyle}>Nhật ký gần nhất</th>
                    <th style={thStyle}>Tài sản</th>
                    <th style={thStyle}>Cảnh báo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 700 }}>{row.project_name || row.id.slice(0, 8)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.house_type || '-'} | {row.floors ?? '-'} tầng | {row.floor_area ? `${row.floor_area} m²` : '-'}</div>
                        <div style={{ marginTop: 6 }}>
                          <Link className="btn-ghost" href={`/projects/${row.id}/overview`}>Overview</Link>
                        </div>
                      </td>
                      <td style={tdStyle}>{row.customer?.full_name || row.customer?.phone_number || '-'}</td>
                      <td style={tdStyle}>
                        <div>{statusLabel(row.status)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Rủi ro: {riskLabel(row.risk_level)}</div>
                      </td>
                      <td style={tdStyle}>
                        <div>Kế hoạch: {row.progress_planned_percent ?? '-'}%</div>
                        <div>Thực tế: {row.progress_actual_percent ?? row.latest_progress_total ?? '-'}%</div>
                        {row.progress_stalled ? <div style={{ fontSize: 11, color: 'var(--orange)' }}>Tiến độ đang đứng yên</div> : null}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: Number(row.delay_days || 0) > 0 ? 'var(--red)' : 'var(--text3)' }}>{row.delay_days ?? 0}</span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 700 }}>{row.upcoming_milestone?.milestone_name || row.completed_milestone?.milestone_name || '-'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {row.upcoming_milestone?.due_date ? `Hạn: ${fmtDate(row.upcoming_milestone.due_date)}` : row.completed_milestone?.completed_at ? `Xong: ${fmtDate(row.completed_milestone.completed_at)}` : '-'}
                        </div>
                      </td>
                      <td style={tdStyle}>{fmtVnd(row.contract_value)}</td>
                      <td style={tdStyle}>{fmtVnd(row.budget_current)}</td>
                      <td style={tdStyle}>{fmtVnd(row.cost_actual)}</td>
                      <td style={tdStyle}>
                        <div style={{ color: capitalStateColor(row.capital_state), fontWeight: 700 }}>{capitalStateLabel(row.capital_state)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Chênh lệch 30 ngày: {fmtVnd(row.gap_30d)}</div>
                      </td>
                      <td style={tdStyle}>
                        <div>{fmtVnd(row.labor_finance_summary?.payable_amount || 0)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{laborWarningLabel(row.labor_finance_summary?.warning_state)}</div>
                      </td>
                      <td style={tdStyle}>
                        <div>{fmtDate(row.latest_diary_at)}</div>
                        <div style={{ fontSize: 11, color: row.diary_recent_ok ? 'var(--text3)' : 'var(--orange)' }}>{row.diary_recent_ok ? 'Đã cập nhật gần đây' : 'Thiếu nhật ký 3 ngày'}</div>
                      </td>
                      <td style={tdStyle}>{row.asset_count.toLocaleString('vi-VN')}</td>
                      <td style={tdStyle}>
                        {row.warning_items.length ? (
                          <div style={{ display: 'grid', gap: 4 }}>
                            {row.warning_items.slice(0, 3).map((warning) => (
                              <div key={warning} style={{ fontSize: 11, color: 'var(--orange)' }}>{warning}</div>
                            ))}
                            {row.warning_items.length > 3 ? <div style={{ fontSize: 11, color: 'var(--text3)' }}>+ {row.warning_items.length - 3} cảnh báo khác</div> : null}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--green)' }}>Không có cảnh báo</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td style={tdStyle} colSpan={14}>Không có dự án phù hợp với bộ lọc hiện tại.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: 8,
  fontSize: 12,
  whiteSpace: 'nowrap',
  verticalAlign: 'top',
}

const tdStyle: CSSProperties = {
  padding: 8,
  fontSize: 12,
  verticalAlign: 'top',
}
