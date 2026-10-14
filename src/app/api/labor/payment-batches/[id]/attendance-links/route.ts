import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireManageRole, requireSession } from '@/lib/labor/server'
import { createLaborPaymentBatchTimeline } from '@/lib/labor/payment-batches'

function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? String(v) : v))) as T
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr

  const batchModel = (db as any).projectLaborPaymentBatch
  const linkModel = (db as any).projectLaborPaymentBatchAttendance
  if (!batchModel || !linkModel) {
    return NextResponse.json({ error: 'He thong chua cap nhat lien ket dot thanh toan - cham cong' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const attendanceIds = Array.isArray(body?.attendance_ids)
    ? body.attendance_ids.map((x: any) => String(x || '').trim()).filter(Boolean)
    : []

  const batch = await batchModel.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      project_id: true,
      batch_name: true,
      batch_code: true,
      status: true,
      project: { select: { customer_id: true } },
    },
  })
  if (!batch) {
    return NextResponse.json({ error: 'Khong tim thay dot thanh toan' }, { status: 404 })
  }
  if (String(batch.status || '') !== 'draft') {
    return NextResponse.json({ error: 'Chi duoc doi danh sach cham cong khi dot dang o trang thai nhap' }, { status: 400 })
  }

  const attendances = attendanceIds.length
    ? await (db as any).projectLaborAttendance.findMany({
        where: {
          id: { in: attendanceIds },
          project_id: batch.project_id,
          attendance_status: 'confirmed',
        },
        select: {
          id: true,
          attendance_date: true,
          shift_type: true,
          work_qty: true,
          amount: true,
          worker: { select: { full_name: true, worker_code: true } },
        },
      })
    : []

  if (attendanceIds.length !== attendances.length) {
    return NextResponse.json({ error: 'Co cham cong khong hop le, khong thuoc du an hoac chua xac nhan' }, { status: 400 })
  }

  await db.$transaction(async (tx) => {
    await (tx as any).projectLaborPaymentBatchAttendance.deleteMany({
      where: { batch_id: params.id },
    })
    if (attendanceIds.length) {
      await (tx as any).projectLaborPaymentBatchAttendance.createMany({
        data: attendanceIds.map((attendanceId: string) => ({
          batch_id: params.id,
          attendance_id: attendanceId,
        })),
      })
    }
  })

  const totalWorkQty = attendances.reduce((sum: number, row: any) => sum + Number(row?.work_qty || 0), 0)
  const totalAmount = attendances.reduce((sum: number, row: any) => sum + Number(row?.amount || 0), 0)

  await createLaborPaymentBatchTimeline({
    project_id: batch.project_id,
    customer_id: batch.project?.customer_id || null,
    batch_id: batch.id,
    event_key: 'labor_payment_batch_attendance_linked',
    title: 'Cap nhat cham cong thuoc dot thanh toan',
    description: `${attendances.length} dong cham cong | ${totalWorkQty.toLocaleString('vi-VN')} cong | ${Math.round(totalAmount).toLocaleString('vi-VN')} vnd`,
    actor_user_id: auth.session.user.id,
    metadata_json: {
      attendance_ids: attendanceIds,
      attendance_count: attendances.length,
      total_work_qty: totalWorkQty,
      total_amount: Math.round(totalAmount),
    },
  })

  const fresh = await batchModel.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, project_name: true } },
      payments: { where: { is_active: true }, select: { id: true, amount: true } },
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
  })

  return NextResponse.json(jsonSafe({ data: fresh }))
}
