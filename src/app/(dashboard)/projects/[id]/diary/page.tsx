'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { getUserDisplayName } from '@/lib/user-display'

type DiaryRow = {
  id: string
  entry_date: string
  shift_type?: string | null
  title: string
  summary?: string | null
  manpower_summary?: string | null
  equipment_summary?: string | null
  material_in_summary?: string | null
  material_out_summary?: string | null
  work_scope?: string | null
  weather?: string | null
  progress_percent_day?: number | null
  progress_percent_total?: number | null
  quality_status: string
  safety_status: string
  next_plan?: string | null
  is_investor_visible: boolean
  creator?: { id: string; username: string } | null
  media?: { id: string; file_url: string; file_type?: string | null; caption?: string | null; metadata_json?: any; file_record?: { id: string; file_name?: string | null; file_url?: string | null } | null }[]
  events?: { id: string; title: string; severity?: string | null; detail?: string | null }[]
  site_issues?: { id: string; issue_code: string; title: string; issue_type: string; workflow_type: string; severity: string; status: string; due_at?: string | null; assignee?: { id: string; username: string } | null; reporter?: { id: string; username: string } | null; subcontractor?: { id: string; supplier_name: string; supplier_code?: string | null } | null }[]
  attendances?: { id: string; worker_id?: string | null; shift_type?: string | null; work_qty?: number | null; amount?: string | null; note?: string | null; payment_locked?: boolean; payment_lock_reason?: string | null; worker?: { id: string; worker_code: string; full_name: string } | null }[]
  metadata_json?: any
}

type RosterWorker = {
  id: string
  worker?: { id: string; worker_code: string; full_name: string; phone?: string | null } | null
  crew?: { id: string; crew_key: string; crew_name: string } | null
  trade?: { id: string; trade_key: string; trade_name: string; unit_text?: string | null } | null
}

type AttendanceDraft = {
  worker_id: string
  checked: boolean
  note: string
}

type MaterialFlowLine = {
  material_name: string
  quantity: string
  unit: string
  note: string
}

type SubcontractorOption = {
  id: string
  supplier_name: string
  supplier_code: string
}

const SHIFT_OPTIONS = [
  { value: 'full_day', label: 'Cả ngày' },
  { value: 'morning', label: 'Sáng' },
  { value: 'afternoon', label: 'Chiều' },
  { value: 'night', label: 'Tối' },
]

const QUALITY_OPTIONS = [
  { value: 'ok', label: 'Đạt' },
  { value: 'issue', label: 'Có lỗi' },
  { value: 'blocked', label: 'Bị chặn' },
]

const SAFETY_OPTIONS = [
  { value: 'ok', label: 'An toàn' },
  { value: 'warning', label: 'Cảnh báo' },
  { value: 'incident', label: 'Sự cố' },
]

const FILE_CATEGORY_OPTIONS = [
  { value: 'diary_image', label: 'Ảnh thi công' },
  { value: 'diary_video', label: 'Video thi công' },
  { value: 'defect_image', label: 'Ảnh lỗi' },
  { value: 'acceptance_report', label: 'Biên bản nghiệm thu' },
  { value: 'handover_report', label: 'Biên bản bàn giao' },
  { value: 'other', label: 'Khác' },
]

const QUICK_TEMPLATES: Record<string, { label: string; requiredChecklist: string[]; defaults: Record<string, string> }> = {
  concrete_pour: {
    label: 'Đổ bê tông',
    requiredChecklist: ['concrete_grade', 'pour_time', 'before_after_media'],
    defaults: { work_scope: 'ket_cau', quality_status: 'ok', safety_status: 'ok' },
  },
  wall_build: {
    label: 'Xây tường',
    requiredChecklist: ['wall_area_m2', 'mortar_ratio', 'before_after_media'],
    defaults: { work_scope: 'hoan_thien', quality_status: 'ok', safety_status: 'ok' },
  },
  acceptance: {
    label: 'Nghiệm thu',
    requiredChecklist: ['acceptance_scope', 'acceptance_result', 'minutes_file'],
    defaults: { quality_status: 'ok', safety_status: 'ok' },
  },
  defect_fix: {
    label: 'Khắc phục lỗi',
    requiredChecklist: ['issue_root', 'fix_action', 'eta'],
    defaults: { quality_status: 'issue', safety_status: 'ok' },
  },
}

const CHECKLIST_LABELS: Record<string, string> = {
  concrete_grade: 'Mác bê tông',
  pour_time: 'Thời điểm đổ',
  before_after_media: 'Ảnh trước/sau',
  wall_area_m2: 'Diện tích tường (m2)',
  mortar_ratio: 'Tỷ lệ vữa',
  acceptance_scope: 'Phạm vi nghiệm thu',
  acceptance_result: 'Kết quả nghiệm thu',
  minutes_file: 'Biên bản nghiệm thu',
  issue_root: 'Nguyên nhân lỗi',
  fix_action: 'Biện pháp khắc phục',
  eta: 'ETA hoàn tất',
}

type DraftUpload = {
  file: File
  category: string
  note: string
}

type DiaryActionDraft = {
  row_id: string
  mode: 'task' | 'alert' | 'material_shortage'
  title: string
  detail: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
} | null

type DiaryIssueDraft = {
  row_id: string
  issue_type: 'quality' | 'safety'
  workflow_type: 'punchlist' | 'hse_issue'
  title: string
  detail: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  due_at: string
  location_text: string
  subcontractor_id: string
  media_refs: { id: string; file_record_id?: string | null; file_url: string; file_type?: string | null; caption?: string | null; metadata_json?: any }[]
} | null

type DiaryMediaViewerState = {
  row_id: string
  items: { id: string; file_url: string; file_type?: string | null; caption?: string | null; metadata_json?: any; file_record?: { id: string; file_name?: string | null; file_url?: string | null } | null }[]
  index: number
} | null

const DIARY_ACTION_ALLOWED_WEEKDAY_START = 1

const ISSUE_STATUS_LABELS: Record<string, string> = {
  open: 'Mới mở',
  assigned: 'Đã phân công',
  in_progress: 'Đang xử lý',
  fixed_waiting_verify: 'Chờ xác nhận',
  verified: 'Đã xác nhận',
  reopened: 'Mở lại',
  cancelled: 'Đã hủy',
}

function parseLocalDateOnly(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const normalized = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : raw
  const parts = normalized.split('-').map((x) => Number(x))
  if (parts.length !== 3 || parts.some((x) => Number.isNaN(x))) return null
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0)
}

function startOfLocalWeek(value: Date) {
  const d = new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0)
  const day = d.getDay()
  const diff = (day - DIARY_ACTION_ALLOWED_WEEKDAY_START + 7) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function canCreateDiaryActionThisWeek(entryDate: string | null | undefined) {
  const entry = parseLocalDateOnly(entryDate)
  if (!entry) return false
  const now = new Date()
  return startOfLocalWeek(entry).getTime() === startOfLocalWeek(now).getTime()
}

function formatDiaryMetaDate(value: string | null | undefined) {
  const date = parseLocalDateOnly(value)
  if (!date) return '-'
  const weekday = date.toLocaleDateString('vi-VN', { weekday: 'long' })
  const dayLabel = date.toLocaleDateString('vi-VN')
  return `${weekday} ${dayLabel}`
}

function canCreateQualityIssueFromDiary(row: DiaryRow) {
  return ['issue', 'blocked'].includes(String(row?.quality_status || ''))
}

function canCreateSafetyIssueFromDiary(row: DiaryRow) {
  return ['warning', 'incident'].includes(String(row?.safety_status || ''))
}

function hasActiveDiaryIssueOfType(row: DiaryRow, issueType: 'quality' | 'safety') {
  return Array.isArray(row?.site_issues)
    ? row.site_issues.some((x) => String(x?.issue_type || '') === issueType && String(x?.status || '') !== 'cancelled')
    : false
}

function latestDiaryIssueOfType(row: DiaryRow, issueType: 'quality' | 'safety') {
  return Array.isArray(row?.site_issues)
    ? row.site_issues.find((x) => String(x?.issue_type || '') === issueType)
    : null
}

function diaryIssueIndicatorMeta(issue: DiaryRow['site_issues'] extends Array<infer T> ? T : any) {
  const status = String(issue?.status || '')
  if (status === 'verified') {
    return { label: 'Đã có lỗi đã xác nhận', color: 'var(--green)', background: 'rgba(40,199,111,0.08)' }
  }
  return { label: 'Đã có lỗi đang mở', color: issue?.issue_type === 'safety' ? 'var(--red)' : 'var(--orange)', background: issue?.issue_type === 'safety' ? 'rgba(255,90,90,0.08)' : 'rgba(255,163,26,0.08)' }
}

function optionLabel(options: { value: string; label: string }[], value: string | null | undefined, fallback = '-') {
  return options.find((x) => x.value === String(value || ''))?.label || fallback
}

function visibilityLabel(value: boolean) {
  return value ? 'Công khai chủ đầu tư' : 'Nội bộ'
}

function emptyMaterialFlowLine(): MaterialFlowLine {
  return { material_name: '', quantity: '', unit: '', note: '' }
}

function parseMaterialFlowLines(value: any): MaterialFlowLine[] {
  if (!Array.isArray(value)) return []
  return value.map((x: any) => ({
    material_name: String(x?.material_name || ''),
    quantity: String(x?.quantity || ''),
    unit: String(x?.unit || ''),
    note: String(x?.note || ''),
  }))
}

function buildMaterialFlowSummary(lines: MaterialFlowLine[], fallback: string) {
  const normalized = lines
    .map((x) => ({
      material_name: String(x.material_name || '').trim(),
      quantity: String(x.quantity || '').trim(),
      unit: String(x.unit || '').trim(),
      note: String(x.note || '').trim(),
    }))
    .filter((x) => x.material_name || x.quantity || x.unit || x.note)
  if (!normalized.length) return fallback.trim() || null
  return normalized
    .map((x) => {
      const main = [x.material_name, [x.quantity, x.unit].filter(Boolean).join(' ')].filter(Boolean).join(' - ')
      return x.note ? `${main} (${x.note})` : main
    })
    .filter(Boolean)
    .join('; ')
}

