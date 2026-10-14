'use client'

import { useEffect, useState } from 'react'

type AssetType = {
  id: string
  type_key: string
  type_name: string
  description?: string | null
  default_unit_id?: string | null
  default_unit?: { id: string; unit_key: string; unit_name: string } | null
  sort_order: number
  is_active: boolean
}

type Unit = { id: string; unit_key: string; unit_name: string }

const EMPTY_FORM = {
  type_key: '',
  type_name: '',
  default_unit_id: '',
  sort_order: '0',
  description: '',
  is_active: true,
}

export default function AssetTypesPage() {
  const [rows, setRows] = useState<AssetType[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  async function load() {
    setLoading(true)
    const [tRes, uRes] = await Promise.all([
      fetch('/api/settings/asset-types'),
      fetch('/api/settings/units?active_only=true'),
    ])
    const [tJson, uJson] = await Promise.all([
      tRes.json().catch(() => ({})),
      uRes.json().catch(() => ({})),
    ])
    setRows(Array.isArray(tJson?.data) ? tJson.data : [])
    setUnits(Array.isArray(uJson?.data) ? uJson.data : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  function resetForm() {
    setEditingId('')
    setForm(EMPTY_FORM)
  }

  async function patchRow(id: string, patch: any) {
    const res = await fetch(`/api/settings/asset-types/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return setToast(j?.error || 'Cập nhật thất bại')
    setToast('Đã cập nhật')
    await load()
  }

  async function removeRow(id: string) {
    if (!confirm('Xóa loại tài sản này?')) return
    const res = await fetch(`/api/settings/asset-types/${id}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return setToast(j?.error || 'Xóa thất bại')
    setToast('Đã xóa')
    await load()
    if (editingId === id) resetForm()
  }

  function startEdit(r: AssetType) {
    setEditingId(r.id)
    setForm({
      type_key: r.type_key || '',
      type_name: r.type_name || '',
      default_unit_id: r.default_unit_id || '',
      sort_order: String(r.sort_order ?? 0),
      description: r.description || '',
      is_active: !!r.is_active,
    })
  }

  async function saveForm() {
    if (!form.type_key.trim() || !form.type_name.trim()) return setToast('Thiếu mã hoặc tên loại tài sản')
    const payload = {
      type_key: form.type_key.trim().toLowerCase(),
      type_name: form.type_name.trim(),
      default_unit_id: form.default_unit_id || null,
      sort_order: Number(form.sort_order || 0),
      description: form.description.trim() || null,
      is_active: !!form.is_active,
    }

    if (!editingId) {
      const res = await fetch('/api/settings/asset-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) return setToast(j?.error || 'Tạo thất bại')
      setToast('Đã tạo loại tài sản')
      resetForm()
      await load()
      return
    }

    if (!confirm('Bạn đang sửa thông tin loại tài sản. Xác nhận lưu thay đổi?')) return
    await patchRow(editingId, payload)
    resetForm()
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>SETTINGS</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Loại tài sản (Asset Types)</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Định nghĩa loại tài sản và đơn vị mặc định để auto-fill khi tạo tài sản.</div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 8, letterSpacing: 1.1 }}>
          {editingId ? 'CHỈNH SỬA LOẠI TÀI SẢN' : 'THÊM LOẠI TÀI SẢN'}
        </div>
        {editingId && (
          <div style={{ fontSize: 12, color: 'var(--orange)', marginBottom: 8 }}>
            Cảnh báo: thay đổi loại tài sản có thể ảnh hưởng tới dữ liệu tài sản đang map theo loại này.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 0.7fr auto', gap: 8 }}>
          <input className="input" placeholder="Mã (vd: may_do_dac)" value={form.type_key} onChange={(e) => setForm((p) => ({ ...p, type_key: e.target.value }))} />
          <input className="input" placeholder="Tên (vd: Máy đo đạc)" value={form.type_name} onChange={(e) => setForm((p) => ({ ...p, type_name: e.target.value }))} />
          <select className="select" value={form.default_unit_id} onChange={(e) => setForm((p) => ({ ...p, default_unit_id: e.target.value }))}>
            <option value="">(Không mặc định)</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unit_name} ({u.unit_key})
              </option>
            ))}
          </select>
          <input className="input" placeholder="Sort" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} />
          <button className="btn-primary" onClick={saveForm}>{editingId ? 'Lưu' : '+ Tạo'}</button>
        </div>
        <textarea
          className="input"
          style={{ marginTop: 8, minHeight: 54, resize: 'vertical' }}
          placeholder="Mô tả (không bắt buộc)"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        />
        {editingId && (
          <div style={{ marginTop: 8 }}>
            <button className="btn-ghost" onClick={resetForm}>Hủy sửa</button>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 8, letterSpacing: 1.1 }}>DANH SÁCH LOẠI TÀI SẢN</div>
        {loading ? (
          <div style={{ padding: 18, color: 'var(--text3)' }}>Đang tải...</div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 560, overflowY: 'auto' }}>
            {rows.map((r) => (
              <div key={r.id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{r.type_name} ({r.type_key})</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      unit mặc định: {r.default_unit?.unit_name || '-'} | sort={r.sort_order} | {r.is_active ? 'active' : 'inactive'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => patchRow(r.id, { is_active: !r.is_active })}>
                      {r.is_active ? 'Tắt' : 'Bật'}
                    </button>
                    <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => startEdit(r)}>Sửa</button>
                    <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => removeRow(r.id)}>
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
