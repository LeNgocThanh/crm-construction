import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, requireManageRole, parseOptionalBigInt, parseOptionalString } from '@/lib/labor/server'
import { getLaborWorkerBalanceSummary } from '@/lib/labor/worker-balance'

function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? String(v) : v))) as T
}

function serialize(row: any) {
  const safe = jsonSafe(row)
  return {
    ...safe,
    amount: row.amount != null ? String(row.amount) : null,
  }
}

async function resolveWorkerForPayment(input: {
  workerId: string | null
  engagementId: string | null
}) {
  let workerId = String(input.workerId || '').trim()
  if (!workerId && input.engagementId) {
    const engagement = await (db as any).projectLaborEngagement.findUnique({
      where: { id: input.engagementId },
      select: { worker_id: true },
    })
    workerId = String(engagement?.worker_id || '').trim()
  }
  if (!workerId) return null
  const worker = await (db as any).laborWorker.findUnique({
    where: { id: workerId },
    select: {
      id: true,
      worker_category: true,
    },
  })
  return worker || null
}

async function validatePaymentTypeRules(input: {
  projectId: string
  workerId: string | null
  engagementId: string | null
  paymentType: string
  paymentDate: Date | null
  amount: bigint | null
  existingWorkerId?: string | null
  existingAmount?: bigint | null
}) {
  const paymentType = String(input.paymentType || 'payment')
  if (!['advance', 'payment', 'settlement'].includes(paymentType)) {
    return { ok: false as const, error: 'Loai thanh toan khong hop le' }
  }
  if (paymentType === 'payment') return { ok: true as const, workerId: input.workerId || null }

  const worker = await resolveWorkerForPayment({
    workerId: input.workerId,
    engagementId: input.engagementId,
  })
  if (!worker?.id) {
    return { ok: false as const, error: 'Tam ung va quyet toan bat buoc phai chon nhan cong cu the' }
  }
  if (String(worker.worker_category || '') !== 'company') {
    return { ok: false as const, error: 'Tam ung va quyet toan chi ap dung cho nhan cong cong ty' }
  }

  if (paymentType === 'settlement') {
    if (!input.paymentDate || input.amount == null) {
      return { ok: false as const, error: 'Quyet toan can co ngay thanh toan va so tien hop le' }
    }
    const balances = await getLaborWorkerBalanceSummary({
      projectId: input.projectId,
      workerId: worker.id,
      workerCategory: 'company',
      to: input.paymentDate,
    })
    const balance = balances[0]
    const currentAmountAdjustment = String(input.existingWorkerId || '') === String(worker.id || '')
      ? Number(input.existingAmount || 0)
      : 0
    const outstanding = Number(balance?.outstanding_amount || 0) + currentAmountAdjustment
    if (outstanding <= 0) {
      return { ok: false as const, error: 'Nhan cong nay hien khong con cong no de tat toan' }
    }
    if (Number(input.amount || 0) > outstanding) {
      return {
        ok: false as const,
        error: `So tien tat toan vuot qua cong no con lai (${outstanding.toLocaleString('vi-VN')} vnd)`,
      }
    }
  }

  return { ok: true as const, workerId: worker.id }
}

