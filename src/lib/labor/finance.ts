import { db } from '@/lib/db'

export async function getProjectLaborFinanceSummary(projectId: string) {
  const approvedLaborItems = await (db as any).projectResourcePlanItem.findMany({
    where: {
      project_id: projectId,
      is_active: true,
      resource_kind: 'labor',
      plan: {
        is_active: true,
        status: { in: ['approved', 'locked'] },
      },
    },
    select: {
      estimated_cost: true,
      quantity: true,
    },
  })

  const confirmedAttendances = await (db as any).projectLaborAttendance.findMany({
    where: {
      project_id: projectId,
      attendance_status: 'confirmed',
    },
    select: {
      work_qty: true,
      amount: true,
    },
  })

  const activePaymentsModel = (db as any).projectLaborPayment
  const activePayments = activePaymentsModel
    ? await activePaymentsModel.findMany({
        where: {
          project_id: projectId,
          is_active: true,
          OR: [
            { batch_id: null },
            { batch: { status: { not: 'cancelled' } } },
          ],
        },
        select: {
          amount: true,
        },
      })
    : []

  const plannedCost = (approvedLaborItems || []).reduce((sum: number, row: any) => sum + Number(row?.estimated_cost || 0), 0)
  const plannedQty = (approvedLaborItems || []).reduce((sum: number, row: any) => sum + Number(row?.quantity || 0), 0)
  const actualCost = (confirmedAttendances || []).reduce((sum: number, row: any) => sum + Number(row?.amount || 0), 0)
  const actualQty = (confirmedAttendances || []).reduce((sum: number, row: any) => sum + Number(row?.work_qty || 0), 0)
  const paidAmount = (activePayments || []).reduce((sum: number, row: any) => sum + Number(row?.amount || 0), 0)
  const payableAmount = Math.max(0, actualCost - paidAmount)
  const plannedGap = plannedCost - actualCost

  return {
    planned_cost: Math.max(0, Math.round(plannedCost)),
    planned_qty: Number(plannedQty || 0),
    actual_cost: Math.max(0, Math.round(actualCost)),
    actual_qty: Number(actualQty || 0),
    paid_amount: Math.max(0, Math.round(paidAmount)),
    payable_amount: Math.max(0, Math.round(payableAmount)),
    planned_gap_amount: Math.round(plannedGap),
  }
}

export async function getProjectLaborFinanceSummaryMap(projectIds: string[]) {
  const ids = Array.from(new Set(projectIds.filter(Boolean)))
  if (!ids.length) return new Map<string, ReturnType<typeof emptySummary>>()

  const [approvedLaborItems, confirmedAttendances, activePayments] = await Promise.all([
    (db as any).projectResourcePlanItem.findMany({
      where: {
        project_id: { in: ids },
        is_active: true,
        resource_kind: 'labor',
        plan: {
          is_active: true,
          status: { in: ['approved', 'locked'] },
        },
      },
      select: {
        project_id: true,
        estimated_cost: true,
        quantity: true,
      },
    }),
    (db as any).projectLaborAttendance.findMany({
      where: {
        project_id: { in: ids },
        attendance_status: 'confirmed',
      },
      select: {
        project_id: true,
        work_qty: true,
        amount: true,
      },
    }),
    (db as any).projectLaborPayment
      ? (db as any).projectLaborPayment.findMany({
          where: {
            project_id: { in: ids },
            is_active: true,
            OR: [
              { batch_id: null },
              { batch: { status: { not: 'cancelled' } } },
            ],
          },
          select: {
            project_id: true,
            amount: true,
          },
        })
      : [],
  ])

  const map = new Map<string, ReturnType<typeof emptySummary>>()
  for (const id of ids) map.set(id, emptySummary())

  for (const row of approvedLaborItems || []) {
    const key = String(row?.project_id || '')
    const current = map.get(key) || emptySummary()
    current.planned_cost += Number(row?.estimated_cost || 0)
    current.planned_qty += Number(row?.quantity || 0)
    map.set(key, current)
  }
  for (const row of confirmedAttendances || []) {
    const key = String(row?.project_id || '')
    const current = map.get(key) || emptySummary()
    current.actual_cost += Number(row?.amount || 0)
    current.actual_qty += Number(row?.work_qty || 0)
    map.set(key, current)
  }
  for (const row of activePayments || []) {
    const key = String(row?.project_id || '')
    const current = map.get(key) || emptySummary()
    current.paid_amount += Number(row?.amount || 0)
    map.set(key, current)
  }

  for (const [key, current] of map.entries()) {
    current.payable_amount = Math.max(0, current.actual_cost - current.paid_amount)
    current.planned_gap_amount = Math.round(current.planned_cost - current.actual_cost)
    map.set(key, normalizeSummary(current))
  }

  return map
}

function emptySummary() {
  return {
    planned_cost: 0,
    planned_qty: 0,
    actual_cost: 0,
    actual_qty: 0,
    paid_amount: 0,
    payable_amount: 0,
    planned_gap_amount: 0,
  }
}

function normalizeSummary(summary: ReturnType<typeof emptySummary>) {
  return {
    planned_cost: Math.max(0, Math.round(summary.planned_cost)),
    planned_qty: Number(summary.planned_qty || 0),
    actual_cost: Math.max(0, Math.round(summary.actual_cost)),
    actual_qty: Number(summary.actual_qty || 0),
    paid_amount: Math.max(0, Math.round(summary.paid_amount)),
    payable_amount: Math.max(0, Math.round(summary.payable_amount)),
    planned_gap_amount: Math.round(summary.planned_gap_amount),
  }
}
