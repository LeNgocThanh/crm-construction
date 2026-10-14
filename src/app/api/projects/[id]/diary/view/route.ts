import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function normalizeUploadUrl(url: string | null | undefined) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  const m = raw.match(/\/api\/uploads\/([^/?#]+)/i)
  if (!m?.[1]) return raw
  const base = String(process.env.FILE_URL || process.env.UPLOAD_FILE_BASE || 'https://webhook.tidicons.online/api/uploads').trim().replace(/\/+$/, '')
  return `${base}/${m[1]}`
}

function toDate(v: string | null, fallback: Date) {
  if (!v) return fallback
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? fallback : d
}

function toPositiveInt(value: string | null, fallback: number, max = 100) {
  const n = Number(value || '')
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(max, Math.floor(n))
}

function buildPeriod(period: string, fromRaw: string | null, toRaw: string | null) {
  const now = new Date()
  if (period === 'custom') {
    const from = toDate(fromRaw, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6))
    const to = toDate(toRaw, now)
    to.setHours(23, 59, 59, 999)
    return { from, to }
  }
  if (period === 'month') {
    const from = new Date(now)
    from.setDate(from.getDate() - 29)
    from.setHours(0, 0, 0, 0)
    const to = new Date(now)
    to.setHours(23, 59, 59, 999)
    return { from, to }
  }
  const from = new Date(now)
  from.setDate(from.getDate() - 6)
  from.setHours(0, 0, 0, 0)
  const to = new Date(now)
  to.setHours(23, 59, 59, 999)
  return { from, to }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const projectId = String(params.id || '').trim()
  if (!projectId) return NextResponse.json({ error: 'project_id_required' }, { status: 400 })

  const sp = new URL(req.url).searchParams
  const period = String(sp.get('period') || 'week').trim()
  const { from, to } = buildPeriod(period, sp.get('from'), sp.get('to'))
  const page = toPositiveInt(sp.get('page'), 1, 100000)
  const pageSize = toPositiveInt(sp.get('page_size'), 12, 60)
  const shiftType = String(sp.get('shift_type') || '').trim()
  const qualityStatus = String(sp.get('quality_status') || '').trim()
  const safetyStatus = String(sp.get('safety_status') || '').trim()
  const issueOnly = sp.get('issue_only') === '1'
  const investorOnly = sp.get('investor_visible') === '1'

  const where: any = {
    project_id: projectId,
    entry_date: { gte: from, lte: to },
    ...(investorOnly ? { is_investor_visible: true } : {}),
  }
  if (shiftType) where.shift_type = shiftType
  if (qualityStatus) where.quality_status = qualityStatus
  if (safetyStatus) where.safety_status = safetyStatus
  if (issueOnly) {
    where.OR = [
      { quality_status: { not: 'ok' } },
      { safety_status: { not: 'ok' } },
    ]
  }

  const total = await (db as any).projectDiaryEntry.count({ where })
  const rows = await (db as any).projectDiaryEntry.findMany({
    where,
    orderBy: [{ entry_date: 'desc' }, { created_at: 'desc' }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      creator: { select: { id: true, username: true } },
      media: {
        orderBy: { sort_order: 'asc' },
        include: {
          file_record: { select: { id: true, file_name: true, file_url: true, mime_type: true } },
        },
      },
      attendances: {
        orderBy: [{ created_at: 'asc' }],
        include: {
          worker: { select: { id: true, worker_code: true, full_name: true } },
        },
      },
      events: {
        orderBy: { created_at: 'asc' },
        select: {
          id: true,
          title: true,
          detail: true,
          severity: true,
          event_key: true,
        },
      },
    },
  })

  const data = rows.map((row: any) => ({
    id: row.id,
    entry_date: row.entry_date,
    shift_type: row.shift_type,
    title: row.title,
    summary: row.summary,
    work_scope: row.work_scope,
    progress_percent_day: row.progress_percent_day,
    progress_percent_total: row.progress_percent_total,
    quality_status: row.quality_status,
    safety_status: row.safety_status,
    next_plan: row.next_plan,
    is_investor_visible: row.is_investor_visible,
    creator: row.creator ? { id: row.creator.id, username: row.creator.username } : null,
    manpower_summary: row.manpower_summary,
    equipment_summary: row.equipment_summary,
    material_in_summary: row.material_in_summary,
    material_out_summary: row.material_out_summary,
    metadata_json: row.metadata_json || null,
    events: Array.isArray(row.events)
      ? row.events.map((e: any) => ({
          id: e.id,
          title: e.title,
          detail: e.detail,
          severity: e.severity,
          event_key: e.event_key,
        }))
      : [],
    media: Array.isArray(row.media)
      ? row.media.map((m: any) => ({
          id: m.id,
          file_url: normalizeUploadUrl(m.file_url || m.file_record?.file_url),
          file_type: m.file_type,
          caption: m.caption,
          category: m?.metadata_json?.category || 'other',
          metadata_json: m.metadata_json || null,
        }))
      : [],
    attendances: Array.isArray(row.attendances)
      ? row.attendances.map((a: any) => ({
          id: a.id,
          worker_id: a.worker_id,
          shift_type: a.shift_type,
          work_qty: a.work_qty,
          amount: a.amount != null ? String(a.amount) : null,
          note: a.note,
          worker: a.worker
            ? {
                id: a.worker.id,
                worker_code: a.worker.worker_code,
                full_name: a.worker.full_name,
              }
            : null,
        }))
      : [],
  }))

  return NextResponse.json({
    data,
    pagination: {
      total,
      page,
      page_size: pageSize,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    },
    filters: {
      period,
      from: from.toISOString(),
      to: to.toISOString(),
      shift_type: shiftType || null,
      quality_status: qualityStatus || null,
      safety_status: safetyStatus || null,
      issue_only: issueOnly,
      investor_visible: investorOnly,
    },
  })
}
