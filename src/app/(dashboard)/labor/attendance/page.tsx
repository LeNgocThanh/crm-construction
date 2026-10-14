'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Project = { id: string; project_name: string; status?: string | null }
type Worker = { id: string; worker_code: string; full_name: string }
type Roster = {
  id: string
  is_primary: boolean
  worker?: { id: string; worker_code: string; full_name: string } | null
  crew?: { id: string; crew_key: string; crew_name: string } | null
  trade?: { id: string; trade_key: string; trade_name: string } | null
}
type Engagement = {
  id: string
  engagement_type: string
  status: string
  project?: { id: string; project_name: string } | null
  worker?: { id: string; worker_code: string; full_name: string } | null
  crew?: { id: string; crew_key: string; crew_name: string } | null
}
type Attendance = {
  id: string
  attendance_date?: string | null
  shift_type?: string | null
  source_type?: string | null
  attendance_status?: string | null
  work_qty?: number | null
  amount?: string | null
  note?: string | null
  project?: { id: string; project_name: string } | null
  worker?: { id: string; worker_code: string; full_name: string } | null
  diary_entry?: { id: string; title: string; entry_date?: string | null; shift_type?: string | null } | null
  engagement?: { id: string; engagement_type: string; status: string } | null
  creator?: { id: string; username: string | null } | null
  confirmer?: { id: string; username: string | null } | null
  payment_locked?: boolean
  payment_lock_reason?: string | null
  payment_lock_batch?: { id: string; batch_code?: string | null; batch_name?: string | null; status?: string | null; paid_amount?: string | null } | null
}

const EMPTY_FORM = {
  project_id: '',
  engagement_id: '',
  worker_id: '',
  attendance_date: '',
  shift_type: 'full_day',
  work_qty: '',
  amount: '',
  note: '',
}

function formatMoney(v?: string | number | null) {
  if (v == null || v === '') return '-'
  const n = typeof v === 'string' ? Number(v) : v
  if (!Number.isFinite(n)) return '-'
  return `${Number(n).toLocaleString('vi-VN')} vnd`
}

