'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getUserDisplayLabel, getUserDisplayName } from '@/lib/user-display'

type UserOption = {
  id: string
  username: string
  full_name?: string | null
  role?: string | null
  primary_access_role?: { key?: string | null; name?: string | null } | null
}

type IssueMedia = {
  id: string
  file_url: string
  caption?: string | null
  file_type?: string | null
}

type IssueDetail = {
  id: string
  issue_code: string
  title: string
  detail?: string | null
  issue_type: string
  workflow_type: string
  severity: string
  status: string
  due_at?: string | null
  location_text?: string | null
  reporter?: { id: string; username: string } | null
  assignee?: { id: string; username: string } | null
  verifier?: { id: string; username: string } | null
  source_diary_entry?: { id: string; title: string; entry_date: string } | null
  media?: IssueMedia[]
  events?: { id: string; event_key: string; title: string; detail?: string | null; created_at: string; actor?: { id: string; username: string } | null }[]
}

type DraftUpload = {
  file: File
  category: string
  note: string
}

type MediaViewerState = {
  items: IssueMedia[]
  index: number
} | null

const ACTION_OPTIONS = [
  { value: 'start', label: 'Bắt đầu xử lý' },
  { value: 'submit_fix', label: 'Báo đã khắc phục' },
  { value: 'verify', label: 'Nghiệm thu đạt' },
  { value: 'reopen', label: 'Không đạt / mở lại' },
  { value: 'cancel', label: 'Hủy lỗi' },
  { value: 'comment', label: 'Thêm ghi chú' },
]

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Thấp' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'high', label: 'Cao' },
  { value: 'critical', label: 'Nghiêm trọng' },
]

const FILE_CATEGORY_OPTIONS = [
  { value: 'defect_image', label: 'Ảnh lỗi' },
  { value: 'diary_video', label: 'Video hiện trường' },
  { value: 'acceptance_report', label: 'Biên bản nghiệm thu' },
  { value: 'other', label: 'Khác' },
]

const STATUS_LABELS: Record<string, string> = {
  open: 'Mới mở',
  assigned: 'Đã phân công',
  in_progress: 'Đang xử lý',
  fixed_waiting_verify: 'Chờ nghiệm thu',
  verified: 'Đã nghiệm thu',
  reopened: 'Mở lại',
  cancelled: 'Đã hủy',
}

