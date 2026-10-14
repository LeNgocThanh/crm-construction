'use client'

import { useEffect, useState } from 'react'

type Unit = {
  id: string
  unit_key: string
  unit_name: string
  symbol?: string | null
  category_key: string
  description?: string | null
  sort_order: number
  is_active: boolean
}

const CATEGORY_OPTIONS = [
  { key: 'count', label: 'Đếm (count)' },
  { key: 'length', label: 'Chiều dài (length)' },
  { key: 'area', label: 'Diện tích (area)' },
  { key: 'volume', label: 'Thể tích (volume)' },
  { key: 'mass', label: 'Khối lượng (mass)' },
  { key: 'other', label: 'Khác (other)' },
]

export default function UnitsPage() {
  const [rows, setRows] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({
    unit_key: '',
    unit_name: '',
    symbol: '',
    category_key: 'other',
    description: '',
    sort_order: '0',
  })

  async function load() {
    setLoading(true)
    const res = await fetch('/api/settings/units')
    const j = await res.json().catch(() => ({}))
    setRows(Array.isArray(j?.data) ? j.data : [])
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

  async function createUnit() {
    if (!form.unit_key.trim() || !form.unit_name.trim()) return setToast('Thiếu mã hoặc tên đơn vị')
    const res = await fetch('/api/settings/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unit_key: form.unit_key.trim().toLowerCase(),
        unit_name: form.unit_name.trim(),
        symbol: form.symbol.trim() || null,
        category_key: form.category_key,
        description: form.description.trim() || null,
        sort_order: Number(form.sort_order || 0),
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return setToast(j?.error || 'Tạo đơn vị thất bại')
    setToast('Đã tạo đơn vị')
    setForm({
      unit_key: '',
      unit_name: '',
      symbol: '',
      category_key: 'other',
      description: '',
      sort_order: '0',
    })
    await load()
  }

  async function patchUnit(id: string, patch: any) {
    const res = await fetch(`/api/settings/units/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return setToast(j?.error || 'Cập nhật thất bại')
    setToast('Đã cập nhật')
    await load()
  }

  async function removeUnit(id: string) {
    if (!confirm('Xóa đơn vị này?')) return
    const res = await fetch(`/api/settings/units/${id}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return setToast(j?.error || 'Xóa thất bại')
    setToast('Đã xóa')
    await load()
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>SETTINGS</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Chuẩn hóa Đơn vị tính</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Quản lý đơn vị dùng chung để tránh sai lệch kiểu cai/cái/pcs.</div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 8, letterSpacing: 1.1 }}>THÊM ĐƠN VỊ</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.7fr 0.9fr 0.7fr auto', gap: 8 }}>
          <input className="input" placeholder="Mã (vd: cai)" value={form.unit_key} onChange={(e) => setForm((p) => ({ ...p, unit_key: e.target.value }))} />
          <input className="input" placeholder="Tên hiển thị (vd: Cái)" value={form.unit_name} onChange={(e) => setForm((p) => ({ ...p, unit_name: e.target.value }))} />
          <input className="input" placeholder="Ký hiệu" value={form.symbol} onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value }))} />
          <select className="select" value={form.category_key} onChange={(e) => setForm((p) => ({ ...p, category_key: e.target.value }))}>
            {CATEGORY_OPTIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input className="input" placeholder="Sort" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} />
          <button className="btn-primary" onClick={createUnit}>+ Tạo</button>
        </div>
        <textarea
          className="input"
          style={{ marginTop: 8, minHeight: 54, resize: 'vertical' }}
          placeholder="Mô tả (không bắt buộc)"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        />
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 8, letterSpacing: 1.1 }}>DANH SÁCH ĐƠN VỊ</div>
        {loading ? (
          <div style={{ padding: 20, color: 'var(--text3)' }}>Đang tải...</div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 560, overflowY: 'auto' }}>
            {rows.map((u) => (
              <div key={u.id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{u.unit_name} ({u.unit_key})</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      category={u.category_key} | symbol={u.symbol || '-'} | sort={u.sort_order} | {u.is_active ? 'active' : 'inactive'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => patchUnit(u.id, { is_active: !u.is_active })}>{u.is_active ? 'Tắt' : 'Bật'}</button>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 11 }}
                      onClick={() => {
                        const nextName = prompt('Tên đơn vị', u.unit_name)
                        if (!nextName) return
                        patchUnit(u.id, { unit_name: nextName })
                      }}
                    >
                      Sửa tên
                    </button>
                    <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => removeUnit(u.id)}>Xóa</button>
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

