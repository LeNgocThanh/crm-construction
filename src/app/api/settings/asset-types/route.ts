import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = String(sp.get('active_only') || 'false') === 'true'
  const where: any = {}
  if (activeOnly) where.is_active = true

  const data = await db.assetType.findMany({
    where,
    include: { default_unit: { select: { id: true, unit_key: true, unit_name: true, symbol: true } } },
    orderBy: [{ sort_order: 'asc' }, { type_name: 'asc' }],
  })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const typeKey = String(body?.type_key || '').trim().toLowerCase()
  const typeName = String(body?.type_name || '').trim()
  if (!typeKey || !typeName) return NextResponse.json({ error: 'Thieu type_key hoac type_name' }, { status: 400 })
  if (!/^[a-z0-9_]+$/.test(typeKey)) return NextResponse.json({ error: 'type_key chi gom a-z, 0-9, _' }, { status: 400 })

  const data = await db.assetType.create({
    data: {
      type_key: typeKey,
      type_name: typeName,
      description: body?.description ? String(body.description) : null,
      default_unit_id: body?.default_unit_id ? String(body.default_unit_id) : null,
      sort_order: Number(body?.sort_order || 0),
      is_active: body?.is_active === undefined ? true : Boolean(body.is_active),
    },
    include: { default_unit: { select: { id: true, unit_key: true, unit_name: true, symbol: true } } },
  })
  return NextResponse.json({ data }, { status: 201 })
}
