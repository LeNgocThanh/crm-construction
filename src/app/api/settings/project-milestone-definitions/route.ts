import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error
  const activeOnly = new URL(req.url).searchParams.get('active_only') !== 'false'
  const rows = await (db as any).projectMilestoneDefinition.findMany({
    where: activeOnly ? { is_active: true } : undefined,
    orderBy: [{ sort_order: 'asc' }, { definition_name: 'asc' }],
    include: { default_status_ref: { select: { status_key: true, status_name: true } } },
  })
  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const key = String(body?.definition_key || '').trim()
  const name = String(body?.definition_name || '').trim()
  if (!key || !name) return NextResponse.json({ error: 'Thieu definition_key/definition_name' }, { status: 400 })
  const created = await (db as any).projectMilestoneDefinition.create({
    data: {
      definition_key: key,
      definition_name: name,
      description: body?.description ? String(body.description) : null,
      default_status_key: body?.default_status_key ? String(body.default_status_key) : 'pending',
      sort_order: Number(body?.sort_order || 0),
      is_active: body?.is_active !== false,
    },
  })
  return NextResponse.json({ data: created }, { status: 201 })
}

