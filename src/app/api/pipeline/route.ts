// src/app/api/pipeline/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasRole, requireAuth } from '@/lib/authz'
import { db } from '@/lib/db'

const PIPELINE_STATUSES = [
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

function safe(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'bigint') return Number(value)
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(safe)
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>))
      out[key] = safe(entry)
    return out
  }
  return value
}

function emptyColumns() {
  return Object.fromEntries(PIPELINE_STATUSES.map((status) => [status, []])) as Record<string, any[]>
}

export async function GET() {
  const auth = await requireAuth()
  if (auth.error) return auth.error
  const session = auth.ctx!.session

  const isAdminOrManager = hasRole(auth.ctx!, ['admin', 'manager'])
  let customerIds: string[] | undefined

  if (!isAdminOrManager) {
    const logs = await db.contactLog.findMany({
      where: { sales_id: session.user.id },
      select: { customer_id: true },
      distinct: ['customer_id'],
    })
    customerIds = logs.map((log) => log.customer_id)
    if (customerIds.length === 0) {
      return NextResponse.json({ columns: emptyColumns() })
    }
  }

  const data = await db.customer.findMany({
    where: customerIds ? { id: { in: customerIds } } : {},
    orderBy: [{ potential_score: 'desc' }, { updated_at: 'desc' }],
    take: 300,
  })

  const columns = emptyColumns()
  data.forEach((customer) => {
    if (customer.status in columns) columns[customer.status].push(safe(customer))
  })

  return NextResponse.json({ columns })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status } = await req.json()
  if (!id || !PIPELINE_STATUSES.includes(status))
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 })

  const customer = await db.customer.update({ where: { id }, data: { status } })
  return NextResponse.json({ data: safe(customer) })
}
