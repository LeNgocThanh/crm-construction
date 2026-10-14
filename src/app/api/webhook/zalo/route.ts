// src/app/api/webhooks/zalo/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { handleIncomingMessage, handleOutgoingWebhookMessage } from '@/lib/bot/engine'
import crypto from 'crypto'

// ─── Verify webhook (Zalo dùng GET để verify) ─────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  // Zalo gửi challenge khi đăng ký webhook
  const challenge = searchParams.get('challenge')
  if (challenge) return new NextResponse(challenge)
  return NextResponse.json({ status: 'Zalo webhook active' })
}

// ─── Receive events ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.text()

  // Verify signature (bỏ qua nếu mock mode)
  if (process.env.BOT_MOCK_MODE !== 'true') {
    const appSecret = process.env.ZALO_APP_SECRET || ''
    const sig = req.headers.get('x-zevent-signature') || ''
    const expected = crypto.createHmac('sha256', appSecret).update(body).digest('hex')
    if (sig !== `sha256=${expected}`) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let event: any
  try { event = JSON.parse(body) } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Zalo OA event types
  if (event.event_name === 'user_send_text') {
    const sender = event.sender || {}
    const msg    = event.message || {}

    await handleIncomingMessage({
      channel:          'zalo',
      external_conv_id: sender.id,          // Zalo: conv_id = user_id (1-1 với OA)
      external_user_id: sender.id,
      display_name:     sender.display_name || null,
      avatar_url:       sender.avatar       || null,
      content:          msg.text            || '',
      msg_type:         'text',
      external_msg_id:  msg.msg_id          || null,
      timestamp:        event.timestamp ? new Date(event.timestamp) : new Date(),
    })
  }

  // Image/file messages
  if (event.event_name === 'user_send_image' || event.event_name === 'user_send_file') {
    const sender = event.sender || {}
    await handleIncomingMessage({
      channel:          'zalo',
      external_conv_id: sender.id,
      external_user_id: sender.id,
      display_name:     sender.display_name || null,
      content:          '[Khách gửi hình ảnh/file]',
      msg_type:         event.event_name === 'user_send_image' ? 'image' : 'file',
      timestamp:        event.timestamp ? new Date(event.timestamp) : new Date(),
    })
  }

  // OA admin nhắn từ app Zalo (reply từ platform) → lưu lại với label "Trả lời trên Zalo"
  if (event.event_name === 'oa_send_text') {
    const recipient = event.recipient || {}
    const msg       = event.message || {}
    await handleOutgoingWebhookMessage({
      channel:          'zalo',
      external_conv_id: recipient.id,
      content:          msg.text || '',
      external_msg_id:  msg.msg_id || null,
    })
  }

  return NextResponse.json({ status: 'ok' })
}
