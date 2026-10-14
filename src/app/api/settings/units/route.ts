import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = String(sp.get('active_only') || 'false') === 'true'
  const categoryKey = String(sp.get('category_key') || '').trim()
  const q = String(sp.get('q') || '').trim()

  const where: any = {}
  if (activeOnly) where.is_active = true
  if (categoryKey) where.category_key = categoryKey
  if (q) {
    where.OR = [
      { unit_key: { contains: q, mode: 'insensitive' } },
      { unit_name: { contains: q, mode: 'insensitive' } },
      { symbol: { contains: q, mode: 'insensitive' } },
    ]
  }

  const data = await db.unit.findMany({
    where,
    orderBy: [{ sort_order: 'asc' }, { unit_name: 'asc' }],
  })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const unitKey = String(body?.unit_key || '').trim().toLowerCase()
  const unitName = String(body?.unit_name || '').trim()
  if (!unitKey || !unitName) {
    return NextResponse.json({ error: 'Thieu unit_key hoac unit_name' }, { status: 400 })
  }
  if (!/^[a-z0-9_]+$/.test(unitKey)) {
    return NextResponse.json({ error: 'unit_key chi gom a-z, 0-9, _' }, { status: 400 })
  }

  const data = await db.unit.create({
    data: {
      unit_key: unitKey,
      unit_name: unitName,
      symbol: body?.symbol ? String(body.symbol).trim() : null,
      category_key: body?.category_key ? String(body.category_key).trim() : 'other',
      description: body?.description ? String(body.description) : null,
      sort_order: Number(body?.sort_order || 0),
      is_active: body?.is_active === undefined ? true : Boolean(body.is_active),
    },
  })

  return NextResponse.json({ data }, { status: 201 })
}

