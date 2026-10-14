// src/app/api/webhooks/status/route.ts â€” Kiá»ƒm tra tráº¡ng thÃ¡i káº¿t ná»‘i tá»«ng platform
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireRoles } from '@/lib/authz'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const results: Record<string, any> = {}

  // â”€â”€ Zalo: check token báº±ng cÃ¡ch gá»i get profile OA
  const zaloToken = process.env.ZALO_OA_ACCESS_TOKEN
  if (zaloToken) {
    try {
      const r = await fetch('https://openapi.zalo.me/v2.0/oa/getoa', {
        headers: { 'access_token': zaloToken },
        signal: AbortSignal.timeout(5000),
      })
      const d = await r.json()
      results.zalo = d.error === 0
        ? { connected: true,  name: d.data?.name || 'OA', avatar: d.data?.avatar }
        : { connected: false, error: d.message || `Code ${d.error}` }
    } catch (e: any) {
      results.zalo = { connected: false, error: e.message }
    }
  } else {
    results.zalo = { connected: false, error: 'ChÆ°a cáº¥u hÃ¬nh ZALO_OA_ACCESS_TOKEN' }
  }

  // â”€â”€ Messenger: check page token
  const messengerToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN
  if (messengerToken) {
    try {
      const r = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${messengerToken}&fields=id,name`, {
        signal: AbortSignal.timeout(5000),
      })
      const d = await r.json()
      results.messenger = d.id
        ? { connected: true,  name: d.name || 'Page', page_id: d.id }
        : { connected: false, error: d.error?.message || 'Token khÃ´ng há»£p lá»‡' }
    } catch (e: any) {
      results.messenger = { connected: false, error: e.message }
    }
  } else {
    results.messenger = { connected: false, error: 'ChÆ°a cáº¥u hÃ¬nh MESSENGER_PAGE_ACCESS_TOKEN' }
  }

  // â”€â”€ Telegram: check bot token + webhook status
  const tgToken = process.env.TELEGRAM_BOT_TOKEN
  if (tgToken) {
    try {
      const [meRes, whRes] = await Promise.all([
        fetch(`https://api.telegram.org/bot${tgToken}/getMe`, { signal: AbortSignal.timeout(5000) }),
        fetch(`https://api.telegram.org/bot${tgToken}/getWebhookInfo`, { signal: AbortSignal.timeout(5000) }),
      ])
      const me = await meRes.json()
      const wh = await whRes.json()
      if (me.ok) {
        results.telegram = {
          connected:       true,
          name:            me.result?.first_name || 'Bot',
          username:        me.result?.username,
          webhook_url:     wh.result?.url || '',
          webhook_set:     !!(wh.result?.url),
          pending_updates: wh.result?.pending_update_count || 0,
          last_error:      wh.result?.last_error_message || null,
        }
      } else {
        results.telegram = { connected: false, error: 'Token khÃ´ng há»£p lá»‡' }
      }
    } catch (e: any) {
      results.telegram = { connected: false, error: e.message }
    }
  } else {
    results.telegram = { connected: false, error: 'ChÆ°a cáº¥u hÃ¬nh TELEGRAM_BOT_TOKEN' }
  }

  // â”€â”€ Mock mode status
  results.mock_mode   = process.env.BOT_MOCK_MODE === 'true'
  results.app_url     = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  results.checked_at  = new Date().toISOString()

  return NextResponse.json({ data: results })
}

// POST: setup Telegram webhook
export async function POST(req: NextRequest) {
  const auth = await requireRoles(['admin', 'manager'])
  if (auth.error) return auth.error

  const { action, public_url } = await req.json()

  if (action === 'setup_telegram') {
    const token  = process.env.TELEGRAM_BOT_TOKEN
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET || ''
    if (!token) return NextResponse.json({ error: 'ChÆ°a cáº¥u hÃ¬nh TELEGRAM_BOT_TOKEN' }, { status: 400 })

    const webhookUrl = `${public_url}/api/webhooks/telegram`
    const body: any  = { url: webhookUrl, allowed_updates: ['message', 'callback_query'] }
    if (secret) body.secret_token = secret

    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const d = await r.json()
      if (d.ok) return NextResponse.json({ success: true, message: d.description, webhook_url: webhookUrl })
      return NextResponse.json({ success: false, error: d.description }, { status: 400 })
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
  }

  if (action === 'delete_telegram_webhook') {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) return NextResponse.json({ error: 'ChÆ°a cáº¥u hÃ¬nh token' }, { status: 400 })
    const r = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`)
    const d = await r.json()
    return NextResponse.json({ success: d.ok, message: d.description })
  }

  return NextResponse.json({ error: 'Action khÃ´ng há»£p lá»‡' }, { status: 400 })
}