function dateInputValue(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function displayDate(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('vi-VN')
}

function shiftLabel(value?: string | null) {
  switch (value) {
    case 'morning': return 'Buổi sáng'
    case 'afternoon': return 'Buổi chiều'
    case 'night': return 'Ban đêm'
    case 'full_day': return 'Cả ngày'
    default: return value || '-'
  }
}

function translateEngagementType(value?: string | null) {
  switch (value) {
    case 'daily': return 'Công ngày'
    case 'piecework': return 'Khoán sản lượng'
    case 'contract': return 'Khoán hợp đồng'
    default: return value || '-'
  }
}

function attendanceStatusLabel(value?: string | null) {
  return value === 'draft' ? 'Nháp từ nhật ký' : 'Đã xác nhận'
}

function sourceTypeLabel(value?: string | null) {
  return value === 'diary' ? 'Nhật ký' : 'Nhập tay'
}

export default function LaborAttendancePage() {
  const searchParams = useSearchParams()
  const initialProjectId = useMemo(() => String(searchParams.get('project_id') || ''), [searchParams])

  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [roster, setRoster] = useState<Roster[]>([])
  const [engagements, setEngagements] = useState<Engagement[]>([])
  const [rows, setRows] = useState<Attendance[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  async function loadMeta() {
    const [pRes, wRes, eRes] = await Promise.all([
      fetch('/api/projects?limit=200'),
      fetch('/api/labor/workers'),
      fetch('/api/labor/engagements?active_only=true'),
    ])
    const [pJson, wJson, eJson] = await Promise.all([
      pRes.json().catch(() => ({})),
      wRes.json().catch(() => ({})),
      eRes.json().catch(() => ({})),
    ])
    setProjects(Array.isArray(pJson?.data) ? pJson.data : [])
    setWorkers(Array.isArray(wJson?.data) ? wJson.data : [])
    setEngagements(Array.isArray(eJson?.data) ? eJson.data : [])
  }

  async function loadRoster(projectId = selectedProjectId) {
    if (!projectId) {
      setRoster([])
      return
    }
    const res = await fetch(`/api/projects/${projectId}/labor-roster`)
    const json = await res.json().catch(() => ({}))
    setRoster(Array.isArray(json?.data) ? json.data : [])
  }

  async function loadRows(projectId = selectedProjectId) {
    setLoading(true)
    try {
      const url = projectId ? `/api/labor/attendances?project_id=${encodeURIComponent(projectId)}` : '/api/labor/attendances'
      const res = await fetch(url)
      const json = await res.json().catch(() => ({}))
      setRows(Array.isArray(json?.data) ? json.data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMeta()
  }, [])

  useEffect(() => {
    if (!initialProjectId) return
    setSelectedProjectId(initialProjectId)
    setForm((p) => ({ ...p, project_id: initialProjectId }))
  }, [initialProjectId])

  useEffect(() => {
    void loadRows(selectedProjectId)
    void loadRoster(selectedProjectId)
  }, [selectedProjectId])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  function applyWorker(workerId: string) {
    setForm((p) => ({ ...p, worker_id: workerId }))
  }

  function applyEngagement(engagementId: string) {
    const engagement = engagements.find((x) => x.id === engagementId)
    setForm((p) => ({
      ...p,
      engagement_id: engagementId,
      worker_id: engagement?.worker?.id || p.worker_id,
      project_id: engagement?.project?.id || p.project_id,
    }))
    if (engagement?.project?.id) setSelectedProjectId(engagement.project.id)
  }

  async function submit() {
    if (!form.project_id || !form.attendance_date) {
      setToast('Thiếu dự án hoặc ngày chấm công')
      return
    }
    const payload = {
      project_id: form.project_id,
      engagement_id: form.engagement_id || null,
      worker_id: form.worker_id || null,
      attendance_date: form.attendance_date,
      shift_type: form.shift_type,
      work_qty: form.work_qty.trim() || null,
      amount: form.amount.trim() || null,
      note: form.note.trim() || null,
    }
    const url = editingId ? `/api/labor/attendances/${editingId}` : '/api/labor/attendances'
    const method = editingId ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json?.error || 'Không lưu được chấm công')
      return
    }
    setToast(editingId ? 'Đã cập nhật chấm công' : 'Đã tạo chấm công')
    setEditingId('')
    setForm({ ...EMPTY_FORM, project_id: selectedProjectId })
    await loadRows(selectedProjectId)
  }

  async function confirmDraft(row: Attendance) {
    const res = await fetch(`/api/labor/attendances/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendance_status: 'confirmed' }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json?.error || 'Không xác nhận được chấm công')
      return
    }
    setToast('Đã xác nhận chấm công')
    await loadRows(selectedProjectId)
  }

  const activeRows = rows.filter((x) => (selectedProjectId ? x.project?.id === selectedProjectId : true))
  const draftRows = activeRows.filter((x) => x.attendance_status === 'draft')
  const confirmedRows = activeRows.filter((x) => x.attendance_status !== 'draft')
  const editingRow = useMemo(() => rows.find((x) => x.id === editingId) || null, [rows, editingId])
  const editingLocked = !!editingRow?.payment_locked

  if (loading) return <div style={{ padding: 16 }}>Đang tải dữ liệu...</div>

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)' }}>NHÂN CÔNG</div>
          <h1 style={{ margin: '4px 0 4px', fontSize: 22, fontWeight: 800 }}>Chấm công</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Quản lý hai luồng: nhập từ nhật ký và chấm công đã xác nhận.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link className="btn-ghost" href="/labor">Danh mục nhân công</Link>
          <Link className="btn-ghost" href="/labor/assignments">Phân công khoán việc</Link>
          <Link className="btn-ghost" href="/labor/payments">Thanh toán công</Link>
          <Link className="btn-ghost" href="/labor/reports">Báo cáo chấm công</Link>
          <Link className="btn-ghost" href="/projects">Dự án</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Tổng bản ghi</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{activeRows.length}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Nhập từ nhật ký</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{draftRows.length}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Đã xác nhận</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{confirmedRows.length}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Tổng tiền đã xác nhận</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(confirmedRows.reduce((sum, x) => sum + Number(x.amount || 0), 0))}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Dự án</div>
            <select
              className="select"
              value={selectedProjectId}
              onChange={(e) => {
                const next = e.target.value
                setSelectedProjectId(next)
                setForm((p) => ({ ...p, project_id: next }))
              }}
            >
              <option value="">(Tất cả dự án)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.project_name}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Phiếu phân công</div>
            <select className="select" value={form.engagement_id} onChange={(e) => applyEngagement(e.target.value)}>
              <option value="">(Không chọn)</option>
              {engagements.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.project?.project_name || '-'} | {e.worker?.full_name || e.crew?.crew_name || '-'} | {translateEngagementType(e.engagement_type)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Nhân công</div>
            <select className="select" value={form.worker_id} onChange={(e) => applyWorker(e.target.value)}>
              <option value="">(Chọn nhân công)</option>
              {roster.length ? <option value="__roster_sep__" disabled>--- Danh sách mặc định của dự án ---</option> : null}
              {roster.map((r) => r.worker ? (
                <option key={`roster_${r.id}`} value={r.worker.id}>
                  {r.worker.full_name} ({r.worker.worker_code}){r.is_primary ? ' - Chính' : ''}
                </option>
              ) : null)}
              {roster.length ? <option value="__all_sep__" disabled>--- Nhân công toàn bộ ---</option> : null}
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.full_name} ({w.worker_code})</option>
              ))}
            </select>
          </div>
          <button className="btn-ghost" onClick={() => { setEditingId(''); setForm({ ...EMPTY_FORM, project_id: selectedProjectId }) }}>Mới</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ngày chấm công</div>
            <input className="input" type="date" value={form.attendance_date} onChange={(e) => setForm((p) => ({ ...p, attendance_date: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ca làm</div>
            <select className="select" value={form.shift_type} onChange={(e) => setForm((p) => ({ ...p, shift_type: e.target.value }))}>
              <option value="full_day">Cả ngày</option>
              <option value="morning">Buổi sáng</option>
              <option value="afternoon">Buổi chiều</option>
              <option value="night">Ban đêm</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Số công</div>
            <input className="input" value={form.work_qty} placeholder="Ví dụ: 1, 0.5" onChange={(e) => setForm((p) => ({ ...p, work_qty: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Số tiền</div>
            <input className="input" value={form.amount} placeholder="Không bắt buộc" onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ghi chú</div>
            <input className="input" value={form.note} placeholder="Không bắt buộc" onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
          </div>
          {!editingLocked ? <button className="btn-primary" onClick={submit}>{editingId ? 'Lưu sửa' : '+ Tạo'}</button> : <div />}
        </div>
        {editingLocked ? (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--orange)' }}>
            Chấm công này đã dính thanh toán. Muốn sửa, hãy xử lý lại ở đợt thanh toán trước.
          </div>
        ) : null}
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Danh sách nhập từ nhật ký</div>
        <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {draftRows.map((r) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>
                  {displayDate(r.attendance_date)} | {r.project?.project_name || '-'} | {r.worker?.full_name || '-'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  Trạng thái: {attendanceStatusLabel(r.attendance_status)} | Nguồn: {sourceTypeLabel(r.source_type)} | Ca: {shiftLabel(r.shift_type)} | Công: {r.work_qty ?? '-'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  Nhật ký: {r.diary_entry?.title || '-'}
                </div>
                {r.note ? <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>Ghi chú: {r.note}</div> : null}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11 }}
                  onClick={() => {
                    setEditingId(r.id)
                    setForm({
                      project_id: r.project?.id || selectedProjectId,
                      engagement_id: r.engagement?.id || '',
                      worker_id: r.worker?.id || '',
                      attendance_date: dateInputValue(r.attendance_date),
                      shift_type: r.shift_type || 'full_day',
                      work_qty: r.work_qty != null ? String(r.work_qty) : '',
                      amount: r.amount || '',
                      note: r.note || '',
                    })
                    if (r.project?.id) setSelectedProjectId(r.project.id)
                  }}
                >
                  Sửa
                </button>
                <button className="btn-primary" style={{ fontSize: 11 }} onClick={() => confirmDraft(r)}>
                  Xác nhận
                </button>
              </div>
            </div>
          ))}
          {!draftRows.length ? <div style={{ padding: 10, color: 'var(--text3)' }}>Chưa có dòng chấm công nào sinh từ nhật ký.</div> : null}
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Danh sách chấm công đã xác nhận</div>
        <div style={{ maxHeight: 540, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {confirmedRows.map((r) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>
                  {displayDate(r.attendance_date)} | {r.project?.project_name || '-'} | {r.worker?.full_name || '-'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  Trạng thái: {attendanceStatusLabel(r.attendance_status)} | Nguồn: {sourceTypeLabel(r.source_type)} | Ca: {shiftLabel(r.shift_type)} | Công: {r.work_qty ?? '-'} | Tiền: {formatMoney(r.amount)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  Phiếu phân công: {r.engagement?.engagement_type ? translateEngagementType(r.engagement.engagement_type) : '-'} | Nhật ký: {r.diary_entry?.title || '-'}
                </div>
                {r.payment_locked ? <div style={{ fontSize: 12, color: 'var(--orange)', marginTop: 4 }}>Khóa thanh toán: {r.payment_lock_reason || 'Đã phát sinh thanh toán'}</div> : null}
                {r.note ? <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>Ghi chú: {r.note}</div> : null}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {!r.payment_locked ? (
                  <>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 11 }}
                      onClick={() => {
                        setEditingId(r.id)
                        setForm({
                          project_id: r.project?.id || selectedProjectId,
                          engagement_id: r.engagement?.id || '',
                          worker_id: r.worker?.id || '',
                          attendance_date: dateInputValue(r.attendance_date),
                          shift_type: r.shift_type || 'full_day',
                          work_qty: r.work_qty != null ? String(r.work_qty) : '',
                          amount: r.amount || '',
                          note: r.note || '',
                        })
                        if (r.project?.id) setSelectedProjectId(r.project.id)
                      }}
                    >
                      Sửa
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 11, color: 'var(--red)' }}
                      onClick={async () => {
                        if (!confirm('Xóa chấm công này?')) return
                        const res = await fetch(`/api/labor/attendances/${r.id}`, { method: 'DELETE' })
                        const json = await res.json().catch(() => ({}))
                        if (!res.ok) {
                          setToast(json?.error || 'Không xóa được chấm công')
                          return
                        }
                        await loadRows(selectedProjectId)
                      }}
                    >
                      Xóa
                    </button>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>Đã khóa</div>
                )}
              </div>
            </div>
          ))}
          {!confirmedRows.length ? <div style={{ padding: 10, color: 'var(--text3)' }}>Chưa có chấm công đã xác nhận.</div> : null}
        </div>
      </div>

      {toast ? (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
