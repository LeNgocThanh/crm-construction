// src/app/api/conversations/[id]/messages/[msgId]/feedback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireConversationAccess } from '@/lib/access-control'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; msgId: string } }
) {
  const auth = await requireConversationAccess('write', params.id)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const { feedback } = await req.json() // 'liked' | 'disliked' | null

  const msg = await db.message.findUnique({ where: { id: params.msgId } })
  if (!msg || msg.conversation_id !== params.id)
    return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })

  if (msg.sender_type !== 'bot')
    return NextResponse.json({ error: 'Chỉ feedback tin bot' }, { status: 400 })

  const updated = await db.message.update({
    where: { id: params.msgId },
    data: {
      feedback:    feedback || null,
      feedback_by: feedback ? session.user.id : null,
      feedback_at: feedback ? new Date() : null,
      rag_status:  feedback === 'liked'
        ? 'pending'
        : (msg.rag_status === 'pending' ? null : msg.rag_status),
    },
  })

  return NextResponse.json({ data: updated })
}
