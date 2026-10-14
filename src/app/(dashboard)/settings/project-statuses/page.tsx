'use client'

import { useEffect, useState } from 'react'

type Row = {
  id: string
  status_key: string
  status_name: string
  description?: string | null
  sort_order: number
  is_terminal: boolean
  is_active: boolean
  color_hex?: string | null
}

export default function ProjectStatusesPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState({
    status_key: '',
    status_name: '',
    description: '',
    sort_order: '0',
    is_terminal: false,
    is_active: true,
    color_hex: '#64748B',
  })

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function load() {
    setLoading(true)
    const res = await fetch('/api/settings/project-statuses?active_only=false')
    const j = await res.json().catch(() => ({}))
    setRows(Array.isArray(j?.data) ? j.data : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function resetForm() {
    setEditingId('')
    setForm({
      status_key: '',
      status_name: '',
      description: '',
      sort_order: '0',
      is_terminal: false,
      is_active: true,
      color_hex: '#64748B',
    })
  }

  async function submit() {
    if (!form.status_name.trim()) return showToast('Thiếu tên trạng thái')
    if (!editingId && !form.status_key.trim()) return showToast('Thiếu mã trạng thái')

    const payload = {
      status_key: form.status_key.trim(),
      status_name: form.status_name.trim(),
      description: form.description.trim() || null,
      sort_order: Number(form.sort_order || 0),
      is_terminal: form.is_terminal,
      is_active: form.is_active,
      color_hex: form.color_hex || null,
    }

    const res = await fetch(editingId ? `/api/settings/project-statuses/${editingId}` : '/api/settings/project-statuses', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không lưu được trạng thái')
    const wasEditing = !!editingId
    resetForm()
    await load()
    showToast(wasEditing ? 'Đã cập nhật trạng thái' : 'Đã tạo trạng thái')
  }

  async function removeOne(id: string) {
    if (!confirm('Tắt trạng thái này?')) return
    const res = await fetch(`/api/settings/project-statuses/${id}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không tắt được')
    await load()
    showToast('Đã tắt trạng thái')
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>DỰ ÁN / CÀI ĐẶT</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Trạng thái dự án</h1>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr .6fr .7fr .6fr', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mã trạng thái</div>
            <input className="input" disabled={!!editingId} value={form.status_key} onChange={(e) => setForm((p) => ({ ...p, status_key: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tên trạng thái</div>
            <input className="input" value={form.status_name} onChange={(e) => setForm((p) => ({ ...p, status_name: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Thứ tự</div>
            <input className="input" type="number" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Màu</div>
            <input className="input" type="color" value={form.color_hex || '#64748B'} onChange={(e) => setForm((p) => ({ ...p, color_hex: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <label style={{ fontSize: 12 }}><input type="checkbox" checked={form.is_terminal} onChange={(e) => setForm((p) => ({ ...p, is_terminal: e.target.checked }))} /> Kết thúc</label>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
          <textarea className="textarea" rows={2} placeholder="Mô tả (không bắt buộc)" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <button className="btn-primary" onClick={submit}>{editingId ? 'Lưu sửa' : '+ Tạo trạng thái'}</button>
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
                <div style={{ fontWeight: 700 }}>{r.status_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.status_key} | thứ tự: {r.sort_order} | {r.is_terminal ? 'Kết thúc' : 'Không kết thúc'} | {r.is_active ? 'On' : 'Off'}</div>
                {r.description ? <div style={{ fontSize: 12 }}>{r.description}</div> : null}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => {
                  setEditingId(r.id)
                  setForm({
                    status_key: r.status_key || '',
                    status_name: r.status_name || '',
                    description: r.description || '',
                    sort_order: String(r.sort_order || 0),
                    is_terminal: !!r.is_terminal,
                    is_active: !!r.is_active,
                    color_hex: r.color_hex || '#64748B',
                  })
                }}>Sửa</button>
                <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => removeOne(r.id)}>Tắt</button>
              </div>
            </div>
          ))}
          {!rows.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Chưa có trạng thái.</div> : null}
        </div>
      </div>

      {toast ? <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>{toast}</div> : null}
    </div>
  )
}
