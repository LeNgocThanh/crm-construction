// src/app/api/webhook-logs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { pruneOldLogs } from '@/lib/bot/logger'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp      = new URL(req.url).searchParams
  const channel = sp.get('channel') || undefined
  const status  = sp.get('status')  || undefined
  const dir     = sp.get('direction') || undefined
  const limit   = Math.min(parseInt(sp.get('limit') || '100'), 200)

  const where: any = {}
  if (channel) where.channel   = channel
  if (status)  where.status    = status
  if (dir)     where.direction = dir

  const [logs, counts] = await Promise.all([
    db.webhookLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take:    limit,
      select: {
        id: true, channel: true, direction: true, event_type: true,
        chat_id: true, content: true, status: true, error: true,
        duration_ms: true, created_at: true,
        // raw chỉ lấy khi client yêu cầu cụ thể
      },
    }),
    db.webhookLog.groupBy({
      by: ['status'],
      _count: true,
      where: { created_at: { gte: new Date(Date.now() - 24*60*60*1000) } },
    }),
  ])

  return NextResponse.json({ data: logs, counts })
}

// GET single log with raw payload
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, id } = await req.json()

  if (action === 'get_raw' && id) {
    const log = await db.webhookLog.findUnique({ where: { id } })
    return NextResponse.json({ data: log })
  }

  if (action === 'prune') {
    const count = await pruneOldLogs()
    return NextResponse.json({ deleted: count })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
