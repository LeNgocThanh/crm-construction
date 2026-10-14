import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createWorkSuggestion } from '@/lib/work-suggestions'
import { createUserNotification } from '@/lib/user-notifications'
import { logActionEventSafe } from '@/lib/action-timeline'
import { pushCustomerTimelineFromActionEventSafe } from '@/lib/action-customer-bridge'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

const VALID_STATUSES = new Set(['open', 'done', 'cancelled', 'overdue'])
const VALID_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent'])

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.customersRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const type = String(sp.get('activity_type') || '').trim()
  const phase = String(sp.get('pipeline_phase') || '').trim()
  const limitRaw = Number(sp.get('limit') || '100')
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.trunc(limitRaw))) : 100

  const where: any = { customer_id: params.id }
  if (type) where.activity_type = type
  if (phase) where.pipeline_phase = phase

  const data = await (db as any).customerCareActivity.findMany({
    where,
    orderBy: [{ happened_at: 'desc' }, { created_at: 'desc' }],
    take: limit,
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.customersWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json().catch(() => ({}))
  const activityType = String(body.activity_type || '').trim() || 'note'
  const summary = String(body.summary || '').trim()
  if (!summary) return NextResponse.json({ error: 'Thieu summary' }, { status: 400 })
  const statusRaw = String(body.status || '').trim().toLowerCase()
  const status = VALID_STATUSES.has(statusRaw) ? statusRaw : 'open'
  const priorityRaw = String(body.priority || '').trim().toLowerCase()
  const priority = VALID_PRIORITIES.has(priorityRaw) ? priorityRaw : 'normal'
  const ownerRaw = String(body.care_owner_id || '').trim()

  const customer = await db.customer.findUnique({
    where: { id: params.id },
    select: { id: true, assigned_to: true, full_name: true, phone_number: true },
  })
  if (!customer) return NextResponse.json({ error: 'Khong tim thay customer' }, { status: 404 })

  const ownerId = ownerRaw || customer.assigned_to || null
  const completedAtInput = body.completed_at ? new Date(body.completed_at) : null
  const completedByInput = body.completed_by ? String(body.completed_by).trim() : null

  const created = await (db as any).customerCareActivity.create({
    data: {
      customer_id: params.id,
      activity_type: activityType,
      summary,
      detail: body.detail ? String(body.detail) : null,
      next_action_snapshot: body.next_action_snapshot ? String(body.next_action_snapshot) : null,
      source_ref_type: body.source_ref_type ? String(body.source_ref_type) : null,
      source_ref_id: body.source_ref_id ? String(body.source_ref_id) : null,
      channel: body.channel ? String(body.channel) : null,
      pipeline_phase: body.pipeline_phase ? String(body.pipeline_phase) : null,
      happened_at: body.happened_at ? new Date(body.happened_at) : new Date(),
      due_at: body.due_at ? new Date(body.due_at) : null,
      created_by: session.user.id,
      care_owner_id: ownerId,
      status,
      priority,
      completed_at: status === 'done' ? (completedAtInput || new Date()) : completedAtInput,
      completed_by: status === 'done' ? (completedByInput || session.user.id) : completedByInput,
      outcome: body.outcome ? String(body.outcome) : null,
      metadata_json: body.metadata_json ?? null,
    },
  })

  if (body.next_action_snapshot !== undefined) {
    await db.customer.update({
      where: { id: params.id },
      data: { next_action: body.next_action_snapshot ? String(body.next_action_snapshot) : null },
    })
  }

  const nextActionText = String(body.next_action_snapshot || summary || '').trim()
  if (status === 'open' && nextActionText) {
    const suggestion = await createWorkSuggestion({
      customer_id: params.id,
      care_activity_id: created.id,
      source_ref_type: body.source_ref_type ? String(body.source_ref_type) : 'care_activity',
      source_ref_id: body.source_ref_id ? String(body.source_ref_id) : created.id,
      title: summary,
      detail: body.detail ? String(body.detail) : null,
      next_action_text: nextActionText,
      due_at: body.due_at ? new Date(body.due_at) : null,
      priority,
      created_by: session.user.id,
      primary_user_id: ownerId,
    })
    if (suggestion?.id) {
      await logActionEventSafe({
        work_suggestion_id: suggestion.id,
        customer_id: params.id,
        event_key: 'created',
        title: 'Tao action cham soc',
        description: nextActionText || summary,
        actor_user_id: session.user.id,
        metadata_json: {
          care_activity_id: created.id,
          due_at: body.due_at ? new Date(body.due_at).toISOString() : null,
          priority,
        },
      })
      await pushCustomerTimelineFromActionEventSafe({
        customer_id: params.id,
        work_suggestion_id: suggestion.id,
        event_key: 'created',
        title: summary,
        description: String(body.detail || '').trim() || nextActionText || summary,
        actor_user_id: session.user.id,
      })
    }
  }

  const actorId = String(session.user.id || '')
  const customerLabel = String((customer as any)?.full_name || (customer as any)?.phone_number || params.id)
  if (ownerId && ownerId !== actorId) {
    await createUserNotification({
      user_id: ownerId,
      type: 'care_owner_assigned',
      title: `Duoc phan cong cham soc: ${customerLabel}`,
      message: nextActionText || summary,
      source_type: 'care_activity',
      source_id: created.id,
      related_user_id: actorId,
      metadata_json: { customer_id: params.id, activity_id: created.id, event: 'created_and_assigned' },
    })
  }

  return NextResponse.json({ data: created }, { status: 201 })
}
