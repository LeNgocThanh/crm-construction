// src/lib/bot/sender.ts — V2.5 + outbound logging
import type { Channel } from './engine'
import { webhookLog } from './logger'
import { db } from '@/lib/db'

interface SendOptions {
  channel:          Channel
  external_conv_id: string
  external_user_id: string
  content:          string
  msg_type?:        string
}

export async function sendMessage(opts: SendOptions): Promise<boolean> {
  const t0 = Date.now()

  // Đọc config từ DB — không cần restart khi thay đổi token/mock_mode
  const config = await db.botConfig.findUnique({ where: { channel: opts.channel } })

  // mock_mode: DB ưu tiên, fallback về env (để tương thích cũ)
  const isMock = config
    ? config.mock_mode
    : process.env.BOT_MOCK_MODE === 'true'

  if (isMock) {
    console.log(`[BOT MOCK] [${opts.channel}] → ${opts.external_user_id}: ${opts.content.slice(0, 100)}`)
    await webhookLog({
      channel: opts.channel, direction: 'out', event_type: 'mock_send',
      chat_id: opts.external_conv_id, content: opts.content,
      status: 'ok', duration_ms: Date.now()-t0,
    })
    return true
  }

  // token: DB ưu tiên, fallback về env
  const token = config?.bot_token || getEnvToken(opts.channel)

  let ok = false
  let error: string | undefined

  try {
    if (opts.channel === 'telegram') ok = await sendTelegram(opts, token)
    else if (opts.channel === 'zalo')      ok = await sendZalo(opts, token)
    else if (opts.channel === 'messenger') ok = await sendMessenger(opts, token)
  } catch (err: any) {
    error = err.message
    console.error(`[SENDER] ${opts.channel} threw:`, err.message)
  }

  await webhookLog({
    channel: opts.channel, direction: 'out', event_type: 'send_message',
    chat_id: opts.external_conv_id, content: opts.content,
    status: ok ? 'ok' : 'error', error, duration_ms: Date.now()-t0,
  })

  if (!ok && !error) console.error(`[SENDER] ${opts.channel} returned false for chat=${opts.external_conv_id}`)

  return ok
}

function getEnvToken(channel: string): string | undefined {
  if (channel === 'telegram') return process.env.TELEGRAM_BOT_TOKEN
  if (channel === 'zalo')     return process.env.ZALO_OA_ACCESS_TOKEN
  if (channel === 'messenger') return process.env.MESSENGER_PAGE_ACCESS_TOKEN
}

async function sendTelegram(opts: SendOptions, token?: string): Promise<boolean> {
  if (!token) token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('[SENDER] TELEGRAM_BOT_TOKEN not set (env) and not in BotConfig DB')
    return false
  }
  const res  = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: opts.external_user_id, text: opts.content, parse_mode: 'HTML' }),
  })
  const data = await res.json()
  if (!data.ok) {
    console.error(`[SENDER] Telegram error: ${data.description} (${data.error_code})`)
    // Chat không tồn tại hoặc bot bị block → không retry
  }
  return data.ok === true
}

async function sendZalo(opts: SendOptions, token?: string): Promise<boolean> {
  if (!token) token = process.env.ZALO_OA_ACCESS_TOKEN
  if (!token) { console.warn('[SENDER] Zalo token not set'); return false }
  const res  = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'access_token': token },
    body: JSON.stringify({ recipient: { user_id: opts.external_user_id }, message: { text: opts.content } }),
  })
  const data = await res.json()
  if (data.error !== 0) console.error('[SENDER] Zalo error:', data)
  return data.error === 0
}

async function sendMessenger(opts: SendOptions, token?: string): Promise<boolean> {
  if (!token) token = process.env.MESSENGER_PAGE_ACCESS_TOKEN
  if (!token) { console.warn('[SENDER] Messenger token not set'); return false }
  const res  = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: opts.external_user_id }, message: { text: opts.content }, messaging_type: 'RESPONSE' }),
  })
  const data = await res.json()
  if (data.error) console.error('[SENDER] Messenger error:', data.error)
  return !data.error
}
