'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ASSET_ACQUISITION_METHOD_LABELS,
  ASSET_CONDITION_LABELS,
  ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS,
} from '@/lib/assets/dictionaries'
import { getUserDisplayLabel, getUserDisplayName } from '@/lib/user-display'

type Asset = {
  id: string
  asset_code: string
  asset_name: string
  asset_type: string
  asset_type_label?: string
  asset_type_id?: string | null
  asset_type_data?: { id: string; type_key: string; type_name: string } | null
  unit_id?: string | null
  unit_text?: string | null
  unit?: { id: string; unit_key: string; unit_name: string; symbol?: string | null } | null
  status: string
  status_label?: string
  condition_status: string
  condition_status_label?: string
  current_location?: string | null
  current_holder?: { id: string; username: string } | null
  current_customer?: { id: string; full_name?: string | null; phone_number?: string | null } | null
  current_project?: { id: string; project_name?: string | null } | null
}

type Assignment = {
  id: string
  status: string
  assigned_at: string
  expected_return_at?: string | null
  returned_at?: string | null
  purpose?: string | null
  return_note?: string | null
  assigned_user?: { id: string; username: string } | null
  assigner?: { id: string; username: string } | null
  customer?: { id: string; full_name?: string | null; phone_number?: string | null } | null
  project?: { id: string; project_name?: string | null } | null
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [assetTypes, setAssetTypes] = useState<any[]>([])
  const [actionTypes, setActionTypes] = useState<any[]>([])
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [editingAssetId, setEditingAssetId] = useState('')
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)

  const [assetForm, setAssetForm] = useState({
    asset_code: '',
    asset_name: '',
    asset_type: 'equipment',
    asset_type_id: '',
    unit_id: '',
    unit_text: '',
    brand: '',
    model: '',
    manufacturer: '',
    origin_country: '',
    acquisition_method: '',
    co_number: '',
    cq_number: '',
    warranty_end_date: '',
    depreciation_method: '',
    purchase_cost: '',
    salvage_value: '',
    status: 'available',
    condition_status: 'good',
    current_location: '',
  })
  const [newAssign, setNewAssign] = useState({
    assigned_to_user_id: '',
    customer_id: '',
    project_id: '',
    purpose: '',
    expected_return_at: '',
  })
  const [assetFormNote, setAssetFormNote] = useState('')
  const [assetAccessoriesText, setAssetAccessoriesText] = useState('')
  const [actionForm, setActionForm] = useState({
    action_key: '',
    title: '',
    description: '',
    status_to: '',
    due_at: '',
  })

  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === selectedAssetId) || null,
    [assets, selectedAssetId]
  )

  async function loadAll() {
    setLoading(true)
    const [aRes, uRes, cRes, pRes, unitRes, typeRes, actionTypeRes] = await Promise.all([
      fetch('/api/assets'),
      fetch('/api/users?active_only=true'),
      fetch('/api/customers?limit=200'),
      fetch('/api/projects?limit=200'),
      fetch('/api/settings/units?active_only=true'),
      fetch('/api/settings/asset-types?active_only=true'),
      fetch('/api/settings/asset-action-types?active_only=true'),
    ])
    const [aJson, uJson, cJson, pJson, unitJson, typeJson, actionTypeJson] = await Promise.all([
      aRes.json().catch(() => ({})),
      uRes.json().catch(() => ({})),
      cRes.json().catch(() => ({})),
      pRes.json().catch(() => ({})),
      unitRes.json().catch(() => ({})),
      typeRes.json().catch(() => ({})),
      actionTypeRes.json().catch(() => ({})),
    ])
    const nextAssets = Array.isArray(aJson?.data) ? aJson.data : []
    setAssets(nextAssets)
    setUsers(Array.isArray(uJson?.data) ? uJson.data : [])
    setCustomers(Array.isArray(cJson?.data) ? cJson.data : [])
    setProjects(Array.isArray(pJson?.data) ? pJson.data : [])
    setUnits(Array.isArray(unitJson?.data) ? unitJson.data : [])
    setAssetTypes(Array.isArray(typeJson?.data) ? typeJson.data : [])
    setActionTypes(Array.isArray(actionTypeJson?.data) ? actionTypeJson.data : [])
    if (!selectedAssetId && nextAssets.length) setSelectedAssetId(nextAssets[0].id)
    setLoading(false)
  }

  async function loadAssignments(assetId: string) {
    if (!assetId) {
      setAssignments([])
      return
    }
    const res = await fetch(`/api/assets/${assetId}/assignments`)
    const j = await res.json().catch(() => ({}))
    setAssignments(Array.isArray(j?.data) ? j.data : [])
  }

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    loadAssignments(selectedAssetId)
  }, [selectedAssetId])

  useEffect(() => {
    if (!actionTypes.length) return
    setActionForm((p) => {
      if (p.action_key) return p
      return { ...p, action_key: actionTypes[0].action_key || '' }
    })
  }, [actionTypes])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  function resetAssetForm() {
    setEditingAssetId('')
    setAssetFormNote('')
    setAssetAccessoriesText('')
    setAssetForm({
      asset_code: '',
      asset_name: '',
      asset_type: 'equipment',
      asset_type_id: '',
      unit_id: '',
      unit_text: '',
      brand: '',
      model: '',
      manufacturer: '',
      origin_country: '',
      acquisition_method: '',
      co_number: '',
      cq_number: '',
      warranty_end_date: '',
      depreciation_method: '',
      purchase_cost: '',
      salvage_value: '',
      status: 'available',
      condition_status: 'good',
      current_location: '',
    })
  }

  function beginEditAsset(a: Asset) {
    setEditingAssetId(a.id)
    setSelectedAssetId(a.id)
    setAssetForm({
      asset_code: a.asset_code || '',
      asset_name: a.asset_name || '',
      asset_type: a.asset_type || 'equipment',
      asset_type_id: a.asset_type_id || a.asset_type_data?.id || '',
      unit_id: a.unit_id || a.unit?.id || '',
      unit_text: a.unit_text || '',
      brand: (a as any).brand || '',
      model: (a as any).model || '',
      manufacturer: (a as any).manufacturer || '',
      origin_country: (a as any).origin_country || '',
      acquisition_method: (a as any).acquisition_method || '',
      co_number: (a as any).co_number || '',
      cq_number: (a as any).cq_number || '',
      warranty_end_date: (a as any).warranty_end_date ? String((a as any).warranty_end_date).slice(0, 10) : '',
      depreciation_method: (a as any).depreciation_method || '',
      purchase_cost: (a as any).purchase_cost != null ? String((a as any).purchase_cost) : '',
      salvage_value: (a as any).salvage_value != null ? String((a as any).salvage_value) : '',
      status: a.status || 'available',
      condition_status: a.condition_status || 'good',
      current_location: a.current_location || '',
    })
    setAssetFormNote((a as any).notes || '')
    const acc = Array.isArray((a as any)?.metadata_json?.accessories_default)
      ? (a as any).metadata_json.accessories_default.map((x: any) => String(x || '').trim()).filter(Boolean).join(', ')
      : ''
    setAssetAccessoriesText(acc)
  }

  async function saveAssetForm() {
    if (!assetForm.asset_code.trim() || !assetForm.asset_name.trim()) {
      setToast('Thieu ma hoac ten tai san')
      return
    }
    const isEditing = !!editingAssetId
    const url = isEditing ? `/api/assets/${editingAssetId}` : '/api/assets'
    const method = isEditing ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...assetForm,
        asset_type_id: assetForm.asset_type_id || null,
        unit_id: assetForm.unit_id || null,
        unit_text: assetForm.unit_text || null,
        acquisition_method: assetForm.acquisition_method || null,
        co_number: assetForm.co_number || null,
        cq_number: assetForm.cq_number || null,
        warranty_end_date: assetForm.warranty_end_date || null,
        depreciation_method: assetForm.depreciation_method || null,
        purchase_cost: assetForm.purchase_cost || null,
        salvage_value: assetForm.salvage_value || null,
        notes: assetFormNote || null,
        accessories_default: assetAccessoriesText || null,
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return setToast(j?.error || (isEditing ? 'Cập nhật tài sản thất bại' : 'Tạo tài sản thất bại'))
    setToast(isEditing ? 'Đã cập nhật tài sản' : 'Đã tạo tài sản')
    const keepId = isEditing ? editingAssetId : (j?.data?.id || '')
    resetAssetForm()
    await loadAll()
    if (keepId) setSelectedAssetId(keepId)
  }

  async function assignAsset() {
    if (!selectedAssetId) return
    if (!newAssign.assigned_to_user_id) {
      setToast('Thiếu người nhận tài sản')
      return
    }
    const res = await fetch(`/api/assets/${selectedAssetId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newAssign,
        customer_id: newAssign.customer_id || null,
        project_id: newAssign.project_id || null,
        expected_return_at: newAssign.expected_return_at || null,
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return setToast(j?.error || 'Gan tai san that bai')
    setToast('Đã gán tài sản')
    setNewAssign({
      assigned_to_user_id: '',
      customer_id: '',
      project_id: '',
      purpose: '',
      expected_return_at: '',
    })
    await loadAll()
    await loadAssignments(selectedAssetId)
  }

  async function returnAssignment(id: string) {
    const note = prompt('Ghi trú trả tài sản (tùy chọn):', '') || ''
    const res = await fetch(`/api/assets/assignments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'return', return_note: note }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return setToast(j?.error || 'Trả tài sản thất bại')
    setToast('Đã trả tài sản')
    await loadAll()
    await loadAssignments(selectedAssetId)
  }

  async function toggleAssetActive(asset: Asset) {
    const next = asset.status === 'retired' ? 'available' : 'retired'
    const res = await fetch(`/api/assets/${asset.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return setToast(j?.error || 'Cập nhật thất bại')
    setToast('Đã cập nhật tài sản')
    await loadAll()
  }

  async function deleteAsset(assetId: string) {
    if (!confirm('Xóa tài sản này? Hành đọn này không thể hoàn tác.')) return
    const res = await fetch(`/api/assets/${assetId}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return setToast(j?.error || 'Xóa tài sản thất bại')
    setToast('Đã xóa tài sản')
    if (selectedAssetId === assetId) setSelectedAssetId('')
    await loadAll()
  }

  async function runAssetAction() {
    if (!selectedAssetId) return
    if (!actionForm.action_key) return setToast('Thieu action')
    const action = actionTypes.find((x) => x.action_key === actionForm.action_key)
    if (action?.requires_note && !actionForm.description.trim()) {
      return setToast('Action nay Bắt buộc mô tả')
    }
    if (action?.requires_due_at && !actionForm.due_at) {
      return setToast('Action này bắt buộc due_at')
    }
    const res = await fetch(`/api/assets/${selectedAssetId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action_key: actionForm.action_key,
        title: actionForm.title || undefined,
        description: actionForm.description || undefined,
        status_to: actionForm.status_to || undefined,
        due_at: actionForm.due_at || undefined,
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return setToast(j?.error || 'Thực hiện thất bại')
    setToast('Đã ghi nhận')
    setActionForm({
      action_key: actionForm.action_key,
      title: '',
      description: '',
      status_to: '',
      due_at: '',
    })
    await loadAll()
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>ASSET MODULE</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Tài sản / Thiết bị</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Quản lý tài sản, gán cho nhân sự/khách hàng/dự án, và theo dõi lịch sử bàn giao.</div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 30, textAlign: 'center' }}>Đang tải...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)', letterSpacing: 1.2, marginBottom: 8 }}>
              {editingAssetId ? 'SỬA TÀI SẢN' : 'THÊM TÀI SẢN'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input className="input" placeholder="Mã tài sản" value={assetForm.asset_code} onChange={(e) => setAssetForm((p) => ({ ...p, asset_code: e.target.value }))} />
              <input className="input" placeholder="Tên tài sản" value={assetForm.asset_name} onChange={(e) => setAssetForm((p) => ({ ...p, asset_name: e.target.value }))} />
              <select className="select" value={assetForm.asset_type} onChange={(e) => setAssetForm((p) => ({ ...p, asset_type: e.target.value }))}>
                {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                className="select"
                value={assetForm.asset_type_id}
                onChange={(e) => {
                  const nextId = e.target.value
                  const picked = assetTypes.find((x) => x.id === nextId)
                  setAssetForm((p) => ({
                    ...p,
                    asset_type_id: nextId,
                    asset_type: picked?.type_key || p.asset_type,
                    unit_id: p.unit_id || picked?.default_unit_id || '',
                  }))
                }}
              >
                <option value="">(Chọn loại tài sản)</option>
                {assetTypes.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.type_name} ({x.type_key})
                  </option>
                ))}
              </select>
              <select className="select" value={assetForm.unit_id} onChange={(e) => setAssetForm((p) => ({ ...p, unit_id: e.target.value }))}>
                <option value="">(Chọn đơn vị)</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_name} ({u.unit_key})
                  </option>
                ))}
              </select>
              <select className="select" value={assetForm.condition_status} onChange={(e) => setAssetForm((p) => ({ ...p, condition_status: e.target.value }))}>
                {Object.entries(ASSET_CONDITION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input className="input" placeholder="Thương hiệu" value={assetForm.brand} onChange={(e) => setAssetForm((p) => ({ ...p, brand: e.target.value }))} />
              <input className="input" placeholder="Model" value={assetForm.model} onChange={(e) => setAssetForm((p) => ({ ...p, model: e.target.value }))} />
              <input className="input" placeholder="Nhà sản xuất" value={assetForm.manufacturer} onChange={(e) => setAssetForm((p) => ({ ...p, manufacturer: e.target.value }))} />
              <input className="input" placeholder="Xuất xứ" value={assetForm.origin_country} onChange={(e) => setAssetForm((p) => ({ ...p, origin_country: e.target.value }))} />
              <select className="select" value={assetForm.acquisition_method} onChange={(e) => setAssetForm((p) => ({ ...p, acquisition_method: e.target.value }))}>
                <option value="">(Cách nhập hàng)</option>
                {Object.entries(ASSET_ACQUISITION_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input className="input" placeholder="CO number" value={assetForm.co_number} onChange={(e) => setAssetForm((p) => ({ ...p, co_number: e.target.value }))} />
              <input className="input" placeholder="CQ number" value={assetForm.cq_number} onChange={(e) => setAssetForm((p) => ({ ...p, cq_number: e.target.value }))} />
              <input className="input" type="date" value={assetForm.warranty_end_date} onChange={(e) => setAssetForm((p) => ({ ...p, warranty_end_date: e.target.value }))} />
              <select className="select" value={assetForm.depreciation_method} onChange={(e) => setAssetForm((p) => ({ ...p, depreciation_method: e.target.value }))}>
                <option value="">(Loại Khấu hao)</option>
                <option value="straight_line">Đường thẳng</option>
                <option value="reducing_balance">Giảm dần</option>
                <option value="none">Không khấu hao</option>
              </select>
              <input className="input" placeholder="Giá mua" value={assetForm.purchase_cost} onChange={(e) => setAssetForm((p) => ({ ...p, purchase_cost: e.target.value }))} />
              <input className="input" placeholder="Giá trị thu hồii" value={assetForm.salvage_value} onChange={(e) => setAssetForm((p) => ({ ...p, salvage_value: e.target.value }))} />
              <input className="input" placeholder="Vị trí hiện tại" value={assetForm.current_location} onChange={(e) => setAssetForm((p) => ({ ...p, current_location: e.target.value }))} />
              <input className="input" placeholder="Đơn vị mặc định"  value={assetForm.unit_text} onChange={(e) => setAssetForm((p) => ({ ...p, unit_text: e.target.value }))} />
              <input className="input" style={{ gridColumn: '1 / span 2' }} placeholder="Ghi chú" value={assetFormNote} onChange={(e) => setAssetFormNote(e.target.value)} />
              <input className="input" style={{ gridColumn: '1 / span 2' }} placeholder="Phụ kiện mặc định (phân tách bằng dấu phẩy)" value={assetAccessoriesText} onChange={(e) => setAssetAccessoriesText(e.target.value)} />
              <div style={{ display: 'flex', gap: 8, gridColumn: '1 / span 2' }}>
                <button className="btn-primary" onClick={saveAssetForm}>{editingAssetId ? 'Lưu sửa' : '+ Tạo'}</button>
                {editingAssetId ? (
                  <button className="btn-ghost" onClick={resetAssetForm}>Hủy sửa</button>
                ) : null}
              </div>
            </div>

            <div style={{ marginTop: 10, maxHeight: 540, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {assets.map((a) => (
                <div key={a.id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px', background: selectedAssetId === a.id ? 'rgba(59,130,246,.08)' : 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div onClick={() => setSelectedAssetId(a.id)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{a.asset_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {a.asset_code} | {(a.asset_type_data?.type_name || a.asset_type_label || a.asset_type)} | {(a.unit?.unit_name || a.unit_text || '-')} | {(a.status_label || a.status)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        Holder: {a.current_holder ? getUserDisplayName(a.current_holder) : '-'} | Customer: {a.current_customer?.full_name || a.current_customer?.phone_number || '-'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => beginEditAsset(a)}>
                        Sửa
                      </button>
                      <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => toggleAssetActive(a)}>
                        {a.status === 'retired' ? 'Mo lai' : 'Về kho'}
                      </button>
                      <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => deleteAsset(a.id)}>
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)', letterSpacing: 1.2, marginBottom: 8 }}>
              Bàn giao / thu hồi {selectedAsset ? `- ${selectedAsset.asset_name}` : ''}
            </div>
            {!selectedAsset ? (
              <div style={{ color: 'var(--text3)', fontSize: 12 }}>Chon 1 tài sản.</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <select className="select" value={newAssign.assigned_to_user_id} onChange={(e) => setNewAssign((p) => ({ ...p, assigned_to_user_id: e.target.value }))}>
                    <option value="">Chọn người nhận tài sản</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{getUserDisplayLabel(u)}</option>)}
                  </select>
                  <input className="input" type="datetime-local" value={newAssign.expected_return_at} onChange={(e) => setNewAssign((p) => ({ ...p, expected_return_at: e.target.value }))} />
                  <select className="select" value={newAssign.customer_id} onChange={(e) => setNewAssign((p) => ({ ...p, customer_id: e.target.value }))}>
                    <option value="">(Không gán với khách hàng)</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.phone_number || c.id}</option>)}
                  </select>
                  <select className="select" value={newAssign.project_id} onChange={(e) => setNewAssign((p) => ({ ...p, project_id: e.target.value }))}>
                    <option value="">(Khhông gán với dự án)</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name || p.id}</option>)}
                  </select>
                  <input className="input" style={{ gridColumn: '1 / span 2' }} placeholder="Mục đích sử dụng" value={newAssign.purpose} onChange={(e) => setNewAssign((p) => ({ ...p, purpose: e.target.value }))} />
                </div>
                <button className="btn-primary" onClick={assignAsset}>Gán tài sản</button>

                <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 8, letterSpacing: 1.1 }}>ASSET ACTION (DB-DRIVEN)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <select className="select" value={actionForm.action_key} onChange={(e) => setActionForm((p) => ({ ...p, action_key: e.target.value }))}>
                      <option value="">(Chọn action)</option>
                      {actionTypes.map((x) => (
                        <option key={x.id} value={x.action_key}>
                          {x.action_name} ({x.action_key})
                        </option>
                      ))}
                    </select>
                    <select className="select" value={actionForm.status_to} onChange={(e) => setActionForm((p) => ({ ...p, status_to: e.target.value }))}>
                      <option value="">(Không đổi status)</option>
                      {Object.entries(ASSET_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <input className="input" placeholder="Tieu de (optional)" value={actionForm.title} onChange={(e) => setActionForm((p) => ({ ...p, title: e.target.value }))} />
                    <input className="input" type="datetime-local" value={actionForm.due_at} onChange={(e) => setActionForm((p) => ({ ...p, due_at: e.target.value }))} />
                    <input className="input" style={{ gridColumn: '1 / span 2' }} placeholder="Mo ta action" value={actionForm.description} onChange={(e) => setActionForm((p) => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button className="btn-primary" onClick={runAssetAction}>Thực hiện</button>
                  </div>
                </div>

                <div style={{ marginTop: 10, maxHeight: 430, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                  {assignments.map((x) => (
                    <div key={x.id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px' }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{getUserDisplayName(x.assigned_user) || '-'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        status={x.status} | from={new Date(x.assigned_at).toLocaleString('vi-VN')} | due={x.expected_return_at ? new Date(x.expected_return_at).toLocaleString('vi-VN') : '-'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        customer={x.customer?.full_name || x.customer?.phone_number || '-'} | project={x.project?.project_name || '-'}
                      </div>
                      <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
                        {(x.status === 'assigned' || x.status === 'overdue') && (
                          <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => returnAssignment(x.id)}>Trả tài sản</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
