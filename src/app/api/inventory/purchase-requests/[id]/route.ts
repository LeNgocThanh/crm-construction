import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { serializePurchaseRequest, toOptionalNumber } from '@/lib/inventory/purchases'

function dedupeMaterialKeys(items: any[]) {
  const seen = new Set<string>()
  for (const raw of items) {
    const key = String(raw?.material_key || '').trim()
    if (!key) continue
    if (seen.has(key)) return key
    seen.add(key)
  }
  return null
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.inventoryRead)
  if (auth.error) return auth.error

  const row = await (db as any).inventoryPurchaseRequest.findUnique({
    where: { id: params.id },
    include: {
      warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
      supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
      items: true,
      purchase_orders: { select: { id: true, order_code: true, status: true } },
    },
  })
  if (!row) return NextResponse.json({ error: 'Không tìm thấy đề nghị mua' }, { status: 404 })
  return NextResponse.json({ data: serializePurchaseRequest(row) })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.inventoryManage)
  if (auth.error) return auth.error

  const existing = await (db as any).inventoryPurchaseRequest.findUnique({
    where: { id: params.id },
  })
  if (!existing) return NextResponse.json({ error: 'Không tìm thấy đề nghị mua' }, { status: 404 })
  if (String(existing.status || '') !== 'draft') {
    return NextResponse.json({ error: 'Chỉ được sửa đề nghị mua ở trạng thái nháp' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const items = Array.isArray(body?.items) ? body.items : null
  if (items) {
    const duplicate = dedupeMaterialKeys(items)
    if (duplicate) return NextResponse.json({ error: `Vật tư bị lặp trong đề nghị mua: ${duplicate}` }, { status: 400 })
  }

  const updated = await db.$transaction(async (tx) => {
    await (tx as any).inventoryPurchaseRequest.update({
      where: { id: params.id },
      data: {
        supplier_id: body?.supplier_id !== undefined ? (body?.supplier_id ? String(body.supplier_id) : null) : undefined,
        request_date: body?.request_date !== undefined ? (body.request_date ? new Date(body.request_date) : existing.request_date) : undefined,
        needed_date: body?.needed_date !== undefined ? (body.needed_date ? new Date(body.needed_date) : null) : undefined,
        note: body?.note !== undefined ? (body.note ? String(body.note) : null) : undefined,
      },
    })

    if (items) {
      await (tx as any).inventoryPurchaseRequestItem.deleteMany({ where: { request_id: params.id } })
      for (const raw of items) {
        const materialKey = String(raw?.material_key || '').trim()
        const qty = toOptionalNumber(raw?.quantity)
        if (!materialKey || qty == null || qty <= 0) throw new Error(`Dòng vật tư không hợp lệ: ${materialKey || 'unknown'}`)
        const suggestedUnitPrice = toOptionalNumber(raw?.suggested_unit_price)
        await (tx as any).inventoryPurchaseRequestItem.create({
          data: {
            request_id: params.id,
            catalog_item_id: raw?.catalog_item_id ? String(raw.catalog_item_id) : null,
            material_key: materialKey,
            material_name: raw?.material_name ? String(raw.material_name) : null,
            item_unit: raw?.item_unit ? String(raw.item_unit) : null,
            quantity: qty,
            suggested_unit_price: suggestedUnitPrice != null ? BigInt(Math.round(suggestedUnitPrice)) : null,
            note: raw?.note ? String(raw.note) : null,
          },
        })
      }
    }

    return (tx as any).inventoryPurchaseRequest.findUnique({
      where: { id: params.id },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
        items: true,
        purchase_orders: { select: { id: true, order_code: true, status: true } },
      },
    })
  })

  return NextResponse.json({ data: serializePurchaseRequest(updated) })
}
