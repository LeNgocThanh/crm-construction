'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type Project = {
  id: string
  project_name?: string | null
  status?: string | null
}

type Worker = {
  id: string
  worker_code: string
  full_name: string
  phone?: string | null
  trade?: { id: string; trade_key: string; trade_name: string } | null
  crew?: { id: string; crew_key: string; crew_name: string } | null
}

type Trade = { id: string; trade_key: string; trade_name: string; unit_text?: string | null }
type Crew = { id: string; crew_key: string; crew_name: string }

type Roster = {
  id: string
  is_primary: boolean
  is_active: boolean
  sort_order: number
  note?: string | null
  worker?: { id: string; worker_code: string; full_name: string; phone?: string | null } | null
  crew?: { id: string; crew_key: string; crew_name: string } | null
  trade?: { id: string; trade_key: string; trade_name: string; unit_text?: string | null } | null
}

type RosterForm = {
  crew_id: string
  trade_id: string
  is_primary: boolean
  is_active: boolean
  sort_order: string
  note: string
}

const EMPTY_FORM: RosterForm = {
  crew_id: '',
  trade_id: '',
  is_primary: false,
  is_active: true,
  sort_order: '0',
  note: '',
}

function rosterLabel(r: Roster) {
  return r.worker?.full_name || r.crew?.crew_name || r.trade?.trade_name || '-'
}

