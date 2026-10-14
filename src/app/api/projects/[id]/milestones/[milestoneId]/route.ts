import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { createProjectTimelineEvent } from '@/lib/project-timeline'
import { evaluateMilestoneWarningsFromRules } from '@/lib/project-milestone-rules'

export async function PATCH(req: NextRequest, { params }: { params: { id: string; milestoneId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const existing = await db.projectMilestone.findFirst({
    where: { id: params.milestoneId, project_id: params.id },
  })
  if (!existing) return NextResponse.json({ error: 'Khong tim thay milestone' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const nextStatus = body?.status_key !== undefined ? String(body.status_key || existing.status_key) : existing.status_key
  const patch: any = {}
  if (body?.milestone_name !== undefined) patch.milestone_name = body.milestone_name ? String(body.milestone_name) : existing.milestone_name
  if (body?.description !== undefined) patch.description = body.description ? String(body.description) : null
  if (body?.status_key !== undefined) patch.status_key = nextStatus
  if (body?.due_date !== undefined) patch.due_date = body.due_date ? new Date(body.due_date) : null
  if (body?.sort_order !== undefined) patch.sort_order = Number(body.sort_order || 0)
  if (body?.is_active !== undefined) patch.is_active = Boolean(body.is_active)
  if (nextStatus === 'completed' && !existing.completed_at) patch.completed_at = new Date()
  if (nextStatus !== 'completed') patch.completed_at = null
  const updated = await db.projectMilestone.update({
    where: { id: params.milestoneId },
    data: patch,
    include: { status_ref: { select: { status_key: true, status_name: true } } },
  })
  const warnings: string[] = []
  if (nextStatus === 'completed') {
    const ruleWarnings = await evaluateMilestoneWarningsFromRules({
      projectId: params.id,
      milestoneDefinitionId: (updated as any).milestone_definition_id,
      milestoneKey: updated.milestone_key,
      statusKey: nextStatus,
    })
    warnings.push(...ruleWarnings)
  }

  await createProjectTimelineEvent({
    project_id: params.id,
    event_key: 'milestone_updated',
    title: 'Cap nhat moc du an',
    description: `${updated.milestone_name}`,
    source_ref_type: 'project_milestone',
    source_ref_id: updated.id,
    actor_user_id: String(session.user.id || '') || null,
    milestone_id: updated.id,
    metadata_json: { status_key: updated.status_key, due_date: updated.due_date, warnings },
  })
  return NextResponse.json({ data: updated, warnings, warning_mode: true })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string; milestoneId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsManage)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const existing = await db.projectMilestone.findFirst({
    where: { id: params.milestoneId, project_id: params.id },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: 'Khong tim thay milestone' }, { status: 404 })
  await db.projectMilestone.update({
    where: { id: params.milestoneId },
    data: { is_active: false },
  })
  await createProjectTimelineEvent({
    project_id: params.id,
    event_key: 'milestone_deleted',
    title: 'Xoa moc du an',
    description: `${params.milestoneId}`,
    source_ref_type: 'project_milestone',
    source_ref_id: params.milestoneId,
    actor_user_id: String(session.user.id || '') || null,
  })
  return NextResponse.json({ ok: true })
}
