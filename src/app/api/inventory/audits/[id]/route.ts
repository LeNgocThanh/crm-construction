import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { serializeInventoryAudit, summarizeAuditItems, toNumberOrNull } from '@/lib/inventory/audits'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.inventoryRead)
  if (auth.error) return auth.error

  const row = await (db as any).inventoryStockAudit.findUnique({
    where: { id: params.id },
    include: {
      warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
      applied_txn: { select: { id: true, txn_code: true, status: true } },
      items: {
        include: {
          stock: { select: { id: true, on_hand_qty: true, reserved_qty: true, updated_at: true } },
        },
        orderBy: [{ material_name: 'asc' }, { material_key: 'asc' }],
      },
    },
  })
  if (!row) return NextResponse.json({ error: 'Không tìm thấy phiếu kiểm kê' }, { status: 404 })
  return NextResponse.json({ data: serializeInventoryAudit(row) })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.inventoryManage)
  if (auth.error) return auth.error

  const existing = await (db as any).inventoryStockAudit.findUnique({
    where: { id: params.id },
    include: { items: true },
  })
  if (!existing) return NextResponse.json({ error: 'Không tìm thấy phiếu kiểm kê' }, { status: 404 })
  if (String(existing.status || '') !== 'draft') {
    return NextResponse.json({ error: 'Chỉ được cập nhật phiếu kiểm kê ở trạng thái nháp' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const items = Array.isArray(body?.items) ? body.items : []

  const updated = await db.$transaction(async (tx) => {
    if (body?.note !== undefined) {
      await (tx as any).inventoryStockAudit.update({
        where: { id: params.id },
        data: { note: body.note ? String(body.note) : null },
      })
    }

    for (const raw of items) {
      const itemId = String(raw?.id || '').trim()
      if (!itemId) continue
      const countedQty = toNumberOrNull(raw?.counted_qty)
      const note = raw?.note !== undefined ? (raw.note ? String(raw.note) : null) : undefined

      const found = existing.items.find((x: any) => x.id === itemId)
      if (!found) continue
      const varianceQty = countedQty == null ? null : Number(countedQty) - Number(found.book_qty || 0)
      const avgUnitCost = Number(found.avg_unit_cost || 0)
      const varianceValue = varianceQty == null ? 0 : Math.round(varianceQty * avgUnitCost)

      await (tx as any).inventoryStockAuditItem.update({
        where: { id: itemId },
        data: {
          counted_qty: countedQty,
          variance_qty: varianceQty,
          variance_value: BigInt(varianceValue),
          ...(note !== undefined ? { note } : {}),
        },
      })
    }

    const nextItems = await (tx as any).inventoryStockAuditItem.findMany({
      where: { audit_id: params.id },
      orderBy: [{ material_name: 'asc' }, { material_key: 'asc' }],
    })
    const summary = summarizeAuditItems(nextItems)
    await (tx as any).inventoryStockAudit.update({
      where: { id: params.id },
      data: {
        total_items: summary.total_items,
        counted_items: summary.counted_items,
        variance_items: summary.variance_items,
        total_variance_value: BigInt(summary.total_variance_value),
      },
    })

    return (tx as any).inventoryStockAudit.findUnique({
      where: { id: params.id },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        applied_txn: { select: { id: true, txn_code: true, status: true } },
        items: {
          include: { stock: { select: { id: true, on_hand_qty: true, reserved_qty: true, updated_at: true } } },
          orderBy: [{ material_name: 'asc' }, { material_key: 'asc' }],
        },
      },
    })
  })

  return NextResponse.json({ data: serializeInventoryAudit(updated) })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.inventoryManage)
  if (auth.error) return auth.error

  const existing = await (db as any).inventoryStockAudit.findUnique({
    where: { id: params.id },
  })
  if (!existing) return NextResponse.json({ error: 'Không tìm thấy phiếu kiểm kê' }, { status: 404 })
  if (String(existing.status || '') !== 'cancelled') {
    return NextResponse.json({ error: 'Chỉ được xóa phiếu kiểm kê đã hủy' }, { status: 400 })
  }
  if (existing.applied_txn_id) {
    return NextResponse.json({ error: 'Phiếu đã gắn phiếu điều chỉnh kho, không được xóa' }, { status: 400 })
  }

  await db.$transaction(async (tx) => {
    await (tx as any).inventoryStockAuditItem.deleteMany({ where: { audit_id: params.id } })
    await (tx as any).inventoryStockAudit.delete({ where: { id: params.id } })
  })

  return NextResponse.json({ ok: true })
}
