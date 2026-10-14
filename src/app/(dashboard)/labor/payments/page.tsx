'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PRINT_BRAND_DEFAULT, mergePrintBrandSettings, type PrintBrandSettings } from '@/lib/print/brand'

type Project = { id: string; project_name: string; status?: string | null }
type Worker = { id: string; worker_code: string; full_name: string; worker_category?: string | null }
type Crew = { id: string; crew_key: string; crew_name: string }
type Engagement = {
  id: string
  engagement_type: string
  status: string
  project?: { id: string; project_name: string } | null
  worker?: { id: string; worker_code: string; full_name: string } | null
  crew?: { id: string; crew_key: string; crew_name: string } | null
}
type Payment = {
  id: string
  batch?: { id: string; batch_code: string; batch_name: string; status?: string | null; payment_type?: string | null } | null
  payment_date?: string | null
  payment_type?: string | null
  amount?: string | null
  note?: string | null
  project?: { id: string; project_name: string } | null
  worker?: { id: string; worker_code: string; full_name: string } | null
  crew?: { id: string; crew_key: string; crew_name: string } | null
  engagement?: { id: string; engagement_type: string; status: string } | null
  creator?: { id: string; username: string | null } | null
}
type Attendance = {
  id: string
  attendance_date?: string | null
  shift_type?: string | null
  work_qty?: number | null
  amount?: string | null
  note?: string | null
  worker?: { id: string; worker_code?: string; full_name: string } | null
  diary_entry?: { id: string; title: string } | null
}
type PaymentBatch = {
  id: string
  batch_code: string
  batch_name: string
  status?: string | null
  settlement_status?: string | null
  payment_type?: string | null
  period_from?: string | null
  period_to?: string | null
  planned_payment_date?: string | null
  actual_payment_date?: string | null
  note?: string | null
  cancel_reason?: string | null
  total_amount?: string | null
  payment_amount?: string | null
  attendance_amount?: string | null
  payment_count?: number | null
  attendance_count?: number | null
  project?: { id: string; project_name: string } | null
  payments?: Array<{
    id: string
    amount?: string | number | null
    payment_date?: string | null
    payment_type?: string | null
    note?: string | null
    worker?: { id: string; full_name: string } | null
    crew?: { id: string; crew_name: string } | null
  }>
  attendance_links?: Array<{
    id: string
    attendance?: {
      id: string
      attendance_date?: string | null
      shift_type?: string | null
      work_qty?: number | null
      amount?: string | number | null
      note?: string | null
      worker?: { id: string; full_name: string; worker_code?: string | null } | null
      diary_entry?: { id: string; title: string } | null
    } | null
  }>
}

type WorkerBalance = {
  worker_id: string
  worker_code?: string | null
  full_name: string
  worker_category?: string | null
  attendance_amount: number
  advance_amount: number
  payment_amount: number
  settlement_amount: number
  paid_total: number
  outstanding_amount: number
  overpaid_amount: number
}

function toInputDate(value: Date) {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const EMPTY_FORM = {
  project_id: '',
  batch_id: '',
  engagement_id: '',
  worker_id: '',
  crew_id: '',
  payment_date: '',
  payment_type: 'payment',
  amount: '',
  note: '',
}
const EMPTY_BATCH_FORM = {
  project_id: '',
  batch_name: '',
  period_from: '',
  period_to: '',
  planned_payment_date: '',
  payment_type: 'payment',
  note: '',
}

const TODAY = new Date()
const DEFAULT_TO = toInputDate(TODAY)
const DEFAULT_FROM = toInputDate(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1))

function formatMoney(v?: string | number | null) {
  if (v == null || v === '') return '-'
  const n = typeof v === 'string' ? Number(v) : v
  if (!Number.isFinite(n)) return '-'
  return `${Number(n).toLocaleString('vi-VN')} vnd`
}

function dateInputValue(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function displayDate(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('vi-VN')
}

function paymentTypeLabel(value?: string | null) {
  switch (value) {
    case 'advance': return 'Tạm ứng'
    case 'payment': return 'Thanh toán đợt'
    case 'settlement': return 'Tất toán'
    default: return value || '-'
  }
}

function paymentTypeDocumentTitle(value?: string | null) {
  switch (value) {
    case 'advance': return 'Phiếu tạm ứng nhân công'
    case 'settlement': return 'Phiếu tất toán nhân công'
    case 'payment':
    default:
      return 'Bảng thanh toán công'
  }
}

function paymentTypeDocumentSubtitle(value?: string | null) {
  switch (value) {
    case 'advance': return 'Chi tiết tạm ứng cho nhân công theo đợt thanh toán'
    case 'settlement': return 'Chi tiết tất toán công nợ nhân công theo đợt thanh toán'
    case 'payment':
    default:
      return 'Chi tiết chi trả nhân công theo đợt thanh toán'
  }
}

function paymentTypeNote(value?: string | null) {
  switch (value) {
    case 'advance':
      return 'Phiếu này dùng để đối chiếu số tiền tạm ứng cho nhân công công ty trong đợt. Khi tất toán cần đối chiếu với chấm công đã xác nhận và các khoản đã chi trước đó.'
    case 'settlement':
      return 'Phiếu này dùng để tất toán phần công nợ còn lại của nhân công công ty. Trường hợp có chênh lệch, cần đối chiếu lại với chấm công, tạm ứng và các khoản đã chi liên quan.'
    case 'payment':
    default:
      return 'Phiếu này dùng để đối chiếu thanh toán công trong đợt. Trường hợp có chênh lệch, cần đối chiếu lại với chấm công đã xác nhận và duyệt đợt thanh toán.'
  }
}

function batchStatusLabel(value?: string | null) {
  switch (value) {
    case 'draft': return 'Nháp'
    case 'approved': return 'Đã duyệt'
    case 'paid': return 'Đã chi'
    case 'cancelled': return 'Đã hủy'
    default: return value || '-'
  }
}

function batchStatusColor(value?: string | null) {
  switch (value) {
    case 'approved': return 'var(--blue)'
    case 'paid': return 'var(--green)'
    case 'cancelled': return 'var(--red)'
    default: return 'var(--orange)'
  }
}

function settlementStatusLabel(value?: string | null) {
  switch (value) {
    case 'paid': return 'Đã chi đủ'
    case 'partial': return 'Chi thiếu'
    case 'unpaid': return 'Chưa chi'
    case 'cancelled': return 'Đã hủy'
    default: return value || '-'
  }
}

function settlementStatusColor(value?: string | null) {
  switch (value) {
    case 'paid': return 'var(--green)'
    case 'partial': return 'var(--orange)'
    case 'unpaid': return 'var(--red)'
    case 'cancelled': return 'var(--text3)'
    default: return 'var(--text3)'
  }
}

function sumBatchAmount(rows: PaymentBatch[], status?: string) {
  return rows
    .filter((x) => (!status ? true : String(x.status || '') === status))
    .reduce((sum, x) => sum + Number(x.total_amount || 0), 0)
}

function engagementTypeLabel(value?: string | null) {
  switch (value) {
    case 'daily': return 'Công ngày'
    case 'piecework': return 'Khoán sản lượng'
    case 'contract': return 'Khoán hợp đồng'
    default: return value || '-'
  }
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

function escapeHtml(value: string) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function printBrandStyles(brand: PrintBrandSettings) {
  return `
    .brand-block { border-bottom: 2px solid ${brand.accentColor}; background: linear-gradient(135deg, ${brand.accentSoft} 0%, #ffffff 70%); border-radius: 14px 14px 0 0; padding: 18px 20px 14px; margin-bottom: 14px; }
    .brand-row { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .brand-left { display: flex; gap: 12px; align-items: flex-start; }
    .brand-badge { width: 54px; height: 54px; border-radius: 14px; background: ${brand.accentColor}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; overflow: hidden; }
    .brand-badge img { width: 100%; height: 100%; object-fit: cover; }
    .brand-name { font-size: 12px; letter-spacing: 1.3px; text-transform: uppercase; color: ${brand.accentColor}; font-weight: 700; }
    .brand-legal { font-size: 22px; font-weight: 800; margin-top: 4px; }
    .brand-tagline { font-size: 12px; color: #64748b; margin-top: 4px; }
    .brand-right { font-size: 12px; text-align: right; }
    .brand-footer-note { margin-top: 16px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    th { background: ${brand.accentColor} !important; color: #fff !important; }
  `
}

function renderPrintBrandHeader(brand: PrintBrandSettings, title: string, subtitle: string, rightHtml: string) {
  const badge = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.brandName)}" />`
    : escapeHtml(String(brand.brandName || 'TI').slice(0, 2).toUpperCase())
  return `
    <div class="brand-block">
      <div class="brand-row">
        <div>
          <div class="brand-left">
            <div class="brand-badge">${badge}</div>
            <div>
              <div class="brand-name">${escapeHtml(brand.brandName)}</div>
              <div class="brand-legal">${escapeHtml(brand.legalName)}</div>
              <div class="brand-tagline">${escapeHtml(brand.tagline || subtitle)}</div>
            </div>
          </div>
          <div style="margin-top:14px">
            <div style="font-size:24px;font-weight:800;text-transform:uppercase">${escapeHtml(title)}</div>
            <div style="font-size:13px;color:#475569;margin-top:4px">${escapeHtml(subtitle)}</div>
          </div>
        </div>
        <div class="brand-right">${rightHtml}</div>
      </div>
    </div>
  `
}

function renderPrintBrandFooter(brand: PrintBrandSettings) {
  return `<div class="brand-footer-note">${escapeHtml(brand.footerText || '')}</div>`
}

