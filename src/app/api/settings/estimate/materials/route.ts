import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = sp.get('active_only') !== 'false'
  const region = sp.get('region')

  const where: any = {}
  if (activeOnly) where.is_active = true
  if (region) where.region_code = region

  const data = await db.estimationMaterialPrice.findMany({
    where,
    orderBy: [{ material_key: 'asc' }, { updated_at: 'desc' }],
  })

  return NextResponse.json({
    data: data.map((x) => ({ ...x, price_per_unit: Number(x.price_per_unit) })),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const materialKey = String(body.material_key || '').trim()
  const materialName = String(body.material_name || '').trim()
  const unit = String(body.unit || '').trim()
  const price = toNumber(body.price_per_unit)

  if (!materialKey || !materialName || !unit || !price || price <= 0) {
    return NextResponse.json({ error: 'Thiếu hoặc sai dữ liệu vật tư' }, { status: 400 })
  }

  const created = await db.estimationMaterialPrice.create({
    data: {
      material_key: materialKey,
      material_name: materialName,
      unit,
      price_per_unit: BigInt(Math.round(price)),
      region_code: body.region_code ? String(body.region_code).trim() : null,
      source_note: body.source_note ? String(body.source_note) : null,
      valid_from: body.valid_from ? new Date(body.valid_from) : new Date(),
      valid_to: body.valid_to ? new Date(body.valid_to) : null,
      is_active: body.is_active !== false,
    },
  })

  return NextResponse.json(
    { data: { ...created, price_per_unit: Number(created.price_per_unit) } },
    { status: 201 }
  )
}

