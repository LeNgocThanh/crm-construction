import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, requireManageRole, parseOptionalBigInt, parseOptionalFloat, parseOptionalString } from '@/lib/labor/server'

function serialize(row: any) {
  return {
    ...row,
    plan_id: row.plan_id || null,
    rate_amount: row.rate_amount != null ? String(row.rate_amount) : null,
    planned_total_amount: row.planned_total_amount != null ? String(row.planned_total_amount) : null,
  }
}

async function resolveLaborEditGuard(engagementId: string, requestedPlanId?: unknown) {
  const existing = await db.projectLaborEngagement.findUnique({
    where: { id: engagementId },
    select: { id: true, project_id: true, plan_id: true },
  })
  if (!existing) return { error: 'Khong tim thay phan cong', status: 404 as const }

  const project = await db.constructionProject.findUnique({
    where: { id: existing.project_id },
    select: { id: true, active_labor_plan_id: true },
  })
  if (!project) return { error: 'Khong tim thay du an', status: 404 as const }

  const activePlanId = String(project.active_labor_plan_id || '').trim()
  const currentPlanId = String(existing.plan_id || '').trim()
  const nextPlanId = requestedPlanId !== undefined ? String(requestedPlanId || '').trim() : currentPlanId

  if (activePlanId && currentPlanId && currentPlanId !== activePlanId) {
    return { error: 'Phan cong nay khong thuoc ke hoach nhan cong dang van hanh', status: 409 as const }
  }
  if (activePlanId && nextPlanId && nextPlanId !== activePlanId) {
    return { error: 'Chi duoc gan phan cong vao ke hoach nhan cong dang van hanh', status: 409 as const }
  }

  const planId = activePlanId || nextPlanId || ''
  if (!planId) return { existing, planId: null }

  const plan = await db.projectResourcePlan.findFirst({
    where: { id: planId, project_id: existing.project_id, is_active: true },
    select: { id: true, status: true, items: { where: { is_active: true }, select: { resource_kind: true } } },
  })
  if (!plan) return { error: 'Khong tim thay ke hoach nhan cong', status: 404 as const }
  if (!['approved', 'locked'].includes(String(plan.status || ''))) {
    return { error: 'Ke hoach nhan cong phai o trang thai da duyet hoac da khoa', status: 409 as const }
  }
  if (!(plan.items || []).some((x) => String(x.resource_kind || '') === 'labor')) {
    return { error: 'Ke hoach nay khong co hang muc nhan cong', status: 409 as const }
  }
  return { existing, planId: plan.id }
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr

  const body = await req.json()
  const guard = await resolveLaborEditGuard(ctx.params.id, body?.plan_id)
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const data = await db.projectLaborEngagement.update({
    where: { id: ctx.params.id },
    data: {
      plan_id: body?.plan_id !== undefined || guard.planId ? guard.planId : undefined,
      worker_id: body?.worker_id !== undefined ? parseOptionalString(body.worker_id) : undefined,
      crew_id: body?.crew_id !== undefined ? parseOptionalString(body.crew_id) : undefined,
      trade_id: body?.trade_id !== undefined ? parseOptionalString(body.trade_id) : undefined,
      engagement_type: body?.engagement_type !== undefined ? parseOptionalString(body.engagement_type) || 'daily' : undefined,
      unit_text: body?.unit_text !== undefined ? parseOptionalString(body.unit_text) : undefined,
      rate_amount: body?.rate_amount !== undefined ? parseOptionalBigInt(body.rate_amount) : undefined,
      planned_qty: body?.planned_qty !== undefined ? parseOptionalFloat(body.planned_qty) : undefined,
      planned_total_amount: body?.planned_total_amount !== undefined ? parseOptionalBigInt(body.planned_total_amount) : undefined,
      start_date: body?.start_date !== undefined ? (body.start_date ? new Date(body.start_date) : null) : undefined,
      end_date: body?.end_date !== undefined ? (body.end_date ? new Date(body.end_date) : null) : undefined,
      status: body?.status !== undefined ? parseOptionalString(body.status) || 'planned' : undefined,
      note: body?.note !== undefined ? parseOptionalString(body.note) : undefined,
      is_active: body?.is_active !== undefined ? Boolean(body.is_active) : undefined,
    },
    include: {
      project: { select: { id: true, project_name: true, status: true } },
      plan: { select: { id: true, plan_name: true, status: true, plan_role: true } },
      worker: { select: { id: true, worker_code: true, full_name: true } },
      crew: { select: { id: true, crew_key: true, crew_name: true } },
      trade: { select: { id: true, trade_key: true, trade_name: true } },
      creator: { select: { id: true, username: true } },
    },
  })
  return NextResponse.json({ data: serialize(data) })
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr
  const guard = await resolveLaborEditGuard(ctx.params.id)
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })
  await db.projectLaborEngagement.delete({ where: { id: ctx.params.id } })
  return NextResponse.json({ data: { ok: true } })
}
