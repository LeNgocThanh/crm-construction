import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { getInventoryDashboardData } from '@/lib/inventory/dashboard'

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

function buildTable(headers: string[], rows: string[][]) {
  const head = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`
  const body = rows.length
    ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${headers.length}">Khong co du lieu</td></tr>`
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.inventoryRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const data = await getInventoryDashboardData({
    warehouse_id: String(sp.get('warehouse_id') || '').trim(),
    date_from: String(sp.get('date_from') || '').trim(),
    date_to: String(sp.get('date_to') || '').trim(),
  })

  const summaryRows = [
    ['Vat tu duoi min', String(data.summary.low_stock_count || 0)],
    ['Phieu draft de lau', String(data.summary.aging_draft_count || 0)],
    ['Vat tu lau khong bien dong', String(data.summary.stale_stock_count || 0)],
    ['Gia nhap tang manh', String(data.summary.price_spike_count || 0)],
    ['Vat tu sap thieu theo du an', String(data.summary.project_demand_risk_count || 0)],
    ['Phieu xuat nhap du an chua ghi so', String(data.summary.project_issue_draft_count || 0)],
    ['Canh bao theo NCC', String(data.summary.supplier_risk_count || 0)],
  ]

  const lowStockRows = data.low_stock_rows.map((row: any) => [
    row.warehouse_name || '-',
    row.material_name || row.material_key || '',
    row.material_key || '',
    `${Number(row.on_hand_qty || 0).toLocaleString('vi-VN')} ${row.item_unit || ''}`.trim(),
    `${Number(row.min_qty || 0).toLocaleString('vi-VN')} ${row.item_unit || ''}`.trim(),
    `${Number(row.available_qty || 0).toLocaleString('vi-VN')} ${row.item_unit || ''}`.trim(),
    formatMoney(row.stock_value),
  ])

  const staleRows = data.stale_stock_rows.map((row: any) => [
    row.warehouse_name || '-',
    row.material_name || row.material_key || '',
    row.material_key || '',
    `${Number(row.on_hand_qty || 0).toLocaleString('vi-VN')} ${row.item_unit || ''}`.trim(),
    String(row.days_idle || 0),
    formatDateTime(row.last_movement_at),
  ])

  const priceRows = data.price_spike_rows.map((row: any) => [
    row.supplier_name || 'Khong gan NCC',
    row.warehouse_name || '-',
    row.material_name || row.material_key || '',
    row.material_key || '',
    formatMoney(row.previous_price),
    formatMoney(row.latest_price),
    `${Number(row.increase_percent || 0).toLocaleString('vi-VN')}%`,
    formatDateTime(row.effective_at),
  ])

  const draftRows = data.aging_draft_rows.map((row: any) => [
    row.txn_code || '-',
    row.warehouse_name || '-',
    row.supplier_name || '-',
    String(row.days_open || 0),
    formatDateTime(row.created_at),
  ])

  const projectRows = data.project_demand_risk_rows.map((row: any) => [
    row.project_name || '-',
    row.plan_name || '-',
    row.material_name || row.material_key || '',
    row.material_key || '',
    `${Number(row.shortage_qty || 0).toLocaleString('vi-VN')} ${row.item_unit || ''}`.trim(),
    `${Number(row.available_stock_qty || 0).toLocaleString('vi-VN')} ${row.item_unit || ''}`.trim(),
    row.risk_level === 'critical' ? 'Khong du ton' : 'Sap thieu',
  ])

  const supplierRows = (data as any).supplier_risk_rows?.map((row: any) => [
    row.supplier_name || 'Khong gan NCC',
    riskKindLabel(row.risk_kind),
    row.material_name || '-',
    row.reference_code || '-',
    row.detail_text || '-',
    formatDateTime(row.event_at),
    row.severity === 'critical' ? 'Can gap' : 'Can xu ly',
  ]) || []

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
      <h1>${escapeHtml('Bao cao canh bao van hanh kho')}</h1>
      <div class="meta">Kho: ${escapeHtml(data.filters.warehouse_id || 'Tat ca')} | Tu ngay: ${escapeHtml(formatDateTime(data.filters.date_from))} | Den ngay: ${escapeHtml(formatDateTime(data.filters.date_to))}</div>
      <div class="meta">Xuat luc: ${escapeHtml(new Date().toLocaleString('vi-VN'))}</div>
      <h2>Tong hop canh bao</h2>
      ${buildTable(['Chi so', 'Gia tri'], summaryRows)}
      <h2>Vat tu duoi min</h2>
      ${buildTable(['Kho', 'Vat tu', 'Ma vat tu', 'Ton', 'Min', 'Kha dung', 'Gia tri ton'], lowStockRows)}
      <h2>Vat tu lau khong bien dong</h2>
      ${buildTable(['Kho', 'Vat tu', 'Ma vat tu', 'Ton', 'Ngay dung yen', 'Lan cuoi'], staleRows)}
      <h2>Gia nhap tang manh</h2>
      ${buildTable(['NCC', 'Kho', 'Vat tu', 'Ma vat tu', 'Gia cu', 'Gia moi', 'Tang', 'Thoi diem'], priceRows)}
      <h2>Phieu draft de lau</h2>
      ${buildTable(['Phieu', 'Kho', 'NCC', 'So ngay', 'Mo luc'], draftRows)}
      <h2>Vat tu sap thieu theo du an</h2>
      ${buildTable(['Du an', 'Ke hoach', 'Vat tu', 'Ma vat tu', 'Thieu', 'Ton kha dung', 'Muc do'], projectRows)}
      <h2>Canh bao theo nha cung cap</h2>
      ${buildTable(['NCC', 'Loai canh bao', 'Vat tu', 'Tham chieu', 'Chi tiet', 'Thoi diem', 'Muc do'], supplierRows)}
    </body>
  </html>`

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(`\uFEFF${html}`, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': `attachment; filename="inventory_alerts_${date}.xls"`,
    },
  })
}
