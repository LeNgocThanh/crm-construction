'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Project = { id: string; project_name: string }

type DailyRow = {
  attendance_id: string
  attendance_date?: string | null
  shift_type?: string | null
  work_qty?: number | null
  amount?: number | null
  project_name?: string | null
  note?: string | null
  source_type?: string | null
  diary_title?: string | null
}

type WorkerRow = {
  worker_id: string
  worker_name: string
  worker_code: string
  worker_category?: string | null
  project_names: string[]
  attendance_count: number
  work_qty: number
  attendance_amount: number
  advance_amount: number
  payment_amount: number
  settlement_amount: number
  paid_total_period: number
  outstanding_amount: number
  overpaid_amount: number
  partial_batch_names?: string[]
  outstanding_note?: string | null
  daily_rows: DailyRow[]
}

type ReportData = {
  filters?: {
    project_id?: string | null
    project_name?: string | null
    worker_category?: string | null
    month?: string | null
    from?: string | null
    to?: string | null
  }
  totals?: {
    worker_count: number
    attendance_count: number
    work_qty: number
    attendance_amount: number
    advance_amount: number
    payment_amount: number
    settlement_amount: number
    paid_total_period: number
    outstanding_amount: number
  }
  workers: WorkerRow[]
}

function toInputDate(value: Date) {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toMonthInput(value: Date) {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function displayDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('vi-VN')
}

function formatMoney(value?: string | number | null) {
  if (value == null || value === '') return '-'
  const numberValue = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(numberValue)) return '-'
  return `${Number(numberValue).toLocaleString('vi-VN')} vnd`
}

function shiftLabel(value?: string | null) {
  switch (value) {
    case 'morning': return 'Buổi sáng'
    case 'afternoon': return 'Buổi chiều'
    case 'night': return 'Ban đêm'
    case 'full_day': return 'Cả ngày'
    default: return value || '-'
  }
}

function workerCategoryLabel(value?: string | null) {
  switch (value) {
    case 'company': return 'Nhân công công ty'
    case 'external': return 'Nhân công thuê ngoài'
    default: return 'Chưa phân loại'
  }
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

const TODAY = new Date()
const DEFAULT_MONTH = toMonthInput(TODAY)
const DEFAULT_FROM = toInputDate(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1))
const DEFAULT_TO = toInputDate(new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0))

