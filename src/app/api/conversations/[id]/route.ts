// src/app/api/conversations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireConversationAccess } from '@/lib/access-control'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireConversationAccess('read', params.id)
  if (auth.error) return auth.error

  const conv = await db.conversation.findUnique({
    where: { id: params.id },
    include: {
      messages: { orderBy: { created_at: 'asc' } },
      analysis: true,
      bot_sessions: { orderBy: { started_at: 'desc' }, take: 5 },
    },
  })
  if (!conv) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })

  // Mark messages as read
  await db.message.updateMany({
    where: { conversation_id: params.id, direction: 'in', is_read: false },
    data:  { is_read: true },
  })

  // Serialize BigInt
  const serialized = {
    ...conv,
    analysis: conv.analysis ? {
      ...conv.analysis,
      extracted_budget: conv.analysis.extracted_budget
        ? Number(conv.analysis.extracted_budget) : null,
    } : null,
  }

  return NextResponse.json({ data: serialized })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireConversationAccess('write', params.id)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json().catch(() => ({}))
  const guidance = typeof body?.bot_guidance_text === 'string'
    ? body.bot_guidance_text.trim()
    : ''

  const conv = await db.conversation.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!conv) return NextResponse.json({ error: 'KhÃ´ng tÃ¬m tháº¥y' }, { status: 404 })

  const existed = await db.conversationAnalysis.findUnique({
    where: { conversation_id: params.id },
    select: { id: true, sentiment_timeline: true },
  })

  const prevMeta = (existed?.sentiment_timeline && typeof existed.sentiment_timeline === 'object')
    ? (existed.sentiment_timeline as Record<string, unknown>)
    : {}

  const nextMeta: Record<string, unknown> = {
    ...prevMeta,
    bot_guidance_text: guidance || null,
    bot_guidance_updated_at: new Date().toISOString(),
    bot_guidance_updated_by: session.user.id,
  }

  if (existed) {
    await db.conversationAnalysis.update({
      where: { id: existed.id },
      data: { sentiment_timeline: nextMeta as any },
    })
  } else {
    await db.conversationAnalysis.create({
      data: {
        conversation_id: params.id,
        model_used: 'manual_guidance',
        sentiment_timeline: nextMeta as any,
      },
    })
  }

  return NextResponse.json({ ok: true, bot_guidance_text: guidance || null })
}
