'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type ProjectOption = {
  id: string
  project_name: string
  customer?: {
    id?: string
    full_name?: string | null
  } | null
}

type CustomerOption = {
  id: string
  full_name: string
}

type StatusBreakdown = {
  status: string
  count: number
  contract_value: number
}

type RiskBreakdown = {
  risk_level: string
  count: number
}

type ProjectRow = {
  id: string
  project_name: string
  status?: string | null
  gap_30d?: number
  receivable_30d?: number
  payable_30d?: number
  warning_level?: string | null
  labor_payable_amount?: number
  labor_paid_amount?: number
  labor_actual_cost?: number
  cost_actual?: number
}

type ReceivableRow = {
  project_id: string
  project_name: string
  customer_name?: string | null
  milestone_name: string
  due_date?: string | null
  amount: number
  paid_amount?: number
  remaining_amount: number
  days_to_due?: number | null
  bucket?: string
}

type DashboardData = {
  filters?: {
    status?: string | null
    issue_only?: boolean
    receivable_bucket?: string | null
    project_id?: string | null
    customer_id?: string | null
  }
  summary?: {
    project_count: number
    active_project_count: number
    contract_total: number
    budget_current_total: number
    cost_actual_total: number
    cash_on_hand_total: number
    receivable_30d_total: number
    payable_30d_total: number
    gap_30d_total: number
    labor_payable_total: number
    payment_received_mtd_total: number
    labor_paid_mtd_total: number
    capital_missing_count: number
    capital_tight_count: number
    warning_project_count: number
  }
  breakdown?: {
    by_status: StatusBreakdown[]
    by_risk_level: RiskBreakdown[]
  }
  receivable_aging_summary?: {
    total: number
    chua_den_han: number
    qua_han_1_7: number
    qua_han_8_30: number
    qua_han_tren_30: number
    khong_xac_dinh: number
  }
  top_capital_gap_projects: ProjectRow[]
  top_receivables_due: ReceivableRow[]
  receivable_aging_rows: ReceivableRow[]
  top_labor_payables: ProjectRow[]
  top_cost_actual_projects: ProjectRow[]
}

const EMPTY_SUMMARY = {
  project_count: 0,
  active_project_count: 0,
  contract_total: 0,
  budget_current_total: 0,
  cost_actual_total: 0,
  cash_on_hand_total: 0,
  receivable_30d_total: 0,
  payable_30d_total: 0,
  gap_30d_total: 0,
  labor_payable_total: 0,
  payment_received_mtd_total: 0,
  labor_paid_mtd_total: 0,
  capital_missing_count: 0,
  capital_tight_count: 0,
  warning_project_count: 0,
}

function formatMoney(value?: number | null) {
  const num = Number(value || 0)
  return `${num.toLocaleString('vi-VN')} vnd`
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('vi-VN')
}

function statusLabel(value?: string | null) {
  switch (value) {
    case 'draft': return 'Nháp'
    case 'confirmed': return 'Đã xác nhận'
    case 'in_progress': return 'Đang thi công'
    case 'paused': return 'Tạm dừng'
    case 'completed': return 'Hoàn thành'
    case 'cancelled': return 'Đã hủy'
    default: return value || '-'
  }
}

function warningLabel(value?: string | null) {
  switch (value) {
    case 'critical': return 'Thiếu vốn'
    case 'high': return 'Sắp thiếu vốn'
    default: return 'Đủ vốn'
  }
}

function riskLabel(value?: string | null) {
  switch (value) {
    case 'low': return 'Thấp'
    case 'medium': return 'Trung bình'
    case 'high': return 'Cao'
    case 'critical': return 'Rất cao'
    default: return 'Chưa gán'
  }
}

function receivableBucketLabel(value?: string | null) {
  switch (value) {
    case 'chua_den_han': return 'Chưa đến hạn'
    case 'qua_han_1_7': return 'Quá hạn 1-7 ngày'
    case 'qua_han_8_30': return 'Quá hạn 8-30 ngày'
    case 'qua_han_tren_30': return 'Quá hạn trên 30 ngày'
    default: return 'Chưa xác định hạn'
  }
}

