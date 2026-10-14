import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { createProjectTimelineEvent } from '@/lib/project-timeline'
import { parseOptionalString } from '@/lib/labor/server'
import { getLockedDiaryAttendances } from '@/lib/labor/attendance-payment-lock'

function normalizeUploadUrl(url: string | null | undefined) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  const m = raw.match(/\/api\/uploads\/([^/?#]+)/i)
  if (!m?.[1]) return raw
  const base = String(process.env.FILE_URL || process.env.UPLOAD_FILE_BASE || 'https://webhook.tidicons.online/api/uploads').trim().replace(/\/+$/, '')
  return `${base}/${m[1]}`
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string; entryId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const projectId = String(params.id || '').trim()
  const entryId = String(params.entryId || '').trim()
  const existing = await (db as any).projectDiaryEntry.findFirst({ where: { id: entryId, project_id: projectId } })
  if (!existing) return NextResponse.json({ error: 'Khong tim thay nhat ky' }, { status: 404 })
  const lockedAttendances = await getLockedDiaryAttendances(projectId, entryId)

  const body = await req.json().catch(() => ({}))
  const patch: any = {}
  const nextEntryDate = body?.entry_date !== undefined
    ? (body.entry_date ? new Date(body.entry_date) : existing.entry_date)
    : existing.entry_date
  const nextEntryDayRange = getDayRange(new Date(nextEntryDate))
  const nextShiftType = body?.shift_type !== undefined
    ? (body.shift_type ? String(body.shift_type) : 'full_day')
    : (existing.shift_type || 'full_day')
  const existingEntryDateKey = new Date(existing.entry_date).toISOString().slice(0, 10)
  const nextEntryDateKey = new Date(nextEntryDate).toISOString().slice(0, 10)
  const entryDateChanged = body?.entry_date !== undefined && nextEntryDateKey !== existingEntryDateKey
  const shiftTypeChanged = body?.shift_type !== undefined && nextShiftType !== (existing.shift_type || 'full_day')
  const attendanceSensitiveChange = body?.attendance_rows !== undefined || entryDateChanged || shiftTypeChanged
  if (lockedAttendances.length && attendanceSensitiveChange) {
    const names = lockedAttendances.map((row: any) => row.worker?.full_name || row.worker?.worker_code || 'nhan cong').join(', ')
    return NextResponse.json({ error: `Nhat ky nay co cham cong da phat sinh thanh toan (${names}). Khong the doi ngay, ca hoac danh sach cham cong.` }, { status: 409 })
  }
  const diaryConflict = await (db as any).projectDiaryEntry.findFirst({
    where: {
      project_id: projectId,
      id: { not: entryId },
      entry_date: {
        gte: nextEntryDayRange.start,
        lt: nextEntryDayRange.end,
      },
      shift_type: { in: getDiaryShiftConflicts(nextShiftType) },
    },
    select: { id: true, entry_date: true, shift_type: true, title: true },
    orderBy: [{ created_at: 'desc' }],
  })
  if (diaryConflict && isSameDay(new Date(diaryConflict.entry_date), new Date(nextEntryDate))) {
    return NextResponse.json({ error: `Da ton tai nhat ky trung hoac xung dot ca lam trong ngay nay (${diaryConflict.shift_type || 'full_day'})` }, { status: 409 })
  }
  const attendanceRows = Array.isArray(body?.attendance_rows) ? body.attendance_rows : null
  const attendanceWorkerIds = (attendanceRows || [])
    .map((x: any) => parseOptionalString(x?.worker_id))
    .filter(Boolean) as string[]
  if (attendanceWorkerIds.length) {
    const attendanceConflict = await db.projectLaborAttendance.findFirst({
      where: {
        project_id: projectId,
        diary_entry_id: { not: entryId },
        worker_id: { in: attendanceWorkerIds },
        attendance_date: {
          gte: nextEntryDayRange.start,
          lt: nextEntryDayRange.end,
        },
        shift_type: { in: getDiaryShiftConflicts(nextShiftType) },
      },
      include: {
        worker: { select: { full_name: true } },
      },
    })
    if (attendanceConflict) {
      return NextResponse.json({ error: `Nhan cong ${attendanceConflict.worker?.full_name || ''} da co cham cong trung hoac xung dot ca trong ngay nay` }, { status: 409 })
    }
  }
  if (body?.entry_date !== undefined) patch.entry_date = body.entry_date ? new Date(body.entry_date) : existing.entry_date
  if (body?.shift_type !== undefined) patch.shift_type = body.shift_type ? String(body.shift_type) : null
  if (body?.title !== undefined) patch.title = body.title ? String(body.title) : existing.title
  if (body?.summary !== undefined) patch.summary = body.summary ? String(body.summary) : null
  if (body?.manpower_summary !== undefined) patch.manpower_summary = body.manpower_summary ? String(body.manpower_summary) : null
  if (body?.equipment_summary !== undefined) patch.equipment_summary = body.equipment_summary ? String(body.equipment_summary) : null
  if (body?.material_in_summary !== undefined) patch.material_in_summary = body.material_in_summary ? String(body.material_in_summary) : null
  if (body?.material_out_summary !== undefined) patch.material_out_summary = body.material_out_summary ? String(body.material_out_summary) : null
  if (body?.work_scope !== undefined) patch.work_scope = body.work_scope ? String(body.work_scope) : null
  if (body?.weather !== undefined) patch.weather = body.weather ? String(body.weather) : null
  if (body?.progress_percent_day !== undefined) patch.progress_percent_day = body.progress_percent_day != null && String(body.progress_percent_day) !== '' ? Number(body.progress_percent_day) : null
  if (body?.progress_percent_total !== undefined) patch.progress_percent_total = body.progress_percent_total != null && String(body.progress_percent_total) !== '' ? Number(body.progress_percent_total) : null
  if (body?.quality_status !== undefined) patch.quality_status = body.quality_status ? String(body.quality_status) : existing.quality_status
  if (body?.safety_status !== undefined) patch.safety_status = body.safety_status ? String(body.safety_status) : existing.safety_status
  if (body?.next_plan !== undefined) patch.next_plan = body.next_plan ? String(body.next_plan) : null
  if (body?.is_investor_visible !== undefined) patch.is_investor_visible = Boolean(body.is_investor_visible)
  if (
    body?.metadata_json !== undefined ||
    body?.quick_template_key !== undefined ||
    body?.checklist !== undefined ||
    body?.issue_resolution !== undefined ||
    body?.issue_eta !== undefined ||
    body?.quality_status !== undefined ||
    body?.safety_status !== undefined
  ) {
    const baseMeta = (existing as any)?.metadata_json && typeof (existing as any).metadata_json === 'object'
      ? (existing as any).metadata_json
      : {}
    patch.metadata_json = {
      ...baseMeta,
      ...(body?.metadata_json || {}),
      quick_template_key: body?.quick_template_key !== undefined ? (body?.quick_template_key ? String(body.quick_template_key) : null) : baseMeta.quick_template_key,
      checklist: body?.checklist !== undefined ? (body?.checklist || null) : baseMeta.checklist,
      issue_resolution: body?.issue_resolution !== undefined ? (body?.issue_resolution ? String(body.issue_resolution) : null) : baseMeta.issue_resolution,
      issue_eta: body?.issue_eta !== undefined ? (body?.issue_eta ? String(body.issue_eta) : null) : baseMeta.issue_eta,
      risk_flag: computeRiskFlag(body?.quality_status !== undefined ? body?.quality_status : existing.quality_status, body?.safety_status !== undefined ? body?.safety_status : existing.safety_status),
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await (tx as any).projectDiaryEntry.update({ where: { id: entryId }, data: patch })
    const hasMediaPatch = body?.media_keep_ids !== undefined || body?.media_new !== undefined
    if (hasMediaPatch) {
      const keepIds = Array.isArray(body?.media_keep_ids) ? body.media_keep_ids.map((x: any) => String(x || '').trim()).filter(Boolean) : null
      if (keepIds) {
        await (tx as any).projectDiaryMedia.deleteMany({
          where: {
            diary_entry_id: entryId,
            ...(keepIds.length ? { id: { notIn: keepIds } } : {}),
          },
        })
      }
      const mediaNew = Array.isArray(body?.media_new) ? body.media_new : []
      for (let i = 0; i < mediaNew.length; i++) {
        const m = mediaNew[i]
        const fileRecordId = m?.file_record_id ? String(m.file_record_id).trim() : ''
        const fileRecord = fileRecordId
          ? await (tx as any).fileRecord.findFirst({ where: { id: fileRecordId, is_active: true } })
          : null
        const fileUrl = normalizeUploadUrl(String(m?.file_url || fileRecord?.file_url || '').trim())
        if (!fileUrl) continue
        await (tx as any).projectDiaryMedia.create({
          data: {
            diary_entry_id: entryId,
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
    }
    if (body?.attendance_rows !== undefined) {
      await (tx as any).projectLaborAttendance.deleteMany({
        where: {
          project_id: projectId,
          diary_entry_id: entryId,
        },
      })
      for (const a of attendanceRows) {
        const workerId = parseOptionalString(a?.worker_id)
        if (!workerId) continue
        await (tx as any).projectLaborAttendance.create({
          data: {
            project_id: projectId,
            diary_entry_id: entryId,
            worker_id: workerId,
            attendance_date: nextEntryDate,
            shift_type: nextShiftType,
            source_type: 'diary',
            attendance_status: 'draft',
            work_qty: getDefaultWorkQtyByShift(nextShiftType),
            amount: null,
            note: parseOptionalString(a?.note),
            created_by: String(session.user.id || '') || null,
          },
        })
      }
    }
    return row
  })

  const project = await db.constructionProject.findUnique({ where: { id: projectId }, select: { customer_id: true } })
  await createProjectTimelineEvent({
    project_id: projectId,
    customer_id: project?.customer_id || null,
    event_key: 'project_diary_updated',
    title: 'Cap nhat nhat ky du an',
    description: updated.title,
    source_ref_type: 'project_diary_entry',
    source_ref_id: updated.id,
    actor_user_id: String(session.user.id || '') || null,
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string; entryId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsManage)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const projectId = String(params.id || '').trim()
  const entryId = String(params.entryId || '').trim()
  const existing = await (db as any).projectDiaryEntry.findFirst({ where: { id: entryId, project_id: projectId }, select: { id: true, title: true } })
  if (!existing) return NextResponse.json({ error: 'Khong tim thay nhat ky' }, { status: 404 })
  const lockedAttendances = await getLockedDiaryAttendances(projectId, entryId)
  if (lockedAttendances.length) {
    const names = lockedAttendances.map((row: any) => row.worker?.full_name || row.worker?.worker_code || 'nhan cong').join(', ')
    return NextResponse.json({ error: `Nhat ky nay co cham cong da phat sinh thanh toan (${names}). Khong the xoa.` }, { status: 409 })
  }

  await (db as any).projectDiaryEntry.delete({ where: { id: entryId } })

  const project = await db.constructionProject.findUnique({ where: { id: projectId }, select: { customer_id: true } })
  await createProjectTimelineEvent({
    project_id: projectId,
    customer_id: project?.customer_id || null,
    event_key: 'project_diary_deleted',
    title: 'Xoa nhat ky du an',
    description: existing.title,
    source_ref_type: 'project_diary_entry',
    source_ref_id: existing.id,
    actor_user_id: String(session.user.id || '') || null,
  })

  return NextResponse.json({ ok: true })
}
