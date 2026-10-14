import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const definitionId = String(body?.milestone_definition_id || '').trim()
  if (!definitionId) return NextResponse.json({ error: 'Thieu milestone_definition_id' }, { status: 400 })
  const definition = await (db as any).projectMilestoneDefinition.findFirst({
    where: { id: definitionId, is_active: true },
    select: { id: true, definition_key: true, definition_name: true, default_status_key: true },
  })
  if (!definition) return NextResponse.json({ error: 'Moc goc khong hop le' }, { status: 400 })
  const name = String(body?.milestone_name || definition.definition_name || '').trim()
  if (!name) return NextResponse.json({ error: 'Thieu ten moc' }, { status: 400 })

  const created = await (db as any).projectMilestoneTemplateItem.create({
    data: {
      template_id: params.id,
      milestone_definition_id: definition.id,
      milestone_key: body?.milestone_key ? String(body.milestone_key) : String(definition.definition_key || ''),
      milestone_name: name,
      status_key: body?.status_key ? String(body.status_key) : String(definition.default_status_key || 'pending'),
      due_offset_days: body?.due_offset_days != null && body?.due_offset_days !== '' ? Number(body.due_offset_days) : null,
      sort_order: Number(body?.sort_order || 0),
      note: body?.note ? String(body.note) : null,
      is_active: true,
    },
  })

  return NextResponse.json({ data: created }, { status: 201 })
}

