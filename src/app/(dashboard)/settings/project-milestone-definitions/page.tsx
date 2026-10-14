'use client'

import { useEffect, useState } from 'react'

type Row = {
  id: string
  definition_key: string
  definition_name: string
  description?: string | null
  default_status_key: string
  sort_order: number
  is_active: boolean
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ thực hiện' },
  { value: 'in_progress', label: 'Đang thực hiện' },
  { value: 'completed', label: 'Đã hoàn thành' },
  { value: 'blocked', label: 'Bị chặn' },
  { value: 'cancelled', label: 'Đã hủy' },
]

export default function ProjectMilestoneDefinitionsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState({
    definition_key: '',
    definition_name: '',
    default_status_key: 'pending',
    sort_order: '0',
    description: '',
  })

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function load() {
    setLoading(true)
    const res = await fetch('/api/settings/project-milestone-definitions?active_only=false')
    const j = await res.json().catch(() => ({}))
    setRows(Array.isArray(j?.data) ? j.data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setEditingId('')
    setForm({ definition_key: '', definition_name: '', default_status_key: 'pending', sort_order: '0', description: '' })
  }

  async function submit() {
    if (!form.definition_name.trim()) return showToast('Thiếu tên mốc gốc')
    if (!editingId && !form.definition_key.trim()) return showToast('Thiếu mã mốc gốc')
    const res = await fetch(editingId ? `/api/settings/project-milestone-definitions/${editingId}` : '/api/settings/project-milestone-definitions', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        definition_key: form.definition_key.trim(),
        definition_name: form.definition_name.trim(),
        default_status_key: form.default_status_key,
        sort_order: Number(form.sort_order || 0),
        description: form.description.trim() || null,
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không lưu được mốc gốc')
    resetForm()
    await load()
    showToast(editingId ? 'Đã cập nhật mốc gốc' : 'Đã tạo mốc gốc')
  }

  async function removeOne(id: string) {
    if (!confirm('Xóa mốc gốc này?')) return
    const res = await fetch(`/api/settings/project-milestone-definitions/${id}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không xóa được')
    await load()
    showToast('Đã xóa mốc gốc')
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>DỰ ÁN / CÀI ĐẶT</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Mốc gốc dự án</h1>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr .9fr .6fr', gap: 8, marginBottom: 6 }}>
          <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mã mốc gốc</div><input className="input" disabled={!!editingId} value={form.definition_key} onChange={(e) => setForm((p) => ({ ...p, definition_key: e.target.value }))} /></div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tên mốc gốc</div><input className="input" value={form.definition_name} onChange={(e) => setForm((p) => ({ ...p, definition_name: e.target.value }))} /></div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Trạng thái mặc định</div><select className="select" value={form.default_status_key} onChange={(e) => setForm((p) => ({ ...p, default_status_key: e.target.value }))}>{STATUS_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Thứ tự</div><input className="input" type="number" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
          <textarea className="textarea" rows={2} placeholder="Mô tả mốc gốc" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <button className="btn-primary" onClick={submit}>{editingId ? 'Lưu sửa' : '+ Tạo mốc gốc'}</button>
            {editingId ? <button className="btn-ghost" onClick={resetForm}>Hủy</button> : null}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        {loading ? <div style={{ color: 'var(--text3)', fontSize: 12 }}>Đang tải...</div> : null}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 520, overflowY: 'auto' }}>
          {rows.map((r) => (
            <div key={r.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{r.definition_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.definition_key} | trạng thái mặc định: {r.default_status_key} | thứ tự: {r.sort_order} | {r.is_active ? 'On' : 'Off'}</div>
                {r.description ? <div style={{ fontSize: 12 }}>{r.description}</div> : null}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => { setEditingId(r.id); setForm({ definition_key: r.definition_key || '', definition_name: r.definition_name || '', default_status_key: r.default_status_key || 'pending', sort_order: String(r.sort_order || 0), description: r.description || '' }) }}>Sửa</button>
                <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => removeOne(r.id)}>Xóa</button>
              </div>
            </div>
          ))}
          {!rows.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Chưa có mốc gốc.</div> : null}
        </div>
      </div>

      {toast ? <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>{toast}</div> : null}
    </div>
  )
}

