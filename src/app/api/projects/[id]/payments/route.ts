import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { syncProjectPaymentPlanStatus } from '@/lib/projects/payment-plan-status'
import { createProjectTimelineEvent } from '@/lib/project-timeline'

function ser(x: any) {
  return { ...x, amount: x?.amount != null ? Number(x.amount) : null }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const rows = await db.projectPayment.findMany({
    where: { project_id: params.id },
    orderBy: [{ payment_date: 'desc' }, { created_at: 'desc' }],
  })
  return NextResponse.json({ data: rows.map(ser) })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const body = await req.json().catch(() => ({}))
  const amount = Number(body?.amount || 0)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'So tien thu khong hop le' }, { status: 400 })
  }

  const created = await db.$transaction(async (tx) => {
    const row = await tx.projectPayment.create({
      data: {
        project_id: params.id,
        payment_plan_id: body?.payment_plan_id ? String(body.payment_plan_id) : null,
        payment_date: body?.payment_date ? new Date(body.payment_date) : new Date(),
        amount: BigInt(Math.round(amount)),
        payment_method: body?.payment_method ? String(body.payment_method) : null,
        reference_no: body?.reference_no ? String(body.reference_no) : null,
        note: body?.note ? String(body.note) : null,
        created_by: String(session.user.id || '') || null,
      },
    })
    await syncProjectPaymentPlanStatus(params.id, tx)
    return row
  })

  await createProjectTimelineEvent({
    project_id: params.id,
    event_key: 'payment_created',
    title: 'Ghi nhan thu tien',
    description: `${Number(created.amount || 0).toLocaleString('vi-VN')}đ`,
    source_ref_type: 'project_payment',
    source_ref_id: created.id,
    actor_user_id: String(session.user.id || '') || null,
    metadata_json: { payment_plan_id: created.payment_plan_id || null, payment_method: created.payment_method || null },
  })

  return NextResponse.json({ data: ser(created) }, { status: 201 })
}
