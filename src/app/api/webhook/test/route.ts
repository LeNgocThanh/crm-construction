// src/app/api/webhooks/test/route.ts — DEV ONLY
import { NextRequest, NextResponse } from 'next/server'
import { handleIncomingMessage } from '@/lib/bot/engine'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { Channel } from '@/lib/bot/engine'

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production')
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })

  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    channel         = 'zalo',
    user_id         = 'test_user_001',
    display_name    = 'Khách Test',
    content,
    conversation_id,
  } = body

  if (!content) return NextResponse.json({ error: 'Thiếu content' }, { status: 400 })
  if (!['zalo', 'messenger', 'telegram'].includes(channel))
    return NextResponse.json({ error: 'Channel không hợp lệ' }, { status: 400 })

  const result = await handleIncomingMessage({
    channel:          channel as Channel,
    external_conv_id: conversation_id || user_id,
    external_user_id: user_id,
    display_name,
    content,
    msg_type:         'text',
    external_msg_id:  `test_${Date.now()}`,
    timestamp:        new Date(),
  })

  return NextResponse.json({ result })
}
