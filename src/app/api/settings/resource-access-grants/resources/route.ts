import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

const RESOURCE_TYPES = new Set(['customer', 'project', 'conversation', 'warehouse', 'asset', 'labor_worker'])

function normalizeText(value: unknown) {
  const text = String(value || '').trim()
  return text || null
}

function normalizeLimit(value: string | null) {
  const num = Number(value || 20)
  if (!Number.isFinite(num) || num <= 0) return 20
  return Math.min(50, Math.floor(num))
}

function contains(value: string | null) {
  if (!value) return undefined
  return { contains: value, mode: 'insensitive' as const }
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const resourceType = String(sp.get('resource_type') || '').trim().toLowerCase()
  const q = normalizeText(sp.get('q'))
  const limit = normalizeLimit(sp.get('limit'))

  if (!RESOURCE_TYPES.has(resourceType)) {
    return NextResponse.json({ error: 'resource_type không hợp lệ' }, { status: 400 })
  }

  if (resourceType === 'customer') {
    const rows = await db.customer.findMany({
      where: q
        ? {
            OR: [
              { full_name: contains(q) },
              { phone_number: contains(q) },
              { id: contains(q) },
            ],
          }
        : undefined,
      select: { id: true, full_name: true, phone_number: true },
      take: limit,
    })
    return NextResponse.json({
      data: rows.map((row) => ({
        id: row.id,
        label: row.full_name || row.phone_number || row.id,
        subtitle: row.phone_number || 'Khách hàng',
      })),
    })
  }

  if (resourceType === 'project') {
    const rows = await db.constructionProject.findMany({
      where: q
        ? {
            OR: [
              { project_name: contains(q) },
              { address: contains(q) },
              { id: contains(q) },
            ],
          }
        : undefined,
      select: { id: true, project_name: true, address: true },
      take: limit,
    })
    return NextResponse.json({
      data: rows.map((row) => ({
        id: row.id,
        label: row.project_name || row.address || row.id,
        subtitle: row.address || 'Dự án',
      })),
    })
  }

  if (resourceType === 'conversation') {
    const rows = await (db as any).conversation.findMany({
      where: q
        ? {
            OR: [
              { display_name: contains(q) },
              { external_user_id: contains(q) },
              { id: contains(q) },
            ],
          }
        : undefined,
      select: { id: true, display_name: true, external_user_id: true, channel: true },
      take: limit,
    })
    return NextResponse.json({
      data: rows.map((row: any) => ({
        id: row.id,
        label: row.display_name || row.external_user_id || row.id,
        subtitle: row.channel || row.external_user_id || 'Conversation',
      })),
    })
  }

  if (resourceType === 'warehouse') {
    const rows = await (db as any).warehouse.findMany({
      where: q
        ? {
            OR: [
              { warehouse_name: contains(q) },
              { warehouse_code: contains(q) },
              { id: contains(q) },
            ],
          }
        : undefined,
      select: { id: true, warehouse_name: true, warehouse_code: true },
      take: limit,
    })
    return NextResponse.json({
      data: rows.map((row: any) => ({
        id: row.id,
        label: row.warehouse_name || row.warehouse_code || row.id,
        subtitle: row.warehouse_code || 'Kho',
      })),
    })
  }

  if (resourceType === 'asset') {
    const rows = await db.asset.findMany({
      where: q
        ? {
            OR: [
              { asset_name: contains(q) },
              { asset_code: contains(q) },
              { id: contains(q) },
            ],
          }
        : undefined,
      select: { id: true, asset_name: true, asset_code: true },
      take: limit,
    })
    return NextResponse.json({
      data: rows.map((row) => ({
        id: row.id,
        label: row.asset_name || row.asset_code || row.id,
        subtitle: row.asset_code || 'Tài sản',
      })),
    })
  }

  const rows = await (db as any).laborWorker.findMany({
    where: q
      ? {
          OR: [
            { full_name: contains(q) },
            { worker_code: contains(q) },
            { id: contains(q) },
          ],
        }
      : undefined,
    select: { id: true, full_name: true, worker_code: true },
    take: limit,
  })

  return NextResponse.json({
    data: rows.map((row: any) => ({
      id: row.id,
      label: row.full_name || row.worker_code || row.id,
      subtitle: row.worker_code || 'Nhân công',
    })),
  })
}
