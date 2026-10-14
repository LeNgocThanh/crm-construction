import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { serializePurchaseOrder, toOptionalNumber } from '@/lib/inventory/purchases'

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

  const row = await (db as any).inventoryPurchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
      supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
      request: { select: { id: true, request_code: true, status: true } },
      items: true,
    },
  })
  if (!row) return NextResponse.json({ error: 'Không tìm thấy đơn mua' }, { status: 404 })
  return NextResponse.json({ data: serializePurchaseOrder(row) })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.inventoryManage)
  if (auth.error) return auth.error

  const existing = await (db as any).inventoryPurchaseOrder.findUnique({
    where: { id: params.id },
  })
  if (!existing) return NextResponse.json({ error: 'Không tìm thấy đơn mua' }, { status: 404 })
  if (String(existing.status || '') !== 'draft') {
    return NextResponse.json({ error: 'Chỉ được sửa đơn mua ở trạng thái nháp' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const items = Array.isArray(body?.items) ? body.items : null
  if (items) {
    const duplicate = dedupeMaterialKeys(items)
    if (duplicate) return NextResponse.json({ error: `Vật tư bị lặp trong đơn mua: ${duplicate}` }, { status: 400 })
  }

  const updated = await db.$transaction(async (tx) => {
    await (tx as any).inventoryPurchaseOrder.update({
      where: { id: params.id },
      data: {
        supplier_id: body?.supplier_id ? String(body.supplier_id) : existing.supplier_id,
        order_date: body?.order_date !== undefined ? (body.order_date ? new Date(body.order_date) : existing.order_date) : undefined,
        expected_date: body?.expected_date !== undefined ? (body.expected_date ? new Date(body.expected_date) : null) : undefined,
        note: body?.note !== undefined ? (body.note ? String(body.note) : null) : undefined,
      },
    })

    if (items) {
      await (tx as any).inventoryPurchaseOrderItem.deleteMany({ where: { order_id: params.id } })
      for (const raw of items) {
        const materialKey = String(raw?.material_key || '').trim()
        const qty = toOptionalNumber(raw?.ordered_qty ?? raw?.quantity)
        if (!materialKey || qty == null || qty <= 0) throw new Error(`Dòng vật tư không hợp lệ: ${materialKey || 'unknown'}`)
        const unitPrice = toOptionalNumber(raw?.unit_price)
        await (tx as any).inventoryPurchaseOrderItem.create({
          data: {
            order_id: params.id,
            request_item_id: raw?.request_item_id ? String(raw.request_item_id) : null,
            catalog_item_id: raw?.catalog_item_id ? String(raw.catalog_item_id) : null,
            material_key: materialKey,
            material_name: raw?.material_name ? String(raw.material_name) : null,
            item_unit: raw?.item_unit ? String(raw.item_unit) : null,
            ordered_qty: qty,
            unit_price: unitPrice != null ? BigInt(Math.round(unitPrice)) : null,
            note: raw?.note ? String(raw.note) : null,
          },
        })
      }
    }

    return (tx as any).inventoryPurchaseOrder.findUnique({
      where: { id: params.id },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
        request: { select: { id: true, request_code: true, status: true } },
        items: true,
      },
    })
  })

  return NextResponse.json({ data: serializePurchaseOrder(updated) })
}
