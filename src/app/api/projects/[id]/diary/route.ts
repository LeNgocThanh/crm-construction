import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createProjectTimelineEvent } from '@/lib/project-timeline'
import { parseOptionalString } from '@/lib/labor/server'
import { getAttendancePaymentLockMap } from '@/lib/labor/attendance-payment-lock'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

function normalizeUploadUrl(url: string | null | undefined) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  const m = raw.match(/\/api\/uploads\/([^/?#]+)/i)
  if (!m?.[1]) return raw
  const base = String(process.env.FILE_URL || process.env.UPLOAD_FILE_BASE || 'https://webhook.tidicons.online/api/uploads').trim().replace(/\/+$/, '')
  return `${base}/${m[1]}`
}

function serMedia(m: any) {
  return {
    ...m,
    file_url: normalizeUploadUrl(m?.file_url),
    file_record: m?.file_record
      ? {
        ...m.file_record,
        file_url: normalizeUploadUrl(m.file_record.file_url),
          file_size_bytes: m.file_record.file_size_bytes != null ? Number(m.file_record.file_size_bytes) : null,
        }
      : null,
  }
}

function serEntry(row: any) {
  return {
    ...row,
    media: Array.isArray(row?.media) ? row.media.map(serMedia) : [],
    site_issues: Array.isArray(row?.site_issues) ? row.site_issues : [],
    attendances: Array.isArray(row?.attendances)
      ? row.attendances.map((x: any) => ({
          ...x,
          amount: x?.amount != null ? String(x.amount) : null,
        }))
      : [],
  }
}

function computeRiskFlag(qualityStatus: string | null | undefined, safetyStatus: string | null | undefined) {
  const q = String(qualityStatus || 'ok').toLowerCase()
  const s = String(safetyStatus || 'ok').toLowerCase()
  if (q === 'blocked' || s === 'incident') return 'red'
  if (q === 'issue' || s === 'warning') return 'yellow'
  return 'green'
}

function isSameDay(a: Date, b: Date) {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10)
}

function getDayRange(value: Date) {
  const dayKey = value.toISOString().slice(0, 10)
  const start = new Date(dayKey)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

function getDiaryShiftConflicts(shiftType: string | null | undefined) {
  const shift = String(shiftType || '').trim() || 'full_day'
  if (shift === 'full_day') return ['full_day', 'morning', 'afternoon', 'night']
  return ['full_day', shift]
}

function getDefaultWorkQtyByShift(shiftType: string | null | undefined) {
  const shift = String(shiftType || '').trim() || 'full_day'
  if (shift === 'morning' || shift === 'afternoon') return 0.5
  return 1
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error

  const projectId = String(params.id || '').trim()
  if (!projectId) return NextResponse.json({ error: 'project_id_required' }, { status: 400 })
  const sp = new URL(req.url).searchParams
  const page = Math.max(1, Number(sp.get('page') || 1) || 1)
  const pageSizeRaw = Number(sp.get('pageSize') || 10) || 10
  const pageSize = [10, 20, 30].includes(pageSizeRaw) ? pageSizeRaw : 10
  const entryDateFromFilter = String(sp.get('entry_date_from') || '').trim()
  const entryDateToFilter = String(sp.get('entry_date_to') || '').trim()
  const qualityStatusFilter = String(sp.get('quality_status') || '').trim()
  const safetyStatusFilter = String(sp.get('safety_status') || '').trim()
  const shiftTypeFilter = String(sp.get('shift_type') || '').trim()
  const visibilityFilter = String(sp.get('visibility') || '').trim()

  const entryDateFrom = entryDateFromFilter ? getDayRange(new Date(entryDateFromFilter)).start : null
  const entryDateTo = entryDateToFilter ? getDayRange(new Date(entryDateToFilter)).end : null

  const where = {
    project_id: projectId,
    ...(
      visibilityFilter === 'public'
        ? { is_investor_visible: true }
        : visibilityFilter === 'internal'
          ? { is_investor_visible: false }
          : {}
    ),
    ...(entryDateFrom || entryDateTo ? { entry_date: { ...(entryDateFrom ? { gte: entryDateFrom } : {}), ...(entryDateTo ? { lt: entryDateTo } : {}) } } : {}),
    ...(qualityStatusFilter ? { quality_status: qualityStatusFilter } : {}),
    ...(safetyStatusFilter ? { safety_status: safetyStatusFilter } : {}),
    ...(shiftTypeFilter ? { shift_type: shiftTypeFilter } : {}),
  }

  const total = await (db as any).projectDiaryEntry.count({ where })

  const rows = await (db as any).projectDiaryEntry.findMany({
    where,
    orderBy: [{ entry_date: 'desc' }, { created_at: 'desc' }],
    include: {
      creator: { select: { id: true, username: true } },
      media: { orderBy: { sort_order: 'asc' }, include: { file_record: { select: { id: true, file_name: true, file_url: true, mime_type: true, file_size_bytes: true, purpose: true } } } },
      attendances: {
        orderBy: [{ created_at: 'asc' }],
        include: {
          worker: { select: { id: true, worker_code: true, full_name: true } },
        },
      },
      events: {
        orderBy: { created_at: 'asc' },
        include: { event_type: { select: { id: true, event_key: true, event_name: true } } },
      },
      site_issues: {
        orderBy: [{ created_at: 'desc' }],
        include: {
          reporter: { select: { id: true, username: true } },
          assignee: { select: { id: true, username: true } },
          subcontractor: { select: { id: true, supplier_name: true, supplier_code: true } },
        },
      },
    },
    skip: (page - 1) * pageSize,
    take: pageSize,
  })

  const attendanceIds = rows.flatMap((row: any) => (Array.isArray(row?.attendances) ? row.attendances.map((x: any) => String(x?.id || '')) : []))
  const attendanceLockMap = await getAttendancePaymentLockMap(attendanceIds)

  return NextResponse.json({
    data: rows.map((row: any) => {
      const serialized = serEntry(row)
      return {
        ...serialized,
        attendances: Array.isArray(serialized?.attendances)
          ? serialized.attendances.map((attendance: any) => ({
              ...attendance,
              ...(attendanceLockMap.get(String(attendance?.id || '')) || {}),
            }))
          : [],
      }
    }),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error || !auth.ctx) return auth.error

  const projectId = String(params.id || '').trim()
  if (!projectId) return NextResponse.json({ error: 'project_id_required' }, { status: 400 })
  const body = await req.json().catch(() => ({}))

  const title = String(body?.title || '').trim()
  if (!title) return NextResponse.json({ error: 'Thieu title' }, { status: 400 })

  const entryDateRaw = body?.entry_date ? new Date(body.entry_date) : new Date()
  const entryDate = Number.isNaN(entryDateRaw.getTime()) ? new Date() : entryDateRaw
  const entryDayRange = getDayRange(entryDate)
  const shiftType = body?.shift_type ? String(body.shift_type) : 'full_day'
  const diaryConflict = await (db as any).projectDiaryEntry.findFirst({
    where: {
      project_id: projectId,
      entry_date: {
        gte: entryDayRange.start,
        lt: entryDayRange.end,
      },
      shift_type: { in: getDiaryShiftConflicts(shiftType) },
    },
    select: { id: true, entry_date: true, shift_type: true, title: true },
    orderBy: [{ created_at: 'desc' }],
  })
  if (diaryConflict && isSameDay(new Date(diaryConflict.entry_date), entryDate)) {
    return NextResponse.json({ error: `Da ton tai nhat ky trung hoac xung dot ca lam trong ngay nay (${diaryConflict.shift_type || 'full_day'})` }, { status: 409 })
  }
  const attendanceRows = Array.isArray(body?.attendance_rows) ? body.attendance_rows : []
  const attendanceWorkerIds = attendanceRows
    .map((x: any) => parseOptionalString(x?.worker_id))
    .filter(Boolean) as string[]
  if (attendanceWorkerIds.length) {
    const attendanceConflict = await db.projectLaborAttendance.findFirst({
      where: {
        project_id: projectId,
        worker_id: { in: attendanceWorkerIds },
        attendance_date: {
          gte: entryDayRange.start,
          lt: entryDayRange.end,
        },
        shift_type: { in: getDiaryShiftConflicts(shiftType) },
      },
      include: {
        worker: { select: { full_name: true } },
      },
    })
    if (attendanceConflict) {
      return NextResponse.json({ error: `Nhan cong ${attendanceConflict.worker?.full_name || ''} da co cham cong trung hoac xung dot ca trong ngay nay` }, { status: 409 })
    }
  }

  const created = await db.$transaction(async (tx) => {
    const row = await (tx as any).projectDiaryEntry.create({
      data: {
        project_id: projectId,
        entry_date: entryDate,
        shift_type: shiftType,
        title,
        summary: body?.summary ? String(body.summary) : null,
        manpower_summary: body?.manpower_summary ? String(body.manpower_summary) : null,
        equipment_summary: body?.equipment_summary ? String(body.equipment_summary) : null,
        material_in_summary: body?.material_in_summary ? String(body.material_in_summary) : null,
        material_out_summary: body?.material_out_summary ? String(body.material_out_summary) : null,
        work_scope: body?.work_scope ? String(body.work_scope) : null,
        weather: body?.weather ? String(body.weather) : null,
        progress_percent_day: body?.progress_percent_day != null && String(body.progress_percent_day) !== '' ? Number(body.progress_percent_day) : null,
        progress_percent_total: body?.progress_percent_total != null && String(body.progress_percent_total) !== '' ? Number(body.progress_percent_total) : null,
        quality_status: body?.quality_status ? String(body.quality_status) : 'ok',
        safety_status: body?.safety_status ? String(body.safety_status) : 'ok',
        next_plan: body?.next_plan ? String(body.next_plan) : null,
        is_investor_visible: body?.is_investor_visible !== false,
        metadata_json: {
          ...(body?.metadata_json || {}),
          risk_flag: computeRiskFlag(body?.quality_status, body?.safety_status),
          quick_template_key: body?.quick_template_key ? String(body.quick_template_key) : null,
          checklist: body?.checklist || null,
          issue_resolution: body?.issue_resolution ? String(body.issue_resolution) : null,
          issue_eta: body?.issue_eta ? String(body.issue_eta) : null,
        },
        created_by: auth.ctx.userId,
      },
    })

    const mediaRows = Array.isArray(body?.media) ? body.media : []
    for (let i = 0; i < mediaRows.length; i++) {
      const m = mediaRows[i]
      const fileRecordId = m?.file_record_id ? String(m.file_record_id).trim() : ''
      const fileRecord = fileRecordId
        ? await (tx as any).fileRecord.findFirst({ where: { id: fileRecordId, is_active: true } })
        : null
      const fileUrl = normalizeUploadUrl(String(m?.file_url || fileRecord?.file_url || '').trim())
      if (!fileUrl) continue
      await (tx as any).projectDiaryMedia.create({
        data: {
          diary_entry_id: row.id,
          file_record_id: fileRecord?.id || null,
          file_url: fileUrl,
          file_type: m?.file_type ? String(m.file_type) : (fileRecord?.mime_type?.startsWith('image/') ? 'image' : fileRecord?.mime_type?.startsWith('video/') ? 'video' : null),
          caption: m?.caption ? String(m.caption) : null,
          taken_at: m?.taken_at ? new Date(m.taken_at) : null,
          is_before_after: Boolean(m?.is_before_after),
          pair_key: m?.pair_key ? String(m.pair_key) : null,
          sort_order: Number(m?.sort_order ?? i),
          metadata_json: m?.metadata_json ?? null,
        },
      })
    }

    const eventRows = Array.isArray(body?.events) ? body.events : []
    for (const e of eventRows) {
      const eTitle = String(e?.title || '').trim()
      if (!eTitle) continue
      await (tx as any).projectDiaryEvent.create({
        data: {
          diary_entry_id: row.id,
          event_type_id: e?.event_type_id ? String(e.event_type_id) : null,
          event_key: e?.event_key ? String(e.event_key) : null,
          title: eTitle,
          detail: e?.detail ? String(e.detail) : null,
          severity: e?.severity ? String(e.severity) : null,
          is_investor_visible: e?.is_investor_visible !== false,
          payload_json: e?.payload_json ?? null,
        },
      })
    }

    for (const a of attendanceRows) {
      const workerId = parseOptionalString(a?.worker_id)
      if (!workerId) continue
      await (tx as any).projectLaborAttendance.create({
        data: {
          project_id: projectId,
          diary_entry_id: row.id,
          worker_id: workerId,
          attendance_date: entryDate,
          shift_type: shiftType,
          source_type: 'diary',
          attendance_status: 'draft',
          work_qty: getDefaultWorkQtyByShift(shiftType),
          amount: null,
          note: parseOptionalString(a?.note),
          created_by: auth.ctx.userId,
        },
      })
    }

    return row
  })

  const project = await db.constructionProject.findUnique({ where: { id: projectId }, select: { customer_id: true } })
  await createProjectTimelineEvent({
    project_id: projectId,
    customer_id: project?.customer_id || null,
    event_key: 'project_diary_created',
    title: 'Tao nhat ky du an',
    description: title,
    source_ref_type: 'project_diary_entry',
    source_ref_id: created.id,
    actor_user_id: auth.ctx.userId,
    metadata_json: { entry_date: created.entry_date, is_investor_visible: created.is_investor_visible },
  })

  return NextResponse.json({ data: created }, { status: 201 })
}
