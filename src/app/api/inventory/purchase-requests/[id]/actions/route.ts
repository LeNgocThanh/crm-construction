import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { serializePurchaseRequest } from '@/lib/inventory/purchases'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.inventoryManage)
  if (auth.error) return auth.error
  const sessionUser: any = (auth.ctx as any)?.session?.user || null

  const body = await req.json().catch(() => ({}))
  const action = String(body?.action || '').trim().toLowerCase()
  const existing = await (db as any).inventoryPurchaseRequest.findUnique({
    where: { id: params.id },
    include: {
      warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
      supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
      items: true,
      purchase_orders: { select: { id: true, order_code: true, status: true } },
    },
  })
  if (!existing) return NextResponse.json({ error: 'Không tìm thấy đề nghị mua' }, { status: 404 })

  if (action === 'submit') {
    if (existing.status !== 'draft') return NextResponse.json({ error: 'Chỉ được trình duyệt từ trạng thái nháp' }, { status: 400 })
    const updated = await (db as any).inventoryPurchaseRequest.update({
      where: { id: params.id },
      data: { status: 'submitted' },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
        items: true,
        purchase_orders: { select: { id: true, order_code: true, status: true } },
      },
    })
    return NextResponse.json({ data: serializePurchaseRequest(updated) })
  }

  if (action === 'approve') {
    if (!['submitted', 'draft'].includes(String(existing.status || ''))) return NextResponse.json({ error: 'Chỉ được duyệt đề nghị đang chờ hoặc còn nháp' }, { status: 400 })
    const updated = await (db as any).inventoryPurchaseRequest.update({
      where: { id: params.id },
      data: {
        status: 'approved',
        approved_by: sessionUser?.username || sessionUser?.id || null,
        approved_at: new Date(),
      },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
        items: true,
        purchase_orders: { select: { id: true, order_code: true, status: true } },
      },
    })
    return NextResponse.json({ data: serializePurchaseRequest(updated) })
  }

  if (action === 'reject') {
    if (!['submitted', 'approved'].includes(String(existing.status || ''))) return NextResponse.json({ error: 'Chỉ được từ chối đề nghị đã trình hoặc đã duyệt' }, { status: 400 })
    const updated = await (db as any).inventoryPurchaseRequest.update({
      where: { id: params.id },
      data: {
        status: 'rejected',
        rejected_by: sessionUser?.username || sessionUser?.id || null,
        rejected_at: new Date(),
      },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
        items: true,
        purchase_orders: { select: { id: true, order_code: true, status: true } },
      },
    })
    return NextResponse.json({ data: serializePurchaseRequest(updated) })
  }

  if (action === 'cancel') {
    if (existing.status === 'ordered') return NextResponse.json({ error: 'Đề nghị đã chuyển thành đơn mua, không thể hủy trực tiếp' }, { status: 400 })
    if (existing.status === 'cancelled') return NextResponse.json({ error: 'Đề nghị này đã hủy' }, { status: 400 })
    const updated = await (db as any).inventoryPurchaseRequest.update({
      where: { id: params.id },
      data: {
        status: 'cancelled',
        cancelled_by: sessionUser?.username || sessionUser?.id || null,
        cancelled_at: new Date(),
      },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
        items: true,
        purchase_orders: { select: { id: true, order_code: true, status: true } },
      },
    })
    return NextResponse.json({ data: serializePurchaseRequest(updated) })
  }

  return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 })
}
