import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { createProjectTimelineEvent } from '@/lib/project-timeline'
import { genProjectSiteIssueCode, normalizeUploadUrl, serializeProjectSiteIssue } from '@/lib/project-site-issues'
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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error

  const projectId = String(params.id || '').trim()
  if (!projectId) return NextResponse.json({ error: 'project_id_required' }, { status: 400 })

  const sp = new URL(req.url).searchParams
  const page = Math.max(1, Number(sp.get('page') || 1) || 1)
  const pageSizeRaw = Number(sp.get('pageSize') || 10) || 10
  const pageSize = [10, 20, 30].includes(pageSizeRaw) ? pageSizeRaw : 10
  const status = String(sp.get('status') || '').trim()
  const issueType = String(sp.get('issue_type') || '').trim()
  const workflowType = String(sp.get('workflow_type') || '').trim()
  const severity = String(sp.get('severity') || '').trim()
  const sourceDiaryEntryId = String(sp.get('source_diary_entry_id') || '').trim()
  const sourceType = String(sp.get('source_type') || '').trim()
  const assignedTo = String(sp.get('assigned_to') || '').trim()
  const subcontractorId = String(sp.get('subcontractor_id') || '').trim()
  const dueBucket = String(sp.get('due_bucket') || '').trim()
  const keyword = String(sp.get('q') || '').trim()

  const now = new Date()
  const startToday = new Date(now)
  startToday.setHours(0, 0, 0, 0)
  const endToday = new Date(startToday)
  endToday.setDate(endToday.getDate() + 1)

  const where: any = {
    project_id: projectId,
    ...(status ? { status } : {}),
    ...(issueType ? { issue_type: issueType } : {}),
    ...(workflowType ? { workflow_type: workflowType } : {}),
    ...(severity ? { severity } : {}),
    ...(sourceDiaryEntryId ? { source_diary_entry_id: sourceDiaryEntryId } : {}),
    ...(sourceType ? { source_type: sourceType } : {}),
    ...(assignedTo ? { assigned_to: assignedTo } : {}),
    ...(subcontractorId ? { subcontractor_id: subcontractorId } : {}),
    ...(dueBucket === 'overdue'
      ? { due_at: { lt: now } }
      : dueBucket === 'today'
        ? { due_at: { gte: startToday, lt: endToday } }
        : dueBucket === 'no_due'
          ? { due_at: null }
          : {}),
    ...(keyword
      ? {
          OR: [
            { issue_code: { contains: keyword, mode: 'insensitive' } },
            { title: { contains: keyword, mode: 'insensitive' } },
            { detail: { contains: keyword, mode: 'insensitive' } },
            { location_text: { contains: keyword, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const total = await (db as any).projectSiteIssue.count({ where })
  const [openCount, overdueCount, waitingVerifyCount] = await Promise.all([
    (db as any).projectSiteIssue.count({ where: { project_id: projectId, status: { in: ['open', 'assigned', 'in_progress', 'reopened'] } } }),
    (db as any).projectSiteIssue.count({ where: { project_id: projectId, status: { in: ['open', 'assigned', 'in_progress', 'reopened'] }, due_at: { lt: now } } }),
    (db as any).projectSiteIssue.count({ where: { project_id: projectId, status: 'fixed_waiting_verify' } }),
  ])
  const rows = await (db as any).projectSiteIssue.findMany({
    where,
    orderBy: [{ created_at: 'desc' }],
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
        take: 5,
        include: { actor: { select: { id: true, username: true } } },
      },
    },
    skip: (page - 1) * pageSize,
    take: pageSize,
  })

  return NextResponse.json({
    data: rows.map(serializeProjectSiteIssue),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    summary: {
      open_count: openCount,
      overdue_count: overdueCount,
      waiting_verify_count: waitingVerifyCount,
    },
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error || !auth.ctx) return auth.error

  const projectId = String(params.id || '').trim()
  if (!projectId) return NextResponse.json({ error: 'project_id_required' }, { status: 400 })
  const body = await req.json().catch(() => ({}))

  const issueType = String(body?.issue_type || '').trim() || 'quality'
  const workflowType = String(body?.workflow_type || '').trim() || (issueType === 'safety' ? 'hse_issue' : 'punchlist')
  const title = String(body?.title || '').trim()
  if (!title) return NextResponse.json({ error: 'Thieu tieu de loi' }, { status: 400 })

  const project = await db.constructionProject.findUnique({
    where: { id: projectId },
    select: { id: true, customer_id: true, owner_id: true, default_owner_id: true, project_name: true },
  })
  if (!project) return NextResponse.json({ error: 'Khong tim thay du an' }, { status: 404 })

  const sourceDiaryEntryId = String(body?.source_diary_entry_id || '').trim()
  if (sourceDiaryEntryId) {
    const diary = await (db as any).projectDiaryEntry.findFirst({
      where: { id: sourceDiaryEntryId, project_id: projectId },
      select: { id: true },
    })
    if (!diary) return NextResponse.json({ error: 'Nhat ky nguon khong hop le' }, { status: 400 })
  }
  const subcontractorIdRaw = String(body?.subcontractor_id || '').trim()
  let subcontractor: any = null
  if (subcontractorIdRaw) {
    subcontractor = await ensureSubcontractor(subcontractorIdRaw)
    if (!subcontractor) return NextResponse.json({ error: 'Thầu phụ không hợp lệ' }, { status: 400 })
  }

  const mediaRows = Array.isArray(body?.media) ? body.media : []
  const created = await db.$transaction(async (tx) => {
    const row = await (tx as any).projectSiteIssue.create({
      data: {
        project_id: projectId,
        source_diary_entry_id: sourceDiaryEntryId || null,
        source_type: String(body?.source_type || (sourceDiaryEntryId ? 'project_diary' : 'manual')),
        subcontractor_id: subcontractorIdRaw || null,
        issue_type: issueType,
        workflow_type: workflowType,
        issue_code: String(body?.issue_code || '').trim() || genProjectSiteIssueCode(workflowType),
        title,
        detail: body?.detail ? String(body.detail) : null,
        severity: String(body?.severity || 'medium'),
        status: String(body?.status || 'open'),
        location_text: body?.location_text ? String(body.location_text) : null,
        floor_label: body?.floor_label ? String(body.floor_label) : null,
        area_label: body?.area_label ? String(body.area_label) : null,
        plan_file_record_id: body?.plan_file_record_id ? String(body.plan_file_record_id) : null,
        marker_json: body?.marker_json ?? null,
        reported_by: auth.ctx.userId,
        assigned_to: body?.assigned_to ? String(body.assigned_to) : null,
        due_at: parseDate(body?.due_at),
        metadata_json: body?.metadata_json ?? null,
      },
    })

    for (let i = 0; i < mediaRows.length; i++) {
      const m = mediaRows[i]
      const fileRecordId = m?.file_record_id ? String(m.file_record_id).trim() : ''
      const fileRecord = fileRecordId
        ? await (tx as any).fileRecord.findFirst({ where: { id: fileRecordId, is_active: true } })
        : null
      const fileUrl = normalizeUploadUrl(String(m?.file_url || fileRecord?.file_url || '').trim())
      if (!fileUrl) continue
      await (tx as any).projectSiteIssueMedia.create({
        data: {
          issue_id: row.id,
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
        issue_id: row.id,
        event_key: 'created',
        title: 'Tao loi hien truong',
        detail: body?.detail ? String(body.detail) : null,
        actor_user_id: auth.ctx.userId,
        payload_json: {
          source_diary_entry_id: sourceDiaryEntryId || null,
          issue_type: issueType,
          workflow_type: workflowType,
        },
      },
    })

    if (body?.assigned_to) {
      await (tx as any).projectSiteIssueEvent.create({
        data: {
          issue_id: row.id,
          event_key: 'assigned',
          title: 'Phan cong xu ly',
          detail: null,
          actor_user_id: auth.ctx.userId,
          payload_json: { assigned_to: String(body.assigned_to) },
        },
      })
    }

    return (tx as any).projectSiteIssue.findUnique({
      where: { id: row.id },
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

  await createProjectTimelineEvent({
    project_id: projectId,
    customer_id: project.customer_id || null,
    event_key: 'project_site_issue_created',
    title: workflowType === 'hse_issue' ? 'Tao loi an toan hien truong' : 'Tao loi QC hien truong',
    description: `${created?.issue_code || ''} | ${created?.title || title}${subcontractor?.supplier_name ? ` | Thầu phụ: ${subcontractor.supplier_name}` : ''}`,
    source_ref_type: 'project_site_issue',
    source_ref_id: created?.id || null,
    actor_user_id: auth.ctx.userId,
    metadata_json: {
      issue_type: issueType,
      workflow_type: workflowType,
      source_diary_entry_id: sourceDiaryEntryId || null,
    },
  })

  const notifyTargets = new Set<string>()
  if (created?.assigned_to) {
    notifyTargets.add(String(created.assigned_to))
  } else {
    if (project.owner_id) notifyTargets.add(String(project.owner_id))
    if (project.default_owner_id) notifyTargets.add(String(project.default_owner_id))
  }
  for (const uid of notifyTargets) {
    if (!uid) continue
    await createUserNotification({
      user_id: uid,
      type: 'project_site_issue_created',
      title: `${workflowType === 'hse_issue' ? 'Có lỗi an toàn mới cần xử lý' : 'Có lỗi hiện trường mới cần xử lý'}: ${created?.issue_code || ''}`,
      message: created?.title || title,
      status: 'pending',
      source_type: 'project_site_issue',
      source_id: created?.id || null,
      related_user_id: auth.ctx.userId,
      metadata_json: {
        project_id: projectId,
        customer_id: project.customer_id || null,
        project_name: project.project_name || null,
        issue_type: issueType,
        workflow_type: workflowType,
        issue_code: created?.issue_code || null,
        source_diary_entry_id: sourceDiaryEntryId || null,
        subcontractor_id: subcontractor?.id || null,
        subcontractor_name: subcontractor?.supplier_name || null,
      },
    })
  }

  if (subcontractor?.id) {
    const subcontractorTargets = new Set<string>()
    if (created?.assigned_to) subcontractorTargets.add(String(created.assigned_to))
    if (created?.reported_by) subcontractorTargets.add(String(created.reported_by))
    if (project.owner_id) subcontractorTargets.add(String(project.owner_id))
    if (project.default_owner_id) subcontractorTargets.add(String(project.default_owner_id))
    subcontractorTargets.delete(String(auth.ctx.userId))

    for (const uid of subcontractorTargets) {
      if (!uid) continue
      await createUserNotification({
        user_id: uid,
        type: 'project_site_issue_subcontractor_changed',
        title: `Issue ${created?.issue_code || ''} đã gán thầu phụ ${subcontractor.supplier_name}`,
        message: created?.title || title,
        status: 'pending',
        source_type: 'project_site_issue',
        source_id: created?.id || null,
        related_user_id: auth.ctx.userId,
        metadata_json: {
          project_id: projectId,
          customer_id: project.customer_id || null,
          project_name: project.project_name || null,
          issue_code: created?.issue_code || null,
          subcontractor_id: subcontractor.id,
          subcontractor_name: subcontractor.supplier_name,
          previous_subcontractor_name: null,
        },
      })
    }
  }

  return NextResponse.json({ data: serializeProjectSiteIssue(created) }, { status: 201 })
}
