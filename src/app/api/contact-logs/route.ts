// src/app/api/contact-logs/route.ts — V2.0 Prisma
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { extractFromText } from '@/lib/ai'
import { createCareActivitySafe } from '@/lib/customer-care'
import { createRequirementSnapshotSafe } from '@/lib/project-requirement-snapshots'
import { hasPermission, requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

const serializeLog = (log: any) => ({
  ...log,
  ext_budget: log.ext_budget ? Number(log.ext_budget) : null,
})

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.customersRead)
  if (auth.error || !auth.ctx) return auth.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session: any = auth.ctx.session

  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customer_id')
  const sentiment  = searchParams.get('sentiment')
  const dateFrom   = searchParams.get('date_from')
  const dateTo     = searchParams.get('date_to')
  const search     = searchParams.get('search')?.trim()
  const page       = parseInt(searchParams.get('page')  || '1')
  const limit      = parseInt(searchParams.get('limit') || '20')
  const canManageCustomers = hasPermission(auth.ctx, PERMISSIONS.customersManage)

  const where: any = {}
  if (customerId) where.customer_id = customerId
  else if (!canManageCustomers) where.sales_id = session.user.id
  if (sentiment) where.ai_sentiment = sentiment
  if (dateFrom || dateTo) {
    where.contact_date = {}
    if (dateFrom) where.contact_date.gte = new Date(dateFrom)
    if (dateTo)   where.contact_date.lte = new Date(dateTo + 'T23:59:59')
  }

  const [data, total] = await Promise.all([
    db.contactLog.findMany({
      where,
      orderBy: { contact_date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: { select: { id: true, phone_number: true, full_name: true } },
        sales:    { select: { username: true } },
      },
    }),
    db.contactLog.count({ where }),
  ])

  // Client-side search filter
  let filtered = data
  if (search) {
    const q = search.toLowerCase()
    filtered = data.filter(l =>
      l.customer?.phone_number?.includes(q)       ||
      l.customer?.full_name?.toLowerCase().includes(q) ||
      l.ai_summary?.toLowerCase().includes(q)     ||
      l.next_action?.toLowerCase().includes(q)    ||
      l.sales?.username?.toLowerCase().includes(q)
    )
  }

  const serialized = filtered.map(serializeLog)

  return NextResponse.json({
    data: serialized,
    total: search ? serialized.length : total,
    page, limit,
  })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.customersWrite)
  if (auth.error || !auth.ctx) return auth.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session: any = auth.ctx.session

  const body = await req.json()
  const { customer_id, manual_text, contact_date } = body
  if (!customer_id || !manual_text)
    return NextResponse.json({ error: 'Thiếu customer_id hoặc nội dung' }, { status: 400 })

  let aiResult
  try {
    aiResult = await extractFromText(manual_text)
  } catch (err: any) {
    aiResult = {
      full_name: null, address: null, house_type: null,
      floors: null, floor_area: null, estimated_budget: null,
      ai_summary:   manual_text.substring(0, 200),
      ai_sentiment: 'Trung lập' as const,
      next_action:  'Xem lại nội dung',
      lead_score:   5,
    }
  }

  const log = await db.contactLog.create({
    data: {
      customer_id,
      sales_id:         session.user.id,
      contact_date:     contact_date ? new Date(contact_date) : new Date(),
      transcription_raw: manual_text,
      ai_summary:        aiResult.ai_summary,
      ai_sentiment:      aiResult.ai_sentiment,
      next_action:       aiResult.next_action,
      ext_full_name:     aiResult.full_name     || null,
      ext_address:       aiResult.address       || null,
      ext_house_type:    aiResult.house_type    || null,
      ext_floors:        aiResult.floors        || null,
      ext_floor_area:    aiResult.floor_area    || null,
      ext_budget:        aiResult.estimated_budget ? BigInt(aiResult.estimated_budget) : null,
    },
  })

  await createRequirementSnapshotSafe({
    customer_id,
    source_type: 'manual',
    source_ref_id: log.id,
    extracted_json: aiResult || null,
    normalized_json: {
      address: aiResult.address || null,
      house_type: aiResult.house_type || null,
      floors: aiResult.floors ?? null,
      floor_area: aiResult.floor_area ?? null,
      estimated_budget: aiResult.estimated_budget ?? null,
      potential_score: aiResult.lead_score ?? null,
      next_action: aiResult.next_action || null,
      source_channel: 'call',
    },
    note: 'Auto snapshot from manual contact log',
    created_by: session.user.id,
  })

  await createCareActivitySafe({
    customer_id,
    activity_type: 'call',
    summary: 'Tao contact log thu cong',
    detail: aiResult.ai_summary || manual_text.substring(0, 500),
    next_action_snapshot: aiResult.next_action || null,
    source_ref_type: 'contact_log',
    source_ref_id: log.id,
    channel: 'call',
    created_by: session.user.id,
    metadata_json: {
      ai_sentiment: aiResult.ai_sentiment || null,
      lead_score: aiResult.lead_score || null,
    },
  })

  // Update customer
  const updates: any = {}
  if (aiResult.full_name)  updates.full_name  = aiResult.full_name
  if (aiResult.lead_score) updates.potential_score = aiResult.lead_score
  if (Object.keys(updates).length) {
    await db.customer.update({ where: { id: customer_id }, data: updates })
  }

  // Increment total_contacts
  await db.customer.update({
    where: { id: customer_id },
    data:  { total_contacts: { increment: 1 } },
  })

  return NextResponse.json({ data: { log: serializeLog(log), aiResult } }, { status: 201 })
}
