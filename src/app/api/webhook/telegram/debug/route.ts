// src/app/api/webhooks/telegram/debug/route.ts
// Dùng để debug Telegram bot — CHỈ dùng khi dev
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 400 })

  const [meRes, whRes, updatesRes] = await Promise.all([
    fetch(`https://api.telegram.org/bot${token}/getMe`),
    fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`),
    // Chỉ lấy updates nếu KHÔNG có webhook (polling mode)
    fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=5&timeout=0`),
  ])

  const [me, wh, updates] = await Promise.all([
    meRes.json(), whRes.json(), updatesRes.json()
  ])

  return NextResponse.json({
    bot:     me.result || null,
    webhook: wh.result || null,
    // Nếu có webhook, getUpdates sẽ trả về conflict error — đó là bình thường
    recent_updates_note: wh.result?.url
      ? 'Webhook đang active — updates đi qua webhook, không qua polling'
      : updates.result?.slice(0, 3) || [],
    env: {
      mock_mode:      process.env.BOT_MOCK_MODE,
      nextauth_url:   process.env.NEXTAUTH_URL,
      has_bot_token:  !!token,
      has_secret:     !!process.env.TELEGRAM_WEBHOOK_SECRET,
    }
  })
}

// POST — gửi test message từ bot tới chat_id bất kỳ
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { chat_id, text } = await req.json()
  if (!chat_id || !text) return NextResponse.json({ error: 'Thiếu chat_id hoặc text' }, { status: 400 })

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'Token not set' }, { status: 400 })

  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id, text, parse_mode: 'HTML' }),
  })
  const d = await r.json()
  return NextResponse.json(d)
}
