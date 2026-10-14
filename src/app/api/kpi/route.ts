// src/app/api/kpi/route.ts â€” V2.0 Prisma
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, hasRole } from '@/lib/authz'
import { db } from '@/lib/db'
import { BASIC_USER_WITH_ROLE_SELECT, mapBasicUserWithRole } from '@/lib/user-profiles'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') || (() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })()

  const [y, m] = month.split('-').map(Number)
  const startDate = new Date(y, m - 1, 1)
  const endDate = new Date(y, m, 0, 23, 59, 59)
  const isAM = hasRole(auth.ctx!, ['admin', 'manager'])

  const salesList = await db.user.findMany({
    where: {
      is_active: true,
      role_memberships: isAM
        ? { some: { role: { is_active: true, role_key: { in: ['admin', 'manager', 'sales'] } } } }
        : undefined,
      id: isAM ? undefined : session.user.id,
    },
    select: BASIC_USER_WITH_ROLE_SELECT,
  })

  const kpiData = await Promise.all(salesList.map(async (staff) => {
    const logs = await db.contactLog.findMany({
      where: {
        sales_id: staff.id,
        contact_date: { gte: startDate, lte: endDate },
      },
      select: { ai_sentiment: true, contact_date: true },
    })

    const total = logs.length
    const positive = logs.filter((l) => l.ai_sentiment === 'TÃ­ch cá»±c').length
    const neutral = logs.filter((l) => l.ai_sentiment === 'Trung láº­p').length
    const negative = logs.filter((l) => l.ai_sentiment === 'Gay gáº¯t').length
    const activeDays = new Set(logs.map((l) => l.contact_date.toISOString().split('T')[0])).size

    return {
      staff: mapBasicUserWithRole(staff),
      total_calls: total,
      positive,
      neutral,
      negative,
      active_days: activeDays,
      avg_per_day: activeDays > 0 ? (total / activeDays).toFixed(1) : '0',
      conversion_rate: total > 0 ? Math.round((positive / total) * 100) : 0,
      score: Math.min(Math.round((total / 30) * 50 + (total > 0 ? (positive / total) * 50 : 0)), 100),
    }
  }))

  return NextResponse.json({
    data: kpiData,
    period: { start: startDate.toISOString(), end: endDate.toISOString() },
  })
}

