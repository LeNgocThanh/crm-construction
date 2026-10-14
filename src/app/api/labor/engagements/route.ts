import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, requireManageRole, parseOptionalBigInt, parseOptionalFloat, parseOptionalString, parseOptionalInt } from '@/lib/labor/server'

function serialize(row: any) {
  return {
    ...row,
    plan_id: row.plan_id || null,
    rate_amount: row.rate_amount != null ? String(row.rate_amount) : null,
    planned_total_amount: row.planned_total_amount != null ? String(row.planned_total_amount) : null,
  }
}

async function resolveLaborPlanId(projectId: string, rawPlanId: unknown) {
  const project = await db.constructionProject.findUnique({
    where: { id: projectId },
    select: { id: true, active_labor_plan_id: true },
  })
  if (!project) return { error: 'Khong tim thay du an', status: 404 as const }

  const activePlanId = String(project.active_labor_plan_id || '').trim()
  const requestedPlanId = String(rawPlanId || '').trim()
  const planId = activePlanId || requestedPlanId || ''

  if (activePlanId && requestedPlanId && requestedPlanId !== activePlanId) {
    return { error: 'Chi duoc tao phan cong theo ke hoach nhan cong dang van hanh', status: 409 as const }
  }

  if (!planId) {
    return { planId: null, activePlanId: null }
  }

  const plan = await db.projectResourcePlan.findFirst({
    where: { id: planId, project_id: projectId, is_active: true },
    select: { id: true, plan_name: true, status: true, items: { where: { is_active: true }, select: { resource_kind: true } } },
  })
  if (!plan) return { error: 'Khong tim thay ke hoach nhan cong', status: 404 as const }
  if (!['approved', 'locked'].includes(String(plan.status || ''))) {
    return { error: 'Ke hoach nhan cong phai o trang thai da duyet hoac da khoa', status: 409 as const }
  }
  if (!(plan.items || []).some((x) => String(x.resource_kind || '') === 'labor')) {
    return { error: 'Ke hoach nay khong co hang muc nhan cong', status: 409 as const }
  }
  return { planId: plan.id, activePlanId: activePlanId || null, plan }
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error

  const sp = new URL(req.url).searchParams
  const projectId = String(sp.get('project_id') || '').trim()
  const activeOnly = String(sp.get('active_only') || 'false') === 'true'
  const where: any = {}
  if (projectId) where.project_id = projectId
  if (activeOnly) where.is_active = true
  const data = await db.projectLaborEngagement.findMany({
    where,
    include: {
      project: { select: { id: true, project_name: true, status: true } },
      plan: { select: { id: true, plan_name: true, status: true, plan_role: true } },
      worker: { select: { id: true, worker_code: true, full_name: true } },
      crew: { select: { id: true, crew_key: true, crew_name: true } },
      trade: { select: { id: true, trade_key: true, trade_name: true } },
      creator: { select: { id: true, username: true } },
    },
    orderBy: [{ created_at: 'desc' }],
  })
  return NextResponse.json({ data: data.map(serialize) })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr

  const body = await req.json()
  const projectId = String(body?.project_id || '').trim()
  if (!projectId) return NextResponse.json({ error: 'Thieu project_id' }, { status: 400 })
  const planResolution = await resolveLaborPlanId(projectId, body?.plan_id)
  if ('error' in planResolution) {
    return NextResponse.json({ error: planResolution.error }, { status: planResolution.status })
  }
  const data = await db.projectLaborEngagement.create({
    data: {
      project_id: projectId,
      plan_id: planResolution.planId,
      worker_id: parseOptionalString(body?.worker_id),
      crew_id: parseOptionalString(body?.crew_id),
      trade_id: parseOptionalString(body?.trade_id),
      engagement_type: parseOptionalString(body?.engagement_type) || 'daily',
      unit_text: parseOptionalString(body?.unit_text),
      rate_amount: parseOptionalBigInt(body?.rate_amount),
      planned_qty: parseOptionalFloat(body?.planned_qty),
      planned_total_amount: parseOptionalBigInt(body?.planned_total_amount),
      start_date: body?.start_date ? new Date(body.start_date) : null,
      end_date: body?.end_date ? new Date(body.end_date) : null,
      status: parseOptionalString(body?.status) || 'planned',
      note: parseOptionalString(body?.note),
      created_by: auth.session.user.id,
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
  return NextResponse.json({ data: serialize(data) }, { status: 201 })
}
