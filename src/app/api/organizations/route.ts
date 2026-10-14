import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireRoles } from '@/lib/authz'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const activeOnly = String(sp.get('active_only') || 'false') === 'true'
  const where: any = {}
  if (activeOnly) where.is_active = true

  const data = await db.organization.findMany({
    where,
    orderBy: [{ is_active: 'desc' }, { org_name: 'asc' }],
    select: {
      id: true,
      parent_id: true,
      org_key: true,
      org_name: true,
      org_type: true,
      region_code: true,
      address: true,
      legal_name: true,
      tax_code: true,
      description: true,
      is_active: true,
      created_at: true,
      parent: { select: { id: true, org_name: true, org_key: true } },
      _count: { select: { departments: true } },
    },
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(['admin', 'manager'])
  if (auth.error) return auth.error

  const body = await req.json()
  const org_key = String(body?.org_key || '').trim().toLowerCase()
  const org_name = String(body?.org_name || '').trim()
  const parent_id = String(body?.parent_id || '').trim() || null
  if (!org_key || !org_name) return NextResponse.json({ error: 'Thieu org_key hoac org_name' }, { status: 400 })
  if (!/^[a-z0-9_]+$/.test(org_key)) return NextResponse.json({ error: 'org_key chi gom a-z, 0-9, _' }, { status: 400 })

  const data = await db.organization.create({
    data: {
      parent_id,
      org_key,
      org_name,
      org_type: String(body?.org_type || '').trim() || null,
      region_code: String(body?.region_code || '').trim() || null,
      address: String(body?.address || '').trim() || null,
      legal_name: String(body?.legal_name || '').trim() || null,
      tax_code: String(body?.tax_code || '').trim() || null,
      description: String(body?.description || '').trim() || null,
      is_active: body?.is_active !== false,
    },
  })

  return NextResponse.json({ data }, { status: 201 })
}