export default function AccountingLaborPayrollPage() {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [data, setData] = useState<ReportData>({ workers: [] })
  const [expandedWorkerId, setExpandedWorkerId] = useState('')
  const [filters, setFilters] = useState({
    period_mode: 'month',
    month: DEFAULT_MONTH,
    from: DEFAULT_FROM,
    to: DEFAULT_TO,
    project_id: '',
    worker_category: '',
  })

  async function loadProjects() {
    const res = await fetch('/api/projects?limit=300')
    const json = await res.json().catch(() => ({}))
    setProjects(Array.isArray(json?.data) ? json.data : [])
  }

  async function loadReport(nextFilters = filters) {
    setLoading(true)
    try {
      const sp = new URLSearchParams()
      if (nextFilters.project_id) sp.set('project_id', nextFilters.project_id)
      if (nextFilters.worker_category) sp.set('worker_category', nextFilters.worker_category)
      if (nextFilters.period_mode === 'month' && nextFilters.month) {
        sp.set('month', nextFilters.month)
      } else {
        if (nextFilters.from) sp.set('from', nextFilters.from)
        if (nextFilters.to) sp.set('to', nextFilters.to)
      }
      const res = await fetch(`/api/accounting/labor-payroll?${sp.toString()}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast(json?.error || 'Không tải được báo cáo công nhân công')
        setData({ workers: [] })
        return
      }
      setData({
        filters: json?.filters || {},
        totals: json?.totals || undefined,
        workers: Array.isArray(json?.workers) ? json.workers : [],
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProjects()
    void loadReport()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const totals = data.totals || {
    worker_count: 0,
    attendance_count: 0,
    work_qty: 0,
    attendance_amount: 0,
    advance_amount: 0,
    payment_amount: 0,
    settlement_amount: 0,
    paid_total_period: 0,
    outstanding_amount: 0,
  }

  const selectedProjectName = useMemo(
    () => projects.find((row) => row.id === filters.project_id)?.project_name || 'Tất cả dự án',
    [projects, filters.project_id]
  )

  function printReport(includeSignatureColumn: boolean) {
    const rows = data.workers || []
    const detailRows = rows.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.worker_name)}</td>
        <td>${escapeHtml(row.worker_code || '-')}</td>
        <td>${escapeHtml(workerCategoryLabel(row.worker_category))}</td>
        <td style="text-align:right">${Number(row.work_qty || 0).toLocaleString('vi-VN')}</td>
        <td style="text-align:right">${escapeHtml(formatMoney(row.attendance_amount))}</td>
        <td style="text-align:right">${escapeHtml(formatMoney(row.advance_amount))}</td>
        <td style="text-align:right">${escapeHtml(formatMoney(row.payment_amount))}</td>
        <td style="text-align:right">${escapeHtml(formatMoney(row.settlement_amount))}</td>
        <td style="text-align:right">${escapeHtml(formatMoney(row.outstanding_amount))}</td>
        ${includeSignatureColumn ? '<td></td>' : ''}
      </tr>
    `).join('')

    const html = `
      <html>
        <head>
          <title>Báo cáo công nhân công</title>
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
            .value { font-size: 20px; font-weight: 700; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px 10px; font-size: 12px; vertical-align: top; }
            th { background: #f3f4f6; text-align: left; }
            .footer { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; text-align: center; }
            .sign-title { font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 42px; }
          </style>
        </head>
        <body>
          <div class="title">
            <h1>Báo cáo công nhân công</h1>
            <div class="sub">Góc nhìn kế toán theo thời gian</div>
          </div>

          <div class="meta-grid">
            <div><b>Dự án:</b> ${escapeHtml(selectedProjectName)}</div>
            <div><b>Loại nhân công:</b> ${escapeHtml(workerCategoryLabel(filters.worker_category || null))}</div>
            <div><b>Kỳ báo cáo:</b> ${escapeHtml(filters.period_mode === 'month' ? filters.month : `${filters.from} -> ${filters.to}`)}</div>
            <div><b>Số nhân công:</b> ${totals.worker_count}</div>
          </div>

          <div class="summary">
            <div class="card"><div class="label">Tổng công</div><div class="value">${Number(totals.work_qty || 0).toLocaleString('vi-VN')}</div></div>
            <div class="card"><div class="label">Tiền công</div><div class="value">${escapeHtml(formatMoney(totals.attendance_amount))}</div></div>
            <div class="card"><div class="label">Tạm ứng</div><div class="value">${escapeHtml(formatMoney(totals.advance_amount))}</div></div>
            <div class="card"><div class="label">Đã trả trong kỳ</div><div class="value">${escapeHtml(formatMoney(Number(totals.payment_amount || 0) + Number(totals.settlement_amount || 0)))}</div></div>
            <div class="card"><div class="label">Còn phải trả</div><div class="value">${escapeHtml(formatMoney(totals.outstanding_amount))}</div></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:48px">STT</th>
                <th>Nhân công</th>
                <th style="width:110px">Mã</th>
                <th style="width:140px">Loại</th>
                <th style="width:90px">Tổng công</th>
                <th style="width:140px">Tiền công</th>
                <th style="width:140px">Tạm ứng</th>
                <th style="width:140px">Thanh toán đợt</th>
                <th style="width:140px">Tất toán</th>
                <th style="width:140px">Còn phải trả</th>
                ${includeSignatureColumn ? '<th style="width:120px">Ký nhận</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${detailRows || `<tr><td colspan="${includeSignatureColumn ? 11 : 10}">Không có dữ liệu.</td></tr>`}
            </tbody>
          </table>

          <div class="footer">
            <div><div class="sign-title">Người lập</div></div>
            <div><div class="sign-title">Kế toán</div></div>
            <div><div class="sign-title">Người duyệt</div></div>
          </div>
        </body>
      </html>
    `

    openPrintHtml(html)
  }

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)' }}>KẾ TOÁN</div>
          <h1 style={{ margin: '4px 0 4px', fontSize: 22, fontWeight: 800 }}>Báo cáo công nhân công</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 760 }}>
            Báo cáo dành cho kế toán để xem tổng công, tiền công, tạm ứng, đã trả và số còn phải trả theo kỳ.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn-ghost" href="/labor/payments">Mở thanh toán công</Link>
          <Link className="btn-ghost" href="/labor/reports">Mở báo cáo vận hành</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Bộ lọc báo cáo</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Chế độ kỳ báo cáo</div>
            <select className="select" value={filters.period_mode} onChange={(e) => setFilters((p) => ({ ...p, period_mode: e.target.value }))}>
              <option value="month">Theo tháng</option>
              <option value="custom">Theo khoảng ngày</option>
            </select>
          </div>
          {filters.period_mode === 'month' ? (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tháng</div>
              <input className="input" type="month" value={filters.month} onChange={(e) => setFilters((p) => ({ ...p, month: e.target.value }))} />
            </div>
          ) : (
            <>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Từ ngày</div>
                <input className="input" type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đến ngày</div>
                <input className="input" type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} />
              </div>
            </>
          )}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Dự án</div>
            <select className="select" value={filters.project_id} onChange={(e) => setFilters((p) => ({ ...p, project_id: e.target.value }))}>
              <option value="">Tất cả dự án</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.project_name}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={() => void loadReport(filters)}>Xem báo cáo</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Loại nhân công</div>
            <select className="select" value={filters.worker_category} onChange={(e) => setFilters((p) => ({ ...p, worker_category: e.target.value }))}>
              <option value="">Tất cả loại nhân công</option>
              <option value="company">Nhân công công ty</option>
              <option value="external">Nhân công thuê ngoài</option>
            </select>
          </div>
          <div />
          <button
            className="btn-ghost"
            onClick={() => {
              const includeSignatureColumn = window.confirm('Bạn có muốn in kèm cột ký nhận trong báo cáo này không?')
              printReport(includeSignatureColumn)
            }}
          >
            In báo cáo
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Số nhân công</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{totals.worker_count}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Tổng công</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{Number(totals.work_qty || 0).toLocaleString('vi-VN')}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Tiền công</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(totals.attendance_amount)}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Đã trả trong kỳ</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(Number(totals.payment_amount || 0) + Number(totals.settlement_amount || 0))}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Còn phải trả</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: Number(totals.outstanding_amount || 0) > 0 ? 'var(--orange)' : 'var(--green)' }}>
            {formatMoney(totals.outstanding_amount)}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Bảng tổng hợp theo nhân công</div>
        <div style={{ maxHeight: 640, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 0.8fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr auto', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
            <div>Nhân công</div>
            <div>Loại</div>
            <div>Số dòng</div>
            <div>Tổng công</div>
            <div>Tiền công</div>
            <div>Tạm ứng</div>
            <div>Thanh toán đợt</div>
            <div>Tất toán</div>
            <div>Còn phải trả</div>
            <div />
          </div>

          {data.workers.map((row) => {
            const expanded = expandedWorkerId === row.worker_id
            return (
              <div key={row.worker_id} style={{ borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 0.8fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr auto', gap: 8, padding: '10px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{row.worker_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{row.worker_code || '-'} | {row.project_names.join(', ') || 'Không gắn dự án'}</div>
                  </div>
                  <div style={{ fontSize: 12 }}>{workerCategoryLabel(row.worker_category)}</div>
                  <div style={{ fontSize: 12 }}>{row.attendance_count}</div>
                  <div style={{ fontSize: 12 }}>{Number(row.work_qty || 0).toLocaleString('vi-VN')}</div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{formatMoney(row.attendance_amount)}</div>
                  <div style={{ fontSize: 12 }}>{formatMoney(row.advance_amount)}</div>
                  <div style={{ fontSize: 12 }}>{formatMoney(row.payment_amount)}</div>
                  <div style={{ fontSize: 12 }}>{formatMoney(row.settlement_amount)}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: Number(row.outstanding_amount || 0) > 0 ? 'var(--orange)' : 'var(--green)' }}>
                    {formatMoney(row.outstanding_amount)}
                    {row.outstanding_note ? (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, whiteSpace: 'normal' }}>
                        {row.outstanding_note}
                      </div>
                    ) : null}
                  </div>
                  <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setExpandedWorkerId(expanded ? '' : row.worker_id)}>
                    {expanded ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                  </button>
                </div>

                {expanded ? (
                  <div style={{ padding: '0 10px 10px' }}>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 0.9fr 0.8fr 0.9fr 1fr 1.2fr', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
                        <div>Ngày</div>
                        <div>Ca</div>
                        <div>Công</div>
                        <div>Tiền</div>
                        <div>Dự án</div>
                        <div>Nhật ký / Ghi chú</div>
                      </div>
                      {row.daily_rows.map((detail) => (
                        <div key={detail.attendance_id} style={{ display: 'grid', gridTemplateColumns: '0.9fr 0.9fr 0.8fr 0.9fr 1fr 1.2fr', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 12 }}>{displayDate(detail.attendance_date)}</div>
                          <div style={{ fontSize: 12 }}>{shiftLabel(detail.shift_type)}</div>
                          <div style={{ fontSize: 12 }}>{Number(detail.work_qty || 0).toLocaleString('vi-VN')}</div>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{formatMoney(detail.amount)}</div>
                          <div style={{ fontSize: 12 }}>{detail.project_name || '-'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{detail.diary_title || detail.note || '-'}</div>
                        </div>
                      ))}
                      {!row.daily_rows.length ? <div style={{ padding: 10, color: 'var(--text3)' }}>Không có dòng công chi tiết.</div> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}

          {!data.workers.length ? <div style={{ padding: 12, color: 'var(--text3)' }}>Không có dữ liệu nhân công trong kỳ này.</div> : null}
        </div>
      </div>

      {toast ? (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