export default function ProjectLaborPage() {
  const params = useParams<{ id: string }>()
  const id = String(params?.id || '')

  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [project, setProject] = useState<Project | null>(null)
  const [roster, setRoster] = useState<Roster[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([])
  const [showAllWorkers, setShowAllWorkers] = useState(false)
  const [batchForm, setBatchForm] = useState<RosterForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState('')
  const [editForm, setEditForm] = useState<RosterForm>(EMPTY_FORM)

  const rosterWorkerIds = useMemo(() => new Set(roster.map((x) => x.worker?.id).filter(Boolean)), [roster])
  const availableWorkers = useMemo(
    () => workers.filter((w) => !rosterWorkerIds.has(w.id)),
    [workers, rosterWorkerIds],
  )
  const allSelected = useMemo(
    () => availableWorkers.length > 0 && selectedWorkerIds.length === availableWorkers.length,
    [availableWorkers.length, selectedWorkerIds.length],
  )

  async function loadAll() {
    if (!id) return
    setLoading(true)
    try {
      const [pRes, rRes, wRes, tRes, cRes] = await Promise.all([
        fetch(`/api/projects/${id}/investor-view`, { cache: 'no-store' }),
        fetch(`/api/projects/${id}/labor-roster`, { cache: 'no-store' }),
        fetch(`/api/labor/workers?active_only=true${showAllWorkers ? '' : '&exclude_rostered=true'}`, { cache: 'no-store' }),
        fetch('/api/labor/trades?active_only=true', { cache: 'no-store' }),
        fetch('/api/labor/crews', { cache: 'no-store' }),
      ])
      const [pJson, rJson, wJson, tJson, cJson] = await Promise.all([
        pRes.json().catch(() => ({})),
        rRes.json().catch(() => ({})),
        wRes.json().catch(() => ({})),
        tRes.json().catch(() => ({})),
        cRes.json().catch(() => ({})),
      ])
      setProject((pJson?.data?.project || pJson?.data?.overview || pJson?.data || null) as Project | null)
      setRoster(Array.isArray(rJson?.data) ? rJson.data : [])
      setWorkers(Array.isArray(wJson?.data) ? wJson.data : [])
      setTrades(Array.isArray(tJson?.data) ? tJson.data : [])
      setCrews(Array.isArray(cJson?.data) ? cJson.data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [id, showAllWorkers])

  useEffect(() => {
    setSelectedWorkerIds((prev) => prev.filter((x) => availableWorkers.some((w) => w.id === x)))
  }, [availableWorkers])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  function toggleWorker(workerId: string, checked: boolean) {
    setSelectedWorkerIds((prev) => {
      if (checked) return prev.includes(workerId) ? prev : [...prev, workerId]
      return prev.filter((x) => x !== workerId)
    })
  }

  async function addSelectedWorkers() {
    if (!selectedWorkerIds.length) {
      setToast('Chọn ít nhất 1 nhân công')
      return
    }
    const payload = {
      worker_ids: selectedWorkerIds,
      crew_id: batchForm.crew_id || null,
      trade_id: batchForm.trade_id || null,
      is_primary: batchForm.is_primary,
      is_active: batchForm.is_active,
      sort_order: Number(batchForm.sort_order || 0),
      note: batchForm.note.trim() || null,
    }
    const res = await fetch(`/api/projects/${id}/labor-roster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json?.error || 'Không lưu được danh sách mặc định')
      return
    }
    setToast('Đã thêm nhân công vào danh sách mặc định')
    setSelectedWorkerIds([])
    setBatchForm(EMPTY_FORM)
    await loadAll()
  }

  async function saveEdit() {
    if (!editingId) return
    const payload = {
      crew_id: editForm.crew_id || null,
      trade_id: editForm.trade_id || null,
      is_primary: editForm.is_primary,
      is_active: editForm.is_active,
      sort_order: Number(editForm.sort_order || 0),
      note: editForm.note.trim() || null,
    }
    const res = await fetch(`/api/projects/${id}/labor-roster/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json?.error || 'Không lưu được thay đổi')
      return
    }
    setToast('Đã cập nhật danh sách mặc định')
    setEditingId('')
    setEditForm(EMPTY_FORM)
    await loadAll()
  }

  if (loading) return <div style={{ padding: 16 }}>Đang tải dữ liệu...</div>

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)' }}>DỰ ÁN / NHÂN CÔNG</div>
          <h1 style={{ margin: '4px 0 4px', fontSize: 22, fontWeight: 800 }}>{project?.project_name || 'Dự án'} - Danh sách mặc định</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
            Chọn nhân công bằng tick để đưa vào danh sách mặc định của dự án. Mặc định chỉ hiện nhân công đang trống; bật "Hiện tất cả" nếu muốn dùng một người ở nhiều dự án.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link className="btn-ghost" href={`/projects/${id}/overview`}>Tổng quan</Link>
          <Link className="btn-ghost" href="/labor">Danh mục nhân công</Link>
          <Link className="btn-ghost" href="/labor/attendance">Chấm công / thanh toán</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Nhân công mặc định</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{roster.length}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Đang bật</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{roster.filter((x) => x.is_active).length}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Đánh dấu chính</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{roster.filter((x) => x.is_primary).length}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Thêm nhân công vào danh sách mặc định</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chọn nhiều nhân công rồi bấm lưu. Người đã có trong chính dự án này sẽ không hiện lại.</div>
          </div>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setSelectedWorkerIds(allSelected ? [] : availableWorkers.map((w) => w.id))}>
            {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đội</div>
            <select className="select" value={batchForm.crew_id} onChange={(e) => setBatchForm((p) => ({ ...p, crew_id: e.target.value }))}>
              <option value="">(Không chọn đội)</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>{c.crew_name}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Nghề</div>
            <select className="select" value={batchForm.trade_id} onChange={(e) => setBatchForm((p) => ({ ...p, trade_id: e.target.value }))}>
              <option value="">(Không chọn nghề)</option>
              {trades.map((t) => (
                <option key={t.id} value={t.id}>{t.trade_name}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Thứ tự</div>
            <input className="input" type="number" value={batchForm.sort_order} onChange={(e) => setBatchForm((p) => ({ ...p, sort_order: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ghi chú</div>
            <input className="input" value={batchForm.note} onChange={(e) => setBatchForm((p) => ({ ...p, note: e.target.value }))} placeholder="Không bắt buộc" />
          </div>
          <button className="btn-primary" onClick={addSelectedWorkers}>+ Lưu vào dự án</button>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10, fontSize: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={showAllWorkers} onChange={(e) => setShowAllWorkers(e.target.checked)} />
            Hiện tất cả nhân công
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={batchForm.is_primary} onChange={(e) => setBatchForm((p) => ({ ...p, is_primary: e.target.checked }))} />
            Đánh dấu chính cho dòng đầu tiên
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={batchForm.is_active} onChange={(e) => setBatchForm((p) => ({ ...p, is_active: e.target.checked }))} />
            Đang bật
          </label>
          <div style={{ color: 'var(--text3)' }}>Đã chọn: <strong>{selectedWorkerIds.length}</strong></div>
          <div style={{ color: 'var(--text3)' }}>Đang hiện: <strong>{availableWorkers.length}</strong></div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 340, overflowY: 'auto' }}>
          {availableWorkers.map((w) => {
            const checked = selectedWorkerIds.includes(w.id)
            return (
              <label
                key={w.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: 10,
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                <input type="checkbox" checked={checked} onChange={(e) => toggleWorker(w.id, e.target.checked)} />
                <div>
                  <div style={{ fontWeight: 700 }}>{w.full_name} ({w.worker_code})</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                    Nghề: {w.trade?.trade_name || '-'} | Đội: {w.crew?.crew_name || '-'}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{w.phone || '-'}</div>
              </label>
            )
          })}
          {!availableWorkers.length ? (
            <div style={{ padding: 12, color: 'var(--text3)' }}>
              {showAllWorkers ? 'Không còn nhân công nào chưa có trong dự án này.' : 'Không còn nhân công trống để chọn. Bật "Hiện tất cả nhân công" nếu muốn dùng người đã ở dự án khác.'}
            </div>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Danh sách mặc định của dự án</div>
        <div style={{ maxHeight: 540, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {roster.map((r) => {
            const isEditing = editingId === r.id
            return (
              <div key={r.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>
                      {rosterLabel(r)}{r.is_primary ? ' - Mặc định chính' : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                      Nhân công: {r.worker?.full_name || '-'} | Đội: {r.crew?.crew_name || '-'} | Nghề: {r.trade?.trade_name || '-'} | Thứ tự: {r.sort_order}
                    </div>
                    {r.note ? <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Ghi chú: {r.note}</div> : null}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => {
                      setEditingId(r.id)
                      setEditForm({
                        crew_id: r.crew?.id || '',
                        trade_id: r.trade?.id || '',
                        is_primary: r.is_primary,
                        is_active: r.is_active,
                        sort_order: String(r.sort_order ?? 0),
                        note: r.note || '',
                      })
                    }}>Sửa</button>
                    <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={async () => {
                      if (!confirm('Xóa dòng mặc định này?')) return
                      await fetch(`/api/projects/${id}/labor-roster/${r.id}`, { method: 'DELETE' })
                      await loadAll()
                    }}>Xóa</button>
                  </div>
                </div>

                {isEditing ? (
                  <div style={{ marginTop: 10, borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, alignItems: 'end' }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đội</div>
                        <select className="select" value={editForm.crew_id} onChange={(e) => setEditForm((p) => ({ ...p, crew_id: e.target.value }))}>
                          <option value="">(Không chọn đội)</option>
                          {crews.map((c) => <option key={c.id} value={c.id}>{c.crew_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Nghề</div>
                        <select className="select" value={editForm.trade_id} onChange={(e) => setEditForm((p) => ({ ...p, trade_id: e.target.value }))}>
                          <option value="">(Không chọn nghề)</option>
                          {trades.map((t) => <option key={t.id} value={t.id}>{t.trade_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Thứ tự</div>
                        <input className="input" type="number" value={editForm.sort_order} onChange={(e) => setEditForm((p) => ({ ...p, sort_order: e.target.value }))} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ghi chú</div>
                        <input className="input" value={editForm.note} onChange={(e) => setEditForm((p) => ({ ...p, note: e.target.value }))} placeholder="Không bắt buộc" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <input type="checkbox" checked={editForm.is_primary} onChange={(e) => setEditForm((p) => ({ ...p, is_primary: e.target.checked }))} />
                        Đánh dấu chính
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))} />
                        Đang bật
                      </label>
                      <button className="btn-primary" onClick={saveEdit}>Lưu sửa</button>
                      <button className="btn-ghost" onClick={() => { setEditingId(''); setEditForm(EMPTY_FORM) }}>Hủy</button>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
          {!roster.length ? <div style={{ padding: 12, color: 'var(--text3)' }}>Chưa có nhân công mặc định nào.</div> : null}
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
