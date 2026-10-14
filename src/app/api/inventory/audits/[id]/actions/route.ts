import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { inventoryAuditAdjustTxnCode, serializeInventoryAudit, summarizeAuditItems } from '@/lib/inventory/audits'
import { postInventoryTransaction } from '@/lib/inventory/engine'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.inventoryManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const action = String(body?.action || '').trim().toLowerCase()
  if (!action) return NextResponse.json({ error: 'Thiếu action' }, { status: 400 })

  const existing = await (db as any).inventoryStockAudit.findUnique({
    where: { id: params.id },
    include: {
      warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
      items: true,
    },
  })
  if (!existing) return NextResponse.json({ error: 'Không tìm thấy phiếu kiểm kê' }, { status: 404 })

  if (action === 'counted') {
    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Chỉ được chốt kiểm kê từ trạng thái nháp' }, { status: 400 })
    }
    const summary = summarizeAuditItems(existing.items || [])
    if (summary.counted_items <= 0) {
      return NextResponse.json({ error: 'Phiếu kiểm kê chưa có số đếm thực tế nào' }, { status: 400 })
    }
    const updated = await (db as any).inventoryStockAudit.update({
      where: { id: params.id },
      data: {
        status: 'counted',
        counted_by: auth.ctx?.session?.user?.username || auth.ctx?.session?.user?.id || null,
        counted_at: new Date(),
        total_items: summary.total_items,
        counted_items: summary.counted_items,
        variance_items: summary.variance_items,
        total_variance_value: BigInt(summary.total_variance_value),
      },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        applied_txn: { select: { id: true, txn_code: true, status: true } },
        items: true,
      },
    })
    return NextResponse.json({ data: serializeInventoryAudit(updated) })
  }

  if (action === 'reopen') {
    if (existing.status !== 'counted') {
      return NextResponse.json({ error: 'Chỉ được mở lại phiếu đã chốt kiểm kê' }, { status: 400 })
    }
    const updated = await (db as any).inventoryStockAudit.update({
      where: { id: params.id },
      data: {
        status: 'draft',
        counted_by: null,
        counted_at: null,
      },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        applied_txn: { select: { id: true, txn_code: true, status: true } },
        items: true,
      },
    })
    return NextResponse.json({ data: serializeInventoryAudit(updated) })
  }

  if (action === 'cancel') {
    if (!['draft', 'counted'].includes(String(existing.status || ''))) {
      return NextResponse.json({ error: 'Chỉ được hủy phiếu nháp hoặc đã chốt' }, { status: 400 })
    }
    const updated = await (db as any).inventoryStockAudit.update({
      where: { id: params.id },
      data: {
        status: 'cancelled',
        cancelled_by: auth.ctx?.session?.user?.username || auth.ctx?.session?.user?.id || null,
        cancelled_at: new Date(),
      },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        applied_txn: { select: { id: true, txn_code: true, status: true } },
        items: true,
      },
    })
    return NextResponse.json({ data: serializeInventoryAudit(updated) })
  }

  if (action === 'apply') {
    if (existing.status !== 'counted') {
      return NextResponse.json({ error: 'Chỉ được áp chênh lệch từ phiếu đã chốt kiểm kê' }, { status: 400 })
    }
    const varianceItems = (existing.items || []).filter((item: any) => Math.abs(Number(item?.variance_qty || 0)) > 0.000001)

    let postedTxn: any = null
    if (varianceItems.length) {
      const createdTxn = await db.$transaction(async (tx) => {
        const txn = await tx.inventoryTransaction.create({
          data: {
            txn_code: inventoryAuditAdjustTxnCode(),
            warehouse_id: existing.warehouse_id,
            txn_type: 'adjust',
            txn_date: new Date(),
            reference_type: 'stock_audit',
            reference_id: existing.id,
            status: 'draft',
            note: `Điều chỉnh từ phiếu kiểm kê ${existing.audit_code}`,
            created_by: String(auth.ctx?.session?.user?.id || ''),
          },
        })

        for (const item of varianceItems) {
          const varianceQty = Number(item.variance_qty || 0)
          const avgUnitCost = Number(item.avg_unit_cost || 0)
          const lineTotal = Math.round(varianceQty * avgUnitCost)
          await tx.inventoryTransactionItem.create({
            data: {
              txn_id: txn.id,
              catalog_item_id: item.catalog_item_id || null,
              material_key: item.material_key,
              material_name: item.material_name || null,
              item_unit: item.item_unit || null,
              quantity: varianceQty,
              unit_price: avgUnitCost > 0 ? BigInt(avgUnitCost) : null,
              line_total: BigInt(lineTotal),
              note: item.note || null,
            },
          })
        }

        return txn
      })

      postedTxn = await postInventoryTransaction({
        txnId: createdTxn.id,
        actorUserId: String(auth.ctx?.session?.user?.id || ''),
        actorUsername: String(auth.ctx?.session?.user?.username || auth.ctx?.session?.user?.id || ''),
      })
    }

    const updated = await (db as any).inventoryStockAudit.update({
      where: { id: params.id },
      data: {
        status: 'applied',
        applied_by: auth.ctx?.session?.user?.username || auth.ctx?.session?.user?.id || null,
        applied_at: new Date(),
        applied_txn_id: postedTxn?.id || null,
      },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        applied_txn: { select: { id: true, txn_code: true, status: true } },
        items: true,
      },
    })
    return NextResponse.json({
      data: serializeInventoryAudit(updated),
      posted_transaction: postedTxn
        ? {
          id: postedTxn.id,
          txn_code: postedTxn.txn_code,
          status: postedTxn.status,
        }
        : null,
    })
  }

  return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 })
}
