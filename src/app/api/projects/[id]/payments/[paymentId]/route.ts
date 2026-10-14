import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { syncProjectPaymentPlanStatus } from '@/lib/projects/payment-plan-status'
import { createProjectTimelineEvent } from '@/lib/project-timeline'

function ser(x: any) {
  return { ...x, amount: x?.amount != null ? Number(x.amount) : null }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; paymentId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const existing = await db.projectPayment.findFirst({
    where: { id: params.paymentId, project_id: params.id },
  })
  if (!existing) return NextResponse.json({ error: 'Khong tim thay giao dich thu' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const patch: any = {}
  if (body?.payment_plan_id !== undefined) patch.payment_plan_id = body.payment_plan_id ? String(body.payment_plan_id) : null
  if (body?.payment_date !== undefined) patch.payment_date = body.payment_date ? new Date(body.payment_date) : existing.payment_date
  if (body?.amount !== undefined) {
    const amount = Number(body.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'So tien thu khong hop le' }, { status: 400 })
    }
    patch.amount = BigInt(Math.round(amount))
  }
  if (body?.payment_method !== undefined) patch.payment_method = body.payment_method ? String(body.payment_method) : null
  if (body?.reference_no !== undefined) patch.reference_no = body.reference_no ? String(body.reference_no) : null
  if (body?.note !== undefined) patch.note = body.note ? String(body.note) : null

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.projectPayment.update({
      where: { id: params.paymentId },
      data: patch,
    })
    await syncProjectPaymentPlanStatus(params.id, tx)
    return row
  })
  await createProjectTimelineEvent({
    project_id: params.id,
    event_key: 'payment_updated',
    title: 'Cap nhat giao dich thu',
    description: `${Number(updated.amount || 0).toLocaleString('vi-VN')}đ`,
    source_ref_type: 'project_payment',
    source_ref_id: updated.id,
    actor_user_id: String(session.user.id || '') || null,
    metadata_json: { payment_plan_id: updated.payment_plan_id || null, payment_method: updated.payment_method || null },
  })
  return NextResponse.json({ data: ser(updated) })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string; paymentId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsManage)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const existing = await db.projectPayment.findFirst({
    where: { id: params.paymentId, project_id: params.id },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: 'Khong tim thay giao dich thu' }, { status: 404 })

  await db.$transaction(async (tx) => {
    await tx.projectPayment.delete({ where: { id: params.paymentId } })
    await syncProjectPaymentPlanStatus(params.id, tx)
  })
  await createProjectTimelineEvent({
    project_id: params.id,
    event_key: 'payment_deleted',
    title: 'Xoa giao dich thu',
    description: `${params.paymentId}`,
    source_ref_type: 'project_payment',
    source_ref_id: params.paymentId,
    actor_user_id: String(session.user.id || '') || null,
  })
  return NextResponse.json({ ok: true })
}
