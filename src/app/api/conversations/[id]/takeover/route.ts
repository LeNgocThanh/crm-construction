// src/app/api/conversations/[id]/takeover/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { takeoverConversation, releaseConversation } from '@/lib/bot/engine'
import { requireConversationAccess } from '@/lib/access-control'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireConversationAccess('manage', params.id)
  if (auth.error) return auth.error

  const { action } = await req.json() // 'take' | 'release'

  if (action === 'take') {
    const conv = await takeoverConversation(params.id)
    return NextResponse.json({ data: conv, message: 'Bot đã tắt — bạn đang xử lý' })
  }

  if (action === 'release') {
    const conv = await releaseConversation(params.id)
    return NextResponse.json({ data: conv, message: 'Bot đã được bật lại' })
  }

  return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 })
}