function receivableBucketBadgeStyle(value?: string | null): React.CSSProperties {
  if (value === 'qua_han_tren_30') return { background: 'rgba(239,68,68,0.16)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.45)' }
  if (value === 'qua_han_8_30') return { background: 'rgba(249,115,22,0.16)', color: '#fdba74', border: '1px solid rgba(249,115,22,0.45)' }
  if (value === 'qua_han_1_7') return { background: 'rgba(245,158,11,0.16)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.45)' }
  if (value === 'chua_den_han') return { background: 'rgba(34,197,94,0.14)', color: '#86efac', border: '1px solid rgba(34,197,94,0.35)' }
  return { background: 'rgba(148,163,184,0.14)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.35)' }
}

function numberColor(value?: number | null) {
  return Number(value || 0) < 0 ? 'var(--red)' : 'var(--green)'
}

function formatPercentFromAmounts(paid?: number | null, total?: number | null) {
  const totalNum = Number(total || 0)
  const paidNum = Number(paid || 0)
  if (totalNum <= 0) return '-'
  const pct = Math.max(0, Math.min(100, (paidNum / totalNum) * 100))
  return `${pct.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
}

function escapeHtml(value: string) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function openPrintHtml(html: string) {
  const popup = window.open('', '_blank', 'width=1120,height=820')
  if (!popup) return
  popup.document.open()
  popup.document.write(html)
  popup.document.close()
  popup.focus()
  popup.print()
}

export default function AccountingDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [showReceivablePercent, setShowReceivablePercent] = useState(false)
  const [data, setData] = useState<DashboardData>({
    top_capital_gap_projects: [],
    top_receivables_due: [],
    receivable_aging_rows: [],
    top_labor_payables: [],
    top_cost_actual_projects: [],
  })
  const [filters, setFilters] = useState({
    status: '',
    issue_only: false,
    receivable_bucket: '',
    project_id: '',
    customer_id: '',
  })

  async function loadProjects() {
    const res = await fetch('/api/projects?limit=300', { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    setProjects(Array.isArray(json?.data) ? json.data : [])
  }

  async function loadDashboard(nextFilters = filters) {
    setLoading(true)
    try {
      const sp = new URLSearchParams()
      if (nextFilters.status) sp.set('status', nextFilters.status)
      if (nextFilters.issue_only) sp.set('issue_only', '1')
      if (nextFilters.receivable_bucket) sp.set('receivable_bucket', nextFilters.receivable_bucket)
      if (nextFilters.project_id) sp.set('project_id', nextFilters.project_id)
      if (nextFilters.customer_id) sp.set('customer_id', nextFilters.customer_id)
      const res = await fetch(`/api/accounting/dashboard?${sp.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast(json?.error || 'Không tải được dashboard kế toán')
        return
      }
      setData({
        filters: json?.filters || {},
        summary: json?.summary || EMPTY_SUMMARY,
        breakdown: json?.breakdown || { by_status: [], by_risk_level: [] },
        receivable_aging_summary: json?.receivable_aging_summary || undefined,
        top_capital_gap_projects: Array.isArray(json?.top_capital_gap_projects) ? json.top_capital_gap_projects : [],
        top_receivables_due: Array.isArray(json?.top_receivables_due) ? json.top_receivables_due : [],
        receivable_aging_rows: Array.isArray(json?.receivable_aging_rows) ? json.receivable_aging_rows : [],
        top_labor_payables: Array.isArray(json?.top_labor_payables) ? json.top_labor_payables : [],
        top_cost_actual_projects: Array.isArray(json?.top_cost_actual_projects) ? json.top_cost_actual_projects : [],
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProjects()
    void loadDashboard()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const summary = data.summary || EMPTY_SUMMARY
  const statusRows = useMemo(() => data.breakdown?.by_status || [], [data.breakdown])
  const riskRows = useMemo(() => data.breakdown?.by_risk_level || [], [data.breakdown])
  const customers = useMemo(() => {
    const map = new Map<string, CustomerOption>()
    for (const project of projects) {
      const id = String(project.customer?.id || '').trim()
      const name = String(project.customer?.full_name || '').trim()
      if (!id || !name || map.has(id)) continue
      map.set(id, { id, full_name: name })
    }
    return Array.from(map.values()).sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'))
  }, [projects])
  const projectOptions = useMemo(() => {
    if (!filters.customer_id) return projects
    return projects.filter((project) => String(project.customer?.id || '') === filters.customer_id)
  }, [projects, filters.customer_id])
  const aging = data.receivable_aging_summary || {
    total: 0,
    chua_den_han: 0,
    qua_han_1_7: 0,
    qua_han_8_30: 0,
    qua_han_tren_30: 0,
    khong_xac_dinh: 0,
  }

  const cardStyle: React.CSSProperties = {
    padding: 12,
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'var(--panel)',
  }

  const tableHeadStyle: React.CSSProperties = {
    textAlign: 'left',
    fontSize: 11,
    color: 'var(--text3)',
    padding: '8px 10px',
    borderBottom: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.02)',
  }

  const tableCellStyle: React.CSSProperties = {
    padding: '9px 10px',
    borderBottom: '1px solid var(--border)',
    fontSize: 12,
    verticalAlign: 'top',
  }

  function printReceivableReport() {
    const rows = data.receivable_aging_rows || []
    const selectedCustomerName = customers.find((row) => row.id === filters.customer_id)?.full_name || 'Tất cả chủ đầu tư'
    const selectedProjectName = projects.find((row) => row.id === filters.project_id)?.project_name || 'Tất cả dự án'
    const htmlRows = rows.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.project_name || '-')}</td>
        <td>${escapeHtml(row.customer_name || '-')}</td>
        <td>${escapeHtml(row.milestone_name || '-')}</td>
        <td>${escapeHtml(formatDate(row.due_date))}</td>
        <td>${escapeHtml(receivableBucketLabel(row.bucket))}</td>
        <td style="text-align:right">${escapeHtml(formatMoney(row.remaining_amount))}</td>
      </tr>
    `).join('')
    const html = `
      <html>
        <head>
          <title>Công nợ chủ đầu tư theo hạn thanh toán</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { font-family: Arial, sans-serif; color: #111827; }
            .title { text-align: center; margin-bottom: 16px; }
            .title h1 { margin: 0; font-size: 24px; text-transform: uppercase; }
            .title .sub { margin-top: 4px; font-size: 13px; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; margin-bottom: 12px; font-size: 13px; }
            .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 12px; }
            .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; }
            .label { font-size: 12px; color: #6b7280; }
            .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px 10px; font-size: 12px; vertical-align: top; }
            th { background: #f3f4f6; text-align: left; }
          </style>
        </head>
        <body>
          <div class="title">
            <h1>Công nợ chủ đầu tư theo hạn thanh toán</h1>
            <div class="sub">Báo cáo công nợ phải thu theo nhóm thời gian</div>
          </div>
          <div class="meta-grid">
            <div><b>Chủ đầu tư:</b> ${escapeHtml(selectedCustomerName)}</div>
            <div><b>Dự án:</b> ${escapeHtml(selectedProjectName)}</div>
            <div><b>Nhóm công nợ:</b> ${escapeHtml(filters.receivable_bucket ? receivableBucketLabel(filters.receivable_bucket) : 'Tất cả')}</div>
            <div><b>Ngày in:</b> ${escapeHtml(new Date().toLocaleDateString('vi-VN'))}</div>
          </div>
          <div class="summary">
            <div class="card"><div class="label">Tổng công nợ</div><div class="value">${escapeHtml(formatMoney(aging.total))}</div></div>
            <div class="card"><div class="label">Chưa đến hạn</div><div class="value">${escapeHtml(formatMoney(aging.chua_den_han))}</div></div>
            <div class="card"><div class="label">Quá hạn 1-7 ngày</div><div class="value">${escapeHtml(formatMoney(aging.qua_han_1_7))}</div></div>
            <div class="card"><div class="label">Quá hạn 8-30 ngày</div><div class="value">${escapeHtml(formatMoney(aging.qua_han_8_30))}</div></div>
            <div class="card"><div class="label">Quá hạn trên 30 ngày</div><div class="value">${escapeHtml(formatMoney(aging.qua_han_tren_30))}</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:48px">STT</th>
                <th>Dự án</th>
                <th>Chủ đầu tư</th>
                <th>Mốc thanh toán</th>
                <th style="width:120px">Hạn thanh toán</th>
                <th style="width:160px">Nhóm thời gian</th>
                <th style="width:160px">Còn phải thu</th>
              </tr>
            </thead>
            <tbody>
              ${htmlRows || '<tr><td colspan="7">Không có dữ liệu.</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `
    openPrintHtml(html)
  }

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)' }}>KẾ TOÁN</div>
          <h1 style={{ margin: '4px 0', fontSize: 22, fontWeight: 800 }}>Dashboard tài chính điều hành</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 860 }}>
            Trang này giúp nhìn nhanh sức khỏe tài chính theo dự án: dự kiến thu, dự kiến chi, thiếu vốn 30 ngày,
            chi phí thực tế và các khoản phải trả nhân công. Đây là dashboard điều hành theo dữ liệu dự án hiện có,
            chưa phải sổ cái kế toán tổng.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn-ghost" href="/accounting/labor-payroll">Mở báo cáo công</Link>
          <Link className="btn-ghost" href="/projects/reports">Mở báo cáo dự án</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Bộ lọc dashboard</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Trạng thái dự án</div>
            <select className="select" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="">Tất cả trạng thái</option>
              <option value="draft">Nháp</option>
              <option value="confirmed">Đã xác nhận</option>
              <option value="in_progress">Đang thi công</option>
              <option value="paused">Tạm dừng</option>
              <option value="completed">Hoàn thành</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Chủ đầu tư</div>
            <select className="select" value={filters.customer_id} onChange={(e) => setFilters((prev) => ({ ...prev, customer_id: e.target.value, project_id: '' }))}>
              <option value="">Tất cả chủ đầu tư</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Dự án cụ thể</div>
            <select className="select" value={filters.project_id} onChange={(e) => setFilters((prev) => ({ ...prev, project_id: e.target.value }))}>
              <option value="">Tất cả dự án</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>{project.project_name}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Nhóm công nợ chủ đầu tư</div>
            <select className="select" value={filters.receivable_bucket} onChange={(e) => setFilters((prev) => ({ ...prev, receivable_bucket: e.target.value }))}>
              <option value="">Tất cả nhóm thời gian</option>
              <option value="chua_den_han">Chưa đến hạn</option>
              <option value="qua_han_1_7">Quá hạn 1-7 ngày</option>
              <option value="qua_han_8_30">Quá hạn 8-30 ngày</option>
              <option value="qua_han_tren_30">Quá hạn trên 30 ngày</option>
              <option value="khong_xac_dinh">Chưa xác định hạn</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={filters.issue_only}
              onChange={(e) => setFilters((prev) => ({ ...prev, issue_only: e.target.checked }))}
            />
            Chỉ hiện dự án có cảnh báo
          </label>
          <button className="btn-primary" onClick={() => void loadDashboard(filters)}>Xem dashboard</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Tổng giá trị hợp đồng</div><div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(summary.contract_total)}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Tổng ngân sách hiện tại</div><div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(summary.budget_current_total)}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Tổng chi phí thực tế</div><div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(summary.cost_actual_total)}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Nguồn tiền đang theo dõi</div><div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(summary.cash_on_hand_total)}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Dự kiến thu 30 ngày</div><div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(summary.receivable_30d_total)}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Dự kiến chi 30 ngày</div><div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(summary.payable_30d_total)}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Chênh lệch 30 ngày</div><div style={{ fontSize: 22, fontWeight: 800, color: numberColor(summary.gap_30d_total) }}>{summary.gap_30d_total > 0 ? '+' : ''}{formatMoney(summary.gap_30d_total)}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Còn phải trả nhân công</div><div style={{ fontSize: 22, fontWeight: 800, color: Number(summary.labor_payable_total || 0) > 0 ? 'var(--orange)' : 'var(--green)' }}>{formatMoney(summary.labor_payable_total)}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Thu đã ghi nhận tháng này</div><div style={{ fontSize: 20, fontWeight: 800 }}>{formatMoney(summary.payment_received_mtd_total)}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Chi nhân công tháng này</div><div style={{ fontSize: 20, fontWeight: 800 }}>{formatMoney(summary.labor_paid_mtd_total)}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Dự án thiếu vốn</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)' }}>{summary.capital_missing_count}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Dự án sắp thiếu vốn</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--orange)' }}>{summary.capital_tight_count}</div></div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700 }}>Công nợ chủ đầu tư theo hạn thanh toán</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Chia các khoản còn phải thu theo nhóm thời gian để biết khoản nào chưa đến hạn, khoản nào đang quá hạn.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Tổng công nợ đang mở: <b style={{ color: 'var(--text2)' }}>{formatMoney(aging.total)}</b>
            </div>
            <button className="btn-ghost" onClick={printReceivableReport}>In / xuất PDF công nợ</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
          <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Chưa đến hạn</div><div style={{ fontSize: 18, fontWeight: 800 }}>{formatMoney(aging.chua_den_han)}</div></div>
          <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Quá hạn 1-7 ngày</div><div style={{ fontSize: 18, fontWeight: 800, color: Number(aging.qua_han_1_7 || 0) > 0 ? 'var(--orange)' : 'var(--text2)' }}>{formatMoney(aging.qua_han_1_7)}</div></div>
          <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Quá hạn 8-30 ngày</div><div style={{ fontSize: 18, fontWeight: 800, color: Number(aging.qua_han_8_30 || 0) > 0 ? 'var(--orange)' : 'var(--text2)' }}>{formatMoney(aging.qua_han_8_30)}</div></div>
          <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Quá hạn trên 30 ngày</div><div style={{ fontSize: 18, fontWeight: 800, color: Number(aging.qua_han_tren_30 || 0) > 0 ? 'var(--red)' : 'var(--text2)' }}>{formatMoney(aging.qua_han_tren_30)}</div></div>
          <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Chưa xác định hạn</div><div style={{ fontSize: 18, fontWeight: 800 }}>{formatMoney(aging.khong_xac_dinh)}</div></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Cơ cấu theo trạng thái dự án</div>
          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={tableHeadStyle}>Trạng thái</th>
                  <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Số dự án</th>
                  <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Giá trị hợp đồng</th>
                </tr>
              </thead>
              <tbody>
                {statusRows.map((row) => (
                  <tr key={row.status}>
                    <td style={tableCellStyle}>{statusLabel(row.status)}</td>
                    <td style={{ ...tableCellStyle, textAlign: 'right' }}>{row.count}</td>
                    <td style={{ ...tableCellStyle, textAlign: 'right' }}>{formatMoney(row.contract_value)}</td>
                  </tr>
                ))}
                {!statusRows.length ? <tr><td style={tableCellStyle} colSpan={3}>Chưa có dữ liệu.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Cơ cấu theo mức rủi ro</div>
          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={tableHeadStyle}>Mức rủi ro</th>
                  <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Số dự án</th>
                </tr>
              </thead>
              <tbody>
                {riskRows.map((row) => (
                  <tr key={row.risk_level}>
                    <td style={tableCellStyle}>{riskLabel(row.risk_level)}</td>
                    <td style={{ ...tableCellStyle, textAlign: 'right' }}>{row.count}</td>
                  </tr>
                ))}
                {!riskRows.length ? <tr><td style={tableCellStyle} colSpan={2}>Chưa có dữ liệu.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Dự án thiếu vốn / sắp thiếu vốn</div>
          <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={tableHeadStyle}>Dự án</th>
                  <th style={tableHeadStyle}>Mức cảnh báo</th>
                  <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Thu 30 ngày</th>
                  <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Chi 30 ngày</th>
                  <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Chênh lệch</th>
                </tr>
              </thead>
              <tbody>
                {data.top_capital_gap_projects.map((row) => (
                  <tr key={row.id}>
                    <td style={tableCellStyle}>
                      <div style={{ fontWeight: 700 }}>{row.project_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{statusLabel(row.status)}</div>
                    </td>
                    <td style={tableCellStyle}>{warningLabel(row.warning_level)}</td>
                    <td style={{ ...tableCellStyle, textAlign: 'right' }}>{formatMoney(row.receivable_30d)}</td>
                    <td style={{ ...tableCellStyle, textAlign: 'right' }}>{formatMoney(row.payable_30d)}</td>
                    <td style={{ ...tableCellStyle, textAlign: 'right', color: numberColor(row.gap_30d) }}>{Number(row.gap_30d || 0) > 0 ? '+' : ''}{formatMoney(row.gap_30d)}</td>
                  </tr>
                ))}
                {!data.top_capital_gap_projects.length ? <tr><td style={tableCellStyle} colSpan={5}>Không có dự án thiếu vốn trong bộ lọc hiện tại.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Top dự án chi phí thực tế cao</div>
          <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={tableHeadStyle}>Dự án</th>
                  <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Chi phí thực tế</th>
                </tr>
              </thead>
              <tbody>
                {data.top_cost_actual_projects.map((row) => (
                  <tr key={row.id}>
                    <td style={tableCellStyle}>{row.project_name}</td>
                    <td style={{ ...tableCellStyle, textAlign: 'right' }}>{formatMoney(row.cost_actual)}</td>
                  </tr>
                ))}
                {!data.top_cost_actual_projects.length ? <tr><td style={tableCellStyle} colSpan={2}>Chưa có dữ liệu.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Khoản thu sắp đến hạn</div>
          <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
              <tr>
                <th style={tableHeadStyle}>Dự án / khách hàng</th>
                <th style={tableHeadStyle}>Mốc thu</th>
                <th style={tableHeadStyle}>Đến hạn</th>
                <th
                  style={{ ...tableHeadStyle, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setShowReceivablePercent((prev) => !prev)}
                  title="Bấm để đổi giữa số tiền và phần trăm đã thu"
                >
                  {showReceivablePercent ? '% đã thu' : 'Đã thu / Tổng mốc'}
                </th>
                <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Còn phải thu</th>
              </tr>
            </thead>
            <tbody>
                {data.top_receivables_due.map((row, index) => (
                  <tr key={`${row.project_id}-${index}`}>
                    <td style={tableCellStyle}>
                      <div style={{ fontWeight: 700 }}>{row.project_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.customer_name || '-'}</div>
                    </td>
                    <td style={tableCellStyle}>{row.milestone_name}</td>
                    <td style={tableCellStyle}>
                      <div>{formatDate(row.due_date)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {row.days_to_due != null ? `${row.days_to_due} ngày` : '-'}
                    </div>
                  </td>
                  <td style={{ ...tableCellStyle, textAlign: 'right', cursor: 'pointer' }} onClick={() => setShowReceivablePercent((prev) => !prev)} title="Bấm để đổi giữa số tiền và phần trăm đã thu">
                    {showReceivablePercent ? (
                      <div style={{ fontWeight: 700 }}>{formatPercentFromAmounts(row.paid_amount, row.amount)}</div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 700 }}>{formatMoney(row.paid_amount)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>/ {formatMoney(row.amount)}</div>
                      </>
                    )}
                  </td>
                  <td style={{ ...tableCellStyle, textAlign: 'right' }}>{formatMoney(row.remaining_amount)}</td>
                </tr>
              ))}
              {!data.top_receivables_due.length ? <tr><td style={tableCellStyle} colSpan={5}>Không có khoản thu sắp đến hạn.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Dự án còn phải trả nhân công</div>
          <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={tableHeadStyle}>Dự án</th>
                  <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Đã trả</th>
                  <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Còn phải trả</th>
                </tr>
              </thead>
              <tbody>
                {data.top_labor_payables.map((row) => (
                  <tr key={row.id}>
                    <td style={tableCellStyle}>
                      <div style={{ fontWeight: 700 }}>{row.project_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>Chi phí công: {formatMoney(row.labor_actual_cost)}</div>
                    </td>
                    <td style={{ ...tableCellStyle, textAlign: 'right' }}>{formatMoney(row.labor_paid_amount)}</td>
                    <td style={{ ...tableCellStyle, textAlign: 'right', color: Number(row.labor_payable_amount || 0) > 0 ? 'var(--orange)' : 'var(--green)' }}>
                      {formatMoney(row.labor_payable_amount)}
                    </td>
                  </tr>
                ))}
                {!data.top_labor_payables.length ? <tr><td style={tableCellStyle} colSpan={3}>Không có dự án đang nợ công.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginTop: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Chi tiết công nợ chủ đầu tư theo hạn thanh toán</div>
        <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeadStyle}>Dự án / chủ đầu tư</th>
                <th style={tableHeadStyle}>Mốc thanh toán</th>
                <th style={tableHeadStyle}>Hạn thanh toán</th>
                <th style={tableHeadStyle}>Nhóm thời gian</th>
                <th
                  style={{ ...tableHeadStyle, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setShowReceivablePercent((prev) => !prev)}
                  title="Bấm để đổi giữa số tiền và phần trăm đã thu"
                >
                  {showReceivablePercent ? '% đã thu' : 'Đã thu / Tổng mốc'}
                </th>
                <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Còn phải thu</th>
              </tr>
            </thead>
            <tbody>
              {data.receivable_aging_rows.map((row, index) => (
                <tr key={`${row.project_id}-${row.milestone_name}-${index}`}>
                  <td style={tableCellStyle}>
                    <Link href={`/projects/${row.project_id}/overview`} style={{ fontWeight: 700, color: 'var(--text2)', textDecoration: 'none' }}>
                      {row.project_name}
                    </Link>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.customer_name || '-'}</div>
                  </td>
                  <td style={tableCellStyle}>{row.milestone_name}</td>
                  <td style={tableCellStyle}>
                    <div>{formatDate(row.due_date)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {row.days_to_due == null ? '-' : row.days_to_due >= 0 ? `Còn ${row.days_to_due} ngày` : `Trễ ${Math.abs(row.days_to_due)} ngày`}
                    </div>
                  </td>
                  <td style={tableCellStyle}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, ...receivableBucketBadgeStyle(row.bucket) }}>
                      {receivableBucketLabel(row.bucket)}
                    </span>
                  </td>
                  <td style={{ ...tableCellStyle, textAlign: 'right', cursor: 'pointer' }} onClick={() => setShowReceivablePercent((prev) => !prev)} title="Bấm để đổi giữa số tiền và phần trăm đã thu">
                    {showReceivablePercent ? (
                      <div style={{ fontWeight: 700 }}>{formatPercentFromAmounts(row.paid_amount, row.amount)}</div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 700 }}>{formatMoney(row.paid_amount)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>/ {formatMoney(row.amount)}</div>
                      </>
                    )}
                  </td>
                  <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 700 }}>{formatMoney(row.remaining_amount)}</td>
                </tr>
              ))}
              {!data.receivable_aging_rows.length ? <tr><td style={tableCellStyle} colSpan={6}>Không có công nợ chủ đầu tư đang mở.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      {loading ? <div style={{ marginTop: 12, color: 'var(--text3)' }}>Đang tải dashboard...</div> : null}
      {toast ? (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
