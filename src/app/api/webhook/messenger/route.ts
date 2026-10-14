// src/app/api/webhooks/messenger/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { handleIncomingMessage, handleOutgoingWebhookMessage } from '@/lib/bot/engine'
import crypto from 'crypto'

// ─── Verify webhook (Meta dùng GET với hub.challenge) ─────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === (process.env.MESSENGER_VERIFY_TOKEN || 'crm-verify-token')) {
    console.log('[MESSENGER] Webhook verified')
    return new NextResponse(challenge)
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ─── Receive events ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.text()

  // Verify App Secret signature
  if (process.env.BOT_MOCK_MODE !== 'true') {
    const appSecret = process.env.MESSENGER_APP_SECRET || ''
    const sig = req.headers.get('x-hub-signature-256') || ''
    const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(body).digest('hex')
    if (sig !== expected) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let payload: any
  try { payload = JSON.parse(body) } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (payload.object !== 'page') {
    return NextResponse.json({ status: 'ignored' })
  }

  // Process entries
  for (const entry of payload.entry || []) {
    for (const event of entry.messaging || []) {
      // Echo message — page gửi từ ngoài (Messenger app)
      if (event.message?.is_echo && event.message?.text) {
        const recipientId = event.recipient?.id || entry.id
        await handleOutgoingWebhookMessage({
          channel:          'messenger',
          external_conv_id: recipientId,
          content:          event.message.text,
          external_msg_id:  event.message.mid || null,
        })
        continue
      }
      const senderId = event.sender?.id
      if (!senderId) continue

      // Text message
      if (event.message?.text) {
        await handleIncomingMessage({
          channel:          'messenger',
          external_conv_id: senderId,          // Messenger: conv = 1-1 với PSID
          external_user_id: senderId,
          content:          event.message.text,
          msg_type:         'text',
          external_msg_id:  event.message.mid  || null,
          timestamp:        event.timestamp ? new Date(event.timestamp) : new Date(),
        })
      }

      // Attachments (image/file)
      if (event.message?.attachments) {
        const attach = event.message.attachments[0]
        await handleIncomingMessage({
          channel:          'messenger',
          external_conv_id: senderId,
          external_user_id: senderId,
          content:          `[Khách gửi ${attach.type === 'image' ? 'hình ảnh' : 'file'}]`,
          msg_type:         attach.type || 'file',
          external_msg_id:  event.message.mid || null,
          timestamp:        event.timestamp ? new Date(event.timestamp) : new Date(),
        })
      }

      // Postback (button click)
      if (event.postback?.payload) {
        await handleIncomingMessage({
          channel:          'messenger',
          external_conv_id: senderId,
          external_user_id: senderId,
          content:          event.postback.title || event.postback.payload,
          msg_type:         'text',
          timestamp:        event.timestamp ? new Date(event.timestamp) : new Date(),
        })
      }
    }
  }

  return NextResponse.json({ status: 'ok' })
}
