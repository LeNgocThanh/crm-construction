// src/app/api/setup/route.ts
// Đọc và cập nhật .env.local + đăng ký Telegram webhook
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireRoles } from '@/lib/authz'
import fs from 'fs'
import path from 'path'

const ENV_PATH = path.join(process.cwd(), '.env.local')

function readEnv(): Record<string, string> {
  if (!fs.existsSync(ENV_PATH)) return {}
  const map: Record<string, string> = {}
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const m = line.match(/^([^#\s][^=]*)=(.*)$/)
    if (m) map[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return map
}

function writeEnvKey(key: string, value: string) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : ''
  const quoted = `"${value}"`
  const regex  = new RegExp(`^#?\\s*${key}=.*$`, 'm')
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${quoted}`)
  } else {
    content = content.trimEnd() + `\n${key}=${quoted}\n`
  }
  fs.writeFileSync(ENV_PATH, content, 'utf8')
}

// GET — trả về current config (masked)
export async function GET(req: NextRequest) {
  const auth = await requireRoles(['admin', 'manager'])
  if (auth.error) return auth.error

  const env  = readEnv()
  const mask = (v?: string) => v ? `${v.slice(0, 8)}…${v.slice(-4)}` : ''

  return NextResponse.json({
    data: {
      nextauth_url:    env.NEXTAUTH_URL     || '',
      mock_mode:       env.BOT_MOCK_MODE    || 'true',
      has_tg_token:    !!env.TELEGRAM_BOT_TOKEN,
      tg_token_masked: env.TELEGRAM_BOT_TOKEN ? mask(env.TELEGRAM_BOT_TOKEN) : '',
      tg_secret:       env.TELEGRAM_WEBHOOK_SECRET || '',
      has_groq:        !!env.GROQ_API_KEY && !env.GROQ_API_KEY.includes('your-'),
    }
  })
}

// POST — save + optionally register webhook
export async function POST(req: NextRequest) {
  const auth = await requireRoles(['admin', 'manager'])
  if (auth.error) return auth.error

  const body   = await req.json()
  const action = body.action as string

  // ── Verify token trước khi lưu ──────────────────────────────────
  if (action === 'verify_token') {
    const t = body.token?.trim()
    if (!t) return NextResponse.json({ error: 'Thiếu token' }, { status: 400 })
    try {
      const r = await fetch(`https://api.telegram.org/bot${t}/getMe`, { signal: AbortSignal.timeout(6000) })
      const d = await r.json()
      return NextResponse.json({ data: { valid: d.ok, bot: d.ok ? d.result : null, error: d.ok ? null : d.description } })
    } catch (e: any) {
      return NextResponse.json({ data: { valid: false, error: e.message } })
    }
  }

  // ── Lưu config + đăng ký webhook ────────────────────────────────
  if (action === 'save_and_register') {
    const { tg_token, tg_secret, tunnel_url } = body
    const cleanUrl  = (tunnel_url || '').trim().replace(/\/$/, '')
    const useToken  = (tg_token  || '').trim()
    const useSecret = (tg_secret || 'crm-tg-secret-2026').trim()

    const saved: string[] = []

    if (useToken)  { writeEnvKey('TELEGRAM_BOT_TOKEN', useToken);      saved.push('TELEGRAM_BOT_TOKEN') }
    if (useSecret) { writeEnvKey('TELEGRAM_WEBHOOK_SECRET', useSecret); saved.push('TELEGRAM_WEBHOOK_SECRET') }
    if (cleanUrl)  {
      writeEnvKey('NEXTAUTH_URL',    cleanUrl)
      writeEnvKey('UPLOAD_URL_BASE', `${cleanUrl}/uploads`)
      saved.push('NEXTAUTH_URL')
    }
    writeEnvKey('BOT_MOCK_MODE', 'false')
    saved.push('BOT_MOCK_MODE=false')

    // Register webhook nếu có đủ thông tin
    let webhook: any = null
    const finalToken = useToken  || readEnv().TELEGRAM_BOT_TOKEN
    const finalUrl   = cleanUrl  || readEnv().NEXTAUTH_URL || ''

    if (finalToken && finalUrl && !finalUrl.includes('localhost')) {
      const webhookUrl = `${finalUrl}/api/webhook/telegram`
      try {
        const r = await fetch(`https://api.telegram.org/bot${finalToken}/setWebhook`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url:                  webhookUrl,
            secret_token:         useSecret,
            allowed_updates:      ['message', 'callback_query'],
            drop_pending_updates: true,
          }),
          signal: AbortSignal.timeout(8000),
        })
        const d = await r.json()
        webhook = { ok: d.ok, url: webhookUrl, description: d.description }
      } catch (e: any) {
        webhook = { ok: false, error: e.message }
      }
    }

    return NextResponse.json({
      data: {
        saved,
        webhook,
        restart_required: true,
        message: webhook?.ok
          ? '✅ Đã lưu và đăng ký webhook thành công! Restart server để áp dụng.'
          : '💾 Đã lưu cấu hình. Restart server để áp dụng.',
      }
    })
  }

  // ── Chỉ đăng ký webhook (dùng env hiện tại) ─────────────────────
  if (action === 'register_only') {
    const env        = readEnv()
    const token      = (body.tg_token  || env.TELEGRAM_BOT_TOKEN  || '').trim()
    const secret     = (body.tg_secret || env.TELEGRAM_WEBHOOK_SECRET || 'crm-tg-secret-2026').trim()
    const rawUrl     = (body.tunnel_url || env.NEXTAUTH_URL || '').trim().replace(/\/$/, '')

    if (!token) return NextResponse.json({ error: 'Chưa có TELEGRAM_BOT_TOKEN' }, { status: 400 })
    if (!rawUrl || rawUrl.includes('localhost'))
      return NextResponse.json({ error: 'Cần URL HTTPS public (không phải localhost)' }, { status: 400 })

    if (rawUrl !== env.NEXTAUTH_URL) writeEnvKey('NEXTAUTH_URL', rawUrl)

    const webhookUrl = `${rawUrl}/api/webhook/telegram`
    const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, secret_token: secret, allowed_updates: ['message','callback_query'], drop_pending_updates: true }),
      signal: AbortSignal.timeout(8000),
    })
    const d = await r.json()
    return NextResponse.json({ data: { ok: d.ok, webhook_url: webhookUrl, description: d.description } })
  }

  return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 })
}