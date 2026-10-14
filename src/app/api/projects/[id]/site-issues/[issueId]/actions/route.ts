import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { createProjectTimelineEvent } from '@/lib/project-timeline'
import { serializeProjectSiteIssue } from '@/lib/project-site-issues'
import { createUserNotification } from '@/lib/user-notifications'

function parseDate(value: any) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

async function ensureSubcontractor(id: string) {
  return (db as any).supplier.findFirst({
    where: {
      id,
      profile: { is: { supplier_type: 'contractor' } },
      is_active: true,
    },
    select: { id: true, supplier_name: true, supplier_code: true },
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string; issueId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error || !auth.ctx) return auth.error

  const projectId = String(params.id || '').trim()
  const issueId = String(params.issueId || '').trim()
  if (!projectId || !issueId) return NextResponse.json({ error: 'invalid_params' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const action = String(body?.action || '').trim()
  const detailText = body?.detail ? String(body.detail) : ''
  if (!action) return NextResponse.json({ error: 'action_required' }, { status: 400 })
  if (!['assign', 'start', 'submit_fix', 'verify', 'reopen', 'cancel', 'comment'].includes(action)) {
    return NextResponse.json({ error: 'action_not_supported' }, { status: 400 })
  }
  let assignSubcontractor: { id: string; supplier_name: string; supplier_code: string | null } | null = null
  if (action === 'assign' && body?.subcontractor_id !== undefined) {
    const subcontractorId = body?.subcontractor_id ? String(body.subcontractor_id).trim() : ''
    if (subcontractorId) {
      assignSubcontractor = await ensureSubcontractor(subcontractorId)
      if (!assignSubcontractor) {
        return NextResponse.json({ error: 'Thầu phụ không hợp lệ hoặc đã ngừng hoạt động' }, { status: 400 })
      }
    }
  }

  const existing = await (db as any).projectSiteIssue.findFirst({
    where: { id: issueId, project_id: projectId },
    include: {
      project: { select: { customer_id: true, owner_id: true, default_owner_id: true, project_name: true } },
      subcontractor: { select: { id: true, supplier_name: true, supplier_code: true } },
    },
  })
  if (!existing) return NextResponse.json({ error: 'Không tìm thấy lỗi hiện trường' }, { status: 404 })

  const result = await db.$transaction(async (tx) => {
    const patch: any = {}
    let eventKey = action
    let eventTitle = action
    let eventDetail = body?.detail ? String(body.detail) : null

    if (action === 'assign') {
      patch.assigned_to = body?.assigned_to ? String(body.assigned_to) : null
      if (body?.subcontractor_id !== undefined) {
        const subcontractorId = body?.subcontractor_id ? String(body.subcontractor_id).trim() : ''
        if (subcontractorId) {
          patch.subcontractor_id = subcontractorId
        } else {
          patch.subcontractor_id = null
        }
      }
      patch.status = patch.assigned_to ? 'assigned' : existing.status
      if (body?.due_at !== undefined) patch.due_at = parseDate(body?.due_at)
      eventKey = existing.assigned_to && patch.assigned_to && existing.assigned_to !== patch.assigned_to ? 'reassigned' : 'assigned'
      eventTitle = patch.assigned_to ? 'Phân công xử lý lỗi' : 'Bỏ phân công xử lý lỗi'
    } else if (action === 'start') {
      patch.status = 'in_progress'
      eventKey = 'started'
      eventTitle = 'Bắt đầu xử lý lỗi'
    } else if (action === 'submit_fix') {
      patch.status = 'fixed_waiting_verify'
      patch.fixed_at = new Date()
      eventKey = 'fixed_submitted'
      eventTitle = 'Báo đã khắc phục lỗi'
    } else if (action === 'verify') {
      patch.status = 'verified'
      patch.verified_at = new Date()
      patch.verified_by = auth.ctx.userId
      eventKey = 'verified'
      eventTitle = 'Nghiệm thu lỗi đạt'
    } else if (action === 'reopen') {
      patch.status = 'reopened'
      patch.verified_at = null
      patch.verified_by = null
      eventKey = 'reopened'
      eventTitle = 'Mở lại xử lý lỗi hiện trường'
    } else if (action === 'cancel') {
      patch.status = 'cancelled'
      patch.cancelled_at = new Date()
      patch.cancelled_by = auth.ctx.userId
      eventKey = 'cancelled'
      eventTitle = 'Hủy lỗi hiện trường'
    } else if (action === 'comment') {
      eventKey = 'commented'
      eventTitle = 'Thêm ghi chú xử lý'
    }

    if (body?.due_at !== undefined && action !== 'assign') patch.due_at = parseDate(body?.due_at)

    if (Object.keys(patch).length) {
      await (tx as any).projectSiteIssue.update({
        where: { id: issueId },
        data: patch,
      })
    }

    await (tx as any).projectSiteIssueEvent.create({
      data: {
        issue_id: issueId,
        event_key: eventKey,
        title: eventTitle,
        detail: eventDetail,
        actor_user_id: auth.ctx.userId,
        payload_json: {
          action,
          ...patch,
        },
      },
    })

    return (tx as any).projectSiteIssue.findFirst({
      where: { id: issueId, project_id: projectId },
      include: {
        reporter: { select: { id: true, username: true } },
        assignee: { select: { id: true, username: true } },
        subcontractor: { select: { id: true, supplier_name: true, supplier_code: true } },
        verifier: { select: { id: true, username: true } },
        canceller: { select: { id: true, username: true } },
        source_diary_entry: { select: { id: true, title: true, entry_date: true, shift_type: true } },
        media: {
          orderBy: { sort_order: 'asc' },
          include: { file_record: { select: { id: true, file_name: true, file_url: true, mime_type: true, file_size_bytes: true, purpose: true } } },
        },
        events: {
          orderBy: { created_at: 'desc' },
          include: { actor: { select: { id: true, username: true } } },
        },
      },
    })
  })
  if (!result) return NextResponse.json({ error: 'Không tìm thấy lỗi hiện trường' }, { status: 404 })

  await createProjectTimelineEvent({
    project_id: projectId,
    customer_id: existing.project?.customer_id || null,
    event_key: `project_site_issue_${action}`,
    title: `Cập nhật lỗi hiện trường: ${existing.issue_code}`,
    description: eventLabel(action),
    source_ref_type: 'project_site_issue',
    source_ref_id: issueId,
    actor_user_id: auth.ctx.userId,
  })

  if (action === 'assign' && (result as any)?.assigned_to && String((result as any)?.assigned_to || '') !== String(existing.assigned_to || '')) {
    const notifyTargets = new Set<string>()
    if ((result as any)?.assigned_to) notifyTargets.add(String((result as any).assigned_to))
    for (const uid of notifyTargets) {
      if (!uid) continue
      await createUserNotification({
        user_id: uid,
        type: 'project_site_issue_assigned',
        title: `Bạn được phân công xử lý lỗi: ${existing.issue_code}`,
        message: existing.title,
        status: 'pending',
        source_type: 'project_site_issue',
        source_id: issueId,
        related_user_id: auth.ctx.userId,
        metadata_json: {
          project_id: projectId,
          customer_id: existing.project?.customer_id || null,
          issue_code: existing.issue_code,
          action,
          due_at: (result as any)?.due_at ? new Date((result as any).due_at).toISOString() : null,
          project_name: existing.project?.project_name || null,
        },
      })
    }
  }

  if (['submit_fix', 'reopen', 'cancel', 'comment'].includes(action)) {
    const notifyTargets = new Set<string>()
    if (existing.reported_by) notifyTargets.add(String(existing.reported_by))
    if ((result as any)?.assigned_to) notifyTargets.add(String((result as any).assigned_to))
    if (existing.project?.owner_id) notifyTargets.add(String(existing.project.owner_id))
    if (existing.project?.default_owner_id) notifyTargets.add(String(existing.project.default_owner_id))
    notifyTargets.delete(String(auth.ctx.userId))

    for (const uid of notifyTargets) {
      if (!uid) continue
      await createUserNotification({
        user_id: uid,
        type: `project_site_issue_${eventNotificationKey(action)}`,
        title: `${eventLabel(action)}: ${existing.issue_code}`,
        message: `${existing.title}${detailText ? ` | ${detailText}` : ''}`,
        status: 'pending',
        source_type: 'project_site_issue',
        source_id: issueId,
        related_user_id: auth.ctx.userId,
        metadata_json: {
          project_id: projectId,
          customer_id: existing.project?.customer_id || null,
          project_name: existing.project?.project_name || null,
          issue_code: existing.issue_code,
          issue_type: existing.issue_type,
          workflow_type: existing.workflow_type,
          action,
          action_label: eventLabel(action),
          due_at: (result as any)?.due_at ? new Date((result as any).due_at).toISOString() : null,
        },
      })
    }
  }

  if (action === 'assign' && String((result as any)?.subcontractor_id || '') !== String((existing as any)?.subcontractor_id || '')) {
    const notifyTargets = new Set<string>()
    if ((result as any)?.assigned_to) notifyTargets.add(String((result as any).assigned_to))
    if ((existing as any)?.assigned_to) notifyTargets.add(String((existing as any).assigned_to))
    if ((existing as any)?.reported_by) notifyTargets.add(String((existing as any).reported_by))
    notifyTargets.delete(String(auth.ctx.userId))

    for (const uid of notifyTargets) {
      if (!uid) continue
      await createUserNotification({
        user_id: uid,
        type: 'project_site_issue_subcontractor_changed',
        title: `Issue ${existing.issue_code} đã cập nhật thầu phụ xử lý`,
        message: (result as any)?.subcontractor?.supplier_name || existing.title,
        status: 'pending',
        source_type: 'project_site_issue',
        source_id: issueId,
        related_user_id: auth.ctx.userId,
        metadata_json: {
          project_id: projectId,
          customer_id: existing.project?.customer_id || null,
          issue_code: existing.issue_code,
          subcontractor_id: (result as any)?.subcontractor?.id || null,
          subcontractor_name: (result as any)?.subcontractor?.supplier_name || null,
          previous_subcontractor_name: String((existing as any)?.subcontractor?.supplier_name || '').trim() || null,
        },
      })
    }
  }

  if (action === 'verify') {
    const notifyTargets = new Set<string>()
    if (existing.reported_by) notifyTargets.add(String(existing.reported_by))
    if (existing.assigned_to) notifyTargets.add(String(existing.assigned_to))
    for (const uid of notifyTargets) {
      if (!uid) continue
      await createUserNotification({
        user_id: uid,
        type: 'project_site_issue_verified',
          title: `Lỗi đã được nghiệm thu đạt: ${existing.issue_code}`,
        message: existing.title,
        status: 'pending',
        source_type: 'project_site_issue',
        source_id: issueId,
        related_user_id: auth.ctx.userId,
        metadata_json: {
          project_id: projectId,
          customer_id: existing.project?.customer_id || null,
          issue_code: existing.issue_code,
          action,
          action_label: eventLabel(action),
          project_name: existing.project?.project_name || null,
        },
      })
    }
  }

  return NextResponse.json({ data: serializeProjectSiteIssue(result) })
}

function eventLabel(action: string) {
  if (action === 'assign') return 'Phân công xử lý'
  if (action === 'start') return 'Bắt đầu xử lý'
  if (action === 'submit_fix') return 'Báo đã khắc phục'
  if (action === 'verify') return 'Nghiệm thu đạt'
  if (action === 'reopen') return 'Không đạt / mở lại'
  if (action === 'cancel') return 'Hủy'
  if (action === 'comment') return 'Thêm ghi chú'
  return action
}

function eventNotificationKey(action: string) {
  if (action === 'submit_fix') return 'fixed_submitted'
  if (action === 'reopen') return 'reopened'
  if (action === 'cancel') return 'cancelled'
  if (action === 'comment') return 'commented'
  return action
}
