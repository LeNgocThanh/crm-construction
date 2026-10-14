import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const prismaAny = db as any
  const current = await prismaAny.estimationTemplateHeader.findUnique({ where: { id: params.id } })
  if (!current) {
    return NextResponse.json({ error: 'Template khong ton tai' }, { status: 404 })
  }

  const nextTemplateCode = body.template_code !== undefined ? String(body.template_code || '').trim() : current.template_code
  const shouldActivate = body.is_active !== undefined ? Boolean(body.is_active) : current.is_active

  const data = await prismaAny.$transaction(async (tx: any) => {
    const updated = await tx.estimationTemplateHeader.update({
      where: { id: params.id },
      data: {
        ...(body.template_code !== undefined ? { template_code: nextTemplateCode } : {}),
        ...(body.template_name !== undefined ? { template_name: String(body.template_name || '').trim() } : {}),
        ...(body.template_type !== undefined ? { template_type: String(body.template_type || '').trim() } : {}),
        ...(body.house_type !== undefined ? { house_type: body.house_type ? String(body.house_type).trim() : null } : {}),
        ...(body.style !== undefined ? { style: body.style ? String(body.style).trim() : null } : {}),
        ...(body.finish_level !== undefined ? { finish_level: body.finish_level ? String(body.finish_level).trim() : null } : {}),
        ...(body.room_type !== undefined ? { room_type: body.room_type ? String(body.room_type).trim() : null } : {}),
        ...(body.priority !== undefined ? { priority: toInt(body.priority) || 0 } : {}),
        ...(body.version !== undefined ? { version: Math.max(1, toInt(body.version) || 1) } : {}),
        ...(body.is_active !== undefined ? { is_active: shouldActivate } : {}),
        ...(body.effective_from !== undefined ? { effective_from: body.effective_from ? new Date(body.effective_from) : null } : {}),
        ...(body.effective_to !== undefined ? { effective_to: body.effective_to ? new Date(body.effective_to) : null } : {}),
        ...(body.description !== undefined ? { description: body.description ? String(body.description) : null } : {}),
      },
    })

    // Template governance: moi template_code chi co 1 version active
    if (shouldActivate) {
      await tx.estimationTemplateHeader.updateMany({
        where: {
          template_code: nextTemplateCode,
          id: { not: updated.id },
          is_active: true,
        },
        data: { is_active: false },
      })
    }
    return updated
  })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const prismaAny = db as any
  await prismaAny.estimationTemplateHeader.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
