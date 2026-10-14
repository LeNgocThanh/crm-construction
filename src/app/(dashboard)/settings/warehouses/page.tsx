'use client'

import { useEffect, useState } from 'react'

type Warehouse = {
  id: string
  warehouse_code: string
  warehouse_name: string
  region_code?: string | null
  address?: string | null
  manager_name?: string | null
  manager_phone?: string | null
  is_active: boolean
}
type RegionOption = { code: string; name: string }

function emptyForm() {
  return {
    warehouse_code: '',
    warehouse_name: '',
    region_code: '',
    address: '',
    manager_name: '',
    manager_phone: '',
  }
}

export default function WarehousesPage() {
  const [rows, setRows] = useState<Warehouse[]>([])
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>([{ code: 'ALL', name: 'ALL - Toan quoc' }])
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState(emptyForm())
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function loadRows() {
    const res = await fetch('/api/settings/warehouses?active_only=false')
    const j = await res.json().catch(() => ({}))
    setRows(Array.isArray(j?.data) ? j.data : [])
  }

  async function loadRegions() {
    const res = await fetch('/api/settings/regions?active_only=true&level=province&limit=500')
    const j = await res.json().catch(() => ({}))
    const regions = Array.isArray(j?.data) ? j.data : []
    setRegionOptions([
      { code: 'ALL', name: 'ALL - Toan quoc' },
      ...regions
        .map((x: any) => ({ code: String(x.code || ''), name: String(x.name || x.code || '') }))
        .filter((x: RegionOption) => x.code),
    ])
  }

  function regionOptionsFor(current: string) {
    const code = String(current || '').trim()
    if (!code) return regionOptions
    if (regionOptions.some((x) => x.code === code)) return regionOptions
    return [{ code, name: 'Custom' }, ...regionOptions]
  }

  useEffect(() => {
    loadRows()
    loadRegions()
  }, [])

  function beginEdit(x: Warehouse) {
    setEditingId(x.id)
    setForm({
      warehouse_code: x.warehouse_code || '',
      warehouse_name: x.warehouse_name || '',
      region_code: x.region_code || '',
      address: x.address || '',
      manager_name: x.manager_name || '',
      manager_phone: x.manager_phone || '',
    })
  }

  function resetEdit() {
    setEditingId('')
    setForm(emptyForm())
  }

  async function save() {
    if (!form.warehouse_code.trim() || !form.warehouse_name.trim()) {
      return showToast('Thiếu mã kho hoặc tên kho')
    }
    const url = editingId ? `/api/settings/warehouses/${editingId}` : '/api/settings/warehouses'
    const method = editingId ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        warehouse_code: form.warehouse_code.trim(),
        warehouse_name: form.warehouse_name.trim(),
        region_code: form.region_code.trim() || null,
        address: form.address.trim() || null,
        manager_name: form.manager_name.trim() || null,
        manager_phone: form.manager_phone.trim() || null,
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Lưu kho thất bại')
    showToast(editingId ? 'Đã cập nhật kho' : 'Đã tạo kho')
    resetEdit()
    await loadRows()
  }

  async function toggleActive(x: Warehouse) {
    const res = await fetch(`/api/settings/warehouses/${x.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !x.is_active }),
    })
    if (!res.ok) return showToast('Không đổi được trạng thái kho')
    await loadRows()
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text4)', letterSpacing: 2, marginBottom: 4 }}>WAREHOUSE SETTINGS</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Cấu hình kho</h1>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text4)', letterSpacing: 1.1, marginBottom: 8 }}>{editingId ? 'SỬA KHO' : 'THÊM KHO'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 8, marginBottom: 8 }}>
          <input className="input" placeholder="Mã kho" value={form.warehouse_code} onChange={(e) => setForm((p) => ({ ...p, warehouse_code: e.target.value }))} />
          <input className="input" placeholder="Tên kho" value={form.warehouse_name} onChange={(e) => setForm((p) => ({ ...p, warehouse_name: e.target.value }))} />
          <select className="select" value={form.region_code} onChange={(e) => setForm((p) => ({ ...p, region_code: e.target.value }))}>
            <option value="">(Khong chon vung)</option>
            {regionOptionsFor(form.region_code).map((r) => (
              <option key={r.code} value={r.code}>
                {r.code} - {r.name}
              </option>
            ))}
          </select>
          <input className="input" placeholder="Địa chỉ" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          <input className="input" placeholder="Quản lý kho" value={form.manager_name} onChange={(e) => setForm((p) => ({ ...p, manager_name: e.target.value }))} />
          <input className="input" placeholder="SĐT quản lý" value={form.manager_phone} onChange={(e) => setForm((p) => ({ ...p, manager_phone: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" onClick={save}>{editingId ? 'Lưu sửa' : '+ Tạo'}</button>
          {editingId ? <button className="btn-ghost" onClick={resetEdit}>Hủy sửa</button> : null}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr .8fr 1fr 1fr auto', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
          <div>MÃ KHO</div><div>TÊN KHO</div><div>VÙNG</div><div>QL KHO</div><div>SĐT</div><div />
        </div>
        {rows.map((x) => (
          <div key={x.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr .8fr 1fr 1fr auto', gap: 8, padding: '9px 12px', borderBottom: '1px solid var(--border)', opacity: x.is_active ? 1 : 0.5 }}>
            <div style={{ color: 'var(--blue)' }}>{x.warehouse_code}</div>
            <div>{x.warehouse_name}</div>
            <div style={{ color: 'var(--text3)' }}>{x.region_code || '-'}</div>
            <div style={{ color: 'var(--text3)' }}>{x.manager_name || '-'}</div>
            <div style={{ color: 'var(--text3)' }}>{x.manager_phone || '-'}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-ghost" onClick={() => beginEdit(x)}>Sửa</button>
              <button className="btn-ghost" onClick={() => toggleActive(x)}>{x.is_active ? 'Tắt' : 'Bật'}</button>
            </div>
          </div>
        ))}
      </div>

      {toast ? (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