function openPrintHtml(html: string) {
  const win = window.open('', '_blank', 'width=1100,height=800')
  if (!win) return
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

function printSinglePaymentDoc(row: Payment, includeSignatureColumn: boolean, brand: PrintBrandSettings) {
  const receiver = row.worker?.full_name || row.crew?.crew_name || '-'
  const isAdvance = row.payment_type === 'advance'
  const isSettlement = row.payment_type === 'settlement'
  const title = isAdvance ? 'Phiếu tạm ứng nhân công' : isSettlement ? 'Phiếu tất toán nhân công' : 'Phiếu thanh toán nhân công'
  const subTitle = isAdvance
    ? 'Sử dụng cho nhân công công ty ứng trước tiền công/lương'
    : isSettlement
      ? 'Sử dụng để chốt số tiền công nợ còn lại của nhân công công ty'
      : 'Sử dụng để chi trả tiền công theo kỳ hoặc theo đợt'
  const html = `
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          body { font-family: Arial, sans-serif; color: #111827; }
          .sheet { width: 100%; }
          ${printBrandStyles(brand)}
          .head-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
          .brand-title { font-size: 13px; font-weight: 700; text-transform: uppercase; }
          .brand-sub { font-size: 12px; margin-top: 4px; }
          .doc-title { text-align: center; margin: 18px 0 12px; }
          .doc-title h1 { margin: 0; font-size: 24px; text-transform: uppercase; }
          .doc-title .sub { margin-top: 4px; font-size: 13px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin-top: 12px; font-size: 13px; }
          .amount-box { margin: 16px 0; padding: 14px 16px; border: 1px solid #cbd5e1; border-radius: 10px; background: #f8fafc; }
          .amount-title { font-size: 12px; color: #475569; text-transform: uppercase; }
          .amount-value { font-size: 28px; font-weight: 800; margin-top: 4px; }
          .note-box { min-height: 80px; border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; font-size: 12px; margin-top: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th, td { border: 1px solid #374151; padding: 8px; font-size: 12px; vertical-align: top; }
          th { background: #f3f4f6; text-align: left; font-weight: 700; }
          .footer { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; text-align: center; }
          .sign-title { font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 48px; }
          .sign-line { font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="sheet">
          ${renderPrintBrandHeader(
            brand,
            title,
            subTitle,
            `<div><b>Ngày lập:</b> ${escapeHtml(displayDate(row.payment_date))}</div><div><b>Loại:</b> ${escapeHtml(paymentTypeLabel(row.payment_type))}</div>`
          )}

          <div class="doc-title">
            <h1>${escapeHtml(title)}</h1>
            <div class="sub">${escapeHtml(subTitle)}</div>
          </div>

          <div class="meta-grid">
            <div><b>Dự án:</b> ${escapeHtml(row.project?.project_name || '-')}</div>
            <div><b>Người nhận:</b> ${escapeHtml(receiver)}</div>
            <div><b>Mã nhân công:</b> ${escapeHtml(row.worker?.worker_code || '-')}</div>
            <div><b>Phân công:</b> ${escapeHtml(row.engagement?.engagement_type ? engagementTypeLabel(row.engagement.engagement_type) : '-')}</div>
            <div><b>Đợt thanh toán:</b> ${escapeHtml(row.batch?.batch_name || '-')}</div>
            <div><b>Mã đợt:</b> ${escapeHtml(row.batch?.batch_code || '-')}</div>
          </div>

          <div class="amount-box">
            <div class="amount-title">Số tiền</div>
            <div class="amount-value">${escapeHtml(formatMoney(row.amount))}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Nội dung</th>
                <th style="width:160px">Giá trị</th>
                ${includeSignatureColumn ? '<th style="width:130px">Ký nhận</th>' : ''}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${escapeHtml(
                  isAdvance
                    ? 'Tạm ứng trước tiền công/lương cho nhân công công ty'
                    : isSettlement
                      ? 'Tất toán phần công nợ còn lại của nhân công công ty'
                      : 'Chi trả tiền công theo đợt'
                )}</td>
                <td style="text-align:right">${escapeHtml(formatMoney(row.amount))}</td>
                ${includeSignatureColumn ? '<td></td>' : ''}
              </tr>
            </tbody>
          </table>

          <div class="note-box">
            <b>Ghi chú:</b><br />
            ${escapeHtml(row.note || '-')}
          </div>

          <div class="footer">
            <div>
              <div class="sign-title">Người lập</div>
              <div class="sign-line">(Ký, ghi rõ họ tên)</div>
            </div>
            <div>
              <div class="sign-title">Người duyệt</div>
              <div class="sign-line">(Ký, ghi rõ họ tên)</div>
            </div>
            <div>
              <div class="sign-title">${includeSignatureColumn ? 'Người nhận tiền' : 'Đối chiếu'}</div>
              <div class="sign-line">(Ký, ghi rõ họ tên)</div>
            </div>
          </div>
          ${renderPrintBrandFooter(brand)}
        </div>
      </body>
    </html>
  `
  openPrintHtml(html)
}

function printInternalAdvanceReport(input: {
  rows: Payment[]
  from: string
  to: string
  projectName: string
  includeSignatureColumn: boolean
  brand: PrintBrandSettings
}) {
  const grouped = Array.from(
    input.rows.reduce((map, row) => {
      const workerId = String(row.worker?.id || '')
      if (!workerId) return map
      const current = map.get(workerId) || {
        worker_name: row.worker?.full_name || '-',
        worker_code: row.worker?.worker_code || '',
        total_amount: 0,
        count: 0,
      }
      current.total_amount += Number(row.amount || 0)
      current.count += 1
      map.set(workerId, current)
      return map
    }, new Map<string, { worker_name: string; worker_code: string; total_amount: number; count: number }>())
  )
  const totalAmount = input.rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const detailRows = input.rows.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(row.worker?.full_name || '-')}</td>
      <td>${escapeHtml(row.worker?.worker_code || '-')}</td>
      <td>${escapeHtml(displayDate(row.payment_date))}</td>
      <td style="text-align:right">${escapeHtml(formatMoney(row.amount))}</td>
      <td>${escapeHtml(row.note || row.batch?.batch_name || '')}</td>
      ${input.includeSignatureColumn ? '<td></td>' : ''}
    </tr>
  `).join('')
  const groupedRows = grouped.map(([_, row], index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(row.worker_name)}</td>
      <td>${escapeHtml(row.worker_code || '-')}</td>
      <td style="text-align:right">${row.count}</td>
      <td style="text-align:right">${escapeHtml(formatMoney(row.total_amount))}</td>
      ${input.includeSignatureColumn ? '<td></td>' : ''}
    </tr>
  `).join('')
  const html = `
    <html>
      <head>
        <title>Báo cáo tạm ứng nội bộ</title>
        <style>
          @page { size: A4; margin: 16mm; }
          body { font-family: Arial, sans-serif; color: #111827; }
          .sheet { width: 100%; }
          ${printBrandStyles(input.brand)}
          .title { text-align:center; margin: 12px 0 18px; }
          .title h1 { margin:0; font-size:24px; text-transform:uppercase; }
          .title .sub { margin-top:4px; font-size:13px; }
          .meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 18px; font-size:13px; margin-bottom:12px; }
          .summary { margin: 10px 0 14px; padding: 10px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:13px; }
          table { width:100%; border-collapse:collapse; margin-top:12px; }
          th, td { border:1px solid #374151; padding:8px; font-size:12px; vertical-align:top; }
          th { background:#f3f4f6; text-align:left; font-weight:700; }
          .section-title { margin-top: 14px; font-size:13px; font-weight:700; text-transform:uppercase; }
          .footer { margin-top: 28px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:24px; text-align:center; }
          .sign-title { font-size:12px; font-weight:700; text-transform:uppercase; margin-bottom:48px; }
        </style>
      </head>
      <body>
        <div class="sheet">
          ${renderPrintBrandHeader(
            input.brand,
            'Báo cáo tạm ứng nội bộ',
            'Theo nhân công công ty trong khoảng thời gian đã chọn',
            `<div><b>Dự án:</b> ${escapeHtml(input.projectName)}</div><div><b>Kỳ báo cáo:</b> ${escapeHtml(displayDate(input.from || null))} - ${escapeHtml(displayDate(input.to || null))}</div>`
          )}
          <div class="title">
            <h1>Báo cáo tạm ứng nội bộ</h1>
            <div class="sub">Theo nhân công công ty trong khoảng thời gian đã chọn</div>
          </div>
          <div class="meta-grid">
            <div><b>Dự án:</b> ${escapeHtml(input.projectName)}</div>
            <div><b>Kỳ báo cáo:</b> ${escapeHtml(displayDate(input.from || null))} - ${escapeHtml(displayDate(input.to || null))}</div>
          </div>
          <div class="summary">
            <div><b>Số dòng tạm ứng:</b> ${input.rows.length}</div>
            <div><b>Số nhân công có tạm ứng:</b> ${grouped.length}</div>
            <div><b>Tổng tiền tạm ứng:</b> ${escapeHtml(formatMoney(totalAmount))}</div>
          </div>

          <div class="section-title">Tổng hợp theo nhân công</div>
          <table>
            <thead>
              <tr>
                <th style="width:48px">STT</th>
                <th>Nhân công</th>
                <th style="width:110px">Mã</th>
                <th style="width:100px">Số lần</th>
                <th style="width:150px">Tổng tạm ứng</th>
                ${input.includeSignatureColumn ? '<th style="width:120px">Ký nhận</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${groupedRows || `<tr><td colspan="${input.includeSignatureColumn ? 6 : 5}">Không có dữ liệu tạm ứng.</td></tr>`}
            </tbody>
          </table>

          <div class="section-title">Chi tiết từng lần tạm ứng</div>
          <table>
            <thead>
              <tr>
                <th style="width:48px">STT</th>
                <th>Nhân công</th>
                <th style="width:110px">Mã</th>
                <th style="width:110px">Ngày</th>
                <th style="width:140px">Số tiền</th>
                <th>Ghi chú</th>
                ${input.includeSignatureColumn ? '<th style="width:120px">Ký nhận</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${detailRows || `<tr><td colspan="${input.includeSignatureColumn ? 7 : 6}">Không có dữ liệu tạm ứng.</td></tr>`}
            </tbody>
          </table>

          <div class="footer">
            <div><div class="sign-title">Người lập</div></div>
            <div><div class="sign-title">Người duyệt</div></div>
            <div><div class="sign-title">Kế toán / thủ quỹ</div></div>
          </div>
          ${renderPrintBrandFooter(input.brand)}
        </div>
      </body>
    </html>
  `
  openPrintHtml(html)
}

