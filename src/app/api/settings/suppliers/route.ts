import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function toBigIntOrNull(v: unknown): bigint | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(n)) return null
  return BigInt(Math.round(n))
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = sp.get('active_only') !== 'false'
  const q = String(sp.get('q') || '').trim()
  const region = String(sp.get('region_code') || '').trim()

  const where: any = {}
  if (activeOnly) where.is_active = true
  if (region) where.region_code = region
  if (q) {
    where.OR = [
      { supplier_code: { contains: q, mode: 'insensitive' } },
      { supplier_name: { contains: q, mode: 'insensitive' } },
      { contact_name: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { profile: { is: { primary_phone: { contains: q, mode: 'insensitive' } } } },
      { profile: { is: { secondary_phone: { contains: q, mode: 'insensitive' } } } },
      { profile: { is: { tax_code: { contains: q, mode: 'insensitive' } } } },
    ]
  }

  const data = await (db as any).supplier.findMany({
    where,
    orderBy: [{ is_active: 'desc' }, { supplier_name: 'asc' }],
    include: { profile: true },
  })
  return NextResponse.json({
    data: data.map((x: any) => ({
      ...x,
      profile: x.profile
        ? {
            ...x.profile,
            credit_limit: x.profile.credit_limit != null ? Number(x.profile.credit_limit) : null,
            current_debt: x.profile.current_debt != null ? Number(x.profile.current_debt) : null,
          }
        : null,
      phone_display: x.profile?.primary_phone || x.phone || null,
    })),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const supplierCode = String(body.supplier_code || '').trim()
  const supplierName = String(body.supplier_name || '').trim()
  if (!supplierCode || !supplierName) {
    return NextResponse.json({ error: 'Thiếu supplier_code hoặc supplier_name' }, { status: 400 })
  }

  const created = await (db as any).supplier.create({
    data: {
      supplier_code: supplierCode,
      supplier_name: supplierName,
      contact_name: body.contact_name ? String(body.contact_name).trim() : null,
      phone: body.phone ? String(body.phone).trim() : null,
      email: body.email ? String(body.email).trim() : null,
      address: body.address ? String(body.address).trim() : null,
      region_code: body.region_code ? String(body.region_code).trim() : null,
      note: body.note ? String(body.note) : null,
      is_active: body.is_active !== false,
      profile: {
        create: {
          supplier_type: body.supplier_type ? String(body.supplier_type).trim() : null,
          legal_name: body.legal_name ? String(body.legal_name).trim() : null,
          tax_code: body.tax_code ? String(body.tax_code).trim() : null,
          business_license_no: body.business_license_no ? String(body.business_license_no).trim() : null,
          primary_phone: body.primary_phone ? String(body.primary_phone).trim() : (body.phone ? String(body.phone).trim() : null),
          secondary_phone: body.secondary_phone ? String(body.secondary_phone).trim() : null,
          zalo_phone: body.zalo_phone ? String(body.zalo_phone).trim() : null,
          contact_email: body.contact_email ? String(body.contact_email).trim() : (body.email ? String(body.email).trim() : null),
          payment_terms_days: body.payment_terms_days != null ? Number(body.payment_terms_days) : 0,
          credit_limit: toBigIntOrNull(body.credit_limit),
          current_debt: toBigIntOrNull(body.current_debt),
          debt_updated_at: body.current_debt != null ? new Date() : null,
          note: body.profile_note ? String(body.profile_note) : null,
        },
      },
    },
    include: { profile: true },
  })
  return NextResponse.json({
    data: {
      ...created,
      profile: created.profile
        ? {
            ...created.profile,
            credit_limit: created.profile.credit_limit != null ? Number(created.profile.credit_limit) : null,
            current_debt: created.profile.current_debt != null ? Number(created.profile.current_debt) : null,
          }
        : null,
      phone_display: created.profile?.primary_phone || created.phone || null,
    },
  }, { status: 201 })
}
