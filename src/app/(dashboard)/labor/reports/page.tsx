'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'

type Project = { id: string; project_name: string; status?: string | null }
type Attendance = {
  id: string
  attendance_date?: string | null
  shift_type?: string | null
  source_type?: string | null
  work_qty?: number | null
  amount?: string | null
  note?: string | null
  project?: { id: string; project_name: string } | null
  worker?: { id: string; worker_code: string; full_name: string } | null
  diary_entry?: { id: string; title: string; entry_date?: string | null; shift_type?: string | null } | null
  creator?: { id: string; username: string | null } | null
}
type Payment = {
  id: string
  payment_date?: string | null
  payment_type?: string | null
  amount?: string | null
  note?: string | null
  worker?: { id: string; worker_code: string; full_name: string } | null
  batch?: { id: string; status?: string | null; batch_code?: string | null; batch_name?: string | null } | null
}
type PaymentBatch = {
  id: string
  status?: string | null
  settlement_status?: string | null
  attendance_links?: Array<{
    id: string
    attendance?: {
      id: string
      attendance_date?: string | null
      amount?: string | number | null
      worker?: { id: string; worker_code?: string | null; full_name: string } | null
    } | null
  }>
  payments?: Array<{
    id: string
    amount?: string | number | null
    worker?: { id: string; full_name: string } | null
  }>
}
type DayWorkerSummaryRow = {
  day: string
  worker_id: string
  worker_name: string
  worker_code: string
  attendance_ids: string[]
  count: number
  work_qty: number
  amount: number
  paid_amount: number
  payment_status: 'paid' | 'partial' | 'unpaid'
}
type WorkerPeriodSummaryRow = {
  worker_id: string
  worker_name: string
  worker_code: string
  count: number
  work_qty: number
  amount: number
  paid_amount: number
  payment_status: 'paid' | 'partial' | 'unpaid'
}

const TODAY = new Date()
const DEFAULT_TO = toInputDate(TODAY)
const DEFAULT_FROM = toInputDate(new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - 29))
const DEFAULT_WEEK_FROM = toInputDate(getStartOfWeek(TODAY))
const DEFAULT_WEEK_TO = toInputDate(getEndOfWeek(TODAY))
const DEFAULT_MONTH_FROM = toInputDate(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1))
const DEFAULT_MONTH_TO = toInputDate(new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0))

