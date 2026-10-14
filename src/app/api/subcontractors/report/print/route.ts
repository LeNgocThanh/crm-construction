import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { getSubcontractorReport } from '@/lib/subcontractor-report'
import { getPrintBrandSettings } from '@/lib/print/service'
import { escapePrintHtml, renderPrintHeaderHtml, renderPrintShellHtml } from '@/lib/print/layout'

function buildScopeHtml(filters: { q?: string; status_filter?: string | null; issue_filter?: string | null; sort_by?: string | null }) {
  const chunks = [
    `Từ khóa: <b>${escapePrintHtml(filters.q || 'Tất cả')}</b>`,
    `Trạng thái: <b>${escapePrintHtml(filters.status_filter || 'all')}</b>`,
    `Lọc issue: <b>${escapePrintHtml(filters.issue_filter || 'all')}</b>`,
    `Sắp xếp: <b>${escapePrintHtml(filters.sort_by || 'overdue_desc')}</b>`,
  ]
  return chunks.join(' | ')
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const searchParams = new URL(req.url).searchParams
  const filters = {
    q: String(searchParams.get('q') || ''),
    status_filter: searchParams.get('status_filter'),
    issue_filter: searchParams.get('issue_filter'),
    sort_by: searchParams.get('sort_by'),
  }
  const { data, summary } = await getSubcontractorReport({
    q: filters.q,
    status_filter: filters.status_filter as any,
    issue_filter: filters.issue_filter as any,
    sort_by: filters.sort_by as any,
  })
  const brand = await getPrintBrandSettings()
  const printedBy = String(auth.ctx?.session?.user?.username || auth.ctx?.session?.user?.id || 'Hệ thống')

  const summaryHtml = `
    <div class="print-summary-grid">
      <div class="print-summary-card"><div class="print-summary-key">Số thầu phụ</div><div class="print-summary-value">${summary.subcontractor_count}</div></div>
      <div class="print-summary-card"><div class="print-summary-key">Kế hoạch đang phụ trách</div><div class="print-summary-value">${summary.active_plan_count}</div></div>
      <div class="print-summary-card"><div class="print-summary-key">Issue đang mở</div><div class="print-summary-value">${summary.open_issue_count}</div></div>
      <div class="print-summary-card"><div class="print-summary-key">Issue quá hạn</div><div class="print-summary-value">${summary.overdue_issue_count}</div></div>
    </div>
  `

  const rowsHtml = data.map((row) => `
    <tr>
      <td>${escapePrintHtml(row.supplier_code)}</td>
      <td>${escapePrintHtml(row.supplier_name)}</td>
      <td>${escapePrintHtml(row.is_active ? 'Đang dùng' : 'Ngừng dùng')}</td>
      <td class="center">${row.active_plan_count}</td>
      <td class="center">${row.open_issue_count}</td>
      <td class="center">${row.overdue_issue_count}</td>
      <td class="center">${row.high_severity_issue_count}</td>
      <td class="center">${row.project_count}</td>
      <td>${escapePrintHtml(row.projects.map((project) => project.project_name || project.id).join(', ') || '-')}</td>
      <td>${escapePrintHtml(row.last_issue_at ? new Date(row.last_issue_at).toLocaleDateString('vi-VN') : '-')}</td>
    </tr>
  `).join('')

  const bodyHtml = `
    ${summaryHtml}
    <div class="print-section">
      <div class="print-section-title">Danh sách thầu phụ</div>
      <table class="print-table">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Tên thầu phụ</th>
            <th>Trạng thái</th>
            <th>Kế hoạch</th>
            <th>Issue mở</th>
            <th>Quá hạn</th>
            <th>Mức cao</th>
            <th>Dự án</th>
            <th>Danh sách dự án</th>
            <th>Cập nhật gần nhất</th>
          </tr>
        </thead>
        <tbody>${rowsHtml || '<tr><td colspan="10">Không có dữ liệu</td></tr>'}</tbody>
      </table>
      <div class="print-note">Báo cáo phản ánh đúng bộ lọc hiện tại trên màn hình quản lý thầu phụ.</div>
    </div>
  `

  const headerHtml = renderPrintHeaderHtml({
    title: 'Báo cáo thầu phụ',
    subtitle: 'Tổng hợp thầu phụ tham gia dự án, số việc đang mở, quá hạn và mức độ ưu tiên xử lý.',
    printedBy,
    printedAt: new Date().toLocaleString('vi-VN'),
    code: `SUB-REPORT-${new Date().toISOString().slice(0, 10)}`,
  }, buildScopeHtml(filters), brand)

  const html = renderPrintShellHtml({
    titleTag: 'Báo cáo thầu phụ',
    headerHtml,
    bodyHtml,
    brand,
    autoPrint: searchParams.get('print') === '1',
  })

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
