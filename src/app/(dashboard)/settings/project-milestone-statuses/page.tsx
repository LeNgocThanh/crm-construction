'use client'

import { useEffect, useState } from 'react'

type Row = {
  id: string
  status_key: string
  status_name: string
  sort_order: number
  is_active: boolean
}

export default function ProjectMilestoneStatusesPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState({
    status_key: '',
    status_name: '',
    sort_order: '0',
  })

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function load() {
    setLoading(true)
    const res = await fetch('/api/settings/project-milestone-statuses?active_only=false')
    const j = await res.json().catch(() => ({}))
    setRows(Array.isArray(j?.data) ? j.data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startEdit(r: Row) {
    setEditingId(r.id)
    setForm({
      status_key: r.status_key,
      status_name: r.status_name,
      sort_order: String(r.sort_order || 0),
    })
  }

  function resetForm() {
    setEditingId('')
    setForm({ status_key: '', status_name: '', sort_order: '0' })
  }

  async function submitForm() {
    if (!form.status_key.trim() || !form.status_name.trim()) return showToast('Thiếu mã hoặc tên trạng thái')
    const isEdit = !!editingId
    const res = await fetch(
      isEdit
        ? `/api/settings/project-milestone-statuses/${editingId}`
        : '/api/settings/project-milestone-statuses',
      {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEdit ? {} : { status_key: form.status_key.trim() }),
          status_name: form.status_name.trim(),
          sort_order: Number(form.sort_order || 0),
        }),
      }
    )
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || (isEdit ? 'Không cập nhật được' : 'Không tạo được'))
    resetForm()
    await load()
    showToast(isEdit ? 'Đã cập nhật trạng thái' : 'Đã tạo trạng thái')
  }

  async function toggleActive(r: Row) {
    const res = await fetch(`/api/settings/project-milestone-statuses/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !r.is_active }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không cập nhật được')
    await load()
    showToast(r.is_active ? 'Đã tắt' : 'Đã bật')
  }

  async function softDelete(r: Row) {
    if (!confirm('Tắt trạng thái này?')) return
    const res = await fetch(`/api/settings/project-milestone-statuses/${r.id}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không xóa được')
    await load()
    showToast('Đã tắt trạng thái')
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text4)', letterSpacing: 2, marginBottom: 4 }}>SETTINGS</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Trạng thái mốc dự án</h1>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
          Danh mục trạng thái được dùng trong phần milestone của dự án (`investor view`).
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr .6fr auto', gap: 8, marginBottom: 6 }}>
          <label style={{ fontSize: 11, color: 'var(--text3)' }}>Mã trạng thái</label>
          <label style={{ fontSize: 11, color: 'var(--text3)' }}>Tên hiển thị</label>
          <label style={{ fontSize: 11, color: 'var(--text3)' }}>Thứ tự</label>
          <div />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr .6fr auto', gap: 8 }}>
          <input
            className="input"
            placeholder="status_key (vd: pending)"
            value={form.status_key}
            disabled={!!editingId}
            onChange={(e) => setForm((p) => ({ ...p, status_key: e.target.value }))}
          />
          <input className="input" placeholder="Tên hiển thị" value={form.status_name} onChange={(e) => setForm((p) => ({ ...p, status_name: e.target.value }))} />
          <input className="input" type="number" placeholder="Thứ tự" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={submitForm}>{editingId ? 'Cập nhật' : '+ Tạo'}</button>
            {editingId ? <button className="btn-ghost" onClick={resetForm}>Hủy sửa</button> : null}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        {loading ? (
          <div style={{ padding: 14, color: 'var(--text3)' }}>Đang tải...</div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {rows.map((r) => (
              <div key={r.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1.2fr .5fr .7fr auto', gap: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--blue)', fontFamily: "'JetBrains Mono',monospace" }}>{r.status_key}</div>
                <div style={{ fontSize: 12 }}>{r.status_name}</div>
                <div style={{ fontSize: 12 }}>{r.sort_order}</div>
                <div style={{ fontSize: 11, color: r.is_active ? 'var(--green)' : 'var(--text3)' }}>{r.is_active ? 'Bật' : 'Tắt'}</div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => startEdit(r)}>Sửa</button>
                  <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => toggleActive(r)}>{r.is_active ? 'Tắt' : 'Bật'}</button>
                  <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => softDelete(r)}>Xóa</button>
                </div>
              </div>
            ))}
            {!rows.length ? <div style={{ padding: 10, color: 'var(--text3)', fontSize: 12 }}>Chưa có dữ liệu.</div> : null}
          </div>
        )}
      </div>

      {toast ? (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
