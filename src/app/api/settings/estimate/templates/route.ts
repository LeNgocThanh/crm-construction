import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = sp.get('active_only') !== 'false'
  const templateType = sp.get('template_type')
  const houseType = sp.get('house_type')
  const style = sp.get('style')
  const finishLevel = sp.get('finish_level')

  const where: any = {}
  if (activeOnly) where.is_active = true
  if (templateType) where.template_type = templateType
  if (houseType) where.house_type = houseType
  if (style) where.style = style
  if (finishLevel) where.finish_level = finishLevel

  const prismaAny = db as any
  const data = await prismaAny.estimationTemplateHeader.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { updated_at: 'desc' }],
    include: {
      items: {
        where: activeOnly ? { is_active: true } : undefined,
        orderBy: { sort_order: 'asc' },
        include: { catalog_item: true },
      },
    },
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json()
  const templateCode = String(body.template_code || '').trim()
  const templateName = String(body.template_name || '').trim()
  const templateType = String(body.template_type || '').trim()
  if (!templateCode || !templateName || !templateType) {
    return NextResponse.json(
      { error: 'Thieu template_code, template_name hoac template_type' },
      { status: 400 }
    )
  }

  const prismaAny = db as any
  const shouldActivate = body.is_active !== false
  const data = await prismaAny.$transaction(async (tx: any) => {
    const created = await tx.estimationTemplateHeader.create({
      data: {
        template_code: templateCode,
        template_name: templateName,
        template_type: templateType,
        house_type: body.house_type ? String(body.house_type).trim() : null,
        style: body.style ? String(body.style).trim() : null,
        finish_level: body.finish_level ? String(body.finish_level).trim() : null,
        room_type: body.room_type ? String(body.room_type).trim() : null,
        priority: toInt(body.priority) || 0,
        version: Math.max(1, toInt(body.version) || 1),
        is_active: shouldActivate,
        effective_from: body.effective_from ? new Date(body.effective_from) : null,
        effective_to: body.effective_to ? new Date(body.effective_to) : null,
        description: body.description ? String(body.description) : null,
        created_by: session.user.id,
      },
    })

    // Template governance: moi template_code chi co 1 version active
    if (shouldActivate) {
      await tx.estimationTemplateHeader.updateMany({
        where: {
          template_code: templateCode,
          id: { not: created.id },
          is_active: true,
        },
        data: { is_active: false },
      })
    }
    return created
  })

  return NextResponse.json({ data }, { status: 201 })
}