function categoryLabel(v: string | null | undefined) {
  const hit = FILE_CATEGORY_OPTIONS.find((x) => x.value === String(v || ''))
  return hit?.label || 'Khác'
}

export default function ProjectDiaryPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = String(params?.id || '')
  const initialPage = Math.max(1, Number(searchParams.get('page') || 1) || 1)
  const initialPageSizeRaw = Number(searchParams.get('pageSize') || 10) || 10
  const initialPageSize = [10, 20, 30].includes(initialPageSizeRaw) ? initialPageSizeRaw : 10
  const initialEntryDateFromFilter = String(searchParams.get('entry_date_from') || '').trim()
  const initialEntryDateToFilter = String(searchParams.get('entry_date_to') || '').trim()
  const initialQualityStatusFilter = String(searchParams.get('quality_status') || '').trim()
  const initialSafetyStatusFilter = String(searchParams.get('safety_status') || '').trim()
  const initialShiftTypeFilter = String(searchParams.get('shift_type') || '').trim()
  const initialVisibilityFilter = String(searchParams.get('visibility') || '').trim()

  const [rows, setRows] = useState<DiaryRow[]>([])
  const [subcontractorOptions, setSubcontractorOptions] = useState<SubcontractorOption[]>([])
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [entryDateFromFilter, setEntryDateFromFilter] = useState(initialEntryDateFromFilter)
  const [entryDateToFilter, setEntryDateToFilter] = useState(initialEntryDateToFilter)
  const [qualityStatusFilter, setQualityStatusFilter] = useState(initialQualityStatusFilter)
  const [safetyStatusFilter, setSafetyStatusFilter] = useState(initialSafetyStatusFilter)
  const [shiftTypeFilter, setShiftTypeFilter] = useState(initialShiftTypeFilter)
  const [visibilityFilter, setVisibilityFilter] = useState(initialVisibilityFilter)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [rosterWorkers, setRosterWorkers] = useState<RosterWorker[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [editingId, setEditingId] = useState('')
  const [creatingActionKey, setCreatingActionKey] = useState('')
  const [actionDraft, setActionDraft] = useState<DiaryActionDraft>(null)
  const [issueDraft, setIssueDraft] = useState<DiaryIssueDraft>(null)
  const [issueDraftFiles, setIssueDraftFiles] = useState<DraftUpload[]>([])
  const [draftFiles, setDraftFiles] = useState<DraftUpload[]>([])
  const [editingMedia, setEditingMedia] = useState<{ id: string; file_url: string; file_type?: string | null; caption?: string | null }[]>([])
  const [keepMediaIds, setKeepMediaIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [quickTemplateKey, setQuickTemplateKey] = useState('')
  const [checklist, setChecklist] = useState<Record<string, string>>({})
  const [issueResolution, setIssueResolution] = useState('')
  const [issueEta, setIssueEta] = useState('')
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [useAttendance, setUseAttendance] = useState(false)
  const [attendanceDrafts, setAttendanceDrafts] = useState<AttendanceDraft[]>([])
  const [materialInLines, setMaterialInLines] = useState<MaterialFlowLine[]>([emptyMaterialFlowLine()])
  const [materialOutLines, setMaterialOutLines] = useState<MaterialFlowLine[]>([emptyMaterialFlowLine()])
  const [showGeneralSection, setShowGeneralSection] = useState(true)
  const [showIssueSection, setShowIssueSection] = useState(true)
  const [showResourceSection, setShowResourceSection] = useState(true)
  const [showAttendanceSection, setShowAttendanceSection] = useState(true)
  const [showMediaSection, setShowMediaSection] = useState(true)
  const [mediaViewer, setMediaViewer] = useState<DiaryMediaViewerState>(null)
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    shift_type: 'full_day',
    title: '',
    summary: '',
    manpower_summary: '',
    equipment_summary: '',
    material_in_summary: '',
    material_out_summary: '',
    work_scope: '',
    weather: '',
    progress_percent_day: '',
    progress_percent_total: '',
    quality_status: 'ok',
    safety_status: 'ok',
    next_plan: '',
    is_investor_visible: true,
  })
  const showIssuePanel = form.quality_status !== 'ok' || form.safety_status !== 'ok' || !!issueResolution || !!issueEta

  function buildAttendanceDrafts(rosterRows: RosterWorker[], currentShiftType: string, existingAttendances?: DiaryRow['attendances']) {
    const attendanceMap = new Map(
      (existingAttendances || [])
        .map((x) => [String(x.worker_id || ''), x] as const)
        .filter(([workerId]) => !!workerId),
    )
    return rosterRows
      .filter((x) => x.worker?.id)
      .map((x) => {
        const workerId = String(x.worker?.id || '')
        const existing = attendanceMap.get(workerId)
        return {
          worker_id: workerId,
          checked: !!existing,
          note: String(existing?.note || ''),
        }
      })
  }

  function getDefaultWorkQtyByShift(shiftType: string) {
    return shiftType === 'morning' || shiftType === 'afternoon' ? 0.5 : 1
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  function openMediaViewer(rowId: string, items: { id: string; file_url: string; file_type?: string | null; caption?: string | null; metadata_json?: any; file_record?: { id: string; file_name?: string | null; file_url?: string | null } | null }[], index: number) {
    if (!items?.length) return
    const safeIndex = Math.min(Math.max(index, 0), items.length - 1)
    setMediaViewer({ row_id: rowId, items, index: safeIndex })
  }

  function moveMediaViewer(step: number) {
    setMediaViewer((prev) => {
      if (!prev?.items?.length) return prev
      const total = prev.items.length
      const nextIndex = (prev.index + step + total) % total
      return { ...prev, index: nextIndex }
    })
  }

  function buildDiaryActionDraft(row: DiaryRow, mode: 'task' | 'alert' | 'material_shortage'): NonNullable<DiaryActionDraft> {
    const dateLabel = row.entry_date ? new Date(row.entry_date).toLocaleDateString('vi-VN') : 'không rõ ngày'
    const baseTitle = String(row.title || 'Nhật ký công trường').trim()
    const payload =
      mode === 'alert'
        ? {
            title: `[Cảnh báo nhật ký] ${baseTitle}`,
            detail: `Nhật ký ngày ${dateLabel}. ${row.summary ? `Tóm tắt: ${row.summary}. ` : ''}${row.metadata_json?.issue_resolution ? `Cần xử lý: ${row.metadata_json.issue_resolution}. ` : ''}${row.metadata_json?.issue_eta ? `ETA: ${row.metadata_json.issue_eta}.` : ''}`.trim(),
            priority: 'high' as const,
          }
        : mode === 'material_shortage'
          ? {
              title: `[Báo thiếu vật tư] ${baseTitle}`,
              detail: `Nhật ký ngày ${dateLabel}. ${row.material_out_summary ? `Vật tư đã dùng/ra: ${row.material_out_summary}. ` : ''}${row.material_in_summary ? `Vật tư đã vào: ${row.material_in_summary}. ` : ''}${row.summary ? `Bối cảnh: ${row.summary}. ` : ''}Cảnh báo này dùng để rà soát thiếu vật tư và hỗ trợ lên kế hoạch bổ sung.`.trim(),
              priority: 'normal' as const,
            }
          : {
              title: `[Việc từ nhật ký] ${baseTitle}`,
              detail: `Nhật ký ngày ${dateLabel}. ${row.summary ? `Tóm tắt: ${row.summary}. ` : ''}${row.next_plan ? `Kế hoạch tiếp theo: ${row.next_plan}.` : ''}`.trim(),
              priority: 'normal' as const,
            }
    return {
      row_id: row.id,
      mode,
      title: payload.title,
      detail: payload.detail,
      priority: payload.priority,
    }
  }

  function openDiaryActionDraft(row: DiaryRow, mode: 'task' | 'alert' | 'material_shortage') {
    if (!canCreateDiaryActionThisWeek(row.entry_date)) {
      showToast('Chỉ tạo việc, cảnh báo, báo thiếu vật tư ngay trong tuần hiện tại')
      return
    }
    setActionDraft(buildDiaryActionDraft(row, mode))
  }

  function buildDiaryIssueDraft(row: DiaryRow, issueType: 'quality' | 'safety', seedMedia?: { id: string; file_record_id?: string | null; file_url: string; file_type?: string | null; caption?: string | null; metadata_json?: any } | null): NonNullable<DiaryIssueDraft> {
    const dateLabel = formatDiaryMetaDate(row.entry_date)
    const baseTitle = String(row.title || 'Nhật ký công trường').trim()
    if (issueType === 'safety') {
      return {
        row_id: row.id,
        issue_type: 'safety',
        workflow_type: 'hse_issue',
        title: `[An toàn] ${baseTitle}`,
        detail: `Phát hiện từ nhật ký ${dateLabel}. ${row.summary ? `Bối cảnh: ${row.summary}. ` : ''}${row.metadata_json?.issue_resolution ? `Đề xuất xử lý: ${row.metadata_json.issue_resolution}.` : ''}`.trim(),
      severity: row.safety_status === 'incident' ? 'critical' : 'high',
      due_at: '',
      location_text: '',
      subcontractor_id: '',
      media_refs: seedMedia ? [seedMedia] : [],
    }
    }
    return {
      row_id: row.id,
      issue_type: 'quality',
      workflow_type: 'punchlist',
      title: `[QC] ${baseTitle}`,
      detail: `Phát hiện từ nhật ký ${dateLabel}. ${row.summary ? `Bối cảnh: ${row.summary}. ` : ''}${row.metadata_json?.issue_resolution ? `Đề xuất xử lý: ${row.metadata_json.issue_resolution}.` : ''}`.trim(),
      severity: row.quality_status === 'blocked' ? 'critical' : 'high',
      due_at: '',
      location_text: '',
      subcontractor_id: '',
      media_refs: seedMedia ? [seedMedia] : [],
    }
  }

  function openDiaryIssueDraft(row: DiaryRow, issueType: 'quality' | 'safety', seedMedia?: { id: string; file_record_id?: string | null; file_url: string; file_type?: string | null; caption?: string | null; metadata_json?: any } | null) {
    const canCreate = issueType === 'quality' ? canCreateQualityIssueFromDiary(row) : canCreateSafetyIssueFromDiary(row)
    if (!canCreate) {
      showToast(issueType === 'quality' ? 'Nhật ký này chưa ở trạng thái chất lượng có lỗi để tạo lỗi QC' : 'Nhật ký này chưa ở trạng thái an toàn có cảnh báo hoặc sự cố để tạo lỗi an toàn')
      return
    }
    if (hasActiveDiaryIssueOfType(row, issueType)) {
      showToast(issueType === 'quality' ? 'Nhật ký này đã có lỗi QC, vui lòng cập nhật lỗi hiện có' : 'Nhật ký này đã có lỗi an toàn, vui lòng cập nhật lỗi hiện có')
      return
    }
    setMediaViewer(null)
    setIssueDraftFiles([])
    setIssueDraft(buildDiaryIssueDraft(row, issueType, seedMedia || null))
  }

  async function createActionFromDiary() {
    if (!actionDraft) return
    const row = rows.find((x) => x.id === actionDraft.row_id)
    if (!row) return showToast('Không tìm thấy nhật ký để tạo action')
    const actionKey = `${actionDraft.row_id}_${actionDraft.mode}`
    setCreatingActionKey(actionKey)
    const res = await fetch('/api/work-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: actionDraft.title.trim(),
        detail: actionDraft.detail.trim() || null,
        is_internal: true,
        priority: actionDraft.priority,
      }),
    })
    const j = await res.json().catch(() => ({}))
    setCreatingActionKey('')
    if (!res.ok) return showToast(j?.error || 'Không tạo được action từ nhật ký')
    setActionDraft(null)
    showToast(
      actionDraft.mode === 'alert'
        ? 'Đã tạo cảnh báo từ nhật ký'
        : actionDraft.mode === 'material_shortage'
          ? 'Đã tạo báo thiếu vật tư từ nhật ký'
          : 'Đã tạo việc cần làm từ nhật ký',
    )
  }

  async function createIssueFromDiary() {
    if (!issueDraft) return
    const actionKey = `${issueDraft.row_id}_${issueDraft.issue_type}`
    setCreatingActionKey(actionKey)
    const uploadedIssueMedia: any[] = []
    for (const item of issueDraftFiles) {
      const fd = new FormData()
      fd.append('file', item.file)
      fd.append('purpose', item.category || 'defect_image')
      fd.append('owner_type', 'project')
      fd.append('owner_id', projectId)
      const upRes = await fetch('/api/files/upload', { method: 'POST', body: fd })
      const upJson = await upRes.json().catch(() => ({}))
      if (!upRes.ok) {
        setCreatingActionKey('')
        return showToast(upJson?.error || `Upload ảnh lỗi thất bại: ${item.file.name}`)
      }
      const d = upJson?.data || {}
      uploadedIssueMedia.push({
        file_record_id: d.id || null,
        file_url: d.file_url || '',
        file_type: String(d.mime_type || '').startsWith('video/') ? 'video' : 'image',
        caption: item.note?.trim() || d.display_name || d.file_name || item.file.name,
        metadata_json: { category: item.category || 'defect_image', note: item.note || '' },
      })
    }
    const res = await fetch(`/api/projects/${projectId}/site-issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_diary_entry_id: issueDraft.row_id,
        source_type: 'project_diary',
        issue_type: issueDraft.issue_type,
        workflow_type: issueDraft.workflow_type,
        title: issueDraft.title.trim(),
        detail: issueDraft.detail.trim() || null,
        severity: issueDraft.severity,
        due_at: issueDraft.due_at || null,
        location_text: issueDraft.location_text.trim() || null,
        subcontractor_id: issueDraft.subcontractor_id || null,
        media: [
          ...(issueDraft.media_refs || []).map((x) => ({
            file_record_id: x.file_record_id || null,
            file_url: x.file_url,
            file_type: x.file_type || null,
            caption: x.caption || null,
            metadata_json: x.metadata_json ?? null,
          })),
          ...uploadedIssueMedia,
        ],
      }),
    })
    const j = await res.json().catch(() => ({}))
    setCreatingActionKey('')
    if (!res.ok) return showToast(j?.error || 'Không tạo được lỗi hiện trường')
    setIssueDraft(null)
    setIssueDraftFiles([])
    await load()
    showToast(issueDraft.issue_type === 'safety' ? 'Đã tạo lỗi an toàn từ nhật ký' : 'Đã tạo lỗi QC từ nhật ký')
  }

  async function load() {
    if (!projectId) return
    setLoading(true)
    const [diaryRes, rosterRes, subcontractorRes] = await Promise.all([
      fetch(
        `/api/projects/${projectId}/diary?page=${page}&pageSize=${pageSize}&entry_date_from=${encodeURIComponent(entryDateFromFilter)}&entry_date_to=${encodeURIComponent(entryDateToFilter)}&quality_status=${encodeURIComponent(qualityStatusFilter)}&safety_status=${encodeURIComponent(safetyStatusFilter)}&shift_type=${encodeURIComponent(shiftTypeFilter)}&visibility=${encodeURIComponent(visibilityFilter)}`,
        { cache: 'no-store' },
      ),
      fetch(`/api/projects/${projectId}/labor-roster`, { cache: 'no-store' }),
      fetch('/api/subcontractors?active_only=true', { cache: 'no-store' }),
    ])
    const [diaryJson, rosterJson, subcontractorJson] = await Promise.all([
      diaryRes.json().catch(() => ({})),
      rosterRes.json().catch(() => ({})),
      subcontractorRes.json().catch(() => ({})),
    ])
    const rosterData = Array.isArray(rosterJson?.data) ? rosterJson.data : []
    const subcontractorData = Array.isArray(subcontractorJson?.data) ? subcontractorJson.data : []
    setRows(Array.isArray(diaryJson?.data) ? diaryJson.data : [])
    setSubcontractorOptions(
      subcontractorData
        .map((x: any) => ({ id: String(x?.id || ''), supplier_name: String(x?.supplier_name || ''), supplier_code: String(x?.supplier_code || '') }))
        .filter((x: SubcontractorOption) => x.id && x.supplier_name)
    )
    setTotal(Number(diaryJson?.pagination?.total || 0))
    setTotalPages(Math.max(1, Number(diaryJson?.pagination?.totalPages || 1)))
    setRosterWorkers(rosterData)
    setAttendanceDrafts((prev) => {
      if (prev.length) return prev
      return buildAttendanceDrafts(rosterData, form.shift_type)
    })
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [projectId, page, pageSize, entryDateFromFilter, entryDateToFilter, qualityStatusFilter, safetyStatusFilter, shiftTypeFilter, visibilityFilter])

  useEffect(() => {
    const nextPage = Math.max(1, Number(searchParams.get('page') || 1) || 1)
    const nextPageSizeRaw = Number(searchParams.get('pageSize') || 10) || 10
    const nextPageSize = [10, 20, 30].includes(nextPageSizeRaw) ? nextPageSizeRaw : 10
    const nextEntryDateFromFilter = String(searchParams.get('entry_date_from') || '').trim()
    const nextEntryDateToFilter = String(searchParams.get('entry_date_to') || '').trim()
    const nextQualityStatusFilter = String(searchParams.get('quality_status') || '').trim()
    const nextSafetyStatusFilter = String(searchParams.get('safety_status') || '').trim()
    const nextShiftTypeFilter = String(searchParams.get('shift_type') || '').trim()
    const nextVisibilityFilter = String(searchParams.get('visibility') || '').trim()
    if (nextPage !== page) setPage(nextPage)
    if (nextPageSize !== pageSize) setPageSize(nextPageSize)
    if (nextEntryDateFromFilter !== entryDateFromFilter) setEntryDateFromFilter(nextEntryDateFromFilter)
    if (nextEntryDateToFilter !== entryDateToFilter) setEntryDateToFilter(nextEntryDateToFilter)
    if (nextQualityStatusFilter !== qualityStatusFilter) setQualityStatusFilter(nextQualityStatusFilter)
    if (nextSafetyStatusFilter !== safetyStatusFilter) setSafetyStatusFilter(nextSafetyStatusFilter)
    if (nextShiftTypeFilter !== shiftTypeFilter) setShiftTypeFilter(nextShiftTypeFilter)
    if (nextVisibilityFilter !== visibilityFilter) setVisibilityFilter(nextVisibilityFilter)
  }, [searchParams])

  useEffect(() => {
    const currentPage = Math.max(1, Number(searchParams.get('page') || 1) || 1)
    const currentPageSizeRaw = Number(searchParams.get('pageSize') || 10) || 10
    const currentPageSize = [10, 20, 30].includes(currentPageSizeRaw) ? currentPageSizeRaw : 10
    const currentEntryDateFromFilter = String(searchParams.get('entry_date_from') || '').trim()
    const currentEntryDateToFilter = String(searchParams.get('entry_date_to') || '').trim()
    const currentQualityStatusFilter = String(searchParams.get('quality_status') || '').trim()
    const currentSafetyStatusFilter = String(searchParams.get('safety_status') || '').trim()
    const currentShiftTypeFilter = String(searchParams.get('shift_type') || '').trim()
    const currentVisibilityFilter = String(searchParams.get('visibility') || '').trim()
    if (
      currentPage === page &&
      currentPageSize === pageSize &&
      currentEntryDateFromFilter === entryDateFromFilter &&
      currentEntryDateToFilter === entryDateToFilter &&
      currentQualityStatusFilter === qualityStatusFilter &&
      currentSafetyStatusFilter === safetyStatusFilter &&
      currentShiftTypeFilter === shiftTypeFilter &&
      currentVisibilityFilter === visibilityFilter
    ) return
    const next = new URLSearchParams(searchParams.toString())
    next.set('page', String(page))
    next.set('pageSize', String(pageSize))
    if (entryDateFromFilter) next.set('entry_date_from', entryDateFromFilter)
    else next.delete('entry_date_from')
    if (entryDateToFilter) next.set('entry_date_to', entryDateToFilter)
    else next.delete('entry_date_to')
    if (qualityStatusFilter) next.set('quality_status', qualityStatusFilter)
    else next.delete('quality_status')
    if (safetyStatusFilter) next.set('safety_status', safetyStatusFilter)
    else next.delete('safety_status')
    if (shiftTypeFilter) next.set('shift_type', shiftTypeFilter)
    else next.delete('shift_type')
    if (visibilityFilter) next.set('visibility', visibilityFilter)
    else next.delete('visibility')
    router.replace(`?${next.toString()}`, { scroll: false })
  }, [page, pageSize, entryDateFromFilter, entryDateToFilter, qualityStatusFilter, safetyStatusFilter, shiftTypeFilter, visibilityFilter, router, searchParams])

  useEffect(() => {
    if (!mediaViewer) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMediaViewer(null)
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        moveMediaViewer(-1)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        moveMediaViewer(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mediaViewer])

  function resetForm() {
    setEditingId('')
    setDraftFiles([])
    setEditingMedia([])
    setKeepMediaIds([])
    setQuickTemplateKey('')
    setChecklist({})
    setIssueResolution('')
    setIssueEta('')
    setShowEntryForm(false)
    setUseAttendance(false)
    setMaterialInLines([emptyMaterialFlowLine()])
    setMaterialOutLines([emptyMaterialFlowLine()])
    setAttendanceDrafts(buildAttendanceDrafts(rosterWorkers, 'full_day'))
    setForm({
      entry_date: new Date().toISOString().slice(0, 10),
      shift_type: 'full_day',
      title: '',
      summary: '',
      manpower_summary: '',
      equipment_summary: '',
      material_in_summary: '',
      material_out_summary: '',
      work_scope: '',
      weather: '',
      progress_percent_day: '',
      progress_percent_total: '',
      quality_status: 'ok',
      safety_status: 'ok',
      next_plan: '',
      is_investor_visible: true,
    })
  }

  useEffect(() => {
    setAttendanceDrafts((prev) => {
      if (!rosterWorkers.length) return []
      if (!prev.length) return buildAttendanceDrafts(rosterWorkers, form.shift_type)
      return prev
    })
  }, [rosterWorkers, form.shift_type])

  async function submit() {
    if (!form.title.trim()) return showToast('Thiếu tiêu đề nhật ký')
    if (quickTemplateKey) {
      const reqKeys = QUICK_TEMPLATES[quickTemplateKey]?.requiredChecklist || []
      for (const k of reqKeys) {
        if (!String(checklist[k] || '').trim()) {
          return showToast(`Thiếu checklist bắt buộc: ${CHECKLIST_LABELS[k] || k}`)
        }
      }
    }
    setSubmitting(true)
    const draftMedia: any[] = []
    for (const item of draftFiles) {
      const f = item.file
      const fd = new FormData()
      fd.append('file', f, f.name)
      fd.append('purpose', item.category || 'other')
      fd.append('tag', item.category || 'other')
      fd.append('owner_type', 'project')
      fd.append('owner_id', projectId)
      const upRes = await fetch('/api/files/upload', { method: 'POST', body: fd })
      const upJson = await upRes.json().catch(() => ({}))
      if (!upRes.ok) {
        setSubmitting(false)
        return showToast(upJson?.error || `Upload thất bại: ${f.name}`)
      }
      const d = upJson?.data || {}
      draftMedia.push({
        file_record_id: d.id || null,
        file_url: d.file_url || '',
        file_type: String(d.mime_type || '').startsWith('video/') ? 'video' : 'image',
        caption: item.note?.trim() || d.display_name || d.file_name || f.name,
        metadata_json: { category: item.category || 'other', note: item.note || '' },
      })
    }

    const payload: any = {
      entry_date: form.entry_date,
      shift_type: form.shift_type,
      title: form.title.trim(),
      summary: form.summary.trim() || null,
      manpower_summary: form.manpower_summary.trim() || null,
      equipment_summary: form.equipment_summary.trim() || null,
      material_in_summary: buildMaterialFlowSummary(materialInLines, form.material_in_summary || ''),
      material_out_summary: buildMaterialFlowSummary(materialOutLines, form.material_out_summary || ''),
      work_scope: form.work_scope.trim() || null,
      weather: form.weather.trim() || null,
      progress_percent_day: form.progress_percent_day ? Number(form.progress_percent_day) : null,
      progress_percent_total: form.progress_percent_total ? Number(form.progress_percent_total) : null,
      quality_status: form.quality_status,
      safety_status: form.safety_status,
      next_plan: form.next_plan.trim() || null,
      is_investor_visible: form.is_investor_visible,
      metadata_json: {
        material_in_lines: materialInLines
          .map((x) => ({
            material_name: String(x.material_name || '').trim(),
            quantity: String(x.quantity || '').trim(),
            unit: String(x.unit || '').trim(),
            note: String(x.note || '').trim(),
          }))
          .filter((x) => x.material_name || x.quantity || x.unit || x.note),
        material_out_lines: materialOutLines
          .map((x) => ({
            material_name: String(x.material_name || '').trim(),
            quantity: String(x.quantity || '').trim(),
            unit: String(x.unit || '').trim(),
            note: String(x.note || '').trim(),
          }))
          .filter((x) => x.material_name || x.quantity || x.unit || x.note),
      },
      quick_template_key: quickTemplateKey || null,
      checklist,
      issue_resolution: issueResolution || null,
      issue_eta: issueEta || null,
      attendance_rows: useAttendance
        ? attendanceDrafts
            .filter((x) => x.checked)
            .map((x) => ({
              worker_id: x.worker_id,
              note: x.note,
            }))
        : [],
    }
    if (editingId) {
      payload.media_keep_ids = keepMediaIds
      payload.media_new = draftMedia
    } else {
      payload.media = draftMedia
    }

    const res = await fetch(editingId ? `/api/projects/${projectId}/diary/${editingId}` : `/api/projects/${projectId}/diary`, {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setSubmitting(false)
      return showToast(j?.error || 'Không lưu được nhật ký')
    }
    const wasEditing = !!editingId
    resetForm()
    await load()
    setSubmitting(false)
    showToast(wasEditing ? 'Đã cập nhật nhật ký' : 'Đã tạo nhật ký')
  }

  async function removeOne(id: string) {
    if (!confirm('Xóa nhật ký này?')) return
    const res = await fetch(`/api/projects/${projectId}/diary/${id}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không xóa được')
    if (rows.length === 1 && page > 1) {
      setPage((p) => Math.max(1, p - 1))
      showToast('Đã xóa nhật ký')
      return
    }
    await load()
    showToast('Đã xóa nhật ký')
  }

  const sortedRows = useMemo(() => rows, [rows])
  const editingRow = useMemo(() => rows.find((x) => x.id === editingId) || null, [rows, editingId])
  const editingAttendanceLocked = !!editingRow?.attendances?.some((x) => x.payment_locked)
  const checkedAttendanceCount = attendanceDrafts.filter((x) => x.checked).length
  const riskLabel = form.quality_status === 'blocked' || form.safety_status === 'incident'
    ? 'Đỏ'
    : form.quality_status === 'issue' || form.safety_status === 'warning'
      ? 'Vàng'
      : 'Xanh'

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>DỰ ÁN / NHẬT KÝ</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Nhật ký thi công</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn-ghost" href={`/projects/${projectId}/site-issues`}>Danh sách lỗi hiện trường</Link>
          <Link className="btn-ghost" href={`/projects/${projectId}/overview`}>Mở overview</Link>
          <Link className="btn-ghost" href={`/projects/${projectId}/operations`}>Mở vận hành</Link>
          <Link className="btn-ghost" href={`/projects/${projectId}/diary/view`}>Mở timeline view</Link>
          <Link className="btn-ghost" href={`/projects/${projectId}/diary/report`}>Báo cáo nhật ký</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Tóm tắt nhanh bản ghi đang nhập</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(120px,1fr))', gap: 8 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Ngày</div>
            <div style={{ fontWeight: 700 }}>{form.entry_date || '-'}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Ca làm</div>
            <div style={{ fontWeight: 700 }}>{SHIFT_OPTIONS.find((x) => x.value === form.shift_type)?.label || form.shift_type}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Tiến độ ngày</div>
            <div style={{ fontWeight: 700 }}>{form.progress_percent_day || '-'}%</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Tiến độ lũy kế</div>
            <div style={{ fontWeight: 700 }}>{form.progress_percent_total || '-'}%</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Rủi ro ngày</div>
            <div style={{ fontWeight: 700, color: riskLabel === 'Đỏ' ? 'var(--red)' : riskLabel === 'Vàng' ? 'var(--orange)' : 'var(--green)' }}>{riskLabel}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Nhân công tick</div>
            <div style={{ fontWeight: 700 }}>{checkedAttendanceCount}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>{editingId ? 'Sửa nhật ký' : 'Tạo nhật ký mới'}</div>
          <button className="btn-ghost" type="button" onClick={() => setShowEntryForm((v) => !v)}>
            {showEntryForm ? 'Ẩn form nhập nhật ký' : 'Hiện form nhập nhật ký'}
          </button>
        </div>
        {showEntryForm ? (
          <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ngày</div><input className="input" type="date" disabled={editingAttendanceLocked} value={form.entry_date} onChange={(e) => setForm((p) => ({ ...p, entry_date: e.target.value }))} /></div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ca làm</div><select className="select" disabled={editingAttendanceLocked} value={form.shift_type} onChange={(e) => setForm((p) => ({ ...p, shift_type: e.target.value }))}>{SHIFT_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Chất lượng</div><select className="select" value={form.quality_status} onChange={(e) => setForm((p) => ({ ...p, quality_status: e.target.value }))}>{QUALITY_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>An toàn</div><select className="select" value={form.safety_status} onChange={(e) => setForm((p) => ({ ...p, safety_status: e.target.value }))}>{SAFETY_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tiêu đề</div><input className="input" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Hạng mục</div><input className="input" value={form.work_scope} onChange={(e) => setForm((p) => ({ ...p, work_scope: e.target.value }))} placeholder="vd: móng" /></div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tiến độ ngày (%)</div><input className="input" value={form.progress_percent_day} onChange={(e) => setForm((p) => ({ ...p, progress_percent_day: e.target.value }))} /></div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tiến độ lũy kế (%)</div><input className="input" value={form.progress_percent_total} onChange={(e) => setForm((p) => ({ ...p, progress_percent_total: e.target.value }))} /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tóm tắt</div><textarea className="textarea" rows={3} value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} /></div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Kế hoạch ngày mai</div><textarea className="textarea" rows={3} value={form.next_plan} onChange={(e) => setForm((p) => ({ ...p, next_plan: e.target.value }))} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Template nhập nhanh</div>
            <select
              className="select"
              value={quickTemplateKey}
              onChange={(e) => {
                const k = e.target.value
                setQuickTemplateKey(k)
                if (!k) return
                const def = QUICK_TEMPLATES[k]
                if (def?.defaults) {
                  setForm((p) => ({
                    ...p,
                    work_scope: def.defaults.work_scope || p.work_scope,
                    quality_status: def.defaults.quality_status || p.quality_status,
                    safety_status: def.defaults.safety_status || p.safety_status,
                  }))
                }
              }}
            >
              <option value="">(Không dùng template)</option>
              {Object.entries(QUICK_TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Cờ rủi ro ngày</div>
            <div style={{ height: 36, border: '1px solid var(--border2)', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 12 }}>
              {form.quality_status === 'blocked' || form.safety_status === 'incident'
                ? <span style={{ color: 'var(--red)' }}>Đỏ (rủi ro cao)</span>
                : form.quality_status === 'issue' || form.safety_status === 'warning'
                  ? <span style={{ color: 'var(--orange)' }}>Vàng (cần theo dõi)</span>
                  : <span style={{ color: 'var(--green)' }}>Xanh (ổn định)</span>}
            </div>
          </div>
        </div>
        {!!quickTemplateKey && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Checklist bắt buộc theo template</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(QUICK_TEMPLATES[quickTemplateKey]?.requiredChecklist || []).map((k) => (
                <div key={k}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{CHECKLIST_LABELS[k] || k}</div>
                  <input className="input" value={checklist[k] || ''} onChange={(e) => setChecklist((p) => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Khối vấn đề và kiểm soát</div>
          <button className="btn-ghost" type="button" onClick={() => setShowIssueSection((v) => !v)}>
            {showIssueSection ? 'Ẩn khối' : 'Hiện khối'}
          </button>
        </div>
        {showIssueSection && showIssuePanel ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Phương án xử lý vấn đề (nếu có)</div>
              <textarea className="textarea" rows={2} value={issueResolution} onChange={(e) => setIssueResolution(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>ETA xử lý (nếu có)</div>
              <input className="input" value={issueEta} onChange={(e) => setIssueEta(e.target.value)} placeholder="VD: 16:00 29/05/2026" />
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Khối nguồn lực và hiện trường</div>
          <button className="btn-ghost" type="button" onClick={() => setShowResourceSection((v) => !v)}>
            {showResourceSection ? 'Ẩn khối' : 'Hiện khối'}
          </button>
        </div>
        <div style={{ display: showResourceSection ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Nhân lực chính</div><textarea className="textarea" rows={3} value={form.manpower_summary} onChange={(e) => setForm((p) => ({ ...p, manpower_summary: e.target.value }))} placeholder="VD: 6 thợ xây, 1 giám sát" /></div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Máy chính</div><textarea className="textarea" rows={3} value={form.equipment_summary} onChange={(e) => setForm((p) => ({ ...p, equipment_summary: e.target.value }))} placeholder="VD: máy trộn bê tông, máy cắt gạch" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Khối chấm công</div>
          <button className="btn-ghost" type="button" onClick={() => setShowAttendanceSection((v) => !v)}>
            {showAttendanceSection ? 'Ẩn khối' : 'Hiện khối'}
          </button>
        </div>
        <div style={{ display: showAttendanceSection ? 'block' : 'none', marginBottom: 8, border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: useAttendance ? 8 : 0 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Chấm công trong nhật ký</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Không bắt buộc. Chỉ hiện nhân công đã gán vào dự án. Số công được lấy mặc định theo ca của nhật ký.</div>
            </div>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" disabled={editingAttendanceLocked} checked={useAttendance} onChange={(e) => setUseAttendance(e.target.checked)} />
              Bật chấm công
            </label>
          </div>
          {editingAttendanceLocked ? <div style={{ fontSize: 12, color: 'var(--orange)', marginBottom: 8 }}>Nhật ký này có chấm công đã dính thanh toán, nên không thể đổi ngày, ca hoặc danh sách chấm công.</div> : null}
          {useAttendance ? (
            rosterWorkers.filter((x) => x.worker?.id).length ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 280, overflowY: 'auto' }}>
                {rosterWorkers.filter((x) => x.worker?.id).map((r) => {
                  const workerId = String(r.worker?.id || '')
                  const draft = attendanceDrafts.find((x) => x.worker_id === workerId)
                  return (
                    <div key={r.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
                          <input
                            type="checkbox"
                            disabled={editingAttendanceLocked}
                            checked={!!draft?.checked}
                            onChange={(e) =>
                              setAttendanceDrafts((prev) =>
                                prev.map((x) => (x.worker_id === workerId ? { ...x, checked: e.target.checked } : x)),
                              )
                            }
                          />
                          {r.worker?.full_name} ({r.worker?.worker_code})
                        </label>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                          Nghề: {r.trade?.trade_name || '-'} | Đội: {r.crew?.crew_name || '-'}
                        </div>
                      </div>
                      {draft?.checked ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.4fr', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Công mặc định</div>
                            <div style={{ height: 36, border: '1px solid var(--border2)', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 12 }}>
                              {getDefaultWorkQtyByShift(form.shift_type)} công / {SHIFT_OPTIONS.find((x) => x.value === form.shift_type)?.label || form.shift_type}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ghi chú công</div>
                            <input
                              className="input"
                              disabled={editingAttendanceLocked}
                              value={draft.note}
                              onChange={(e) =>
                                setAttendanceDrafts((prev) =>
                                  prev.map((x) => (x.worker_id === workerId ? { ...x, note: e.target.value } : x)),
                                )
                              }
                              placeholder="Không bắt buộc"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Dự án chưa có nhân công mặc định để chấm công.</div>
            )
          ) : null}
        </div>
        <div style={{ display: showResourceSection ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Vật tư vào quan trọng</div><textarea className="textarea" rows={3} value={form.material_in_summary} onChange={(e) => setForm((p) => ({ ...p, material_in_summary: e.target.value }))} placeholder="VD: Xi măng 100 bao, thép D16 1 tấn" /></div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Vật tư ra quan trọng</div><textarea className="textarea" rows={3} value={form.material_out_summary} onChange={(e) => setForm((p) => ({ ...p, material_out_summary: e.target.value }))} placeholder="VD: chuyển hoàn 10 bao xi măng thừa" /></div>
        </div>
        <div style={{ display: showResourceSection ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Dòng vật tư vào</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {materialInLines.map((line, idx) => (
                <div key={`min_${idx}`} style={{ display: 'grid', gridTemplateColumns: '1.2fr .6fr .5fr 1fr auto', gap: 6 }}>
                  <input className="input" placeholder="Tên vật tư" value={line.material_name} onChange={(e) => setMaterialInLines((prev) => prev.map((x, i) => i === idx ? { ...x, material_name: e.target.value } : x))} />
                  <input className="input" placeholder="Số lượng" value={line.quantity} onChange={(e) => setMaterialInLines((prev) => prev.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} />
                  <input className="input" placeholder="Đơn vị" value={line.unit} onChange={(e) => setMaterialInLines((prev) => prev.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x))} />
                  <input className="input" placeholder="Ghi chú" value={line.note} onChange={(e) => setMaterialInLines((prev) => prev.map((x, i) => i === idx ? { ...x, note: e.target.value } : x))} />
                  <button className="btn-ghost" type="button" style={{ color: 'var(--red)' }} onClick={() => setMaterialInLines((prev) => prev.length === 1 ? [emptyMaterialFlowLine()] : prev.filter((_, i) => i !== idx))}>Xóa</button>
                </div>
              ))}
              <div>
                <button className="btn-ghost" type="button" onClick={() => setMaterialInLines((prev) => [...prev, emptyMaterialFlowLine()])}>+ Thêm dòng vật tư vào</button>
              </div>
            </div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Dòng vật tư ra</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {materialOutLines.map((line, idx) => (
                <div key={`mout_${idx}`} style={{ display: 'grid', gridTemplateColumns: '1.2fr .6fr .5fr 1fr auto', gap: 6 }}>
                  <input className="input" placeholder="Tên vật tư" value={line.material_name} onChange={(e) => setMaterialOutLines((prev) => prev.map((x, i) => i === idx ? { ...x, material_name: e.target.value } : x))} />
                  <input className="input" placeholder="Số lượng" value={line.quantity} onChange={(e) => setMaterialOutLines((prev) => prev.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} />
                  <input className="input" placeholder="Đơn vị" value={line.unit} onChange={(e) => setMaterialOutLines((prev) => prev.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x))} />
                  <input className="input" placeholder="Ghi chú" value={line.note} onChange={(e) => setMaterialOutLines((prev) => prev.map((x, i) => i === idx ? { ...x, note: e.target.value } : x))} />
                  <button className="btn-ghost" type="button" style={{ color: 'var(--red)' }} onClick={() => setMaterialOutLines((prev) => prev.length === 1 ? [emptyMaterialFlowLine()] : prev.filter((_, i) => i !== idx))}>Xóa</button>
                </div>
              ))}
              <div>
                <button className="btn-ghost" type="button" onClick={() => setMaterialOutLines((prev) => [...prev, emptyMaterialFlowLine()])}>+ Thêm dòng vật tư ra</button>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Khối ảnh, video và tệp hiện trường</div>
          <button className="btn-ghost" type="button" onClick={() => setShowMediaSection((v) => !v)}>
            {showMediaSection ? 'Ẩn khối' : 'Hiện khối'}
          </button>
        </div>
        <div style={{ display: showMediaSection ? 'block' : 'none', marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
            Ảnh/video hiện trường {editingId ? '(giữ/xóa file cũ + thêm file mới)' : '(draft, chưa upload)'}
          </div>
          <input
            className="input"
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={(e) => {
                const files = Array.from(e.target.files || [])
                if (!files.length) return
                setDraftFiles((prev) => [
                  ...prev,
                  ...files.map((f) => ({
                    file: f,
                    category: f.type.startsWith('video/') ? 'diary_video' : 'diary_image',
                    note: '',
                  })),
                ])
                e.currentTarget.value = ''
              }}
            />
          {editingId && editingMedia.length ? (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>File đã có</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
                {editingMedia.map((m) => {
                  const isVideo = (m.file_type || '').toLowerCase() === 'video' || String(m.file_url || '').match(/\.(mp4|webm|mov|mkv)(\?|$)/i)
                  const kept = keepMediaIds.includes(m.id)
                  return (
                    <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 6, opacity: kept ? 1 : 0.45 }}>
                      {isVideo ? (
                        <video src={m.file_url} controls style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6 }} />
                      ) : (
                        <img src={m.file_url} alt={m.caption || 'media'} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6 }} />
                      )}
                      <button
                        className="btn-ghost"
                        style={{ fontSize: 11, color: kept ? 'var(--red)' : 'var(--green)', marginTop: 4 }}
                        onClick={() =>
                          setKeepMediaIds((prev) => (prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]))
                        }
                      >
                        {kept ? 'Bỏ file này' : 'Giữ lại'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
          {!!draftFiles.length ? (
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
              {draftFiles.map((it, idx) => {
                const f = it.file
                const isVideo = f.type.startsWith('video/')
                const src = URL.createObjectURL(f)
                return (
                  <div key={`${f.name}_${idx}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 6 }}>
                    {isVideo ? (
                      <video src={src} controls style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6 }} />
                    ) : (
                      <img src={src} alt={f.name} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6 }} />
                    )}
                    <div style={{ fontSize: 11, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                    <div style={{ marginTop: 4 }}>
                      <select
                        className="select"
                        value={it.category}
                        onChange={(e) => setDraftFiles((prev) => prev.map((x, i) => (i === idx ? { ...x, category: e.target.value } : x)))}
                      >
                        {FILE_CATEGORY_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                      </select>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <input
                        className="input"
                        placeholder="Ghi chú file (không bắt buộc)"
                        value={it.note}
                        onChange={(e) => setDraftFiles((prev) => prev.map((x, i) => (i === idx ? { ...x, note: e.target.value } : x)))}
                      />
                    </div>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}
                      onClick={() => setDraftFiles((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Xóa khỏi draft
                    </button>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: 12 }}><input type="checkbox" checked={form.is_investor_visible} onChange={(e) => setForm((p) => ({ ...p, is_investor_visible: e.target.checked }))} /> Hiển thị cho chủ đầu tư</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {editingId ? <button className="btn-ghost" onClick={resetForm}>Hủy</button> : null}
            <button className="btn-primary" onClick={submit} disabled={submitting}>{editingId ? 'Lưu sửa' : '+ Tạo nhật ký'}</button>
          </div>
        </div>
          </>
        ) : (
          <div style={{ border: '1px dashed var(--border2)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text3)' }}>
            Form nhập/sửa nhật ký đang được ẩn. Bấm <b>Hiện form nhập nhật ký</b> để tạo mới hoặc chỉnh sửa bản ghi.
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Danh sách nhật ký</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Số nhật ký / trang</div>
            <select
              className="select"
              value={pageSize}
              onChange={(e) => {
                const nextSize = Number(e.target.value) || 10
                setPageSize(nextSize)
                setPage(1)
              }}
              style={{ minWidth: 90 }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Từ ngày</div>
            <input
              className="input"
              type="date"
              value={entryDateFromFilter}
              onChange={(e) => {
                setEntryDateFromFilter(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đến ngày</div>
            <input
              className="input"
              type="date"
              value={entryDateToFilter}
              onChange={(e) => {
                setEntryDateToFilter(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Lọc theo ca làm</div>
            <select
              className="select"
              value={shiftTypeFilter}
              onChange={(e) => {
                setShiftTypeFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Tất cả ca làm</option>
              {SHIFT_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Lọc theo chất lượng</div>
            <select
              className="select"
              value={qualityStatusFilter}
              onChange={(e) => {
                setQualityStatusFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Tất cả chất lượng</option>
              {QUALITY_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Lọc theo an toàn</div>
            <select
              className="select"
              value={safetyStatusFilter}
              onChange={(e) => {
                setSafetyStatusFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Tất cả an toàn</option>
              {SAFETY_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mức hiển thị</div>
            <select
              className="select"
              value={visibilityFilter}
              onChange={(e) => {
                setVisibilityFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Tất cả</option>
              <option value="public">Công khai chủ đầu tư</option>
              <option value="internal">Nội bộ</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button
              className="btn-ghost"
              type="button"
              onClick={() => {
                setEntryDateFromFilter('')
                setEntryDateToFilter('')
                setQualityStatusFilter('')
                setSafetyStatusFilter('')
                setShiftTypeFilter('')
                setVisibilityFilter('')
                setPage(1)
              }}
            >
              Xóa lọc
            </button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
          Chỉ tạo việc, cảnh báo, báo thiếu vật tư ngay trong tuần hiện tại.
        </div>
        {loading ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Đang tải...</div> : null}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 560, overflowY: 'auto' }}>
          {sortedRows.map((r) => (
            <div key={r.id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              {(() => {
                const actionLockedByWeek = !canCreateDiaryActionThisWeek(r.entry_date)
                return (
                  <>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatDiaryMetaDate(r.entry_date)}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                  <span style={{ padding: '1px 8px', borderRadius: 999, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                    {optionLabel(SHIFT_OPTIONS, r.shift_type, r.shift_type || '-')}
                  </span>
                  <span style={{ padding: '1px 8px', borderRadius: 999, color: r.quality_status === 'ok' ? 'var(--green)' : r.quality_status === 'blocked' ? 'var(--red)' : 'var(--orange)', border: '1px solid var(--border)' }}>
                    Chất lượng: {optionLabel(QUALITY_OPTIONS, r.quality_status, r.quality_status || '-')}
                  </span>
                  <span style={{ padding: '1px 8px', borderRadius: 999, color: r.safety_status === 'ok' ? 'var(--green)' : r.safety_status === 'incident' ? 'var(--red)' : 'var(--orange)', border: '1px solid var(--border)' }}>
                    An toàn: {optionLabel(SAFETY_OPTIONS, r.safety_status, r.safety_status || '-')}
                  </span>
                  <span style={{ padding: '1px 8px', borderRadius: 999, color: r.is_investor_visible ? 'var(--blue)' : 'var(--text3)', border: '1px solid var(--border)' }}>
                    {visibilityLabel(!!r.is_investor_visible)}
                  </span>
                </div>
                {actionLockedByWeek ? <div style={{ fontSize: 11, color: 'var(--orange)', marginTop: 2 }}>Nhật ký đã qua tuần hiện tại nên không thể tạo việc, cảnh báo hoặc báo thiếu vật tư trực tiếp.</div> : null}
                {r.summary ? <div style={{ fontSize: 12, marginTop: 2 }}>{r.summary}</div> : null}
                {r?.metadata_json?.risk_flag ? (
                  <div style={{ fontSize: 11, marginTop: 2 }}>
                    Cờ rủi ro: <b>{String(r.metadata_json.risk_flag).toUpperCase()}</b>
                  </div>
                ) : null}
                {r?.metadata_json?.issue_resolution ? <div style={{ fontSize: 12, marginTop: 2 }}><strong>Xử lý:</strong> {r.metadata_json.issue_resolution}</div> : null}
                {r?.metadata_json?.issue_eta ? <div style={{ fontSize: 12, marginTop: 2 }}><strong>ETA:</strong> {r.metadata_json.issue_eta}</div> : null}
                {r.manpower_summary ? <div style={{ fontSize: 12, marginTop: 2 }}><strong>Nhân lực:</strong> {r.manpower_summary}</div> : null}
                {!!r.attendances?.length ? (
                  <div style={{ fontSize: 12, marginTop: 2 }}>
                    <strong>Chấm công:</strong> {r.attendances.map((a) => `${a.worker?.full_name || '-'} (${a.work_qty ?? 0} công)`).join(', ')}
                  </div>
                ) : null}
                {r.attendances?.some((a) => a.payment_locked) ? (
                  <div style={{ fontSize: 12, color: 'var(--orange)', marginTop: 2 }}>
                    <strong>Khóa thanh toán:</strong> {r.attendances.filter((a) => a.payment_locked).map((a) => `${a.worker?.full_name || '-'}${a.payment_lock_reason ? ` - ${a.payment_lock_reason}` : ''}`).join('; ')}
                  </div>
                ) : null}
                {r.equipment_summary ? <div style={{ fontSize: 12, marginTop: 2 }}><strong>Máy:</strong> {r.equipment_summary}</div> : null}
                {r.material_in_summary ? <div style={{ fontSize: 12, marginTop: 2 }}><strong>Vật tư vào:</strong> {r.material_in_summary}</div> : null}
                {Array.isArray(r?.metadata_json?.material_in_lines) && r.metadata_json.material_in_lines.length ? (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Dòng vật tư vào</div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      {r.metadata_json.material_in_lines.map((x: any, idx: number) => (
                        <div key={`min_line_${r.id}_${idx}`} style={{ fontSize: 12, color: 'var(--text3)' }}>
                          {String(x?.material_name || '-')}
                          {(x?.quantity || x?.unit) ? ` | ${String(x?.quantity || '')} ${String(x?.unit || '')}` : ''}
                          {x?.note ? ` | ${String(x.note)}` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {r.material_out_summary ? <div style={{ fontSize: 12, marginTop: 2 }}><strong>Vật tư ra:</strong> {r.material_out_summary}</div> : null}
                {Array.isArray(r?.metadata_json?.material_out_lines) && r.metadata_json.material_out_lines.length ? (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Dòng vật tư ra</div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      {r.metadata_json.material_out_lines.map((x: any, idx: number) => (
                        <div key={`mout_line_${r.id}_${idx}`} style={{ fontSize: 12, color: 'var(--text3)' }}>
                          {String(x?.material_name || '-')}
                          {(x?.quantity || x?.unit) ? ` | ${String(x?.quantity || '')} ${String(x?.unit || '')}` : ''}
                          {x?.note ? ` | ${String(x.note)}` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {!!r.site_issues?.length ? (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Lỗi / punch từ nhật ký: {r.site_issues.length}</div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      {r.site_issues.map((issue) => (
                        <div key={issue.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Link href={`/projects/${projectId}/site-issues/${issue.id}`} style={{ fontWeight: 700, color: 'var(--text)' }}>
                              {issue.issue_code}
                            </Link>
                            <span style={{ color: issue.issue_type === 'safety' ? 'var(--red)' : 'var(--orange)' }}>
                              {issue.issue_type === 'safety' ? 'An toàn' : 'QC'}
                            </span>
                            <span style={{ color: 'var(--text3)' }}>{ISSUE_STATUS_LABELS[issue.status] || issue.status}</span>
                            <span style={{ color: issue.severity === 'critical' ? 'var(--red)' : issue.severity === 'high' ? 'var(--orange)' : 'var(--text3)' }}>
                              {issue.severity}
                            </span>
                          </div>
                          <div style={{ marginTop: 2 }}>{issue.title}</div>
                          <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text3)' }}>
                      {issue.assignee ? `Phụ trách nội bộ: ${getUserDisplayName(issue.assignee)}` : 'Chưa phân công nội bộ'}
                            {issue.subcontractor ? ` | Thầu phụ: ${issue.subcontractor.supplier_name}` : ''}
                            {issue.due_at ? ` | Hạn: ${new Date(issue.due_at).toLocaleDateString('vi-VN')}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {!!r.media?.length ? (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ảnh/tệp: {r.media.length}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 6 }}>
                      {r.media.map((m, mediaIdx) => {
                        const isVideo = (m.file_type || '').toLowerCase() === 'video' || String(m.file_url || '').match(/\.(mp4|webm|mov|mkv)(\?|$)/i)
                        const cLabel = categoryLabel(m?.metadata_json?.category)
                        return isVideo ? (
                          <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 4 }}>
                            <div style={{ fontSize: 10, color: 'var(--blue)', marginBottom: 2 }}>{cLabel}</div>
                            <button
                              type="button"
                              onClick={() => openMediaViewer(r.id, r.media || [], mediaIdx)}
                              style={{ display: 'block', width: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}
                            >
                              <video src={m.file_url} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6 }} />
                            </button>
                          </div>
                        ) : (
                          <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 4 }}>
                            <div style={{ fontSize: 10, color: 'var(--blue)', marginBottom: 2 }}>{cLabel}</div>
                            <button
                              type="button"
                              onClick={() => openMediaViewer(r.id, r.media || [], mediaIdx)}
                              style={{ display: 'block', width: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}
                            >
                              <img src={m.file_url} alt={m.caption || 'media'} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6 }} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
                {!!r.events?.length ? <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Sự kiện: {r.events.length}</div> : null}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch', minWidth: 150 }}>
                {(() => {
                  const canCreateQualityIssue = canCreateQualityIssueFromDiary(r)
                  const canCreateSafetyIssue = canCreateSafetyIssueFromDiary(r)
                  const hasQualityIssue = hasActiveDiaryIssueOfType(r, 'quality')
                  const hasSafetyIssue = hasActiveDiaryIssueOfType(r, 'safety')
                  return (
                    <>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11 }}
                  disabled={creatingActionKey === `${r.id}_task` || actionLockedByWeek}
                  onClick={() => openDiaryActionDraft(r, 'task')}
                >
                  {creatingActionKey === `${r.id}_task` ? 'Đang tạo...' : 'Tạo việc'}
                </button>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11, color: 'var(--orange)' }}
                  disabled={creatingActionKey === `${r.id}_alert` || actionLockedByWeek}
                  onClick={() => openDiaryActionDraft(r, 'alert')}
                >
                  {creatingActionKey === `${r.id}_alert` ? 'Đang tạo...' : 'Cảnh báo'}
                </button>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11, color: 'var(--blue)' }}
                  disabled={creatingActionKey === `${r.id}_material_shortage` || actionLockedByWeek}
                  onClick={() => openDiaryActionDraft(r, 'material_shortage')}
                >
                  {creatingActionKey === `${r.id}_material_shortage` ? 'Đang tạo...' : 'Báo thiếu vật tư'}
                </button>
                {canCreateQualityIssue ? (
                  hasQualityIssue ? (
                    (() => {
                      const linkedIssue = latestDiaryIssueOfType(r, 'quality')
                      const indicator = diaryIssueIndicatorMeta(linkedIssue)
                      return linkedIssue ? (
                        <Link
                          href={`/projects/${projectId}/site-issues/${linkedIssue.id}`}
                          style={{ fontSize: 11, color: indicator.color, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', background: indicator.background, textDecoration: 'none', fontWeight: 700 }}
                        >
                          {indicator.label}
                        </Link>
                      ) : null
                    })()
                  ) : (
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 11, color: 'var(--orange)' }}
                      disabled={creatingActionKey === `${r.id}_quality`}
                      onClick={() => openDiaryIssueDraft(r, 'quality')}
                    >
                      {creatingActionKey === `${r.id}_quality` ? 'Đang tạo...' : 'Tạo lỗi QC'}
                    </button>
                  )
                ) : null}
                {canCreateSafetyIssue ? (
                  hasSafetyIssue ? (
                    (() => {
                      const linkedIssue = latestDiaryIssueOfType(r, 'safety')
                      const indicator = diaryIssueIndicatorMeta(linkedIssue)
                      return linkedIssue ? (
                        <Link
                          href={`/projects/${projectId}/site-issues/${linkedIssue.id}`}
                          style={{ fontSize: 11, color: indicator.color, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', background: indicator.background, textDecoration: 'none', fontWeight: 700 }}
                        >
                          {indicator.label}
                        </Link>
                      ) : null
                    })()
                  ) : (
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 11, color: 'var(--red)' }}
                      disabled={creatingActionKey === `${r.id}_safety`}
                      onClick={() => openDiaryIssueDraft(r, 'safety')}
                    >
                      {creatingActionKey === `${r.id}_safety` ? 'Đang tạo...' : 'Tạo lỗi an toàn'}
                    </button>
                  )
                ) : null}
                <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => {
                  setEditingId(r.id)
                  setShowEntryForm(true)
                  setDraftFiles([])
                  setEditingMedia(Array.isArray(r.media) ? r.media : [])
                  setKeepMediaIds(Array.isArray(r.media) ? r.media.map((m) => m.id) : [])
                  setQuickTemplateKey(String(r?.metadata_json?.quick_template_key || ''))
                  setChecklist((r?.metadata_json?.checklist && typeof r.metadata_json.checklist === 'object') ? r.metadata_json.checklist : {})
                  setIssueResolution(String(r?.metadata_json?.issue_resolution || ''))
                  setIssueEta(String(r?.metadata_json?.issue_eta || ''))
                  setMaterialInLines(parseMaterialFlowLines(r?.metadata_json?.material_in_lines).length ? parseMaterialFlowLines(r?.metadata_json?.material_in_lines) : [emptyMaterialFlowLine()])
                  setMaterialOutLines(parseMaterialFlowLines(r?.metadata_json?.material_out_lines).length ? parseMaterialFlowLines(r?.metadata_json?.material_out_lines) : [emptyMaterialFlowLine()])
                  setUseAttendance(!!r.attendances?.length)
                  setAttendanceDrafts(buildAttendanceDrafts(rosterWorkers, r.shift_type || 'full_day', r.attendances))
                  setForm({
                    entry_date: new Date(r.entry_date).toISOString().slice(0, 10),
                    shift_type: r.shift_type || 'full_day',
                    title: r.title || '',
                    summary: r.summary || '',
                    manpower_summary: r.manpower_summary || '',
                    equipment_summary: r.equipment_summary || '',
                    material_in_summary: r.material_in_summary || '',
                    material_out_summary: r.material_out_summary || '',
                    work_scope: r.work_scope || '',
                    weather: r.weather || '',
                    progress_percent_day: r.progress_percent_day != null ? String(r.progress_percent_day) : '',
                    progress_percent_total: r.progress_percent_total != null ? String(r.progress_percent_total) : '',
                    quality_status: r.quality_status || 'ok',
                    safety_status: r.safety_status || 'ok',
                    next_plan: r.next_plan || '',
                    is_investor_visible: !!r.is_investor_visible,
                  })
                }}>Sửa</button>
                {!r.attendances?.some((a) => a.payment_locked) ? (
                  <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => removeOne(r.id)}>Xóa</button>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>Đã khóa xóa</div>
                )}
                    </>
                  )
                })()}
              </div>
                  </>
                )
              })()}
            </div>
          ))}
          {!sortedRows.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Chưa có nhật ký.</div> : null}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Tổng: {total} nhật ký | Trang {page}/{totalPages}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn-ghost" type="button" disabled={page <= 1 || loading} onClick={() => setPage(1)}>Trang đầu</button>
            <button className="btn-ghost" type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Trang trước</button>
            <button className="btn-ghost" type="button" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Trang sau</button>
            <button className="btn-ghost" type="button" disabled={page >= totalPages || loading} onClick={() => setPage(totalPages)}>Trang cuối</button>
          </div>
        </div>
      </div>

      {actionDraft ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: 16 }}>
          <div className="card" style={{ width: 'min(760px, 100%)', padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {actionDraft.mode === 'alert' ? 'Tạo cảnh báo từ nhật ký' : actionDraft.mode === 'material_shortage' ? 'Tạo báo thiếu vật tư từ nhật ký' : 'Tạo việc cần làm từ nhật ký'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr .6fr', gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tiêu đề</div>
                <input className="input" value={actionDraft.title} onChange={(e) => setActionDraft((prev) => prev ? { ...prev, title: e.target.value } : prev)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ưu tiên</div>
                <select className="select" value={actionDraft.priority} onChange={(e) => setActionDraft((prev) => prev ? { ...prev, priority: e.target.value as any } : prev)}>
                  <option value="low">Thấp</option>
                  <option value="normal">Bình thường</option>
                  <option value="high">Cao</option>
                  <option value="urgent">Khẩn</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Nội dung</div>
              <textarea className="textarea" rows={5} value={actionDraft.detail} onChange={(e) => setActionDraft((prev) => prev ? { ...prev, detail: e.target.value } : prev)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button className="btn-ghost" type="button" onClick={() => setActionDraft(null)}>Hủy</button>
              <button className="btn-primary" type="button" disabled={!actionDraft.title.trim() || creatingActionKey === `${actionDraft.row_id}_${actionDraft.mode}`} onClick={createActionFromDiary}>
                {creatingActionKey === `${actionDraft.row_id}_${actionDraft.mode}` ? 'Đang tạo...' : 'Xác nhận tạo action'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {issueDraft ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: 16 }}>
          <div className="card" style={{ width: 'min(760px, 100%)', padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {issueDraft.issue_type === 'safety' ? 'Tạo lỗi an toàn từ nhật ký' : 'Tạo lỗi QC từ nhật ký'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr .7fr .7fr', gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tiêu đề lỗi</div>
                <input className="input" value={issueDraft.title} onChange={(e) => setIssueDraft((prev) => prev ? { ...prev, title: e.target.value } : prev)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mức độ</div>
                <select className="select" value={issueDraft.severity} onChange={(e) => setIssueDraft((prev) => prev ? { ...prev, severity: e.target.value as any } : prev)}>
                  <option value="low">Thấp</option>
                  <option value="medium">Trung bình</option>
                  <option value="high">Cao</option>
                  <option value="critical">Nghiêm trọng</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Hạn xử lý</div>
                <input className="input" type="date" value={issueDraft.due_at} onChange={(e) => setIssueDraft((prev) => prev ? { ...prev, due_at: e.target.value } : prev)} />
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Vị trí / khu vực</div>
              <input className="input" value={issueDraft.location_text} onChange={(e) => setIssueDraft((prev) => prev ? { ...prev, location_text: e.target.value } : prev)} placeholder="Ví dụ: tầng 2 - khu vực mặt tiền" />
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Thầu phụ xử lý (nếu có)</div>
              <select
                className="select"
                value={issueDraft.subcontractor_id}
                onChange={(e) => setIssueDraft((prev) => prev ? { ...prev, subcontractor_id: e.target.value } : prev)}
              >
                <option value="">(Chưa gán thầu phụ)</option>
                {subcontractorOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.supplier_name}{item.supplier_code ? ` (${item.supplier_code})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mô tả lỗi</div>
              <textarea className="textarea" rows={5} value={issueDraft.detail} onChange={(e) => setIssueDraft((prev) => prev ? { ...prev, detail: e.target.value } : prev)} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ảnh / tệp gắn vào issue</div>
              {!!issueDraft.media_refs.length ? (
                <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                  {issueDraft.media_refs.map((m, idx) => (
                    <div key={`${m.id}_${idx}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{m.caption || 'Ảnh nhật ký đã chọn'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{categoryLabel(m?.metadata_json?.category)} | {m.file_type || 'image'}</div>
                      </div>
                      <button className="btn-ghost" type="button" onClick={() => setIssueDraft((prev) => prev ? { ...prev, media_refs: prev.media_refs.filter((_, mediaIdx) => mediaIdx !== idx) } : prev)}>Bỏ</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>Chưa chọn ảnh/tệp từ nhật ký.</div>
              )}
              <input
                className="input"
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx"
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  if (!files.length) return
                  setIssueDraftFiles((prev) => [
                    ...prev,
                    ...files.map((file) => ({
                      file,
                      category: file.type.startsWith('video/') ? 'diary_video' : 'defect_image',
                      note: '',
                    })),
                  ])
                  e.currentTarget.value = ''
                }}
              />
              {!!issueDraftFiles.length ? (
                <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                  {issueDraftFiles.map((item, idx) => (
                    <div key={`${item.file.name}_${idx}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr auto', gap: 8, alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, overflowWrap: 'anywhere' }}>{item.file.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{Math.round(item.file.size / 1024)} KB</div>
                        </div>
                        <select className="select" value={item.category} onChange={(e) => setIssueDraftFiles((prev) => prev.map((x, fileIdx) => fileIdx === idx ? { ...x, category: e.target.value } : x))}>
                          {FILE_CATEGORY_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                        </select>
                        <button className="btn-ghost" type="button" onClick={() => setIssueDraftFiles((prev) => prev.filter((_, fileIdx) => fileIdx !== idx))}>Bỏ</button>
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ghi chú tệp</div>
                        <input className="input" value={item.note} onChange={(e) => setIssueDraftFiles((prev) => prev.map((x, fileIdx) => fileIdx === idx ? { ...x, note: e.target.value } : x))} placeholder="Ví dụ: ảnh nứt góc tường" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button className="btn-ghost" type="button" onClick={() => { setIssueDraft(null); setIssueDraftFiles([]) }}>Hủy</button>
              <button className="btn-primary" type="button" disabled={!issueDraft.title.trim() || creatingActionKey === `${issueDraft.row_id}_${issueDraft.issue_type}`} onClick={createIssueFromDiary}>
                {creatingActionKey === `${issueDraft.row_id}_${issueDraft.issue_type}` ? 'Đang tạo...' : 'Xác nhận tạo lỗi'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mediaViewer ? (
        <div
          onClick={() => setMediaViewer(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.84)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: 16 }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(1200px, 100%)', maxHeight: 'calc(100vh - 32px)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{mediaViewer.items[mediaViewer.index]?.caption || 'Xem ảnh/tệp nhật ký'}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {categoryLabel(mediaViewer.items[mediaViewer.index]?.metadata_json?.category)} | {mediaViewer.index + 1}/{mediaViewer.items.length}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(() => {
                  const row = rows.find((x) => x.id === mediaViewer.row_id)
                  const active = mediaViewer.items[mediaViewer.index]
                  if (!row || !active) return null
                  const canCreateQualityIssue = canCreateQualityIssueFromDiary(row) && !hasActiveDiaryIssueOfType(row, 'quality')
                  const canCreateSafetyIssue = canCreateSafetyIssueFromDiary(row) && !hasActiveDiaryIssueOfType(row, 'safety')
                  return (
                    <>
                      {canCreateQualityIssue ? (
                        <button
                          className="btn-ghost"
                          type="button"
                          onClick={() => {
                            openDiaryIssueDraft(row, 'quality', {
                              id: active.id,
                              file_record_id: active.file_record?.id || null,
                              file_url: active.file_url,
                              file_type: active.file_type || null,
                              caption: active.caption || null,
                              metadata_json: active.metadata_json ?? null,
                            })
                          }}
                        >
                          Tạo lỗi QC từ ảnh này
                        </button>
                      ) : null}
                      {canCreateSafetyIssue ? (
                        <button
                          className="btn-ghost"
                          type="button"
                          onClick={() => {
                            openDiaryIssueDraft(row, 'safety', {
                              id: active.id,
                              file_record_id: active.file_record?.id || null,
                              file_url: active.file_url,
                              file_type: active.file_type || null,
                              caption: active.caption || null,
                              metadata_json: active.metadata_json ?? null,
                            })
                          }}
                        >
                          Tạo lỗi an toàn từ ảnh này
                        </button>
                      ) : null}
                    </>
                  )
                })()}
                <button className="btn-ghost" type="button" onClick={() => moveMediaViewer(-1)}>Trước</button>
                <button className="btn-ghost" type="button" onClick={() => moveMediaViewer(1)}>Sau</button>
                <button className="btn-primary" type="button" onClick={() => setMediaViewer(null)}>Đóng</button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, overflow: 'auto' }}>
              {(() => {
                const active = mediaViewer.items[mediaViewer.index]
                const isVideo = (active?.file_type || '').toLowerCase() === 'video' || String(active?.file_url || '').match(/\.(mp4|webm|mov|mkv)(\?|$)/i)
                if (!active) return null
                return isVideo ? (
                  <video src={active.file_url} controls autoPlay style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 180px)', borderRadius: 8, background: '#000' }} />
                ) : (
                  <img src={active.file_url} alt={active.caption || 'media'} style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 180px)', objectFit: 'contain', borderRadius: 8 }} />
                )
              })()}
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>{toast}</div> : null}
    </div>
  )
}
