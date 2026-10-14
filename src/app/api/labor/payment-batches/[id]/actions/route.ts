import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireManageRole, requireSession, parseOptionalString } from '@/lib/labor/server'
import { createLaborPaymentBatchTimeline, notifyLaborPaymentBatchStatus } from '@/lib/labor/payment-batches'

function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? String(v) : v))) as T
}

function parseDate(value: any) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
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
  const totalAmount = activePayments.reduce((sum: number, item: any) => sum + Number(item?.amount || 0), 0)
  const attendanceAmount = Array.isArray(row?.attendance_links)
    ? row.attendance_links.reduce((sum: number, item: any) => sum + Number(item?.attendance?.amount || 0), 0)
    : 0
  return {
    ...safe,
    total_amount: String(Math.round(totalAmount)),
    payment_amount: String(Math.round(totalAmount)),
    attendance_amount: String(Math.round(attendanceAmount)),
    payment_count: activePayments.length,
    settlement_status: String(row?.status || '') === 'cancelled' ? 'cancelled' : getSettlementStatus(totalAmount, attendanceAmount),
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr

  const batchModel = (db as any).projectLaborPaymentBatch
  if (!batchModel) {
    return NextResponse.json({ error: 'He thong chua cap nhat model dot thanh toan nhan cong' }, { status: 500 })
  }

  const body = await req.json()
  const action = String(body?.action || '').trim()
  const current = await batchModel.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, project_name: true } },
      creator: { select: { id: true, username: true } },
      approver: { select: { id: true, username: true } },
      payer: { select: { id: true, username: true } },
      canceller: { select: { id: true, username: true } },
      payments: { where: { is_active: true }, select: { id: true, amount: true } },
    },
  })
  if (!current) {
    return NextResponse.json({ error: 'Khong tim thay dot thanh toan' }, { status: 404 })
  }

  const totalAmount = Array.isArray(current.payments)
    ? current.payments.reduce((sum: number, item: any) => sum + Number(item?.amount || 0), 0)
    : 0

  let data: any = {}
  if (action === 'approve') {
    if (current.status !== 'draft') {
      return NextResponse.json({ error: 'Chi duoc duyet dot dang o trang thai nhap' }, { status: 400 })
    }
    data = {
      status: 'approved',
      approved_by: auth.session.user.id,
      approved_at: new Date(),
    }
  } else if (action === 'mark_paid') {
    return NextResponse.json({ error: 'Trang thai da chi duoc tu dong suy ra tu cac dong thanh toan, khong can chuyen tay o muc dot' }, { status: 400 })
  } else if (action === 'cancel') {
    if (current.status === 'paid') {
      return NextResponse.json({ error: 'Dot da chi khong duoc huy truc tiep' }, { status: 400 })
    }
    const reason = parseOptionalString(body?.cancel_reason)
    if (!reason) {
      return NextResponse.json({ error: 'Can nhap ly do huy dot thanh toan' }, { status: 400 })
    }
    data = {
      status: 'cancelled',
      cancel_reason: reason,
      cancelled_by: auth.session.user.id,
      cancelled_at: new Date(),
    }
  } else if (action === 'reopen') {
    if (!['approved', 'cancelled'].includes(String(current.status || ''))) {
      return NextResponse.json({ error: 'Chi mo lai dot da duyet hoac da huy' }, { status: 400 })
    }
    data = {
      status: 'draft',
      approved_by: null,
      approved_at: null,
      cancelled_by: null,
      cancelled_at: null,
      cancel_reason: null,
    }
  } else {
    return NextResponse.json({ error: 'Action khong hop le' }, { status: 400 })
  }

  const row = await batchModel.update({
    where: { id: params.id },
    data,
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
    where: { id: current.project?.id || '' },
    select: { customer_id: true },
  })

  if (action === 'approve') {
    await createLaborPaymentBatchTimeline({
      project_id: current.project.id,
      customer_id: project?.customer_id || null,
      batch_id: row.id,
      event_key: 'labor_payment_batch_approved',
      title: 'Duyet dot thanh toan cong',
      description: `${row.batch_name} (${row.batch_code}) | ${Math.round(totalAmount).toLocaleString('vi-VN')} vnd`,
      actor_user_id: auth.session.user.id,
      metadata_json: { total_amount: Math.round(totalAmount) },
    })
    await notifyLaborPaymentBatchStatus({
      project_id: current.project.id,
      customer_id: project?.customer_id || null,
      batch_id: row.id,
      batch_name: row.batch_name,
      batch_code: row.batch_code,
      project_name: current.project.project_name,
      total_amount: totalAmount,
      actor_user_id: auth.session.user.id,
      actor_username: auth.session.user.username || null,
      type: 'labor_payment_batch_approved',
    })
  } else if (action === 'cancel') {
    await createLaborPaymentBatchTimeline({
      project_id: current.project.id,
      customer_id: project?.customer_id || null,
      batch_id: row.id,
      event_key: 'labor_payment_batch_cancelled',
      title: 'Huy dot thanh toan cong',
      description: String(data.cancel_reason || row.cancel_reason || ''),
      actor_user_id: auth.session.user.id,
      metadata_json: { total_amount: Math.round(totalAmount) },
    })
  } else if (action === 'reopen') {
    await createLaborPaymentBatchTimeline({
      project_id: current.project.id,
      customer_id: project?.customer_id || null,
      batch_id: row.id,
      event_key: 'labor_payment_batch_reopened',
      title: 'Mo lai dot thanh toan cong',
      description: `${row.batch_name} (${row.batch_code})`,
      actor_user_id: auth.session.user.id,
    })
  }

  return NextResponse.json(jsonSafe({ data: serialize(row) }))
}
