export type ResourcePlanExecutionState = 'not_started' | 'started' | 'locked'

export function getResourcePlanExecutionState(input: {
  status?: string | null
  inventory_posted_count?: number | null
  direct_purchase_confirmed_count?: number | null
  labor_attendance_confirmed_count?: number | null
  labor_payment_count?: number | null
}) : ResourcePlanExecutionState {
  const status = String(input.status || '')
  if (status === 'locked') return 'locked'
  const posted = Number(input.inventory_posted_count || 0)
  const direct = Number(input.direct_purchase_confirmed_count || 0)
  const attendance = Number(input.labor_attendance_confirmed_count || 0)
  const payments = Number(input.labor_payment_count || 0)
  if (posted > 0 || direct > 0 || attendance > 0 || payments > 0) return 'started'
  return 'not_started'
}
