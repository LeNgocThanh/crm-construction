import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createProjectTimelineEvent } from '@/lib/project-timeline'
import { getResourcePlanExecutionState } from '@/lib/projects/resource-plan-execution'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

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

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error
  const rows = await db.projectResourcePlan.findMany({
    where: { project_id: params.id, is_active: true },
    orderBy: [{ created_at: 'desc' }],
    include: {
      creator: { select: { id: true, username: true } },
      milestone: { select: { id: true, milestone_name: true, status_key: true } },
      subcontractor: { select: { id: true, supplier_name: true, supplier_code: true } },
      _count: { select: { items: true } },
    },
  })
  const rowsWithState = await Promise.all(rows.map(async (row: any) => {
    const [inventoryPostedCount, directPurchaseConfirmedCount] = await Promise.all([
      db.inventoryTransaction.count({
        where: {
          reference_id: row.id,
          reference_type: { in: ['project_resource_plan', 'project_resource_plan_return'] },
          status: 'posted',
        },
      }),
      (db as any).projectDirectPurchase.count({
        where: { project_id: params.id, plan_id: row.id, status: 'confirmed' },
      }),
    ])
    const laborAttendanceConfirmedCount = 0
    const laborPaymentCount = 0
    return {
      ...row,
      execution_state: getResourcePlanExecutionState({
        status: row.status,
        inventory_posted_count: inventoryPostedCount,
        direct_purchase_confirmed_count: directPurchaseConfirmedCount,
        labor_attendance_confirmed_count: laborAttendanceConfirmedCount,
        labor_payment_count: laborPaymentCount,
      }),
      execution_counters: {
        inventory_posted_count: inventoryPostedCount,
        direct_purchase_confirmed_count: directPurchaseConfirmedCount,
        labor_attendance_confirmed_count: laborAttendanceConfirmedCount,
        labor_payment_count: laborPaymentCount,
      },
    }
  }))
  return NextResponse.json({ data: rowsWithState })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error || !auth.ctx) return auth.error
  const body = await req.json().catch(() => ({}))
  const planName = String(body?.plan_name || '').trim()
  if (!planName) return NextResponse.json({ error: 'Thieu ten ke hoach' }, { status: 400 })
  const planStatus = body?.status ? String(body.status) : 'draft'
  const startDate = body?.planned_start_date ? new Date(body.planned_start_date) : null
  const endDate = body?.planned_end_date ? new Date(body.planned_end_date) : null
  if ((startDate && !endDate) || (!startDate && endDate)) {
    return NextResponse.json({ error: 'Can nhap du ngay bat dau va ngay ket thuc' }, { status: 400 })
  }
  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    return NextResponse.json({ error: 'Khoang thoi gian ke hoach khong hop le (tu ngay > den ngay)' }, { status: 400 })
  }
  const milestoneIdRaw = body?.milestone_id != null ? String(body.milestone_id).trim() : ''
  if (milestoneIdRaw) {
    const m = await db.projectMilestone.findFirst({
      where: { id: milestoneIdRaw, project_id: params.id, is_active: true },
      select: { id: true },
    })
    if (!m) return NextResponse.json({ error: 'Tien do khong hop le cho du an nay' }, { status: 400 })
  }
  if (['approved', 'locked'].includes(planStatus)) {
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Ke hoach approved/locked bat buoc co thoi gian' }, { status: 400 })
    }
    const existing = await db.projectResourcePlan.findMany({
      where: {
        project_id: params.id,
        is_active: true,
        status: { in: ['approved', 'locked'] },
      } as any,
      select: {
        id: true,
        plan_name: true,
        planned_start_date: true,
        planned_end_date: true,
      },
    })
    for (const row of existing) {
      if (!row.planned_start_date || !row.planned_end_date) continue
      if (isOverlap(startDate, endDate, row.planned_start_date, row.planned_end_date)) {
        return NextResponse.json({
          error: `Trung khoang thoi gian voi ke hoach da duyet/khoa: ${row.plan_name}`,
        }, { status: 409 })
      }
    }
  }
  const subcontractorIdRaw = body?.subcontractor_id != null ? String(body.subcontractor_id).trim() : ''
  if (subcontractorIdRaw) {
    const subcontractor = await ensureSubcontractor(subcontractorIdRaw)
    if (!subcontractor) return NextResponse.json({ error: 'Thầu phụ không hợp lệ' }, { status: 400 })
  }
  const created = await db.projectResourcePlan.create({
    data: {
      project_id: params.id,
      milestone_id: milestoneIdRaw || null,
      subcontractor_id: subcontractorIdRaw || null,
      plan_name: planName,
      plan_role: body?.plan_role ? String(body.plan_role) : 'primary',
      plan_stage: body?.plan_stage ? String(body.plan_stage) : null,
      target_stage: body?.target_stage ? String(body.target_stage) : null,
      revision_no: body?.revision_no != null && body?.revision_no !== '' ? Number(body.revision_no) : null,
      planned_start_date: startDate,
      planned_end_date: endDate,
      status: planStatus,
      approved_by: body?.approved_by ? String(body.approved_by) : null,
      approved_at: body?.approved_at ? new Date(body.approved_at) : null,
      note: body?.note ? String(body.note) : null,
      created_by: auth.ctx.userId,
    },
  })
  await createProjectTimelineEvent({
    project_id: params.id,
    event_key: 'resource_plan_created',
    title: 'Tao ke hoach vat tu/nhan cong',
    description: created.plan_name,
    source_ref_type: 'project_resource_plan',
    source_ref_id: created.id,
    actor_user_id: auth.ctx.userId,
    milestone_id: created.milestone_id || null,
    metadata_json: { plan_stage: created.plan_stage, status: created.status, subcontractor_id: created.subcontractor_id || null },
  })
  return NextResponse.json({ data: created }, { status: 201 })
}
