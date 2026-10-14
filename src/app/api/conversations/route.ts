// src/app/api/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.conversationsRead)
  if (auth.error) return auth.error

  const { searchParams } = new URL(req.url)
  const channel  = searchParams.get('channel')   // zalo | messenger | all
  const status   = searchParams.get('status')    // active | closed | pending_callback
  const urgent   = searchParams.get('urgent')
  const callback = searchParams.get('callback')
  const search   = searchParams.get('search')?.trim()
  const page     = parseInt(searchParams.get('page')  || '1')
  const limit    = parseInt(searchParams.get('limit') || '30')

  const where: any = {}
  if (channel && channel !== 'all') where.channel = channel
  if (status)   where.status        = status
  if (urgent === 'true')   where.is_urgent      = true
  if (callback === 'true') where.needs_callback = true

  if (search) {
    where.OR = [
      { display_name:     { contains: search, mode: 'insensitive' } },
      { external_user_id: { contains: search } },
    ]
  }

  const [data, total] = await Promise.all([
    db.conversation.findMany({
      where,
      orderBy: [
        { is_urgent:      'desc' },
        { needs_callback: 'desc' },
        { last_message_at: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1, // chỉ lấy tin nhắn mới nhất cho preview
        },
        analysis: {
          select: {
            stage: true, attitude: true,
            close_probability: true, summary: true,
          },
        },
        _count: {
          select: { messages: { where: { direction: 'in', is_read: false } } },
        },
      },
    }),
    db.conversation.count({ where }),
  ])

  return NextResponse.json({ data, total, page, limit })
}
