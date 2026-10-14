'use client'

import { useEffect, useMemo, useState } from 'react'
import { ASSET_CONDITION_LABELS, ASSET_STATUS_LABELS, ASSET_TYPE_LABELS } from '@/lib/assets/dictionaries'
import { getUserDisplayLabel, getUserDisplayName } from '@/lib/user-display'

type AssetRow = {
  id: string
  asset_code: string
  asset_name: string
  status: string
  status_label?: string
  condition_status: string
  condition_status_label?: string
  asset_type?: string | null
  asset_type_label?: string | null
  asset_type_data?: { id: string; type_key: string; type_name: string } | null
  unit?: { id: string; unit_key: string; unit_name: string } | null
  current_holder?: { id: string; username: string } | null
  current_customer?: { id: string; full_name?: string | null; phone_number?: string | null } | null
  current_project?: { id: string; project_name?: string | null } | null
  last_action?: { id: string; event_key: string; title: string; happened_at: string } | null
  metadata_json?: any
}

type LifeEvent = {
  id: string
  event_key: string
  title: string
  description?: string | null
  happened_at: string
  metadata_json?: any
  actor?: { id: string; username: string } | null
}

type ActionType = {
  id: string
  action_key: string
  action_name: string
  category: string
  requires_due_at: boolean
  requires_note: boolean
  requires_customer: boolean
  requires_project: boolean
  requires_status_to: boolean
  requires_attachment: boolean
  requires_quantity: boolean
  requires_handover_from: boolean
  requires_handover_to: boolean
  requires_warranty_from_date: boolean
  requires_warranty_to_date: boolean
  requires_warranty_provider: boolean
  apply_owner_transfer: boolean
  allowed_status_to_json?: any
  is_active: boolean
}

type UserOption = {
  id: string
  username: string
  full_name?: string | null
  role?: string | null
  primary_access_role?: { key?: string | null; name?: string | null } | null
}

type CustomerOption = {
  id: string
  full_name?: string | null
  phone_number?: string | null
}

type ProjectOption = {
  id: string
  project_name?: string | null
}

