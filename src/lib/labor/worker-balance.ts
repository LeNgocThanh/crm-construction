import { db } from '@/lib/db'

type BalanceFilter = {
  projectId?: string | null
  workerId?: string | null
  from?: Date | null
  to?: Date | null
  workerCategory?: string | null
}

export type LaborWorkerBalanceRow = {
  worker_id: string
  worker_code: string | null
  full_name: string
  worker_category: string | null
  attendance_amount: number
  advance_amount: number
  payment_amount: number
  settlement_amount: number
  paid_total: number
  outstanding_amount: number
  overpaid_amount: number
  partial_batch_names: string[]
}

function safeDateFilter(field: string, from?: Date | null, to?: Date | null) {
  if (!from && !to) return undefined
  const where: any = {}
  if (from) where.gte = from
  if (to) where.lte = to
  return { [field]: where }
}

function roundMoney(value: number) {
  return Math.round(Number(value || 0))
}

function allocateAmount(totalAmount: number, parts: Array<{ worker_id: string; weight: number }>) {
  const positiveParts = parts.filter((part) => part.worker_id && part.weight > 0)
  if (!positiveParts.length || totalAmount <= 0) return [] as Array<{ worker_id: string; amount: number }>
  const totalWeight = positiveParts.reduce((sum, part) => sum + part.weight, 0)
  if (totalWeight <= 0) return []

  let remaining = roundMoney(totalAmount)
  return positiveParts.map((part, index) => {
    const amount =
      index === positiveParts.length - 1
        ? remaining
        : Math.min(remaining, Math.round((totalAmount * part.weight) / totalWeight))
    remaining -= amount
    return {
      worker_id: part.worker_id,
      amount,
    }
  })
}

