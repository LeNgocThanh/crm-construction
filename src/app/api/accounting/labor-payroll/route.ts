import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { getLaborWorkerBalanceSummary } from '@/lib/labor/worker-balance'

function parseDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getMonthRange(monthText: string | null) {
  const value = String(monthText || '').trim()
  if (!/^\d{4}-\d{2}$/.test(value)) return { from: null as Date | null, to: null as Date | null }
  const [year, month] = value.split('-').map((x) => Number(x))
  const from = new Date(year, month - 1, 1)
  const to = new Date(year, month, 0, 23, 59, 59, 999)
  return { from, to }
}

function inDateRange(dateValue: Date | string | null | undefined, from: Date | null, to: Date | null) {
  if (!dateValue) return false
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return false
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

function roundMoney(value: number) {
  return Math.round(Number(value || 0))
}

function makeWorkerSeed(input: {
  worker_id: string
  worker_name?: string | null
  worker_code?: string | null
  worker_category?: string | null
}) {
  return {
    worker_id: input.worker_id,
    worker_name: input.worker_name || '-',
    worker_code: input.worker_code || '',
    worker_category: input.worker_category || null,
    project_names: new Set<string>(),
    attendance_count: 0,
    work_qty: 0,
    attendance_amount: 0,
    advance_amount: 0,
    payment_amount: 0,
    settlement_amount: 0,
    paid_total_period: 0,
    outstanding_amount: 0,
    overpaid_amount: 0,
    partial_batch_names: [] as string[],
    daily_rows: [] as any[],
  }
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

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.laborRead)
  if (auth.error || !auth.ctx) return auth.error

  const sp = new URL(req.url).searchParams
  const projectId = String(sp.get('project_id') || '').trim()
  const workerCategory = String(sp.get('worker_category') || '').trim()
  const month = String(sp.get('month') || '').trim()
  let from = parseDate(sp.get('from'))
  let to = parseDate(sp.get('to'))
  if (!from && !to && month) {
    const range = getMonthRange(month)
    from = range.from
    to = range.to
  }

  const attendanceWhere: any = {
    attendance_status: 'confirmed',
  }
  if (projectId) attendanceWhere.project_id = projectId
  if (from || to) {
    attendanceWhere.attendance_date = {}
    if (from) attendanceWhere.attendance_date.gte = from
    if (to) attendanceWhere.attendance_date.lte = to
  }
  if (workerCategory) {
    attendanceWhere.worker = {
      worker_category: workerCategory,
    }
  }

  const paymentWhere: any = {
    is_active: true,
    OR: [
      { batch_id: null },
      { batch: { status: { not: 'cancelled' } } },
    ],
  }
  if (projectId) paymentWhere.project_id = projectId
  if (from || to) {
    paymentWhere.payment_date = {}
    if (from) paymentWhere.payment_date.gte = from
    if (to) paymentWhere.payment_date.lte = to
  }

  const [attendances, payments, balances, project] = await Promise.all([
    (db as any).projectLaborAttendance.findMany({
      where: attendanceWhere,
      include: {
        project: { select: { id: true, project_name: true } },
        worker: { select: { id: true, worker_code: true, full_name: true, worker_category: true } },
        diary_entry: { select: { id: true, title: true, entry_date: true, shift_type: true } },
      },
      orderBy: [{ attendance_date: 'desc' }, { created_at: 'desc' }],
    }),
    (db as any).projectLaborPayment.findMany({
      where: paymentWhere,
      include: {
        worker: { select: { id: true, worker_code: true, full_name: true, worker_category: true } },
        batch: {
          select: {
            id: true,
            batch_code: true,
            batch_name: true,
            status: true,
            attendance_links: {
              include: {
                attendance: {
                  select: {
                    id: true,
                    amount: true,
                    worker_id: true,
                    worker: { select: { id: true, worker_code: true, full_name: true, worker_category: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ payment_date: 'desc' }, { created_at: 'desc' }],
    }),
    getLaborWorkerBalanceSummary({
      projectId: projectId || null,
      workerCategory: workerCategory || null,
      to,
    }),
    projectId
      ? db.constructionProject.findUnique({
          where: { id: projectId },
          select: { id: true, project_name: true },
        })
      : Promise.resolve(null),
  ])

  const workerMap = new Map<string, any>()

  for (const row of attendances) {
    const workerId = String(row?.worker?.id || row?.worker_id || '').trim()
    if (!workerId) continue
    const category = String(row?.worker?.worker_category || '').trim()
    if (workerCategory && category !== workerCategory) continue

    const current =
      workerMap.get(workerId) ||
      makeWorkerSeed({
        worker_id: workerId,
        worker_name: row?.worker?.full_name || '-',
        worker_code: row?.worker?.worker_code || '',
        worker_category: category || null,
      })

    current.attendance_count += 1
    current.work_qty += Number(row?.work_qty || 0)
    current.attendance_amount += Number(row?.amount || 0)
    if (row?.project?.project_name) current.project_names.add(String(row.project.project_name))
    current.daily_rows.push({
      attendance_id: row?.id || '',
      attendance_date: row?.attendance_date || null,
      shift_type: row?.shift_type || null,
      work_qty: Number(row?.work_qty || 0),
      amount: Number(row?.amount || 0),
      project_name: row?.project?.project_name || null,
      note: row?.note || null,
      source_type: row?.source_type || null,
      diary_title: row?.diary_entry?.title || null,
    })
    workerMap.set(workerId, current)
  }

  for (const payment of payments) {
    if (!inDateRange(payment?.payment_date, from, to)) continue

    const paymentType = String(payment?.payment_type || 'payment')
    const rawAmount = Number(payment?.amount || 0)
    const allocations: Array<{ worker_id: string; amount: number; worker?: any }> = []

    const directWorkerId = String(payment?.worker?.id || payment?.worker_id || '').trim()
    if (directWorkerId) {
      const category = String(payment?.worker?.worker_category || '').trim()
      if (!workerCategory || category === workerCategory) {
        allocations.push({
          worker_id: directWorkerId,
          amount: rawAmount,
          worker: payment.worker,
        })
      }
    } else {
      const attendanceWeights = new Map<string, { amount: number; worker: any }>()
      const links = Array.isArray(payment?.batch?.attendance_links) ? payment.batch.attendance_links : []
      for (const link of links) {
        const attendanceWorkerId = String(link?.attendance?.worker?.id || link?.attendance?.worker_id || '').trim()
        if (!attendanceWorkerId) continue
        const attendanceWorkerCategory = String(link?.attendance?.worker?.worker_category || '').trim()
        if (workerCategory && attendanceWorkerCategory !== workerCategory) continue
        const current = attendanceWeights.get(attendanceWorkerId) || {
          amount: 0,
          worker: link?.attendance?.worker || null,
        }
        current.amount += Number(link?.attendance?.amount || 0)
        attendanceWeights.set(attendanceWorkerId, current)
      }

      const distributed = allocateAmount(
        rawAmount,
        Array.from(attendanceWeights.entries()).map(([worker_id, row]) => ({
          worker_id,
          weight: Number(row.amount || 0),
        }))
      )

      for (const row of distributed) {
        allocations.push({
          worker_id: row.worker_id,
          amount: row.amount,
          worker: attendanceWeights.get(row.worker_id)?.worker || null,
        })
      }
    }

    for (const allocation of allocations) {
      const current =
        workerMap.get(allocation.worker_id) ||
        makeWorkerSeed({
          worker_id: allocation.worker_id,
          worker_name: allocation.worker?.full_name || '-',
          worker_code: allocation.worker?.worker_code || '',
          worker_category: allocation.worker?.worker_category || null,
        })

      current.paid_total_period += Number(allocation.amount || 0)
      if (paymentType === 'advance') current.advance_amount += Number(allocation.amount || 0)
      else if (paymentType === 'settlement') current.settlement_amount += Number(allocation.amount || 0)
      else current.payment_amount += Number(allocation.amount || 0)
      workerMap.set(allocation.worker_id, current)
    }
  }

  const balanceMap = new Map<string, any>()
  for (const row of balances) {
    balanceMap.set(String(row?.worker_id || ''), row)
    const workerId = String(row?.worker_id || '').trim()
    if (!workerId || workerMap.has(workerId)) continue
    workerMap.set(
      workerId,
      makeWorkerSeed({
        worker_id: workerId,
        worker_name: row?.full_name || '-',
        worker_code: row?.worker_code || '',
        worker_category: row?.worker_category || null,
      })
    )
  }

  const workers = Array.from(workerMap.values())
    .map((row) => {
      const balance = balanceMap.get(row.worker_id)
      return {
        worker_id: row.worker_id,
        worker_name: row.worker_name,
        worker_code: row.worker_code,
        worker_category: row.worker_category || balance?.worker_category || null,
        project_names: Array.from(row.project_names).sort(),
        attendance_count: Math.round(row.attendance_count),
        work_qty: Number(row.work_qty || 0),
        attendance_amount: roundMoney(row.attendance_amount),
        advance_amount: roundMoney(row.advance_amount),
        payment_amount: roundMoney(row.payment_amount),
        settlement_amount: roundMoney(row.settlement_amount),
        paid_total_period: roundMoney(row.paid_total_period),
        outstanding_amount: roundMoney(Number(balance?.outstanding_amount || 0)),
        overpaid_amount: roundMoney(Number(balance?.overpaid_amount || 0)),
        partial_batch_names: Array.isArray(balance?.partial_batch_names) ? balance.partial_batch_names : [],
        outstanding_note:
          Number(balance?.outstanding_amount || 0) > 0 && Array.isArray(balance?.partial_batch_names) && balance.partial_batch_names.length
            ? `Da tra mot phan tu batch "${balance.partial_batch_names.join('", "')}"`
            : null,
        daily_rows: row.daily_rows.sort((a: any, b: any) => String(a.attendance_date || '').localeCompare(String(b.attendance_date || ''))),
      }
    })
    .filter((row) => {
      if (workerCategory && String(row.worker_category || '') !== workerCategory) return false
      return row.attendance_count > 0 || row.paid_total_period > 0 || row.outstanding_amount > 0 || row.overpaid_amount > 0
    })
    .sort((a, b) => a.worker_name.localeCompare(b.worker_name, 'vi'))

  const totals = workers.reduce(
    (acc, row) => {
      acc.worker_count += 1
      acc.attendance_count += Number(row.attendance_count || 0)
      acc.work_qty += Number(row.work_qty || 0)
      acc.attendance_amount += Number(row.attendance_amount || 0)
      acc.advance_amount += Number(row.advance_amount || 0)
      acc.payment_amount += Number(row.payment_amount || 0)
      acc.settlement_amount += Number(row.settlement_amount || 0)
      acc.paid_total_period += Number(row.paid_total_period || 0)
      acc.outstanding_amount += Number(row.outstanding_amount || 0)
      return acc
    },
    {
      worker_count: 0,
      attendance_count: 0,
      work_qty: 0,
      attendance_amount: 0,
      advance_amount: 0,
      payment_amount: 0,
      settlement_amount: 0,
      paid_total_period: 0,
      outstanding_amount: 0,
    }
  )

  return NextResponse.json({
    filters: {
      project_id: projectId || null,
      project_name: project?.project_name || null,
      worker_category: workerCategory || null,
      month: month || null,
      from: from ? from.toISOString() : null,
      to: to ? to.toISOString() : null,
    },
    totals: {
      ...totals,
      attendance_amount: roundMoney(totals.attendance_amount),
      advance_amount: roundMoney(totals.advance_amount),
      payment_amount: roundMoney(totals.payment_amount),
      settlement_amount: roundMoney(totals.settlement_amount),
      paid_total_period: roundMoney(totals.paid_total_period),
      outstanding_amount: roundMoney(totals.outstanding_amount),
    },
    workers,
  })
}
