// src/app/api/customers/route.ts â€” V3.0
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

function safeJson<T>(payload: T): T {
  return JSON.parse(
    JSON.stringify(payload, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))
  ) as T
}

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

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.customersRead)
  if (auth.error) return auth.error

  const sp      = new URL(req.url).searchParams
  const search  = sp.get('search')?.trim()
  const status  = sp.get('status')
  const source  = sp.get('source')
  const ctype   = sp.get('type')
  const level   = sp.get('potential_level')
  const house   = sp.get('house_type')
  const assigned = sp.get('assigned_to')
  const view    = sp.get('view') || 'list'  // list | kanban
  const page    = parseInt(sp.get('page')  || '1')
  const limit   = parseInt(sp.get('limit') || '50')

  const where: any = {}
  if (status)   where.status           = status
  if (source)   where.source           = source
  if (ctype)    where.type             = ctype
  if (level)    where.potential_level  = level
  if (house)    where.house_type       = house
  if (assigned) where.assigned_to      = assigned
  if (search)   where.OR = [
    { phone_number: { contains: search } },
    { full_name:    { contains: search, mode: 'insensitive' } },
    { telegram_username: { contains: search, mode: 'insensitive' } },
    { zalo_username:     { contains: search, mode: 'insensitive' } },
  ]

  // Kanban: láº¥y táº¥t cáº£ khÃ´ng phÃ¢n trang, group theo status
  if (view === 'kanban') {
    const data = await db.customer.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      select: {
        id: true, full_name: true, phone_number: true, status: true, type: true,
        potential_score: true, potential_level: true,
        house_type: true, budget_min: true, budget_max: true,
        source: true, assigned_to: true,
        telegram_username: true, zalo_username: true, messenger_username: true,
        updated_at: true, created_at: true,
        _count: { select: { contact_logs: true } },
      },
    })
    return NextResponse.json(safeJson({ data: safe(data), total: data.length }))
  }

  // List: cÃ³ phÃ¢n trang + sort
  const sortField = sp.get('sort') || 'created_at'
  const sortDir   = (sp.get('dir') || 'desc') as 'asc' | 'desc'
  const orderBy: any = { [sortField]: sortDir }

  const [data, total] = await Promise.all([
    db.customer.findMany({
      where, orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, full_name: true, phone_number: true, status: true, type: true,
        potential_score: true, potential_level: true,
        house_type: true, budget_min: true, budget_max: true,
        source: true, assigned_to: true,
        telegram_username: true, zalo_username: true, messenger_username: true,
        total_contacts: true, updated_at: true, created_at: true,
        _count: { select: { contact_logs: true } },
      },
    }),
    db.customer.count({ where }),
  ])

  return NextResponse.json(safeJson({ data: safe(data), total, page, limit }))
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.customersWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json()
  const { phone_number, full_name, status, source, potential_score, type,
          telegram_id, telegram_username,
          zalo_id, zalo_username,
          messenger_id, messenger_username, facebook } = body

  const normalizedPhone = typeof phone_number === 'string' ? phone_number.trim() : ''
  const normalizedFullName = typeof full_name === 'string' ? full_name.trim() : ''
  const normalizedSource = typeof source === 'string' ? source.trim() : ''
  const normalizedType = typeof type === 'string' ? type.trim().toLowerCase() : ''
  const customerType = normalizedType || 'unverified'
  if (!['unverified', 'verified'].includes(customerType)) {
    return NextResponse.json({ error: 'type khong hop le (unverified | verified)' }, { status: 400 })
  }
  const normalizedZalo = typeof zalo_username === 'string' ? zalo_username.trim() : ''
  const normalizedMessenger =
    typeof messenger_username === 'string' ? messenger_username.trim()
    : typeof facebook === 'string' ? facebook.trim()
    : ''

  // Check duplicate náº¿u cÃ³ SÄT
  if (normalizedPhone) {
    const existing = await db.customer.findUnique({ where: { phone_number: normalizedPhone } })
    if (existing) return NextResponse.json(safeJson({ error: 'Sá»‘ Ä‘iá»‡n thoáº¡i Ä‘Ã£ tá»“n táº¡i', existing: safe(existing) }), { status: 409 })
  }

  const customer = await db.customer.create({
    data: {
      phone_number:       normalizedPhone || null,
      full_name:          normalizedFullName || null,
      status:             status         || 'Mới',
      type:               customerType,
      potential_score:    potential_score ?? null,
      source:             normalizedSource || null,
      telegram_id:        telegram_id    || null,
      telegram_username:  telegram_username || null,
      zalo_id:            zalo_id        || null,
      zalo_username:      normalizedZalo || null,
      messenger_id:       messenger_id   || null,
      messenger_username: normalizedMessenger || null,
      created_at:         new Date(),
    },
  })

  await db.customerTimeline.create({
    data: {
      customer_id: customer.id,
      type: 'customer_created',
      title: 'Khởi tạo khách hàng thủ công',
      description: normalizedSource
        ? `Nguồn: ${normalizedSource}${body?.referrer_name ? ` | Người giới thiệu: ${String(body.referrer_name)}` : ''}`
        : (body?.referrer_name ? `Người giới thiệu: ${String(body.referrer_name)}` : null),
      happened_at: customer.created_at || new Date(),
      created_by: session.user.id,
      metadata: {
        source: normalizedSource || 'manual',
        referrer_name: body?.referrer_name ? String(body.referrer_name) : null,
        referrer_phone: body?.referrer_phone ? String(body.referrer_phone) : null,
        created_from: 'api/customers',
      },
    },
  })

  return NextResponse.json(safeJson({ data: safe(customer) }), { status: 201 })
}


