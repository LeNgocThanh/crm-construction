import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { getProjectLaborFinanceSummaryMap } from '@/lib/labor/finance'

function safeJson<T>(payload: T): T {
  return JSON.parse(JSON.stringify(payload, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))) as T
}

function toNumber(value: any) {
  return value != null ? Number(value) : null
}

function normalizeCapitalState(warningLevel?: string | null, gap30d?: number | null) {
  const warning = String(warningLevel || '').toLowerCase()
  const gap = Number(gap30d || 0)
  if (warning === 'critical' || gap < 0) return 'missing'
  if (warning === 'high') return 'tight'
  return 'enough'
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const sp = new URL(req.url).searchParams
  const status = String(sp.get('status') || '').trim()
  const houseType = String(sp.get('house_type') || '').trim()
  const riskLevel = String(sp.get('risk_level') || '').trim()
  const capitalStateFilter = String(sp.get('capital_state') || '').trim()
  const issueOnly = sp.get('issue_only') === '1'
  const limit = Math.min(500, Math.max(1, Number(sp.get('limit') || 300)))

  const where: any = {}
  if (status) where.status = status
  if (houseType) where.house_type = houseType
  if (riskLevel) where.risk_level = riskLevel

  const projects = await db.constructionProject.findMany({
    where,
    orderBy: [{ updated_at: 'desc' }],
    take: limit,
    include: {
      customer: { select: { id: true, full_name: true, phone_number: true } },
      cashflow_snapshots: {
        select: {
          snapshot_date: true,
          warning_level: true,
          gap_30d: true,
          demand_30d: true,
          supply_30d: true,
        },
        orderBy: [{ snapshot_date: 'desc' }, { created_at: 'desc' }],
        take: 1,
      },
      diary_entries: {
        orderBy: [{ entry_date: 'desc' }, { created_at: 'desc' }],
        take: 5,
        select: {
          id: true,
          entry_date: true,
          progress_percent_total: true,
          quality_status: true,
          safety_status: true,
          title: true,
        },
      },
      milestones: {
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { due_date: 'asc' }],
        take: 3,
        select: {
          id: true,
          milestone_name: true,
          status_key: true,
          due_date: true,
          completed_at: true,
        },
      },
      assets: {
        where: { is_active: true },
        select: { id: true },
      },
    },
  })

  const laborFinanceMap = await getProjectLaborFinanceSummaryMap(projects.map((p) => String(p.id || '')))
  const now = new Date()
  const threeDaysAgo = new Date(now)
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  const items = projects.map((project: any) => {
    const latestDiary = Array.isArray(project.diary_entries) && project.diary_entries.length ? project.diary_entries[0] : null
    const progressVals = (project.diary_entries || [])
      .map((d: any) => (d.progress_percent_total != null ? Number(d.progress_percent_total) : null))
      .filter((x: any) => x != null)
    const progressStalled = progressVals.length >= 2 && progressVals.every((x: any) => x === progressVals[0])
    const repeatedSafetyIncident = (project.diary_entries || []).filter((d: any) => String(d.safety_status || '').toLowerCase() === 'incident').length >= 2
    const repeatedQualityBlocked = (project.diary_entries || []).filter((d: any) => String(d.quality_status || '').toLowerCase() === 'blocked').length >= 2
    const hasRecentDiary = latestDiary ? new Date(latestDiary.entry_date) >= threeDaysAgo : false
    const latestSnapshot = Array.isArray(project.cashflow_snapshots) && project.cashflow_snapshots.length ? project.cashflow_snapshots[0] : null
    const capitalState = normalizeCapitalState(latestSnapshot?.warning_level, latestSnapshot?.gap_30d != null ? Number(latestSnapshot.gap_30d) : null)
    const labor = (laborFinanceMap.get(String(project.id || '')) || {
      planned_cost: 0,
      planned_qty: 0,
      actual_cost: 0,
      actual_qty: 0,
      paid_amount: 0,
      payable_amount: 0,
      planned_gap_amount: 0,
      cash_gap_for_payable: Number(project.cash_on_hand || 0),
      warning_state: 'enough',
    }) as {
      planned_cost: number
      planned_qty: number
      actual_cost: number
      actual_qty: number
      paid_amount: number
      payable_amount: number
      planned_gap_amount: number
      cash_gap_for_payable: number
      warning_state?: string
    }
    const warningItems: string[] = []
    if (!hasRecentDiary) warningItems.push('Thiếu nhật ký 3 ngày')
    if (progressStalled) warningItems.push('Tiến độ đứng yên')
    if (repeatedQualityBlocked) warningItems.push('Lặp lỗi chất lượng')
    if (repeatedSafetyIncident) warningItems.push('Lặp sự cố an toàn')
    if (capitalState === 'missing') warningItems.push('Thiếu vốn 30 ngày')
    else if (capitalState === 'tight') warningItems.push('Sắp thiếu vốn 30 ngày')
    if (String(labor.warning_state || '') === 'missing') warningItems.push('Thiếu tiền trả công')
    else if (String(labor.warning_state || '') === 'tight') warningItems.push('Sắp thiếu tiền trả công')

    const upcomingMilestone = (project.milestones || []).find((m: any) => String(m.status_key || '').toLowerCase() !== 'completed') || null
    const completedMilestone = (project.milestones || []).find((m: any) => String(m.status_key || '').toLowerCase() === 'completed') || null

    return {
      id: project.id,
      project_name: project.project_name || null,
      status: project.status || null,
      house_type: project.house_type || null,
      floors: project.floors ?? null,
      floor_area: toNumber(project.floor_area),
      contract_value: toNumber(project.contract_value),
      budget_current: toNumber(project.budget_current),
      cost_actual: toNumber(project.cost_actual),
      cost_committed: toNumber(project.cost_committed),
      progress_planned_percent: project.progress_planned_percent != null ? Number(project.progress_planned_percent) : null,
      progress_actual_percent: project.progress_actual_percent != null ? Number(project.progress_actual_percent) : null,
      delay_days: project.delay_days != null ? Number(project.delay_days) : null,
      risk_level: project.risk_level || null,
      expected_end_date: project.expected_end_date || null,
      customer: project.customer
        ? {
            id: project.customer.id,
            full_name: project.customer.full_name,
            phone_number: project.customer.phone_number,
          }
        : null,
      latest_diary_at: latestDiary?.entry_date || null,
      latest_diary_title: latestDiary?.title || null,
      latest_progress_total: latestDiary?.progress_percent_total != null ? Number(latestDiary.progress_percent_total) : null,
      diary_recent_ok: hasRecentDiary,
      progress_stalled: progressStalled,
      repeated_quality_blocked: repeatedQualityBlocked,
      repeated_safety_incident: repeatedSafetyIncident,
      capital_state: capitalState,
      cashflow_warning_level: latestSnapshot?.warning_level || null,
      gap_30d: latestSnapshot?.gap_30d != null ? Number(latestSnapshot.gap_30d) : null,
      demand_30d: latestSnapshot?.demand_30d != null ? Number(latestSnapshot.demand_30d) : null,
      supply_30d: latestSnapshot?.supply_30d != null ? Number(latestSnapshot.supply_30d) : null,
      labor_finance_summary: labor,
      asset_count: Array.isArray(project.assets) ? project.assets.length : 0,
      warning_count: warningItems.length,
      warning_items: warningItems,
      upcoming_milestone: upcomingMilestone
        ? {
            milestone_name: upcomingMilestone.milestone_name,
            due_date: upcomingMilestone.due_date,
            status_key: upcomingMilestone.status_key,
          }
        : null,
      completed_milestone: completedMilestone
        ? {
            milestone_name: completedMilestone.milestone_name,
            completed_at: completedMilestone.completed_at,
          }
        : null,
    }
  })

  const filteredItems = items.filter((item) => {
    if (capitalStateFilter && item.capital_state !== capitalStateFilter) return false
    if (issueOnly && item.warning_count <= 0) return false
    return true
  })

  const summary = {
    total_projects: filteredItems.length,
    in_progress_count: filteredItems.filter((x) => x.status === 'in_progress').length,
    completed_count: filteredItems.filter((x) => x.status === 'completed').length,
    paused_count: filteredItems.filter((x) => x.status === 'paused').length,
    contract_total: filteredItems.reduce((sum, x) => sum + Number(x.contract_value || 0), 0),
    budget_current_total: filteredItems.reduce((sum, x) => sum + Number(x.budget_current || 0), 0),
    cost_actual_total: filteredItems.reduce((sum, x) => sum + Number(x.cost_actual || 0), 0),
    warning_projects_count: filteredItems.filter((x) => x.warning_count > 0).length,
    delay_projects_count: filteredItems.filter((x) => Number(x.delay_days || 0) > 0).length,
    capital_missing_count: filteredItems.filter((x) => x.capital_state === 'missing').length,
    capital_tight_count: filteredItems.filter((x) => x.capital_state === 'tight').length,
    diary_missing_count: filteredItems.filter((x) => !x.diary_recent_ok).length,
    labor_missing_count: filteredItems.filter((x) => String(x.labor_finance_summary?.warning_state || '') === 'missing').length,
  }

  const byStatusMap = new Map<string, { status: string; count: number; contract_value: number }>()
  for (const item of filteredItems) {
    const key = String(item.status || '')
    const current = byStatusMap.get(key) || { status: key, count: 0, contract_value: 0 }
    current.count += 1
    current.contract_value += Number(item.contract_value || 0)
    byStatusMap.set(key, current)
  }

  const byRiskMap = new Map<string, { risk_level: string; count: number }>()
  for (const item of filteredItems) {
    const key = String(item.risk_level || 'none')
    const current = byRiskMap.get(key) || { risk_level: key, count: 0 }
    current.count += 1
    byRiskMap.set(key, current)
  }

  const topWarningProjects = [...filteredItems]
    .filter((x) => x.warning_count > 0)
    .sort((a, b) => {
      if (b.warning_count === a.warning_count) return Number(b.delay_days || 0) - Number(a.delay_days || 0)
      return b.warning_count - a.warning_count
    })
    .slice(0, 10)

  const topCapitalGapProjects = [...filteredItems]
    .filter((x) => Number(x.gap_30d || 0) < 0)
    .sort((a, b) => Number(a.gap_30d || 0) - Number(b.gap_30d || 0))
    .slice(0, 10)

  return NextResponse.json(safeJson({
    data: filteredItems,
    summary,
    breakdown: {
      by_status: Array.from(byStatusMap.values()),
      by_risk_level: Array.from(byRiskMap.values()),
      top_warning_projects: topWarningProjects,
      top_capital_gap_projects: topCapitalGapProjects,
    },
  }))
}
