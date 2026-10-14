import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function toRequiredFacts(v: unknown): string[] | null {
  if (v === null || v === undefined || v === '') return null
  const arr = Array.isArray(v)
    ? v
    : String(v)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
  const out = arr
    .map((x) => String(x || '').trim())
    .filter(Boolean)
  return out.length ? out : null
}

export async function PATCH(req: NextRequest, { params }: { params: { itemId: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const prismaAny = db as any
  const data = await prismaAny.estimationTemplateItem.update({
    where: { id: params.itemId },
    data: {
      ...(body.catalog_item_id !== undefined ? { catalog_item_id: String(body.catalog_item_id || '').trim() } : {}),
      ...(body.apply_mode !== undefined ? { apply_mode: String(body.apply_mode || '').trim() } : {}),
      ...(body.quantity_basis_key !== undefined ? { quantity_basis_key: body.quantity_basis_key ? String(body.quantity_basis_key).trim() : null } : {}),
      ...(body.scope_key !== undefined ? { scope_key: body.scope_key ? String(body.scope_key).trim() : null } : {}),
      ...(body.quantity_value !== undefined ? { quantity_value: toNumber(body.quantity_value) } : {}),
      ...(body.formula_expr !== undefined ? { formula_expr: body.formula_expr ? String(body.formula_expr) : null } : {}),
      ...(body.required_facts !== undefined ? { required_facts: toRequiredFacts(body.required_facts) } : {}),
      ...(body.formula_version !== undefined ? { formula_version: toInt(body.formula_version) || 1 } : {}),
      ...(body.formula_note !== undefined ? { formula_note: body.formula_note ? String(body.formula_note) : null } : {}),
      ...(body.waste_factor !== undefined ? { waste_factor: toNumber(body.waste_factor) } : {}),
      ...(body.sort_order !== undefined ? { sort_order: toInt(body.sort_order) || 0 } : {}),
      ...(body.is_active !== undefined ? { is_active: Boolean(body.is_active) } : {}),
      ...(body.effective_from !== undefined ? { effective_from: body.effective_from ? new Date(body.effective_from) : null } : {}),
      ...(body.effective_to !== undefined ? { effective_to: body.effective_to ? new Date(body.effective_to) : null } : {}),
      ...(body.note !== undefined ? { note: body.note ? String(body.note) : null } : {}),
    },
    include: { catalog_item: true },
  })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: { itemId: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const prismaAny = db as any
  await prismaAny.estimationTemplateItem.delete({ where: { id: params.itemId } })
  return NextResponse.json({ ok: true })
}
