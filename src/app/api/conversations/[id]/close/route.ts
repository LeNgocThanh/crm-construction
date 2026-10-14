// src/app/api/conversations/[id]/close/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { closeConversation } from '@/lib/bot/engine'
import { requireConversationAccess } from '@/lib/access-control'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireConversationAccess('write', params.id)
  if (auth.error) return auth.error

  const { reason = 'sales_closed' } = await req.json()
  await closeConversation(params.id, reason)
  return NextResponse.json({ message: 'Đã đóng conversation và đang phân tích...' })
}
