import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

type Ctx = { params: { id: string } }

function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
  ) as T
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = String(ctx.params.id || '')
  const prismaAny = db as any
  const data = await prismaAny.projectAssembly.findUnique({
    where: { id },
    include: {
      blocks: {
        orderBy: [{ is_active: 'desc' }, { level_index: 'asc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
        include: { template: true },
      },
      customer: true,
    },
  })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data: jsonSafe(data) })
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = String(ctx.params.id || '')
  const body = await req.json()
  const patch: any = {}
  if (body?.name !== undefined) patch.name = String(body.name || '').trim()
  if (body?.house_type !== undefined) patch.house_type = body.house_type ? String(body.house_type) : null
  if (body?.style !== undefined) patch.style = body.style ? String(body.style) : null
  if (body?.level !== undefined) patch.level = body.level ? String(body.level) : null
  if (body?.region_code !== undefined) patch.region_code = body.region_code ? String(body.region_code) : 'ALL'
  if (body?.status !== undefined) patch.status = body.status ? String(body.status) : 'draft'
  if (body?.customer_id !== undefined) patch.customer_id = body.customer_id ? String(body.customer_id) : null
  if (patch.name !== undefined && !patch.name) {
    return NextResponse.json({ error: 'name khong duoc rong' }, { status: 400 })
  }

  const prismaAny = db as any
  const data = await prismaAny.projectAssembly.update({
    where: { id },
    data: patch,
  })
  return NextResponse.json({ data: jsonSafe(data) })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = String(ctx.params.id || '')
  const prismaAny = db as any
  await prismaAny.projectAssembly.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
