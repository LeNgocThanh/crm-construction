import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { getInventoryDashboardData } from '@/lib/inventory/dashboard'
import { escapePrintHtml, renderPrintHeaderHtml, renderPrintShellHtml } from '@/lib/print/layout'
import { getPrintBrandSettings } from '@/lib/print/service'

function formatMoney(value?: number | null) {
  return `${Number(value || 0).toLocaleString('vi-VN')} vnd`
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

function riskKindLabel(value?: string | null) {
  switch (value) {
    case 'price_spike': return 'Tang gia manh'
    case 'delivery_delay': return 'Giao hang cham'
    default: return value || '-'
  }
}

function sectionTable(title: string, headers: string[], rows: string[][]) {
  const head = headers.map((x) => `<th>${escapePrintHtml(x)}</th>`).join('')
  const body = rows.length
    ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapePrintHtml(cell)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${headers.length}">Khong co du lieu</td></tr>`
  return `
    <section class="print-section">
      <div class="print-section-title">${escapePrintHtml(title)}</div>
      <table class="print-table">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>
  `
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.inventoryRead)
  if (auth.error) return auth.error
  const session: any = auth.ctx?.session
  const brand = await getPrintBrandSettings()

  const sp = new URL(req.url).searchParams
  const data = await getInventoryDashboardData({
    warehouse_id: String(sp.get('warehouse_id') || '').trim(),
    date_from: String(sp.get('date_from') || '').trim(),
    date_to: String(sp.get('date_to') || '').trim(),
  })

  const summaryHtml = `
    <div class="print-summary-grid">
      <div class="print-summary-card"><div class="print-summary-key">Duoi min</div><div class="print-summary-value">${escapePrintHtml(data.summary.low_stock_count)}</div></div>
      <div class="print-summary-card"><div class="print-summary-key">Draft de lau</div><div class="print-summary-value">${escapePrintHtml(data.summary.aging_draft_count)}</div></div>
      <div class="print-summary-card"><div class="print-summary-key">Dung yen</div><div class="print-summary-value">${escapePrintHtml(data.summary.stale_stock_count)}</div></div>
      <div class="print-summary-card"><div class="print-summary-key">Canh bao NCC</div><div class="print-summary-value">${escapePrintHtml((data.summary as any).supplier_risk_count || 0)}</div></div>
    </div>
  `

  const lowStockRows = data.low_stock_rows.map((row: any) => [
    row.warehouse_name || '-',
    row.material_name || row.material_key || '',
    row.material_key || '',
    `${Number(row.on_hand_qty || 0).toLocaleString('vi-VN')} ${row.item_unit || ''}`.trim(),
    `${Number(row.min_qty || 0).toLocaleString('vi-VN')} ${row.item_unit || ''}`.trim(),
  ])
  const staleRows = data.stale_stock_rows.map((row: any) => [
    row.warehouse_name || '-',
    row.material_name || row.material_key || '',
    String(row.days_idle || 0),
    formatDateTime(row.last_movement_at),
  ])
  const supplierRows = ((data as any).supplier_risk_rows || []).map((row: any) => [
    row.supplier_name || 'Khong gan NCC',
    riskKindLabel(row.risk_kind),
    row.material_name || '-',
    row.reference_code || '-',
    row.detail_text || '-',
    row.severity === 'critical' ? 'Can gap' : 'Can xu ly',
  ])
  const projectRows = data.project_demand_risk_rows.map((row: any) => [
    row.project_name || '-',
    row.plan_name || '-',
    row.material_name || row.material_key || '',
    `${Number(row.shortage_qty || 0).toLocaleString('vi-VN')} ${row.item_unit || ''}`.trim(),
    `${Number(row.available_stock_qty || 0).toLocaleString('vi-VN')} ${row.item_unit || ''}`.trim(),
  ])

  const bodyHtml = `
    ${summaryHtml}
    ${sectionTable('Vat tu duoi min', ['Kho', 'Vat tu', 'Ma vat tu', 'Ton', 'Min'], lowStockRows)}
    ${sectionTable('Vat tu lau khong bien dong', ['Kho', 'Vat tu', 'Ngay dung yen', 'Lan cuoi'], staleRows)}
    ${sectionTable('Canh bao theo nha cung cap', ['NCC', 'Loai', 'Vat tu', 'Tham chieu', 'Chi tiet', 'Muc do'], supplierRows)}
    ${sectionTable('Vat tu sap thieu theo du an', ['Du an', 'Ke hoach', 'Vat tu', 'Thieu', 'Ton kha dung'], projectRows)}
    <div class="print-note">Gia tri ton kho hien tai: <b>${escapePrintHtml(formatMoney(data.summary.total_stock_value))}</b> | Phieu xuat nhap du an chua ghi so: <b>${escapePrintHtml(data.summary.project_issue_draft_count)}</b></div>
  `

  const scopeHtml = `
    Kho: <b>${escapePrintHtml(data.filters.warehouse_id || 'Tat ca')}</b> |
    Tu ngay: <b>${escapePrintHtml(formatDateTime(data.filters.date_from))}</b> |
    Den ngay: <b>${escapePrintHtml(formatDateTime(data.filters.date_to))}</b>
  `

  const headerHtml = renderPrintHeaderHtml({
    title: 'Bao cao canh bao van hanh kho',
    subtitle: 'Bao cao tong hop cac canh bao can xu ly ngay trong van hanh kho va mua hang.',
    code: 'INV-ALERT-REPORT',
    printedBy: session?.user?.username || 'He thong',
    printedAt: new Date().toLocaleString('vi-VN'),
  }, scopeHtml, brand)

  const html = renderPrintShellHtml({
    titleTag: 'Bao cao canh bao van hanh kho',
    headerHtml,
    bodyHtml,
    brand,
    autoPrint: sp.get('print') === '1',
  })

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
