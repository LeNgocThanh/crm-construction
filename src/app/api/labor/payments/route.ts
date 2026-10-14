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

async function validateBatchLinkedPayment(input: {
  projectId: string
  batchId: string | null
  workerId: string | null
  engagementId: string | null
  amount: bigint
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
    return { ok: false as const, error: 'Chi duoc them dong thanh toan khi dot dang o trang thai nhap' }
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

  return {
    ok: true as const,
    paymentType: String(batch.payment_type || 'payment'),
    workerId: resolvedWorkerId,
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
      worker_code: true,
      full_name: true,
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
  paymentDate: Date
  amount: bigint
  currentPaymentId?: string | null
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
    const balances = await getLaborWorkerBalanceSummary({
      projectId: input.projectId,
      workerId: worker.id,
      workerCategory: 'company',
      to: input.paymentDate,
    })
    const balance = balances[0]
    const outstanding = Number(balance?.outstanding_amount || 0)
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

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error

  const sp = new URL(req.url).searchParams
  const projectId = String(sp.get('project_id') || '').trim()
  const workerId = String(sp.get('worker_id') || '').trim()
  const batchId = String(sp.get('batch_id') || '').trim()
  const from = String(sp.get('from') || '').trim()
  const to = String(sp.get('to') || '').trim()
  const paymentType = String(sp.get('payment_type') || '').trim()
  const where: any = { is_active: true }
  if (projectId) where.project_id = projectId
  if (workerId) where.worker_id = workerId
  if (batchId) where.batch_id = batchId
  if (paymentType) where.payment_type = paymentType
  if (from || to) {
    where.payment_date = {}
    if (from) where.payment_date.gte = new Date(from)
    if (to) where.payment_date.lte = new Date(to)
  }

  const paymentModel = (db as any).projectLaborPayment
  const data = paymentModel
    ? await paymentModel.findMany({
        where,
        include: {
          project: { select: { id: true, project_name: true } },
          batch: { select: { id: true, batch_code: true, batch_name: true, status: true, payment_type: true } },
          worker: { select: { id: true, worker_code: true, full_name: true } },
          crew: { select: { id: true, crew_key: true, crew_name: true } },
          engagement: { select: { id: true, engagement_type: true, status: true } },
          creator: { select: { id: true, username: true } },
        },
        orderBy: [{ payment_date: 'desc' }, { created_at: 'desc' }],
      })
    : []

  return NextResponse.json({ data: data.map(serialize) })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr

  const paymentModel = (db as any).projectLaborPayment
  if (!paymentModel) {
    return NextResponse.json({ error: 'He thong chua cap nhat model thanh toan nhan cong' }, { status: 500 })
  }

  const body = await req.json()
  const projectId = String(body?.project_id || '').trim()
  const batchId = parseOptionalString(body?.batch_id)
  const workerId = parseOptionalString(body?.worker_id)
  const engagementId = parseOptionalString(body?.engagement_id)
  const paymentDate = body?.payment_date ? new Date(body.payment_date) : null
  const amount = parseOptionalBigInt(body?.amount)

  if (!projectId || !paymentDate || amount == null || amount <= 0) {
    return NextResponse.json({ error: 'Thieu du an, ngay thanh toan hoac so tien khong hop le' }, { status: 400 })
  }

  const batchValidation = await validateBatchLinkedPayment({
    projectId,
    batchId,
    workerId,
    engagementId,
    amount,
  })
  if (!batchValidation.ok) {
    return NextResponse.json({ error: batchValidation.error }, { status: 400 })
  }

  const effectivePaymentType = batchValidation.paymentType || parseOptionalString(body?.payment_type) || 'payment'
  const paymentTypeValidation = await validatePaymentTypeRules({
    projectId,
    workerId: batchValidation.workerId ?? workerId,
    engagementId,
    paymentType: effectivePaymentType,
    paymentDate,
    amount,
  })
  if (!paymentTypeValidation.ok) {
    return NextResponse.json({ error: paymentTypeValidation.error }, { status: 400 })
  }

  const data = await paymentModel.create({
    data: {
      project_id: projectId,
      batch_id: batchId,
      engagement_id: engagementId,
      worker_id: paymentTypeValidation.workerId ?? batchValidation.workerId ?? workerId,
      crew_id: parseOptionalString(body?.crew_id),
      payment_date: paymentDate,
      payment_type: effectivePaymentType,
      amount,
      note: parseOptionalString(body?.note),
      created_by: auth.session.user.id,
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

  return NextResponse.json(jsonSafe({ data: serialize(data) }), { status: 201 })
}
