// src/app/api/projects/route.ts — V2.5
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isCustomerReadyForProjectConfirm, CUSTOMER_PROJECT_CONFIRM_READY_STATUSES } from '@/lib/customer-status'
import { createProjectTimelineEvent } from '@/lib/project-timeline'
import { getProjectLaborFinanceSummaryMap } from '@/lib/labor/finance'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

function safeJson<T>(payload: T): T {
  return JSON.parse(
    JSON.stringify(payload, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))
  ) as T
}

const ser = (p: any) => ({
  ...p,
  estimated_budget: p.estimated_budget ? Number(p.estimated_budget) : null,
  contract_value:   p.contract_value   ? Number(p.contract_value)   : null,
  budget_baseline:  p.budget_baseline  ? Number(p.budget_baseline)  : null,
  budget_current:   p.budget_current   ? Number(p.budget_current)   : null,
  budget_allocated: p.budget_allocated ? Number(p.budget_allocated) : null,
  cost_committed:   p.cost_committed   ? Number(p.cost_committed)   : null,
  cost_actual:      p.cost_actual      ? Number(p.cost_actual)      : null,
  cash_on_hand: p.cash_on_hand ? Number(p.cash_on_hand) : null,
  receivable_planned_30d: p.receivable_planned_30d ? Number(p.receivable_planned_30d) : null,
  payable_planned_30d: p.payable_planned_30d ? Number(p.payable_planned_30d) : null,
  latest_cashflow_warning: Array.isArray(p.cashflow_snapshots) && p.cashflow_snapshots.length
    ? String(p.cashflow_snapshots[0]?.warning_level || '')
    : null,
  latest_cashflow_gap_30d: Array.isArray(p.cashflow_snapshots) && p.cashflow_snapshots.length
    ? Number(p.cashflow_snapshots[0]?.gap_30d || 0)
    : null,
  labor_finance_summary: p.labor_finance_summary || null,
  cashflow_snapshots: Array.isArray(p.cashflow_snapshots)
    ? p.cashflow_snapshots.map((x: any) => ({
        ...x,
        gap_30d: x?.gap_30d != null ? Number(x.gap_30d) : null,
      }))
    : [],
})

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error

  const sp        = new URL(req.url).searchParams
  const customerId = sp.get('customer_id')
  const status     = sp.get('status')
  const stage      = sp.get('stage')
  const houseType  = sp.get('house_type')
  const withStats  = sp.get('stats') === '1'
  const page       = parseInt(sp.get('page')  || '1')
  const limit      = parseInt(sp.get('limit') || '100')

  const where: any = {}
  if (customerId) where.customer_id = customerId
  if (status)     where.status      = status
  if (stage)      where.stage       = stage
  if (houseType)  where.house_type  = houseType

  const [data, total] = await Promise.all([
    db.constructionProject.findMany({
      where,
      orderBy: [{ status: 'asc' }, { updated_at: 'desc' }],
      skip:  (page-1) * limit,
      take:  limit,
      include: {
        customer:  { select: { id:true, phone_number:true, full_name:true, status:true } },
        confirmer: { select: { username:true } },
        cashflow_snapshots: {
          select: { warning_level: true, gap_30d: true, snapshot_date: true },
          orderBy: [{ snapshot_date: 'desc' }, { created_at: 'desc' }],
          take: 1,
        },
      },
    }),
    db.constructionProject.count({ where }),
  ])

  const laborFinanceMap = await getProjectLaborFinanceSummaryMap((data || []).map((x: any) => String(x.id || '')))
  const enriched = (data || []).map((project: any) => {
    const labor = laborFinanceMap.get(String(project.id || '')) || null
    const cashOnHand = Number(project?.cash_on_hand || 0)
    const payable = Number(labor?.payable_amount || 0)
    const laborCashGap = cashOnHand - payable
    let laborWarningState = 'enough'
    if (payable > 0 && laborCashGap < 0) {
      laborWarningState = 'missing'
    } else if (payable > 0 && laborCashGap <= payable * 0.15) {
      laborWarningState = 'tight'
    }
    return {
      ...project,
      labor_finance_summary: labor
        ? {
            ...labor,
            cash_gap_for_payable: Math.round(laborCashGap),
            warning_state: laborWarningState,
          }
        : {
            planned_cost: 0,
            planned_qty: 0,
            actual_cost: 0,
            actual_qty: 0,
            paid_amount: 0,
            payable_amount: 0,
            planned_gap_amount: 0,
            cash_gap_for_payable: Math.round(cashOnHand),
            warning_state: 'enough',
          },
    }
  })

  let stats = null
  if (withStats) {
    const [allProj, byStatus, byType, byMonth] = await Promise.all([
      db.constructionProject.aggregate({
        where: { status: { notIn: ['draft','cancelled'] } },
        _sum:  { contract_value:true, estimated_budget:true },
        _count: true,
      }),
      db.constructionProject.groupBy({
        by: ['status'],
        _count: true,
        _sum:   { contract_value:true },
      }),
      db.constructionProject.groupBy({
        by: ['house_type'],
        where: { status: { notIn: ['draft','cancelled'] } },
        _count: true,
        _sum:   { contract_value:true },
      }),
      // Revenue by confirmed month (last 12 months)
      db.constructionProject.findMany({
        where: { confirmed_at: { gte: new Date(Date.now() - 365*24*60*60*1000) }, status: { notIn:['draft','cancelled'] } },
        select: { confirmed_at:true, contract_value:true, estimated_budget:true },
        orderBy: { confirmed_at:'asc' },
      }),
    ])

    // Build monthly revenue
    const monthly: Record<string,number> = {}
    for (const p of byMonth) {
      if (!p.confirmed_at) continue
      const key = p.confirmed_at.toISOString().slice(0,7) // YYYY-MM
      monthly[key] = (monthly[key]||0) + Number(p.contract_value || p.estimated_budget || 0)
    }

    stats = {
      total_contract_value: allProj._sum.contract_value ? Number(allProj._sum.contract_value) : 0,
      total_estimated:      allProj._sum.estimated_budget ? Number(allProj._sum.estimated_budget) : 0,
      confirmed_count:      allProj._count,
      by_status:            byStatus.map(s => ({ status:s.status, count:s._count, value:Number(s._sum.contract_value||0) })),
      by_type:              byType.map(t => ({ type:t.house_type||'Khác', count:t._count, value:Number(t._sum.contract_value||0) })),
      monthly_revenue:      Object.entries(monthly).map(([month,value]) => ({ month, value })),
    }
  }

  return NextResponse.json(safeJson({ data: enriched.map(ser), total, page, limit, stats }))
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error || !auth.ctx) return auth.error

  const body = await req.json()
  const { customer_id, address, house_type, floors, floor_area, estimated_budget, contract_value, notes, status='draft', project_name, start_date, expected_end_date, budget_baseline, budget_current, budget_allocated, cost_committed, cost_actual, cash_on_hand, receivable_planned_30d, payable_planned_30d, progress_planned_percent, progress_actual_percent, delay_days, risk_level } = body
  if (!customer_id) return NextResponse.json({ error:'Thiếu customer_id' }, { status:400 })

  if (status === 'confirmed') {
    const cust = await db.customer.findUnique({ where:{ id:customer_id } })
    if (!isCustomerReadyForProjectConfirm(cust?.status))
      return NextResponse.json({
        error:'Khách hàng chưa đủ điều kiện xác nhận dự án',
        customer_status: cust?.status || null,
        allowed_statuses: CUSTOMER_PROJECT_CONFIRM_READY_STATUSES,
      }, { status:422 })
  }

  const parsedFloors = floors ? parseInt(floors) : null
  const parsedArea = floor_area ? parseFloat(floor_area) : null
  const parsedEstimated = estimated_budget ? BigInt(estimated_budget) : null
  const parsedContract = contract_value ? BigInt(contract_value) : null
  const parsedBudgetBaseline = budget_baseline ? BigInt(Math.round(Number(budget_baseline) || 0)) : null
  const parsedBudgetCurrent = budget_current ? BigInt(Math.round(Number(budget_current) || 0)) : null
  const parsedBudgetAllocated = budget_allocated ? BigInt(Math.round(Number(budget_allocated) || 0)) : null
  const parsedCostCommitted = cost_committed ? BigInt(Math.round(Number(cost_committed) || 0)) : null
  const parsedCostActual = cost_actual ? BigInt(Math.round(Number(cost_actual) || 0)) : null
  const parsedCashOnHand = cash_on_hand ? BigInt(Math.round(Number(cash_on_hand) || 0)) : null
  const parsedReceivable30d = receivable_planned_30d ? BigInt(Math.round(Number(receivable_planned_30d) || 0)) : null
  const parsedPayable30d = payable_planned_30d ? BigInt(Math.round(Number(payable_planned_30d) || 0)) : null

  const project = await db.$transaction(async (tx) => {
    const customerBase = await tx.customer.findUnique({
      where: { id: customer_id },
      select: { id: true, assigned_to: true },
    })
    const created = await tx.constructionProject.create({
      data: {
        customer_id,
        owner_id: customerBase?.assigned_to || null,
        default_owner_id: customerBase?.assigned_to || null,
        project_name:     project_name     || null,
        address:          address          || null,
        house_type:       house_type       || null,
        floors:           parsedFloors,
        floor_area:       parsedArea,
        estimated_budget: parsedEstimated,
        contract_value:   parsedContract,
        budget_baseline:  parsedBudgetBaseline,
        budget_current:   parsedBudgetCurrent,
        budget_allocated: parsedBudgetAllocated,
        cost_committed:   parsedCostCommitted,
        cost_actual:      parsedCostActual,
        cash_on_hand:     parsedCashOnHand,
        receivable_planned_30d: parsedReceivable30d,
        payable_planned_30d: parsedPayable30d,
        progress_planned_percent: progress_planned_percent != null && String(progress_planned_percent) !== '' ? Number(progress_planned_percent) : null,
        progress_actual_percent: progress_actual_percent != null && String(progress_actual_percent) !== '' ? Number(progress_actual_percent) : null,
        delay_days: delay_days != null && String(delay_days) !== '' ? Number(delay_days) : null,
        risk_level: risk_level ? String(risk_level) : null,
        notes:            notes            || null,
        status,
        source:           'manual',
        start_date:       start_date       ? new Date(start_date)       : null,
        expected_end_date:expected_end_date? new Date(expected_end_date): null,
        ...(status==='confirmed' ? { confirmed_at:new Date(), confirmed_by:auth.ctx.userId } : {}),
      },
      include: { customer:{ select:{ id:true, full_name:true, phone_number:true, status:true } } },
    })

    const cust = await tx.customer.findUnique({
      where: { id: customer_id },
      select: {
        id: true,
        assigned_to: true,
        house_type: true,
        floors: true,
        floor_area: true,
        budget_max: true,
      },
    })
    if (cust) {
      const patch: any = {}
      if (!cust.house_type && house_type) patch.house_type = String(house_type)
      if ((cust.floors == null) && parsedFloors != null) patch.floors = parsedFloors
      if ((cust.floor_area == null) && parsedArea != null) patch.floor_area = parsedArea
      if (!cust.budget_max && parsedEstimated) patch.budget_max = parsedEstimated
      if (Object.keys(patch).length) {
        await tx.customer.update({ where: { id: customer_id }, data: patch })
      }

      await tx.customerTimeline.create({
        data: {
          customer_id,
          type: 'project_created',
          title: 'Tao du an xay dung',
          description: `${created.project_name || 'Du an moi'} | status: ${created.status}`,
          happened_at: new Date(),
          created_by: auth.ctx.userId,
          metadata: {
            project_id: created.id,
            project_status: created.status,
            project_name: created.project_name || null,
            source: 'api/projects',
            synced_customer_fields: {
              house_type: !!(!cust.house_type && house_type),
              floors: !!(cust.floors == null && parsedFloors != null),
              floor_area: !!(cust.floor_area == null && parsedArea != null),
              budget_max: !!(!cust.budget_max && parsedEstimated),
            },
          },
        },
      })
    }

    await tx.projectTimelineEvent.create({
      data: {
        project_id: created.id,
        customer_id: customer_id,
        event_key: 'project_created',
        title: 'Tao du an moi',
        description: `${created.project_name || 'Du an moi'} | status=${created.status}`,
        source_ref_type: 'project',
        source_ref_id: created.id,
        actor_user_id: auth.ctx.userId,
        happened_at: new Date(),
        metadata_json: {
          source: 'api/projects',
          status: created.status,
        },
      },
    })
    const committedLeft = Math.max(0, Number(created.cost_committed || 0) - Number(created.cost_actual || 0))
    const demand30d = committedLeft + Math.max(0, Number((created as any).payable_planned_30d || 0))
    const supply30d = Math.max(0, Number((created as any).cash_on_hand || 0)) + Math.max(0, Number((created as any).receivable_planned_30d || 0))
    const gap30d = supply30d - demand30d
    const warningLevel = gap30d < 0 ? 'critical' : (demand30d > 0 && gap30d < demand30d * 0.1 ? 'high' : 'low')
    await (tx as any).projectCashflowSnapshot.create({
      data: {
        project_id: created.id,
        snapshot_date: new Date(),
        budget_current: created.budget_current ?? null,
        budget_allocated: (created as any).budget_allocated ?? null,
        cost_committed: created.cost_committed ?? null,
        cost_actual: created.cost_actual ?? null,
        cash_on_hand: (created as any).cash_on_hand ?? null,
        receivable_planned_30d: (created as any).receivable_planned_30d ?? null,
        payable_planned_30d: (created as any).payable_planned_30d ?? null,
        demand_30d: BigInt(Math.max(0, Math.round(demand30d))),
        supply_30d: BigInt(Math.max(0, Math.round(supply30d))),
        gap_30d: BigInt(Math.round(gap30d)),
        warning_level: warningLevel,
        created_by: auth.ctx.userId,
      },
    })
    return created
  })

  return NextResponse.json(safeJson({ data: ser(project) }), { status:201 })
}
