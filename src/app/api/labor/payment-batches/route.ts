import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireManageRole, requireSession, parseOptionalString } from '@/lib/labor/server'
import { createLaborPaymentBatchTimeline } from '@/lib/labor/payment-batches'

function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? String(v) : v))) as T
}

function parseDate(value: any) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function makeBatchCode() {
  return `LBT-${Date.now()}`
}

function getSettlementStatus(paymentAmount: number, attendanceAmount: number) {
  if (paymentAmount <= 0) return 'unpaid'
  if (attendanceAmount <= 0) return 'paid'
  if (paymentAmount + 0.0001 >= attendanceAmount) return 'paid'
  return 'partial'
}

function serialize(row: any) {
  const safe = jsonSafe(row)
  const activePayments = Array.isArray(row?.payments) ? row.payments.filter((x: any) => x?.is_active !== false) : []
  const attendanceLinks = Array.isArray(row?.attendance_links) ? row.attendance_links : []
  const totalAmount = activePayments.reduce((sum: number, item: any) => sum + Number(item?.amount || 0), 0)
  const attendanceAmount = attendanceLinks.reduce((sum: number, item: any) => sum + Number(item?.attendance?.amount || 0), 0)
  return {
    ...safe,
    total_amount: String(Math.round(totalAmount)),
    payment_amount: String(Math.round(totalAmount)),
    attendance_amount: String(Math.round(attendanceAmount)),
    payment_count: activePayments.length,
    attendance_count: attendanceLinks.length,
    settlement_status: String(row?.status || '') === 'cancelled' ? 'cancelled' : getSettlementStatus(totalAmount, attendanceAmount),
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error

  const batchModel = (db as any).projectLaborPaymentBatch
  if (!batchModel) {
    return NextResponse.json({ data: [] })
  }

  const sp = new URL(req.url).searchParams
  const projectId = String(sp.get('project_id') || '').trim()
  const status = String(sp.get('status') || '').trim()
  const where: any = {}
  if (projectId) where.project_id = projectId
  if (status) where.status = status

  const rows = await batchModel.findMany({
    where,
    include: {
      project: { select: { id: true, project_name: true } },
      creator: { select: { id: true, username: true } },
      approver: { select: { id: true, username: true } },
      payer: { select: { id: true, username: true } },
      canceller: { select: { id: true, username: true } },
      payments: {
        where: { is_active: true },
        select: {
          id: true,
          amount: true,
          payment_date: true,
          payment_type: true,
          note: true,
          worker: { select: { id: true, full_name: true } },
          crew: { select: { id: true, crew_name: true } },
        },
      },
      attendance_links: {
        include: {
          attendance: {
            select: {
              id: true,
              attendance_date: true,
              shift_type: true,
              work_qty: true,
              amount: true,
              note: true,
              worker: { select: { id: true, full_name: true, worker_code: true } },
              diary_entry: { select: { id: true, title: true } },
            },
          },
        },
      },
    },
    orderBy: [{ planned_payment_date: 'desc' }, { created_at: 'desc' }],
  })

  return NextResponse.json(jsonSafe({ data: rows.map(serialize) }))
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr

  const batchModel = (db as any).projectLaborPaymentBatch
  if (!batchModel) {
    return NextResponse.json({ error: 'He thong chua cap nhat model dot thanh toan nhan cong' }, { status: 500 })
  }

  const body = await req.json()
  const projectId = String(body?.project_id || '').trim()
  const batchName = String(body?.batch_name || '').trim()
  if (!projectId || !batchName) {
    return NextResponse.json({ error: 'Thieu du an hoac ten dot thanh toan' }, { status: 400 })
  }

  const row = await batchModel.create({
    data: {
      project_id: projectId,
      batch_code: String(body?.batch_code || '').trim() || makeBatchCode(),
      batch_name: batchName,
      period_from: parseDate(body?.period_from),
      period_to: parseDate(body?.period_to),
      planned_payment_date: parseDate(body?.planned_payment_date),
      payment_type: parseOptionalString(body?.payment_type) || 'payment',
      note: parseOptionalString(body?.note),
      created_by: auth.session.user.id,
    },
    include: {
      project: { select: { id: true, project_name: true } },
      creator: { select: { id: true, username: true } },
      approver: { select: { id: true, username: true } },
      payer: { select: { id: true, username: true } },
      canceller: { select: { id: true, username: true } },
      payments: { where: { is_active: true }, select: { id: true, amount: true } },
      attendance_links: { include: { attendance: { select: { id: true } } } },
    },
  })

  const project = await db.constructionProject.findUnique({
    where: { id: projectId },
    select: { customer_id: true },
  })
  await createLaborPaymentBatchTimeline({
    project_id: projectId,
    customer_id: project?.customer_id || null,
    batch_id: row.id,
    event_key: 'labor_payment_batch_created',
    title: 'Tao dot thanh toan cong',
    description: `${row.batch_name} (${row.batch_code})`,
    actor_user_id: auth.session.user.id,
    metadata_json: {
      batch_code: row.batch_code,
      payment_type: row.payment_type,
      planned_payment_date: row.planned_payment_date ? new Date(row.planned_payment_date).toISOString() : null,
    },
  })

  return NextResponse.json(jsonSafe({ data: serialize(row) }), { status: 201 })
}
