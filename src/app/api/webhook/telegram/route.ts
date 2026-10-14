// src/app/api/webhook/telegram/route.ts — V2.5 + full logging
import { NextRequest, NextResponse } from 'next/server'
import { handleIncomingMessage } from '@/lib/bot/engine'
import { webhookLog } from '@/lib/bot/logger'

export async function POST(req: NextRequest) {
  const t0   = Date.now()
  const body = await req.text()

  // ── 1. Log raw request ngay lập tức (trước mọi xử lý) ──────────
  let update: any
  try { update = JSON.parse(body) } catch {
    await webhookLog({ channel:'telegram', direction:'in', status:'error', error:'Invalid JSON', raw: body.slice(0,200) })
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const msg      = update.message || update.edited_message
  const chatId   = String(msg?.chat?.id || update.callback_query?.message?.chat?.id || '')
  const fromName = [msg?.from?.first_name, msg?.from?.last_name].filter(Boolean).join(' ') || msg?.from?.username || ''
  const eventType = msg ? 'message' : update.callback_query ? 'callback_query' : Object.keys(update).filter(k=>k!=='update_id')[0]

  console.log(`[TG WEBHOOK] update_id=${update.update_id} type=${eventType} chat=${chatId} from="${fromName}"`)

  // ── 2. Verify secret ────────────────────────────────────────────
  const secret   = process.env.TELEGRAM_WEBHOOK_SECRET || ''
  const incoming = req.headers.get('x-telegram-bot-api-secret-token') || ''

  if (secret && process.env.BOT_MOCK_MODE !== 'true' && incoming !== secret) {
    console.warn(`[TG WEBHOOK] Secret mismatch — got="${incoming.slice(0,10)}…" want="${secret.slice(0,10)}…"`)
    await webhookLog({
      channel:'telegram', direction:'in', event_type:eventType,
      chat_id: chatId, status:'rejected',
      error: `Secret mismatch. Received: "${incoming.slice(0,20)}"`,
      raw: update, duration_ms: Date.now()-t0,
    })
    return NextResponse.json({ ok: true })  // 200 để Telegram không retry
  }

  // ── 3. Log request nhận được (chưa xử lý) ──────────────────────
  await webhookLog({
    channel:    'telegram',
    direction:  'in',
    event_type: eventType,
    chat_id:    chatId,
    content:    msg?.text || msg?.caption || update.callback_query?.data || `[${eventType}]`,
    raw:        update,
    status:     'ok',
  })

  // ── 4. Xử lý update ────────────────────────────────────────────
  try {
    if (msg) {
      const from        = msg.from
      const displayName = fromName || `User_${chatId.slice(-4)}`

      if (from?.is_bot) {
        console.log(`[TG WEBHOOK] Ignored: message from bot`)
        return NextResponse.json({ ok: true })
      }

      if (msg.text) {
        const result = await handleIncomingMessage({
          channel:          'telegram',
          external_conv_id: chatId,
          external_user_id: chatId,
          display_name:     displayName,
          avatar_url:       null,
          content:          msg.text,
          msg_type:         'text',
          external_msg_id:  String(msg.message_id),
          timestamp:        msg.date ? new Date(msg.date * 1000) : new Date(),
        })
        console.log(`[TG WEBHOOK] handleIncomingMessage result:`, result)

      } else if (msg.photo || msg.document || msg.video || msg.voice) {
        const type    = msg.photo ? 'image' : msg.video ? 'video' : msg.voice ? 'audio' : 'file'
        const caption = msg.caption || `[Khách gửi ${type}]`
        await handleIncomingMessage({
          channel: 'telegram', external_conv_id: chatId, external_user_id: chatId,
          display_name: displayName, content: caption, msg_type: type,
          external_msg_id: String(msg.message_id),
          timestamp: msg.date ? new Date(msg.date * 1000) : new Date(),
        })

      } else if (msg.location) {
        await handleIncomingMessage({
          channel: 'telegram', external_conv_id: chatId, external_user_id: chatId,
          display_name: displayName,
          content: `[Vị trí: ${msg.location.latitude}, ${msg.location.longitude}]`,
          msg_type: 'text',
        })

      } else if (msg.contact) {
        const c = msg.contact
        await handleIncomingMessage({
          channel: 'telegram', external_conv_id: chatId, external_user_id: chatId,
          display_name: displayName,
          content: `[Liên hệ: ${c.phone_number} – ${c.first_name || ''} ${c.last_name || ''}]`.trim(),
          msg_type: 'text',
        })
      }
    }

    if (update.callback_query) {
      const cq   = update.callback_query
      const from = cq.from
      if (!from?.is_bot) {
        await handleIncomingMessage({
          channel: 'telegram',
          external_conv_id: chatId,
          external_user_id: chatId,
          display_name: [from?.first_name, from?.last_name].filter(Boolean).join(' ') || from?.username || 'Khách',
          content:  cq.data || '[Button]',
          msg_type: 'text',
          external_msg_id: cq.id,
        })
        // Answer callback để tắt loading spinner trên Telegram
        const token = process.env.TELEGRAM_BOT_TOKEN
        if (token) fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`,{
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ callback_query_id: cq.id }),
        }).catch(()=>{})
      }
    }

  } catch (err: any) {
    console.error('[TG WEBHOOK] Processing error:', err)
    await webhookLog({
      channel:'telegram', direction:'in', event_type:eventType,
      chat_id: chatId, status:'error', error: err.message,
      duration_ms: Date.now()-t0,
    })
  }

  console.log(`[TG WEBHOOK] Done in ${Date.now()-t0}ms`)
  return NextResponse.json({ ok: true })
}

// ── GET: info + setup ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('setup') || searchParams.get('action')
  const token  = process.env.TELEGRAM_BOT_TOKEN

  if (!token) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 400 })

  if (action === '1' || action === 'setup') {
    const domain = (process.env.NEXTAUTH_URL || '').replace(/\/$/, '')
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET || ''

    if (!domain || domain.includes('localhost'))
      return NextResponse.json({ error: 'NEXTAUTH_URL phải là HTTPS public domain', current: domain }, { status: 400 })

    const webhookUrl = `${domain}/api/webhook/telegram`
    const res  = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, secret_token: secret, allowed_updates: ['message','callback_query'], drop_pending_updates: true }),
    })
    const data = await res.json()
    return NextResponse.json({ webhook_url: webhookUrl, result: data })
  }

  const [me, wh] = await Promise.all([
    fetch(`https://api.telegram.org/bot${token}/getMe`).then(r=>r.json()),
    fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then(r=>r.json()),
  ])
  return NextResponse.json({ bot: me.result, webhook: wh.result })
}
