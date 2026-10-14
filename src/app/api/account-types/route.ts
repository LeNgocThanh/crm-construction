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

  const prismaAny = db as any
  const data = await prismaAny.accountType.findMany({
    where,
    orderBy: [{ is_active: 'desc' }, { account_type_name: 'asc' }],
    select: {
      id: true,
      account_type_key: true,
      account_type_name: true,
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
  const key = String(body?.account_type_key || '').trim().toLowerCase()
  const name = String(body?.account_type_name || '').trim()
  const description = String(body?.description || '').trim()

  if (!key || !name) return NextResponse.json({ error: 'Thieu account_type_key hoac account_type_name' }, { status: 400 })
  if (!/^[a-z0-9_]+$/.test(key)) return NextResponse.json({ error: 'account_type_key chi gom a-z, 0-9, _' }, { status: 400 })

  const prismaAny = db as any
  const data = await prismaAny.accountType.create({
    data: {
      account_type_key: key,
      account_type_name: name,
      description: description || null,
      is_active: body?.is_active !== false,
    },
  })

  return NextResponse.json({ data }, { status: 201 })
}
