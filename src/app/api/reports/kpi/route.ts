// src/app/api/reports/kpi/route.ts â€” V2.0 Prisma
import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/authz'
import { db } from '@/lib/db'
import { BASIC_USER_WITH_ROLE_SELECT, mapBasicUserWithRole } from '@/lib/user-profiles'

export async function GET(req: NextRequest) {
  const auth = await requireRoles(['admin', 'manager'])
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
  const monthLabel = startDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })

  const allStaff = await db.user.findMany({
    where: { is_active: true },
    orderBy: { username: 'asc' },
    select: BASIC_USER_WITH_ROLE_SELECT,
  })

  const staffStats = await Promise.all(allStaff.map(async (staff) => {
    const logs = await db.contactLog.findMany({
      where: { sales_id: staff.id, contact_date: { gte: startDate, lte: endDate } },
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

  const totalCallsAll = staffStats.reduce((s, x) => s + x.total_calls, 0)
  const totalPositive = staffStats.reduce((s, x) => s + x.positive, 0)

  const [newCustomers, closedCustomers, totalCustomers, hotLeads] = await Promise.all([
    db.customer.count({ where: { created_at: { gte: startDate, lte: endDate } } }),
    db.customer.count({ where: { status: 'ÄÃ£ chá»‘t', updated_at: { gte: startDate, lte: endDate } } }),
    db.customer.count(),
    db.customer.findMany({
      where: { potential_score: { gte: 7 }, status: { not: 'ÄÃ£ chá»‘t' } },
      orderBy: { potential_score: 'desc' },
      take: 10,
      select: { id: true, phone_number: true, full_name: true, potential_score: true, status: true, total_contacts: true },
    }),
  ])

  return NextResponse.json({
    month,
    monthLabel,
    period: { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] },
    generatedAt: new Date().toISOString(),
    generatedBy: session.user.username,
    overview: {
      totalCalls: totalCallsAll,
      totalPositive,
      totalNegative: staffStats.reduce((s, x) => s + x.negative, 0),
      conversionRate: totalCallsAll > 0 ? Math.round((totalPositive / totalCallsAll) * 100) : 0,
      newCustomers,
      closedCustomers,
      totalCustomers,
    },
    staffStats: staffStats.sort((a, b) => b.total_calls - a.total_calls),
    hotLeads,
  })
}

