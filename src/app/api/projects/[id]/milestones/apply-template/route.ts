import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { createProjectTimelineEvent } from '@/lib/project-timeline'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json().catch(() => ({}))
  const templateId = String(body?.template_id || '').trim()
  if (!templateId) return NextResponse.json({ error: 'Thieu template_id' }, { status: 400 })
  const mode = String(body?.mode || 'append').trim() // append | replace
  const baseDateRaw = body?.base_date ? String(body.base_date).trim() : ''
  const baseDate = baseDateRaw ? new Date(baseDateRaw) : null
  if (baseDateRaw && Number.isNaN(baseDate?.getTime())) {
    return NextResponse.json({ error: 'base_date_khong_hop_le' }, { status: 400 })
  }

  const template = await (db as any).projectMilestoneTemplate.findFirst({
    where: { id: templateId, is_active: true },
    include: {
      items: {
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
      },
    },
  })
  if (!template) return NextResponse.json({ error: 'Khong tim thay mau tien do' }, { status: 404 })
  if (!template.items?.length) return NextResponse.json({ error: 'Mau tien do khong co moc nao' }, { status: 400 })
  const hasDueOffset = template.items.some((x: any) => x?.due_offset_days != null)
  if (hasDueOffset && !baseDate) {
    return NextResponse.json({ error: 'Thieu moc_dau_de_tinh_thoi_han_hoan_thanh' }, { status: 400 })
  }

  const project = await db.constructionProject.findUnique({ where: { id: params.id }, select: { id: true, customer_id: true } })
  if (!project) return NextResponse.json({ error: 'Khong tim thay du an' }, { status: 404 })

  const createdCount = await db.$transaction(async (tx) => {
    if (mode === 'replace') {
      await tx.projectMilestone.updateMany({
        where: { project_id: params.id, is_active: true },
        data: { is_active: false },
      })
    }

    let count = 0
    for (const item of template.items) {
      const dueDate = baseDate && item?.due_offset_days != null
        ? new Date(baseDate.getTime() + Number(item.due_offset_days || 0) * 24 * 60 * 60 * 1000)
        : null
      await tx.projectMilestone.create({
        data: {
          project_id: params.id,
          milestone_definition_id: item.milestone_definition_id || null,
          milestone_key: item.milestone_key || null,
          milestone_name: item.milestone_name,
          description: item.note || null,
          status_key: item.status_key || 'pending',
          due_date: dueDate,
          sort_order: Number(item.sort_order || 0),
          created_by: String(session.user.id || '') || null,
        },
      })
      count += 1
    }
    return count
  })

  await createProjectTimelineEvent({
    project_id: params.id,
    customer_id: project.customer_id || null,
    event_key: 'milestone_template_applied',
    title: 'Ap mau tien do vao du an',
    description: `${template.template_name} (${mode === 'replace' ? 'thay the' : 'bo sung'})`,
    actor_user_id: String(session.user.id || '') || null,
    metadata_json: {
      template_id: template.id,
      template_code: template.template_code,
      template_name: template.template_name,
      mode,
      base_date: baseDate ? baseDate.toISOString() : null,
      created_count: createdCount,
    },
  })

  return NextResponse.json({
    ok: true,
    data: {
      template_id: template.id,
      template_name: template.template_name,
      mode,
      base_date: baseDate ? baseDate.toISOString() : null,
      created_count: createdCount,
    },
  })
}

