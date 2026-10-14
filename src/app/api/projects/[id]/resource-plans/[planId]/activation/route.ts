import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { createProjectTimelineEvent } from '@/lib/project-timeline'

function normalizeKinds(items: Array<{ resource_kind?: string | null }>) {
  return Array.from(new Set((items || []).map((x) => String(x?.resource_kind || '')).filter(Boolean)))
}

export async function POST(req: NextRequest, { params }: { params: { id: string; planId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error || !auth.ctx) return auth.error
  const body = await req.json().catch(() => ({}))
  const action = String(body?.action || '').trim()
  const resourceKindRaw = body?.resource_kind != null ? String(body.resource_kind).trim() : ''
  const planRoleRaw = body?.plan_role != null ? String(body.plan_role).trim() : ''

  const plan = await db.projectResourcePlan.findUnique({
    where: { id: params.planId },
    include: {
      items: { select: { resource_kind: true } },
      milestone: { select: { id: true, milestone_name: true } },
    },
  })
  if (!plan || plan.project_id !== params.id) {
    return NextResponse.json({ error: 'Khong tim thay ke hoach' }, { status: 404 })
  }

  const kinds = normalizeKinds(plan.items || [])
  const inferredKind = kinds.length === 1 ? kinds[0] : ''
  const resourceKind = resourceKindRaw || inferredKind

  if (action === 'set_role') {
    const oldPlanRole = String((plan as any).plan_role || 'primary')
    if (!['primary', 'backup', 'supplement'].includes(planRoleRaw)) {
      return NextResponse.json({ error: 'Vai tro ke hoach khong hop le' }, { status: 400 })
    }
    const updated = await db.projectResourcePlan.update({
      where: { id: plan.id },
      data: { plan_role: planRoleRaw },
    })
    await createProjectTimelineEvent({
      project_id: params.id,
      event_key: 'resource_plan_role_updated',
      title: 'Cap nhat vai tro ke hoach',
      description: `${updated.plan_name}: ${oldPlanRole} -> ${planRoleRaw}`,
      source_ref_type: 'project_resource_plan',
      source_ref_id: updated.id,
      actor_user_id: auth.ctx.userId,
      milestone_id: updated.milestone_id || null,
      metadata_json: { old_plan_role: oldPlanRole, new_plan_role: planRoleRaw },
    })
    return NextResponse.json({ data: updated })
  }

  if (action === 'activate') {
    if (!['material', 'labor'].includes(resourceKind)) {
      return NextResponse.json({ error: 'Can xac dinh loai ke hoach vat tu hoac nhan cong' }, { status: 400 })
    }
    if (!kinds.includes(resourceKind)) {
      return NextResponse.json({ error: 'Ke hoach nay khong co noi dung phu hop voi loai dang kich hoat' }, { status: 400 })
    }
    if (!['approved', 'locked'].includes(String(plan.status || ''))) {
      return NextResponse.json({ error: 'Chi kich hoat ke hoach da duyet/da khoa hoac da co phat sinh thuc te' }, { status: 400 })
    }
    const project = await db.constructionProject.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        active_material_plan_id: true,
        active_labor_plan_id: true,
      },
    })
    const previousActivePlanId = resourceKind === 'material'
      ? String(project?.active_material_plan_id || '')
      : String(project?.active_labor_plan_id || '')
    const previousActivePlan = previousActivePlanId
      ? await db.projectResourcePlan.findUnique({
          where: { id: previousActivePlanId },
          select: { id: true, plan_name: true, plan_role: true },
        })
      : null
    const projectUpdateData = resourceKind === 'material'
      ? { active_material_plan_id: plan.id }
      : { active_labor_plan_id: plan.id }
    await db.constructionProject.update({
      where: { id: params.id },
      data: projectUpdateData as any,
    })
    await createProjectTimelineEvent({
      project_id: params.id,
      event_key: resourceKind === 'material' ? 'active_material_plan_changed' : 'active_labor_plan_changed',
      title: resourceKind === 'material' ? 'Dat ke hoach vat tu dang van hanh' : 'Dat ke hoach nhan cong dang van hanh',
      description: previousActivePlan?.id
        ? `${previousActivePlan.plan_name} -> ${plan.plan_name}`
        : plan.plan_name,
      source_ref_type: 'project_resource_plan',
      source_ref_id: plan.id,
      actor_user_id: auth.ctx.userId,
      milestone_id: plan.milestone_id || null,
      metadata_json: {
        resource_kind: resourceKind,
        plan_role: (plan as any).plan_role || 'primary',
        previous_active_plan_id: previousActivePlan?.id || null,
        previous_active_plan_name: previousActivePlan?.plan_name || null,
      },
    })
    return NextResponse.json({
      ok: true,
      data: {
        plan_id: plan.id,
        resource_kind: resourceKind,
      },
    })
  }

  return NextResponse.json({ error: 'Action khong hop le' }, { status: 400 })
}
