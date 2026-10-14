import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

const DEFAULT_DATA = {
  id: 'default',
  floors_threshold: 3,
  floors_coeff_per_extra: 0.02,
  tum_coeff: 0.03,
  basement_coeff: 0.08,
  elevator_coeff: 0.06,
  finish_co_ban_multiplier: 1.0,
  finish_tieu_chuan_multiplier: 1.08,
  finish_cao_cap_multiplier: 1.18,
}

export async function GET() {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const prismaAny = db as any
  let data = await prismaAny.estimationCoefficientConfig.findUnique({
    where: { id: 'default' },
  })
  if (!data) {
    data = await prismaAny.estimationCoefficientConfig.create({ data: DEFAULT_DATA })
  }
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const patch: Record<string, number> = {}

  const floorsThreshold = toNumber(body.floors_threshold)
  const floorsCoeffPerExtra = toNumber(body.floors_coeff_per_extra)
  const tumCoeff = toNumber(body.tum_coeff)
  const basementCoeff = toNumber(body.basement_coeff)
  const elevatorCoeff = toNumber(body.elevator_coeff)
  const finishCoBan = toNumber(body.finish_co_ban_multiplier)
  const finishTieuChuan = toNumber(body.finish_tieu_chuan_multiplier)
  const finishCaoCap = toNumber(body.finish_cao_cap_multiplier)

  if (floorsThreshold !== null) patch.floors_threshold = Math.max(0, Math.trunc(floorsThreshold))
  if (floorsCoeffPerExtra !== null) patch.floors_coeff_per_extra = Math.max(0, floorsCoeffPerExtra)
  if (tumCoeff !== null) patch.tum_coeff = Math.max(0, tumCoeff)
  if (basementCoeff !== null) patch.basement_coeff = Math.max(0, basementCoeff)
  if (elevatorCoeff !== null) patch.elevator_coeff = Math.max(0, elevatorCoeff)
  if (finishCoBan !== null) patch.finish_co_ban_multiplier = Math.max(0, finishCoBan)
  if (finishTieuChuan !== null) patch.finish_tieu_chuan_multiplier = Math.max(0, finishTieuChuan)
  if (finishCaoCap !== null) patch.finish_cao_cap_multiplier = Math.max(0, finishCaoCap)

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Khong co du lieu hop le de cap nhat' }, { status: 400 })
  }

  const prismaAny = db as any
  const data = await prismaAny.estimationCoefficientConfig.upsert({
    where: { id: 'default' },
    create: {
      ...DEFAULT_DATA,
      ...patch,
    },
    update: patch,
  })

  return NextResponse.json({ data })
}
