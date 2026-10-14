import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { getProjectLaborFinanceSummary } from '@/lib/labor/finance'

function toNum(v: any) {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function bigintOrNull(v: any) {
  if (v == null || String(v) === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return BigInt(Math.round(n))
}

async function calcReceivablePlanned30d(projectId: string) {
  const now = new Date()
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const plans = await (db as any).projectPaymentPlan.findMany({
    where: {
      project_id: projectId,
      due_date: { gte: now, lte: end },
      status: { notIn: ['paid', 'cancelled'] },
      is_active: true,
    },
    select: { id: true, amount: true },
  })
  if (!plans.length) return 0
  const planIds = plans.map((x: any) => x.id)
  const payments = await (db as any).projectPayment.findMany({
    where: { project_id: projectId, payment_plan_id: { in: planIds } },
    select: { payment_plan_id: true, amount: true },
  })
  const paidByPlan = new Map<string, number>()
  for (const p of payments || []) {
    const key = String(p.payment_plan_id || '')
    if (!key) continue
    paidByPlan.set(key, (paidByPlan.get(key) || 0) + Number(p.amount || 0))
  }
  let receivable = 0
  for (const plan of plans) {
    const total = Number(plan.amount || 0)
    const paid = paidByPlan.get(String(plan.id)) || 0
    receivable += Math.max(0, total - paid)
  }
  return Math.max(0, Math.round(receivable))
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const sp = new URL(req.url).searchParams
  if (sp.get('mode') === 'suggest_from_payments') {
    const receivable = await calcReceivablePlanned30d(params.id)
    return NextResponse.json({ data: { receivable_planned_30d: receivable } })
  }
  if (sp.get('mode') === 'suggest_from_operations') {
    const laborFinance = await getProjectLaborFinanceSummary(params.id)
    const approvedPlans = await (db as any).projectResourcePlan.findMany({
      where: {
        project_id: params.id,
        is_active: true,
        status: { in: ['approved', 'locked'] },
      },
      select: { id: true },
    })
    const approvedPlanIds = approvedPlans.map((x: any) => String(x.id))
    const approvedPlanItems = approvedPlanIds.length
      ? await (db as any).projectResourcePlanItem.findMany({
          where: { project_id: params.id, is_active: true, plan_id: { in: approvedPlanIds } },
          select: { estimated_cost: true },
        })
      : []
    const committedFromPlans = (approvedPlanItems || []).reduce((s: number, x: any) => s + Number(x?.estimated_cost || 0), 0)

    const confirmedPurchases = await (db as any).projectDirectPurchase.findMany({
      where: { project_id: params.id, status: 'confirmed' },
      select: { id: true, plan_id: true },
    })
    const purchaseIdsNoPlan = (confirmedPurchases || []).filter((x: any) => !x?.plan_id).map((x: any) => String(x.id))
    const directItemsNoPlan = purchaseIdsNoPlan.length
      ? await (db as any).projectDirectPurchaseItem.findMany({
          where: { project_id: params.id, purchase_id: { in: purchaseIdsNoPlan } },
          select: { line_total: true },
        })
      : []
    const committedDirectNoPlan = (directItemsNoPlan || []).reduce((s: number, x: any) => s + Number(x?.line_total || 0), 0)

    const materialLedger = await (db as any).projectMaterialLedger.findMany({
      where: {
        project_id: params.id,
        direction: { in: ['consume', 'out'] },
      },
      select: { line_total: true },
    })
    const actualFromLedger = (materialLedger || []).reduce((s: number, x: any) => s + Number(x?.line_total || 0), 0)

    return NextResponse.json({
      data: {
        cost_committed: Math.max(0, Math.round(committedFromPlans + committedDirectNoPlan)),
        cost_actual: Math.max(0, Math.round(actualFromLedger + Number(laborFinance.actual_cost || 0))),
        labor_cost_planned: Number(laborFinance.planned_cost || 0),
        labor_cost_actual: Number(laborFinance.actual_cost || 0),
        labor_cost_paid: Number(laborFinance.paid_amount || 0),
        labor_cost_payable: Number(laborFinance.payable_amount || 0),
      },
    })
  }

  const rows = await (db as any).projectCashflowSnapshot.findMany({
    where: { project_id: params.id },
    orderBy: [{ snapshot_date: 'desc' }, { created_at: 'desc' }],
    take: 100,
    include: {
      milestone: { select: { id: true, milestone_name: true } },
    },
  })
  const data = (rows || []).map((x: any) => ({
    ...x,
    budget_current: toNum(x.budget_current),
    budget_allocated: toNum(x.budget_allocated),
    cost_committed: toNum(x.cost_committed),
    cost_actual: toNum(x.cost_actual),
    cash_on_hand: toNum(x.cash_on_hand),
    receivable_planned_30d: toNum(x.receivable_planned_30d),
    payable_planned_30d: toNum(x.payable_planned_30d),
    demand_30d: toNum(x.demand_30d),
    supply_30d: toNum(x.supply_30d),
    gap_30d: toNum(x.gap_30d),
  }))
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsManage)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const body = await req.json().catch(() => ({}))
  const snapshotType = String(body?.snapshot_type || 'month_end').trim()
  if (!['month_end', 'event', 'milestone'].includes(snapshotType)) {
    return NextResponse.json({ error: 'snapshot_type khong hop le' }, { status: 400 })
  }
  const periodKey =
    snapshotType === 'month_end'
      ? (body?.period_key ? String(body.period_key) : new Date().toISOString().slice(0, 7))
      : null
  const milestoneId = snapshotType === 'milestone' && body?.milestone_id ? String(body.milestone_id) : null

  const budgetCurrent = bigintOrNull(body?.budget_current)
  const budgetAllocated = bigintOrNull(body?.budget_allocated)
  const costCommitted = bigintOrNull(body?.cost_committed)
  const costActual = bigintOrNull(body?.cost_actual)
  const cashOnHand = bigintOrNull(body?.cash_on_hand)
  const receivable30d = bigintOrNull(body?.receivable_planned_30d)
  const payable30d = bigintOrNull(body?.payable_planned_30d)
  const progressPlanned = body?.progress_planned_percent != null && String(body.progress_planned_percent) !== '' ? Number(body.progress_planned_percent) : null
  const progressActual = body?.progress_actual_percent != null && String(body.progress_actual_percent) !== '' ? Number(body.progress_actual_percent) : null
  const delayDays = body?.delay_days != null && String(body.delay_days) !== '' ? Number(body.delay_days) : null
  const riskLevel = body?.risk_level ? String(body.risk_level) : null

  const autoFillFromPayments = body?.auto_fill_from_payments !== false
  const resolvedReceivable30d = (receivable30d == null && autoFillFromPayments)
    ? BigInt(await calcReceivablePlanned30d(params.id))
    : receivable30d

  const committedLeft = Math.max(0, Number(costCommitted || BigInt(0)) - Number(costActual || BigInt(0)))
  const demand30d = committedLeft + Math.max(0, Number(payable30d || BigInt(0)))
  const supply30d = Math.max(0, Number(cashOnHand || BigInt(0))) + Math.max(0, Number(resolvedReceivable30d || BigInt(0)))
  const gap30d = supply30d - demand30d
  const warningLevel = gap30d < 0 ? 'critical' : (demand30d > 0 && gap30d < demand30d * 0.1 ? 'high' : 'low')

  const created = await (db as any).projectCashflowSnapshot.create({
    data: {
      project_id: params.id,
      snapshot_date: body?.snapshot_date ? new Date(String(body.snapshot_date)) : new Date(),
      snapshot_type: snapshotType,
      period_key: periodKey,
      milestone_id: milestoneId,
      budget_current: budgetCurrent,
      budget_allocated: budgetAllocated,
      cost_committed: costCommitted,
      cost_actual: costActual,
      cash_on_hand: cashOnHand,
      receivable_planned_30d: resolvedReceivable30d,
      payable_planned_30d: payable30d,
      progress_planned_percent: progressPlanned,
      progress_actual_percent: progressActual,
      delay_days: delayDays,
      risk_level: riskLevel,
      demand_30d: BigInt(Math.max(0, Math.round(demand30d))),
      supply_30d: BigInt(Math.max(0, Math.round(supply30d))),
      gap_30d: BigInt(Math.round(gap30d)),
      warning_level: warningLevel,
      note: body?.note ? String(body.note) : null,
      created_by: String(session.user.id || '') || null,
    },
  })
  return NextResponse.json({
    data: {
      ...created,
      budget_current: toNum(created.budget_current),
      budget_allocated: toNum(created.budget_allocated),
      cost_committed: toNum(created.cost_committed),
      cost_actual: toNum(created.cost_actual),
      cash_on_hand: toNum(created.cash_on_hand),
      receivable_planned_30d: toNum(created.receivable_planned_30d),
      payable_planned_30d: toNum(created.payable_planned_30d),
      demand_30d: toNum(created.demand_30d),
      supply_30d: toNum(created.supply_30d),
      gap_30d: toNum(created.gap_30d),
    },
  }, { status: 201 })
}
