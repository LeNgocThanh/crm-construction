import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { purchaseOrderCode, serializePurchaseOrder, toOptionalNumber, syncPurchaseOrderReceiptSummary } from '@/lib/inventory/purchases'

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

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.inventoryRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const warehouseId = String(sp.get('warehouse_id') || '').trim()
  const supplierId = String(sp.get('supplier_id') || '').trim()
  const requestId = String(sp.get('request_id') || '').trim()
  const status = String(sp.get('status') || '').trim()
  const q = String(sp.get('q') || '').trim()
  const pageSize = Math.min(100, Math.max(1, Number(sp.get('page_size') || 30)))
  const page = Math.max(1, Number(sp.get('page') || 1))
  const skip = (page - 1) * pageSize

  const where: any = {}
  if (warehouseId) where.warehouse_id = warehouseId
  if (supplierId) where.supplier_id = supplierId
  if (requestId) where.request_id = requestId
  if (status) where.status = status
  if (q) {
    where.OR = [
      { order_code: { contains: q, mode: 'insensitive' } },
      { note: { contains: q, mode: 'insensitive' } },
      { items: { some: { material_key: { contains: q, mode: 'insensitive' } } } },
      { items: { some: { material_name: { contains: q, mode: 'insensitive' } } } },
    ]
  }

  const [total, rows] = await Promise.all([
    (db as any).inventoryPurchaseOrder.count({ where }),
    (db as any).inventoryPurchaseOrder.findMany({
      where,
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
        request: { select: { id: true, request_code: true, status: true } },
        items: true,
      },
      orderBy: [{ order_date: 'desc' }, { created_at: 'desc' }],
      skip,
      take: pageSize,
    }),
  ])

  return NextResponse.json({
    data: rows.map(serializePurchaseOrder),
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
}

export async function POST(req: NextRequest) {
  const access = await requirePermission(PERMISSIONS.inventoryManage)
  if (access.error) return access.error
  const session: any = access.ctx!.session

  const body = await req.json().catch(() => ({}))
  const requestId = String(body?.request_id || '').trim()
  const warehouseId = String(body?.warehouse_id || '').trim()
  const supplierId = String(body?.supplier_id || '').trim()
  if (!warehouseId || !supplierId) return NextResponse.json({ error: 'Thiếu kho hoặc nhà cung cấp' }, { status: 400 })

  let sourceRequest: any = null
  if (requestId) {
    sourceRequest = await (db as any).inventoryPurchaseRequest.findUnique({
      where: { id: requestId },
      include: { items: true },
    })
    if (!sourceRequest) return NextResponse.json({ error: 'Không tìm thấy đề nghị mua nguồn' }, { status: 404 })
    if (!['approved', 'ordered'].includes(String(sourceRequest.status || ''))) {
      return NextResponse.json({ error: 'Chỉ tạo đơn mua từ đề nghị đã duyệt' }, { status: 400 })
    }
  }

  const inputItems = Array.isArray(body?.items) && body.items.length ? body.items : (sourceRequest?.items || [])
  if (!inputItems.length) return NextResponse.json({ error: 'Đơn mua cần ít nhất 1 dòng vật tư' }, { status: 400 })
  const duplicate = dedupeMaterialKeys(inputItems)
  if (duplicate) return NextResponse.json({ error: `Vật tư bị lặp trong đơn mua: ${duplicate}` }, { status: 400 })

  const created = await db.$transaction(async (tx) => {
    const order = await (tx as any).inventoryPurchaseOrder.create({
      data: {
        order_code: String(body?.order_code || '').trim() || purchaseOrderCode(),
        request_id: requestId || null,
        warehouse_id: warehouseId,
        supplier_id: supplierId,
        order_date: body?.order_date ? new Date(body.order_date) : new Date(),
        expected_date: body?.expected_date ? new Date(body.expected_date) : null,
        status: 'draft',
        note: body?.note ? String(body.note) : null,
        created_by: String(session.user.username || session.user.id || ''),
      },
    })

    for (const raw of inputItems) {
      const materialKey = String(raw?.material_key || '').trim()
      const qty = toOptionalNumber(raw?.ordered_qty ?? raw?.quantity)
      if (!materialKey || qty == null || qty <= 0) throw new Error(`Dòng vật tư không hợp lệ: ${materialKey || 'unknown'}`)
      const unitPrice = toOptionalNumber(raw?.unit_price ?? raw?.suggested_unit_price)
        await (tx as any).inventoryPurchaseOrderItem.create({
        data: {
          order_id: order.id,
          request_item_id:
            raw?.request_item_id
              ? String(raw.request_item_id)
              : (raw?.id && sourceRequest?.items?.some((x: any) => x.id === raw.id) ? String(raw.id) : null),
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

    if (requestId) {
      await (tx as any).inventoryPurchaseRequest.update({
        where: { id: requestId },
        data: { status: 'ordered' },
      })
    }

    return (tx as any).inventoryPurchaseOrder.findUnique({
      where: { id: order.id },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
        request: { select: { id: true, request_code: true, status: true } },
        items: true,
      },
    })
  })

  return NextResponse.json({ data: serializePurchaseOrder(created) }, { status: 201 })
}
