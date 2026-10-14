// src/app/api/alerts/stream/route.ts
// Server-Sent Events — push real-time alerts tới browser
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return new Response('Unauthorized', { status: 401 })

  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      // Send heartbeat ngay lập tức
      send({ type: 'connected', ts: Date.now() })

      // Poll DB mỗi 5 giây cho alerts mới
      const interval = setInterval(async () => {
        if (closed) { clearInterval(interval); return }

        try {
          const since = new Date(Date.now() - 6000) // 6 giây trước

          // Conversations urgent/callback mới
          const alerts = await db.conversation.findMany({
            where: {
              status:     'active',
              updated_at: { gte: since },
              OR: [
                { is_urgent:      true },
                { needs_callback: true },
              ],
            },
            select: {
              id: true, channel: true, display_name: true,
              is_urgent: true, needs_callback: true,
              messages: {
                where:   { direction: 'in' },
                orderBy: { created_at: 'desc' },
                take:    1,
                select:  { content: true },
              },
            },
            take: 5,
          })

          for (const conv of alerts) {
            send({
              type:         conv.is_urgent ? 'urgent' : 'callback',
              conv_id:      conv.id,
              channel:      conv.channel,
              display_name: conv.display_name || 'Khách không tên',
              preview:      conv.messages[0]?.content?.substring(0, 80) || '',
              ts:           Date.now(),
            })
          }

          // Unread message count
          const unreadCount = await db.message.count({
            where: { direction: 'in', is_read: false },
          })
          send({ type: 'unread_count', count: unreadCount, ts: Date.now() })

          // Any conversation updated recently (new chat, status change, etc.)
          const changed = await db.conversation.findMany({
            where: {
              updated_at: { gte: since },
            },
            select: { id: true, last_message_at: true, status: true },
            orderBy: { updated_at: 'desc' },
            take: 20,
          })
          for (const c of changed) {
            send({
              type: 'conversation_update',
              conv_id: c.id,
              status: c.status,
              last_message_at: c.last_message_at,
              ts: Date.now(),
            })
          }

        } catch (err) {
          // DB error — ignore
        }
      }, 5000)

      // Heartbeat mỗi 25 giây (tránh timeout)
      const heartbeat = setInterval(() => {
        if (closed) { clearInterval(heartbeat); return }
        send({ type: 'ping', ts: Date.now() })
      }, 25000)

      req.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(interval)
        clearInterval(heartbeat)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
