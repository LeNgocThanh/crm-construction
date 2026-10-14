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

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error

  const sp = new URL(req.url).searchParams
  const projectId = String(sp.get('project_id') || '').trim()
  const workerId = String(sp.get('worker_id') || '').trim()
  const shiftType = String(sp.get('shift_type') || '').trim()
  const from = String(sp.get('from') || '').trim()
  const to = String(sp.get('to') || '').trim()
  const status = String(sp.get('attendance_status') || '').trim()
  const where: any = {}
  if (projectId) where.project_id = projectId
  if (workerId) where.worker_id = workerId
  if (shiftType) where.shift_type = shiftType
  if (status) where.attendance_status = status
  if (from || to) {
    where.attendance_date = {}
    if (from) where.attendance_date.gte = new Date(from)
    if (to) where.attendance_date.lte = new Date(to)
  }
  const data = await (db as any).projectLaborAttendance.findMany({
    where,
    include: {
      project: { select: { id: true, project_name: true } },
      worker: { select: { id: true, worker_code: true, full_name: true } },
      diary_entry: { select: { id: true, title: true, entry_date: true, shift_type: true } },
      engagement: { select: { id: true, engagement_type: true, status: true } },
      creator: { select: { id: true, username: true } },
    },
    orderBy: [{ attendance_date: 'desc' }, { created_at: 'desc' }],
  })
  const lockMap = await getAttendancePaymentLockMap(data.map((row: any) => String(row.id || '')))
  return NextResponse.json(
    jsonSafe({
      data: data.map((row: any) => ({
        ...serialize(row),
        ...(lockMap.get(String(row.id || '')) || {}),
      })),
    }),
  )
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr

  const body = await req.json()
  const projectId = String(body?.project_id || '').trim()
  const attendanceDate = body?.attendance_date ? new Date(body.attendance_date) : null
  if (!projectId || !attendanceDate) return NextResponse.json({ error: 'Thieu project_id hoac attendance_date' }, { status: 400 })

  const workerId = parseOptionalString(body?.worker_id)
  const engagementId = parseOptionalString(body?.engagement_id)
  const shiftType = parseOptionalString(body?.shift_type)
  const workQty = parseOptionalFloat(body?.work_qty)
  const explicitAmount = parseOptionalBigInt(body?.amount)
  const defaults = await resolveAttendanceDefaults({
    worker_id: workerId,
    engagement_id: engagementId,
    shift_type: shiftType,
    work_qty: workQty,
  })

  const data = await (db as any).projectLaborAttendance.create({
    data: {
      project_id: projectId,
      engagement_id: engagementId,
      worker_id: workerId,
      attendance_date: attendanceDate,
      shift_type: shiftType,
      source_type: 'manual',
      attendance_status: 'confirmed',
      work_qty: workQty ?? defaults.work_qty,
      amount: explicitAmount ?? defaults.amount,
      note: parseOptionalString(body?.note),
      confirmed_by: auth.session.user.id,
      confirmed_at: new Date(),
      created_by: auth.session.user.id,
    },
    include: {
      project: { select: { id: true, project_name: true } },
      worker: { select: { id: true, worker_code: true, full_name: true } },
      diary_entry: { select: { id: true, title: true, entry_date: true, shift_type: true } },
      engagement: { select: { id: true, engagement_type: true, status: true } },
      creator: { select: { id: true, username: true } },
    },
  })
  return NextResponse.json(jsonSafe({ data: serialize(data) }), { status: 201 })
}
