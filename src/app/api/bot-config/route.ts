// src/app/api/bot-config/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireRoles } from '@/lib/authz'
import { db } from '@/lib/db'

const DEFAULT_CONFIGS = [
  { channel: 'zalo',      sensitive_keywords: ['giÃ¡', 'bÃ¡o giÃ¡', 'chi phÃ­', 'bao nhiÃªu tiá»n', 'giÃ¡ thÃ nh'] },
  { channel: 'messenger', sensitive_keywords: ['giÃ¡', 'bÃ¡o giÃ¡', 'chi phÃ­', 'bao nhiÃªu tiá»n', 'giÃ¡ thÃ nh'] },
  { channel: 'telegram',  sensitive_keywords: ['giÃ¡', 'bÃ¡o giÃ¡', 'chi phÃ­', 'bao nhiÃªu tiá»n', 'giÃ¡ thÃ nh'] },
]

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Äáº£m báº£o config tá»“n táº¡i cho cáº£ 2 channels
  for (const def of DEFAULT_CONFIGS) {
    await db.botConfig.upsert({
      where:  { channel: def.channel },
      create: { channel: def.channel, sensitive_keywords: def.sensitive_keywords },
      update: {},
    })
  }

  const configs = await db.botConfig.findMany({ orderBy: { channel: 'asc' } })
  return NextResponse.json({ data: configs })
}

export async function PUT(req: NextRequest) {
  const auth = await requireRoles(['admin', 'manager'])
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json()
  const { channel, ...updates } = body

  if (!['zalo', 'messenger', 'telegram'].includes(channel))
    return NextResponse.json({ error: 'Channel khÃ´ng há»£p lá»‡' }, { status: 400 })

  // Chá»‰ update fields há»£p lá»‡
  const allowed = [
    'is_enabled', 'offline_threshold_min', 'schedule_enabled',
    'schedule_start', 'schedule_end', 'timeout_close_min',
    'sensitive_keywords', 'welcome_msg', 'offline_msg',
    'callback_msg', 'ask_contact_msg', 'no_info_msg',
    'rag_enabled', 'rag_score_threshold',
    'bot_token', 'mock_mode',  // credentials â€” lÆ°u DB, khÃ´ng cáº§n restart
  ]

  const data: any = { updated_by: session.user.id }
  for (const key of allowed) {
    if (updates[key] !== undefined) data[key] = updates[key]
  }

  const config = await db.botConfig.upsert({
    where:  { channel },
    create: { channel, ...data },
    update: data,
  })

  return NextResponse.json({ data: config })
}

