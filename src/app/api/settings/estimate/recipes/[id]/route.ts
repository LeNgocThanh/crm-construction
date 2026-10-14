import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const updated = await db.estimationRecipe.update({
    where: { id: params.id },
    data: {
      ...(body.recipe_key !== undefined ? { recipe_key: String(body.recipe_key).trim() } : {}),
      ...(body.recipe_name !== undefined ? { recipe_name: String(body.recipe_name).trim() } : {}),
      ...(body.house_type !== undefined ? { house_type: body.house_type ? String(body.house_type).trim() : null } : {}),
      ...(body.style !== undefined ? { style: body.style ? String(body.style).trim() : null } : {}),
      ...(body.level !== undefined ? { level: body.level ? String(body.level).trim() : null } : {}),
      ...(body.description !== undefined ? { description: body.description ? String(body.description) : null } : {}),
      ...(body.is_active !== undefined ? { is_active: Boolean(body.is_active) } : {}),
    },
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  await db.estimationRecipe.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

