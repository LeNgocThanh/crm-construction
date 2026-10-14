import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { getSubcontractorReport } from '@/lib/subcontractor-report'

export async function GET(req: Request) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error
  const searchParams = new URL(req.url).searchParams
  const { data, summary } = await getSubcontractorReport({
    q: String(searchParams.get('q') || ''),
    status_filter: searchParams.get('status_filter') as any,
    issue_filter: searchParams.get('issue_filter') as any,
    sort_by: searchParams.get('sort_by') as any,
  })

  return NextResponse.json({ data, summary })
}
