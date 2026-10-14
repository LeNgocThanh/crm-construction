import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { getSubcontractorReport } from '@/lib/subcontractor-report'

function escapeCSV(val: any): string {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const searchParams = new URL(req.url).searchParams
  const { data } = await getSubcontractorReport({
    q: String(searchParams.get('q') || ''),
    status_filter: searchParams.get('status_filter') as any,
    issue_filter: searchParams.get('issue_filter') as any,
    sort_by: searchParams.get('sort_by') as any,
  })

  const headers = [
    'Mã thầu phụ',
    'Tên thầu phụ',
    'Trạng thái',
    'Kế hoạch đang phụ trách',
    'Issue đang mở',
    'Issue quá hạn',
    'Issue mức cao/nghiêm trọng',
    'Số dự án tham gia',
    'Dự án',
    'Cập nhật issue gần nhất',
  ]

  const rows = data.map((row) => [
    row.supplier_code,
    row.supplier_name,
    row.is_active ? 'Đang dùng' : 'Ngừng dùng',
    row.active_plan_count,
    row.open_issue_count,
    row.overdue_issue_count,
    row.high_severity_issue_count,
    row.project_count,
    row.projects.map((project) => project.project_name || project.id).join(' | '),
    row.last_issue_at ? new Date(row.last_issue_at).toLocaleDateString('vi-VN') : '',
  ].map(escapeCSV).join(','))

  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n')
  const date = new Date().toISOString().split('T')[0]
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="subcontractor_report_${date}.csv"`,
    },
  })
}
