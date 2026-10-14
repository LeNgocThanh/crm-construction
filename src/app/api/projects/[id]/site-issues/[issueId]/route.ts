import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { createProjectTimelineEvent } from '@/lib/project-timeline'
import { normalizeUploadUrl, serializeProjectSiteIssue } from '@/lib/project-site-issues'
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

export async function GET(_: NextRequest, { params }: { params: { id: string; issueId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error

  const projectId = String(params.id || '').trim()
  const issueId = String(params.issueId || '').trim()
  if (!projectId || !issueId) return NextResponse.json({ error: 'invalid_params' }, { status: 400 })

  const row = await (db as any).projectSiteIssue.findFirst({
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
  if (!row) return NextResponse.json({ error: 'Khong tim thay loi hien truong' }, { status: 404 })

  return NextResponse.json({ data: serializeProjectSiteIssue(row) })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; issueId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error || !auth.ctx) return auth.error

  const projectId = String(params.id || '').trim()
  const issueId = String(params.issueId || '').trim()
  if (!projectId || !issueId) return NextResponse.json({ error: 'invalid_params' }, { status: 400 })

  const existing = await (db as any).projectSiteIssue.findFirst({
    where: { id: issueId, project_id: projectId },
    include: {
      project: { select: { customer_id: true } },
      subcontractor: { select: { id: true, supplier_name: true, supplier_code: true } },
    },
  })
  if (!existing) return NextResponse.json({ error: 'Khong tim thay loi hien truong' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const patch: any = {}
  if (body?.title !== undefined) patch.title = String(body?.title || '').trim() || existing.title
  if (body?.detail !== undefined) patch.detail = body?.detail ? String(body.detail) : null
  if (body?.severity !== undefined) patch.severity = body?.severity ? String(body.severity) : 'medium'
  if (body?.location_text !== undefined) patch.location_text = body?.location_text ? String(body.location_text) : null
  if (body?.floor_label !== undefined) patch.floor_label = body?.floor_label ? String(body.floor_label) : null
  if (body?.area_label !== undefined) patch.area_label = body?.area_label ? String(body.area_label) : null
  if (body?.assigned_to !== undefined) patch.assigned_to = body?.assigned_to ? String(body.assigned_to) : null
  if (body?.subcontractor_id !== undefined) {
    const subcontractorId = body?.subcontractor_id ? String(body.subcontractor_id).trim() : ''
    if (subcontractorId) {
      const subcontractor = await ensureSubcontractor(subcontractorId)
      if (!subcontractor) return NextResponse.json({ error: 'Thầu phụ không hợp lệ' }, { status: 400 })
      patch.subcontractor_id = subcontractorId
    } else {
      patch.subcontractor_id = null
    }
  }
  if (body?.due_at !== undefined) patch.due_at = parseDate(body?.due_at)
  if (body?.marker_json !== undefined) patch.marker_json = body?.marker_json ?? null
  if (body?.metadata_json !== undefined) patch.metadata_json = body?.metadata_json ?? null
  const mediaNew = Array.isArray(body?.media_new) ? body.media_new : []
  const mediaKeepIds = Array.isArray(body?.media_keep_ids) ? body.media_keep_ids.map((x: any) => String(x || '').trim()).filter(Boolean) : null

  const updated = await db.$transaction(async (tx) => {
    const row = await (tx as any).projectSiteIssue.update({
      where: { id: issueId },
      data: patch,
    })
    if (mediaKeepIds) {
      await (tx as any).projectSiteIssueMedia.deleteMany({
        where: {
          issue_id: issueId,
          ...(mediaKeepIds.length ? { id: { notIn: mediaKeepIds } } : {}),
        },
      })
    }
    for (let i = 0; i < mediaNew.length; i++) {
      const m = mediaNew[i]
      const fileRecordId = m?.file_record_id ? String(m.file_record_id).trim() : ''
      const fileRecord = fileRecordId
        ? await (tx as any).fileRecord.findFirst({ where: { id: fileRecordId, is_active: true } })
        : null
      const fileUrl = normalizeUploadUrl(String(m?.file_url || fileRecord?.file_url || '').trim())
      if (!fileUrl) continue
      await (tx as any).projectSiteIssueMedia.create({
        data: {
          issue_id: issueId,
          file_record_id: fileRecord?.id || null,
          file_url: fileUrl,
          file_type: m?.file_type ? String(m.file_type) : null,
          media_role: m?.media_role ? String(m.media_role) : 'other',
          caption: m?.caption ? String(m.caption) : null,
          sort_order: Number(m?.sort_order ?? i),
          metadata_json: m?.metadata_json ?? null,
        },
      })
    }
    await (tx as any).projectSiteIssueEvent.create({
      data: {
        issue_id: issueId,
        event_key: 'updated',
        title: 'Cap nhat loi hien truong',
        detail: body?.detail ? String(body.detail) : null,
        actor_user_id: auth.ctx.userId,
        payload_json: {
          ...patch,
          media_kept: mediaKeepIds ? mediaKeepIds.length : null,
          media_added: mediaNew.length,
        },
      },
    })
    return row
  })

  await createProjectTimelineEvent({
    project_id: projectId,
    customer_id: existing.project?.customer_id || null,
    event_key: 'project_site_issue_updated',
    title: 'Cap nhat loi hien truong',
    description: `${existing.title} -> ${updated.title}`,
    source_ref_type: 'project_site_issue',
    source_ref_id: issueId,
    actor_user_id: auth.ctx.userId,
  })

  const row = await (db as any).projectSiteIssue.findFirst({
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

  if (String((row as any)?.subcontractor_id || '') !== String((existing as any)?.subcontractor_id || '')) {
    const notifyTargets = new Set<string>()
    if ((row as any)?.assigned_to) notifyTargets.add(String((row as any).assigned_to))
    if ((existing as any)?.assigned_to) notifyTargets.add(String((existing as any).assigned_to))
    if ((existing as any)?.reported_by) notifyTargets.add(String((existing as any).reported_by))
    notifyTargets.delete(String(auth.ctx.userId))

    for (const uid of notifyTargets) {
      if (!uid) continue
      await createUserNotification({
        user_id: uid,
        type: 'project_site_issue_subcontractor_changed',
        title: `Issue ${(row as any)?.issue_code || (existing as any)?.issue_code || ''} đã cập nhật thầu phụ xử lý`,
        message: (row as any)?.subcontractor?.supplier_name || (row as any)?.title || (existing as any)?.title,
        status: 'pending',
        source_type: 'project_site_issue',
        source_id: issueId,
        related_user_id: auth.ctx.userId,
        metadata_json: {
          project_id: projectId,
          customer_id: existing.project?.customer_id || null,
          issue_code: (row as any)?.issue_code || (existing as any)?.issue_code || null,
          subcontractor_id: (row as any)?.subcontractor?.id || null,
          subcontractor_name: (row as any)?.subcontractor?.supplier_name || null,
          previous_subcontractor_name: String((existing as any)?.subcontractor?.supplier_name || '').trim() || null,
        },
      })
    }
  }

  return NextResponse.json({ data: serializeProjectSiteIssue(row) })
}
