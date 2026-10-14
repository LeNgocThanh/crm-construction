// src/app/api/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const CUSTOMER_STATUSES = [
  'Mới',
  'Đang tìm hiểu',
  'Hẹn gặp',
  'Đang thương thảo',
  'Chờ ký HĐ',
  'Đã ký HĐ',
  'Đang thi công',
  'Hoàn công',
  'Bảo hành',
  'Hoàn tất',
  'Tạm ngưng',
  'Từ chối',
] as const

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('vi-VN', { month: 'short', year: '2-digit' }),
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
    }
  })

  const [monthlyCustomers, monthlyCalls] = await Promise.all([
    Promise.all(months.map(async (m) => ({
      ...m,
      count: await db.customer.count({ where: { created_at: { gte: m.start, lte: m.end } } }),
    }))),
    Promise.all(months.map(async (m) => ({
      ...m,
      count: await db.contactLog.count({ where: { contact_date: { gte: m.start, lte: m.end } } }),
    }))),
  ])

  const [allCustomers, projects, houseTypeDist] = await Promise.all([
    db.customer.findMany({ select: { status: true, potential_score: true } }),
    db.constructionProject.findMany({ select: { estimated_budget: true, house_type: true } }),
    db.constructionProject.groupBy({ by: ['house_type'], _count: { house_type: true } }),
  ])

  const funnel: Record<string, number> = Object.fromEntries(
    CUSTOMER_STATUSES.map((status) => [status, 0])
  )
  allCustomers.forEach((customer) => {
    if (customer.status in funnel) funnel[customer.status]++
  })

  const scoreHistogram = Array.from({ length: 10 }, (_, i) => ({
    score: i + 1,
    count: allCustomers.filter((customer) => customer.potential_score === i + 1).length,
  }))

  const budgetBuckets = [
    { label: '< 500tr', min: 0, max: 500_000_000 },
    { label: '500tr-1tỷ', min: 500_000_000, max: 1_000_000_000 },
    { label: '1-2 tỷ', min: 1_000_000_000, max: 2_000_000_000 },
    { label: '2-5 tỷ', min: 2_000_000_000, max: 5_000_000_000 },
    { label: '> 5 tỷ', min: 5_000_000_000, max: Infinity },
  ].map((bucket) => ({
    ...bucket,
    count: projects.filter((project) => {
      const value = project.estimated_budget ? Number(project.estimated_budget) : 0
      return value >= bucket.min && value < bucket.max
    }).length,
  }))

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000)
  const recentLogs = await db.contactLog.findMany({
    where: { contact_date: { gte: ninetyDaysAgo } },
    select: { contact_date: true },
  })

  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0))
  recentLogs.forEach((log) => {
    heatmap[log.contact_date.getDay()][log.contact_date.getHours()]++
  })

  const lastTwo = monthlyCustomers.slice(-2)
  const callLastTwo = monthlyCalls.slice(-2)

  return NextResponse.json({
    monthlyCustomers,
    monthlyCalls,
    funnel,
    scoreHistogram,
    budgetBuckets,
    houseTypeDist: Object.fromEntries(
      houseTypeDist.map((houseType) => [houseType.house_type || 'Khác', houseType._count.house_type])
    ),
    heatmap,
    growth: {
      customers: lastTwo[0].count > 0 ? Math.round(((lastTwo[1].count - lastTwo[0].count) / lastTwo[0].count) * 100) : null,
      calls: callLastTwo[0].count > 0 ? Math.round(((callLastTwo[1].count - callLastTwo[0].count) / callLastTwo[0].count) * 100) : null,
    },
    totals: { customers: allCustomers.length, projects: projects.length },
  })
}
