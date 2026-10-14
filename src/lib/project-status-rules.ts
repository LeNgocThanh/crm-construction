import { db } from '@/lib/db'
import { isCustomerReadyForProjectConfirm } from '@/lib/customer-status'

type Input = {
  projectId: string
  customerId: string
  fromStatus: string
  toStatus: string
  startDate?: Date | null
  reason?: string | null
}

export async function evaluateProjectStatusTransition(input: Input) {
  const rules = await (db as any).projectStatusTransitionRule.findMany({
    where: {
      is_active: true,
      from_status_key: input.fromStatus,
      to_status_key: input.toStatus,
    },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  })

  const warnings: string[] = []
  const blockingErrors: string[] = []

  for (const rule of rules) {
    const mode = String(rule.rule_mode || 'warning')
    const checkType = String(rule.check_type || '')
    const msg = String(rule.message || 'Rule vi pham')

    let passed = true

    if (checkType === 'require_customer_confirm_ready') {
      const c = await db.customer.findUnique({ where: { id: input.customerId }, select: { status: true } })
      passed = isCustomerReadyForProjectConfirm(c?.status)
    } else if (checkType === 'require_start_date') {
      passed = !!input.startDate
    } else if (checkType === 'require_reason') {
      passed = !!String(input.reason || '').trim()
    }

    if (!passed) {
      if (mode === 'block') blockingErrors.push(msg)
      else warnings.push(msg)
    }
  }

  return { warnings, blockingErrors, appliedRules: rules.map((x: any) => x.rule_code) }
}
