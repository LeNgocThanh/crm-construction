import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireRoles } from '@/lib/authz'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const orgId = String(sp.get('organization_id') || '').trim()
  const activeOnly = String(sp.get('active_only') || 'false') === 'true'
  const where: any = {}
  if (orgId) where.organization_id = orgId
  if (activeOnly) where.is_active = true

  const data = await db.department.findMany({
    where,
    orderBy: [{ organization_id: 'asc' }, { sort_order: 'asc' }, { dept_name: 'asc' }],
    select: {
      id: true,
      organization_id: true,
      parent_id: true,
      dept_key: true,
      dept_name: true,
      description: true,
      sort_order: true,
      is_active: true,
      organization: { select: { id: true, org_key: true, org_name: true } },
      parent: { select: { id: true, dept_name: true } },
      _count: { select: { children: true } },
    },
  })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(['admin', 'manager'])
  if (auth.error) return auth.error

  const body = await req.json()
  const organization_id = String(body?.organization_id || '').trim()
  const dept_key = String(body?.dept_key || '').trim().toLowerCase()
  const dept_name = String(body?.dept_name || '').trim()
  if (!organization_id || !dept_key || !dept_name) {
    return NextResponse.json({ error: 'Thieu organization_id, dept_key hoac dept_name' }, { status: 400 })
  }
  if (!/^[a-z0-9_]+$/.test(dept_key)) return NextResponse.json({ error: 'dept_key chi gom a-z, 0-9, _' }, { status: 400 })

  const data = await db.department.create({
    data: {
      organization_id,
      parent_id: String(body?.parent_id || '').trim() || null,
      dept_key,
      dept_name,
      description: String(body?.description || '').trim() || null,
      sort_order: Number(body?.sort_order || 0) || 0,
      is_active: body?.is_active !== false,
    },
  })
  return NextResponse.json({ data }, { status: 201 })
}

