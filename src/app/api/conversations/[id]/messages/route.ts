// src/app/api/conversations/[id]/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendSalesMessageFromWeb } from '@/lib/bot/engine'
import { requireConversationAccess } from '@/lib/access-control'

// GET — load messages (với pagination)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireConversationAccess('read', params.id)
  if (auth.error) return auth.error

  const { searchParams } = new URL(req.url)
  const before = searchParams.get('before')  // cursor-based pagination
  const limit  = parseInt(searchParams.get('limit') || '50')

  const messages = await db.message.findMany({
    where: {
      conversation_id: params.id,
      ...(before ? { created_at: { lt: new Date(before) } } : {}),
    },
    orderBy: { created_at: 'asc' },
    take: limit,
  })

  // Mark all incoming as read
  await db.message.updateMany({
    where: { conversation_id: params.id, direction: 'in', is_read: false },
    data:  { is_read: true },
  })

  return NextResponse.json({ data: messages })
}

// POST — sales gửi tin từ web
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireConversationAccess('write', params.id)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Thiếu nội dung' }, { status: 400 })

  try {
    const msg = await sendSalesMessageFromWeb({
      convId:        params.id,
      content:       content.trim(),
      salesId:       session.user.id,
      salesUsername: session.user.username,
    })
    return NextResponse.json({ data: msg }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
