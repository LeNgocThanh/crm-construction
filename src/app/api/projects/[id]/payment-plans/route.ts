import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { createProjectTimelineEvent } from '@/lib/project-timeline'

function ser(x: any) {
  return { ...x, amount: x?.amount != null ? Number(x.amount) : null }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const rows = await db.projectPaymentPlan.findMany({
    where: { project_id: params.id, is_active: true },
    orderBy: [{ sort_order: 'asc' }, { due_date: 'asc' }, { created_at: 'asc' }],
  })
  return NextResponse.json({ data: rows.map(ser) })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const body = await req.json().catch(() => ({}))
  const milestoneName = String(body?.milestone_name || '').trim()
  if (!milestoneName) return NextResponse.json({ error: 'Thieu milestone_name' }, { status: 400 })
  const created = await db.projectPaymentPlan.create({
    data: {
      project_id: params.id,
      milestone_name: milestoneName,
      due_date: body?.due_date ? new Date(body.due_date) : null,
      amount: body?.amount != null ? BigInt(Math.round(Number(body.amount) || 0)) : null,
      plan_percent: body?.plan_percent != null ? Number(body.plan_percent) : null,
      status: body?.status ? String(body.status) : 'planned',
      note: body?.note ? String(body.note) : null,
      sort_order: Number(body?.sort_order || 0),
      created_by: String(session.user.id || '') || null,
    },
  })
  await createProjectTimelineEvent({
    project_id: params.id,
    event_key: 'payment_plan_created',
    title: 'Tao ke hoach thanh toan',
    description: `${created.milestone_name}`,
    source_ref_type: 'project_payment_plan',
    source_ref_id: created.id,
    actor_user_id: String(session.user.id || '') || null,
    metadata_json: { amount: created.amount != null ? Number(created.amount) : null, due_date: created.due_date, status: created.status },
  })
  return NextResponse.json({ data: ser(created) }, { status: 201 })
}
