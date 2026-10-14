import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { PRINT_BRAND_CONFIG_ID, getPrintBrandSettings } from '@/lib/print/service'

function normalizeColor(value: unknown, fallback: string) {
  const raw = String(value || '').trim()
  if (!raw) return fallback
  return raw
}

export async function GET() {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const row = await (db as any).printBrandConfig.findUnique({
    where: { id: PRINT_BRAND_CONFIG_ID },
  }).catch(() => null)

  const mapped = await getPrintBrandSettings()
  return NextResponse.json({
    data: {
      id: PRINT_BRAND_CONFIG_ID,
      ...mapped,
      updated_at: row?.updated_at || null,
      created_at: row?.created_at || null,
      updated_by: row?.updated_by || null,
    },
  })
}

export async function PUT(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const brandName = String(body?.brandName || '').trim()
  const legalName = String(body?.legalName || '').trim()
  if (!brandName || !legalName) {
    return NextResponse.json({ error: 'Thiếu tên thương hiệu hoặc tên pháp lý' }, { status: 400 })
  }

  const updated = await (db as any).printBrandConfig.upsert({
    where: { id: PRINT_BRAND_CONFIG_ID },
    update: {
      brand_name: brandName,
      legal_name: legalName,
      tagline: body?.tagline ? String(body.tagline).trim() : null,
      logo_url: body?.logoUrl ? String(body.logoUrl).trim() : null,
      accent_color: normalizeColor(body?.accentColor, '#ea580c'),
      accent_soft: normalizeColor(body?.accentSoft, '#fff7ed'),
      border_color: normalizeColor(body?.borderColor, '#cbd5e1'),
      address: body?.address ? String(body.address).trim() : null,
      phone: body?.phone ? String(body.phone).trim() : null,
      email: body?.email ? String(body.email).trim() : null,
      tax_code: body?.taxCode ? String(body.taxCode).trim() : null,
      footer_text: body?.footerText ? String(body.footerText).trim() : null,
      updated_by: auth.ctx?.session?.user?.username || auth.ctx?.session?.user?.id || null,
    },
    create: {
      id: PRINT_BRAND_CONFIG_ID,
      brand_name: brandName,
      legal_name: legalName,
      tagline: body?.tagline ? String(body.tagline).trim() : null,
      logo_url: body?.logoUrl ? String(body.logoUrl).trim() : null,
      accent_color: normalizeColor(body?.accentColor, '#ea580c'),
      accent_soft: normalizeColor(body?.accentSoft, '#fff7ed'),
      border_color: normalizeColor(body?.borderColor, '#cbd5e1'),
      address: body?.address ? String(body.address).trim() : null,
      phone: body?.phone ? String(body.phone).trim() : null,
      email: body?.email ? String(body.email).trim() : null,
      tax_code: body?.taxCode ? String(body.taxCode).trim() : null,
      footer_text: body?.footerText ? String(body.footerText).trim() : null,
      updated_by: auth.ctx?.session?.user?.username || auth.ctx?.session?.user?.id || null,
    },
  })

  const mapped = await getPrintBrandSettings()
  return NextResponse.json({
    data: {
      id: updated.id,
      ...mapped,
      updated_at: updated.updated_at,
      created_at: updated.created_at,
      updated_by: updated.updated_by,
    },
  })
}
