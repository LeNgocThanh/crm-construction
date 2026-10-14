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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const catalogItemId = String(body.catalog_item_id || '').trim()
  const applyMode = String(body.apply_mode || '').trim()
  if (!catalogItemId || !applyMode) {
    return NextResponse.json({ error: 'Thieu catalog_item_id hoac apply_mode' }, { status: 400 })
  }

  const prismaAny = db as any
  const data = await prismaAny.estimationTemplateItem.create({
    data: {
      template_id: params.id,
      catalog_item_id: catalogItemId,
      apply_mode: applyMode,
      quantity_basis_key: body.quantity_basis_key ? String(body.quantity_basis_key).trim() : null,
      scope_key: body.scope_key ? String(body.scope_key).trim() : null,
      quantity_value: toNumber(body.quantity_value),
      formula_expr: body.formula_expr ? String(body.formula_expr) : null,
      required_facts: toRequiredFacts(body.required_facts),
      formula_version: toInt(body.formula_version) || 1,
      formula_note: body.formula_note ? String(body.formula_note) : null,
      waste_factor: toNumber(body.waste_factor),
      sort_order: toInt(body.sort_order) || 0,
      is_active: body.is_active !== false,
      effective_from: body.effective_from ? new Date(body.effective_from) : null,
      effective_to: body.effective_to ? new Date(body.effective_to) : null,
      note: body.note ? String(body.note) : null,
    },
    include: { catalog_item: true },
  })

  return NextResponse.json({ data }, { status: 201 })
}
