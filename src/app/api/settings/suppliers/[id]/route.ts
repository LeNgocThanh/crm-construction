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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const profilePatch: any = {}
  if (body.supplier_type !== undefined) profilePatch.supplier_type = body.supplier_type ? String(body.supplier_type).trim() : null
  if (body.legal_name !== undefined) profilePatch.legal_name = body.legal_name ? String(body.legal_name).trim() : null
  if (body.tax_code !== undefined) profilePatch.tax_code = body.tax_code ? String(body.tax_code).trim() : null
  if (body.business_license_no !== undefined) profilePatch.business_license_no = body.business_license_no ? String(body.business_license_no).trim() : null
  if (body.primary_phone !== undefined) profilePatch.primary_phone = body.primary_phone ? String(body.primary_phone).trim() : null
  if (body.secondary_phone !== undefined) profilePatch.secondary_phone = body.secondary_phone ? String(body.secondary_phone).trim() : null
  if (body.zalo_phone !== undefined) profilePatch.zalo_phone = body.zalo_phone ? String(body.zalo_phone).trim() : null
  if (body.contact_email !== undefined) profilePatch.contact_email = body.contact_email ? String(body.contact_email).trim() : null
  if (body.payment_terms_days !== undefined) profilePatch.payment_terms_days = body.payment_terms_days != null ? Number(body.payment_terms_days) : null
  if (body.credit_limit !== undefined) profilePatch.credit_limit = toBigIntOrNull(body.credit_limit)
  if (body.current_debt !== undefined) {
    profilePatch.current_debt = toBigIntOrNull(body.current_debt)
    profilePatch.debt_updated_at = new Date()
  }
  if (body.profile_note !== undefined) profilePatch.note = body.profile_note ? String(body.profile_note) : null

  const hasProfilePatch = Object.keys(profilePatch).length > 0

  const updated = await (db as any).supplier.update({
    where: { id: params.id },
    data: {
      ...(body.supplier_code !== undefined ? { supplier_code: String(body.supplier_code || '').trim() } : {}),
      ...(body.supplier_name !== undefined ? { supplier_name: String(body.supplier_name || '').trim() } : {}),
      ...(body.contact_name !== undefined ? { contact_name: body.contact_name ? String(body.contact_name).trim() : null } : {}),
      ...(body.phone !== undefined ? { phone: body.phone ? String(body.phone).trim() : null } : {}),
      ...(body.email !== undefined ? { email: body.email ? String(body.email).trim() : null } : {}),
      ...(body.address !== undefined ? { address: body.address ? String(body.address).trim() : null } : {}),
      ...(body.region_code !== undefined ? { region_code: body.region_code ? String(body.region_code).trim() : null } : {}),
      ...(body.note !== undefined ? { note: body.note ? String(body.note) : null } : {}),
      ...(body.is_active !== undefined ? { is_active: Boolean(body.is_active) } : {}),
      ...(hasProfilePatch
        ? {
            profile: {
              upsert: {
                create: profilePatch,
                update: profilePatch,
              },
            },
          }
        : {}),
    },
    include: { profile: true },
  })
  return NextResponse.json({
    data: {
      ...updated,
      profile: updated.profile
        ? {
            ...updated.profile,
            credit_limit: updated.profile.credit_limit != null ? Number(updated.profile.credit_limit) : null,
            current_debt: updated.profile.current_debt != null ? Number(updated.profile.current_debt) : null,
          }
        : null,
      phone_display: updated.profile?.primary_phone || updated.phone || null,
    },
  })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  await (db as any).supplier.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
