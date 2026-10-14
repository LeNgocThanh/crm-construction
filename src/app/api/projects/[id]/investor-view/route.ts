import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getProjectLaborFinanceSummary } from '@/lib/labor/finance'
import { deriveProjectExecutionAxis } from '@/lib/projects/execution-axis'
import { getResourcePlanExecutionState } from '@/lib/projects/resource-plan-execution'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

function toNum(v: any) {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error

  const project = await db.constructionProject.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { id: true, full_name: true, phone_number: true, status: true } },
      confirmer: { select: { id: true, username: true } },
    },
  })
  if (!project) return NextResponse.json({ error: 'Khong tim thay du an' }, { status: 404 })

  const [milestones, estimateLinksRaw, paymentPlansRaw, paymentsRaw, docs, resourcePlansRaw, resourceItemsRaw, directPurchasesRaw, materialLedgerRaw, cashflowSnapshotsRaw, assetsRaw, laborFinance] = await Promise.all([
    db.projectMilestone.findMany({
      where: { project_id: params.id, is_active: true },
      orderBy: [{ sort_order: 'asc' }, { due_date: 'asc' }, { created_at: 'asc' }],
      include: { status_ref: { select: { status_key: true, status_name: true } } },
    }),
    db.projectEstimateLink.findMany({
      where: { project_id: params.id },
      orderBy: [{ is_active: 'desc' }, { linked_at: 'desc' }],
      include: {
        estimate: {
          select: {
            id: true,
            quote_date: true,
            total_cost: true,
            subtotal_cost: true,
            status: true,
            finish_level: true,
            pricing_mode: true,
          },
        },
      },
    }),
    db.projectPaymentPlan.findMany({
      where: { project_id: params.id, is_active: true },
      orderBy: [{ sort_order: 'asc' }, { due_date: 'asc' }, { created_at: 'asc' }],
    }),
    db.projectPayment.findMany({
      where: { project_id: params.id },
      orderBy: [{ payment_date: 'desc' }, { created_at: 'desc' }],
    }),
    db.projectDocument.findMany({
      where: { project_id: params.id, is_active: true, document_scope: 'investor_visible' },
      orderBy: [{ uploaded_at: 'desc' }, { created_at: 'desc' }],
      include: { uploader: { select: { id: true, username: true } } },
    }),
    db.projectResourcePlan.findMany({
      where: { project_id: params.id, is_active: true },
      orderBy: [{ created_at: 'desc' }],
      include: {
        milestone: { select: { id: true, milestone_name: true, status_key: true } },
        subcontractor: { select: { id: true, supplier_name: true, supplier_code: true } },
      },
    }),
    db.projectResourcePlanItem.findMany({
      where: { project_id: params.id, is_active: true },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    }),
    (db as any).projectDirectPurchase.findMany({
      where: { project_id: params.id },
      orderBy: [{ purchase_date: 'desc' }, { created_at: 'desc' }],
      include: { items: true, supplier: { select: { id: true, supplier_name: true, supplier_code: true } } },
    }),
    (db as any).projectMaterialLedger.findMany({
      where: { project_id: params.id },
      orderBy: [{ happened_at: 'desc' }, { created_at: 'desc' }],
      take: 300,
    }),
    (db as any).projectCashflowSnapshot.findMany({
      where: { project_id: params.id },
      orderBy: [{ snapshot_date: 'desc' }, { created_at: 'desc' }],
      take: 30,
      include: {
        milestone: { select: { id: true, milestone_name: true } },
      },
    }),
    db.asset.findMany({
      where: { current_project_id: params.id, is_active: true },
      orderBy: [{ updated_at: 'desc' }],
      select: {
        id: true,
        asset_code: true,
        asset_name: true,
        asset_type: true,
        status: true,
        condition_status: true,
        current_location: true,
        current_holder_user_id: true,
        current_holder: { select: { id: true, username: true } },
        asset_type_ref: { select: { id: true, type_key: true, type_name: true } },
        unit_ref: { select: { id: true, unit_key: true, unit_name: true, symbol: true } },
        updated_at: true,
      },
    }),
    getProjectLaborFinanceSummary(params.id),
  ])

  const estimateLinks = estimateLinksRaw.map((x) => ({
    ...x,
    estimate: x.estimate
      ? {
          ...x.estimate,
          total_cost: toNum(x.estimate.total_cost),
          subtotal_cost: toNum(x.estimate.subtotal_cost),
        }
      : null,
  }))

  const paymentPlans = paymentPlansRaw.map((x) => ({
    ...x,
    amount: toNum(x.amount),
  }))
  const payments = paymentsRaw.map((x) => ({
    ...x,
    amount: toNum(x.amount),
  }))
  const resourceItems = resourceItemsRaw.map((x) => ({
    ...x,
    unit_cost: toNum(x.unit_cost),
    estimated_cost: toNum(x.estimated_cost),
  }))
  const resourcePlans = await Promise.all((resourcePlansRaw || []).map(async (row: any) => {
    const [inventoryPostedCount, directPurchaseConfirmedCount, laborAttendanceConfirmedCount] = await Promise.all([
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
      db.projectLaborAttendance.count({
        where: {
          project_id: params.id,
          attendance_status: 'confirmed',
          engagement: { is: { plan_id: row.id } },
        },
      }),
    ])
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
  const executionAxis = deriveProjectExecutionAxis({
    projectStatus: project.status,
    projectStage: project.stage,
    explicitActiveMaterialPlanId: (project as any).active_material_plan_id,
    explicitActiveLaborPlanId: (project as any).active_labor_plan_id,
    milestones,
    resourcePlans,
    resourceItems,
  })
  const resourcePlansWithAxis = resourcePlans.map((row: any) => {
    const planKinds = executionAxis.plan_kinds_by_id?.[String(row?.id || '')] || []
    return {
      ...row,
      plan_kinds: planKinds,
      is_active_material_plan: String(executionAxis.active_material_plan?.id || '') === String(row?.id || ''),
      is_active_labor_plan: String(executionAxis.active_labor_plan?.id || '') === String(row?.id || ''),
    }
  })
  const direct_purchases = (directPurchasesRaw || []).map((x: any) => ({
    ...x,
    items: (x.items || []).map((it: any) => ({
      ...it,
      unit_price: it.unit_price != null ? Number(it.unit_price) : null,
      line_total: it.line_total != null ? Number(it.line_total) : null,
    })),
  }))
  const material_ledger = (materialLedgerRaw || []).map((x: any) => ({
    ...x,
    unit_price: x.unit_price != null ? Number(x.unit_price) : null,
    line_total: x.line_total != null ? Number(x.line_total) : null,
  }))
  const cashflow_snapshots = (cashflowSnapshotsRaw || []).map((x: any) => ({
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
  const assets = (assetsRaw || []).map((a: any) => ({
    ...a,
    asset_type_data: a.asset_type_ref
      ? { id: a.asset_type_ref.id, type_key: a.asset_type_ref.type_key, type_name: a.asset_type_ref.type_name }
      : null,
    unit: a.unit_ref
      ? { id: a.unit_ref.id, unit_key: a.unit_ref.unit_key, unit_name: a.unit_ref.unit_name, symbol: a.unit_ref.symbol }
      : null,
  }))
  const latestCashflow = cashflow_snapshots[0] || null

  const planIds = resourcePlans.map((x) => x.id)
  const inventoryTxnsRaw = planIds.length
    ? await db.inventoryTransaction.findMany({
        where: {
          OR: [
            { reference_type: 'project_resource_plan', reference_id: { in: planIds } },
            { reference_type: 'project_resource_plan_return', reference_id: { in: planIds } },
          ],
        },
        orderBy: [{ created_at: 'desc' }],
        include: { items: true, warehouse: { select: { id: true, warehouse_name: true, warehouse_code: true } } },
      })
    : []
  const inventory_transactions = inventoryTxnsRaw.map((x) => ({
    ...x,
    items: Array.isArray(x.items)
      ? x.items.map((it: any) => ({
          ...it,
          unit_price: it?.unit_price != null ? Number(it.unit_price) : null,
          line_total: it?.line_total != null ? Number(it.line_total) : null,
        }))
      : [],
  }))

  const totalPlanned = paymentPlans.reduce((s, x) => s + Number(x.amount || 0), 0)
  const totalPaid = payments.reduce((s, x) => s + Number(x.amount || 0), 0)
  const outstanding = Math.max(0, totalPlanned - totalPaid)

  const now = Date.now()
  const nextDue = paymentPlans
    .filter((x) => x.due_date && x.status !== 'paid' && x.status !== 'cancelled')
    .sort((a, b) => new Date(String(a.due_date)).getTime() - new Date(String(b.due_date)).getTime())
    .find((x) => new Date(String(x.due_date)).getTime() >= now) || null

  const activeEstimate = estimateLinks.find((x) => x.is_active) || estimateLinks[0] || null
  const committedBase = latestCashflow?.cost_committed ?? toNum((project as any).cost_committed) ?? 0
  const actualBase = latestCashflow?.cost_actual ?? toNum((project as any).cost_actual) ?? 0
  const payableBase = latestCashflow?.payable_planned_30d ?? toNum((project as any).payable_planned_30d) ?? 0
  const cashBase = latestCashflow?.cash_on_hand ?? toNum((project as any).cash_on_hand) ?? 0
  const receivableBase = latestCashflow?.receivable_planned_30d ?? toNum((project as any).receivable_planned_30d) ?? 0
  const committedLeft = Math.max(0, Number(committedBase) - Number(actualBase))
  const demand30d = committedLeft + Math.max(0, Number(payableBase))
  const supply30d = Math.max(0, Number(cashBase)) + Math.max(0, Number(receivableBase))
  const gap30d = supply30d - demand30d
  const warningLevel = gap30d < 0 ? 'critical' : (demand30d > 0 && gap30d < demand30d * 0.1 ? 'high' : 'low')
  const autoDelayDays = (() => {
    const now = Date.now()
    let maxDelay = 0
    for (const m of milestones || []) {
      const due = m?.due_date ? new Date(String(m.due_date)).getTime() : 0
      const done = m?.completed_at ? new Date(String(m.completed_at)).getTime() : 0
      if (!due) continue
      if (done > due) {
        const d = Math.floor((done - due) / (24 * 60 * 60 * 1000))
        if (d > maxDelay) maxDelay = d
      } else if (!done && due < now && String(m?.status_key || '') !== 'completed') {
        const d = Math.floor((now - due) / (24 * 60 * 60 * 1000))
        if (d > maxDelay) maxDelay = d
      }
    }
    return maxDelay
  })()

  const payload = {
    overview: {
      id: project.id,
      project_name: project.project_name,
      status: project.status,
      stage: project.stage,
      address: project.address,
      house_type: project.house_type,
      floors: project.floors,
      floor_area: project.floor_area,
      start_date: project.start_date,
      expected_end_date: project.expected_end_date,
      actual_end_date: project.actual_end_date,
      contract_value: toNum(project.contract_value),
      estimated_budget: toNum(project.estimated_budget),
      budget_baseline: toNum((project as any).budget_baseline),
      budget_current: latestCashflow?.budget_current ?? toNum((project as any).budget_current),
      budget_allocated: latestCashflow?.budget_allocated ?? toNum((project as any).budget_allocated),
      cost_committed: latestCashflow?.cost_committed ?? toNum((project as any).cost_committed),
      cost_actual: latestCashflow?.cost_actual ?? toNum((project as any).cost_actual),
      cash_on_hand: latestCashflow?.cash_on_hand ?? toNum((project as any).cash_on_hand),
      receivable_planned_30d: latestCashflow?.receivable_planned_30d ?? toNum((project as any).receivable_planned_30d),
      payable_planned_30d: latestCashflow?.payable_planned_30d ?? toNum((project as any).payable_planned_30d),
      progress_planned_percent: latestCashflow?.progress_planned_percent ?? toNum((project as any).progress_planned_percent),
      progress_actual_percent: latestCashflow?.progress_actual_percent ?? toNum((project as any).progress_actual_percent),
      delay_days: latestCashflow?.delay_days ?? ((project as any).delay_days != null ? Number((project as any).delay_days) : autoDelayDays),
      delay_days_auto: autoDelayDays,
      risk_level: latestCashflow?.risk_level || (project as any).risk_level || null,
      customer: project.customer,
      confirmer: project.confirmer,
      updated_at: project.updated_at,
      cashflow_summary: {
        demand_30d: demand30d,
        supply_30d: supply30d,
        gap_30d: gap30d,
        warning_level: warningLevel,
      },
      labor_finance_summary: {
        ...laborFinance,
        cash_gap_for_payable: Math.round(Number(cashBase || 0) - Number(laborFinance.payable_amount || 0)),
      },
    },
    estimates: {
      active: activeEstimate,
      history: estimateLinks,
    },
    milestones,
    payments: {
      plans: paymentPlans,
      transactions: payments,
      summary: {
        total_planned: totalPlanned,
        total_paid: totalPaid,
        outstanding,
      },
      next_due: nextDue,
    },
    documents: docs.map((d) => ({
      ...d,
      file_size_bytes: d.file_size_bytes != null ? Number(d.file_size_bytes) : null,
    })),
    resources: {
      plans: resourcePlansWithAxis,
      items: resourceItems,
      inventory_transactions,
      direct_purchases,
      material_ledger,
    },
    execution_axis: executionAxis,
    assets,
    cashflow: {
      snapshots: cashflow_snapshots,
    },
  }

  return NextResponse.json({ data: payload })
}
