import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function normalizeValueByType(value: unknown, valueType: string) {
  const raw = String(value ?? '').trim()
  if (valueType === 'number' || valueType === 'percent') {
    const n = Number(raw)
    if (!Number.isFinite(n)) return null
    return String(n)
  }
  return raw
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const id = String(params?.id || '').trim()
  if (!id) return NextResponse.json({ error: 'Thiếu id cấu hình' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const current = await (db as any).salesBriefHeatConfig.findUnique({
    where: { id },
  }).catch(() => null)
  if (!current) return NextResponse.json({ error: 'Không tìm thấy cấu hình' }, { status: 404 })

  const nextValue = normalizeValueByType(body?.config_value, String(current.value_type || 'number'))
  if (nextValue == null || nextValue === '') {
    return NextResponse.json({ error: 'Giá trị cấu hình không hợp lệ' }, { status: 400 })
  }

  const updated = await (db as any).salesBriefHeatConfig.update({
    where: { id },
    data: {
      config_value: nextValue,
      description: body?.description != null ? String(body.description).trim() || null : current.description,
      is_active: body?.is_active !== false,
    },
  })

  return NextResponse.json({ data: updated })
}

