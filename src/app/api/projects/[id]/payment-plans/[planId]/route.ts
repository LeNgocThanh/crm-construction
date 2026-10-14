import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { createProjectTimelineEvent } from '@/lib/project-timeline'

function ser(x: any) {
  return { ...x, amount: x?.amount != null ? Number(x.amount) : null }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; planId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const existing = await db.projectPaymentPlan.findFirst({
    where: { id: params.planId, project_id: params.id },
  })
  if (!existing) return NextResponse.json({ error: 'Khong tim thay payment plan' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const patch: any = {}
  if (body?.milestone_name !== undefined) patch.milestone_name = body.milestone_name ? String(body.milestone_name) : existing.milestone_name
  if (body?.due_date !== undefined) patch.due_date = body.due_date ? new Date(body.due_date) : null
  if (body?.amount !== undefined) patch.amount = body.amount != null ? BigInt(Math.round(Number(body.amount) || 0)) : null
  if (body?.plan_percent !== undefined) patch.plan_percent = body.plan_percent != null ? Number(body.plan_percent) : null
  if (body?.status !== undefined) patch.status = body.status ? String(body.status) : existing.status
  if (body?.note !== undefined) patch.note = body.note ? String(body.note) : null
  if (body?.sort_order !== undefined) patch.sort_order = Number(body.sort_order || 0)
  if (body?.is_active !== undefined) patch.is_active = Boolean(body.is_active)
  const updated = await db.projectPaymentPlan.update({
    where: { id: params.planId },
    data: patch,
  })
  await createProjectTimelineEvent({
    project_id: params.id,
    event_key: 'payment_plan_updated',
    title: 'Cap nhat ke hoach thanh toan',
    description: `${updated.milestone_name}`,
    source_ref_type: 'project_payment_plan',
    source_ref_id: updated.id,
    actor_user_id: String(session.user.id || '') || null,
    metadata_json: { status: updated.status, due_date: updated.due_date, amount: updated.amount != null ? Number(updated.amount) : null },
  })
  return NextResponse.json({ data: ser(updated) })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string; planId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsManage)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const existing = await db.projectPaymentPlan.findFirst({
    where: { id: params.planId, project_id: params.id },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: 'Khong tim thay payment plan' }, { status: 404 })
  await db.projectPaymentPlan.update({ where: { id: params.planId }, data: { is_active: false } })
  await createProjectTimelineEvent({
    project_id: params.id,
    event_key: 'payment_plan_deleted',
    title: 'Xoa ke hoach thanh toan',
    description: `${params.planId}`,
    source_ref_type: 'project_payment_plan',
    source_ref_id: params.planId,
    actor_user_id: String(session.user.id || '') || null,
  })
  return NextResponse.json({ ok: true })
}
