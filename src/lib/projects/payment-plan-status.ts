import { db } from '@/lib/db'

function toNum(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function syncProjectPaymentPlanStatus(projectId: string, tx?: any) {
  const client = tx || db
  const plans = await client.projectPaymentPlan.findMany({
    where: { project_id: projectId, is_active: true },
    select: { id: true, amount: true, due_date: true, status: true },
  })
  if (!plans.length) return

  const now = Date.now()
  for (const plan of plans) {
    if (plan.status === 'cancelled') continue
    const agg = await client.projectPayment.aggregate({
      where: { project_id: projectId, payment_plan_id: plan.id },
      _sum: { amount: true },
    })
    const paid = toNum(agg?._sum?.amount)
    const target = toNum(plan.amount)
    const overdue = !!plan.due_date && new Date(plan.due_date).getTime() < now

    let nextStatus = 'planned'
    if (target > 0) {
      if (paid >= target) nextStatus = 'paid'
      else if (paid > 0) nextStatus = 'partially_paid'
      else nextStatus = 'planned'
      if (overdue && paid < target) nextStatus = 'overdue'
    } else {
      nextStatus = paid > 0 ? 'paid' : (overdue ? 'overdue' : 'planned')
    }

    if (nextStatus !== plan.status) {
      await client.projectPaymentPlan.update({
        where: { id: plan.id },
        data: { status: nextStatus },
      })
    }
  }
}

