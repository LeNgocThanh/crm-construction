import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deleteFile } from '@/lib/storage'
import { createCareActivitySafe } from '@/lib/customer-care'
import { hasPermission, requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

const serializeLog = (log: any) => ({
  ...log,
  ext_budget: log.ext_budget ? Number(log.ext_budget) : null,
})

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.customersRead)
  if (auth.error || !auth.ctx) return auth.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session: any = auth.ctx.session

  const log = await db.contactLog.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { phone_number: true, full_name: true } },
      sales: { select: { username: true } },
    },
  })
  if (!log) return NextResponse.json({ error: 'Khong tim thay' }, { status: 404 })

  const canManageCustomers = hasPermission(auth.ctx, PERMISSIONS.customersManage)
  if (!canManageCustomers && String(log.sales_id || '') !== String(session.user.id || '')) {
    return NextResponse.json({ error: 'Khong co quyen' }, { status: 403 })
  }

  return NextResponse.json({ data: serializeLog(log) })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.customersWrite)
  if (auth.error || !auth.ctx) return auth.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session: any = auth.ctx.session

  const body = await req.json()
  const data: any = {}
  if (body.next_action !== undefined) data.next_action = body.next_action
  if (body.ai_summary !== undefined) data.ai_summary = body.ai_summary
  if (body.notes !== undefined) data.notes = body.notes

  const prev = await db.contactLog.findUnique({
    where: { id: params.id },
    select: { id: true, customer_id: true, sales_id: true, next_action: true, ai_summary: true, source: true },
  })
  if (!prev) return NextResponse.json({ error: 'Khong tim thay' }, { status: 404 })

  const canManageCustomers = hasPermission(auth.ctx, PERMISSIONS.customersManage)
  if (!canManageCustomers && String(prev.sales_id || '') !== String(session.user.id || '')) {
    return NextResponse.json({ error: 'Khong co quyen' }, { status: 403 })
  }

  const log = await db.contactLog.update({ where: { id: params.id }, data })

  if (body.next_action !== undefined) {
    const prevNext = String(prev.next_action || '').trim()
    const nextValue = String(log.next_action || '').trim()
    if (prevNext !== nextValue) {
      await createCareActivitySafe({
        customer_id: prev.customer_id,
        activity_type: 'next_action_update',
        summary: 'Cap nhat next_action tu trang nhat ky goi',
        detail: `next_action cu: ${prevNext || '(trong)'} -> moi: ${nextValue || '(trong)'}`,
        next_action_snapshot: log.next_action || null,
        source_ref_type: 'contact_log',
        source_ref_id: log.id,
        channel: log.source || null,
        created_by: session.user.id,
        metadata_json: {
          source: 'api/contact-logs/[id]',
          ai_summary: log.ai_summary || prev.ai_summary || null,
        },
      })
    }
  }

  return NextResponse.json({ data: serializeLog(log) })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.customersWrite)
  if (auth.error || !auth.ctx) return auth.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session: any = auth.ctx.session

  const log = await db.contactLog.findUnique({ where: { id: params.id } })
  if (!log) return NextResponse.json({ error: 'Khong tim thay' }, { status: 404 })

  const canManageCustomers = hasPermission(auth.ctx, PERMISSIONS.customersManage)
  if (!canManageCustomers && String(log.sales_id || '') !== String(session.user.id || '')) {
    return NextResponse.json({ error: 'Khong co quyen xoa' }, { status: 403 })
  }

  if (log.audio_file_path) await deleteFile(log.audio_file_path)

  await db.contactLog.delete({ where: { id: params.id } })
  return NextResponse.json({ message: 'Da xoa' })
}