async function validateBatchLinkedPayment(input: {
  projectId: string
  batchId: string | null
  workerId: string | null
  engagementId: string | null
  amount: bigint | null
  currentPaymentId?: string | null
}) {
  if (!input.batchId) return { ok: true as const, paymentType: null as string | null }

  const batch = await (db as any).projectLaborPaymentBatch?.findUnique({
    where: { id: input.batchId },
    include: {
      attendance_links: {
        include: {
          attendance: {
            select: {
              id: true,
              worker_id: true,
              amount: true,
            },
          },
        },
      },
      payments: {
        where: { is_active: true },
        select: { id: true, worker_id: true, amount: true },
      },
    },
  })
  if (!batch) {
    return { ok: false as const, error: 'Khong tim thay dot thanh toan' }
  }
  if (String(batch.project_id || '') !== input.projectId) {
    return { ok: false as const, error: 'Dot thanh toan khong thuoc du an da chon' }
  }
  if (String(batch.status || '') !== 'draft') {
    return { ok: false as const, error: 'Chi duoc sua dong thanh toan khi dot dang o trang thai nhap' }
  }

  const linkedAttendances = Array.isArray(batch.attendance_links)
    ? batch.attendance_links.map((x: any) => x.attendance).filter(Boolean)
    : []
  if (!linkedAttendances.length) {
    return { ok: true as const, paymentType: String(batch.payment_type || 'payment') }
  }

  let resolvedWorkerId = String(input.workerId || '').trim()
  if (!resolvedWorkerId && input.engagementId) {
    const engagement = await (db as any).projectLaborEngagement.findUnique({
      where: { id: input.engagementId },
      select: { worker_id: true },
    })
    resolvedWorkerId = String(engagement?.worker_id || '').trim()
  }

  const validWorkerIds = Array.from(new Set(linkedAttendances.map((x: any) => String(x?.worker_id || '').trim()).filter(Boolean)))
  if (!resolvedWorkerId && validWorkerIds.length === 1) {
    resolvedWorkerId = validWorkerIds[0]
  }
  if (!resolvedWorkerId) {
    return { ok: false as const, error: 'Dot da gan cham cong, can chon dung nhan cong thuoc dot' }
  }
  if (!validWorkerIds.includes(resolvedWorkerId)) {
    return { ok: false as const, error: 'Nhan cong nay khong nam trong danh sach cham cong da gan vao dot' }
  }

  if (input.amount != null) {
    const totalAttendanceAmount = linkedAttendances
      .filter((x: any) => String(x?.worker_id || '').trim() === resolvedWorkerId)
      .reduce((sum: number, x: any) => sum + Number(x?.amount || 0), 0)

    const existingPaidAmount = (Array.isArray(batch.payments) ? batch.payments : [])
      .filter((x: any) => String(x?.worker_id || '').trim() === resolvedWorkerId && String(x?.id || '') !== String(input.currentPaymentId || ''))
      .reduce((sum: number, x: any) => sum + Number(x?.amount || 0), 0)

    const nextAmount = Number(input.amount || 0)
    const remainingAmount = Math.max(0, totalAttendanceAmount - existingPaidAmount)
    if (nextAmount > remainingAmount) {
      return {
        ok: false as const,
        error: `So tien vuot qua cong no con lai cua nhan cong trong dot (${remainingAmount.toLocaleString('vi-VN')} vnd)`,
      }
    }
  }

  return {
    ok: true as const,
    paymentType: String(batch.payment_type || 'payment'),
    workerId: resolvedWorkerId,
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr

  const paymentModel = (db as any).projectLaborPayment
  if (!paymentModel) {
    return NextResponse.json({ error: 'He thong chua cap nhat model thanh toan nhan cong' }, { status: 500 })
  }

  const current = await paymentModel.findUnique({
    where: { id: params.id },
    include: { batch: { select: { id: true, status: true, project_id: true } } },
  })
  if (!current) {
    return NextResponse.json({ error: 'Khong tim thay dong thanh toan cong' }, { status: 404 })
  }
  if (current.batch && String(current.batch?.status || '') !== 'draft') {
    return NextResponse.json({ error: 'Dot thanh toan da duyet/da chi/da huy, khong the sua dong chi tiet' }, { status: 400 })
  }

  const body = await req.json()
  const nextBatchId = body?.batch_id !== undefined ? parseOptionalString(body.batch_id) : current.batch?.id || null
  const nextProjectId = String(body?.project_id || current.batch?.project_id || current.project_id || '').trim()
  const nextWorkerId = body?.worker_id !== undefined ? parseOptionalString(body.worker_id) : current.worker_id
  const nextEngagementId = body?.engagement_id !== undefined ? parseOptionalString(body.engagement_id) : current.engagement_id
  const nextAmount = body?.amount !== undefined ? parseOptionalBigInt(body.amount) : current.amount
  const nextPaymentDate = body?.payment_date !== undefined ? (body.payment_date ? new Date(body.payment_date) : null) : current.payment_date
  const requestedPaymentType = body?.payment_type !== undefined ? (parseOptionalString(body.payment_type) || 'payment') : (current.payment_type || 'payment')
  const batchValidation = await validateBatchLinkedPayment({
    projectId: nextProjectId,
    batchId: nextBatchId,
    workerId: nextWorkerId,
    engagementId: nextEngagementId,
    amount: nextAmount,
    currentPaymentId: current.id,
  })
  if (!batchValidation.ok) {
    return NextResponse.json({ error: batchValidation.error }, { status: 400 })
  }
  const effectivePaymentType = batchValidation.paymentType || requestedPaymentType
  const paymentTypeValidation = await validatePaymentTypeRules({
    projectId: nextProjectId,
    workerId: batchValidation.workerId ?? nextWorkerId,
    engagementId: nextEngagementId,
    paymentType: effectivePaymentType,
    paymentDate: nextPaymentDate,
    amount: nextAmount,
    existingWorkerId: current.worker_id,
    existingAmount: current.amount,
  })
  if (!paymentTypeValidation.ok) {
    return NextResponse.json({ error: paymentTypeValidation.error }, { status: 400 })
  }
  const data = await paymentModel.update({
    where: { id: params.id },
    data: {
      batch_id: body?.batch_id !== undefined ? parseOptionalString(body.batch_id) : undefined,
      engagement_id: body?.engagement_id !== undefined ? nextEngagementId : undefined,
      worker_id:
        body?.worker_id !== undefined || body?.engagement_id !== undefined || body?.payment_type !== undefined
          ? (paymentTypeValidation.workerId ?? batchValidation.workerId ?? nextWorkerId)
          : undefined,
      crew_id: body?.crew_id !== undefined ? parseOptionalString(body.crew_id) : undefined,
      payment_date: body?.payment_date !== undefined ? nextPaymentDate : undefined,
      payment_type: body?.payment_type !== undefined || body?.batch_id !== undefined ? effectivePaymentType : undefined,
      amount: body?.amount !== undefined ? parseOptionalBigInt(body.amount) : undefined,
      note: body?.note !== undefined ? parseOptionalString(body.note) : undefined,
      is_active: body?.is_active !== undefined ? !!body.is_active : undefined,
    },
    include: {
      project: { select: { id: true, project_name: true } },
      batch: { select: { id: true, batch_code: true, batch_name: true, status: true, payment_type: true } },
      worker: { select: { id: true, worker_code: true, full_name: true } },
      crew: { select: { id: true, crew_key: true, crew_name: true } },
      engagement: { select: { id: true, engagement_type: true, status: true } },
      creator: { select: { id: true, username: true } },
    },
  })
  return NextResponse.json(jsonSafe({ data: serialize(data) }))
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr

  const paymentModel = (db as any).projectLaborPayment
  if (!paymentModel) {
    return NextResponse.json({ error: 'He thong chua cap nhat model thanh toan nhan cong' }, { status: 500 })
  }

  const current = await paymentModel.findUnique({
    where: { id: params.id },
    include: { batch: { select: { status: true } } },
  })
  if (!current) {
    return NextResponse.json({ error: 'Khong tim thay dong thanh toan cong' }, { status: 404 })
  }
  if (current.batch && String(current.batch?.status || '') !== 'draft') {
    return NextResponse.json({ error: 'Dot thanh toan da duyet/da chi/da huy, khong the xoa dong chi tiet' }, { status: 400 })
  }

  await paymentModel.update({
    where: { id: params.id },
    data: { is_active: false },
  })
  return NextResponse.json({ ok: true })
}
