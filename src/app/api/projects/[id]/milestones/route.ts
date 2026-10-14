import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { createProjectTimelineEvent } from '@/lib/project-timeline'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const rows = await db.projectMilestone.findMany({
    where: { project_id: params.id, is_active: true },
    orderBy: [{ sort_order: 'asc' }, { due_date: 'asc' }, { created_at: 'asc' }],
    include: { status_ref: { select: { status_key: true, status_name: true } } },
  })
  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const body = await req.json().catch(() => ({}))
  const definitionId = body?.milestone_definition_id ? String(body.milestone_definition_id).trim() : ''
  let definition: any = null
  if (definitionId) {
    definition = await (db as any).projectMilestoneDefinition.findFirst({
      where: { id: definitionId, is_active: true },
      select: { id: true, definition_key: true, definition_name: true, default_status_key: true },
    })
    if (!definition) return NextResponse.json({ error: 'Moc goc khong hop le' }, { status: 400 })
  }
  const milestoneName = String(body?.milestone_name || definition?.definition_name || '').trim()
  if (!milestoneName) return NextResponse.json({ error: 'Thieu milestone_name' }, { status: 400 })
  const created = await db.projectMilestone.create({
    data: {
      project_id: params.id,
      milestone_definition_id: definition?.id || null,
      milestone_key: body?.milestone_key ? String(body.milestone_key) : (definition?.definition_key ? String(definition.definition_key) : null),
      milestone_name: milestoneName,
      description: body?.description ? String(body.description) : null,
      status_key: body?.status_key ? String(body.status_key) : (definition?.default_status_key ? String(definition.default_status_key) : 'pending'),
      due_date: body?.due_date ? new Date(body.due_date) : null,
      sort_order: Number(body?.sort_order || 0),
      created_by: String(session.user.id || '') || null,
    },
    include: { status_ref: { select: { status_key: true, status_name: true } } },
  })
  await createProjectTimelineEvent({
    project_id: params.id,
    event_key: 'milestone_created',
    title: 'Tao moc du an',
    description: `${created.milestone_name}`,
    source_ref_type: 'project_milestone',
    source_ref_id: created.id,
    actor_user_id: String(session.user.id || '') || null,
    metadata_json: { status_key: created.status_key, due_date: created.due_date },
  })
  return NextResponse.json({ data: created }, { status: 201 })
}