export default function AssetOperationsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [lifecycle, setLifecycle] = useState<LifeEvent[]>([])
  const [actionTypes, setActionTypes] = useState<ActionType[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [filter, setFilter] = useState({
    q: '',
    status: '',
    asset_type: '',
  })
  const [lfFilter, setLfFilter] = useState({
    action_key: '',
    category: '',
  })
  const [actionForm, setActionForm] = useState({
    action_key: '',
    title: '',
    description: '',
    status_to: '',
    due_at: '',
    handover_from_user_id: '',
    handover_to_user_id: '',
    customer_id: '',
    project_id: '',
    warranty_from_date: '',
    warranty_to_date: '',
    warranty_provider: '',
    quantity: '',
    attachment_url: '',
    condition_note: '',
    accessories_handover_text: '',
  })

  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === selectedAssetId) || null,
    [assets, selectedAssetId]
  )
  const defaultAccessoriesText = useMemo(() => {
    const raw = selectedAsset?.metadata_json?.accessories_default
    if (!Array.isArray(raw)) return ''
    return raw.map((x: any) => String(x || '').trim()).filter(Boolean).join(', ')
  }, [selectedAsset])
  const selectedActionType = useMemo(
    () => actionTypes.find((x) => x.action_key === actionForm.action_key) || null,
    [actionTypes, actionForm.action_key]
  )
  const actionAllowedStatuses = useMemo(() => {
    const raw = selectedActionType?.allowed_status_to_json
    const arr = Array.isArray(raw) ? raw.map((x: any) => String(x || '').trim()).filter(Boolean) : []
    return arr.length ? arr : ['available', 'in_use', 'maintenance', 'retired', 'lost']
  }, [selectedActionType])
  const needsCustomer = !!selectedActionType?.requires_customer
  const needsProject = !!selectedActionType?.requires_project
  const needsHandoverFrom = !!selectedActionType?.requires_handover_from
  const needsHandoverTo = !!selectedActionType?.requires_handover_to
  const needsStatusTo = !!selectedActionType?.requires_status_to
  const needsDueAt = !!selectedActionType?.requires_due_at
  const needsDescription = !!selectedActionType?.requires_note
  const needsWarrantyFrom = !!selectedActionType?.requires_warranty_from_date
  const needsWarrantyTo = !!selectedActionType?.requires_warranty_to_date
  const needsWarrantyProvider = !!selectedActionType?.requires_warranty_provider
  const needsQuantity = !!selectedActionType?.requires_quantity
  const needsAttachment = !!selectedActionType?.requires_attachment

  useEffect(() => {
    const ownerId = String(selectedAsset?.current_holder?.id || '').trim()
    setActionForm((p) => {
      if (!ownerId) return p
      if (p.handover_from_user_id === ownerId) return p
      if (p.handover_from_user_id) return p
      return { ...p, handover_from_user_id: ownerId }
    })
  }, [selectedAsset?.id, selectedAsset?.current_holder?.id])

  useEffect(() => {
    setActionForm((p) => {
      if (p.accessories_handover_text) return p
      if (!defaultAccessoriesText) return p
      return { ...p, accessories_handover_text: defaultAccessoriesText }
    })
  }, [defaultAccessoriesText])

  useEffect(() => {
    if (actionAllowedStatuses.length !== 1) return
    const only = actionAllowedStatuses[0]
    setActionForm((p) => (p.status_to === only ? p : { ...p, status_to: only }))
  }, [actionAllowedStatuses])

  const availableTypes = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of assets) {
      const key = a.asset_type_data?.type_key || a.asset_type || ''
      const name = a.asset_type_data?.type_name || a.asset_type || ''
      if (key) m.set(key, name)
    }
    return Array.from(m.entries()).map(([key, name]) => ({ key, name }))
  }, [assets])

  const filteredLifecycle = useMemo(() => {
    return lifecycle.filter((x) => {
      if (lfFilter.action_key && x.event_key !== lfFilter.action_key) return false
      if (lfFilter.category) {
        const cat = String(x?.metadata_json?.category || '')
        if (cat !== lfFilter.category) return false
      }
      return true
    })
  }, [lifecycle, lfFilter])


  async function loadAssets() {
    setLoading(true)
    const sp = new URLSearchParams()
    if (filter.q.trim()) sp.set('q', filter.q.trim())
    if (filter.status) sp.set('status', filter.status)
    if (filter.asset_type) sp.set('asset_type', filter.asset_type)
    const res = await fetch(`/api/assets?${sp.toString()}`)
    const j = await res.json().catch(() => ({}))
    const rows = Array.isArray(j?.data) ? j.data : []
    setAssets(rows)
    if (!selectedAssetId && rows.length) setSelectedAssetId(rows[0].id)
    if (selectedAssetId && !rows.some((x: AssetRow) => x.id === selectedAssetId)) {
      setSelectedAssetId(rows[0]?.id || '')
    }
    setLoading(false)
  }

  async function loadActionTypes() {
    const res = await fetch('/api/settings/asset-action-types?active_only=true')
    const j = await res.json().catch(() => ({}))
    const rows = Array.isArray(j?.data) ? j.data : []
    setActionTypes(rows)
    setActionForm((p) => ({ ...p, action_key: p.action_key || rows[0]?.action_key || '' }))
  }

  async function loadUsers() {
    const res = await fetch('/api/users')
    const j = await res.json().catch(() => ({}))
    const rows = Array.isArray(j?.data) ? j.data : []
    setUsers(rows.map((x: any) => ({ id: String(x.id), username: String(x.username || x.id), full_name: x.full_name || null, role: x.role || null, primary_access_role: x.primary_access_role || null })))
  }

  async function loadCustomers() {
    const res = await fetch('/api/customers?limit=300')
    const j = await res.json().catch(() => ({}))
    setCustomers(Array.isArray(j?.data) ? j.data : [])
  }

  async function loadProjects() {
    const res = await fetch('/api/projects?limit=300')
    const j = await res.json().catch(() => ({}))
    setProjects(Array.isArray(j?.data) ? j.data : [])
  }

  async function loadLifecycle(assetId: string) {
    if (!assetId) {
      setLifecycle([])
      return
    }
    const res = await fetch(`/api/assets/${assetId}/lifecycle`)
    const j = await res.json().catch(() => ({}))
    setLifecycle(Array.isArray(j?.data) ? j.data : [])
  }

  useEffect(() => {
    loadAssets()
    loadActionTypes()
    loadUsers()
    loadCustomers()
    loadProjects()
  }, [])

  useEffect(() => {
    loadLifecycle(selectedAssetId)
  }, [selectedAssetId])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  async function applyAssetFilter() {
    await loadAssets()
  }

  async function runAction() {
    if (!selectedAssetId) return
    if (!actionForm.action_key) return setToast('Thieu action')
    const type = actionTypes.find((x) => x.action_key === actionForm.action_key)
    if (needsDescription && !actionForm.description.trim()) return setToast('Action nay bat buoc mo ta')
    if (needsDueAt && !actionForm.due_at) return setToast('Action nay bat buoc due_at')
    if (needsHandoverFrom && !actionForm.handover_from_user_id) return setToast('Action nay bat buoc nguoi giao')
    if (needsHandoverTo && !actionForm.handover_to_user_id) return setToast('Action nay bat buoc nguoi nhan')
    if (needsStatusTo && !actionForm.status_to) return setToast('Action nay bat buoc status_to')
    if (needsCustomer && !actionForm.customer_id) return setToast('Action nay bat buoc khach hang')
    if (needsProject && !actionForm.project_id) return setToast('Action nay bat buoc du an')
    if (needsWarrantyFrom && !actionForm.warranty_from_date) return setToast('Action nay bat buoc ngay BH tu')
    if (needsWarrantyTo && !actionForm.warranty_to_date) return setToast('Action nay bat buoc ngay BH den')
    if (needsWarrantyProvider && !actionForm.warranty_provider.trim()) return setToast('Action nay bat buoc NCC bao hanh')
    if (needsQuantity && !String(actionForm.quantity || '').trim()) return setToast('Action nay bat buoc so luong')
    if (needsAttachment && !actionForm.attachment_url.trim()) return setToast('Action nay bat buoc tep dinh kem')

    const res = await fetch(`/api/assets/${selectedAssetId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action_key: actionForm.action_key,
        title: actionForm.title || undefined,
        description: actionForm.description || undefined,
        due_at: actionForm.due_at || undefined,
        status_to: actionForm.status_to || undefined,
        handover_from_user_id: actionForm.handover_from_user_id || undefined,
        handover_to_user_id: actionForm.handover_to_user_id || undefined,
        customer_id: actionForm.customer_id || undefined,
        project_id: actionForm.project_id || undefined,
        warranty_from_date: actionForm.warranty_from_date || undefined,
        warranty_end_date: actionForm.warranty_to_date || undefined,
        warranty_provider: actionForm.warranty_provider || undefined,
        quantity: actionForm.quantity || undefined,
        attachment_url: actionForm.attachment_url || undefined,
        condition_note: actionForm.condition_note || undefined,
        accessories_handover: actionForm.accessories_handover_text || undefined,
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return setToast(j?.error || 'Thuc hien action that bai')
    setToast('Da thuc hien action')
    setActionForm((p) => ({
      ...p,
      title: '',
      description: '',
      due_at: '',
      status_to: '',
      handover_from_user_id: '',
      handover_to_user_id: '',
      customer_id: '',
      project_id: '',
      warranty_from_date: '',
      warranty_to_date: '',
      warranty_provider: '',
      quantity: '',
      attachment_url: '',
      condition_note: '',
      accessories_handover_text: defaultAccessoriesText || '',
    }))
    await loadAssets()
    await loadLifecycle(selectedAssetId)
  }

  function openHandoverDoc(ev: LifeEvent) {
    const doc = ev?.metadata_json?.handover_document || {}
    const lines = Array.isArray(doc?.accessories_handover) ? doc.accessories_handover : []
    const conditionLabel = ASSET_CONDITION_LABELS[String(doc?.condition_note || '').trim()] || String(doc?.condition_note || '-')
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Bien ban ${String(doc?.action_name || ev.event_key || '')}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { font-size: 20px; margin: 0 0 12px; }
            .row { margin-bottom: 8px; }
            .label { font-weight: 700; display: inline-block; min-width: 180px; }
            ul { margin: 8px 0 0 20px; }
            .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 36px; }
            .box { border-top: 1px solid #111827; padding-top: 8px; text-align: center; min-height: 64px; }
          </style>
        </head>
        <body>
          <h1>Biên bản ${String(doc?.action_name || ev.title || '')}</h1>
          <div class="row"><span class="label">Thời điểm:</span>${new Date(ev.happened_at).toLocaleString('vi-VN')}</div>
          <div class="row"><span class="label">Tài sản:</span>${String(doc?.asset_name || selectedAsset?.asset_name || '-')} (${String(doc?.asset_code || selectedAsset?.asset_code || '-')})</div>
          <div class="row"><span class="label">Người giao:</span>${String(doc?.handover_from?.username || '-')}</div>
          <div class="row"><span class="label">Người nhận:</span>${String(doc?.handover_to?.username || '-')}</div>
          <div class="row"><span class="label">Trạng thái:</span>${String(doc?.status_from || '-')} -> ${String(doc?.status_to || '-')}</div>
          <div class="row"><span class="label">Số lượng:</span>${String(doc?.quantity ?? '-')}</div>
          <div class="row"><span class="label">Tình trạng:</span>${conditionLabel}</div>
          <div class="row"><span class="label">Ghi chú:</span>${String(doc?.note || '-')}</div>
          <div class="row"><span class="label">Phụ kiện đi kèm:</span></div>
          <ul>${lines.length ? lines.map((x: string) => `<li>${x}</li>`).join('') : '<li>Không có</li>'}</ul>
          <div class="sign">
            <div class="box">Người giao ký tên</div>
            <div class="box">Người nhận ký tên</div>
          </div>
        </body>
      </html>
    `
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    w.document.open()
    w.document.write(html)
    w.document.close()
    w.focus()
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>ASSET OPERATIONS</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Vận hành tài sản</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Lọc tài sản, thao tác lifecycle và theo dõi timeline theo từng asset.</div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr auto', gap: 8 }}>
          <input className="input" placeholder="Tìm mã/tên tài sản..." value={filter.q} onChange={(e) => setFilter((p) => ({ ...p, q: e.target.value }))} />
          <select className="select" value={filter.status} onChange={(e) => setFilter((p) => ({ ...p, status: e.target.value }))}>
            <option value="">Tất cả trạng thái</option>
            <option value="available">{ASSET_STATUS_LABELS.available}</option>
            <option value="in_use">{ASSET_STATUS_LABELS.in_use}</option>
            <option value="maintenance">{ASSET_STATUS_LABELS.maintenance}</option>
            <option value="retired">{ASSET_STATUS_LABELS.retired}</option>
            <option value="lost">{ASSET_STATUS_LABELS.lost}</option>
          </select>
          <select className="select" value={filter.asset_type} onChange={(e) => setFilter((p) => ({ ...p, asset_type: e.target.value }))}>
            <option value="">Tất cả loại</option>
            {availableTypes.map((x) => (
              <option key={x.key} value={x.key}>
                {ASSET_TYPE_LABELS[String(x.key || '')] || x.name}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={applyAssetFilter}>Lọc</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)', letterSpacing: 1.2, marginBottom: 8 }}>DANH SÁCH TÀI SẢN</div>
          {loading ? (
            <div style={{ padding: 12, color: 'var(--text3)' }}>Đang tải...</div>
          ) : (
            <div style={{ maxHeight: 650, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {assets.map((a) => (
                <div key={a.id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px', background: selectedAssetId === a.id ? 'rgba(59,130,246,.08)' : 'transparent', cursor: 'pointer' }} onClick={() => setSelectedAssetId(a.id)}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{a.asset_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {a.asset_code} | {a.asset_type_data?.type_name || a.asset_type_label || ASSET_TYPE_LABELS[String(a.asset_type || '')] || a.asset_type} | {a.unit?.unit_name || '-'} | {a.status_label || ASSET_STATUS_LABELS[String(a.status || '')] || a.status}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    holder={a.current_holder ? getUserDisplayName(a.current_holder) : '-'} | customer={a.current_customer?.full_name || a.current_customer?.phone_number || '-'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)', letterSpacing: 1.2, marginBottom: 8 }}>
            TIMELINE + ACTION {selectedAsset ? `- ${selectedAsset.asset_name}` : ''}
          </div>

          {!selectedAsset ? (
            <div style={{ color: 'var(--text3)', fontSize: 12 }}>Chọn 1 tài sản để xem timeline và thao tác action.</div>
          ) : (
            <>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text4)', letterSpacing: 1.1, marginBottom: 8 }}>THỰC HIỆN ACTION</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <select className="select" value={actionForm.action_key} onChange={(e) => setActionForm((p) => ({ ...p, action_key: e.target.value }))}>
                    <option value="">(Chọn action)</option>
                    {actionTypes.map((x) => (
                      <option key={x.id} value={x.action_key}>
                        {x.action_name} ({x.action_key})
                      </option>
                    ))}
                  </select>
                  {needsStatusTo || actionAllowedStatuses.length > 0 ? (
                    <select className="select" value={actionForm.status_to} onChange={(e) => setActionForm((p) => ({ ...p, status_to: e.target.value }))}>
                      <option value="">(Không đổi status)</option>
                      {actionAllowedStatuses.map((s) => (
                        <option key={s} value={s}>{ASSET_STATUS_LABELS[s] || s}</option>
                      ))}
                    </select>
                  ) : <div />}
                  {needsHandoverFrom ? (
                    <select className="select" value={actionForm.handover_from_user_id} onChange={(e) => setActionForm((p) => ({ ...p, handover_from_user_id: e.target.value }))}>
                      <option value="">(Người giao)</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{getUserDisplayLabel(u)}</option>
                      ))}
                    </select>
                  ) : <div />}
                  {needsHandoverTo ? (
                    <select className="select" value={actionForm.handover_to_user_id} onChange={(e) => setActionForm((p) => ({ ...p, handover_to_user_id: e.target.value }))}>
                      <option value="">(Người nhận)</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{getUserDisplayLabel(u)}</option>
                      ))}
                    </select>
                  ) : <div />}
                  {needsCustomer ? (
                    <select className="select" value={actionForm.customer_id} onChange={(e) => setActionForm((p) => ({ ...p, customer_id: e.target.value }))}>
                      <option value="">(Khách hàng)</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.full_name || c.phone_number || c.id}</option>
                      ))}
                    </select>
                  ) : <div />}
                  {needsProject ? (
                    <select className="select" value={actionForm.project_id} onChange={(e) => setActionForm((p) => ({ ...p, project_id: e.target.value }))}>
                      <option value="">(Dự án)</option>
                      {projects.map((pr) => (
                        <option key={pr.id} value={pr.id}>{pr.project_name || pr.id}</option>
                      ))}
                    </select>
                  ) : <div />}
                  <input className="input" placeholder="Tiêu đề (optional)" value={actionForm.title} onChange={(e) => setActionForm((p) => ({ ...p, title: e.target.value }))} />
                  {needsDueAt ? (
                    <input className="input" type="datetime-local" value={actionForm.due_at} onChange={(e) => setActionForm((p) => ({ ...p, due_at: e.target.value }))} />
                  ) : <div />}
                  {needsWarrantyFrom ? (
                    <input className="input" type="date" value={actionForm.warranty_from_date} onChange={(e) => setActionForm((p) => ({ ...p, warranty_from_date: e.target.value }))} />
                  ) : <div />}
                  {needsWarrantyTo ? (
                    <input className="input" type="date" value={actionForm.warranty_to_date} onChange={(e) => setActionForm((p) => ({ ...p, warranty_to_date: e.target.value }))} />
                  ) : <div />}
                  {needsWarrantyProvider ? (
                    <input className="input" placeholder="NCC bảo hành" value={actionForm.warranty_provider} onChange={(e) => setActionForm((p) => ({ ...p, warranty_provider: e.target.value }))} />
                  ) : <div />}
                  {needsQuantity ? (
                    <input className="input" type="number" step="0.01" placeholder="Số lượng" value={actionForm.quantity} onChange={(e) => setActionForm((p) => ({ ...p, quantity: e.target.value }))} />
                  ) : <div />}
                  {needsAttachment ? (
                    <input className="input" placeholder="Link tệp đính kèm" value={actionForm.attachment_url} onChange={(e) => setActionForm((p) => ({ ...p, attachment_url: e.target.value }))} />
                  ) : <div />}
                  <select className="select" value={actionForm.condition_note} onChange={(e) => setActionForm((p) => ({ ...p, condition_note: e.target.value }))}>
                    <option value="">(Tình trạng khi bàn giao/thu hồi)</option>
                    {Object.entries(ASSET_CONDITION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <input className="input" placeholder="Phụ kiện bàn giao (phân tách bằng dấu phẩy)" value={actionForm.accessories_handover_text} onChange={(e) => setActionForm((p) => ({ ...p, accessories_handover_text: e.target.value }))} />
                  <input className="input" style={{ gridColumn: '1 / span 2' }} placeholder="Mô tả action" value={actionForm.description} onChange={(e) => setActionForm((p) => ({ ...p, description: e.target.value }))} />
                </div>
                {selectedActionType?.apply_owner_transfer && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--orange)' }}>
                    Action này được cấu hình chuyển người giữ tài sản sang <strong>Người nhận</strong> khi lưu.
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  <button className="btn-primary" onClick={runAction}>Thực hiện action</button>
                </div>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <select className="select" value={lfFilter.action_key} onChange={(e) => setLfFilter((p) => ({ ...p, action_key: e.target.value }))}>
                    <option value="">Tất cả action</option>
                    {actionTypes.map((x) => (
                      <option key={x.id} value={x.action_key}>
                        {x.action_name}
                      </option>
                    ))}
                  </select>
                  <select className="select" value={lfFilter.category} onChange={(e) => setLfFilter((p) => ({ ...p, category: e.target.value }))}>
                    <option value="">Tất cả category</option>
                    <option value="lifecycle">lifecycle</option>
                    <option value="maintenance">maintenance</option>
                    <option value="warranty">warranty</option>
                    <option value="audit">audit</option>
                    <option value="handover">handover</option>
                  </select>
                </div>

                <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                  {filteredLifecycle.map((ev) => (
                    <div key={ev.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{ev.title}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(ev.happened_at).toLocaleString('vi-VN')}</div>
                          {ev?.metadata_json?.handover_document ? (
                            <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => openHandoverDoc(ev)}>In biên bản</button>
                          ) : null}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        action={ev.event_key} | category={String(ev?.metadata_json?.category || '-')} | actor={ev.actor ? getUserDisplayName(ev.actor) : '-'}
                      </div>
                      {ev?.metadata_json?.inputs?.condition_note ? (
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                          Tình trạng: {ASSET_CONDITION_LABELS[String(ev.metadata_json.inputs.condition_note)] || String(ev.metadata_json.inputs.condition_note)}
                        </div>
                      ) : null}
                      {ev.description && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{ev.description}</div>}
                    </div>
                  ))}
                  {!filteredLifecycle.length && (
                    <div style={{ padding: 14, fontSize: 12, color: 'var(--text3)' }}>Chưa có dữ liệu timeline theo bộ lọc hiện tại.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>


      {toast && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
