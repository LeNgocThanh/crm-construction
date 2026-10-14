import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { postInventoryTransaction } from '@/lib/inventory/engine'
import { syncPurchaseOrderReceiptSummary } from '@/lib/inventory/purchases'
import { syncResourcePlanActualsFromInventory } from '@/lib/projects/resource-plan-actuals'
import { createProjectTimelineEvent } from '@/lib/project-timeline'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requirePermission(PERMISSIONS.inventoryManage)
  if (access.error) return access.error
  const session: any = access.ctx!.session

  const body = await req.json().catch(() => ({}))
  const action = String(body?.action || '').trim().toLowerCase()
  if (!action) return NextResponse.json({ error: 'Thieu action' }, { status: 400 })

  try {
    if (action === 'post') {
      const data = await postInventoryTransaction({
        txnId: params.id,
        actorUserId: String(session.user.id || ''),
        actorUsername: String(session.user.username || session.user.name || session.user.id || ''),
        allowNegative: Boolean(body?.allow_negative),
      })
      if ((data?.reference_type === 'project_resource_plan' || data?.reference_type === 'project_resource_plan_return') && data?.reference_id) {
        await syncResourcePlanActualsFromInventory(String(data.reference_id))
      }
      if (data?.reference_type === 'purchase_order' && data?.reference_id) {
        await syncPurchaseOrderReceiptSummary(String(data.reference_id))
      }
      if ((data?.reference_type === 'project_resource_plan' || data?.reference_type === 'project_resource_plan_return') && data?.reference_id) {
        const plan = await db.projectResourcePlan.findUnique({
          where: { id: String(data.reference_id) },
          select: { project_id: true, project: { select: { customer_id: true, project_name: true } } },
        })
        if (plan?.project_id) {
          await createProjectTimelineEvent({
            project_id: plan.project_id,
            customer_id: plan.project?.customer_id || null,
            event_key: data.reference_type === 'project_resource_plan_return' ? 'inventory_return_posted' : 'inventory_issue_posted',
            title: data.reference_type === 'project_resource_plan_return' ? 'Kho da ghi so phieu nhap lai' : 'Kho da ghi so phieu xuat',
            description: `${data.txn_code || data.id}`,
            source_ref_type: 'inventory_transaction',
            source_ref_id: data.id,
            actor_user_id: String(session.user.id || '') || null,
          })
        }
      }
      return NextResponse.json({ data: serTxn(data) })
    }

    if (action === 'accept' || action === 'adjust_requested' || action === 'reject') {
      const existing = await db.inventoryTransaction.findUnique({ where: { id: params.id } })
      if (!existing) return NextResponse.json({ error: 'Khong tim thay phieu kho' }, { status: 404 })
      if (existing.status !== 'draft') {
        return NextResponse.json({ error: 'Chi duoc xu ly phieu draft' }, { status: 400 })
      }
      const mapStatus: Record<string, string> = {
        accept: 'accepted',
        adjust_requested: 'adjust_requested',
        reject: 'rejected',
      }
      const noteTag = `[${action}_by:${String(session.user.username || session.user.name || session.user.id || '')} at ${new Date().toISOString()}]`
      const data = await db.inventoryTransaction.update({
        where: { id: params.id },
        data: {
          status: mapStatus[action],
          note: [existing.note, noteTag, body?.note ? String(body.note) : ''].filter(Boolean).join(' '),
        },
        include: { items: true },
      })
      if (data?.reference_type === 'purchase_order' && data?.reference_id) {
        await syncPurchaseOrderReceiptSummary(String(data.reference_id))
      }
      if ((data?.reference_type === 'project_resource_plan' || data?.reference_type === 'project_resource_plan_return') && data?.reference_id) {
        const plan = await db.projectResourcePlan.findUnique({
          where: { id: String(data.reference_id) },
          select: { project_id: true, project: { select: { customer_id: true } } },
        })
        if (plan?.project_id) {
          const titleMap: Record<string, string> = {
            accept: 'Kho chap nhan phieu nhap',
            adjust_requested: 'Kho yeu cau dieu chinh phieu nhap',
            reject: 'Kho tu choi phieu nhap',
          }
          const eventMap: Record<string, string> = {
            accept: 'inventory_issue_accepted',
            adjust_requested: 'inventory_issue_adjust_requested',
            reject: 'inventory_issue_rejected',
          }
          await createProjectTimelineEvent({
            project_id: plan.project_id,
            customer_id: plan.project?.customer_id || null,
            event_key: eventMap[action],
            title: titleMap[action],
            description: `${data.txn_code || data.id}`,
            source_ref_type: 'inventory_transaction',
            source_ref_id: data.id,
            actor_user_id: String(session.user.id || '') || null,
          })
        }
      }
      return NextResponse.json({ data: serTxn(data) })
    }

    if (action === 'cancel') {
      const existing = await db.inventoryTransaction.findUnique({ where: { id: params.id } })
      if (!existing) return NextResponse.json({ error: 'Khong tim thay phieu kho' }, { status: 404 })
      if (existing.status === 'posted') {
        return NextResponse.json({ error: 'Phieu da ghi so khong the huy truc tiep. Hay tao phieu dieu chinh/dao chieu.' }, { status: 400 })
      }
      const data = await db.inventoryTransaction.update({
        where: { id: params.id },
        data: {
          status: 'cancelled',
        note: [existing.note, `[cancelled_by:${String(session.user.username || session.user.name || session.user.id || '')} at ${new Date().toISOString()}]`]
            .filter(Boolean)
            .join(' '),
        },
        include: { items: true },
      })
      if ((data?.reference_type === 'project_resource_plan' || data?.reference_type === 'project_resource_plan_return') && data?.reference_id) {
        const plan = await db.projectResourcePlan.findUnique({
          where: { id: String(data.reference_id) },
          select: { project_id: true, project: { select: { customer_id: true } } },
        })
        if (plan?.project_id) {
          await createProjectTimelineEvent({
            project_id: plan.project_id,
            customer_id: plan.project?.customer_id || null,
            event_key: 'inventory_issue_cancelled',
            title: 'Kho da huy phieu nhap',
            description: `${data.txn_code || data.id}`,
            source_ref_type: 'inventory_transaction',
            source_ref_id: data.id,
            actor_user_id: String(session.user.id || '') || null,
          })
        }
      }
      return NextResponse.json({ data: serTxn(data) })
    }
  } catch (err: any) {
    const message = String(err?.message || 'Thao tac phieu kho that bai')
    console.error('[inventory/transactions/actions] error', { txnId: params.id, action, message })
    if (
      message.includes('Khong du ton kho') ||
      message.includes('Chi duoc ghi so phieu draft') ||
      message.includes('Phieu kho chua co dong vat tu') ||
      message.includes('Khong tim thay phieu kho') ||
      message.includes('khong hop le') ||
      message.includes('Loai phieu khong ho tro')
    ) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (
      message.includes('avg_unit_cost') ||
      message.includes('stock_value') ||
      message.includes('does not exist') ||
      message.includes('P2022')
    ) {
      return NextResponse.json(
        { error: 'DB chua cap nhat cot kho moi. Hay chay: npx prisma db push && npx prisma generate' },
        { status: 500 },
      )
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ error: 'Action khong hop le' }, { status: 400 })
}
