type AnyRow = Record<string, any>

function getTimeValue(value?: string | Date | null) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function uniqueKinds(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

export function deriveActiveMilestone(milestones: AnyRow[]) {
  const rows = Array.isArray(milestones) ? milestones : []
  const inProgress = rows.find((m) => String(m?.status_key || '') === 'in_progress')
  if (inProgress) return inProgress
  const pending = rows.find((m) => String(m?.status_key || '') === 'pending')
  return pending || null
}

export function derivePlanKindsById(resourcePlans: AnyRow[], resourceItems: AnyRow[]) {
  const rows = Array.isArray(resourcePlans) ? resourcePlans : []
  const items = Array.isArray(resourceItems) ? resourceItems : []
  const planIds = new Set(rows.map((x) => String(x?.id || '')).filter(Boolean))
  const result: Record<string, string[]> = {}
  for (const item of items) {
    const planId = String(item?.plan_id || '')
    const kind = String(item?.resource_kind || '')
    if (!planId || !kind || !planIds.has(planId)) continue
    result[planId] = uniqueKinds([...(result[planId] || []), kind])
  }
  for (const row of rows) {
    const planId = String(row?.id || '')
    if (planId && !result[planId]) result[planId] = []
  }
  return result
}

function rankPlanCandidate(plan: AnyRow, activeMilestoneId: string, kind: string) {
  let score = 0
  const status = String(plan?.status || '')
  const executionState = String(plan?.execution_state || '')
  const milestoneId = String(plan?.milestone_id || '')
  const planRole = String(plan?.plan_role || 'primary')
  const kinds = Array.isArray(plan?.plan_kinds) ? plan.plan_kinds.map((x: any) => String(x || '')) : []

  if (kinds.includes(kind)) score += 200
  if (planRole === 'primary') score += 40
  else if (planRole === 'supplement') score += 20
  if (status === 'active') score += 160
  if (executionState === 'locked') score += 140
  else if (executionState === 'started') score += 130
  if (activeMilestoneId && milestoneId === activeMilestoneId) score += 80
  if (status === 'locked') score += 60
  else if (status === 'approved') score += 50
  else if (status === 'reviewing') score += 20
  else if (status === 'draft') score += 10

  return score
}

export function deriveActivePlanByKind(resourcePlans: AnyRow[], kind: string, activeMilestoneId?: string | null) {
  const rows = (Array.isArray(resourcePlans) ? resourcePlans : []).filter((row) => {
    const kinds = Array.isArray(row?.plan_kinds) ? row.plan_kinds.map((x: any) => String(x || '')) : []
    return kinds.includes(kind)
  })
  if (!rows.length) return null

  const sorted = [...rows].sort((a, b) => {
    const scoreDiff = rankPlanCandidate(b, String(activeMilestoneId || ''), kind) - rankPlanCandidate(a, String(activeMilestoneId || ''), kind)
    if (scoreDiff !== 0) return scoreDiff
    return getTimeValue(b?.planned_start_date || b?.created_at) - getTimeValue(a?.planned_start_date || a?.created_at)
  })
  return sorted[0] || null
}

export function deriveSuggestedStage(input: {
  projectStage?: string | null
  activeMilestone?: AnyRow | null
  activeMaterialPlan?: AnyRow | null
  activeLaborPlan?: AnyRow | null
}) {
  return (
    String(input.activeMaterialPlan?.target_stage || input.activeMaterialPlan?.plan_stage || '') ||
    String(input.activeLaborPlan?.target_stage || input.activeLaborPlan?.plan_stage || '') ||
    String(input.projectStage || '') ||
    null
  )
}

export function deriveProjectExecutionAxis(input: {
  projectStatus?: string | null
  projectStage?: string | null
  explicitActiveMaterialPlanId?: string | null
  explicitActiveLaborPlanId?: string | null
  milestones?: AnyRow[]
  resourcePlans?: AnyRow[]
  resourceItems?: AnyRow[]
}) {
  const milestones = Array.isArray(input.milestones) ? input.milestones : []
  const resourcePlans = Array.isArray(input.resourcePlans) ? input.resourcePlans : []
  const resourceItems = Array.isArray(input.resourceItems) ? input.resourceItems : []
  const activeMilestone = deriveActiveMilestone(milestones)
  const planKindsById = derivePlanKindsById(resourcePlans, resourceItems)
  const plansWithKinds = resourcePlans.map((row) => ({
    ...row,
    plan_kinds: planKindsById[String(row?.id || '')] || [],
  }))
  const activeMaterialPlan = plansWithKinds.find((row) => String(row?.id || '') === String(input.explicitActiveMaterialPlanId || ''))
    || deriveActivePlanByKind(plansWithKinds, 'material', activeMilestone?.id || null)
  const activeLaborPlan = plansWithKinds.find((row) => String(row?.id || '') === String(input.explicitActiveLaborPlanId || ''))
    || deriveActivePlanByKind(plansWithKinds, 'labor', activeMilestone?.id || null)
  const suggestedStage = deriveSuggestedStage({
    projectStage: input.projectStage,
    activeMilestone,
    activeMaterialPlan,
    activeLaborPlan,
  })
  const warnings: string[] = []
  const projectStatus = String(input.projectStatus || '')
  if (projectStatus === 'in_progress' && !activeMilestone) warnings.push('Du an dang thi cong nhung chua co moc active')
  if (projectStatus === 'in_progress' && resourceItems.some((x) => String(x?.resource_kind || '') === 'material') && !activeMaterialPlan) {
    warnings.push('Chua xac dinh duoc ke hoach vat tu dang van hanh')
  }
  if (projectStatus === 'in_progress' && resourceItems.some((x) => String(x?.resource_kind || '') === 'labor') && !activeLaborPlan) {
    warnings.push('Chua xac dinh duoc ke hoach nhan cong dang van hanh')
  }

  return {
    project_status: projectStatus || null,
    current_stage: String(input.projectStage || '') || null,
    suggested_stage: suggestedStage,
    active_milestone: activeMilestone,
    active_material_plan: activeMaterialPlan,
    active_labor_plan: activeLaborPlan,
    plan_kinds_by_id: planKindsById,
    warnings,
  }
}

export function getProjectPlanDirectEditGuard(plan: AnyRow | null | undefined, axis: AnyRow | null | undefined) {
  if (!plan) return { can_edit: false, reasons: ['Chua chon ke hoach'] }
  const reasons: string[] = []
  const executionState = String(plan?.execution_state || '')
  const status = String(plan?.status || '')
  const planRole = String(plan?.plan_role || 'primary')
  const kinds = Array.isArray(plan?.plan_kinds) ? plan.plan_kinds.map((x: any) => String(x || '')) : []
  const activeMaterialPlanId = String(axis?.active_material_plan?.id || '')
  const activeLaborPlanId = String(axis?.active_labor_plan?.id || '')

  if (status === 'locked' || executionState === 'locked') {
    reasons.push('Ke hoach da khoa')
  }
  if (executionState === 'started') {
    reasons.push('Ke hoach da co phat sinh thuc te')
  }
  if (kinds.includes('material') && planRole !== 'backup' && activeMaterialPlanId && activeMaterialPlanId !== String(plan?.id || '') && ['approved', 'locked', 'active'].includes(status)) {
    reasons.push('Ke hoach vat tu nay khong phai ban dang van hanh')
  }
  if (kinds.includes('labor') && planRole !== 'backup' && activeLaborPlanId && activeLaborPlanId !== String(plan?.id || '') && ['approved', 'locked', 'active'].includes(status)) {
    reasons.push('Ke hoach nhan cong nay khong phai ban dang van hanh')
  }

  return {
    can_edit: reasons.length === 0,
    reasons,
  }
}
