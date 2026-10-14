import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = sp.get('active_only') !== 'false'
  const q = String(sp.get('q') || '').trim()

  const where: any = {}
  if (activeOnly) where.is_active = true
  if (q) {
    where.OR = [
      { warehouse_code: { contains: q, mode: 'insensitive' } },
      { warehouse_name: { contains: q, mode: 'insensitive' } },
      { region_code: { contains: q, mode: 'insensitive' } },
    ]
  }

  const data = await (db as any).warehouse.findMany({
    where,
    orderBy: [{ is_active: 'desc' }, { warehouse_name: 'asc' }],
  })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const code = String(body.warehouse_code || '').trim()
  const name = String(body.warehouse_name || '').trim()
  if (!code || !name) {
    return NextResponse.json({ error: 'Thiếu warehouse_code hoặc warehouse_name' }, { status: 400 })
  }

  const created = await (db as any).warehouse.create({
    data: {
      warehouse_code: code,
      warehouse_name: name,
      region_code: body.region_code ? String(body.region_code).trim() : null,
      address: body.address ? String(body.address).trim() : null,
      manager_name: body.manager_name ? String(body.manager_name).trim() : null,
      manager_phone: body.manager_phone ? String(body.manager_phone).trim() : null,
      is_active: body.is_active !== false,
    },
  })
  return NextResponse.json({ data: created }, { status: 201 })
}

