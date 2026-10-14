import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function requireSession(req?: NextRequest) {
  void req
  const auth = await requirePermission(PERMISSIONS.laborRead)
  if (auth.error || !auth.ctx) {
    return { error: auth.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { session: auth.ctx.session as any, ctx: auth.ctx }
}

export function requireManageRole(auth: { session?: any; ctx?: { permissionKeys?: string[] } }) {
  const permissionKeys = Array.isArray(auth?.ctx?.permissionKeys) ? auth.ctx.permissionKeys : []
  if (!permissionKeys.includes(PERMISSIONS.laborManage)) {
    return NextResponse.json({ error: 'Khong co quyen quan ly du lieu nhan cong' }, { status: 403 })
  }
  return null
}

export function parseOptionalString(v: any) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? s : null
}

export function parseOptionalFloat(v: any) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function parseOptionalInt(v: any) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export function parseOptionalBigInt(v: any) {
  const n = parseOptionalFloat(v)
  return n == null ? null : BigInt(Math.round(n))
}

export function normalizeKey(value: any) {
  return String(value || '').trim().toLowerCase()
}