export async function getLaborWorkerBalanceSummary(filter: BalanceFilter = {}) {
  const paymentModel = (db as any).projectLaborPayment
  const attendanceModel = (db as any).projectLaborAttendance
  if (!paymentModel || !attendanceModel) return [] as LaborWorkerBalanceRow[]

  const workerWhere: any = {}
  if (filter.workerId) workerWhere.id = filter.workerId
  if (filter.workerCategory) workerWhere.worker_category = filter.workerCategory

  const workers = await (db as any).laborWorker.findMany({
    where: workerWhere,
    select: {
      id: true,
      worker_code: true,
      full_name: true,
      worker_category: true,
    },
    orderBy: [{ full_name: 'asc' }],
  })

  const workerIds = workers.map((row: any) => String(row.id || '')).filter(Boolean)
  if (!workerIds.length) return []

  const attendanceWhere: any = {
    worker_id: { in: workerIds },
    attendance_status: 'confirmed',
  }
  if (filter.projectId) attendanceWhere.project_id = filter.projectId
  Object.assign(attendanceWhere, safeDateFilter('attendance_date', filter.from, filter.to))

  const paymentWhere: any = {
    is_active: true,
    OR: [
      { batch_id: null },
      { batch: { status: { not: 'cancelled' } } },
    ],
  }
  if (filter.projectId) paymentWhere.project_id = filter.projectId
  Object.assign(paymentWhere, safeDateFilter('payment_date', filter.from, filter.to))

  const [attendances, payments] = await Promise.all([
    attendanceModel.findMany({
      where: attendanceWhere,
      select: {
        worker_id: true,
        amount: true,
      },
    }),
    paymentModel.findMany({
      where: paymentWhere,
      include: {
        worker: {
          select: {
            id: true,
            worker_category: true,
          },
        },
        batch: {
          select: {
            attendance_links: {
              include: {
                attendance: {
                  select: {
                    worker_id: true,
                    amount: true,
                    worker: {
                      select: {
                        id: true,
                        worker_category: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ])

  const map = new Map<string, LaborWorkerBalanceRow>()
  for (const worker of workers) {
    map.set(String(worker.id), {
      worker_id: String(worker.id),
      worker_code: worker.worker_code || null,
      full_name: worker.full_name || '-',
      worker_category: worker.worker_category || null,
      attendance_amount: 0,
      advance_amount: 0,
      payment_amount: 0,
      settlement_amount: 0,
      paid_total: 0,
      outstanding_amount: 0,
      overpaid_amount: 0,
      partial_batch_names: [],
    })
  }

  const batchStatsMap = new Map<string, { batch_name: string; attendance_amount: number; paid_amount: number }>()

  for (const row of attendances || []) {
    const key = String(row?.worker_id || '')
    const current = map.get(key)
    if (!current) continue
    current.attendance_amount += Number(row?.amount || 0)
  }

  for (const row of payments || []) {
    const paymentType = String(row?.payment_type || 'payment')
    const totalAmount = Number(row?.amount || 0)
    const directWorkerId = String(row?.worker?.id || row?.worker_id || '').trim()
    const batchId = String(row?.batch_id || row?.batch?.id || '').trim()
    const batchName = String(row?.batch?.batch_name || row?.batch?.batch_code || '').trim() || 'Batch'

    const allocations: Array<{ worker_id: string; amount: number }> = []
    const batchAttendanceWeights = new Map<string, number>()
    const links = Array.isArray(row?.batch?.attendance_links) ? row.batch.attendance_links : []
    for (const link of links) {
      const attendanceWorkerId = String(link?.attendance?.worker?.id || link?.attendance?.worker_id || '').trim()
      if (!attendanceWorkerId || !map.has(attendanceWorkerId)) continue
      const currentWeight = batchAttendanceWeights.get(attendanceWorkerId) || 0
      batchAttendanceWeights.set(attendanceWorkerId, currentWeight + Number(link?.attendance?.amount || 0))
    }
    for (const [workerId, attendanceAmount] of batchAttendanceWeights.entries()) {
      const batchKey = `${workerId}__${batchId}`
      const current = batchStatsMap.get(batchKey) || {
        batch_name: batchName,
        attendance_amount: 0,
        paid_amount: 0,
      }
      current.batch_name = batchName
      current.attendance_amount = Number(attendanceAmount || 0)
      batchStatsMap.set(batchKey, current)
    }

    if (directWorkerId) {
      const directWorker = map.get(directWorkerId)
      if (directWorker) {
        allocations.push({
          worker_id: directWorkerId,
          amount: totalAmount,
        })
      }
    } else {
      allocations.push(
        ...allocateAmount(
          totalAmount,
          Array.from(batchAttendanceWeights.entries()).map(([worker_id, weight]) => ({ worker_id, weight }))
        )
      )
    }

    for (const allocation of allocations) {
      const current = map.get(allocation.worker_id)
      if (!current) continue
      const amount = Number(allocation.amount || 0)
      current.paid_total += amount
      if (paymentType === 'advance') current.advance_amount += amount
      else if (paymentType === 'settlement') current.settlement_amount += amount
      else current.payment_amount += amount
      if (batchId) {
        const batchKey = `${allocation.worker_id}__${batchId}`
        const currentBatch = batchStatsMap.get(batchKey) || {
          batch_name: batchName,
          attendance_amount: 0,
          paid_amount: 0,
        }
        currentBatch.batch_name = batchName
        currentBatch.paid_amount += amount
        batchStatsMap.set(batchKey, currentBatch)
      }
    }
  }

  const result = Array.from(map.values()).map((row) => {
    const delta = row.attendance_amount - row.paid_total
    row.outstanding_amount = delta > 0 ? roundMoney(delta) : 0
    row.overpaid_amount = delta < 0 ? roundMoney(Math.abs(delta)) : 0
    row.attendance_amount = roundMoney(row.attendance_amount)
    row.advance_amount = roundMoney(row.advance_amount)
    row.payment_amount = roundMoney(row.payment_amount)
    row.settlement_amount = roundMoney(row.settlement_amount)
    row.paid_total = roundMoney(row.paid_total)
    row.partial_batch_names = Array.from(batchStatsMap.entries())
      .filter(([key, batch]) => key.startsWith(`${row.worker_id}__`) && Number(batch.attendance_amount || 0) > 0 && Number(batch.paid_amount || 0) > 0 && Number(batch.paid_amount || 0) + 0.0001 < Number(batch.attendance_amount || 0))
      .map(([, batch]) => String(batch.batch_name || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'vi'))
    return row
  })

  return result
}