function printBatch(batch: PaymentBatch, includeSignatureColumn: boolean, printMode: 'payments' | 'attendance_summary', brand: PrintBrandSettings) {
  const rows = Array.isArray(batch.payments) ? batch.payments : []
  const attendanceRows = Array.isArray(batch.attendance_links) ? batch.attendance_links.map((x) => x.attendance).filter(Boolean) : []
  const useAttendanceSummary = printMode === 'attendance_summary'
  const bodyRows = rows.map((row, index) => {
    const receiver = row.worker?.full_name || row.crew?.crew_name || '-'
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(receiver)}</td>
        <td>${escapeHtml(paymentTypeLabel(row.payment_type))}</td>
        <td>${escapeHtml(displayDate(row.payment_date))}</td>
        <td style="text-align:right">${escapeHtml(formatMoney(row.amount))}</td>
        <td>${escapeHtml(row.note || '')}</td>
        ${includeSignatureColumn ? '<td></td>' : ''}
      </tr>
    `
  }).join('')
  const totalText = formatMoney(batch.total_amount || 0)
  const attendanceTotalWork = attendanceRows.reduce((sum, row: any) => sum + Number(row?.work_qty || 0), 0)
  const attendanceTotalAmount = attendanceRows.reduce((sum, row: any) => sum + Number(row?.amount || 0), 0)
  const attendanceGroupedRows = Array.from(
    attendanceRows.reduce((map: Map<string, { workerName: string; workerCode: string; totalWork: number; totalAmount: number }>, row: any) => {
      const workerId = String(row?.worker?.id || row?.worker?.worker_code || row?.worker?.full_name || 'unknown')
      const current = map.get(workerId) || {
        workerName: row?.worker?.full_name || '-',
        workerCode: row?.worker?.worker_code || '',
        totalWork: 0,
        totalAmount: 0,
      }
      current.totalWork += Number(row?.work_qty || 0)
      current.totalAmount += Number(row?.amount || 0)
      map.set(workerId, current)
      return map
    }, new Map())
  ).map(([key, value], index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(value.workerName)}</td>
      <td>${escapeHtml(value.workerCode || '')}</td>
      <td style="text-align:right">${escapeHtml(String(value.totalWork.toLocaleString('vi-VN')))}</td>
      <td style="text-align:right">${escapeHtml(formatMoney(value.totalAmount))}</td>
      ${includeSignatureColumn ? '<td></td>' : ''}
    </tr>
  `).join('')
  const attendanceBodyRows = attendanceRows.map((row: any, index: number) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(row?.worker?.full_name || '-')}</td>
      <td>${escapeHtml(displayDate(row?.attendance_date || null))}</td>
      <td>${escapeHtml(shiftLabel(row?.shift_type || null))}</td>
      <td style="text-align:right">${escapeHtml(String(Number(row?.work_qty || 0).toLocaleString('vi-VN')))}</td>
      <td style="text-align:right">${escapeHtml(formatMoney(row?.amount))}</td>
      <td>${escapeHtml(row?.diary_entry?.title || '')}</td>
    </tr>
  `).join('')
  const docTitle = paymentTypeDocumentTitle(batch.payment_type)
  const docSubtitle = paymentTypeDocumentSubtitle(batch.payment_type)
  const noteText = paymentTypeNote(batch.payment_type)
  const html = `
    <html>
      <head>
        <title>Đợt thanh toán công ${escapeHtml(batch.batch_code)}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          body { font-family: Arial, sans-serif; color: #111827; }
          .sheet { width: 100%; }
          ${printBrandStyles(brand)}
          .head-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
          .unit-title { font-size: 13px; font-weight: 700; text-transform: uppercase; }
          .unit-sub { font-size: 12px; margin-top: 4px; }
          .doc-code { font-size: 12px; text-align: right; }
          .doc-title { text-align: center; margin: 12px 0 6px; }
          .doc-title h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
          .doc-title .sub { margin-top: 4px; font-size: 13px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; margin: 14px 0; font-size: 13px; }
          .summary { margin: 12px 0 14px; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; }
          .summary-row { margin-bottom: 4px; }
          .summary-row:last-child { margin-bottom: 0; }
          .section-title { margin: 12px 0 6px; font-size: 13px; font-weight: 700; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #374151; padding: 8px; font-size: 12px; vertical-align: top; }
          th { background: #f3f4f6; text-align: left; font-weight: 700; }
          .note-box { margin-top: 12px; min-height: 60px; border: 1px solid #d1d5db; padding: 10px; font-size: 12px; }
          .footer { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; text-align: center; }
          .sign-title { font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 48px; }
          .sign-line { font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="sheet">
          ${renderPrintBrandHeader(
            brand,
            docTitle,
            docSubtitle,
            `<div><b>Mã đợt:</b> ${escapeHtml(batch.batch_code)}</div><div><b>Trạng thái:</b> ${escapeHtml(batchStatusLabel(batch.status))}</div>`
          )}

          <div class="doc-title">
            <h1>${escapeHtml(docTitle)}</h1>
            <div class="sub">${escapeHtml(docSubtitle)}</div>
          </div>

          <div class="meta-grid">
            <div><b>Tên đợt:</b> ${escapeHtml(batch.batch_name)}</div>
            <div><b>Dự án:</b> ${escapeHtml(batch.project?.project_name || '-')}</div>
            <div><b>Kỳ thanh toán:</b> ${escapeHtml(displayDate(batch.period_from))} - ${escapeHtml(displayDate(batch.period_to))}</div>
            <div><b>Loại đợt:</b> ${escapeHtml(paymentTypeLabel(batch.payment_type))}</div>
            <div><b>Ngày chi dự kiến:</b> ${escapeHtml(displayDate(batch.planned_payment_date))}</div>
            <div><b>Ngày chi thực tế:</b> ${escapeHtml(displayDate(batch.actual_payment_date))}</div>
          </div>

          <div class="summary">
            <div class="summary-row"><b>${useAttendanceSummary ? 'Số dòng chấm công' : 'Số dòng thanh toán'}:</b> ${useAttendanceSummary ? attendanceRows.length : rows.length}</div>
            <div class="summary-row"><b>${useAttendanceSummary ? 'Tổng tiền công' : 'Tổng giá trị'}:</b> ${escapeHtml(useAttendanceSummary ? formatMoney(attendanceTotalAmount) : totalText)}</div>
            <div class="summary-row"><b>Số dòng chấm công gắn với đợt:</b> ${attendanceRows.length}</div>
            <div class="summary-row"><b>Ghi chú đợt:</b> ${escapeHtml(batch.note || '-')}</div>
          </div>

          <div class="section-title">Tổng hợp theo nhân công</div>
          <table>
            <thead>
              <tr>
                <th style="width:48px">STT</th>
                <th>Nhân công</th>
                <th style="width:110px">Ma</th>
                <th style="width:90px">Cong</th>
                <th style="width:130px">Tien cong</th>
                ${includeSignatureColumn ? '<th style="width:120px">Ký nhận</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${attendanceGroupedRows || `<tr><td colspan="${includeSignatureColumn ? 6 : 5}">Chưa gắn chấm công nào vào đợt này.</td></tr>`}
              ${attendanceRows.length ? `
                <tr>
                  <td colspan="3" style="text-align:right; font-weight:700">Tổng công / tiền công</td>
                  <td style="text-align:right; font-weight:700">${escapeHtml(String(attendanceTotalWork.toLocaleString('vi-VN')))}</td>
                  <td style="text-align:right; font-weight:700">${escapeHtml(formatMoney(attendanceTotalAmount))}</td>
                  ${includeSignatureColumn ? '<td></td>' : ''}
                </tr>
              ` : ''}
            </tbody>
          </table>

          <div class="section-title">Chi tiết chấm công theo nhật ký</div>
          <table>
            <thead>
              <tr>
                <th style="width:48px">STT</th>
                <th>Nhân công</th>
                <th style="width:110px">Ngay</th>
                <th style="width:110px">Ca</th>
                <th style="width:90px">Cong</th>
                <th style="width:130px">Số tiền</th>
                <th>Nhật ký / Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${attendanceBodyRows || '<tr><td colspan="7">Chưa gắn chấm công nào vào đợt này.</td></tr>'}
            </tbody>
          </table>

          ${useAttendanceSummary ? '' : `
          <div class="section-title">Chi tiết thanh toán</div>
          <table>
            <thead>
              <tr>
                <th style="width:48px">STT</th>
                <th>Người nhận / Đội</th>
                <th style="width:110px">Loai</th>
                <th style="width:110px">Ngay</th>
                <th style="width:130px">Số tiền</th>
                <th>Ghi chú</th>
                ${includeSignatureColumn ? '<th style="width:120px">Ký nhận</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${bodyRows || `<tr><td colspan="${includeSignatureColumn ? 7 : 6}">Chưa có dòng thanh toán.</td></tr>`}
              ${rows.length ? `
                <tr>
                  <td colspan="4" style="text-align:right; font-weight:700">Tổng cộng</td>
                  <td style="text-align:right; font-weight:700">${escapeHtml(totalText)}</td>
                  <td></td>
                  ${includeSignatureColumn ? '<td></td>' : ''}
                </tr>
              ` : ''}
            </tbody>
          </table>`}

          <div class="note-box">
            <b>Lưu ý:</b> ${escapeHtml(noteText)}
          </div>

          <div class="footer">
            <div>
              <div class="sign-title">Người lập</div>
              <div class="sign-line">(Ký, ghi rõ họ tên)</div>
            </div>
            <div>
              <div class="sign-title">Người duyệt</div>
              <div class="sign-line">(Ký, ghi rõ họ tên)</div>
            </div>
            <div>
              <div class="sign-title">Đại diện nhân công</div>
              <div class="sign-line">(Ký, ghi rõ họ tên)</div>
            </div>
          </div>
          ${renderPrintBrandFooter(brand)}
        </div>
      </body>
    </html>
  `
  openPrintHtml(html)
}

function chooseAndPrintBatch(batch: PaymentBatch, brand: PrintBrandSettings) {
  const includeSignatureColumn = window.confirm('Bạn có muốn in kèm cột ký nhận cho từng dòng thanh toán không?')
  const attendanceCount = Array.isArray(batch.attendance_links) ? batch.attendance_links.length : 0
  const paymentCount = Array.isArray(batch.payments) ? batch.payments.length : 0
  let printMode: 'payments' | 'attendance_summary' = 'payments'
  if (attendanceCount > 0) {
    const useAttendanceMode = window.confirm('Bạn có muốn in theo tổng hợp nhân công + chi tiết chấm công theo nhật ký không?')
    printMode = useAttendanceMode ? 'attendance_summary' : 'payments'
  } else if (paymentCount === 0) {
    printMode = 'attendance_summary'
  }
  printBatch(batch, includeSignatureColumn, printMode, brand)
}

export default function LaborPaymentsPage() {
  const searchParams = useSearchParams()
  const initialProjectId = useMemo(() => String(searchParams.get('project_id') || ''), [searchParams])

  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [printBrand, setPrintBrand] = useState<PrintBrandSettings>(PRINT_BRAND_DEFAULT)
  const [projects, setProjects] = useState<Project[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [engagements, setEngagements] = useState<Engagement[]>([])
  const [batches, setBatches] = useState<PaymentBatch[]>([])
  const [rows, setRows] = useState<Payment[]>([])
  const [attendanceRows, setAttendanceRows] = useState<Attendance[]>([])
  const [workerBalances, setWorkerBalances] = useState<WorkerBalance[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId)
  const [reportFilters, setReportFilters] = useState({
    from: DEFAULT_FROM,
    to: DEFAULT_TO,
    payment_type: '',
  })
  const [editingId, setEditingId] = useState('')
  const [editingBatchId, setEditingBatchId] = useState('')
  const [linkingBatchId, setLinkingBatchId] = useState('')
  const [showBatchForm, setShowBatchForm] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [showCancelledBatches, setShowCancelledBatches] = useState(false)
  const [showCancelledPayments, setShowCancelledPayments] = useState(false)
  const [selectedAttendanceIdsByBatch, setSelectedAttendanceIdsByBatch] = useState<Record<string, string[]>>({})
  const [form, setForm] = useState(EMPTY_FORM)
  const [batchForm, setBatchForm] = useState(EMPTY_BATCH_FORM)

  async function loadMeta() {
    const [pRes, wRes, cRes, eRes, bRes] = await Promise.all([
      fetch('/api/projects?limit=200'),
      fetch('/api/labor/workers'),
      fetch('/api/labor/crews'),
      fetch('/api/labor/engagements?active_only=true'),
      fetch('/api/labor/payment-batches'),
    ])
    const [pJson, wJson, cJson, eJson, bJson] = await Promise.all([
      pRes.json().catch(() => ({})),
      wRes.json().catch(() => ({})),
      cRes.json().catch(() => ({})),
      eRes.json().catch(() => ({})),
      bRes.json().catch(() => ({})),
    ])
    setProjects(Array.isArray(pJson?.data) ? pJson.data : [])
    setWorkers(Array.isArray(wJson?.data) ? wJson.data : [])
    setCrews(Array.isArray(cJson?.data) ? cJson.data : [])
    setEngagements(Array.isArray(eJson?.data) ? eJson.data : [])
    setBatches(Array.isArray(bJson?.data) ? bJson.data : [])
  }

  async function loadRows(projectId = selectedProjectId, filters = reportFilters) {
    setLoading(true)
    try {
      const sp = new URLSearchParams()
      if (projectId) sp.set('project_id', projectId)
      if (filters.from) sp.set('from', filters.from)
      if (filters.to) sp.set('to', filters.to)
      if (filters.payment_type) sp.set('payment_type', filters.payment_type)
      const url = `/api/labor/payments?${sp.toString()}`
      const batchSp = new URLSearchParams()
      if (projectId) batchSp.set('project_id', projectId)
      const batchUrl = `/api/labor/payment-batches?${batchSp.toString()}`
      const attendanceSp = new URLSearchParams()
      attendanceSp.set('attendance_status', 'confirmed')
      if (projectId) attendanceSp.set('project_id', projectId)
      if (filters.from) attendanceSp.set('from', filters.from)
      if (filters.to) attendanceSp.set('to', filters.to)
      const balanceSp = new URLSearchParams()
      balanceSp.set('worker_category', 'company')
      if (projectId) balanceSp.set('project_id', projectId)
      if (filters.from) balanceSp.set('from', filters.from)
      if (filters.to) balanceSp.set('to', filters.to)
      const [res, attendanceRes, batchRes, balanceRes] = await Promise.all([
        fetch(url),
        fetch(`/api/labor/attendances?${attendanceSp.toString()}`),
        fetch(batchUrl),
        fetch(`/api/labor/worker-balances?${balanceSp.toString()}`),
      ])
      const [json, attendanceJson, batchJson, balanceJson] = await Promise.all([
        res.json().catch(() => ({})),
        attendanceRes.json().catch(() => ({})),
        batchRes.json().catch(() => ({})),
        balanceRes.json().catch(() => ({})),
      ])
      setRows(Array.isArray(json?.data) ? json.data : [])
      setAttendanceRows(Array.isArray(attendanceJson?.data) ? attendanceJson.data : [])
      setBatches(Array.isArray(batchJson?.data) ? batchJson.data : [])
      setWorkerBalances(Array.isArray(balanceJson?.data) ? balanceJson.data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMeta()
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      const res = await fetch('/api/settings/print-brand', { cache: 'no-store' }).catch(() => null)
      const json = await res?.json().catch(() => ({}))
      if (!active || !res?.ok) return
      setPrintBrand(mergePrintBrandSettings(json?.data || null))
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!initialProjectId) return
    setSelectedProjectId(initialProjectId)
    setForm((p) => ({ ...p, project_id: initialProjectId }))
    setBatchForm((p) => ({ ...p, project_id: initialProjectId }))
  }, [initialProjectId])

  useEffect(() => {
    void loadRows(selectedProjectId, reportFilters)
  }, [selectedProjectId])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    setSelectedAttendanceIdsByBatch((prev) => {
      const next = { ...prev }
      for (const batch of batches) {
        if (next[batch.id]) continue
        next[batch.id] = Array.isArray(batch.attendance_links)
          ? batch.attendance_links.map((x) => x.attendance?.id).filter(Boolean) as string[]
          : []
      }
      return next
    })
  }, [batches])

  function applyEngagement(engagementId: string) {
    const engagement = engagements.find((x) => x.id === engagementId)
    setForm((p) => ({
      ...p,
      engagement_id: engagementId,
      project_id: engagement?.project?.id || p.project_id,
      worker_id: engagement?.worker?.id || p.worker_id,
      crew_id: engagement?.crew?.id || p.crew_id,
    }))
    if (engagement?.project?.id) {
      setSelectedProjectId(engagement.project.id)
      setBatchForm((p) => ({ ...p, project_id: engagement.project?.id || p.project_id }))
    }
  }

  function applyBatch(batchId: string) {
    const batch = batches.find((x) => x.id === batchId)
    setForm((p) => ({
      ...p,
      batch_id: batchId,
      project_id: batch?.project?.id || p.project_id,
      payment_type: batch?.payment_type || p.payment_type,
    }))
    if (batch?.project?.id) setSelectedProjectId(batch.project.id)
  }

  function applyWorker(workerId: string) {
    const balance = workerBalances.find((row) => row.worker_id === workerId)
    setForm((p) => {
      let nextAmount = p.amount
      if (p.payment_type === 'settlement' && balance) {
        nextAmount = String(balance.outstanding_amount || 0)
      }
      return {
        ...p,
        worker_id: workerId,
        amount: nextAmount,
      }
    })
  }

  async function submitBatch() {
    if (!batchForm.project_id || !batchForm.batch_name.trim()) {
      setToast('Thiếu dự án hoặc tên đợt thanh toán')
      return
    }
    const payload = {
      project_id: batchForm.project_id,
      batch_name: batchForm.batch_name.trim(),
      period_from: batchForm.period_from || null,
      period_to: batchForm.period_to || null,
      planned_payment_date: batchForm.planned_payment_date || null,
      payment_type: batchForm.payment_type,
      note: batchForm.note.trim() || null,
    }
    const url = editingBatchId ? `/api/labor/payment-batches/${editingBatchId}` : '/api/labor/payment-batches'
    const method = editingBatchId ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json?.error || 'Không lưu được đợt thanh toán')
      return
    }
    setToast(editingBatchId ? 'Đã cập nhật đợt thanh toán' : 'Đã tạo đợt thanh toán')
    setEditingBatchId('')
    setShowBatchForm(false)
    setBatchForm({ ...EMPTY_BATCH_FORM, project_id: selectedProjectId })
    await loadRows(selectedProjectId, reportFilters)
  }

  async function doBatchAction(batchId: string, action: 'approve' | 'cancel' | 'reopen') {
    let payload: any = { action }
    if (action === 'cancel') {
      const reason = prompt('Lý do hủy đợt thanh toán:')
      if (reason === null) return
      payload.cancel_reason = reason
    }
    const res = await fetch(`/api/labor/payment-batches/${batchId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json?.error || 'Không xử lý được đợt thanh toán')
      return
    }
    setToast('Đã cập nhật trạng thái đợt thanh toán')
    await loadRows(selectedProjectId, reportFilters)
  }

  async function saveBatchAttendanceLinks(batchId: string) {
    const attendanceIds = selectedAttendanceIdsByBatch[batchId] || []
    const res = await fetch(`/api/labor/payment-batches/${batchId}/attendance-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendance_ids: attendanceIds }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json?.error || 'Không lưu được danh sách chấm công của đợt')
      return
    }
    setToast('Đã cập nhật chấm công thuộc đợt thanh toán')
    setLinkingBatchId('')
    await loadRows(selectedProjectId, reportFilters)
  }

  function toggleAttendanceForBatch(batchId: string, attendanceId: string, checked: boolean) {
    setSelectedAttendanceIdsByBatch((prev) => {
      const current = Array.isArray(prev[batchId]) ? prev[batchId] : []
      const next = checked
        ? Array.from(new Set([...current, attendanceId]))
        : current.filter((id) => id !== attendanceId)
      return { ...prev, [batchId]: next }
    })
  }

  async function submit() {
    if (!form.project_id || !form.payment_date || !form.amount.trim()) {
      setToast('Thiếu dự án, ngày thanh toán hoặc số tiền')
      return
    }
    const payload = {
      project_id: form.project_id,
      batch_id: form.batch_id || null,
      engagement_id: form.engagement_id || null,
      worker_id: form.worker_id || null,
      crew_id: form.crew_id || null,
      payment_date: form.payment_date,
      payment_type: form.payment_type,
      amount: form.amount.trim(),
      note: form.note.trim() || null,
    }
    const url = editingId ? `/api/labor/payments/${editingId}` : '/api/labor/payments'
    const method = editingId ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json?.error || 'Không lưu được thanh toán công')
      return
    }
    setToast(editingId ? 'Đã cập nhật thanh toán công' : 'Đã tạo thanh toán công')
    setEditingId('')
    setShowPaymentForm(false)
    setForm({ ...EMPTY_FORM, project_id: selectedProjectId })
    await loadRows(selectedProjectId)
  }

  const activeRows = rows.filter((x) => {
    if (selectedProjectId && x.project?.id !== selectedProjectId) return false
    if (!showCancelledPayments && x.batch?.status === 'cancelled') return false
    return true
  })
  const activeBatches = batches.filter((x) => {
    if (selectedProjectId && x.project?.id !== selectedProjectId) return false
    if (!showCancelledBatches && x.status === 'cancelled') return false
    return true
  })
  const totalAmount = activeRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const paidAmount = activeRows.reduce((sum, row) => sum + ((!row.batch || row.batch.status !== 'cancelled') ? Number(row.amount || 0) : 0), 0)
  const totalAttendanceAmount = attendanceRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const payableInPeriod = Math.max(0, totalAttendanceAmount - paidAmount)
  const groupedByWorker = useMemo(() => {
    const map = new Map<string, { worker_name: string; worker_code: string; total_amount: number; count: number }>()
    for (const row of activeRows) {
      const key = String(row.worker?.id || row.crew?.id || '')
      const name = row.worker?.full_name || row.crew?.crew_name || '-'
      const code = row.worker?.worker_code || row.crew?.crew_key || ''
      const prev = map.get(key) || { worker_name: name, worker_code: code, total_amount: 0, count: 0 }
      prev.total_amount += Number(row.amount || 0)
      prev.count += 1
      map.set(key, prev)
    }
    return Array.from(map.values()).sort((a, b) => b.total_amount - a.total_amount)
  }, [activeRows])
  const groupedByProject = useMemo(() => {
    const map = new Map<string, { project_name: string; total_amount: number; count: number }>()
    for (const row of activeRows) {
      const key = String(row.project?.id || '')
      const name = row.project?.project_name || '-'
      const prev = map.get(key) || { project_name: name, total_amount: 0, count: 0 }
      prev.total_amount += Number(row.amount || 0)
      prev.count += 1
      map.set(key, prev)
    }
    return Array.from(map.values()).sort((a, b) => b.total_amount - a.total_amount)
  }, [activeRows])
  const batchSummary = useMemo(() => {
    return activeBatches.map((batch) => ({
      ...batch,
      totalAmount: Number(batch.total_amount || 0),
      paymentAmount: Number(batch.payment_amount || batch.total_amount || 0),
      attendanceAmount: Number(batch.attendance_amount || 0),
      paymentCount: Number(batch.payment_count || 0),
      attendanceCount: Number(batch.attendance_count || 0),
      attendanceWorkQty: Array.isArray(batch.attendance_links)
        ? batch.attendance_links.reduce((sum, link) => sum + Number(link.attendance?.work_qty || 0), 0)
        : 0,
    }))
  }, [activeBatches])
  const batchStatusStats = useMemo(() => {
    return {
      draft_count: activeBatches.filter((x) => x.status === 'draft').length,
      approved_count: activeBatches.filter((x) => x.status === 'approved').length,
      paid_count: activeBatches.filter((x) => x.settlement_status === 'paid').length,
      cancelled_count: activeBatches.filter((x) => x.status === 'cancelled').length,
      draft_amount: sumBatchAmount(activeBatches, 'draft'),
      approved_amount: sumBatchAmount(activeBatches, 'approved'),
      paid_amount: activeBatches
        .filter((x) => x.settlement_status === 'paid')
        .reduce((sum, x) => sum + Number((x as any).payment_amount || x.total_amount || 0), 0),
      cancelled_amount: sumBatchAmount(activeBatches, 'cancelled'),
    }
  }, [activeBatches])
  const selectedBatchForForm = useMemo(
    () => activeBatches.find((x) => x.id === form.batch_id) || null,
    [activeBatches, form.batch_id]
  )
  const selectedPaymentType = (selectedBatchForForm?.payment_type || form.payment_type || 'payment') as 'advance' | 'payment' | 'settlement'
  const selectedBatchLocked = !!selectedBatchForForm && selectedBatchForForm.status !== 'draft'
  const companyWorkers = useMemo(
    () => workers.filter((worker) => String(worker.worker_category || '') === 'company'),
    [workers]
  )
  const batchWorkerOptions = useMemo(() => {
    if (!selectedBatchForForm || !Array.isArray(selectedBatchForForm.attendance_links) || !selectedBatchForForm.attendance_links.length) {
      return workers.map((worker) => ({
        id: worker.id,
        full_name: worker.full_name,
        worker_code: worker.worker_code,
        total_amount: null as number | null,
        paid_amount: null as number | null,
        remaining_amount: null as number | null,
      }))
    }

    const attendanceMap = new Map<string, { id: string; full_name: string; worker_code: string; total_amount: number }>()
    for (const link of selectedBatchForForm.attendance_links) {
      const attendance = link.attendance
      const worker = attendance?.worker
      if (!worker?.id) continue
      const prev = attendanceMap.get(worker.id) || {
        id: worker.id,
        full_name: worker.full_name || '-',
        worker_code: worker.worker_code || '',
        total_amount: 0,
      }
      prev.total_amount += Number(attendance?.amount || 0)
      attendanceMap.set(worker.id, prev)
    }

    const paidMap = new Map<string, number>()
    for (const row of activeRows.filter((x) => x.batch?.id === selectedBatchForForm.id && (!editingId || x.id !== editingId))) {
      const workerId = String(row.worker?.id || '').trim()
      if (!workerId) continue
      paidMap.set(workerId, (paidMap.get(workerId) || 0) + Number(row.amount || 0))
    }

    return Array.from(attendanceMap.values()).map((worker) => {
      const paid_amount = paidMap.get(worker.id) || 0
      return {
        ...worker,
        paid_amount,
        remaining_amount: Math.max(0, worker.total_amount - paid_amount),
      }
    }).sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [selectedBatchForForm, workers, activeRows, editingId])
  const selectableWorkers = useMemo(() => {
    if (selectedPaymentType === 'payment' && selectedBatchForForm && Array.isArray(selectedBatchForForm.attendance_links) && selectedBatchForForm.attendance_links.length) {
      return batchWorkerOptions
    }
    const base = selectedPaymentType === 'payment' ? workers : companyWorkers
    return base
      .map((worker) => ({
        id: worker.id,
        full_name: worker.full_name,
        worker_code: worker.worker_code,
        total_amount: null as number | null,
        paid_amount: null as number | null,
        remaining_amount: null as number | null,
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [selectedPaymentType, selectedBatchForForm, batchWorkerOptions, workers, companyWorkers])
  const selectedWorkerBalance = useMemo(
    () => workerBalances.find((row) => row.worker_id === form.worker_id) || null,
    [workerBalances, form.worker_id]
  )
  const companyBalanceTotals = useMemo(() => ({
    attendance_amount: workerBalances.reduce((sum, row) => sum + Number(row.attendance_amount || 0), 0),
    advance_amount: workerBalances.reduce((sum, row) => sum + Number(row.advance_amount || 0), 0),
    payment_amount: workerBalances.reduce((sum, row) => sum + Number(row.payment_amount || 0), 0),
    settlement_amount: workerBalances.reduce((sum, row) => sum + Number(row.settlement_amount || 0), 0),
    outstanding_amount: workerBalances.reduce((sum, row) => sum + Number(row.outstanding_amount || 0), 0),
    overpaid_amount: workerBalances.reduce((sum, row) => sum + Number(row.overpaid_amount || 0), 0),
  }), [workerBalances])
  const internalAdvanceRows = useMemo(
    () => activeRows.filter((row) => row.payment_type === 'advance' && !!row.worker?.id),
    [activeRows]
  )
  const internalSettlementRows = useMemo(
    () => activeRows.filter((row) => row.payment_type === 'settlement' && !!row.worker?.id),
    [activeRows]
  )
  const internalAdvanceSummary = useMemo(() => {
    const totalAmount = internalAdvanceRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    const workerCount = new Set(internalAdvanceRows.map((row) => row.worker?.id).filter(Boolean)).size
    return {
      totalAmount,
      workerCount,
      rowCount: internalAdvanceRows.length,
    }
  }, [internalAdvanceRows])

  if (loading) return <div style={{ padding: 16 }}>Đang tải dữ liệu...</div>

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)' }}>NHÂN CÔNG</div>
          <h1 style={{ margin: '4px 0 4px', fontSize: 22, fontWeight: 800 }}>Thanh toán công</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Ghi nhận tạm ứng, thanh toán đợt và quyết toán cho nhân công / đội thợ theo dự án.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link className="btn-ghost" href="/labor">Danh mục nhân công</Link>
          <Link className="btn-ghost" href="/labor/assignments">Phân công khoán việc</Link>
          <Link className="btn-ghost" href="/labor/attendance">Chấm công</Link>
          <Link className="btn-ghost" href="/labor/reports">Báo cáo</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Số dòng thanh toán</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{activeRows.length}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Giá trị các dòng thanh toán</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(totalAmount)}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Dự án đang lọc</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{projects.find((x) => x.id === selectedProjectId)?.project_name || 'Tất cả dự án'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Công đã ghi nhận trong kỳ</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(totalAttendanceAmount)}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Đã chi thực tế trong kỳ</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(paidAmount)}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Còn phải trả trong kỳ</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: payableInPeriod > 0 ? 'var(--orange)' : 'var(--green)' }}>{formatMoney(payableInPeriod)}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Bộ lọc thanh toán công</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Từ ngày</div>
            <input className="input" type="date" value={reportFilters.from} onChange={(e) => setReportFilters((p) => ({ ...p, from: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đến ngày</div>
            <input className="input" type="date" value={reportFilters.to} onChange={(e) => setReportFilters((p) => ({ ...p, to: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Loại thanh toán</div>
            <select className="select" value={reportFilters.payment_type} onChange={(e) => setReportFilters((p) => ({ ...p, payment_type: e.target.value }))}>
              <option value="">(Tất cả)</option>
              <option value="advance">Tạm ứng</option>
              <option value="payment">Thanh toán đợt</option>
              <option value="settlement">Tất toán</option>
            </select>
          </div>
          <button className="btn-primary" onClick={() => void loadRows(selectedProjectId, reportFilters)}>Xem báo cáo</button>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10, fontSize: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={showCancelledBatches} onChange={(e) => setShowCancelledBatches(e.target.checked)} />
            Hiện đợt thanh toán đã hủy
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={showCancelledPayments} onChange={(e) => setShowCancelledPayments(e.target.checked)} />
            Hiện dòng thanh toán thuộc đợt đã hủy
          </label>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Công nợ nhân công công ty</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <button
            className="btn-ghost"
            onClick={() => {
              const includeSignatureColumn = window.confirm('Bạn có muốn in kèm cột ký nhận cho báo cáo tạm ứng nội bộ không?')
              printInternalAdvanceReport({
                rows: internalAdvanceRows,
                from: reportFilters.from,
                to: reportFilters.to,
                projectName: projects.find((x) => x.id === selectedProjectId)?.project_name || 'Tất cả dự án',
                includeSignatureColumn,
                brand: printBrand,
              })
            }}
          >
            In báo cáo tạm ứng nội bộ
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)' }}>Tiền công đã ghi nhận</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{formatMoney(companyBalanceTotals.attendance_amount)}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)' }}>Đã tạm ứng</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{formatMoney(companyBalanceTotals.advance_amount)}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)' }}>Đã thanh toán đợt</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{formatMoney(companyBalanceTotals.payment_amount)}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)' }}>Đã tất toán</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{formatMoney(companyBalanceTotals.settlement_amount)}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)' }}>Còn phải tất toán</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: companyBalanceTotals.outstanding_amount > 0 ? 'var(--orange)' : 'var(--green)' }}>
              {formatMoney(companyBalanceTotals.outstanding_amount)}
            </div>
          </div>
        </div>

        <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
            <div>Nhân công công ty</div>
            <div>Tiền công</div>
            <div>Tạm ứng</div>
            <div>Thanh toán đợt</div>
            <div>Tất toán</div>
            <div>Còn lại</div>
          </div>
          {workerBalances.map((row) => (
            <div key={row.worker_id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{row.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{row.worker_code || ''}</div>
              </div>
              <div style={{ fontSize: 12 }}>{formatMoney(row.attendance_amount)}</div>
              <div style={{ fontSize: 12 }}>{formatMoney(row.advance_amount)}</div>
              <div style={{ fontSize: 12 }}>{formatMoney(row.payment_amount)}</div>
              <div style={{ fontSize: 12 }}>{formatMoney(row.settlement_amount)}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: row.outstanding_amount > 0 ? 'var(--orange)' : 'var(--green)' }}>
                {formatMoney(row.outstanding_amount)}
              </div>
            </div>
          ))}
          {!workerBalances.length ? <div style={{ padding: 10, color: 'var(--text3)' }}>Không có dữ liệu công nợ nhân công công ty trong bộ lọc hiện tại.</div> : null}
        </div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)' }}>Dòng tạm ứng nội bộ</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{internalAdvanceSummary.rowCount}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)' }}>Nhân công đã tạm ứng</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{internalAdvanceSummary.workerCount}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)' }}>Tổng tạm ứng nội bộ</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{formatMoney(internalAdvanceSummary.totalAmount)}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: showBatchForm ? 10 : 0 }}>
          <div style={{ fontWeight: 700 }}>Đợt thanh toán công</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" onClick={() => {
              setEditingBatchId('')
              setBatchForm({ ...EMPTY_BATCH_FORM, project_id: selectedProjectId })
              setShowBatchForm((prev) => !prev)
            }}>
              {showBatchForm ? 'Ẩn form đợt' : '+ Mở form đợt'}
            </button>
          </div>
        </div>
        {showBatchForm ? (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr 1fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Dự án</div>
            <select className="select" value={batchForm.project_id} onChange={(e) => setBatchForm((p) => ({ ...p, project_id: e.target.value }))}>
              <option value="">(Chọn dự án)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.project_name}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tên đợt thanh toán</div>
            <input className="input" value={batchForm.batch_name} onChange={(e) => setBatchForm((p) => ({ ...p, batch_name: e.target.value }))} placeholder="VD: Đợt lương tuần 1 tháng 6" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Từ ngày</div>
            <input className="input" type="date" value={batchForm.period_from} onChange={(e) => setBatchForm((p) => ({ ...p, period_from: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đến ngày</div>
            <input className="input" type="date" value={batchForm.period_to} onChange={(e) => setBatchForm((p) => ({ ...p, period_to: e.target.value }))} />
          </div>
          <button className="btn-ghost" onClick={() => { setEditingBatchId(''); setBatchForm({ ...EMPTY_BATCH_FORM, project_id: selectedProjectId }) }}>Mới</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr auto', gap: 8, alignItems: 'end', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ngày chi dự kiến</div>
            <input className="input" type="date" value={batchForm.planned_payment_date} onChange={(e) => setBatchForm((p) => ({ ...p, planned_payment_date: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Loại đợt</div>
            <select className="select" value={batchForm.payment_type} onChange={(e) => setBatchForm((p) => ({ ...p, payment_type: e.target.value }))}>
              <option value="advance">Tạm ứng</option>
              <option value="payment">Thanh toán đợt</option>
              <option value="settlement">Tất toán</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ghi chú</div>
            <input className="input" value={batchForm.note} onChange={(e) => setBatchForm((p) => ({ ...p, note: e.target.value }))} placeholder="Không bắt buộc" />
          </div>
          <button className="btn-primary" onClick={submitBatch}>{editingBatchId ? 'Lưu sửa đợt' : '+ Tạo đợt'}</button>
        </div>
        </>
        ) : null}

        <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {batchSummary.map((batch) => (
            <div key={batch.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>
                  {batch.batch_name} ({batch.batch_code}) | {batch.project?.project_name || '-'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  Kỳ: {displayDate(batch.period_from)} - {displayDate(batch.period_to)} | Dự kiến chi: {displayDate(batch.planned_payment_date)} | Loại: {paymentTypeLabel(batch.payment_type)}
                </div>
                <div style={{ fontSize: 12, marginTop: 4, fontWeight: 700 }}>
                  <span style={{ color: batchStatusColor(batch.status) }}>Duyệt: {batchStatusLabel(batch.status)}</span>
                  {' | '}
                  <span style={{ color: settlementStatusColor(batch.settlement_status) }}>Thanh toan: {settlementStatusLabel(batch.settlement_status)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  Chấm công gắn đợt: {batch.attendanceCount} dòng | {Number((batch as any).attendanceWorkQty || 0).toLocaleString('vi-VN')} công | Công nợ: {formatMoney((batch as any).attendanceAmount || 0)} | Đã nhập thanh toán: {formatMoney((batch as any).paymentAmount || 0)}
                </div>
                {batch.note ? <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Ghi chú: {batch.note}</div> : null}
                {batch.cancel_reason ? <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>Lý do hủy: {batch.cancel_reason}</div> : null}
                {linkingBatchId === batch.id ? (
                  <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontWeight: 700 }}>Gắn chấm công đã xác nhận</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                        Đã chọn {(selectedAttendanceIdsByBatch[batch.id] || []).length} dòng
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                      Chọn các dòng chấm công confirmed thuộc đợt này. Bạn có thể đổi danh sách này trước khi đợt được đánh dấu đã chi.
                    </div>
                    <div style={{ marginBottom: 10, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ padding: '8px 10px', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
                        Công chưa thanh toán / đã thanh toán theo nhân công
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 0.9fr 0.9fr 0.9fr', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
                        <div>Nhân công</div>
                        <div>Tổng công</div>
                        <div>Tổng tiền công</div>
                        <div>Đã thanh toán</div>
                        <div>Còn lại</div>
                      </div>
                      {Array.from(
                        (Array.isArray(batch.attendance_links) ? batch.attendance_links : []).reduce((map, link) => {
                          const attendance = link.attendance
                          const worker = attendance?.worker
                          if (!worker?.id) return map
                          const key = worker.id
                          const prev = map.get(key) || {
                            key,
                            worker_name: worker.full_name || '-',
                            worker_code: worker.worker_code || '',
                            total_work: 0,
                            total_amount: 0,
                          }
                          prev.total_work += Number(attendance?.work_qty || 0)
                          prev.total_amount += Number(attendance?.amount || 0)
                          map.set(key, prev)
                          return map
                        }, new Map<string, { key: string; worker_name: string; worker_code: string; total_work: number; total_amount: number }>())
                      ).map(([workerId, row]) => {
                        const paidAmount = activeRows
                          .filter((x) => x.batch?.id === batch.id && String(x.worker?.id || '') === workerId)
                          .reduce((sum, x) => sum + Number(x.amount || 0), 0)
                        const remainingAmount = Math.max(0, row.total_amount - paidAmount)
                        return (
                          <div key={`${batch.id}_summary_${workerId}`} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 0.9fr 0.9fr 0.9fr', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', alignItems: 'center', fontSize: 12 }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{row.worker_name}</div>
                              <div style={{ color: 'var(--text3)' }}>{row.worker_code}</div>
                            </div>
                            <div>{row.total_work.toLocaleString('vi-VN')}</div>
                            <div>{formatMoney(row.total_amount)}</div>
                            <div style={{ color: paidAmount > 0 ? 'var(--green)' : 'var(--text3)' }}>{formatMoney(paidAmount)}</div>
                            <div style={{ color: remainingAmount > 0 ? 'var(--orange)' : 'var(--green)', fontWeight: 700 }}>{formatMoney(remainingAmount)}</div>
                          </div>
                        )
                      })}
                      {!Array.isArray(batch.attendance_links) || !batch.attendance_links.length ? (
                        <div style={{ padding: 10, color: 'var(--text3)' }}>Chưa có chấm công nào gắn vào đợt này.</div>
                      ) : null}
                    </div>
                    <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                      {attendanceRows
                        .filter((row) => {
                          const dateValue = row.attendance_date ? new Date(row.attendance_date) : null
                          const from = batch.period_from ? new Date(batch.period_from) : null
                          const to = batch.period_to ? new Date(batch.period_to) : null
                          if (dateValue && from && dateValue < from) return false
                          if (dateValue && to && dateValue > to) return false
                          return true
                        })
                        .map((row) => {
                          const checked = (selectedAttendanceIdsByBatch[batch.id] || []).includes(row.id)
                          return (
                            <label key={`${batch.id}_${row.id}`} style={{ display: 'grid', gridTemplateColumns: '20px 1.3fr 0.8fr 0.7fr 0.7fr 1fr', gap: 8, alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                              <input type="checkbox" checked={checked} onChange={(e) => toggleAttendanceForBatch(batch.id, row.id, e.target.checked)} />
                              <div>
                                <div style={{ fontWeight: 600 }}>{row.worker?.full_name || '-'}</div>
                                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{row.worker?.worker_code || ''}</div>
                              </div>
                              <div style={{ fontSize: 12 }}>{displayDate(row.attendance_date)}</div>
                              <div style={{ fontSize: 12 }}>{shiftLabel(row.shift_type)}</div>
                              <div style={{ fontSize: 12, fontWeight: 700 }}>{Number(row.work_qty || 0).toLocaleString('vi-VN')}</div>
                              <div style={{ fontSize: 12 }}>
                                <div style={{ fontWeight: 700 }}>{formatMoney(row.amount || 0)}</div>
                                <div style={{ color: 'var(--text3)' }}>{row.diary_entry?.title || row.note || ''}</div>
                              </div>
                            </label>
                          )
                        })}
                      {!attendanceRows.filter((row) => {
                        const dateValue = row.attendance_date ? new Date(row.attendance_date) : null
                        const from = batch.period_from ? new Date(batch.period_from) : null
                        const to = batch.period_to ? new Date(batch.period_to) : null
                        if (dateValue && from && dateValue < from) return false
                        if (dateValue && to && dateValue > to) return false
                        return true
                      }).length ? <div style={{ padding: 10, color: 'var(--text3)' }}>Không có dòng chấm công đã xác nhận phù hợp với đợt này.</div> : null}
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                      <button className="btn-ghost" onClick={() => {
                        setSelectedAttendanceIdsByBatch((prev) => ({
                          ...prev,
                          [batch.id]: Array.isArray(batch.attendance_links)
                            ? batch.attendance_links.map((x) => x.attendance?.id).filter(Boolean) as string[]
                            : [],
                        }))
                        setLinkingBatchId('')
                      }}>Đóng</button>
                      <button className="btn-primary" onClick={() => void saveBatchAttendanceLinks(batch.id)}>Lưu chấm công</button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 340 }}>
                <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => chooseAndPrintBatch(batch, printBrand)}>In / xuất PDF</button>
                {batch.status === 'draft' ? <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => {
                  setSelectedAttendanceIdsByBatch((prev) => ({
                    ...prev,
                    [batch.id]: Array.isArray(batch.attendance_links)
                      ? batch.attendance_links.map((x) => x.attendance?.id).filter(Boolean) as string[]
                      : [],
                  }))
                  setLinkingBatchId((prev) => prev === batch.id ? '' : batch.id)
                }}>Gắn chấm công</button> : null}
                {batch.status === 'draft' ? <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => {
                  setEditingBatchId(batch.id)
                  setBatchForm({
                    project_id: batch.project?.id || selectedProjectId,
                    batch_name: batch.batch_name || '',
                    period_from: dateInputValue(batch.period_from),
                    period_to: dateInputValue(batch.period_to),
                    planned_payment_date: dateInputValue(batch.planned_payment_date),
                    payment_type: batch.payment_type || 'payment',
                    note: batch.note || '',
                  })
                  if (batch.project?.id) setSelectedProjectId(batch.project.id)
                  setShowBatchForm(true)
                }}>Sửa đợt</button> : null}
                {batch.status === 'draft' ? <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--blue)' }} onClick={() => void doBatchAction(batch.id, 'approve')}>Duyệt</button> : null}
                {batch.status === 'draft' ? <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => void doBatchAction(batch.id, 'cancel')}>Hủy</button> : null}
                {batch.status === 'approved' || batch.status === 'cancelled' ? <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => void doBatchAction(batch.id, 'reopen')}>Mở lại</button> : null}
              </div>
            </div>
          ))}
          {!batchSummary.length ? <div style={{ padding: 10, color: 'var(--text3)' }}>Chưa có đợt thanh toán công nào.</div> : null}
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Báo cáo theo đợt thanh toán</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)' }}>Nháp</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{batchStatusStats.draft_count}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{formatMoney(batchStatusStats.draft_amount)}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)' }}>Đã duyệt</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{batchStatusStats.approved_count}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{formatMoney(batchStatusStats.approved_amount)}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)' }}>Đã chi</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{batchStatusStats.paid_count}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{formatMoney(batchStatusStats.paid_amount)}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)' }}>Đã hủy</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{batchStatusStats.cancelled_count}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{formatMoney(batchStatusStats.cancelled_amount)}</div>
          </div>
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.9fr 0.9fr 0.9fr 0.8fr', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
            <div>Đợt thanh toán</div>
            <div>Dự án</div>
            <div>Kỳ thanh toán</div>
            <div>Loại</div>
            <div>Giá trị</div>
            <div>Trạng thái</div>
          </div>
          {batchSummary.map((batch) => (
            <div key={`report_${batch.id}`} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.9fr 0.9fr 0.9fr 0.8fr', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{batch.batch_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{batch.batch_code} | {batch.paymentCount} dòng</div>
              </div>
              <div style={{ fontSize: 12 }}>{batch.project?.project_name || '-'}</div>
              <div style={{ fontSize: 12 }}>{displayDate(batch.period_from)} - {displayDate(batch.period_to)}</div>
              <div style={{ fontSize: 12 }}>{paymentTypeLabel(batch.payment_type)}</div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>
                {formatMoney((batch as any).paymentAmount || 0)} / {formatMoney((batch as any).attendanceAmount || 0)}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>
                <div style={{ color: batchStatusColor(batch.status) }}>{batchStatusLabel(batch.status)}</div>
                <div style={{ color: settlementStatusColor(batch.settlement_status) }}>{settlementStatusLabel(batch.settlement_status)}</div>
                <div style={{ color: 'var(--text3)', fontWeight: 500 }}>{Number((batch as any).attendanceCount || 0)} dòng công</div>
              </div>
            </div>
          ))}
          {!batchSummary.length ? <div style={{ padding: 10, color: 'var(--text3)' }}>Chưa có dữ liệu theo đợt thanh toán.</div> : null}
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: showPaymentForm ? 10 : 0 }}>
          <div style={{ fontWeight: 700 }}>Tạo / sửa thanh toán công</div>
          <button className="btn-ghost" onClick={() => {
            setEditingId('')
            setForm({ ...EMPTY_FORM, project_id: selectedProjectId })
            setShowPaymentForm((prev) => !prev)
          }}>
            {showPaymentForm ? 'Ẩn form thanh toán' : '+ Mở form thanh toán'}
          </button>
        </div>
        {showPaymentForm ? (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Dự án</div>
            <select className="select" value={selectedProjectId} onChange={(e) => {
              const next = e.target.value
              setSelectedProjectId(next)
              setForm((p) => ({ ...p, project_id: next }))
              setBatchForm((p) => ({ ...p, project_id: next }))
            }}>
              <option value="">(Tất cả dự án)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.project_name}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đợt thanh toán</div>
            <select className="select" value={form.batch_id} onChange={(e) => applyBatch(e.target.value)}>
              <option value="">(Không gắn đợt)</option>
              {activeBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batch_name} ({batch.batch_code}) - {batchStatusLabel(batch.status)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Phiếu phân công</div>
            <select className="select" value={form.engagement_id} onChange={(e) => applyEngagement(e.target.value)}>
              <option value="">(Không chọn)</option>
              {engagements.map((engagement) => (
                <option key={engagement.id} value={engagement.id}>
                  {engagement.project?.project_name || '-'} | {engagement.worker?.full_name || engagement.crew?.crew_name || '-'} | {engagementTypeLabel(engagement.engagement_type)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Nhân công</div>
            <select className="select" value={form.worker_id} onChange={(e) => applyWorker(e.target.value)}>
              <option value="">(Không chọn)</option>
              {selectableWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.full_name} ({worker.worker_code})
                  {worker.remaining_amount != null ? ` | Còn lại: ${Number(worker.remaining_amount).toLocaleString('vi-VN')} vnd` : ''}
                </option>
              ))}
            </select>
            {selectedBatchForForm && Array.isArray(selectedBatchForForm.attendance_links) && selectedBatchForForm.attendance_links.length ? (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                Đợt này đã gắn chấm công. Chỉ nên chọn nhân công thuộc đợt và không vượt quá số tiền còn lại của từng người.
              </div>
            ) : null}
            {selectedPaymentType !== 'payment' ? (
              <div style={{ fontSize: 11, color: 'var(--blue)', marginTop: 4 }}>
                {selectedPaymentType === 'advance'
                  ? 'Tạm ứng chỉ áp dụng cho nhân công công ty và sẽ được trừ dần vào các kỳ sau.'
                  : 'Tất toán chỉ áp dụng cho nhân công công ty và không được vượt quá công nợ còn lại.'}
              </div>
            ) : null}
            {selectedBatchLocked ? (
              <div style={{ fontSize: 11, color: 'var(--orange)', marginTop: 4 }}>
                Đợt thanh toán đã duyệt/đã chi/đã hủy. Không thể thêm hoặc sửa dòng thanh toán cho đến khi mở lại về nháp.
              </div>
            ) : null}
          </div>
          <button className="btn-ghost" onClick={() => { setEditingId(''); setForm({ ...EMPTY_FORM, project_id: selectedProjectId }) }}>Mới</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1.2fr auto', gap: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đội thợ</div>
            <select className="select" value={form.crew_id} onChange={(e) => setForm((p) => ({ ...p, crew_id: e.target.value }))}>
              <option value="">(Không chọn)</option>
              {crews.map((crew) => (
                <option key={crew.id} value={crew.id}>{crew.crew_name}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ngày thanh toán</div>
            <input className="input" type="date" value={form.payment_date} onChange={(e) => setForm((p) => ({ ...p, payment_date: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Loại thanh toán</div>
            <select
              className="select"
              value={form.payment_type}
              disabled={!!selectedBatchForForm}
              onChange={(e) => setForm((p) => ({
                ...p,
                payment_type: e.target.value,
                amount: e.target.value === 'settlement' && selectedWorkerBalance
                  ? String(selectedWorkerBalance.outstanding_amount || 0)
                  : p.amount,
              }))}
            >
              <option value="advance">Tạm ứng</option>
              <option value="payment">Thanh toán đợt</option>
              <option value="settlement">Tất toán</option>
            </select>
            {selectedBatchForForm ? (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                Loại thanh toán đang đi theo loại của đợt đã chọn.
              </div>
            ) : null}
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Số tiền</div>
            <input className="input" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="VD: 2000000" />
            {selectedWorkerBalance && form.worker_id ? (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                Đã tạm ứng: {formatMoney(selectedWorkerBalance.advance_amount)} | Đã trả: {formatMoney(selectedWorkerBalance.payment_amount + selectedWorkerBalance.settlement_amount)} | Còn phải tất toán: {formatMoney(selectedWorkerBalance.outstanding_amount)}
              </div>
            ) : null}
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ghi chú</div>
            <input className="input" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="Không bắt buộc" />
          </div>
          {!selectedBatchLocked ? <button className="btn-primary" onClick={submit}>{editingId ? 'Lưu sửa' : '+ Tạo'}</button> : <div />}
        </div>
        </>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Tổng hợp theo nhân công / đội</div>
          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            {groupedByWorker.map((row, idx) => (
              <div key={`${row.worker_name}_${idx}`} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700 }}>{row.worker_name}{row.worker_code ? ` (${row.worker_code})` : ''}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Số dòng: {row.count} | Tổng tiền: {formatMoney(row.total_amount)}</div>
              </div>
            ))}
            {!groupedByWorker.length ? <div style={{ padding: 10, color: 'var(--text3)' }}>Chưa có dữ liệu thanh toán công.</div> : null}
          </div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Tổng hợp theo dự án</div>
          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            {groupedByProject.map((row, idx) => (
              <div key={`${row.project_name}_${idx}`} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700 }}>{row.project_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Số dòng: {row.count} | Tổng tiền: {formatMoney(row.total_amount)}</div>
              </div>
            ))}
            {!groupedByProject.length ? <div style={{ padding: 10, color: 'var(--text3)' }}>Chưa có dữ liệu thanh toán công.</div> : null}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Danh sách thanh toán công</div>
        <div style={{ maxHeight: 560, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {activeRows.map((row) => (
            <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>
                  {displayDate(row.payment_date)} | {row.project?.project_name || '-'} | {row.worker?.full_name || row.crew?.crew_name || '-'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  Loại: {paymentTypeLabel(row.payment_type)} | Số tiền: {formatMoney(row.amount)} | Phân công: {row.engagement?.engagement_type ? engagementTypeLabel(row.engagement.engagement_type) : '-'}
                </div>
                {row.batch ? (
                  <div style={{ fontSize: 12, color: batchStatusColor(row.batch.status), marginTop: 4 }}>
                    Đợt: {row.batch.batch_name} ({row.batch.batch_code}) | {batchStatusLabel(row.batch.status)}
                  </div>
                ) : null}
                {row.note ? <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Ghi chú: {row.note}</div> : null}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {(row.payment_type === 'advance' || row.payment_type === 'settlement') ? (
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 11 }}
                    onClick={() => {
                      const includeSignatureColumn = window.confirm('Bạn có muốn in kèm cột ký nhận trên phiếu này không?')
                      printSinglePaymentDoc(row, includeSignatureColumn, printBrand)
                    }}
                  >
                    In phiếu
                  </button>
                ) : null}
                {row.batch && row.batch.status !== 'draft' ? (
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>Dòng này đã khóa theo đợt</div>
                ) : (
                  <>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 11 }}
                      onClick={() => {
                        setEditingId(row.id)
                        setForm({
                          project_id: row.project?.id || selectedProjectId,
                          batch_id: row.batch?.id || '',
                          engagement_id: row.engagement?.id || '',
                          worker_id: row.worker?.id || '',
                          crew_id: row.crew?.id || '',
                          payment_date: dateInputValue(row.payment_date),
                          payment_type: row.payment_type || 'payment',
                          amount: row.amount || '',
                          note: row.note || '',
                        })
                        if (row.project?.id) setSelectedProjectId(row.project.id)
                        setShowPaymentForm(true)
                      }}
                    >
                      Sửa
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 11, color: 'var(--red)' }}
                      onClick={async () => {
                        if (!confirm('Xóa dòng thanh toán công này?')) return
                        const res = await fetch(`/api/labor/payments/${row.id}`, { method: 'DELETE' })
                        const json = await res.json().catch(() => ({}))
                        if (!res.ok) {
                          setToast(json?.error || 'Không xóa được dòng thanh toán')
                          return
                        }
                        await loadRows(selectedProjectId)
                      }}
                    >
                      Xóa
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {!activeRows.length ? <div style={{ padding: 10, color: 'var(--text3)' }}>Chưa có dòng thanh toán công nào.</div> : null}
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

