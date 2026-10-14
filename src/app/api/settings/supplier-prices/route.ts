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
  const supplierId = String(sp.get('supplier_id') || '').trim()
  const materialKey = String(sp.get('material_key') || '').trim()
  const regionCode = String(sp.get('region_code') || '').trim()

  const where: any = {}
  if (activeOnly) where.is_active = true
  if (supplierId) where.supplier_id = supplierId
  if (materialKey) where.material_key = materialKey
  if (regionCode) where.region_code = regionCode

  const data = await (db as any).supplierMaterialPrice.findMany({
    where,
    orderBy: [{ material_key: 'asc' }, { valid_from: 'desc' }, { created_at: 'desc' }],
    include: { supplier: true, catalog_item: true },
  })

  return NextResponse.json({
    data: data.map((x: any) => ({
      ...x,
      price_per_unit: Number(x.price_per_unit),
    })),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const supplierId = String(body.supplier_id || '').trim()
  const materialKey = String(body.material_key || '').trim()
  const price = toNumber(body.price_per_unit)

  if (!supplierId || !materialKey || !price || price <= 0) {
    return NextResponse.json({ error: 'Thiếu supplier_id/material_key/price_per_unit' }, { status: 400 })
  }

  const created = await (db as any).supplierMaterialPrice.create({
    data: {
      supplier_id: supplierId,
      catalog_item_id: body.catalog_item_id ? String(body.catalog_item_id).trim() : null,
      material_key: materialKey,
      material_name: body.material_name ? String(body.material_name).trim() : null,
      unit: body.unit ? String(body.unit).trim() : null,
      region_code: body.region_code ? String(body.region_code).trim() : null,
      price_per_unit: BigInt(Math.round(price)),
      currency: body.currency ? String(body.currency).trim() : 'VND',
      min_order_qty: toNumber(body.min_order_qty),
      source_note: body.source_note ? String(body.source_note) : null,
      valid_from: body.valid_from ? new Date(body.valid_from) : new Date(),
      valid_to: body.valid_to ? new Date(body.valid_to) : null,
      is_active: body.is_active !== false,
    },
    include: { supplier: true, catalog_item: true },
  })

  return NextResponse.json({
    data: {
      ...created,
      price_per_unit: Number(created.price_per_unit),
    },
  }, { status: 201 })
}

