import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const updated = await (db as any).projectMilestoneDefinition.update({
    where: { id: params.id },
    data: {
      definition_name: body?.definition_name !== undefined ? String(body.definition_name || '').trim() : undefined,
      description: body?.description !== undefined ? (body.description ? String(body.description) : null) : undefined,
      default_status_key: body?.default_status_key !== undefined ? String(body.default_status_key || 'pending') : undefined,
      sort_order: body?.sort_order !== undefined ? Number(body.sort_order || 0) : undefined,
      is_active: body?.is_active !== undefined ? Boolean(body.is_active) : undefined,
    },
  })
  return NextResponse.json({ data: updated })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const [templateUsageCount, projectUsageCount] = await Promise.all([
    (db as any).projectMilestoneTemplateItem.count({
      where: {
        milestone_definition_id: params.id,
        is_active: true,
      },
    }),
    (db as any).projectMilestone.count({
      where: {
        milestone_definition_id: params.id,
        is_active: true,
      },
    }),
  ])

  if (templateUsageCount > 0 || projectUsageCount > 0) {
    return NextResponse.json(
      {
        error: 'Moc goc dang duoc su dung, khong the xoa',
        details: {
          template_usage_count: templateUsageCount,
          project_milestone_usage_count: projectUsageCount,
          hint: 'Vui long go lien ket trong mau tien do va milestone du an truoc khi xoa moc goc.',
        },
      },
      { status: 409 }
    )
  }

  await (db as any).projectMilestoneDefinition.update({ where: { id: params.id }, data: { is_active: false } })
  return NextResponse.json({ ok: true })
}