export default function ProjectSiteIssueDetailPage() {
  const params = useParams<{ id: string; issueId: string }>()
  const router = useRouter()
  const projectId = String(params?.id || '')
  const issueId = String(params?.issueId || '')
  const [row, setRow] = useState<IssueDetail | null>(null)
  const [users, setUsers] = useState<UserOption[]>([])
  const [action, setAction] = useState('comment')
  const [detail, setDetail] = useState('')
  const [assignTo, setAssignTo] = useState('')
  const [assignDueAt, setAssignDueAt] = useState('')
  const [editForm, setEditForm] = useState({
    title: '',
    detail: '',
    severity: 'medium',
    location_text: '',
    due_at: '',
  })
  const [draftFiles, setDraftFiles] = useState<DraftUpload[]>([])
  const [keepMediaIds, setKeepMediaIds] = useState<string[]>([])
  const [mediaViewer, setMediaViewer] = useState<MediaViewerState>(null)
  const [loading, setLoading] = useState(true)
  const [savingEdit, setSavingEdit] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function openMediaViewer(items: IssueMedia[], index: number) {
    if (!items.length) return
    const nextIndex = Math.min(Math.max(index, 0), items.length - 1)
    setMediaViewer({ items, index: nextIndex })
  }

  function moveMediaViewer(step: number) {
    setMediaViewer((prev) => {
      if (!prev?.items?.length) return prev
      const total = prev.items.length
      const nextIndex = (prev.index + step + total) % total
      return { ...prev, index: nextIndex }
    })
  }

  async function load() {
    if (!projectId || !issueId) return
    setLoading(true)
    const [res, usersRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/site-issues/${issueId}`, { cache: 'no-store' }),
      fetch('/api/users', { cache: 'no-store' }),
    ])
    const [j, usersJson] = await Promise.all([
      res.json().catch(() => ({})),
      usersRes.json().catch(() => ({})),
    ])
    const nextRow = j?.data || null
    setRow(nextRow)
    setUsers(Array.isArray(usersJson?.data) ? usersJson.data.map((x: any) => ({ id: String(x.id || ''), username: String(x.username || ''), full_name: x.full_name || null, role: x.role || null, primary_access_role: x.primary_access_role || null })) : [])
    setAssignTo(String(nextRow?.assignee?.id || ''))
    setAssignDueAt(nextRow?.due_at ? new Date(nextRow.due_at).toISOString().slice(0, 10) : '')
    setKeepMediaIds(Array.isArray(nextRow?.media) ? nextRow.media.map((x: any) => String(x.id || '')) : [])
    setEditForm({
      title: String(nextRow?.title || ''),
      detail: String(nextRow?.detail || ''),
      severity: String(nextRow?.severity || 'medium'),
      location_text: String(nextRow?.location_text || ''),
      due_at: nextRow?.due_at ? new Date(nextRow.due_at).toISOString().slice(0, 10) : '',
    })
    setLoading(false)
  }

  async function submitAction() {
    if (!projectId || !issueId) return
    setSubmitting(true)
    const payload: any = { action, detail: detail.trim() || null }
    if (action === 'assign') {
      payload.assigned_to = assignTo || null
      payload.due_at = assignDueAt || null
    }
    const res = await fetch(`/api/projects/${projectId}/site-issues/${issueId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    setSubmitting(false)
    if (!res.ok) {
      alert(j?.error || 'Không cập nhật được lỗi hiện trường')
      return
    }
    setRow(j?.data || null)
    setDetail('')
  }

  async function saveIssueDetail() {
    if (!projectId || !issueId) return
    setSavingEdit(true)
    const mediaNew: any[] = []
    for (const item of draftFiles) {
      const fd = new FormData()
      fd.append('file', item.file)
      fd.append('purpose', item.category || 'defect_image')
      fd.append('owner_type', 'project')
      fd.append('owner_id', projectId)
      const upRes = await fetch('/api/files/upload', { method: 'POST', body: fd })
      const upJson = await upRes.json().catch(() => ({}))
      if (!upRes.ok) {
        setSavingEdit(false)
        return alert(upJson?.error || `Upload thất bại: ${item.file.name}`)
      }
      const d = upJson?.data || {}
      mediaNew.push({
        file_record_id: d.id || null,
        file_url: d.file_url || '',
        file_type: String(d.mime_type || '').startsWith('video/') ? 'video' : 'image',
        caption: item.note?.trim() || d.display_name || d.file_name || item.file.name,
        metadata_json: { category: item.category || 'defect_image', note: item.note || '' },
      })
    }

    const res = await fetch(`/api/projects/${projectId}/site-issues/${issueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editForm.title.trim(),
        detail: editForm.detail.trim() || null,
        severity: editForm.severity,
        location_text: editForm.location_text.trim() || null,
        due_at: editForm.due_at || null,
        media_keep_ids: keepMediaIds,
        media_new: mediaNew,
      }),
    })
    const j = await res.json().catch(() => ({}))
    setSavingEdit(false)
    if (!res.ok) {
      alert(j?.error || 'Không lưu được thông tin lỗi')
      return
    }
    setRow(j?.data || null)
    setDraftFiles([])
    setKeepMediaIds(Array.isArray(j?.data?.media) ? j.data.media.map((x: any) => String(x.id || '')) : [])
  }

  useEffect(() => {
    load()
  }, [projectId, issueId])

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>DỰ ÁN / QC - HSE</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Chi tiết lỗi hiện trường</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-ghost" type="button" onClick={() => router.back()}>Quay lại</button>
          <Link className="btn-ghost" href={`/projects/${projectId}/site-issues`}>Danh sách lỗi</Link>
          <Link className="btn-ghost" href={`/projects/${projectId}/diary`}>Nhật ký</Link>
        </div>
      </div>

      {!row && loading ? <div className="card" style={{ padding: 12 }}>Đang tải...</div> : null}
      {!row && !loading ? <div className="card" style={{ padding: 12 }}>Không tìm thấy lỗi hiện trường.</div> : null}

      {row ? (
        <>
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{row.issue_code}</span>
                  <span style={{ color: row.issue_type === 'safety' ? 'var(--red)' : 'var(--orange)' }}>
                    {row.issue_type === 'safety' ? 'An toàn' : 'QC'}
                  </span>
                  <span style={{ color: 'var(--text3)' }}>{STATUS_LABELS[row.status] || row.status}</span>
                  <span style={{ color: row.severity === 'critical' ? 'var(--red)' : row.severity === 'high' ? 'var(--orange)' : 'var(--text3)' }}>{row.severity}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{row.title}</div>
                {row.detail ? <div style={{ marginTop: 6, fontSize: 13 }}>{row.detail}</div> : null}
              </div>
              <div style={{ minWidth: 220, fontSize: 12, color: 'var(--text3)' }}>
                <div>Phụ trách: {row.assignee ? getUserDisplayName(row.assignee) : 'Chưa phân công'}</div>
                <div>Người báo: {row.reporter ? getUserDisplayName(row.reporter) : '-'}</div>
                <div>Hạn xử lý: {row.due_at ? new Date(row.due_at).toLocaleDateString('vi-VN') : '-'}</div>
                <div>Vị trí: {row.location_text || '-'}</div>
                {row.source_diary_entry ? <div>Nguồn nhật ký: {row.source_diary_entry.title}</div> : null}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Cập nhật nội dung lỗi</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 180px', gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tiêu đề lỗi</div>
                <input className="input" value={editForm.title} onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mức độ</div>
                <select className="select" value={editForm.severity} onChange={(e) => setEditForm((prev) => ({ ...prev, severity: e.target.value }))}>
                  {SEVERITY_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Hạn xử lý</div>
                <input className="input" type="date" value={editForm.due_at} onChange={(e) => setEditForm((prev) => ({ ...prev, due_at: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Vị trí / khu vực</div>
              <input className="input" value={editForm.location_text} onChange={(e) => setEditForm((prev) => ({ ...prev, location_text: e.target.value }))} placeholder="Ví dụ: tầng 2 - khu vực mặt tiền" />
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mô tả lỗi</div>
              <textarea className="textarea" rows={4} value={editForm.detail} onChange={(e) => setEditForm((prev) => ({ ...prev, detail: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Thêm ảnh / tệp bổ sung</div>
              <input
                className="input"
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx"
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  if (!files.length) return
                  setDraftFiles((prev) => [
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
              {!!draftFiles.length ? (
                <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                  {draftFiles.map((item, idx) => (
                    <div key={`${item.file.name}_${idx}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr auto', gap: 8, alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, overflowWrap: 'anywhere' }}>{item.file.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{Math.round(item.file.size / 1024)} KB</div>
                        </div>
                        <select className="select" value={item.category} onChange={(e) => setDraftFiles((prev) => prev.map((x, fileIdx) => fileIdx === idx ? { ...x, category: e.target.value } : x))}>
                          {FILE_CATEGORY_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                        </select>
                        <button className="btn-ghost" type="button" onClick={() => setDraftFiles((prev) => prev.filter((_, fileIdx) => fileIdx !== idx))}>Bỏ</button>
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ghi chú tệp</div>
                        <input className="input" value={item.note} onChange={(e) => setDraftFiles((prev) => prev.map((x, fileIdx) => fileIdx === idx ? { ...x, note: e.target.value } : x))} placeholder="Ví dụ: ảnh nứt góc tường" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" type="button" disabled={savingEdit || !editForm.title.trim()} onClick={saveIssueDetail}>
                {savingEdit ? 'Đang lưu...' : 'Lưu nội dung lỗi'}
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Phân công xử lý</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px auto', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Người phụ trách</div>
                <select className="select" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                  <option value="">Chưa phân công</option>
                  {users.map((x) => <option key={x.id} value={x.id}>{getUserDisplayLabel(x)}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Hạn xử lý</div>
                <input className="input" type="date" value={assignDueAt} onChange={(e) => setAssignDueAt(e.target.value)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn-primary" type="button" disabled={submitting} onClick={async () => {
                  setAction('assign')
                  setSubmitting(true)
                  const res = await fetch(`/api/projects/${projectId}/site-issues/${issueId}/actions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'assign', assigned_to: assignTo || null, due_at: assignDueAt || null, detail: detail.trim() || null }),
                  })
                  const j = await res.json().catch(() => ({}))
                  setSubmitting(false)
                  if (!res.ok) return alert(j?.error || 'Không phân công được')
                  setRow(j?.data || null)
                  setDetail('')
                }}>
                  {submitting && action === 'assign' ? 'Đang phân công...' : 'Phân công'}
                </button>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Cập nhật trạng thái</div>
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr auto', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Hành động</div>
                <select className="select" value={action} onChange={(e) => setAction(e.target.value)}>
                  <option value="assign">Phân công / đổi người phụ trách</option>
                  {ACTION_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Nội dung</div>
                <input className="input" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Ghi chú cập nhật nếu cần" />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn-primary" type="button" disabled={submitting} onClick={submitAction}>
                  {submitting ? 'Đang cập nhật...' : 'Cập nhật'}
                </button>
              </div>
            </div>
          </div>

          {!!row.media?.length ? (
            <div className="card" style={{ padding: 12, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Ảnh / tệp liên quan</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
                {row.media.filter((m) => keepMediaIds.includes(m.id)).map((m, idx, arr) => (
                  <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 6 }}>
                    <button
                      type="button"
                      onClick={() => openMediaViewer(arr, idx)}
                      style={{ display: 'block', width: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    >
                      {(m.file_type || '').toLowerCase() === 'video' ? (
                        <video src={m.file_url} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 6 }} />
                      ) : (
                        <img src={m.file_url} alt={m.caption || 'issue media'} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 6 }} />
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{m.caption || 'Tệp hiện trường'}</div>
                    </button>
                    <button className="btn-ghost" type="button" style={{ marginTop: 6, width: '100%', color: 'var(--red)' }} onClick={() => setKeepMediaIds((prev) => prev.filter((id) => id !== m.id))}>Gỡ khỏi issue</button>
                  </div>
                ))}
              </div>
              {!keepMediaIds.length ? <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>Bạn đã gỡ hết media hiện có. Bấm lưu để áp dụng.</div> : null}
            </div>
          ) : null}

          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Lịch sử xử lý</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {(row.events || []).map((ev) => (
                <div key={ev.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700 }}>{ev.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(ev.created_at).toLocaleString('vi-VN')}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Người thực hiện: {ev.actor ? getUserDisplayName(ev.actor) : '-'}</div>
                  {ev.detail ? <div style={{ marginTop: 4, fontSize: 12 }}>{ev.detail}</div> : null}
                </div>
              ))}
              {!row.events?.length ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có lịch sử xử lý.</div> : null}
            </div>
          </div>

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
                    <div style={{ fontWeight: 700 }}>{mediaViewer.items[mediaViewer.index]?.caption || 'Xem media lỗi hiện trường'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{mediaViewer.index + 1}/{mediaViewer.items.length}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn-ghost" type="button" onClick={() => moveMediaViewer(-1)}>Trước</button>
                    <button className="btn-ghost" type="button" onClick={() => moveMediaViewer(1)}>Sau</button>
                    <button className="btn-primary" type="button" onClick={() => setMediaViewer(null)}>Đóng</button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, overflow: 'auto' }}>
                  {(() => {
                    const active = mediaViewer.items[mediaViewer.index]
                    const isVideo = (active?.file_type || '').toLowerCase() === 'video'
                    if (!active) return null
                    return isVideo ? (
                      <video src={active.file_url} controls autoPlay style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 180px)', borderRadius: 8, background: '#000' }} />
                    ) : (
                      <img src={active.file_url} alt={active.caption || 'issue media'} style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 180px)', objectFit: 'contain', borderRadius: 8 }} />
                    )
                  })()}
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
