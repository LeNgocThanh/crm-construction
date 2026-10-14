import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncPurchaseOrderReceiptSummary } from '@/lib/inventory/purchases'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

function toNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function serTxn(txn: any) {
  return {
    ...txn,
    items: Array.isArray(txn.items)
      ? txn.items.map((it: any) => ({
        ...it,
        unit_price: it.unit_price != null ? Number(it.unit_price) : null,
        line_total: it.line_total != null ? Number(it.line_total) : null,
      }))
      : [],
  }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.inventoryRead)
  if (auth.error) return auth.error
  const row = await db.inventoryTransaction.findUnique({
    where: { id: params.id },
    include: {
      warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
      supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
      items: true,
    },
  })
  if (!row) return NextResponse.json({ error: 'Khong tim thay phieu kho' }, { status: 404 })
  return NextResponse.json({ data: serTxn(row) })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requirePermission(PERMISSIONS.inventoryManage)
  if (access.error) return access.error

  const existing = await db.inventoryTransaction.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Khong tim thay phieu kho' }, { status: 404 })
  if (!['draft', 'adjust_requested'].includes(String(existing.status || ''))) {
    return NextResponse.json({ error: 'Chi duoc sua phieu nhap hoac dang yeu cau dieu chinh' }, { status: 400 })
  }
  const requiresUnitPrice = existing.txn_type === 'in' || existing.txn_type === 'transfer_in'
  const isAdjust = existing.txn_type === 'adjust'

  const body = await req.json()
  const patch: any = {}
  const nextTxnType = String(body?.txn_type || existing.txn_type || '')
  const rawIssuePurpose = body?.issue_purpose !== undefined
    ? (body?.issue_purpose ? String(body.issue_purpose).trim() : '')
    : String((existing as any).issue_purpose || '')
  if (body?.txn_date !== undefined) patch.txn_date = body.txn_date ? new Date(body.txn_date) : existing.txn_date
  if (body?.supplier_id !== undefined) patch.supplier_id = body.supplier_id ? String(body.supplier_id) : null
  if (body?.reference_type !== undefined) patch.reference_type = body.reference_type ? String(body.reference_type) : null
  if (body?.reference_id !== undefined) patch.reference_id = body.reference_id ? String(body.reference_id) : null
  if (body?.issue_purpose !== undefined || nextTxnType === 'out') {
    const nextReferenceType = body?.reference_type !== undefined
      ? (body.reference_type ? String(body.reference_type) : '')
      : String(existing.reference_type || '')
    const normalizedPurpose = nextTxnType === 'out'
      ? (rawIssuePurpose || (nextReferenceType === 'project_resource_plan' ? 'project_supply' : ''))
      : ''
    if (nextTxnType === 'out' && !normalizedPurpose) {
      return NextResponse.json({ error: 'Phieu xuat kho can chon muc dich xuat' }, { status: 400 })
    }
    patch.issue_purpose = normalizedPurpose || null
  }
  if (body?.note !== undefined) patch.note = body.note ? String(body.note) : null

  const updated = await db.$transaction(async (tx) => {
    await tx.inventoryTransaction.update({ where: { id: params.id }, data: patch })

    if (Array.isArray(body?.items)) {
      await tx.inventoryTransactionItem.deleteMany({ where: { txn_id: params.id } })
      for (const raw of body.items) {
        const materialKey = String(raw?.material_key || '').trim()
        const qty = toNum(raw?.quantity)
        if (!materialKey || qty == null) {
          throw new Error('Dong vat tu khong hop le (material_key/quantity)')
        }
        if (isAdjust ? qty === 0 : qty <= 0) {
          throw new Error(isAdjust
            ? 'Phieu dieu chinh yeu cau quantity khac 0 (am: giam, duong: tang)'
            : 'Dong vat tu khong hop le (material_key/quantity)')
        }
        const unitPrice = toNum(raw?.unit_price)
        if (requiresUnitPrice && (unitPrice == null || unitPrice <= 0)) {
          throw new Error(`Phieu ${existing.txn_type} bat buoc unit_price > 0 cho ${materialKey}`)
        }
        const lineTotal = unitPrice != null ? Math.round(unitPrice * qty) : null
        await tx.inventoryTransactionItem.create({
          data: {
            txn_id: params.id,
            catalog_item_id: raw?.catalog_item_id ? String(raw.catalog_item_id) : null,
            material_key: materialKey,
            material_name: raw?.material_name ? String(raw.material_name) : null,
            item_unit: raw?.item_unit ? String(raw.item_unit) : null,
            quantity: qty,
            unit_price: unitPrice != null ? BigInt(Math.round(unitPrice)) : null,
            line_total: lineTotal != null ? BigInt(lineTotal) : null,
            note: raw?.note ? String(raw.note) : null,
          },
        })
      }
    }

    return tx.inventoryTransaction.findUnique({
      where: { id: params.id },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
        items: true,
      },
    })
  })

  return NextResponse.json({ data: serTxn(updated) })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const access = await requirePermission(PERMISSIONS.inventoryManage)
  if (access.error) return access.error

  const existing = await db.inventoryTransaction.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Khong tim thay phieu kho' }, { status: 404 })
  if (existing.status !== 'cancelled') {
    return NextResponse.json({ error: 'Chi duoc xoa phieu da huy (cancelled)' }, { status: 400 })
  }
  const purchaseOrderId = existing.reference_type === 'purchase_order' && existing.reference_id
    ? String(existing.reference_id)
    : null

  await db.$transaction(async (tx) => {
    await tx.inventoryTransactionItem.deleteMany({ where: { txn_id: params.id } })
    await tx.inventoryTransaction.delete({ where: { id: params.id } })
  })
  if (purchaseOrderId) {
    await syncPurchaseOrderReceiptSummary(purchaseOrderId)
  }
  return NextResponse.json({ ok: true })
}
