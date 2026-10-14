import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { getInventoryPriceTrackingData } from '@/lib/inventory/price-tracking'
import { escapePrintHtml, renderPrintHeaderHtml, renderPrintShellHtml } from '@/lib/print/layout'
import { getPrintBrandSettings } from '@/lib/print/service'

function formatMoney(value?: number | null) {
  return `${Number(value || 0).toLocaleString('vi-VN')} vnd`
}

function formatPercent(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return '-'
  const n = Number(value)
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function formatDeltaMoney(value?: number | null) {
  if (value == null) return '-'
  const n = Number(value || 0)
  return `${n >= 0 ? '+' : ''}${n.toLocaleString('vi-VN')} vnd`
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

function priceKindLabel(value?: string | null) {
  switch (value) {
    case 'inventory_in': return 'Nhap kho thuc te'
    case 'transfer_in': return 'Nhap chuyen kho'
    case 'direct_purchase': return 'Mua truc tiep'
    case 'supplier_quote': return 'Gia NCC'
    case 'manual': return 'Dieu chinh tay'
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
  const brand = await getPrintBrandSettings()

  const sp = new URL(req.url).searchParams
  const data = await getInventoryPriceTrackingData({
    warehouse_id: String(sp.get('warehouse_id') || '').trim(),
    supplier_id: String(sp.get('supplier_id') || '').trim(),
    material_key: String(sp.get('material_key') || '').trim(),
    price_kind: String(sp.get('price_kind') || '').trim(),
    date_from: String(sp.get('date_from') || '').trim(),
    date_to: String(sp.get('date_to') || '').trim(),
    page: 1,
    page_size: 5000,
  })

  const summary = data.summary
  const summaryRows = [
    ['Dong gia trong ky', String(summary.log_count || 0)],
    ['Ma vat tu co bien dong', String(summary.material_count || 0)],
    ['Nha cung cap co phat sinh', String(summary.supplier_count || 0)],
    ['Don gia thuc te binh quan', formatMoney(summary.avg_actual_price)],
    ['Don gia thap nhat', formatMoney(summary.min_actual_price)],
    ['Don gia cao nhat', formatMoney(summary.max_actual_price)],
    ['Vat tu tang gia', String(summary.increased_material_count || 0)],
    ['Vat tu giam gia', String(summary.decreased_material_count || 0)],
  ]

  const topIncreaseRows = data.top_material_increases.map((row: any) => [
    row.material_name || row.material_key || '',
    row.material_key || '',
    row.item_unit || '-',
    formatMoney(row.first_price),
    formatMoney(row.last_price),
    formatDeltaMoney(row.change_amount),
    formatPercent(row.change_pct),
  ])

  const topDecreaseRows = data.top_material_decreases.map((row: any) => [
    row.material_name || row.material_key || '',
    row.material_key || '',
    row.item_unit || '-',
    formatMoney(row.first_price),
    formatMoney(row.last_price),
    formatDeltaMoney(row.change_amount),
    formatPercent(row.change_pct),
  ])

  const supplierRows = data.top_supplier_changes.map((row: any) => [
    row.supplier_name || 'Khong gan NCC',
    row.material_name || row.material_key || '',
    row.material_key || '',
    formatMoney(row.first_price),
    formatMoney(row.last_price),
    formatDeltaMoney(row.change_amount),
    formatPercent(row.change_pct),
  ])

  const compareRows = data.actual_vs_config.map((row: any) => [
    row.supplier_name || 'Khong gan NCC',
    row.material_name || row.material_key || '',
    row.material_key || '',
    formatMoney(row.latest_actual_price),
    row.latest_config_price != null ? formatMoney(row.latest_config_price) : '-',
    formatDeltaMoney(row.gap_amount),
    formatPercent(row.gap_pct),
  ])

  const logRows = data.logs.map((row: any) => [
    formatDateTime(row.effective_at),
    row.txn_code || '-',
    String(row.cycle_no ?? '-'),
    row.material_name || row.material_key || '',
    row.supplier_name || 'Khong gan NCC',
    row.warehouse_name || '-',
    priceKindLabel(row.price_kind),
    String(Number(row.quantity || 0).toLocaleString('vi-VN')),
    formatMoney(row.unit_price),
    row.latest_config_price != null ? formatMoney(row.latest_config_price) : '-',
    formatDeltaMoney(row.gap_amount),
  ])

  const scopeHtml = `
    Kho: <b>${escapePrintHtml(data.filters.warehouse_id || 'Tat ca')}</b> |
    NCC: <b>${escapePrintHtml(data.filters.supplier_id || 'Tat ca')}</b> |
    Vat tu: <b>${escapePrintHtml(data.filters.material_key || 'Tat ca')}</b> |
    Loai gia: <b>${escapePrintHtml(data.filters.price_kind || 'Tat ca')}</b> |
    Tu ngay: <b>${escapePrintHtml(formatDateTime(data.filters.date_from))}</b> |
    Den ngay: <b>${escapePrintHtml(formatDateTime(data.filters.date_to))}</b>
  `

  const summaryHtml = `
    <div class="print-summary-grid">
      <div class="print-summary-card"><div class="print-summary-key">Dong gia trong ky</div><div class="print-summary-value">${escapePrintHtml(summary.log_count)}</div></div>
      <div class="print-summary-card"><div class="print-summary-key">Ma vat tu bien dong</div><div class="print-summary-value">${escapePrintHtml(summary.material_count)}</div></div>
      <div class="print-summary-card"><div class="print-summary-key">NCC co phat sinh</div><div class="print-summary-value">${escapePrintHtml(summary.supplier_count)}</div></div>
      <div class="print-summary-card"><div class="print-summary-key">Don gia binh quan</div><div class="print-summary-value">${escapePrintHtml(formatMoney(summary.avg_actual_price))}</div></div>
    </div>
  `

  const bodyHtml = `
    ${summaryHtml}
    ${sectionTable('Tong hop chi so', ['Chi so', 'Gia tri'], summaryRows)}
    ${sectionTable('Vat tu tang gia manh trong ky', ['Vat tu', 'Ma vat tu', 'Don vi', 'Dau ky', 'Cuoi ky', 'Bien dong', '%'], topIncreaseRows)}
    ${sectionTable('Vat tu giam gia manh trong ky', ['Vat tu', 'Ma vat tu', 'Don vi', 'Dau ky', 'Cuoi ky', 'Bien dong', '%'], topDecreaseRows)}
    ${sectionTable('NCC / vat tu bien dong manh', ['NCC', 'Vat tu', 'Ma vat tu', 'Dau ky', 'Cuoi ky', 'Bien dong', '%'], supplierRows)}
    ${sectionTable('So sanh gia cau hinh va gia thuc te', ['NCC', 'Vat tu', 'Ma vat tu', 'Gia thuc te', 'Gia cau hinh', 'Lech', '%'], compareRows)}
    ${sectionTable('Lich su gia thuc te', ['Thoi diem', 'Phieu', 'Vong gia', 'Vat tu', 'NCC', 'Kho', 'Loai gia', 'So luong', 'Don gia thuc te', 'Gia cau hinh', 'Lech'], logRows)}
  `

  const headerHtml = renderPrintHeaderHtml({
    title: 'Bao cao bien dong gia vat tu',
    subtitle: 'Bao cao theo ky cho kho, nha cung cap va gia thuc te so voi gia cau hinh.',
    code: 'INV-PRICE-REPORT',
    printedBy: auth.ctx?.session?.user?.username || 'He thong',
    printedAt: new Date().toLocaleString('vi-VN'),
  }, scopeHtml, brand)

  const html = renderPrintShellHtml({
    titleTag: 'Bao cao bien dong gia vat tu',
    headerHtml,
    bodyHtml,
    brand,
    autoPrint: sp.get('print') === '1',
  })

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
