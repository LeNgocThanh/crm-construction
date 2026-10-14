import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrintBrandSettings } from '@/lib/print/service'
import { escapePrintHtml, renderPrintHeaderHtml, renderPrintShellHtml } from '@/lib/print/layout'
import { serializeInventoryAudit } from '@/lib/inventory/audits'

function formatMoney(value?: number | null) {
  return `${Number(value || 0).toLocaleString('vi-VN')} vnd`
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

function sectionTable(headers: string[], rows: string[][]) {
  const head = headers.map((x) => `<th>${escapePrintHtml(x)}</th>`).join('')
  const body = rows.length
    ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapePrintHtml(cell)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${headers.length}">Khong co du lieu</td></tr>`
  return `
    <table class="print-table">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  `
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.inventoryRead)
  if (auth.error) return auth.error
  const brand = await getPrintBrandSettings()

  const row = await (db as any).inventoryStockAudit.findUnique({
    where: { id: params.id },
    include: {
      warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
      applied_txn: { select: { id: true, txn_code: true, status: true } },
      items: {
        orderBy: [{ material_name: 'asc' }, { material_key: 'asc' }],
      },
    },
  })
  if (!row) {
    return NextResponse.json({ error: 'Khong tim thay phieu kiem ke' }, { status: 404 })
  }

  const audit = serializeInventoryAudit(row)
  const itemRows = (audit.items || []).map((item: any) => [
    item.material_name || item.material_key || '',
    item.material_key || '',
    item.item_unit || '-',
    Number(item.book_qty || 0).toLocaleString('vi-VN'),
    item.counted_qty == null ? '-' : Number(item.counted_qty).toLocaleString('vi-VN'),
    item.variance_qty == null ? '-' : Number(item.variance_qty).toLocaleString('vi-VN'),
    item.variance_qty == null ? '-' : formatMoney(item.variance_value),
    item.note || '-',
  ])

  const scopeHtml = `
    Kho: <b>${escapePrintHtml(audit.warehouse?.warehouse_name || '-')}</b> |
    Ma phieu: <b>${escapePrintHtml(audit.audit_code)}</b> |
    Thoi diem kiem ke: <b>${escapePrintHtml(formatDateTime(audit.audit_date))}</b> |
    Trang thai: <b>${escapePrintHtml(String(audit.status || '-'))}</b>
  `

  const summaryHtml = `
    <div class="print-summary-grid">
      <div class="print-summary-card"><div class="print-summary-key">Tong dong</div><div class="print-summary-value">${escapePrintHtml(audit.total_items)}</div></div>
      <div class="print-summary-card"><div class="print-summary-key">Da dem</div><div class="print-summary-value">${escapePrintHtml(audit.counted_items)}</div></div>
      <div class="print-summary-card"><div class="print-summary-key">Dong lech</div><div class="print-summary-value">${escapePrintHtml(audit.variance_items)}</div></div>
      <div class="print-summary-card"><div class="print-summary-key">Gia tri lech</div><div class="print-summary-value">${escapePrintHtml(formatMoney(audit.total_variance_value))}</div></div>
    </div>
  `

  const bodyHtml = `
    ${summaryHtml}
    <section class="print-section">
      <div class="print-section-title">Thong tin phieu</div>
      <table class="print-table">
        <tbody>
          <tr>
            <td><b>Ghi chu</b></td>
            <td>${escapePrintHtml(audit.note || '-')}</td>
            <td><b>Phieu dieu chinh</b></td>
            <td>${escapePrintHtml(audit.applied_txn_code || '-')}</td>
          </tr>
        </tbody>
      </table>
    </section>
    <section class="print-section">
      <div class="print-section-title">Chi tiet kiem ke</div>
      ${sectionTable(
        ['Vat tu', 'Ma vat tu', 'Don vi', 'Ton so', 'Dem thuc te', 'Chenh lech', 'Gia tri lech', 'Ghi chu'],
        itemRows
      )}
    </section>
    <div class="print-sign-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div><div class="print-sign-title">Nguoi lap</div><div class="print-sign-box">(Ky, ghi ro ho ten)</div></div>
      <div><div class="print-sign-title">Nguoi kiem ke</div><div class="print-sign-box">(Ky, ghi ro ho ten)</div></div>
      <div><div class="print-sign-title">Quan ly kho</div><div class="print-sign-box">(Ky, ghi ro ho ten)</div></div>
    </div>
  `

  const headerHtml = renderPrintHeaderHtml({
    title: 'Phieu kiem ke kho',
    subtitle: 'Phieu doi chieu ton so va ton dem thuc te tai kho.',
    code: audit.audit_code,
    printedBy: auth.ctx?.session?.user?.username || 'He thong',
    printedAt: new Date().toLocaleString('vi-VN'),
  }, scopeHtml, brand)

  const html = renderPrintShellHtml({
    titleTag: `Phieu kiem ke ${audit.audit_code}`,
    headerHtml,
    bodyHtml,
    brand,
    autoPrint: new URL(req.url).searchParams.get('print') === '1',
  })

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
