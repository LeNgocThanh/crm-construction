'use client'

import { useEffect, useMemo, useState } from 'react'

type TemplateItem = {
  id: string
  milestone_definition_id?: string | null
  milestone_definition?: { id: string; definition_key: string; definition_name: string } | null
  milestone_name: string
  status_key: string
  due_offset_days?: number | null
  sort_order: number
  note?: string | null
  is_active: boolean
}

type Template = {
  id: string
  template_code: string
  template_name: string
  description?: string | null
  house_type?: string | null
  sort_order: number
  is_active: boolean
  items: TemplateItem[]
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ thực hiện' },
  { value: 'in_progress', label: 'Đang thực hiện' },
  { value: 'completed', label: 'Đã hoàn thành' },
  { value: 'blocked', label: 'Bị chặn' },
  { value: 'cancelled', label: 'Đã hủy' },
]

const LABEL = { fontSize: 11, color: 'var(--text3)', marginBottom: 4 } as const

export default function ProjectMilestoneTemplatesPage() {
  const [rows, setRows] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [editingId, setEditingId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [definitionOptions, setDefinitionOptions] = useState<Array<{ id: string; definition_name: string; default_status_key?: string | null }>>([])

  const [form, setForm] = useState({
    template_name: '',
    house_type: '',
    sort_order: '0',
    description: '',
  })

  const [itemForm, setItemForm] = useState({
    milestone_definition_id: '',
    milestone_name: '',
    status_key: 'pending',
    due_offset_days: '',
    sort_order: '0',
    note: '',
  })

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function load() {
    setLoading(true)
    const [res, dRes] = await Promise.all([
      fetch('/api/settings/project-milestone-templates'),
      fetch('/api/settings/project-milestone-definitions?active_only=true'),
    ])
    const j = await res.json().catch(() => ({}))
    const dJson = await dRes.json().catch(() => ({}))
    const data = Array.isArray(j?.data) ? j.data : []
    const defs = Array.isArray(dJson?.data) ? dJson.data : []
    setRows(data)
    setDefinitionOptions(defs.map((x: any) => ({ id: String(x.id), definition_name: String(x.definition_name || ''), default_status_key: x.default_status_key ? String(x.default_status_key) : null })))
    if (!selectedId && data[0]?.id) setSelectedId(data[0].id)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const selected = useMemo(() => rows.find((x) => x.id === selectedId) || null, [rows, selectedId])

  function resetForm() {
    setEditingId('')
    setForm({ template_name: '', house_type: '', sort_order: '0', description: '' })
  }

  async function submitTemplate() {
    if (!form.template_name.trim()) return showToast('Thiếu tên mẫu tiến độ')
    const isEdit = !!editingId
    if (isEdit) {
      const res = await fetch(`/api/settings/project-milestone-templates/${editingId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_name: form.template_name.trim(),
          house_type: form.house_type.trim() || null,
          sort_order: Number(form.sort_order || 0),
          description: form.description.trim() || null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) return showToast(j?.error || 'Không cập nhật được mẫu')
      await load()
      resetForm()
      return showToast('Đã cập nhật mẫu tiến độ')
    }

    const code = `tpl_${form.template_name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')}_${Date.now()}`

    const res = await fetch('/api/settings/project-milestone-templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_code: code,
        template_name: form.template_name.trim(),
        house_type: form.house_type.trim() || null,
        sort_order: Number(form.sort_order || 0),
        description: form.description.trim() || null,
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không tạo được mẫu')
    await load()
    setSelectedId(j?.data?.id || '')
    resetForm()
    showToast('Đã tạo mẫu tiến độ')
  }

  async function removeTemplate(id: string) {
    if (!confirm('Xóa mẫu tiến độ này?')) return
    const res = await fetch(`/api/settings/project-milestone-templates/${id}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không xóa được mẫu')
    if (selectedId === id) setSelectedId('')
    await load()
    showToast('Đã xóa mẫu tiến độ')
  }

  async function submitItem() {
    if (!selected?.id) return showToast('Chưa chọn mẫu tiến độ')
    if (!itemForm.milestone_definition_id) return showToast('Thiếu mốc gốc')
    if (!itemForm.milestone_name.trim()) return showToast('Thiếu tên mốc')
    const res = await fetch(`/api/settings/project-milestone-templates/${selected.id}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        milestone_definition_id: itemForm.milestone_definition_id,
        milestone_name: itemForm.milestone_name.trim(),
        status_key: itemForm.status_key,
        due_offset_days: itemForm.due_offset_days.trim() ? Number(itemForm.due_offset_days) : null,
        sort_order: Number(itemForm.sort_order || 0),
        note: itemForm.note.trim() || null,
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không thêm được mốc vào mẫu')
    setItemForm({ milestone_definition_id: '', milestone_name: '', status_key: 'pending', due_offset_days: '', sort_order: '0', note: '' })
    await load()
    showToast('Đã thêm mốc vào mẫu')
  }

  async function removeItem(itemId: string) {
    if (!confirm('Xóa mốc này khỏi mẫu?')) return
    const res = await fetch(`/api/settings/project-milestone-template-items/${itemId}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không xóa được mốc')
    await load()
    showToast('Đã xóa mốc')
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>DỰ ÁN / CÀI ĐẶT</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Mẫu tiến độ dự án</h1>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .8fr .5fr', gap: 8, marginBottom: 6 }}>
          <div><div style={LABEL}>Tên mẫu</div><input className="input" value={form.template_name} onChange={(e) => setForm((p) => ({ ...p, template_name: e.target.value }))} /></div>
          <div><div style={LABEL}>Loại nhà áp dụng (không bắt buộc)</div><input className="input" value={form.house_type} onChange={(e) => setForm((p) => ({ ...p, house_type: e.target.value }))} /></div>
          <div><div style={LABEL}>Thứ tự</div><input className="input" type="number" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
          <textarea className="textarea" rows={2} placeholder="Mô tả mẫu tiến độ" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <button className="btn-primary" onClick={submitTemplate}>{editingId ? 'Lưu sửa' : '+ Tạo mẫu'}</button>
            {editingId ? <button className="btn-ghost" onClick={resetForm}>Hủy</button> : null}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Danh sách mẫu</div>
          {loading ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Đang tải...</div> : null}
          <div style={{ maxHeight: 520, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            {rows.map((r) => (
              <div key={r.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', background: selectedId === r.id ? 'rgba(59,130,246,.08)' : 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{r.template_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.template_code} | {r.items?.length || 0} mốc</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setSelectedId(r.id)}>Chọn</button>
                    <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => { setEditingId(r.id); setForm({ template_name: r.template_name || '', house_type: r.house_type || '', sort_order: String(r.sort_order || 0), description: r.description || '' }) }}>Sửa</button>
                    <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => removeTemplate(r.id)}>Xóa</button>
                  </div>
                </div>
              </div>
            ))}
            {!rows.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Chưa có mẫu tiến độ.</div> : null}
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Mốc trong mẫu: {selected?.template_name || '(chưa chọn)'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr .8fr .6fr .5fr auto', gap: 6, marginBottom: 8 }}>
            <div>
              <div style={LABEL}>Mốc gốc</div>
              <select className="select" value={itemForm.milestone_definition_id} onChange={(e) => {
                const defId = e.target.value
                const d = definitionOptions.find((x) => x.id === defId)
                setItemForm((p) => ({
                  ...p,
                  milestone_definition_id: defId,
                  milestone_name: d?.definition_name || p.milestone_name,
                  status_key: d?.default_status_key || p.status_key,
                }))
              }}>
                <option value="">(Chọn mốc gốc)</option>
                {definitionOptions.map((d) => <option key={d.id} value={d.id}>{d.definition_name}</option>)}
              </select>
            </div>
            <div><div style={LABEL}>Tên mốc</div><input className="input" value={itemForm.milestone_name} onChange={(e) => setItemForm((p) => ({ ...p, milestone_name: e.target.value }))} /></div>
            <div><div style={LABEL}>Trạng thái mặc định</div><select className="select" value={itemForm.status_key} onChange={(e) => setItemForm((p) => ({ ...p, status_key: e.target.value }))}>{STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
            <div><div style={LABEL}>Thời hạn hoàn thành mặc định (ngày)</div><input className="input" type="number" value={itemForm.due_offset_days} onChange={(e) => setItemForm((p) => ({ ...p, due_offset_days: e.target.value }))} /></div>
            <div><div style={LABEL}>Thứ tự</div><input className="input" type="number" value={itemForm.sort_order} onChange={(e) => setItemForm((p) => ({ ...p, sort_order: e.target.value }))} /></div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}><button className="btn-primary" onClick={submitItem}>+ Thêm mốc</button></div>
          </div>
          <textarea className="textarea" rows={2} placeholder="Ghi chú mốc (không bắt buộc)" value={itemForm.note} onChange={(e) => setItemForm((p) => ({ ...p, note: e.target.value }))} style={{ marginBottom: 8 }} />

          <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            {(selected?.items || []).map((it) => (
              <div key={it.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{it.milestone_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>mốc gốc: {it?.milestone_definition?.definition_name || '-'} | status: {it.status_key} | sort: {it.sort_order} | hạn mặc định: {it.due_offset_days ?? '-'} ngày</div>
                  {it.note ? <div style={{ fontSize: 12 }}>{it.note}</div> : null}
                </div>
                <div><button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => removeItem(it.id)}>Xóa</button></div>
              </div>
            ))}
            {!selected?.items?.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Mẫu chưa có mốc.</div> : null}
          </div>
        </div>
      </div>

      {toast ? <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>{toast}</div> : null}
    </div>
  )
}
