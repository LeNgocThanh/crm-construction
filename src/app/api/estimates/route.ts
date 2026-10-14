import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listRecentQuotes } from '@/lib/estimate/engine'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const customerId = sp.get('customer_id')
  const limit = Math.min(Number(sp.get('limit') || '20'), 100)
  const data = await listRecentQuotes(customerId, Number.isFinite(limit) ? limit : 20)
  return NextResponse.json({ data })
}

