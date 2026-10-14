import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json().catch(() => ({}))
  const templateName = String(body?.template_name || '').trim()
  if (!templateName) return NextResponse.json({ error: 'Thieu ten mau' }, { status: 400 })

  const project = await db.constructionProject.findUnique({ where: { id: params.id }, select: { id: true, house_type: true } })
  if (!project) return NextResponse.json({ error: 'Khong tim thay du an' }, { status: 404 })

  const milestones = await db.projectMilestone.findMany({
    where: { project_id: params.id, is_active: true },
    orderBy: [{ sort_order: 'asc' }, { due_date: 'asc' }, { created_at: 'asc' }],
  })
  if (!milestones.length) return NextResponse.json({ error: 'Du an chua co moc tien do de luu mau' }, { status: 400 })

  const codeBase = templateName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'template'

  const templateCode = `${codeBase}_${Date.now()}`

  const created = await db.$transaction(async (tx) => {
    const tpl = await (tx as any).projectMilestoneTemplate.create({
      data: {
        template_code: templateCode,
        template_name: templateName,
        description: body?.description ? String(body.description) : null,
        house_type: project.house_type || null,
        sort_order: Number(body?.sort_order || 0),
      },
    })

    for (const m of milestones) {
      await (tx as any).projectMilestoneTemplateItem.create({
        data: {
          template_id: tpl.id,
          milestone_key: m.milestone_key || null,
          milestone_name: m.milestone_name,
          status_key: m.status_key || 'pending',
          sort_order: Number(m.sort_order || 0),
          note: m.description || null,
        },
      })
    }

    return (tx as any).projectMilestoneTemplate.findUnique({
      where: { id: tpl.id },
      include: { items: { where: { is_active: true }, orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }] } },
    })
  })

  return NextResponse.json({ data: created }, { status: 201 })
}

