import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createCareActivitySafe } from '@/lib/customer-care'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.customersRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const limitRaw = Number(sp.get('limit') || '100')
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.trunc(limitRaw))) : 100

  const data = await (db as any).customerEstimateDispatch.findMany({
    where: { customer_id: params.id },
    orderBy: [{ sent_at: 'desc' }, { created_at: 'desc' }],
    take: limit,
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.customersWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json().catch(() => ({}))
  const estimateType = String(body.estimate_type || '').trim()
  const channel = String(body.channel || '').trim()
  if (!estimateType || !channel) {
    return NextResponse.json({ error: 'Thieu estimate_type hoac channel' }, { status: 400 })
  }

  const conversationId = body.conversation_id ? String(body.conversation_id).trim() : null
  const messageId = body.message_id ? String(body.message_id).trim() : null
  const providerMessageId = body.provider_message_id ? String(body.provider_message_id).trim() : null

  if (conversationId) {
    const conv = await (db as any).conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, customer_id: true },
    })
    if (!conv || conv.customer_id !== params.id) {
      return NextResponse.json({ error: 'conversation_id khong hop le voi customer' }, { status: 400 })
    }
  }
  if (messageId) {
    const msg = await (db as any).message.findUnique({
      where: { id: messageId },
      select: { id: true, conversation_id: true },
    })
    if (!msg) return NextResponse.json({ error: 'message_id khong ton tai' }, { status: 400 })
    if (conversationId && msg.conversation_id !== conversationId) {
      return NextResponse.json({ error: 'message_id khong thuoc conversation_id' }, { status: 400 })
    }
  }

  const created = await (db as any).customerEstimateDispatch.create({
    data: {
      customer_id: params.id,
      estimation_quote_id: body.estimation_quote_id ? String(body.estimation_quote_id) : null,
      estimate_type: estimateType,
      channel,
      sent_at: body.sent_at ? new Date(body.sent_at) : new Date(),
      sent_by: session.user.id,
      delivery_status: body.delivery_status ? String(body.delivery_status) : 'sent',
      opened_at: body.opened_at ? new Date(body.opened_at) : null,
      confirmed_at: body.confirmed_at ? new Date(body.confirmed_at) : null,
      message_text: body.message_text ? String(body.message_text) : null,
      attachment_url: body.attachment_url ? String(body.attachment_url) : null,
      snapshot_json: {
        ...(body.snapshot_json && typeof body.snapshot_json === 'object' ? body.snapshot_json : {}),
        conversation_id: conversationId,
        message_id: messageId,
        provider_message_id: providerMessageId,
      },
    },
  })

  if (messageId) {
    const msg = await (db as any).message.findUnique({
      where: { id: messageId },
      select: { metadata: true },
    })
    const prevMeta = msg?.metadata && typeof msg.metadata === 'object' ? msg.metadata : {}
    await (db as any).message.update({
      where: { id: messageId },
      data: {
        metadata: {
          ...(prevMeta as any),
          dispatch_id: created.id,
          dispatch_estimate_type: estimateType,
          dispatch_channel: channel,
          dispatch_delivery_status: body.delivery_status ? String(body.delivery_status) : 'sent',
          provider_message_id: providerMessageId || null,
        },
      },
    })
  }

  await createCareActivitySafe({
    customer_id: params.id,
    activity_type: 'estimate_sent',
    summary: `Da gui ${estimateType} qua kenh ${channel}`,
    detail: body.message_text ? String(body.message_text).slice(0, 500) : null,
    source_ref_type: 'estimate_dispatch',
    source_ref_id: created.id,
    channel,
    pipeline_phase: 'construction_pre_sale',
    created_by: session.user.id,
    metadata_json: {
      estimation_quote_id: body.estimation_quote_id ? String(body.estimation_quote_id) : null,
      delivery_status: body.delivery_status ? String(body.delivery_status) : 'sent',
      conversation_id: conversationId,
      message_id: messageId,
      provider_message_id: providerMessageId,
    },
  })

  await db.customerTimeline.create({
    data: {
      customer_id: params.id,
      type: 'estimate_sent',
      title: `Gui ${estimateType}`,
      description: `Kenh: ${channel}${body.estimation_quote_id ? ` · Quote: ${String(body.estimation_quote_id)}` : ''}`,
      happened_at: body.sent_at ? new Date(body.sent_at) : new Date(),
      created_by: session.user.id,
      metadata: {
        dispatch_id: created.id,
        estimate_type: estimateType,
        channel,
        estimation_quote_id: body.estimation_quote_id ? String(body.estimation_quote_id) : null,
      },
    },
  })

  return NextResponse.json({ data: created }, { status: 201 })
}
