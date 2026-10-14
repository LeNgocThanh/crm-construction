import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { serializePurchaseOrder, syncPurchaseOrderReceiptSummary } from '@/lib/inventory/purchases'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.inventoryManage)
  if (auth.error) return auth.error
  const sessionUser: any = (auth.ctx as any)?.session?.user || null

  const body = await req.json().catch(() => ({}))
  const action = String(body?.action || '').trim().toLowerCase()

  const existing = await (db as any).inventoryPurchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
      supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
      request: { select: { id: true, request_code: true, status: true } },
      items: true,
    },
  })
  if (!existing) return NextResponse.json({ error: 'Không tìm thấy đơn mua' }, { status: 404 })

  if (action === 'confirm') {
    if (existing.status !== 'draft') return NextResponse.json({ error: 'Chỉ được xác nhận đơn mua còn nháp' }, { status: 400 })
    const updated = await (db as any).inventoryPurchaseOrder.update({
      where: { id: params.id },
      data: {
        status: 'confirmed',
        confirmed_by: sessionUser?.username || sessionUser?.id || null,
        confirmed_at: new Date(),
      },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
        request: { select: { id: true, request_code: true, status: true } },
        items: true,
      },
    })
    return NextResponse.json({ data: serializePurchaseOrder(updated) })
  }

  if (action === 'cancel') {
    if (existing.status === 'completed') return NextResponse.json({ error: 'Đơn mua đã hoàn tất, không thể hủy' }, { status: 400 })
    const updated = await (db as any).inventoryPurchaseOrder.update({
      where: { id: params.id },
      data: {
        status: 'cancelled',
        cancelled_by: sessionUser?.username || sessionUser?.id || null,
        cancelled_at: new Date(),
      },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
        request: { select: { id: true, request_code: true, status: true } },
        items: true,
      },
    })
    return NextResponse.json({ data: serializePurchaseOrder(updated) })
  }

  if (action === 'sync_receipts') {
    const synced = await syncPurchaseOrderReceiptSummary(existing.id)
    return NextResponse.json({ data: serializePurchaseOrder(synced) })
  }

  if (action === 'create_receipt_draft') {
    if (!['confirmed', 'partial_received'].includes(String(existing.status || ''))) {
      return NextResponse.json({ error: 'Chỉ tạo phiếu nhận hàng từ đơn mua đã xác nhận hoặc đang nhận dở' }, { status: 400 })
    }

    const overrideItems = Array.isArray(body?.items) ? body.items : []
    const overrideMap = new Map<string, number>()
    for (const raw of overrideItems) {
      const key = String(raw?.material_key || '').trim()
      const qty = Number(raw?.quantity || 0)
      if (!key || !Number.isFinite(qty) || qty <= 0) continue
      overrideMap.set(key, qty)
    }

    const receiptItems = (existing.items || [])
      .map((item: any) => {
        const orderedQty = Number(item.ordered_qty || 0)
        const receivedQty = Number(item.received_qty || 0)
        const draftReceiptQty = Number(item.draft_receipt_qty || 0)
        const remainingQty = Math.max(0, orderedQty - receivedQty - draftReceiptQty)
        const pickedQty = overrideMap.has(item.material_key)
          ? Math.min(remainingQty, Number(overrideMap.get(item.material_key) || 0))
          : remainingQty
        return {
          ...item,
          receipt_qty: pickedQty,
        }
      })
      .filter((item: any) => Number(item.receipt_qty || 0) > 0)

    if (!receiptItems.length) {
      return NextResponse.json({ error: 'Không còn số lượng để tạo phiếu nhận hàng nháp' }, { status: 400 })
    }

    const createdTxn = await db.$transaction(async (tx) => {
      const txn = await tx.inventoryTransaction.create({
        data: {
          txn_code: `GRN-${Date.now()}`,
          warehouse_id: existing.warehouse_id,
          txn_type: 'in',
          txn_date: body?.txn_date ? new Date(body.txn_date) : new Date(),
          supplier_id: existing.supplier_id,
          reference_type: 'purchase_order',
          reference_id: existing.id,
          status: 'draft',
          note: `Nhận hàng từ đơn mua ${existing.order_code}`,
          created_by: String(sessionUser?.id || ''),
        },
      })
      for (const item of receiptItems) {
        const unitPrice = Number(item.unit_price || 0)
        await tx.inventoryTransactionItem.create({
          data: {
            txn_id: txn.id,
            catalog_item_id: item.catalog_item_id || null,
            material_key: item.material_key,
            material_name: item.material_name || null,
            item_unit: item.item_unit || null,
            quantity: Number(item.receipt_qty || 0),
            unit_price: unitPrice > 0 ? BigInt(Math.round(unitPrice)) : null,
            line_total: unitPrice > 0 ? BigInt(Math.round(Number(item.receipt_qty || 0) * unitPrice)) : null,
            note: item.note || null,
          },
        })
      }
      return txn
    })

    const synced = await syncPurchaseOrderReceiptSummary(existing.id)
    return NextResponse.json({
      data: serializePurchaseOrder(synced),
      receipt_draft: {
        id: createdTxn.id,
        txn_code: createdTxn.txn_code,
      },
    })
  }

  return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 })
}
