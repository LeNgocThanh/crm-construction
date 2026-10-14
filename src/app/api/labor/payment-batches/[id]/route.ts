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

function serialize(row: any) {
  const safe = jsonSafe(row)
  const activePayments = Array.isArray(row?.payments) ? row.payments.filter((x: any) => x?.is_active !== false) : []
  const totalAmount = activePayments.reduce((sum: number, item: any) => sum + Number(item?.amount || 0), 0)
  return {
    ...safe,
    total_amount: String(Math.round(totalAmount)),
    payment_count: activePayments.length,
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr

  const batchModel = (db as any).projectLaborPaymentBatch
  if (!batchModel) {
    return NextResponse.json({ error: 'He thong chua cap nhat model dot thanh toan nhan cong' }, { status: 500 })
  }

  const body = await req.json()
  const existing = await batchModel.findUnique({
    where: { id: params.id },
    select: { id: true, project_id: true, batch_code: true, batch_name: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Khong tim thay dot thanh toan' }, { status: 404 })
  }
  const statusRow = await batchModel.findUnique({
    where: { id: params.id },
    select: { status: true },
  })
  if (String(statusRow?.status || '') !== 'draft') {
    return NextResponse.json({ error: 'Chi duoc sua thong tin dot khi dot dang o trang thai nhap' }, { status: 400 })
  }
  const row = await batchModel.update({
    where: { id: params.id },
    data: {
      batch_name: body?.batch_name !== undefined ? String(body.batch_name || '').trim() : undefined,
      period_from: body?.period_from !== undefined ? parseDate(body.period_from) : undefined,
      period_to: body?.period_to !== undefined ? parseDate(body.period_to) : undefined,
      planned_payment_date: body?.planned_payment_date !== undefined ? parseDate(body.planned_payment_date) : undefined,
      actual_payment_date: body?.actual_payment_date !== undefined ? parseDate(body.actual_payment_date) : undefined,
      payment_type: body?.payment_type !== undefined ? (parseOptionalString(body.payment_type) || 'payment') : undefined,
      note: body?.note !== undefined ? parseOptionalString(body.note) : undefined,
      cancel_reason: body?.cancel_reason !== undefined ? parseOptionalString(body.cancel_reason) : undefined,
    },
    include: {
      project: { select: { id: true, project_name: true } },
      creator: { select: { id: true, username: true } },
      approver: { select: { id: true, username: true } },
      payer: { select: { id: true, username: true } },
      canceller: { select: { id: true, username: true } },
      payments: { where: { is_active: true }, select: { id: true, amount: true } },
    },
  })

  const project = await db.constructionProject.findUnique({
    where: { id: existing.project_id },
    select: { customer_id: true },
  })
  await createLaborPaymentBatchTimeline({
    project_id: existing.project_id,
    customer_id: project?.customer_id || null,
    batch_id: row.id,
    event_key: 'labor_payment_batch_updated',
    title: 'Cap nhat dot thanh toan cong',
    description: `${row.batch_name} (${row.batch_code})`,
    actor_user_id: auth.session.user.id,
    metadata_json: {
      batch_code: row.batch_code,
      payment_type: row.payment_type,
      planned_payment_date: row.planned_payment_date ? new Date(row.planned_payment_date).toISOString() : null,
    },
  })

  return NextResponse.json(jsonSafe({ data: serialize(row) }))
}
