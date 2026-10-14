import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createUserNotification } from '@/lib/user-notifications'
import { logActionEventSafe } from '@/lib/action-timeline'
import { pushCustomerTimelineFromActionEventSafe } from '@/lib/action-customer-bridge'
import { BASIC_USER_WITH_ROLE_SELECT, mapBasicUserWithRole } from '@/lib/user-profiles'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const bucket = String(sp.get('bucket') || '').trim() // today | overdue | next3 | all
  const mine = String(sp.get('mine') || '1').trim() !== '0'
  const status = String(sp.get('status') || '').trim().toLowerCase()
  const customerId = String(sp.get('customer_id') || '').trim()

  const now = new Date()
  const startToday = new Date(now)
  startToday.setHours(0, 0, 0, 0)
  const endToday = new Date(startToday)
  endToday.setDate(endToday.getDate() + 1)
  const endNext3 = new Date(endToday)
  endNext3.setDate(endNext3.getDate() + 3)

  const dueFilter: any = {}
  if (bucket === 'overdue') dueFilter.lt = now
  if (bucket === 'today') {
    dueFilter.gte = startToday
    dueFilter.lt = endToday
  }
  if (bucket === 'next3') {
    dueFilter.gte = endToday
    dueFilter.lt = endNext3
  }

  const where: any = {}
  if (status) {
    where.status = status
  } else {
    where.status = { in: ['pending', 'accepted', 'assigned'] }
  }
  if (customerId) where.customer_id = customerId
  if (Object.keys(dueFilter).length) where.due_at = dueFilter
  if (mine) {
    where.recipients = { some: { user_id: session.user.id } }
  }

  const data = await (db as any).workSuggestion.findMany({
    where,
    orderBy: [{ due_at: 'asc' }, { created_at: 'desc' }],
    take: 200,
    include: {
      customer: { select: { id: true, full_name: true, phone_number: true, assigned_to: true } },
      recipients: {
        include: { user: { select: BASIC_USER_WITH_ROLE_SELECT } },
      },
    },
  })

  return NextResponse.json({
    data: data.map((row: any) => ({
      ...row,
      recipients: Array.isArray(row.recipients)
        ? row.recipients.map((recipient: any) => ({
            ...recipient,
            user: recipient.user ? mapBasicUserWithRole(recipient.user) : null,
          }))
        : [],
    })),
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const title = String(body?.title || '').trim()
  const detail = body?.detail ? String(body.detail) : null
  const customerIdRaw = String(body?.customer_id || '').trim()
  const isInternal = Boolean(body?.is_internal)
  const assigneeRaw = String(body?.assigned_to || '').trim()
  const dueAtRaw = body?.due_at ? new Date(body.due_at) : null
  const priorityRaw = String(body?.priority || 'normal').trim().toLowerCase()
  const customerId = customerIdRaw || null
  const assignedTo = assigneeRaw || session.user.id

  if (!title) return NextResponse.json({ error: 'Thieu title' }, { status: 400 })
  if (!customerId && !isInternal) {
    return NextResponse.json({ error: 'Thieu customer_id (hoac bat action noi bo)' }, { status: 400 })
  }
  if (!['low', 'normal', 'high', 'urgent'].includes(priorityRaw)) {
    return NextResponse.json({ error: 'priority khong hop le' }, { status: 400 })
  }

  if (customerId) {
    const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } })
    if (!customer) return NextResponse.json({ error: 'Khong tim thay customer' }, { status: 404 })
  }
  const assignee = await db.user.findUnique({
    where: { id: assignedTo },
    select: { id: true, username: true, is_active: true },
  })
  if (!assignee || assignee.is_active === false) {
    return NextResponse.json({ error: 'Nguoi phu trach khong hop le' }, { status: 400 })
  }

  const suggestion = await (db as any).workSuggestion.create({
    data: {
      customer_id: customerId,
      source_ref_type: 'manual_task',
      source_ref_id: null,
      title,
      detail,
      next_action_text: title,
      due_at: dueAtRaw,
      priority: priorityRaw,
      status: 'assigned',
      created_by: session.user.id,
      assigned_by: session.user.id,
      assigned_to: assignedTo,
      metadata_json: {
        created_from: 'api/work-suggestions',
        manual_task: true,
        no_customer: !customerId,
        is_internal: isInternal || !customerId,
      },
    },
  })

  await (db as any).workSuggestionRecipient.upsert({
    where: { suggestion_id_user_id: { suggestion_id: suggestion.id, user_id: assignedTo } },
    update: { role: 'primary', response_status: 'assigned', responded_at: new Date(), responded_by: session.user.id },
    create: { suggestion_id: suggestion.id, user_id: assignedTo, role: 'primary', response_status: 'assigned', responded_at: new Date(), responded_by: session.user.id },
  })

  await createUserNotification({
    user_id: assignedTo,
    type: 'work_assigned',
    title: `Duoc giao viec: ${title}`,
    message: detail || null,
    status: 'pending',
    source_type: 'work_suggestion',
    source_id: suggestion.id,
    related_user_id: session.user.id,
    metadata_json: {
      suggestion_id: suggestion.id,
      customer_id: customerId,
      due_at: dueAtRaw ? dueAtRaw.toISOString() : null,
      priority: priorityRaw,
      manual_task: true,
      is_internal: isInternal || !customerId,
    },
  })

  await logActionEventSafe({
    work_suggestion_id: suggestion.id,
    customer_id: customerId,
    event_key: 'created',
    title: 'Tao action thu cong',
    description: detail || title,
    actor_user_id: session.user.id,
    metadata_json: {
      due_at: dueAtRaw ? dueAtRaw.toISOString() : null,
      priority: priorityRaw,
    },
  })
  if (customerId) {
    await pushCustomerTimelineFromActionEventSafe({
      customer_id: customerId,
      work_suggestion_id: suggestion.id,
      event_key: 'created',
      title,
      description: detail || title,
      actor_user_id: session.user.id,
    })
  }

  return NextResponse.json({ data: suggestion }, { status: 201 })
}
