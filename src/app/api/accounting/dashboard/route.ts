import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { getProjectLaborFinanceSummaryMap } from '@/lib/labor/finance'

function toNumber(value: any) {
  if (value == null) return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function getCapitalState(warningLevel?: string | null, gap30d?: number | null) {
  const warning = String(warningLevel || '').toLowerCase()
  const gap = Number(gap30d || 0)
  if (warning === 'critical' || gap < 0) return 'thieu_von'
  if (warning === 'high') return 'sap_thieu_von'
  return 'du_von'
}

function safeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))) as T
}

function getReceivableBucket(dueDate: Date | null, now: Date) {
  if (!dueDate) return 'khong_xac_dinh'
  const endDue = new Date(dueDate)
  endDue.setHours(23, 59, 59, 999)
  const diffDays = Math.floor((now.getTime() - endDue.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays <= 0) return 'chua_den_han'
  if (diffDays <= 7) return 'qua_han_1_7'
  if (diffDays <= 30) return 'qua_han_8_30'
  return 'qua_han_tren_30'
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const status = String(sp.get('status') || '').trim()
  const issueOnly = sp.get('issue_only') === '1'
  const receivableBucket = String(sp.get('receivable_bucket') || '').trim()
  const projectId = String(sp.get('project_id') || '').trim()
  const customerId = String(sp.get('customer_id') || '').trim()

  const now = new Date()
  const monthFrom = startOfMonth(now)
  const monthTo = endOfMonth(now)
  const next30d = addDays(now, 30)

  const projectWhere: any = {}
  if (status) projectWhere.status = status
  if (projectId) projectWhere.id = projectId
  if (customerId) projectWhere.customer_id = customerId

  const projects = await db.constructionProject.findMany({
    where: projectWhere,
    orderBy: [{ updated_at: 'desc' }],
    include: {
      customer: { select: { id: true, full_name: true } },
      cashflow_snapshots: {
        orderBy: [{ snapshot_date: 'desc' }, { created_at: 'desc' }],
        take: 1,
        select: {
          snapshot_date: true,
          budget_current: true,
          cost_actual: true,
          cash_on_hand: true,
          receivable_planned_30d: true,
          payable_planned_30d: true,
          demand_30d: true,
          supply_30d: true,
          gap_30d: true,
          warning_level: true,
        },
      },
    },
  })

  const projectIds = projects.map((row) => String(row.id || '')).filter(Boolean)
  const laborMap = await getProjectLaborFinanceSummaryMap(projectIds)

  const [openPlans, projectPaymentsMtd, laborPaymentsMtd] = await Promise.all([
    db.projectPaymentPlan.findMany({
      where: {
        project_id: { in: projectIds.length ? projectIds : [''] },
        is_active: true,
        status: { notIn: ['paid', 'cancelled'] },
      },
      select: {
        id: true,
        project_id: true,
        milestone_name: true,
        due_date: true,
        amount: true,
        status: true,
        project: { select: { project_name: true, customer: { select: { full_name: true } } } },
      },
      orderBy: [{ due_date: 'asc' }, { created_at: 'asc' }],
    }),
    db.projectPayment.findMany({
      where: {
        project_id: { in: projectIds.length ? projectIds : [''] },
        payment_date: { gte: monthFrom, lte: monthTo },
      },
      select: {
        id: true,
        project_id: true,
        payment_plan_id: true,
        amount: true,
      },
    }),
    (db as any).projectLaborPayment
      ? (db as any).projectLaborPayment.findMany({
          where: {
            project_id: { in: projectIds.length ? projectIds : [''] },
            is_active: true,
            payment_date: { gte: monthFrom, lte: monthTo },
            OR: [
              { batch_id: null },
              { batch: { status: { not: 'cancelled' } } },
            ],
          },
          select: {
            id: true,
            project_id: true,
            amount: true,
          },
        })
      : [],
  ])

  const duePlanIds = openPlans.map((row) => String(row.id || '')).filter(Boolean)
  const duePlanPayments = duePlanIds.length
    ? await db.projectPayment.findMany({
        where: {
          payment_plan_id: { in: duePlanIds },
        },
        select: {
          payment_plan_id: true,
          amount: true,
        },
      })
    : []

  const paidByPlanId = new Map<string, number>()
  for (const row of duePlanPayments) {
    const planId = String(row.payment_plan_id || '').trim()
    if (!planId) continue
    paidByPlanId.set(planId, (paidByPlanId.get(planId) || 0) + toNumber(row.amount))
  }

  const projectPaymentAmountMtdMap = new Map<string, number>()
  for (const row of projectPaymentsMtd) {
    const key = String(row.project_id || '').trim()
    if (!key) continue
    projectPaymentAmountMtdMap.set(key, (projectPaymentAmountMtdMap.get(key) || 0) + toNumber(row.amount))
  }

  const laborPaymentAmountMtdMap = new Map<string, number>()
  for (const row of laborPaymentsMtd || []) {
    const key = String(row.project_id || '').trim()
    if (!key) continue
    laborPaymentAmountMtdMap.set(key, (laborPaymentAmountMtdMap.get(key) || 0) + toNumber(row.amount))
  }

  const receivableRows = openPlans
    .map((plan) => {
      const total = toNumber(plan.amount)
      const paid = paidByPlanId.get(String(plan.id || '')) || 0
      const remaining = Math.max(0, Math.round(total - paid))
      const bucket = getReceivableBucket(plan.due_date || null, now)
      return {
        project_id: String(plan.project_id || ''),
        project_name: plan.project?.project_name || '-',
        customer_name: plan.project?.customer?.full_name || '-',
        milestone_name: plan.milestone_name || '-',
        due_date: plan.due_date,
        status: plan.status || null,
        amount: Math.round(total),
        paid_amount: Math.round(paid),
        remaining_amount: remaining,
        days_to_due: plan.due_date ? Math.ceil((new Date(plan.due_date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null,
        bucket,
      }
    })
    .filter((row) => row.remaining_amount > 0)
    .sort((a, b) => {
      const dueA = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER
      const dueB = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER
      return dueA - dueB
    })

  const filteredReceivableRows = receivableBucket
    ? receivableRows.filter((row) => String(row.bucket || '') === receivableBucket)
    : receivableRows

  const receivable30dRows = filteredReceivableRows.filter((row) => row.due_date && new Date(row.due_date) >= now && new Date(row.due_date) <= next30d)

  const receivableAgingSummary = filteredReceivableRows.reduce(
    (acc, row) => {
      acc.total += Number(row.remaining_amount || 0)
      if (row.bucket === 'chua_den_han') acc.chua_den_han += Number(row.remaining_amount || 0)
      else if (row.bucket === 'qua_han_1_7') acc.qua_han_1_7 += Number(row.remaining_amount || 0)
      else if (row.bucket === 'qua_han_8_30') acc.qua_han_8_30 += Number(row.remaining_amount || 0)
      else if (row.bucket === 'qua_han_tren_30') acc.qua_han_tren_30 += Number(row.remaining_amount || 0)
      else acc.khong_xac_dinh += Number(row.remaining_amount || 0)
      return acc
    },
    {
      total: 0,
      chua_den_han: 0,
      qua_han_1_7: 0,
      qua_han_8_30: 0,
      qua_han_tren_30: 0,
      khong_xac_dinh: 0,
    }
  )

  const items = projects.map((project: any) => {
    const latestSnapshot = Array.isArray(project.cashflow_snapshots) && project.cashflow_snapshots.length ? project.cashflow_snapshots[0] : null
    const labor = laborMap.get(String(project.id || '')) || {
      planned_cost: 0,
      actual_cost: 0,
      paid_amount: 0,
      payable_amount: 0,
    }
    const budgetCurrent = latestSnapshot?.budget_current != null ? toNumber(latestSnapshot.budget_current) : toNumber(project.budget_current)
    const costActual = latestSnapshot?.cost_actual != null ? toNumber(latestSnapshot.cost_actual) : toNumber(project.cost_actual)
    const receivable30d =
      latestSnapshot?.receivable_planned_30d != null
        ? toNumber(latestSnapshot.receivable_planned_30d)
        : receivable30dRows.filter((row) => row.project_id === String(project.id || '')).reduce((sum, row) => sum + Number(row.remaining_amount || 0), 0)
    const payable30d =
      latestSnapshot?.payable_planned_30d != null
        ? toNumber(latestSnapshot.payable_planned_30d)
        : toNumber(labor.payable_amount)
    const gap30d =
      latestSnapshot?.gap_30d != null
        ? toNumber(latestSnapshot.gap_30d)
        : receivable30d - payable30d
    const warningLevel = String(latestSnapshot?.warning_level || '').trim() || (gap30d < 0 ? 'critical' : 'low')
    const capitalState = getCapitalState(warningLevel, gap30d)
    const warningItems: string[] = []
    if (capitalState === 'thieu_von') warningItems.push('Thiếu vốn 30 ngày')
    else if (capitalState === 'sap_thieu_von') warningItems.push('Sắp thiếu vốn 30 ngày')
    if (Number(labor.payable_amount || 0) > 0) warningItems.push('Còn phải trả nhân công')

    return {
      id: String(project.id || ''),
      project_name: project.project_name || '-',
      status: project.status || null,
      risk_level: project.risk_level || null,
      customer_name: project.customer?.full_name || null,
      contract_value: toNumber(project.contract_value),
      budget_current: budgetCurrent,
      cost_actual: costActual,
      cost_committed: toNumber(project.cost_committed),
      cash_on_hand: latestSnapshot?.cash_on_hand != null ? toNumber(latestSnapshot.cash_on_hand) : toNumber(project.cash_on_hand),
      receivable_30d: receivable30d,
      payable_30d: payable30d,
      gap_30d: gap30d,
      warning_level: warningLevel,
      capital_state: capitalState,
      labor_payable_amount: toNumber(labor.payable_amount),
      labor_paid_amount: toNumber(labor.paid_amount),
      labor_actual_cost: toNumber(labor.actual_cost),
      payment_received_mtd: projectPaymentAmountMtdMap.get(String(project.id || '')) || 0,
      labor_paid_mtd: laborPaymentAmountMtdMap.get(String(project.id || '')) || 0,
      warning_count: warningItems.length,
      warning_items: warningItems,
    }
  })

  const filteredItems = items.filter((item) => {
    if (issueOnly && item.warning_count <= 0) return false
    return true
  })

  const byStatusMap = new Map<string, { status: string; count: number; contract_value: number }>()
  const byRiskMap = new Map<string, { risk_level: string; count: number }>()
  for (const item of filteredItems) {
    const statusKey = String(item.status || 'unknown')
    const statusCurrent = byStatusMap.get(statusKey) || { status: statusKey, count: 0, contract_value: 0 }
    statusCurrent.count += 1
    statusCurrent.contract_value += Number(item.contract_value || 0)
    byStatusMap.set(statusKey, statusCurrent)

    const riskKey = String(item.risk_level || 'none')
    const riskCurrent = byRiskMap.get(riskKey) || { risk_level: riskKey, count: 0 }
    riskCurrent.count += 1
    byRiskMap.set(riskKey, riskCurrent)
  }

  const summary = {
    project_count: filteredItems.length,
    active_project_count: filteredItems.filter((row) => ['draft', 'confirmed', 'in_progress', 'paused'].includes(String(row.status || ''))).length,
    contract_total: filteredItems.reduce((sum, row) => sum + Number(row.contract_value || 0), 0),
    budget_current_total: filteredItems.reduce((sum, row) => sum + Number(row.budget_current || 0), 0),
    cost_actual_total: filteredItems.reduce((sum, row) => sum + Number(row.cost_actual || 0), 0),
    cash_on_hand_total: filteredItems.reduce((sum, row) => sum + Number(row.cash_on_hand || 0), 0),
    receivable_30d_total: filteredItems.reduce((sum, row) => sum + Number(row.receivable_30d || 0), 0),
    payable_30d_total: filteredItems.reduce((sum, row) => sum + Number(row.payable_30d || 0), 0),
    gap_30d_total: filteredItems.reduce((sum, row) => sum + Number(row.gap_30d || 0), 0),
    labor_payable_total: filteredItems.reduce((sum, row) => sum + Number(row.labor_payable_amount || 0), 0),
    payment_received_mtd_total: filteredItems.reduce((sum, row) => sum + Number(row.payment_received_mtd || 0), 0),
    labor_paid_mtd_total: filteredItems.reduce((sum, row) => sum + Number(row.labor_paid_mtd || 0), 0),
    capital_missing_count: filteredItems.filter((row) => row.capital_state === 'thieu_von').length,
    capital_tight_count: filteredItems.filter((row) => row.capital_state === 'sap_thieu_von').length,
    warning_project_count: filteredItems.filter((row) => row.warning_count > 0).length,
  }

  return NextResponse.json(safeJson({
    filters: {
      status: status || null,
      issue_only: issueOnly,
      receivable_bucket: receivableBucket || null,
      project_id: projectId || null,
      customer_id: customerId || null,
    },
    summary,
    breakdown: {
      by_status: Array.from(byStatusMap.values()),
      by_risk_level: Array.from(byRiskMap.values()),
    },
    top_capital_gap_projects: [...filteredItems]
      .filter((row) => row.capital_state !== 'du_von')
      .sort((a, b) => Number(a.gap_30d || 0) - Number(b.gap_30d || 0))
      .slice(0, 10),
    top_receivables_due: filteredReceivableRows.slice(0, 12),
    receivable_aging_summary: {
      total: Math.round(receivableAgingSummary.total),
      chua_den_han: Math.round(receivableAgingSummary.chua_den_han),
      qua_han_1_7: Math.round(receivableAgingSummary.qua_han_1_7),
      qua_han_8_30: Math.round(receivableAgingSummary.qua_han_8_30),
      qua_han_tren_30: Math.round(receivableAgingSummary.qua_han_tren_30),
      khong_xac_dinh: Math.round(receivableAgingSummary.khong_xac_dinh),
    },
    receivable_aging_rows: [...filteredReceivableRows]
      .sort((a, b) => {
        const overdueA = a.days_to_due != null ? a.days_to_due : 999999
        const overdueB = b.days_to_due != null ? b.days_to_due : 999999
        return overdueA - overdueB
      })
      .slice(0, 40),
    top_labor_payables: [...filteredItems]
      .filter((row) => Number(row.labor_payable_amount || 0) > 0)
      .sort((a, b) => Number(b.labor_payable_amount || 0) - Number(a.labor_payable_amount || 0))
      .slice(0, 10),
    top_cost_actual_projects: [...filteredItems]
      .sort((a, b) => Number(b.cost_actual || 0) - Number(a.cost_actual || 0))
      .slice(0, 10),
  }))
}
