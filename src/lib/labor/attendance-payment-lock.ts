import { db } from '@/lib/db'

export type AttendancePaymentLockInfo = {
  payment_locked: boolean
  payment_lock_reason: string | null
  payment_lock_batch: {
    id: string
    batch_code: string | null
    batch_name: string | null
    status: string | null
    paid_amount: string | null
  } | null
}

function emptyLockInfo(): AttendancePaymentLockInfo {
  return {
    payment_locked: false,
    payment_lock_reason: null,
    payment_lock_batch: null,
  }
}

function buildLockInfo(input: {
  batchId: string
  batchCode?: string | null
  batchName?: string | null
  batchStatus?: string | null
  paidAmount?: number
  mode: 'paid' | 'partial'
}): AttendancePaymentLockInfo {
  const batchLabel = input.batchName || input.batchCode || 'đợt thanh toán'
  const paidAmount = Math.max(0, Number(input.paidAmount || 0))
  return {
    payment_locked: true,
    payment_lock_reason:
      input.mode === 'paid'
        ? `Chấm công này nằm trong đợt đã chi: ${batchLabel}`
        : `Chấm công này đã phát sinh thanh toán trong đợt: ${batchLabel}`,
    payment_lock_batch: {
      id: input.batchId,
      batch_code: input.batchCode || null,
      batch_name: input.batchName || null,
      status: input.batchStatus || null,
      paid_amount: paidAmount > 0 ? String(Math.round(paidAmount)) : null,
    },
  }
}

export async function getAttendancePaymentLockMap(attendanceIds: string[]) {
  const ids = Array.from(new Set(attendanceIds.map((x) => String(x || '').trim()).filter(Boolean)))
  const result = new Map<string, AttendancePaymentLockInfo>()
  for (const id of ids) result.set(id, emptyLockInfo())
  if (!ids.length) return result

  const linkModel = (db as any).projectLaborPaymentBatchAttendance
  if (!linkModel) return result

  const links = await linkModel.findMany({
    where: { attendance_id: { in: ids } },
    include: {
      attendance: {
        select: {
          id: true,
          worker_id: true,
        },
      },
      batch: {
        select: {
          id: true,
          batch_code: true,
          batch_name: true,
          status: true,
          payments: {
            where: { is_active: true },
            select: {
              id: true,
              worker_id: true,
              amount: true,
            },
          },
        },
      },
    },
  })

  for (const link of links) {
    const attendanceId = String(link?.attendance?.id || '').trim()
    if (!attendanceId) continue

    const workerId = String(link?.attendance?.worker_id || '').trim()
    const batch = link?.batch
    if (!batch) continue

    const batchStatus = String(batch.status || '').trim()
    const relevantPayments = Array.isArray(batch.payments)
      ? batch.payments.filter((payment: any) => {
          const paymentWorkerId = String(payment?.worker_id || '').trim()
          if (!workerId) return true
          return !paymentWorkerId || paymentWorkerId === workerId
        })
      : []

    const paidAmount = relevantPayments.reduce((sum: number, payment: any) => sum + Number(payment?.amount || 0), 0)
    const hasPaymentActivity = relevantPayments.length > 0 && paidAmount > 0
    const isPaidBatch = batchStatus === 'paid'

    if (!hasPaymentActivity && !isPaidBatch) continue

    const current = result.get(attendanceId) || emptyLockInfo()
    if (current.payment_locked && current.payment_lock_batch?.status === 'paid') continue

    result.set(
      attendanceId,
      buildLockInfo({
        batchId: String(batch.id || ''),
        batchCode: batch.batch_code,
        batchName: batch.batch_name,
        batchStatus: batch.status,
        paidAmount,
        mode: isPaidBatch ? 'paid' : 'partial',
      }),
    )
  }

  return result
}

export async function getLockedDiaryAttendances(projectId: string, diaryEntryId: string) {
  const attendanceRows = await (db as any).projectLaborAttendance.findMany({
    where: {
      project_id: projectId,
      diary_entry_id: diaryEntryId,
    },
    select: {
      id: true,
      worker_id: true,
      worker: { select: { full_name: true, worker_code: true } },
    },
  })
  const lockMap = await getAttendancePaymentLockMap(attendanceRows.map((x: any) => String(x.id || '')))
  return attendanceRows
    .map((row: any) => ({
      ...row,
      ...lockMap.get(String(row.id || '')),
    }))
    .filter((row: any) => row.payment_locked)
}
