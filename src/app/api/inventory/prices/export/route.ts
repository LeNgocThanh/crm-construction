import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { getInventoryPriceTrackingData } from '@/lib/inventory/price-tracking'

function escapeHtml(value: any) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

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
    case 'inventory_in': return 'Nhập kho thực tế'
    case 'transfer_in': return 'Nhập chuyển kho'
    case 'direct_purchase': return 'Mua trực tiếp'
    case 'supplier_quote': return 'Giá NCC'
    case 'manual': return 'Điều chỉnh tay'
    default: return value || '-'
  }
}

function buildTable(headers: string[], rows: string[][]) {
  const head = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`
  const body = rows.length
    ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${headers.length}">Không có dữ liệu</td></tr>`
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.inventoryRead)
  if (auth.error) return auth.error

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
    ['Dòng giá trong kỳ', String(summary.log_count || 0)],
    ['Mã vật tư có biến động', String(summary.material_count || 0)],
    ['Nhà cung cấp có phát sinh', String(summary.supplier_count || 0)],
    ['Đơn giá thực tế bình quân', formatMoney(summary.avg_actual_price)],
    ['Đơn giá thấp nhất', formatMoney(summary.min_actual_price)],
    ['Đơn giá cao nhất', formatMoney(summary.max_actual_price)],
    ['Vật tư tăng giá', String(summary.increased_material_count || 0)],
    ['Vật tư giảm giá', String(summary.decreased_material_count || 0)],
  ]

  const topIncreaseRows = data.top_material_increases.map((row: any) => [
    row.material_name || row.material_key || '',
    row.material_key || '',
    row.item_unit || '-',
    formatMoney(row.first_price),
    formatMoney(row.last_price),
    formatDeltaMoney(row.change_amount),
    formatPercent(row.change_pct),
    String(row.sample_count || 0),
  ])

  const topDecreaseRows = data.top_material_decreases.map((row: any) => [
    row.material_name || row.material_key || '',
    row.material_key || '',
    row.item_unit || '-',
    formatMoney(row.first_price),
    formatMoney(row.last_price),
    formatDeltaMoney(row.change_amount),
    formatPercent(row.change_pct),
    String(row.sample_count || 0),
  ])

  const supplierChangeRows = data.top_supplier_changes.map((row: any) => [
    row.supplier_name || 'Không gắn NCC',
    row.material_name || row.material_key || '',
    row.material_key || '',
    row.item_unit || '-',
    formatMoney(row.first_price),
    formatMoney(row.last_price),
    formatDeltaMoney(row.change_amount),
    formatPercent(row.change_pct),
    String(row.sample_count || 0),
    formatDateTime(row.latest_at),
  ])

  const compareRows = data.actual_vs_config.map((row: any) => [
    row.supplier_name || 'Không gắn NCC',
    row.material_name || row.material_key || '',
    row.material_key || '',
    row.item_unit || '-',
    formatMoney(row.latest_actual_price),
    formatDateTime(row.latest_actual_at),
    row.latest_config_price != null ? formatMoney(row.latest_config_price) : '-',
    formatDateTime(row.latest_config_at),
    formatDeltaMoney(row.gap_amount),
    formatPercent(row.gap_pct),
  ])

  const logRows = data.logs.map((row: any) => [
    formatDateTime(row.effective_at),
    row.txn_code || '-',
    String(row.cycle_no ?? '-'),
    row.material_name || row.material_key || '',
    row.material_key || '',
    row.item_unit || '-',
    row.supplier_name || 'Không gắn NCC',
    row.warehouse_name || '-',
    priceKindLabel(row.price_kind),
    String(Number(row.quantity || 0).toLocaleString('vi-VN')),
    formatMoney(row.line_total),
    formatMoney(row.unit_price),
    row.latest_config_price != null ? formatMoney(row.latest_config_price) : '-',
    formatDeltaMoney(row.gap_amount),
    formatPercent(row.gap_pct),
    row.source_note || '-',
  ])

  const title = 'Bao cao bien dong gia vat tu'
  const filterText = `Kho: ${data.filters.warehouse_id || 'Tat ca'} | NCC: ${data.filters.supplier_id || 'Tat ca'} | Vat tu: ${data.filters.material_key || 'Tat ca'} | Loai gia: ${data.filters.price_kind || 'Tat ca'} | Tu ngay: ${formatDateTime(data.filters.date_from)} | Den ngay: ${formatDateTime(data.filters.date_to)}`

  const html = `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; padding: 16px; color: #111827; }
        h1 { font-size: 24px; margin: 0 0 8px; }
        h2 { font-size: 18px; margin: 24px 0 8px; }
        .meta { margin-bottom: 12px; color: #374151; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
        th, td { border: 1px solid #d1d5db; padding: 6px 8px; font-size: 12px; vertical-align: top; }
        th { background: #f3f4f6; text-align: left; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">${escapeHtml(filterText)}</div>
      <div class="meta">Xuat luc: ${escapeHtml(new Date().toLocaleString('vi-VN'))}</div>

      <h2>Tong hop</h2>
      ${buildTable(['Chi so', 'Gia tri'], summaryRows)}

      <h2>Vat tu tang gia manh trong ky</h2>
      ${buildTable(['Vat tu', 'Ma vat tu', 'Don vi', 'Dau ky', 'Cuoi ky', 'Bien dong', '%', 'So lan'], topIncreaseRows)}

      <h2>Vat tu giam gia manh trong ky</h2>
      ${buildTable(['Vat tu', 'Ma vat tu', 'Don vi', 'Dau ky', 'Cuoi ky', 'Bien dong', '%', 'So lan'], topDecreaseRows)}

      <h2>NCC / vat tu bien dong manh</h2>
      ${buildTable(['NCC', 'Vat tu', 'Ma vat tu', 'Don vi', 'Dau ky', 'Cuoi ky', 'Bien dong', '%', 'So lan', 'Gan nhat'], supplierChangeRows)}

      <h2>So sanh gia cau hinh va gia thuc nhap gan nhat</h2>
      ${buildTable(['NCC', 'Vat tu', 'Ma vat tu', 'Don vi', 'Gia thuc te', 'Ngay thuc te', 'Gia cau hinh', 'Ngay cau hinh', 'Lech', '%'], compareRows)}

      <h2>Lich su gia thuc te</h2>
      ${buildTable(['Thoi diem', 'Phieu', 'Vong gia', 'Vat tu', 'Ma vat tu', 'Don vi', 'NCC', 'Kho', 'Loai gia', 'So luong', 'Thanh tien', 'Don gia thuc te', 'Gia cau hinh', 'Lech', '%', 'Ghi chu'], logRows)}
    </body>
  </html>
  `

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(`\uFEFF${html}`, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': `attachment; filename="inventory_price_tracking_${date}.xls"`,
    },
  })
}
