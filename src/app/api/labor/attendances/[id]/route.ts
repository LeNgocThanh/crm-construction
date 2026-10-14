import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, requireManageRole, parseOptionalBigInt, parseOptionalFloat, parseOptionalString } from '@/lib/labor/server'
import { getAttendancePaymentLockMap } from '@/lib/labor/attendance-payment-lock'

function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? String(v) : v))) as T
}

function serialize(row: any) {
  const safe = jsonSafe(row)
  return {
    ...safe,
    amount: row?.amount != null ? String(row.amount) : null,
  }
}

function getDefaultWorkQtyByShift(shiftType?: string | null) {
  switch (String(shiftType || '')) {
    case 'morning':
    case 'afternoon':
      return 0.5
    case 'night':
    case 'full_day':
      return 1
    default:
      return null
  }
}

async function resolveAttendanceDefaults(input: {
  worker_id?: string | null
  engagement_id?: string | null
  shift_type?: string | null
  work_qty?: number | null
}) {
  const engagementId = String(input.engagement_id || '').trim()
  const workerId = String(input.worker_id || '').trim()
  const workQty = input.work_qty ?? getDefaultWorkQtyByShift(input.shift_type)

  let rateAmount: bigint | null = null

  if (engagementId) {
    const engagement = await (db as any).projectLaborEngagement.findUnique({
      where: { id: engagementId },
      select: {
        rate_amount: true,
        worker_id: true,
        trade: { select: { default_rate: true } },
        worker: { select: { default_rate: true, trade: { select: { default_rate: true } } } },
      },
    })
    if (engagement) {
      rateAmount =
        engagement.rate_amount ??
        engagement.worker?.default_rate ??
        engagement.worker?.trade?.default_rate ??
        engagement.trade?.default_rate ??
        null
    }
  }

  if (rateAmount == null && workerId) {
    const worker = await (db as any).laborWorker.findUnique({
      where: { id: workerId },
      select: {
        default_rate: true,
        trade: { select: { default_rate: true } },
      },
    })
    if (worker) {
      rateAmount = worker.default_rate ?? worker.trade?.default_rate ?? null
    }
  }

  const amount =
    rateAmount != null && workQty != null
      ? BigInt(Math.round(Number(rateAmount) * Number(workQty)))
      : null

  return {
    work_qty: workQty,
    amount,
  }
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr

  const body = await req.json()
  const existing = await (db as any).projectLaborAttendance.findUnique({
    where: { id: ctx.params.id },
    select: {
      id: true,
      worker_id: true,
      engagement_id: true,
      shift_type: true,
      work_qty: true,
      amount: true,
    },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Khong tim thay cham cong' }, { status: 404 })
  }
  const lockInfo = (await getAttendancePaymentLockMap([ctx.params.id])).get(ctx.params.id)
  if (lockInfo?.payment_locked) {
    return NextResponse.json({ error: lockInfo.payment_lock_reason || 'Cham cong da phat sinh thanh toan, khong the sua' }, { status: 409 })
  }

  const nextStatus = body?.attendance_status !== undefined ? parseOptionalString(body.attendance_status) : undefined
  const nextEngagementId = body?.engagement_id !== undefined ? parseOptionalString(body.engagement_id) : existing.engagement_id
  const nextWorkerId = body?.worker_id !== undefined ? parseOptionalString(body.worker_id) : existing.worker_id
  const nextShiftType = body?.shift_type !== undefined ? parseOptionalString(body.shift_type) : existing.shift_type
  const nextWorkQtyInput = body?.work_qty !== undefined ? parseOptionalFloat(body.work_qty) : existing.work_qty
  const explicitAmountProvided = body?.amount !== undefined
  const explicitAmount = explicitAmountProvided ? parseOptionalBigInt(body.amount) : null
  const defaults = await resolveAttendanceDefaults({
    worker_id: nextWorkerId,
    engagement_id: nextEngagementId,
    shift_type: nextShiftType,
    work_qty: nextWorkQtyInput,
  })
  const shouldAutoAmount =
    !explicitAmountProvided &&
    (
      body?.work_qty !== undefined ||
      body?.shift_type !== undefined ||
      body?.worker_id !== undefined ||
      body?.engagement_id !== undefined ||
      nextStatus === 'confirmed' ||
      existing.amount == null
    )

  const data = await (db as any).projectLaborAttendance.update({
    where: { id: ctx.params.id },
    data: {
      engagement_id: body?.engagement_id !== undefined ? nextEngagementId : undefined,
      worker_id: body?.worker_id !== undefined ? nextWorkerId : undefined,
      attendance_date: body?.attendance_date !== undefined ? new Date(body.attendance_date) : undefined,
      shift_type: body?.shift_type !== undefined ? nextShiftType : undefined,
      attendance_status: nextStatus !== undefined ? nextStatus : undefined,
      work_qty: body?.work_qty !== undefined ? (nextWorkQtyInput ?? defaults.work_qty) : undefined,
      amount: explicitAmountProvided ? explicitAmount : (shouldAutoAmount ? defaults.amount : undefined),
      note: body?.note !== undefined ? parseOptionalString(body.note) : undefined,
      confirmed_by: nextStatus === 'confirmed' ? auth.session.user.id : (body?.confirmed_by !== undefined ? parseOptionalString(body.confirmed_by) : undefined),
      confirmed_at: nextStatus === 'confirmed' ? new Date() : (body?.confirmed_at !== undefined ? (body.confirmed_at ? new Date(body.confirmed_at) : null) : undefined),
    },
    include: {
      project: { select: { id: true, project_name: true } },
      worker: { select: { id: true, worker_code: true, full_name: true } },
      diary_entry: { select: { id: true, title: true, entry_date: true, shift_type: true } },
      engagement: { select: { id: true, engagement_type: true, status: true } },
      creator: { select: { id: true, username: true } },
    },
  })
  return NextResponse.json(jsonSafe({ data: serialize(data) }))
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr
  const lockInfo = (await getAttendancePaymentLockMap([ctx.params.id])).get(ctx.params.id)
  if (lockInfo?.payment_locked) {
    return NextResponse.json({ error: lockInfo.payment_lock_reason || 'Cham cong da phat sinh thanh toan, khong the xoa' }, { status: 409 })
  }
  await (db as any).projectLaborAttendance.delete({ where: { id: ctx.params.id } })
  return NextResponse.json({ data: { ok: true } })
}
