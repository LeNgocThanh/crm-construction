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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; activityId: string } }
) {
  const auth = await requirePermission(PERMISSIONS.customersWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const existing = await (db as any).customerCareActivity.findUnique({
    where: { id: params.activityId },
    select: {
      id: true,
      customer_id: true,
      summary: true,
      next_action_snapshot: true,
      status: true,
      care_owner_id: true,
      created_by: true,
      due_at: true,
      priority: true,
    },
  })
  if (!existing || existing.customer_id !== params.id) {
    return NextResponse.json({ error: 'Khong tim thay activity' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const data: any = {}
  if (body.activity_type !== undefined) data.activity_type = String(body.activity_type || '').trim() || 'note'
  if (body.summary !== undefined) data.summary = String(body.summary || '').trim()
  if (body.detail !== undefined) data.detail = body.detail ? String(body.detail) : null
  if (body.next_action_snapshot !== undefined) data.next_action_snapshot = body.next_action_snapshot ? String(body.next_action_snapshot) : null
  if (body.source_ref_type !== undefined) data.source_ref_type = body.source_ref_type ? String(body.source_ref_type) : null
  if (body.source_ref_id !== undefined) data.source_ref_id = body.source_ref_id ? String(body.source_ref_id) : null
  if (body.channel !== undefined) data.channel = body.channel ? String(body.channel) : null
  if (body.pipeline_phase !== undefined) data.pipeline_phase = body.pipeline_phase ? String(body.pipeline_phase) : null
  if (body.happened_at !== undefined) data.happened_at = body.happened_at ? new Date(body.happened_at) : new Date()
  if (body.due_at !== undefined) data.due_at = body.due_at ? new Date(body.due_at) : null
  if (body.care_owner_id !== undefined) data.care_owner_id = body.care_owner_id ? String(body.care_owner_id).trim() : null
  if (body.priority !== undefined) {
    const priority = String(body.priority || '').trim().toLowerCase()
    if (!VALID_PRIORITIES.has(priority)) {
      return NextResponse.json({ error: 'priority khong hop le' }, { status: 400 })
    }
    data.priority = priority
  }
  if (body.status !== undefined) {
    const status = String(body.status || '').trim().toLowerCase()
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'status khong hop le' }, { status: 400 })
    }
    data.status = status
  }
  if (body.completed_at !== undefined) data.completed_at = body.completed_at ? new Date(body.completed_at) : null
  if (body.completed_by !== undefined) data.completed_by = body.completed_by ? String(body.completed_by).trim() : null
  if (body.outcome !== undefined) data.outcome = body.outcome ? String(body.outcome) : null
  if (body.metadata_json !== undefined) data.metadata_json = body.metadata_json ?? null

  if (data.status === 'done') {
    if (data.completed_at === undefined || data.completed_at === null) data.completed_at = new Date()
    if (data.completed_by === undefined || data.completed_by === null) data.completed_by = session.user.id
  }
  if (data.status && data.status !== 'done') {
    if (body.completed_at === undefined) data.completed_at = null
    if (body.completed_by === undefined) data.completed_by = null
  }

  const updated = await (db as any).customerCareActivity.update({
    where: { id: params.activityId },
    data,
  })
  const customer = await db.customer.findUnique({
    where: { id: params.id },
    select: { id: true, full_name: true, phone_number: true, assigned_to: true },
  })

  if (body.next_action_snapshot !== undefined) {
    await db.customer.update({
      where: { id: params.id },
      data: { next_action: body.next_action_snapshot ? String(body.next_action_snapshot) : null },
    })
  }

  const nextActionText = String(updated.next_action_snapshot || updated.summary || '').trim()
  let linkedSuggestion = await (db as any).workSuggestion.findFirst({
    where: { care_activity_id: updated.id },
    orderBy: { created_at: 'desc' },
    select: { id: true },
  })
  if (updated.status === 'open' && nextActionText) {
    const createdSuggestion = await createWorkSuggestion({
      customer_id: params.id,
      care_activity_id: updated.id,
      source_ref_type: updated.source_ref_type || 'care_activity',
      source_ref_id: updated.source_ref_id || updated.id,
      title: updated.summary,
      detail: updated.detail || null,
      next_action_text: nextActionText,
      due_at: updated.due_at || null,
      priority: updated.priority || 'normal',
      created_by: session.user.id,
      primary_user_id: updated.care_owner_id || null,
    })
    if (!linkedSuggestion?.id && createdSuggestion?.id) {
      linkedSuggestion = { id: createdSuggestion.id }
      await logActionEventSafe({
        work_suggestion_id: createdSuggestion.id,
        customer_id: params.id,
        event_key: 'created',
        title: 'Tao action cham soc',
        description: nextActionText,
        actor_user_id: session.user.id,
      })
      await pushCustomerTimelineFromActionEventSafe({
        customer_id: params.id,
        work_suggestion_id: createdSuggestion.id,
        event_key: 'created',
        title: updated.summary,
        description: updated.detail || nextActionText || updated.summary,
        actor_user_id: session.user.id,
      })
    }
  }

  const actorId = String(session.user.id || '')
  const customerLabel = String(customer?.full_name || customer?.phone_number || params.id)
  const recipients = new Set<string>()
  const oldOwnerId = String(existing.care_owner_id || '').trim()
  const newOwnerId = String(updated.care_owner_id || '').trim()
  const oldNext = String(existing.next_action_snapshot || existing.summary || '').trim()
  const newNext = String(updated.next_action_snapshot || updated.summary || '').trim()
  const oldStatus = String(existing.status || '').trim()
  const newStatus = String(updated.status || '').trim()

  if (oldOwnerId !== newOwnerId) {
    if (linkedSuggestion?.id) {
      await logActionEventSafe({
        work_suggestion_id: linkedSuggestion.id,
        customer_id: params.id,
        event_key: oldOwnerId ? 'reassigned' : 'assigned',
        title: oldOwnerId ? 'Doi nguoi phu trach action' : 'Gan nguoi phu trach action',
        description: `from: ${oldOwnerId || '(none)'} -> to: ${newOwnerId || '(none)'}`,
        actor_user_id: session.user.id,
      })
      await pushCustomerTimelineFromActionEventSafe({
        customer_id: params.id,
        work_suggestion_id: linkedSuggestion.id,
        event_key: 'updated',
        title: 'Cap nhat hanh dong can lam',
        description: `Cu: ${oldNext || '(trong)'} | Moi: ${newNext || '(trong)'}`,
        actor_user_id: session.user.id,
      })
    }
    if (newOwnerId && newOwnerId !== actorId) {
      await createUserNotification({
        user_id: newOwnerId,
        type: 'care_owner_assigned',
        title: `Duoc phan cong cham soc: ${customerLabel}`,
        message: newNext || '(khong co next action)',
        source_type: 'care_activity',
        source_id: updated.id,
        related_user_id: actorId,
        metadata_json: { customer_id: params.id, activity_id: updated.id, event: 'owner_assigned' },
      })
    }
    if (oldOwnerId && oldOwnerId !== actorId) {
      await createUserNotification({
        user_id: oldOwnerId,
        type: 'care_owner_changed',
        title: `Khach hang duoc doi nguoi phu trach: ${customerLabel}`,
        message: `Nguoi phu trach moi: ${newOwnerId || '(bo gan)'}`,
        source_type: 'care_activity',
        source_id: updated.id,
        related_user_id: actorId,
        metadata_json: { customer_id: params.id, activity_id: updated.id, event: 'owner_changed' },
      })
    }
  }

  if (oldNext !== newNext) {
    if (linkedSuggestion?.id) {
      await logActionEventSafe({
        work_suggestion_id: linkedSuggestion.id,
        customer_id: params.id,
        event_key: 'updated',
        title: 'Cap nhat noi dung action',
        description: `Cu: ${oldNext || '(trong)'} | Moi: ${newNext || '(trong)'}`,
        actor_user_id: session.user.id,
      })
      await pushCustomerTimelineFromActionEventSafe({
        customer_id: params.id,
        work_suggestion_id: linkedSuggestion.id,
        event_key: 'done',
        title: 'Hoan tat hanh dong can lam',
        description: updated.outcome || newNext || oldNext || null,
        actor_user_id: session.user.id,
      })
    }
    if (newOwnerId) recipients.add(newOwnerId)
    const assigneeId = String(customer?.assigned_to || '').trim()
    if (assigneeId) recipients.add(assigneeId)
    for (const uid of recipients) {
      if (!uid || uid === actorId) continue
      await createUserNotification({
        user_id: uid,
        type: 'next_action_updated',
        title: `Next action duoc cap nhat: ${customerLabel}`,
        message: `Moi: ${newNext || '(trong)'} | Cu: ${oldNext || '(trong)'}`,
        source_type: 'care_activity',
        source_id: updated.id,
        related_user_id: actorId,
        metadata_json: { customer_id: params.id, activity_id: updated.id, event: 'next_action_updated' },
      })
    }
  }

  if (oldStatus !== 'done' && newStatus === 'done') {
    if (linkedSuggestion?.id) {
      await logActionEventSafe({
        work_suggestion_id: linkedSuggestion.id,
        customer_id: params.id,
        event_key: 'done',
        title: 'Hoan tat action',
        description: updated.outcome || newNext || oldNext || null,
        actor_user_id: session.user.id,
      })
    }
    recipients.clear()
    if (newOwnerId) recipients.add(newOwnerId)
    const creatorId = String(existing.created_by || '').trim()
    if (creatorId) recipients.add(creatorId)
    const assigneeId = String(customer?.assigned_to || '').trim()
    if (assigneeId) recipients.add(assigneeId)
    for (const uid of recipients) {
      if (!uid || uid === actorId) continue
      await createUserNotification({
        user_id: uid,
        type: 'next_action_done',
        title: `Hoan tat hanh dong can lam: ${customerLabel}`,
        message: newNext || oldNext || updated.outcome || '(khong co noi dung)',
        source_type: 'care_activity',
        source_id: updated.id,
        related_user_id: actorId,
        metadata_json: { customer_id: params.id, activity_id: updated.id, event: 'next_action_done' },
      })
    }
  }
  if (String(existing.priority || '') !== String(updated.priority || '') && linkedSuggestion?.id) {
    await logActionEventSafe({
      work_suggestion_id: linkedSuggestion.id,
      customer_id: params.id,
      event_key: 'priority_changed',
      title: 'Cap nhat do uu tien action',
      description: `Cu: ${String(existing.priority || '(trong)')} | Moi: ${String(updated.priority || '(trong)')}`,
      actor_user_id: session.user.id,
    })
  }
  const oldDueAt = existing.due_at ? new Date(existing.due_at).toISOString() : ''
  const newDueAt = updated.due_at ? new Date(updated.due_at).toISOString() : ''
  if (oldDueAt !== newDueAt && linkedSuggestion?.id) {
    await logActionEventSafe({
      work_suggestion_id: linkedSuggestion.id,
      customer_id: params.id,
      event_key: 'due_changed',
      title: 'Cap nhat han xu ly action',
      description: `Cu: ${oldDueAt || '(trong)'} | Moi: ${newDueAt || '(trong)'}`,
      actor_user_id: session.user.id,
    })
  }

  return NextResponse.json({ data: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; activityId: string } }
) {
  const auth = await requirePermission(PERMISSIONS.customersManage)
  if (auth.error) return auth.error

  const existing = await (db as any).customerCareActivity.findUnique({
    where: { id: params.activityId },
    select: { id: true, customer_id: true },
  })
  if (!existing || existing.customer_id !== params.id) {
    return NextResponse.json({ error: 'Khong tim thay activity' }, { status: 404 })
  }

  await (db as any).customerCareActivity.delete({ where: { id: params.activityId } })
  return NextResponse.json({ ok: true })
}
