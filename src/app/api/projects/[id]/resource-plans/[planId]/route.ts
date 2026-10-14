import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { createProjectTimelineEvent } from '@/lib/project-timeline'
import { deriveProjectExecutionAxis, getProjectPlanDirectEditGuard } from '@/lib/projects/execution-axis'
import { getResourcePlanExecutionState } from '@/lib/projects/resource-plan-execution'

function isOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime()
}

async function ensureSubcontractor(id: string) {
  return (db as any).supplier.findFirst({
    where: {
      id,
      profile: { is: { supplier_type: 'contractor' } },
      is_active: true,
    },
    select: { id: true, supplier_name: true },
  })
}

async function getProjectExecutionAxisForWrite(projectId: string, planId: string) {
  const [project, milestones, plans, items] = await Promise.all([
    db.constructionProject.findUnique({
      where: { id: projectId },
      select: { id: true, status: true, stage: true, active_material_plan_id: true, active_labor_plan_id: true },
    }),
    db.projectMilestone.findMany({
      where: { project_id: projectId, is_active: true },
      orderBy: [{ sort_order: 'asc' }, { due_date: 'asc' }, { created_at: 'asc' }],
      select: { id: true, milestone_name: true, status_key: true, due_date: true, completed_at: true, sort_order: true },
    }),
    db.projectResourcePlan.findMany({
      where: { project_id: projectId, is_active: true },
      orderBy: [{ created_at: 'desc' }],
      select: {
        id: true,
        project_id: true,
        milestone_id: true,
        subcontractor_id: true,
        plan_name: true,
        plan_role: true,
        plan_stage: true,
        target_stage: true,
        revision_no: true,
        planned_start_date: true,
        planned_end_date: true,
        status: true,
        approved_by: true,
        approved_at: true,
        note: true,
        is_active: true,
        created_at: true,
      },
    }),
    db.projectResourcePlanItem.findMany({
      where: { project_id: projectId, is_active: true },
      select: { id: true, plan_id: true, resource_kind: true },
    }),
  ])
  const plansWithState = await Promise.all((plans || []).map(async (row: any) => {
    const [inventoryPostedCount, directPurchaseConfirmedCount] = await Promise.all([
      db.inventoryTransaction.count({
        where: {
          reference_id: row.id,
          reference_type: { in: ['project_resource_plan', 'project_resource_plan_return'] },
          status: 'posted',
        },
      }),
      (db as any).projectDirectPurchase.count({
        where: { project_id: projectId, plan_id: row.id, status: 'confirmed' },
      }),
    ])
    const laborAttendanceConfirmedCount = await db.projectLaborAttendance.count({
      where: {
        project_id: projectId,
        attendance_status: 'confirmed',
        engagement: { is: { plan_id: row.id } },
      },
    })
    return {
      ...row,
      execution_state: getResourcePlanExecutionState({
        status: row.status,
        inventory_posted_count: inventoryPostedCount,
        direct_purchase_confirmed_count: directPurchaseConfirmedCount,
        labor_attendance_confirmed_count: laborAttendanceConfirmedCount,
        labor_payment_count: 0,
      }),
    }
  }))
  const axis = deriveProjectExecutionAxis({
    projectStatus: project?.status,
    projectStage: project?.stage,
    explicitActiveMaterialPlanId: (project as any)?.active_material_plan_id,
    explicitActiveLaborPlanId: (project as any)?.active_labor_plan_id,
    milestones,
    resourcePlans: plansWithState,
    resourceItems: items,
  })
  const selectedPlan = plansWithState
    .map((row: any) => ({
      ...row,
      plan_kinds: axis.plan_kinds_by_id?.[String(row?.id || '')] || [],
    }))
    .find((x: any) => String(x?.id || '') === String(planId || ''))
  return { axis, selectedPlan }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; planId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const body = await req.json().catch(() => ({}))
  const existing = await db.projectResourcePlan.findUnique({
    where: { id: params.planId },
    select: {
      id: true,
      project_id: true,
      status: true,
      planned_start_date: true,
      planned_end_date: true,
    },
  })
  if (!existing || existing.project_id !== params.id) {
    return NextResponse.json({ error: 'Khong tim thay ke hoach' }, { status: 404 })
  }

  const milestoneIdPatch = body?.milestone_id !== undefined
    ? (body?.milestone_id ? String(body.milestone_id).trim() : null)
    : undefined
  if (milestoneIdPatch) {
    const m = await db.projectMilestone.findFirst({
      where: { id: milestoneIdPatch, project_id: params.id, is_active: true },
      select: { id: true },
    })
    if (!m) return NextResponse.json({ error: 'Tien do khong hop le cho du an nay' }, { status: 400 })
  }
  const subcontractorIdPatch = body?.subcontractor_id !== undefined
    ? (body?.subcontractor_id ? String(body.subcontractor_id).trim() : null)
    : undefined
  if (subcontractorIdPatch) {
    const subcontractor = await ensureSubcontractor(subcontractorIdPatch)
    if (!subcontractor) return NextResponse.json({ error: 'Thầu phụ không hợp lệ' }, { status: 400 })
  }
  const nextStart = body?.planned_start_date !== undefined ? (body.planned_start_date ? new Date(body.planned_start_date) : null) : (existing.planned_start_date || null)
  const nextEnd = body?.planned_end_date !== undefined ? (body.planned_end_date ? new Date(body.planned_end_date) : null) : (existing.planned_end_date || null)
  const nextStatus = body?.status != null ? String(body.status) : String(existing.status || 'draft')
  const changingManagedFields = [
    'milestone_id',
    'subcontractor_id',
    'plan_name',
    'plan_stage',
    'target_stage',
    'revision_no',
    'planned_start_date',
    'planned_end_date',
    'status',
    'approved_by',
    'approved_at',
    'note',
    'is_active',
  ].some((key) => body?.[key] !== undefined)

  const { axis, selectedPlan } = await getProjectExecutionAxisForWrite(params.id, params.planId)
  const directEditGuard = getProjectPlanDirectEditGuard(selectedPlan, axis)
  if (!directEditGuard.can_edit && changingManagedFields) {
    return NextResponse.json({
      error: `Ke hoach nay khong duoc sua truc tiep. ${directEditGuard.reasons.join(' | ')}`,
    }, { status: 409 })
  }

  if ((nextStart && !nextEnd) || (!nextStart && nextEnd)) {
    return NextResponse.json({ error: 'Can nhap du ngay bat dau va ngay ket thuc' }, { status: 400 })
  }
  if (nextStart && nextEnd && nextStart.getTime() > nextEnd.getTime()) {
    return NextResponse.json({ error: 'Khoang thoi gian ke hoach khong hop le (tu ngay > den ngay)' }, { status: 400 })
  }
  if (['approved', 'locked'].includes(nextStatus)) {
    if (!nextStart || !nextEnd) {
      return NextResponse.json({ error: 'Ke hoach approved/locked bat buoc co thoi gian' }, { status: 400 })
    }
    const overlapPlans = await db.projectResourcePlan.findMany({
      where: {
        project_id: params.id,
        is_active: true,
        status: { in: ['approved', 'locked'] },
        id: { not: params.planId },
      },
      select: { id: true, plan_name: true, planned_start_date: true, planned_end_date: true },
    })
    for (const row of overlapPlans) {
      if (!row.planned_start_date || !row.planned_end_date) continue
      if (isOverlap(nextStart, nextEnd, row.planned_start_date, row.planned_end_date)) {
        return NextResponse.json({
          error: `Trung khoang thoi gian voi ke hoach da duyet/khoa: ${row.plan_name}`,
        }, { status: 409 })
      }
    }
  }

  const hasActualLinks = await db.inventoryTransaction.count({
    where: {
      reference_id: params.planId,
      reference_type: { in: ['project_resource_plan', 'project_resource_plan_return'] },
      status: { in: ['posted'] },
    },
  })
  const hasDirectPurchases = await (db as any).projectDirectPurchase.count({
    where: { project_id: params.id, plan_id: params.planId, status: 'confirmed' },
  })
  const hasLaborAttendances = 0
  const hasLaborPayments = 0
  const executionState = getResourcePlanExecutionState({
    status: nextStatus,
    inventory_posted_count: hasActualLinks,
    direct_purchase_confirmed_count: hasDirectPurchases,
    labor_attendance_confirmed_count: hasLaborAttendances,
    labor_payment_count: hasLaborPayments,
  })
  if (executionState === 'started' || executionState === 'locked') {
    const changingTime = body?.planned_start_date !== undefined || body?.planned_end_date !== undefined
    const changingMilestone = body?.milestone_id !== undefined
    const changingName = body?.plan_name !== undefined
    const changingStage = body?.plan_stage !== undefined
    const changingTargetStage = body?.target_stage !== undefined
    const changingStatus = body?.status !== undefined
    if (changingTime || changingMilestone) {
      return NextResponse.json({
        error: 'Ke hoach da co phat sinh thuc te, khong duoc doi moc thoi gian/tien do. Tao revision moi.',
      }, { status: 409 })
    }
    if (executionState === 'started' && (changingName || changingStage || changingTargetStage || changingStatus)) {
      return NextResponse.json({
        error: 'Ke hoach da bat dau thuc hien, khong duoc doi ten/giai doan/trang thai. Tao revision moi neu can dieu chinh lon.',
      }, { status: 409 })
    }
  }

  const updated = await db.projectResourcePlan.update({
    where: { id: params.planId },
    data: {
      milestone_id: milestoneIdPatch,
      subcontractor_id: subcontractorIdPatch,
      plan_name: body?.plan_name != null ? String(body.plan_name) : undefined,
      plan_role: body?.plan_role !== undefined ? String(body.plan_role || 'primary') : undefined,
      plan_stage: body?.plan_stage !== undefined ? (body.plan_stage ? String(body.plan_stage) : null) : undefined,
      target_stage: body?.target_stage !== undefined ? (body.target_stage ? String(body.target_stage) : null) : undefined,
      revision_no: body?.revision_no !== undefined ? (body.revision_no != null && body.revision_no !== '' ? Number(body.revision_no) : null) : undefined,
      planned_start_date: body?.planned_start_date !== undefined ? (body.planned_start_date ? new Date(body.planned_start_date) : null) : undefined,
      planned_end_date: body?.planned_end_date !== undefined ? (body.planned_end_date ? new Date(body.planned_end_date) : null) : undefined,
      status: body?.status != null ? String(body.status) : undefined,
      approved_by: body?.approved_by !== undefined ? (body.approved_by ? String(body.approved_by) : null) : undefined,
      approved_at: body?.approved_at !== undefined ? (body.approved_at ? new Date(body.approved_at) : null) : undefined,
      note: body?.note !== undefined ? (body.note ? String(body.note) : null) : undefined,
      is_active: body?.is_active != null ? Boolean(body.is_active) : undefined,
    },
  })
  await createProjectTimelineEvent({
    project_id: params.id,
    event_key: 'resource_plan_updated',
    title: 'Cap nhat ke hoach vat tu/nhan cong',
    description: updated.plan_name,
    source_ref_type: 'project_resource_plan',
    source_ref_id: updated.id,
    actor_user_id: String(session.user.id || '') || null,
    milestone_id: updated.milestone_id || null,
  })
  return NextResponse.json({ data: updated })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string; planId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const existed = await db.projectResourcePlan.findUnique({ where: { id: params.planId } })
  if (!existed) return NextResponse.json({ error: 'Khong tim thay ke hoach' }, { status: 404 })
  const hasActualLinks = await db.inventoryTransaction.count({
    where: {
      reference_id: params.planId,
      reference_type: { in: ['project_resource_plan', 'project_resource_plan_return'] },
      status: { in: ['posted'] },
    },
  })
  const hasDirectPurchases = await (db as any).projectDirectPurchase.count({
    where: { project_id: params.id, plan_id: params.planId, status: 'confirmed' },
  })
  const hasLaborAttendances = 0
  const hasLaborPayments = 0
  const executionState = getResourcePlanExecutionState({
    status: existed.status,
    inventory_posted_count: hasActualLinks,
    direct_purchase_confirmed_count: hasDirectPurchases,
    labor_attendance_confirmed_count: hasLaborAttendances,
    labor_payment_count: hasLaborPayments,
  })
  if (executionState !== 'not_started') {
    return NextResponse.json({
      error: 'Ke hoach da co phat sinh thuc te, khong the xoa. Vui long tao revision moi.',
    }, { status: 409 })
  }
  await db.projectResourcePlan.update({ where: { id: params.planId }, data: { is_active: false } })
  await createProjectTimelineEvent({
    project_id: params.id,
    event_key: 'resource_plan_deleted',
    title: 'Xoa ke hoach vat tu/nhan cong',
    description: existed.plan_name,
    source_ref_type: 'project_resource_plan',
    source_ref_id: existed.id,
    actor_user_id: String(session.user.id || '') || null,
  })
  return NextResponse.json({ ok: true })
}
