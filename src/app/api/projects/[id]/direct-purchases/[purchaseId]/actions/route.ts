import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { createProjectTimelineEvent } from '@/lib/project-timeline'

function serializePurchase(row: any) {
  if (!row) return row
  return {
    ...row,
    total_amount: row.total_amount != null ? Number(row.total_amount) : null,
    items: Array.isArray(row.items)
      ? row.items.map((it: any) => ({
          ...it,
          unit_price: it?.unit_price != null ? Number(it.unit_price) : null,
          line_total: it?.line_total != null ? Number(it.line_total) : null,
        }))
      : [],
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string; purchaseId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const projectId = String(params.id || '').trim()
  const purchaseId = String(params.purchaseId || '').trim()
  const body = await req.json().catch(() => ({}))
  const action = String(body?.action || '').trim().toLowerCase()
  if (!action) return NextResponse.json({ error: 'Thieu action' }, { status: 400 })

  const purchase = await (db as any).projectDirectPurchase.findFirst({
    where: { id: purchaseId, project_id: projectId },
    include: { items: true, project: { select: { customer_id: true } } },
  })
  if (!purchase) return NextResponse.json({ error: 'Khong tim thay phieu mua' }, { status: 404 })

  if (action === 'cancel') {
    if (purchase.status !== 'draft') return NextResponse.json({ error: 'Chi duoc huy phieu draft' }, { status: 400 })
    const updated = await (db as any).projectDirectPurchase.update({
      where: { id: purchaseId },
      data: { status: 'cancelled', note: [purchase.note, body?.note ? String(body.note) : ''].filter(Boolean).join(' | ') },
      include: { items: true },
    })
    await createProjectTimelineEvent({
      project_id: projectId,
      customer_id: purchase.project?.customer_id || null,
      event_key: 'project_direct_purchase_cancelled',
      title: 'Huy phieu mua truc tiep',
      description: `${purchase.purchase_code}`,
      source_ref_type: 'project_direct_purchase',
      source_ref_id: purchase.id,
      actor_user_id: String(session.user.id || '') || null,
    })
    return NextResponse.json({ data: serializePurchase(updated) })
  }

  if (action === 'confirm') {
    if (purchase.status !== 'draft') return NextResponse.json({ error: 'Chi duoc xac nhan phieu draft' }, { status: 400 })
    const updated = await db.$transaction(async (tx) => {
      const row = await (tx as any).projectDirectPurchase.update({
        where: { id: purchaseId },
        data: {
          status: 'confirmed',
          confirmed_at: new Date(),
          confirmed_by: String(session.user.id || '') || null,
          note: [purchase.note, body?.note ? String(body.note) : ''].filter(Boolean).join(' | '),
        },
        include: { items: true },
      })
      const existed = await (tx as any).projectMaterialLedger.count({
        where: { source_type: 'direct_purchase', source_id: row.id },
      })
      if (existed === 0) {
        for (const it of row.items || []) {
          if (Number(it.quantity || 0) <= 0) continue
          await (tx as any).projectMaterialLedger.create({
            data: {
              project_id: projectId,
              direction: 'in',
              source_type: 'direct_purchase',
              source_id: row.id,
              supplier_id: row.supplier_id || null,
              catalog_item_id: it.catalog_item_id || null,
              material_key: String(it.material_key || ''),
              material_name: it.material_name || null,
              item_unit: it.item_unit || null,
              quantity: Number(it.quantity || 0),
              unit_price: it.unit_price ?? null,
              line_total: it.line_total ?? null,
              note: row.purchase_code || null,
              happened_at: row.purchase_date || new Date(),
              created_by: String(session.user.id || '') || null,
            },
          })
        }
      }
      return row
    })
    await createProjectTimelineEvent({
      project_id: projectId,
      customer_id: purchase.project?.customer_id || null,
      event_key: 'project_direct_purchase_confirmed',
      title: 'Xac nhan phieu mua truc tiep',
      description: `${purchase.purchase_code}`,
      source_ref_type: 'project_direct_purchase',
      source_ref_id: purchase.id,
      actor_user_id: String(session.user.id || '') || null,
    })
    return NextResponse.json({ data: serializePurchase(updated) })
  }

  return NextResponse.json({ error: 'Action khong hop le' }, { status: 400 })
}
