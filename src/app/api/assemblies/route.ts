import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
  ) as T
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const customerId = String(sp.get('customer_id') || '').trim()
  const summaryOnly = String(sp.get('summary_only') || 'false') === 'true'
  const pageRaw = Number(sp.get('page') || 1)
  const limitRaw = Number(sp.get('limit') || 50)
  const page = Number.isFinite(pageRaw) ? Math.max(1, Math.trunc(pageRaw)) : 1
  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.trunc(limitRaw))) : 50

  const where: any = {}
  if (customerId) where.customer_id = customerId

  const prismaAny = db as any
  const total = await prismaAny.projectAssembly.count({ where })
  const data = summaryOnly
    ? await prismaAny.projectAssembly.findMany({
        where,
        orderBy: [{ updated_at: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          customer_id: true,
          house_type: true,
          style: true,
          level: true,
          region_code: true,
          status: true,
          updated_at: true,
          _count: {
            select: {
              blocks: {
                where: { is_active: true },
              },
            },
          },
        },
      })
    : await prismaAny.projectAssembly.findMany({
        where,
        orderBy: [{ updated_at: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          blocks: {
            where: { is_active: true },
            orderBy: [{ level_index: 'asc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
            include: { template: true },
          },
        },
      })

  const totalPages = Math.max(1, Math.ceil(total / limit))
  return NextResponse.json({ data: jsonSafe(data), pagination: { page, limit, total, totalPages } })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const name = String(body?.name || '').trim()
  if (!name) return NextResponse.json({ error: 'Thieu name' }, { status: 400 })

  const prismaAny = db as any
  const data = await prismaAny.projectAssembly.create({
    data: {
      customer_id: body?.customer_id ? String(body.customer_id) : null,
      name,
      house_type: body?.house_type ? String(body.house_type) : null,
      style: body?.style ? String(body.style) : null,
      level: body?.level ? String(body.level) : null,
      region_code: body?.region_code ? String(body.region_code) : 'ALL',
      status: body?.status ? String(body.status) : 'draft',
      created_by: session.user.id,
    },
  })

  return NextResponse.json({ data: jsonSafe(data) }, { status: 201 })
}
