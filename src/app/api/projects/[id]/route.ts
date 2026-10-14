// src/app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isCustomerReadyForProjectConfirm, CUSTOMER_PROJECT_CONFIRM_READY_STATUSES } from '@/lib/customer-status'
import { createProjectTimelineEvent } from '@/lib/project-timeline'
import { evaluateProjectStatusTransition } from '@/lib/project-status-rules'
import { requireProjectAccess } from '@/lib/access-control'

const ser = (p: any) => ({
  ...p,
  estimated_budget: p?.estimated_budget ? Number(p.estimated_budget) : null,
  contract_value: p?.contract_value ? Number(p.contract_value) : null,
  budget_baseline: p?.budget_baseline ? Number(p.budget_baseline) : null,
  budget_current: p?.budget_current ? Number(p.budget_current) : null,
  budget_allocated: p?.budget_allocated ? Number(p.budget_allocated) : null,
  cost_committed: p?.cost_committed ? Number(p.cost_committed) : null,
  cost_actual: p?.cost_actual ? Number(p.cost_actual) : null,
  cash_on_hand: p?.cash_on_hand ? Number(p.cash_on_hand) : null,
  receivable_planned_30d: p?.receivable_planned_30d ? Number(p.receivable_planned_30d) : null,
  payable_planned_30d: p?.payable_planned_30d ? Number(p.payable_planned_30d) : null,
})

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireProjectAccess('write', params.id)
  if (auth.error || !auth.ctx) return auth.error

  const existing = await db.constructionProject.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Khong tim thay du an' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const patch: any = {}
  if (body?.project_name !== undefined) patch.project_name = body.project_name ? String(body.project_name) : null
  if (body?.address !== undefined) patch.address = body.address ? String(body.address) : null
  if (body?.house_type !== undefined) patch.house_type = body.house_type ? String(body.house_type) : null
  if (body?.floors !== undefined) patch.floors = body.floors != null && String(body.floors) !== '' ? Number(body.floors) : null
  if (body?.floor_area !== undefined) patch.floor_area = body.floor_area != null && String(body.floor_area) !== '' ? Number(body.floor_area) : null
  if (body?.estimated_budget !== undefined) {
    patch.estimated_budget = body.estimated_budget != null && String(body.estimated_budget) !== ''
      ? BigInt(Math.round(Number(body.estimated_budget) || 0))
      : null
  }
  if (body?.contract_value !== undefined) {
    patch.contract_value = body.contract_value != null && String(body.contract_value) !== ''
      ? BigInt(Math.round(Number(body.contract_value) || 0))
      : null
  }
  if (body?.budget_baseline !== undefined) {
    patch.budget_baseline = body.budget_baseline != null && String(body.budget_baseline) !== ''
      ? BigInt(Math.round(Number(body.budget_baseline) || 0))
      : null
  }
  if (body?.budget_current !== undefined) {
    patch.budget_current = body.budget_current != null && String(body.budget_current) !== ''
      ? BigInt(Math.round(Number(body.budget_current) || 0))
      : null
  }
  if (body?.budget_allocated !== undefined) {
    patch.budget_allocated = body.budget_allocated != null && String(body.budget_allocated) !== ''
      ? BigInt(Math.round(Number(body.budget_allocated) || 0))
      : null
  }
  if (body?.cost_committed !== undefined) {
    patch.cost_committed = body.cost_committed != null && String(body.cost_committed) !== ''
      ? BigInt(Math.round(Number(body.cost_committed) || 0))
      : null
  }
  if (body?.cost_actual !== undefined) {
    patch.cost_actual = body.cost_actual != null && String(body.cost_actual) !== ''
      ? BigInt(Math.round(Number(body.cost_actual) || 0))
      : null
  }
  if (body?.cash_on_hand !== undefined) {
    patch.cash_on_hand = body.cash_on_hand != null && String(body.cash_on_hand) !== ''
      ? BigInt(Math.round(Number(body.cash_on_hand) || 0))
      : null
  }
  if (body?.receivable_planned_30d !== undefined) {
    patch.receivable_planned_30d = body.receivable_planned_30d != null && String(body.receivable_planned_30d) !== ''
      ? BigInt(Math.round(Number(body.receivable_planned_30d) || 0))
      : null
  }
  if (body?.payable_planned_30d !== undefined) {
    patch.payable_planned_30d = body.payable_planned_30d != null && String(body.payable_planned_30d) !== ''
      ? BigInt(Math.round(Number(body.payable_planned_30d) || 0))
      : null
  }
  if (body?.progress_planned_percent !== undefined) {
    patch.progress_planned_percent = body.progress_planned_percent != null && String(body.progress_planned_percent) !== ''
      ? Number(body.progress_planned_percent)
      : null
  }
  if (body?.progress_actual_percent !== undefined) {
    patch.progress_actual_percent = body.progress_actual_percent != null && String(body.progress_actual_percent) !== ''
      ? Number(body.progress_actual_percent)
      : null
  }
  if (body?.delay_days !== undefined) {
    patch.delay_days = body.delay_days != null && String(body.delay_days) !== ''
      ? Number(body.delay_days)
      : null
  }
  if (body?.risk_level !== undefined) patch.risk_level = body.risk_level ? String(body.risk_level) : null
  if (body?.notes !== undefined) patch.notes = body.notes ? String(body.notes) : null
  if (body?.stage !== undefined) patch.stage = body.stage ? String(body.stage) : null
  if (body?.start_date !== undefined) patch.start_date = body.start_date ? new Date(body.start_date) : null
  if (body?.expected_end_date !== undefined) patch.expected_end_date = body.expected_end_date ? new Date(body.expected_end_date) : null
  if (body?.actual_end_date !== undefined) patch.actual_end_date = body.actual_end_date ? new Date(body.actual_end_date) : null

  const transitionWarnings: string[] = []
  if (body?.status !== undefined) {
    const nextStatus = String(body.status || '').trim()
    const validStatuses = await (db as any).projectStatus.findMany({
      where: { is_active: true },
      select: { status_key: true },
    })
    const validStatusKeys = new Set(validStatuses.map((x: any) => String(x.status_key || '').trim()).filter(Boolean))
    if (!validStatusKeys.has(nextStatus)) {
      return NextResponse.json({ error: 'status khong hop le' }, { status: 400 })
    }
    if (nextStatus === 'confirmed' && existing.status !== 'confirmed') {
      const cust = await db.customer.findUnique({
        where: { id: existing.customer_id },
        select: { status: true },
      })
      if (!isCustomerReadyForProjectConfirm(cust?.status)) {
        return NextResponse.json({
          error: 'Khach hang chua du dieu kien xac nhan du an',
          customer_status: cust?.status || null,
          allowed_statuses: CUSTOMER_PROJECT_CONFIRM_READY_STATUSES,
        }, { status: 422 })
      }
      patch.confirmed_at = new Date()
      patch.confirmed_by = auth.ctx.userId
    }
    const transition = await evaluateProjectStatusTransition({
      projectId: existing.id,
      customerId: existing.customer_id,
      fromStatus: String(existing.status || ''),
      toStatus: nextStatus,
      startDate: patch.start_date !== undefined ? patch.start_date : existing.start_date,
      reason: body?.status_reason ? String(body.status_reason) : null,
    })
    transitionWarnings.push(...transition.warnings)
    if (transition.blockingErrors.length) {
      return NextResponse.json({ error: transition.blockingErrors[0], blocking_errors: transition.blockingErrors }, { status: 422 })
    }

    patch.status = nextStatus
  }

  const updated = await db.constructionProject.update({
    where: { id: params.id },
    data: patch,
    include: {
      customer: { select: { id: true, full_name: true, phone_number: true, status: true } },
      confirmer: { select: { id: true, username: true } },
    },
  })
  const changedFields = Object.keys(patch || {})
  await createProjectTimelineEvent({
    project_id: updated.id,
    customer_id: updated.customer_id,
    event_key: changedFields.includes('status') ? 'project_status_updated' : 'project_updated',
    title: changedFields.includes('status') ? 'Cap nhat trang thai du an' : 'Cap nhat thong tin du an',
    description: changedFields.includes('status')
      ? `status: ${existing.status} -> ${updated.status}`
      : `Cap nhat ${changedFields.length} truong`,
    source_ref_type: 'project',
    source_ref_id: updated.id,
    actor_user_id: auth.ctx.userId,
    metadata_json: { changed_fields: changedFields, status_warnings: transitionWarnings },
  })
  if (changedFields.includes('status') && updated.status === 'confirmed' && existing.status !== 'confirmed') {
    await db.customerTimeline.create({
      data: {
        customer_id: updated.customer_id,
        type: 'project_confirmed',
        title: 'Xac nhan du an',
        description: `${updated.project_name || updated.id} da duoc xac nhan`,
        happened_at: new Date(),
        created_by: auth.ctx.userId,
        metadata: { project_id: updated.id, from_status: existing.status, to_status: updated.status },
      },
    })
  }
  const hasCashflowFieldChange = changedFields.some((k) =>
    ['budget_current', 'budget_allocated', 'cost_committed', 'cost_actual', 'cash_on_hand', 'receivable_planned_30d', 'payable_planned_30d'].includes(k)
  )
  if (hasCashflowFieldChange) {
    const committedLeft = Math.max(0, Number(updated.cost_committed || 0) - Number(updated.cost_actual || 0))
    const demand30d = committedLeft + Math.max(0, Number(updated.payable_planned_30d || 0))
    const supply30d = Math.max(0, Number(updated.cash_on_hand || 0)) + Math.max(0, Number(updated.receivable_planned_30d || 0))
    const gap30d = supply30d - demand30d
    const warningLevel = gap30d < 0 ? 'critical' : (demand30d > 0 && gap30d < demand30d * 0.1 ? 'high' : 'low')
    await (db as any).projectCashflowSnapshot.create({
      data: {
        project_id: updated.id,
        snapshot_date: new Date(),
        budget_current: updated.budget_current ?? null,
        budget_allocated: (updated as any).budget_allocated ?? null,
        cost_committed: updated.cost_committed ?? null,
        cost_actual: updated.cost_actual ?? null,
        cash_on_hand: (updated as any).cash_on_hand ?? null,
        receivable_planned_30d: (updated as any).receivable_planned_30d ?? null,
        payable_planned_30d: (updated as any).payable_planned_30d ?? null,
        demand_30d: BigInt(Math.max(0, Math.round(demand30d))),
        supply_30d: BigInt(Math.max(0, Math.round(supply30d))),
        gap_30d: BigInt(Math.round(gap30d)),
        warning_level: warningLevel,
        created_by: auth.ctx.userId,
      },
    })
  }
  return NextResponse.json({ data: ser(updated), warnings: transitionWarnings, warning_mode: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireProjectAccess('delete', params.id)
  if (auth.error || !auth.ctx) return auth.error

  const project = await db.constructionProject.findUnique({ where: { id: params.id } })
  if (!project) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })

  await createProjectTimelineEvent({
    project_id: project.id,
    customer_id: project.customer_id,
    event_key: 'project_deleted',
    title: 'Xoa du an',
    description: `${project.project_name || project.id}`,
    source_ref_type: 'project',
    source_ref_id: project.id,
    actor_user_id: auth.ctx.userId,
  })
  await db.constructionProject.delete({ where: { id: params.id } })
  return NextResponse.json({ message: 'Đã xóa dự án' })
}
