import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createUserNotification } from '@/lib/user-notifications'
import { logActionEventSafe } from '@/lib/action-timeline'
import { pushCustomerTimelineFromActionEventSafe } from '@/lib/action-customer-bridge'
import { hasRole, requireAuth } from '@/lib/authz'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth.error || !auth.ctx) return auth.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session = auth.ctx.session as any

  const body = await req.json().catch(() => ({}))
  const action = String(body?.action || '').trim().toLowerCase()
  const dueAt = body?.due_at ? new Date(body.due_at) : null
  const note = body?.note ? String(body.note) : null
  const assignTo = body?.assign_to ? String(body.assign_to) : null

  const suggestion = await (db as any).workSuggestion.findUnique({
    where: { id: params.id },
    include: {
      recipients: true,
    },
  })
  if (!suggestion) return NextResponse.json({ error: 'Khong tim thay suggestion' }, { status: 404 })

  const mine = suggestion.recipients.find((r: any) => r.user_id === session.user.id) || null
  const isManager = hasRole(auth.ctx, ['admin', 'manager'])
  if (!mine && !isManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (action === 'accept') {
    await (db as any).workSuggestionRecipient.updateMany({
      where: { suggestion_id: suggestion.id, user_id: session.user.id },
      data: { response_status: 'accepted', responded_at: new Date(), responded_by: session.user.id, note },
    })
    await (db as any).workSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: 'accepted',
        assigned_to: session.user.id,
        due_at: dueAt || suggestion.due_at,
      },
    })
    await (db as any).userNotification.updateMany({
      where: {
        user_id: session.user.id,
        source_type: 'work_suggestion',
        source_id: suggestion.id,
      },
      data: { status: 'accepted', acted_at: new Date(), read_at: new Date() },
    })
    if (suggestion.care_activity_id) {
      await (db as any).customerCareActivity.update({
        where: { id: suggestion.care_activity_id },
        data: {
          care_owner_id: session.user.id,
          due_at: dueAt || suggestion.due_at,
          status: 'open',
        },
      })
    }
    await logActionEventSafe({
      work_suggestion_id: suggestion.id,
      customer_id: suggestion.customer_id,
      event_key: 'accepted',
      title: 'Nhan viec',
      description: note || null,
      actor_user_id: session.user.id,
      metadata_json: { due_at: (dueAt || suggestion.due_at) ? new Date(dueAt || suggestion.due_at).toISOString() : null },
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'reject') {
    if (suggestion.status === 'assigned' && !String(note || '').trim()) {
      return NextResponse.json({ error: 'Reject do assign bat buoc nhap ly do' }, { status: 400 })
    }
    await (db as any).workSuggestionRecipient.updateMany({
      where: { suggestion_id: suggestion.id, user_id: session.user.id },
      data: { response_status: 'rejected', responded_at: new Date(), responded_by: session.user.id, note },
    })
    await (db as any).userNotification.updateMany({
      where: {
        user_id: session.user.id,
        source_type: 'work_suggestion',
        source_id: suggestion.id,
      },
      data: { status: 'rejected', acted_at: new Date(), read_at: new Date() },
    })
    const assignerId = suggestion.assigned_by ? String(suggestion.assigned_by) : ''
    if (assignerId && assignerId !== session.user.id) {
      await createUserNotification({
        user_id: assignerId,
        type: 'work_rejected',
        title: `Cong viec bi tu choi: ${suggestion.title}`,
        message: `Nguoi tu choi: ${session.user.username}. Ly do: ${String(note || '').trim() || '(khong co)'}`,
        status: 'pending',
        source_type: 'work_suggestion',
        source_id: suggestion.id,
        related_user_id: session.user.id,
        metadata_json: {
          suggestion_id: suggestion.id,
          customer_id: suggestion.customer_id,
          rejected_by: session.user.id,
          rejected_by_username: session.user.username,
          reason: String(note || '').trim() || null,
          due_at: suggestion.due_at ? new Date(suggestion.due_at).toISOString() : null,
          priority: suggestion.priority,
        },
      })
    }
    const pendingCount = await (db as any).workSuggestionRecipient.count({
      where: { suggestion_id: suggestion.id, response_status: 'pending' },
    })
    if (pendingCount === 0) {
      await (db as any).workSuggestion.update({
        where: { id: suggestion.id },
        data: { status: 'rejected' },
      })
    }
    await logActionEventSafe({
      work_suggestion_id: suggestion.id,
      customer_id: suggestion.customer_id,
      event_key: 'rejected',
      title: 'Tu choi viec',
      description: note || null,
      actor_user_id: session.user.id,
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'assign') {
    if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!assignTo) return NextResponse.json({ error: 'Thieu assign_to' }, { status: 400 })

    await (db as any).workSuggestionRecipient.upsert({
      where: { suggestion_id_user_id: { suggestion_id: suggestion.id, user_id: assignTo } },
      update: { role: 'primary', response_status: 'assigned', responded_at: new Date(), responded_by: session.user.id, note },
      create: { suggestion_id: suggestion.id, user_id: assignTo, role: 'primary', response_status: 'assigned', responded_at: new Date(), responded_by: session.user.id, note },
    })
    await (db as any).workSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: 'assigned',
        assigned_by: session.user.id,
        assigned_to: assignTo,
        due_at: dueAt || suggestion.due_at,
      },
    })
    await createUserNotification({
      user_id: assignTo,
      type: 'work_assigned',
      title: `Duoc giao viec: ${suggestion.title}`,
      message: suggestion.next_action_text || suggestion.detail || null,
      status: 'pending',
      source_type: 'work_suggestion',
      source_id: suggestion.id,
      related_user_id: session.user.id,
      metadata_json: {
        suggestion_id: suggestion.id,
        customer_id: suggestion.customer_id,
        assigned_by: session.user.id,
        assigned_by_username: session.user.username,
        due_at: (dueAt || suggestion.due_at) ? new Date(dueAt || suggestion.due_at).toISOString() : null,
        priority: suggestion.priority,
      },
    })
    if (suggestion.care_activity_id) {
      await (db as any).customerCareActivity.update({
        where: { id: suggestion.care_activity_id },
        data: {
          care_owner_id: assignTo,
          due_at: dueAt || suggestion.due_at,
          status: 'open',
        },
      })
    }
    await logActionEventSafe({
      work_suggestion_id: suggestion.id,
      customer_id: suggestion.customer_id,
      event_key: suggestion.assigned_to ? 'reassigned' : 'assigned',
      title: suggestion.assigned_to ? 'Phan cong lai' : 'Phan cong viec',
      description: `to: ${assignTo}`,
      actor_user_id: session.user.id,
      metadata_json: { due_at: (dueAt || suggestion.due_at) ? new Date(dueAt || suggestion.due_at).toISOString() : null },
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'done') {
    if (!mine && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await (db as any).workSuggestionRecipient.updateMany({
      where: { suggestion_id: suggestion.id, user_id: session.user.id },
      data: { response_status: 'done', responded_at: new Date(), responded_by: session.user.id, note },
    })
    await (db as any).workSuggestion.update({
      where: { id: suggestion.id },
      data: { status: 'done' },
    })
    await (db as any).userNotification.updateMany({
      where: {
        user_id: session.user.id,
        source_type: 'work_suggestion',
        source_id: suggestion.id,
      },
      data: { status: 'done', acted_at: new Date(), read_at: new Date() },
    })
    if (suggestion.care_activity_id) {
      await (db as any).customerCareActivity.update({
        where: { id: suggestion.care_activity_id },
        data: {
          status: 'done',
          completed_at: new Date(),
          completed_by: session.user.id,
          outcome: note || 'Hoan tat tu work suggestion',
        },
      })
    }
    await logActionEventSafe({
      work_suggestion_id: suggestion.id,
      customer_id: suggestion.customer_id,
      event_key: 'done',
      title: `${session.user.username} xac nhan da xu ly xong`,
      description: note || null,
      actor_user_id: session.user.id,
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'reschedule') {
    if (!mine && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!dueAt || Number.isNaN(dueAt.getTime())) {
      return NextResponse.json({ error: 'Reschedule can due_at hop le' }, { status: 400 })
    }
    const reason = String(note || '').trim()
    if (!reason) return NextResponse.json({ error: 'Reschedule bat buoc ly do' }, { status: 400 })

    const oldDueIso = suggestion.due_at ? new Date(suggestion.due_at).toISOString() : null
    const newDueIso = dueAt.toISOString()
    await (db as any).workSuggestion.update({
      where: { id: suggestion.id },
      data: {
        due_at: dueAt,
        metadata_json: {
          ...(suggestion.metadata_json || {}),
          reschedule: {
            old_due_at: oldDueIso,
            new_due_at: newDueIso,
            reason,
            changed_by: session.user.id,
            changed_by_username: session.user.username,
            changed_at: new Date().toISOString(),
          },
        },
      },
    })

    if (suggestion.care_activity_id) {
      await (db as any).customerCareActivity.update({
        where: { id: suggestion.care_activity_id },
        data: { due_at: dueAt },
      })
    }

    const notifyTargets = new Set<string>()
    if (suggestion.assigned_to) notifyTargets.add(String(suggestion.assigned_to))
    if (suggestion.assigned_by) notifyTargets.add(String(suggestion.assigned_by))
    for (const uid of notifyTargets) {
      if (!uid || uid === session.user.id) continue
      await createUserNotification({
        user_id: uid,
        type: 'work_updated',
        title: `Cap nhat han xu ly: ${suggestion.title}`,
        message: `Han moi: ${newDueIso} | Ly do: ${reason}`,
        status: 'pending',
        source_type: 'work_suggestion',
        source_id: suggestion.id,
        related_user_id: session.user.id,
        metadata_json: {
          suggestion_id: suggestion.id,
          customer_id: suggestion.customer_id,
          old_due_at: oldDueIso,
          new_due_at: newDueIso,
          reason,
        },
      })
    }

    await logActionEventSafe({
      work_suggestion_id: suggestion.id,
      customer_id: suggestion.customer_id,
      event_key: 'due_changed',
      title: 'Gia han/doi han xu ly',
      description: `Cu: ${oldDueIso || '(trong)'} | Moi: ${newDueIso} | Ly do: ${reason}`,
      actor_user_id: session.user.id,
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'cancel') {
    const isAssigner = String(suggestion.assigned_by || '') === String(session.user.id || '')
    if (!isManager && !isAssigner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const reason = String(note || '').trim()
    if (!reason) return NextResponse.json({ error: 'Cancel bat buoc ly do' }, { status: 400 })

    await (db as any).workSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: 'cancelled',
        metadata_json: {
          ...(suggestion.metadata_json || {}),
          cancel: {
            reason,
            cancelled_by: session.user.id,
            cancelled_by_username: session.user.username,
            cancelled_at: new Date().toISOString(),
          },
        },
      },
    })
    await (db as any).workSuggestionRecipient.updateMany({
      where: { suggestion_id: suggestion.id, response_status: { in: ['pending', 'accepted', 'assigned'] } },
      data: { response_status: 'dismissed', responded_at: new Date(), responded_by: session.user.id, note: reason },
    })
    await (db as any).userNotification.updateMany({
      where: {
        source_type: 'work_suggestion',
        source_id: suggestion.id,
        status: { in: ['pending', 'accepted', 'assigned'] },
      },
      data: { status: 'cancelled', acted_at: new Date(), read_at: new Date() },
    })

    if (suggestion.care_activity_id) {
      await (db as any).customerCareActivity.update({
        where: { id: suggestion.care_activity_id },
        data: {
          status: 'cancelled',
          outcome: `Huy action: ${reason}`,
        },
      })
    }

    const notifyTargets = new Set<string>()
    if (suggestion.assigned_to) notifyTargets.add(String(suggestion.assigned_to))
    if (suggestion.assigned_by) notifyTargets.add(String(suggestion.assigned_by))
    for (const uid of notifyTargets) {
      if (!uid || uid === session.user.id) continue
      await createUserNotification({
        user_id: uid,
        type: 'work_cancelled',
        title: `Action bi huy: ${suggestion.title}`,
        message: `Ly do: ${reason}`,
        status: 'pending',
        source_type: 'work_suggestion',
        source_id: suggestion.id,
        related_user_id: session.user.id,
        metadata_json: {
          suggestion_id: suggestion.id,
          customer_id: suggestion.customer_id,
          reason,
        },
      })
    }

    await logActionEventSafe({
      work_suggestion_id: suggestion.id,
      customer_id: suggestion.customer_id,
      event_key: 'cancelled',
      title: 'Huy action',
      description: reason,
      actor_user_id: session.user.id,
    })
    await pushCustomerTimelineFromActionEventSafe({
      customer_id: suggestion.customer_id,
      work_suggestion_id: suggestion.id,
      event_key: 'cancelled',
      title: suggestion.title,
      description: `Action bi huy. Ly do: ${reason}`,
      actor_user_id: session.user.id,
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Action khong hop le' }, { status: 400 })
}
