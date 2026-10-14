import { NextRequest, NextResponse } from 'next/server'
import { reopenConversation } from '@/lib/bot/engine'
import { requireConversationAccess } from '@/lib/access-control'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireConversationAccess('write', params.id)
  if (auth.error) return auth.error

  const conv = await reopenConversation(params.id)
  return NextResponse.json({ data: conv, message: 'Da mo lai conversation' })
}
