import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = String(sp.get('active_only') || 'false') === 'true'
  const where: any = {}
  if (activeOnly) where.is_active = true

  const data = await db.group.findMany({
    where,
    orderBy: [{ is_active: 'desc' }, { group_name: 'asc' }],
    select: {
      id: true,
      group_key: true,
      group_name: true,
      description: true,
      is_active: true,
      created_at: true,
      _count: { select: { memberships: true } },
    },
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const key = String(body?.group_key || '').trim().toLowerCase()
  const name = String(body?.group_name || '').trim()
  const description = String(body?.description || '').trim()

  if (!key || !name) return NextResponse.json({ error: 'Thieu group_key hoac group_name' }, { status: 400 })
  if (!/^[a-z0-9_]+$/.test(key)) return NextResponse.json({ error: 'group_key chi gom a-z, 0-9, _' }, { status: 400 })

  const data = await db.group.create({
    data: {
      group_key: key,
      group_name: name,
      description: description || null,
      is_active: body?.is_active !== false,
    },
  })

  return NextResponse.json({ data }, { status: 201 })
}
