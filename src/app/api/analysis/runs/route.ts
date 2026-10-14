import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const customerId = sp.get('customer_id')
  const conversationId = sp.get('conversation_id')
  const profileKey = sp.get('profile_key')
  const limit = Math.min(parseInt(sp.get('limit') || '30', 10), 100)

  const where: any = {}
  if (customerId) where.customer_id = customerId
  if (conversationId) where.conversation_id = conversationId
  if (profileKey) where.profile_key = profileKey

  const runs = await db.analysisRun.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: limit,
    include: {
      facts: true,
      profile: { select: { key: true, name: true, required_fields: true } },
    },
  })

  return NextResponse.json({ data: runs })
}

