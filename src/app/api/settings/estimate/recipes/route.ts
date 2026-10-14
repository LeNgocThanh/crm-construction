import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function GET() {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const data = await db.estimationRecipe.findMany({
    orderBy: { updated_at: 'desc' },
    include: { items: { orderBy: { sort_order: 'asc' } } },
  })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const recipeKey = String(body.recipe_key || '').trim()
  const recipeName = String(body.recipe_name || '').trim()
  if (!recipeKey || !recipeName) {
    return NextResponse.json({ error: 'Thiếu recipe_key hoặc recipe_name' }, { status: 400 })
  }

  const created = await db.estimationRecipe.create({
    data: {
      recipe_key: recipeKey,
      recipe_name: recipeName,
      house_type: body.house_type ? String(body.house_type).trim() : null,
      style: body.style ? String(body.style).trim() : null,
      level: body.level ? String(body.level).trim() : null,
      description: body.description ? String(body.description) : null,
      is_active: body.is_active !== false,
    },
  })

  return NextResponse.json({ data: created }, { status: 201 })
}