function toInputDate(value: Date) {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getStartOfWeek(value: Date) {
  const next = new Date(value)
  const day = next.getDay()
  const diff = day === 0 ? -6 : 1 - day
  next.setDate(next.getDate() + diff)
  next.setHours(0, 0, 0, 0)
  return next
}

function getEndOfWeek(value: Date) {
  const start = getStartOfWeek(value)
  const next = new Date(start)
  next.setDate(start.getDate() + 6)
  next.setHours(23, 59, 59, 999)
  return next
}

function displayDate(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('vi-VN')
}

function formatMoney(v?: string | number | null) {
  if (v == null || v === '') return '-'
  const n = typeof v === 'string' ? Number(v) : v
  if (!Number.isFinite(n)) return '-'
  return `${Number(n).toLocaleString('vi-VN')} vnd`
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

function sourceLabel(value?: string | null) {
  return value === 'diary' ? 'Từ nhật ký' : 'Nhập tay'
}

function paymentStatusText(value: 'paid' | 'partial' | 'unpaid') {
  switch (value) {
    case 'paid': return 'Đủ'
    case 'partial': return 'Chưa đủ'
    case 'unpaid':
    default:
      return 'Chưa'
  }
}

function paymentStatusColor(value: 'paid' | 'partial' | 'unpaid') {
  switch (value) {
    case 'paid': return 'var(--green)'
    case 'partial': return 'var(--orange)'
    case 'unpaid':
    default:
      return 'var(--red)'
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

function renderPrintWindow(title: string, body: string, onBlocked: () => void) {
  const popup = window.open('', '_blank', 'width=1024,height=760')
  if (!popup) {
    onBlocked()
    return
  }
  popup.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          h1 { margin: 0 0 8px; font-size: 24px; }
          h2 { margin: 20px 0 8px; font-size: 18px; }
          .meta { margin-bottom: 16px; color: #374151; font-size: 13px; line-height: 1.6; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
          .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px 12px; }
          .label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
          .value { font-size: 20px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #d1d5db; padding: 8px 10px; font-size: 13px; vertical-align: top; }
          th { background: #f3f4f6; text-align: left; }
        </style>
      </head>
      <body>${body}</body>
    </html>
  `)
  popup.document.close()
  popup.focus()
  popup.print()
}

export default function LaborReportsPage() {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [rows, setRows] = useState<Attendance[]>([])
  const [paymentRows, setPaymentRows] = useState<Payment[]>([])
  const [paymentBatches, setPaymentBatches] = useState<PaymentBatch[]>([])
  const [filters, setFilters] = useState({
    period_mode: 'month',
    project_id: '',
    shift_type: '',
    from: DEFAULT_MONTH_FROM,
    to: DEFAULT_MONTH_TO,
  })

  async function loadProjects() {
    const res = await fetch('/api/projects?limit=200')
    const json = await res.json().catch(() => ({}))
    setProjects(Array.isArray(json?.data) ? json.data : [])
  }

  async function loadRows(nextFilters = filters) {
    setLoading(true)
    try {
      const attendanceSp = new URLSearchParams()
      attendanceSp.set('attendance_status', 'confirmed')
      if (nextFilters.project_id) attendanceSp.set('project_id', nextFilters.project_id)
      if (nextFilters.shift_type) attendanceSp.set('shift_type', nextFilters.shift_type)
      if (nextFilters.from) attendanceSp.set('from', nextFilters.from)
      if (nextFilters.to) attendanceSp.set('to', nextFilters.to)

      const paymentSp = new URLSearchParams()
      if (nextFilters.project_id) paymentSp.set('project_id', nextFilters.project_id)
      const batchSp = new URLSearchParams()
      if (nextFilters.project_id) batchSp.set('project_id', nextFilters.project_id)

      const [attendanceRes, paymentRes, batchRes] = await Promise.all([
        fetch(`/api/labor/attendances?${attendanceSp.toString()}`),
        fetch(`/api/labor/payments?${paymentSp.toString()}`),
        fetch(`/api/labor/payment-batches?${batchSp.toString()}`),
      ])

      const [attendanceJson, paymentJson, batchJson] = await Promise.all([
        attendanceRes.json().catch(() => ({})),
        paymentRes.json().catch(() => ({})),
        batchRes.json().catch(() => ({})),
      ])

      if (!attendanceRes.ok) {
        setToast(attendanceJson?.error || 'Không tải được báo cáo chấm công')
        setRows([])
        setPaymentRows([])
        return
      }
      if (!paymentRes.ok) {
        setToast(paymentJson?.error || 'Không tải được báo cáo thanh toán')
        setRows(Array.isArray(attendanceJson?.data) ? attendanceJson.data : [])
        setPaymentRows([])
        setPaymentBatches(Array.isArray(batchJson?.data) ? batchJson.data : [])
        return
      }
      if (!batchRes.ok) {
        setToast(batchJson?.error || 'Không tải được dữ liệu đợt thanh toán')
        setRows(Array.isArray(attendanceJson?.data) ? attendanceJson.data : [])
        setPaymentRows(Array.isArray(paymentJson?.data) ? paymentJson.data : [])
        setPaymentBatches([])
        return
      }

      setRows(Array.isArray(attendanceJson?.data) ? attendanceJson.data : [])
      setPaymentRows(Array.isArray(paymentJson?.data) ? paymentJson.data : [])
      setPaymentBatches(Array.isArray(batchJson?.data) ? batchJson.data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProjects()
    void loadRows()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const totalWorkQty = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.work_qty || 0), 0),
    [rows],
  )
  const totalAmount = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [rows],
  )
  const totalWithAmount = useMemo(
    () => rows.filter((row) => Number(row.amount || 0) > 0).length,
    [rows],
  )
  const attendanceSettlementMap = useMemo(() => {
    const map = new Map<string, { paid_amount: number; payment_status: 'paid' | 'partial' | 'unpaid' }>()
    const visibleAttendanceIds = new Set(rows.map((row) => String(row.id || '')).filter(Boolean))

    for (const batch of paymentBatches) {
      if (batch.status === 'cancelled') continue
      const links = Array.isArray(batch.attendance_links) ? batch.attendance_links : []
      if (!links.length) continue

      const paidByWorker = new Map<string, number>()
      let unassignedPaid = 0
      for (const payment of Array.isArray(batch.payments) ? batch.payments : []) {
        const workerId = String(payment?.worker?.id || '').trim()
        if (!workerId) {
          unassignedPaid += Number(payment?.amount || 0)
          continue
        }
        paidByWorker.set(workerId, (paidByWorker.get(workerId) || 0) + Number(payment?.amount || 0))
      }

      const groupedAttendances = new Map<string, Array<{ id: string; attendance_date?: string | null; amount: number }>>()
      for (const link of links) {
        const attendance = link.attendance
        const attendanceId = String(attendance?.id || '').trim()
        const workerId = String(attendance?.worker?.id || '').trim()
        if (!attendanceId || !workerId || !visibleAttendanceIds.has(attendanceId)) continue
        const bucket = groupedAttendances.get(workerId) || []
        bucket.push({
          id: attendanceId,
          attendance_date: attendance?.attendance_date || null,
          amount: Number(attendance?.amount || 0),
        })
        groupedAttendances.set(workerId, bucket)
      }

      for (const [workerId, attendanceList] of groupedAttendances.entries()) {
        let remainingPaid = paidByWorker.get(workerId) || 0
        attendanceList.sort((a, b) => {
          const aDate = String(a.attendance_date || '')
          const bDate = String(b.attendance_date || '')
          if (aDate === bDate) return a.id.localeCompare(b.id, 'vi')
          return aDate.localeCompare(bDate, 'vi')
        })
        for (const attendance of attendanceList) {
          const allocated = Math.max(0, Math.min(remainingPaid, attendance.amount))
          remainingPaid = Math.max(0, remainingPaid - allocated)
          const current = map.get(attendance.id) || { paid_amount: 0, payment_status: 'unpaid' as const }
          const nextPaid = current.paid_amount + allocated
          const nextStatus: 'paid' | 'partial' | 'unpaid' =
            nextPaid <= 0
              ? 'unpaid'
              : nextPaid + 0.0001 >= attendance.amount
                ? 'paid'
                : 'partial'
          map.set(attendance.id, {
            paid_amount: nextPaid,
            payment_status: nextStatus,
          })
        }
      }

      if (unassignedPaid > 0) {
        const remainingAttendances = Array.from(groupedAttendances.values())
          .flat()
          .map((attendance) => {
            const currentPaid = Number(map.get(attendance.id)?.paid_amount || 0)
            return {
              ...attendance,
              remaining_amount: Math.max(0, attendance.amount - currentPaid),
            }
          })
          .filter((attendance) => attendance.remaining_amount > 0)
          .sort((a, b) => {
            const aDate = String(a.attendance_date || '')
            const bDate = String(b.attendance_date || '')
            if (aDate === bDate) return a.id.localeCompare(b.id, 'vi')
            return aDate.localeCompare(bDate, 'vi')
          })

        for (const attendance of remainingAttendances) {
          if (unassignedPaid <= 0) break
          const allocated = Math.max(0, Math.min(unassignedPaid, attendance.remaining_amount))
          unassignedPaid = Math.max(0, unassignedPaid - allocated)
          const current = map.get(attendance.id) || { paid_amount: 0, payment_status: 'unpaid' as const }
          const nextPaid = current.paid_amount + allocated
          const nextStatus: 'paid' | 'partial' | 'unpaid' =
            nextPaid <= 0
              ? 'unpaid'
              : nextPaid + 0.0001 >= attendance.amount
                ? 'paid'
                : 'partial'
          map.set(attendance.id, {
            paid_amount: nextPaid,
            payment_status: nextStatus,
          })
        }
      }
    }

    const directPaidByWorker = new Map<string, number>()
    for (const payment of paymentRows) {
      if (payment.batch?.id) continue
      const workerId = String(payment.worker?.id || '').trim()
      if (!workerId) continue
      directPaidByWorker.set(workerId, (directPaidByWorker.get(workerId) || 0) + Number(payment.amount || 0))
    }

    if (directPaidByWorker.size > 0) {
      const attendancesByWorker = new Map<string, Array<{ id: string; attendance_date?: string | null; amount: number }>>()
      for (const row of rows) {
        const workerId = String(row.worker?.id || '').trim()
        const attendanceId = String(row.id || '').trim()
        if (!workerId || !attendanceId) continue
        const bucket = attendancesByWorker.get(workerId) || []
        bucket.push({
          id: attendanceId,
          attendance_date: row.attendance_date || null,
          amount: Number(row.amount || 0),
        })
        attendancesByWorker.set(workerId, bucket)
      }

      for (const [workerId, paymentAmount] of directPaidByWorker.entries()) {
        let remainingPaid = paymentAmount
        const attendanceList = (attendancesByWorker.get(workerId) || [])
          .map((attendance) => {
            const currentPaid = Number(map.get(attendance.id)?.paid_amount || 0)
            return {
              ...attendance,
              remaining_amount: Math.max(0, attendance.amount - currentPaid),
            }
          })
          .filter((attendance) => attendance.remaining_amount > 0)
          .sort((a, b) => {
            const aDate = String(a.attendance_date || '')
            const bDate = String(b.attendance_date || '')
            if (aDate === bDate) return a.id.localeCompare(b.id, 'vi')
            return aDate.localeCompare(bDate, 'vi')
          })

        for (const attendance of attendanceList) {
          if (remainingPaid <= 0) break
          const allocated = Math.max(0, Math.min(remainingPaid, attendance.remaining_amount))
          remainingPaid = Math.max(0, remainingPaid - allocated)
          const current = map.get(attendance.id) || { paid_amount: 0, payment_status: 'unpaid' as const }
          const nextPaid = current.paid_amount + allocated
          const nextStatus: 'paid' | 'partial' | 'unpaid' =
            nextPaid <= 0
              ? 'unpaid'
              : nextPaid + 0.0001 >= attendance.amount
                ? 'paid'
                : 'partial'
          map.set(attendance.id, {
            paid_amount: nextPaid,
            payment_status: nextStatus,
          })
        }
      }
    }

    return map
  }, [paymentBatches, paymentRows, rows])

  const totalPaidAmount = useMemo(
    () => rows.reduce((sum, row) => sum + Number(attendanceSettlementMap.get(String(row.id || ''))?.paid_amount || 0), 0),
    [attendanceSettlementMap, rows],
  )

  const groupedByShift = useMemo(() => {
    const map = new Map<string, { count: number; work_qty: number; amount: number }>()
    for (const row of rows) {
      const key = row.shift_type || ''
      const prev = map.get(key) || { count: 0, work_qty: 0, amount: 0 }
      prev.count += 1
      prev.work_qty += Number(row.work_qty || 0)
      prev.amount += Number(row.amount || 0)
      map.set(key, prev)
    }
    return Array.from(map.entries())
  }, [rows])

  const paidAmountByWorker = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of rows) {
      const workerId = String(row.worker?.id || '').trim()
      if (!workerId) continue
      const paidAmount = Number(attendanceSettlementMap.get(String(row.id || ''))?.paid_amount || 0)
      map.set(workerId, (map.get(workerId) || 0) + paidAmount)
    }
    return map
  }, [attendanceSettlementMap, rows])

  const groupedByDayWorker = useMemo<DayWorkerSummaryRow[]>(() => {
    const grouped = new Map<string, DayWorkerSummaryRow>()
    for (const row of rows) {
      const day = row.attendance_date ? toInputDate(new Date(row.attendance_date)) : ''
      const workerId = String(row.worker?.id || '').trim()
      const attendanceId = String(row.id || '').trim()
      const key = `${day}__${workerId}`
      const prev = grouped.get(key) || {
        day,
        worker_id: workerId,
        worker_name: row.worker?.full_name || '-',
        worker_code: row.worker?.worker_code || '',
        attendance_ids: [],
        count: 0,
        work_qty: 0,
        amount: 0,
        paid_amount: 0,
        payment_status: 'unpaid' as const,
      }
      prev.count += 1
      prev.work_qty += Number(row.work_qty || 0)
      prev.amount += Number(row.amount || 0)
      if (attendanceId) prev.attendance_ids.push(attendanceId)
      grouped.set(key, prev)
    }

    const workerBuckets = new Map<string, DayWorkerSummaryRow[]>()
    for (const row of grouped.values()) {
      const key = row.worker_id || `${row.worker_name}__${row.worker_code}`
      const bucket = workerBuckets.get(key) || []
      bucket.push({ ...row })
      workerBuckets.set(key, bucket)
    }

    const finalized: DayWorkerSummaryRow[] = []
    for (const [, workerRows] of workerBuckets.entries()) {
      workerRows.sort((a, b) => a.day.localeCompare(b.day, 'vi'))
      for (const row of workerRows) {
        const allocated = row.attendance_ids.reduce(
          (sum, attendanceId) => sum + Number(attendanceSettlementMap.get(attendanceId)?.paid_amount || 0),
          0,
        )
        const status: DayWorkerSummaryRow['payment_status'] =
          allocated <= 0
            ? 'unpaid'
            : allocated + 0.0001 >= row.amount
              ? 'paid'
              : 'partial'
        finalized.push({
          ...row,
          paid_amount: allocated,
          payment_status: status,
        })
      }
    }

    return finalized.sort((a, b) => {
      if (a.day === b.day) return a.worker_name.localeCompare(b.worker_name, 'vi')
      return a.day < b.day ? 1 : -1
    })
  }, [attendanceSettlementMap, rows])

  const groupedByDayWorkerTotalWorkers = useMemo(() => {
    const set = new Set(groupedByDayWorker.map((row) => row.worker_id || `${row.worker_name}__${row.worker_code}`))
    return set.size
  }, [groupedByDayWorker])

  const groupedByPeriodWorker = useMemo<WorkerPeriodSummaryRow[]>(() => {
    const map = new Map<string, WorkerPeriodSummaryRow>()
    for (const row of rows) {
      const workerId = String(row.worker?.id || '').trim()
      const key = workerId || `${row.worker?.full_name || '-'}__${row.worker?.worker_code || ''}`
      const prev = map.get(key) || {
        worker_id: workerId,
        worker_name: row.worker?.full_name || '-',
        worker_code: row.worker?.worker_code || '',
        count: 0,
        work_qty: 0,
        amount: 0,
        paid_amount: 0,
        payment_status: 'unpaid' as const,
      }
      prev.count += 1
      prev.work_qty += Number(row.work_qty || 0)
      prev.amount += Number(row.amount || 0)
      map.set(key, prev)
    }

    return Array.from(map.entries()).map(([key, row]) => {
      const paidAmount = paidAmountByWorker.get(key) || 0
      const paymentStatus: WorkerPeriodSummaryRow['payment_status'] =
        paidAmount <= 0
          ? 'unpaid'
          : paidAmount + 0.0001 >= row.amount
            ? 'paid'
            : 'partial'
      return {
        ...row,
        paid_amount: paidAmount,
        payment_status: paymentStatus,
      }
    }).sort((a, b) => {
      if (a.amount === b.amount) return a.worker_name.localeCompare(b.worker_name, 'vi')
      return b.amount - a.amount
    })
  }, [rows, paidAmountByWorker])

  function applyPeriodMode(mode: string) {
    if (mode === 'week') {
      setFilters((prev) => ({ ...prev, period_mode: mode, from: DEFAULT_WEEK_FROM, to: DEFAULT_WEEK_TO }))
      return
    }
    if (mode === 'month') {
      setFilters((prev) => ({ ...prev, period_mode: mode, from: DEFAULT_MONTH_FROM, to: DEFAULT_MONTH_TO }))
      return
    }
    setFilters((prev) => ({ ...prev, period_mode: mode, from: prev.from || DEFAULT_FROM, to: prev.to || DEFAULT_TO }))
  }

  function exportDailySummaryPdf() {
    const projectLabel = filters.project_id ? (projects.find((x) => x.id === filters.project_id)?.project_name || 'Đã chọn dự án') : 'Tất cả dự án'
    const shiftTypeValue = filters.shift_type ? shiftLabel(filters.shift_type) : 'Tất cả ca'
    const rowsHtml = groupedByDayWorker.map((row) => `
      <tr>
        <td>${escapeHtml(displayDate(row.day))}</td>
        <td>${escapeHtml(row.worker_name)}${row.worker_code ? ` (${escapeHtml(row.worker_code)})` : ''}</td>
        <td style="text-align:right">${escapeHtml(row.work_qty.toLocaleString('vi-VN'))}</td>
        <td style="text-align:right">${escapeHtml(formatMoney(row.amount))}</td>
        <td style="text-align:center; color:${row.payment_status === 'paid' ? '#16a34a' : row.payment_status === 'partial' ? '#d97706' : '#dc2626'}">${escapeHtml(paymentStatusText(row.payment_status))}</td>
      </tr>
    `).join('')
    renderPrintWindow('Bao cao cham cong theo ngay', `
      <h1>Báo cáo chấm công đã xác nhận</h1>
      <div class="meta">
        Dự án: <strong>${escapeHtml(projectLabel)}</strong><br />
        Loại ca: <strong>${escapeHtml(shiftTypeValue)}</strong><br />
        Thời gian: <strong>${escapeHtml(displayDate(filters.from))} - ${escapeHtml(displayDate(filters.to))}</strong>
      </div>
      <div class="summary">
        <div class="card"><div class="label">Tổng dòng chấm công</div><div class="value">${rows.length}</div></div>
        <div class="card"><div class="label">Tổng công</div><div class="value">${totalWorkQty.toLocaleString('vi-VN')}</div></div>
        <div class="card"><div class="label">Tổng tiền công</div><div class="value">${formatMoney(totalAmount)}</div></div>
        <div class="card"><div class="label">Đã chi thực tế</div><div class="value">${formatMoney(totalPaidAmount)}</div></div>
      </div>
      <h2>Tổng hợp theo ngày</h2>
      <table>
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Nhân công</th>
            <th>Tổng công</th>
            <th>Tổng tiền công</th>
            <th>Thanh toán</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="5">Không có dữ liệu</td></tr>'}
          ${groupedByDayWorker.length ? `
            <tr>
              <td><strong>Tổng</strong></td>
              <td><strong>${groupedByDayWorkerTotalWorkers.toLocaleString('vi-VN')} nhân công</strong></td>
              <td style="text-align:right"><strong>${totalWorkQty.toLocaleString('vi-VN')}</strong></td>
              <td style="text-align:right"><strong>${formatMoney(totalAmount)}</strong></td>
              <td style="text-align:center"><strong>Đã chi ${escapeHtml(formatMoney(totalPaidAmount))}</strong></td>
            </tr>
          ` : ''}
        </tbody>
      </table>
    `, () => setToast('Trình duyệt đang chặn cửa sổ in / xuất PDF'))
  }

  function exportPeriodWorkerPdf() {
    const projectLabel = filters.project_id ? (projects.find((x) => x.id === filters.project_id)?.project_name || 'Đã chọn dự án') : 'Tất cả dự án'
    const rowsHtml = groupedByPeriodWorker.map((row) => `
      <tr>
        <td>${escapeHtml(row.worker_name)}${row.worker_code ? ` (${escapeHtml(row.worker_code)})` : ''}</td>
        <td style="text-align:right">${escapeHtml(row.work_qty.toLocaleString('vi-VN'))}</td>
        <td style="text-align:right">${escapeHtml(formatMoney(row.amount))}</td>
        <td style="text-align:center; color:${row.payment_status === 'paid' ? '#16a34a' : row.payment_status === 'partial' ? '#d97706' : '#dc2626'}">${escapeHtml(paymentStatusText(row.payment_status))}</td>
      </tr>
    `).join('')
    renderPrintWindow('Bao cao cham cong theo nhan cong', `
      <h1>Tổng hợp chấm công theo khoảng thời gian</h1>
      <div class="meta">
        Dự án: <strong>${escapeHtml(projectLabel)}</strong><br />
        Thời gian: <strong>${escapeHtml(displayDate(filters.from))} - ${escapeHtml(displayDate(filters.to))}</strong>
      </div>
      <div class="summary">
        <div class="card"><div class="label">Số nhân công</div><div class="value">${groupedByPeriodWorker.length}</div></div>
        <div class="card"><div class="label">Tổng công</div><div class="value">${totalWorkQty.toLocaleString('vi-VN')}</div></div>
        <div class="card"><div class="label">Tổng tiền công</div><div class="value">${formatMoney(totalAmount)}</div></div>
        <div class="card"><div class="label">Đã chi thực tế</div><div class="value">${formatMoney(totalPaidAmount)}</div></div>
      </div>
      <h2>Tổng hợp theo nhân công</h2>
      <table>
        <thead>
          <tr>
            <th>Nhân công</th>
            <th>Tổng công</th>
            <th>Tổng tiền công</th>
            <th>Thanh toán</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="4">Không có dữ liệu</td></tr>'}
          ${groupedByPeriodWorker.length ? `
            <tr>
              <td><strong>Tổng ${groupedByPeriodWorker.length.toLocaleString('vi-VN')} nhân công</strong></td>
              <td style="text-align:right"><strong>${totalWorkQty.toLocaleString('vi-VN')}</strong></td>
              <td style="text-align:right"><strong>${formatMoney(totalAmount)}</strong></td>
              <td style="text-align:center"><strong>Đã chi ${escapeHtml(formatMoney(totalPaidAmount))}</strong></td>
            </tr>
          ` : ''}
        </tbody>
      </table>
    `, () => setToast('Trình duyệt đang chặn cửa sổ in / xuất PDF'))
  }

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)' }}>NHÂN CÔNG</div>
          <h1 style={{ margin: '4px 0 4px', fontSize: 22, fontWeight: 800 }}>Báo cáo chấm công đã xác nhận</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Xem chấm công theo khoảng thời gian, lọc theo dự án và loại ca để theo dõi tổng công, tổng tiền công và trạng thái thanh toán.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link className="btn-ghost" href="/labor">Danh mục nhân công</Link>
          <Link className="btn-ghost" href="/labor/assignments">Phân công khoán việc</Link>
          <Link className="btn-ghost" href="/labor/attendance">Chấm công</Link>
          <Link className="btn-ghost" href="/labor/payments">Thanh toán công</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Bộ lọc báo cáo</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Khoảng thời gian</div>
            <select className="select" value={filters.period_mode} onChange={(e) => applyPeriodMode(e.target.value)}>
              <option value="week">Tuần này</option>
              <option value="month">Tháng này</option>
              <option value="custom">Tùy chọn</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Dự án</div>
            <select className="select" value={filters.project_id} onChange={(e) => setFilters((prev) => ({ ...prev, project_id: e.target.value }))}>
              <option value="">(Tất cả dự án)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.project_name}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Loại ca</div>
            <select className="select" value={filters.shift_type} onChange={(e) => setFilters((prev) => ({ ...prev, shift_type: e.target.value }))}>
              <option value="">(Tất cả ca)</option>
              <option value="full_day">Cả ngày</option>
              <option value="morning">Buổi sáng</option>
              <option value="afternoon">Buổi chiều</option>
              <option value="night">Ban đêm</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Từ ngày</div>
            <input className="input" type="date" value={filters.from} disabled={filters.period_mode !== 'custom'} onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đến ngày</div>
            <input className="input" type="date" value={filters.to} disabled={filters.period_mode !== 'custom'} onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} />
          </div>
          <button className="btn-primary" onClick={() => void loadRows(filters)}>Xem báo cáo</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Tổng dòng chấm công</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{rows.length}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Tổng công</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{totalWorkQty.toLocaleString('vi-VN')}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Tổng tiền công</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(totalAmount)}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Đã chi thực tế</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(totalPaidAmount)}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Tổng hợp theo loại ca</div>
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={thStyle}>Loại ca</th>
                <th style={thStyle}>Số dòng</th>
                <th style={thStyle}>Tổng công</th>
                <th style={thStyle}>Tổng tiền công</th>
              </tr>
            </thead>
            <tbody>
              {groupedByShift.map(([shift, data]) => (
                <tr key={shift || 'all'}>
                  <td style={tdStyle}>{shiftLabel(shift)}</td>
                  <td style={tdStyle}>{data.count}</td>
                  <td style={tdStyle}>{data.work_qty.toLocaleString('vi-VN')}</td>
                  <td style={tdStyle}>{formatMoney(data.amount)}</td>
                </tr>
              ))}
              {!groupedByShift.length ? (
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, color: 'var(--text3)' }}>Chưa có dữ liệu trong khoảng lọc.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Tổng hợp theo ngày</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              Gộp chấm công theo ngày và nhân công. Trạng thái thanh toán đang được suy ra theo số tiền đã chi cho nhân công trong khoảng lọc.
            </div>
          </div>
          <button className="btn-ghost" onClick={exportDailySummaryPdf}>Xuất PDF bảng này</button>
        </div>
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={thStyle}>Ngày</th>
                <th style={thStyle}>Nhân công</th>
                <th style={thStyle}>Tổng công</th>
                <th style={thStyle}>Tổng tiền công</th>
                <th style={thStyle}>Thanh toán</th>
              </tr>
            </thead>
            <tbody>
              {groupedByDayWorker.map((row) => (
                <tr key={`${row.day}_${row.worker_code}_${row.worker_name}`}>
                  <td style={tdStyle}>{displayDate(row.day)}</td>
                  <td style={tdStyle}>{row.worker_name}{row.worker_code ? ` (${row.worker_code})` : ''}</td>
                  <td style={tdStyle}>{row.work_qty.toLocaleString('vi-VN')}</td>
                  <td style={tdStyle}>{formatMoney(row.amount)}</td>
                  <td style={{ ...tdStyle, color: paymentStatusColor(row.payment_status), fontWeight: 700 }}>{paymentStatusText(row.payment_status)}</td>
                </tr>
              ))}
              {groupedByDayWorker.length ? (
                <tr style={{ background: 'var(--surface2)' }}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>Tổng</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{groupedByDayWorkerTotalWorkers.toLocaleString('vi-VN')} nhân công</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{totalWorkQty.toLocaleString('vi-VN')}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{formatMoney(totalAmount)}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>Đã chi {formatMoney(totalPaidAmount)}</td>
                </tr>
              ) : null}
              {!groupedByDayWorker.length ? (
                <tr>
                  <td colSpan={5} style={{ ...tdStyle, color: 'var(--text3)' }}>
                    Chưa có dữ liệu chấm công đã xác nhận trong khoảng lọc.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Tổng hợp theo khoảng thời gian</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              Gộp toàn bộ chấm công trong khoảng đã chọn theo từng nhân công để xem tổng công, tổng tiền công và mức thanh toán hiện tại.
            </div>
          </div>
          <button className="btn-ghost" onClick={exportPeriodWorkerPdf}>Xuất PDF bảng này</button>
        </div>
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={thStyle}>Nhân công</th>
                <th style={thStyle}>Tổng công</th>
                <th style={thStyle}>Tổng tiền công</th>
                <th style={thStyle}>Thanh toán</th>
              </tr>
            </thead>
            <tbody>
              {groupedByPeriodWorker.map((row) => (
                <tr key={`${row.worker_id}_${row.worker_code}_${row.worker_name}`}>
                  <td style={tdStyle}>{row.worker_name}{row.worker_code ? ` (${row.worker_code})` : ''}</td>
                  <td style={tdStyle}>{row.work_qty.toLocaleString('vi-VN')}</td>
                  <td style={tdStyle}>{formatMoney(row.amount)}</td>
                  <td style={{ ...tdStyle, color: paymentStatusColor(row.payment_status), fontWeight: 700 }}>{paymentStatusText(row.payment_status)}</td>
                </tr>
              ))}
              {groupedByPeriodWorker.length ? (
                <tr style={{ background: 'var(--surface2)' }}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>Tổng {groupedByPeriodWorker.length.toLocaleString('vi-VN')} nhân công</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{totalWorkQty.toLocaleString('vi-VN')}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{formatMoney(totalAmount)}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>Đã chi {formatMoney(totalPaidAmount)}</td>
                </tr>
              ) : null}
              {!groupedByPeriodWorker.length ? (
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, color: 'var(--text3)' }}>
                    Chưa có dữ liệu chấm công đã xác nhận trong khoảng lọc.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Danh sách chấm công đã xác nhận</div>
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={thStyle}>Ngày</th>
                <th style={thStyle}>Dự án</th>
                <th style={thStyle}>Nhân công</th>
                <th style={thStyle}>Loại ca</th>
                <th style={thStyle}>Số công</th>
                <th style={thStyle}>Tiền công</th>
                <th style={thStyle}>Nguồn</th>
                <th style={thStyle}>Nhật ký</th>
                <th style={thStyle}>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>{displayDate(row.attendance_date)}</td>
                  <td style={tdStyle}>{row.project?.project_name || '-'}</td>
                  <td style={tdStyle}>{row.worker?.full_name || '-'}{row.worker?.worker_code ? ` (${row.worker.worker_code})` : ''}</td>
                  <td style={tdStyle}>{shiftLabel(row.shift_type)}</td>
                  <td style={tdStyle}>{row.work_qty != null ? Number(row.work_qty).toLocaleString('vi-VN') : '-'}</td>
                  <td style={tdStyle}>{formatMoney(row.amount)}</td>
                  <td style={tdStyle}>{sourceLabel(row.source_type)}</td>
                  <td style={tdStyle}>{row.diary_entry?.title || '-'}</td>
                  <td style={tdStyle}>{row.note || '-'}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={9} style={{ ...tdStyle, color: 'var(--text3)' }}>
                    {loading ? 'Đang tải dữ liệu...' : 'Chưa có chấm công đã xác nhận trong khoảng lọc.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
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

const thStyle: CSSProperties = {
  textAlign: 'left',
  fontSize: 12,
  padding: '10px 12px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text3)',
  whiteSpace: 'nowrap',
}

const tdStyle: CSSProperties = {
  fontSize: 13,
  padding: '10px 12px',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top',
}
