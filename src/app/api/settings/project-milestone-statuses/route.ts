import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = String(sp.get('active_only') || 'true') !== 'false'
  const where: any = {}
  if (activeOnly) where.is_active = true

  const rows = await db.projectMilestoneStatus.findMany({
    where,
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  })
  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const statusKey = String(body?.status_key || '').trim()
  const statusName = String(body?.status_name || '').trim()
  if (!statusKey || !statusName) {
    return NextResponse.json({ error: 'Thieu status_key hoac status_name' }, { status: 400 })
  }
  const created = await db.projectMilestoneStatus.create({
    data: {
      status_key: statusKey,
      status_name: statusName,
      sort_order: Number(body?.sort_order || 0),
      is_active: body?.is_active !== undefined ? Boolean(body.is_active) : true,
    },
  })
  return NextResponse.json({ data: created }, { status: 201 })
}
