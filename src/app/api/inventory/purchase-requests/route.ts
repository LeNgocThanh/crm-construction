import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { purchaseRequestCode, serializePurchaseRequest, toOptionalNumber } from '@/lib/inventory/purchases'

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
  const status = String(sp.get('status') || '').trim()
  const q = String(sp.get('q') || '').trim()
  const pageSize = Math.min(100, Math.max(1, Number(sp.get('page_size') || 30)))
  const page = Math.max(1, Number(sp.get('page') || 1))
  const skip = (page - 1) * pageSize

  const where: any = {}
  if (warehouseId) where.warehouse_id = warehouseId
  if (supplierId) where.supplier_id = supplierId
  if (status) where.status = status
  if (q) {
    where.OR = [
      { request_code: { contains: q, mode: 'insensitive' } },
      { note: { contains: q, mode: 'insensitive' } },
      { items: { some: { material_key: { contains: q, mode: 'insensitive' } } } },
      { items: { some: { material_name: { contains: q, mode: 'insensitive' } } } },
    ]
  }

  const [total, rows] = await Promise.all([
    (db as any).inventoryPurchaseRequest.count({ where }),
    (db as any).inventoryPurchaseRequest.findMany({
      where,
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
        items: true,
        purchase_orders: { select: { id: true, order_code: true, status: true } },
      },
      orderBy: [{ request_date: 'desc' }, { created_at: 'desc' }],
      skip,
      take: pageSize,
    }),
  ])

  return NextResponse.json({
    data: rows.map(serializePurchaseRequest),
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
  const warehouseId = String(body?.warehouse_id || '').trim()
  if (!warehouseId) return NextResponse.json({ error: 'Thiếu kho đề nghị mua' }, { status: 400 })
  const items = Array.isArray(body?.items) ? body.items : []
  if (!items.length) return NextResponse.json({ error: 'Đề nghị mua cần ít nhất 1 dòng vật tư' }, { status: 400 })
  const duplicate = dedupeMaterialKeys(items)
  if (duplicate) return NextResponse.json({ error: `Vật tư bị lặp trong đề nghị mua: ${duplicate}` }, { status: 400 })

  const created = await db.$transaction(async (tx) => {
    const request = await (tx as any).inventoryPurchaseRequest.create({
      data: {
        request_code: String(body?.request_code || '').trim() || purchaseRequestCode(),
        warehouse_id: warehouseId,
        supplier_id: body?.supplier_id ? String(body.supplier_id) : null,
        request_date: body?.request_date ? new Date(body.request_date) : new Date(),
        needed_date: body?.needed_date ? new Date(body.needed_date) : null,
        status: 'draft',
        note: body?.note ? String(body.note) : null,
        created_by: String(session.user.username || session.user.id || ''),
      },
    })

    for (const raw of items) {
      const materialKey = String(raw?.material_key || '').trim()
      const qty = toOptionalNumber(raw?.quantity)
      if (!materialKey || qty == null || qty <= 0) throw new Error(`Dòng vật tư không hợp lệ: ${materialKey || 'unknown'}`)
      const suggestedUnitPrice = toOptionalNumber(raw?.suggested_unit_price)
      await (tx as any).inventoryPurchaseRequestItem.create({
        data: {
          request_id: request.id,
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

    return (tx as any).inventoryPurchaseRequest.findUnique({
      where: { id: request.id },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
        items: true,
        purchase_orders: { select: { id: true, order_code: true, status: true } },
      },
    })
  })

  return NextResponse.json({ data: serializePurchaseRequest(created) }, { status: 201 })
}
