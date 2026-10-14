import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function isAllowedKind(v: string) {
  return /^[a-z0-9_]+$/i.test(v)
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = sp.get('active_only') !== 'false'
  const kind = String(sp.get('kind') || '').trim()

  const where: any = {}
  if (activeOnly) where.is_active = true
  if (kind) where.kind = kind

  const data = await db.estimationTaxonomy.findMany({
    where,
    orderBy: [{ kind: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const kind = String(body.kind || '').trim()
  const value = String(body.value || '').trim()
  const name = String(body.name ?? body.label ?? '').trim()

  if (!isAllowedKind(kind)) {
    return NextResponse.json({ error: 'kind không hợp lệ' }, { status: 400 })
  }
  if (!value || !name) {
    return NextResponse.json({ error: 'Thiếu value hoặc name' }, { status: 400 })
  }

  const created = await db.estimationTaxonomy.create({
    data: {
      kind,
      value,
      name,
      description: body.description ? String(body.description) : null,
      sort_order: body.sort_order !== undefined ? Number(body.sort_order) || 0 : 0,
      is_active: body.is_active !== false,
    },
  })

  return NextResponse.json({ data: created }, { status: 201 })
}
