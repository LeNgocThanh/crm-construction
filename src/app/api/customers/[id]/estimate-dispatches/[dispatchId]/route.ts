import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; dispatchId: string } }
) {
  const auth = await requirePermission(PERMISSIONS.customersWrite)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const existing = await (db as any).customerEstimateDispatch.findUnique({
    where: { id: params.dispatchId },
    select: { id: true, customer_id: true, snapshot_json: true },
  })
  if (!existing || existing.customer_id !== params.id) {
    return NextResponse.json({ error: 'Khong tim thay dispatch' }, { status: 404 })
  }
  const data: any = {}

  if (body.estimate_type !== undefined) data.estimate_type = String(body.estimate_type || '').trim()
  if (body.channel !== undefined) data.channel = String(body.channel || '').trim()
  if (body.sent_at !== undefined) data.sent_at = body.sent_at ? new Date(body.sent_at) : new Date()
  if (body.delivery_status !== undefined) data.delivery_status = String(body.delivery_status || '').trim() || 'sent'
  if (body.opened_at !== undefined) data.opened_at = body.opened_at ? new Date(body.opened_at) : null
  if (body.confirmed_at !== undefined) data.confirmed_at = body.confirmed_at ? new Date(body.confirmed_at) : null
  if (body.message_text !== undefined) data.message_text = body.message_text ? String(body.message_text) : null
  if (body.attachment_url !== undefined) data.attachment_url = body.attachment_url ? String(body.attachment_url) : null
  if (body.snapshot_json !== undefined) data.snapshot_json = body.snapshot_json ?? null

  const updated = await (db as any).customerEstimateDispatch.update({
    where: { id: params.dispatchId },
    data,
  })

  const snap = existing?.snapshot_json && typeof existing.snapshot_json === 'object'
    ? existing.snapshot_json as any
    : null
  const messageId = snap?.message_id ? String(snap.message_id) : ''
  if (messageId) {
    const msg = await (db as any).message.findUnique({
      where: { id: messageId },
      select: { metadata: true },
    })
    if (msg) {
      const prevMeta = msg.metadata && typeof msg.metadata === 'object' ? msg.metadata : {}
      const nextMeta: any = { ...(prevMeta as any) }
      if (data.delivery_status !== undefined) nextMeta.dispatch_delivery_status = data.delivery_status
      if (data.opened_at !== undefined) nextMeta.dispatch_opened_at = data.opened_at ? new Date(data.opened_at).toISOString() : null
      if (data.confirmed_at !== undefined) nextMeta.dispatch_confirmed_at = data.confirmed_at ? new Date(data.confirmed_at).toISOString() : null
      await (db as any).message.update({
        where: { id: messageId },
        data: { metadata: nextMeta },
      })
    }
  }

  return NextResponse.json({ data: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; dispatchId: string } }
) {
  const auth = await requirePermission(PERMISSIONS.customersManage)
  if (auth.error) return auth.error

  const existing = await (db as any).customerEstimateDispatch.findUnique({
    where: { id: params.dispatchId },
    select: { id: true, customer_id: true },
  })
  if (!existing || existing.customer_id !== params.id) {
    return NextResponse.json({ error: 'Khong tim thay dispatch' }, { status: 404 })
  }

  await (db as any).customerEstimateDispatch.delete({ where: { id: params.dispatchId } })
  return NextResponse.json({ ok: true })
}
