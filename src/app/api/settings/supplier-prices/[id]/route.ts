import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const price = body.price_per_unit !== undefined ? toNumber(body.price_per_unit) : null

  const updated = await (db as any).supplierMaterialPrice.update({
    where: { id: params.id },
    data: {
      ...(body.supplier_id !== undefined ? { supplier_id: String(body.supplier_id || '').trim() } : {}),
      ...(body.catalog_item_id !== undefined ? { catalog_item_id: body.catalog_item_id ? String(body.catalog_item_id).trim() : null } : {}),
      ...(body.material_key !== undefined ? { material_key: String(body.material_key || '').trim() } : {}),
      ...(body.material_name !== undefined ? { material_name: body.material_name ? String(body.material_name).trim() : null } : {}),
      ...(body.unit !== undefined ? { unit: body.unit ? String(body.unit).trim() : null } : {}),
      ...(body.region_code !== undefined ? { region_code: body.region_code ? String(body.region_code).trim() : null } : {}),
      ...(body.currency !== undefined ? { currency: body.currency ? String(body.currency).trim() : 'VND' } : {}),
      ...(body.min_order_qty !== undefined ? { min_order_qty: toNumber(body.min_order_qty) } : {}),
      ...(body.source_note !== undefined ? { source_note: body.source_note ? String(body.source_note) : null } : {}),
      ...(body.valid_from !== undefined ? { valid_from: body.valid_from ? new Date(body.valid_from) : new Date() } : {}),
      ...(body.valid_to !== undefined ? { valid_to: body.valid_to ? new Date(body.valid_to) : null } : {}),
      ...(body.is_active !== undefined ? { is_active: Boolean(body.is_active) } : {}),
      ...(body.price_per_unit !== undefined && price && price > 0 ? { price_per_unit: BigInt(Math.round(price)) } : {}),
    },
    include: { supplier: true, catalog_item: true },
  })

  return NextResponse.json({
    data: {
      ...updated,
      price_per_unit: Number(updated.price_per_unit),
    },
  })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  await (db as any).supplierMaterialPrice.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

