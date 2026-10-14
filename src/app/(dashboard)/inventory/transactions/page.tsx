'use client'

import { useEffect, useMemo, useState } from 'react'

type Warehouse = { id: string; warehouse_code: string; warehouse_name: string }
type Supplier = { id: string; supplier_code: string; supplier_name: string }
type CatalogItem = { id: string; item_code: string; item_name: string; item_unit: string; item_type?: string | null }
type SupplierPrice = {
  supplier_id: string
  material_key: string
  unit?: string | null
  price_per_unit: number
  valid_from?: string | null
  valid_to?: string | null
}

type TxnItem = {
  id?: string
  catalog_item_id?: string | null
  material_key: string
  material_name?: string | null
  item_unit?: string | null
  quantity: number
  unit_price?: number | null
  note?: string | null
}

type Txn = {
  id: string
  txn_code: string
  warehouse_id: string
  txn_type: string
  txn_type_label?: string
  txn_date: string
  supplier_id?: string | null
  status: string
  status_label?: string
  issue_purpose?: string | null
  issue_purpose_label?: string | null
  reference_type?: string | null
  reference_id?: string | null
  source_label?: string | null
  movement_label?: string | null
  warehouse?: Warehouse | null
  supplier?: Supplier | null
  note?: string | null
  items: TxnItem[]
}

function emptyItem(): TxnItem {
  return { material_key: '', material_name: '', item_unit: '', quantity: 1, unit_price: null, note: '' }
}

const ISSUE_PURPOSE_OPTIONS = [
  { value: 'project_supply', label: 'Cấp cho dự án' },
  { value: 'crew_supply', label: 'Cấp cho đội thi công' },
  { value: 'maintenance_supply', label: 'Cấp cho bảo trì' },
  { value: 'loss_damage', label: 'Hao hụt / hư hỏng' },
  { value: 'internal_use', label: 'Dùng nội bộ' },
  { value: 'other', label: 'Mục đích khác' },
]

const SOURCE_GROUP_OPTIONS = [
  { value: 'project', label: 'Nguồn dự án' },
  { value: 'purchase', label: 'Nguồn mua hàng' },
  { value: 'stock_audit', label: 'Nguồn kiểm kê' },
  { value: 'manual', label: 'Tạo tay / nguồn khác' },
]

export default function InventoryTransactionsPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [rows, setRows] = useState<Txn[]>([])
  const [supplierPrices, setSupplierPrices] = useState<SupplierPrice[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})
  const [editorOpen, setEditorOpen] = useState(true)
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)
  const [paging, setPaging] = useState({ page: 1, page_size: 20, total: 0, total_pages: 1 })
  const [filter, setFilter] = useState({
    q: '',
    warehouse_id: '',
    txn_type: '',
    status: '',
    issue_purpose: '',
    source_group: '',
    material_key: '',
    date_from: '',
    date_to: '',
  })

  const [form, setForm] = useState({
    txn_code: '',
    warehouse_id: '',
    txn_type: 'in',
    issue_purpose: '',
    txn_date: '',
    supplier_id: '',
    note: '',
  })
  const [items, setItems] = useState<TxnItem[]>([emptyItem()])

  const selected = useMemo(() => rows.find((x) => x.id === selectedId) || null, [rows, selectedId])
  const requiresUnitPrice = form.txn_type === 'in' || form.txn_type === 'transfer_in'
  const isAdjustTxn = form.txn_type === 'adjust'
  const showUnitPriceInput = form.txn_type !== 'out' && form.txn_type !== 'transfer_out'
  const selectedStatus = String(selected?.status || '')
  const isReadonlySelected = !!selectedId && selectedStatus !== 'draft'
  const materialOptions = useMemo(() => catalog, [catalog])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  function sourceTone(tx: Txn) {
    if (tx.reference_type === 'project_resource_plan' || tx.reference_type === 'project_resource_plan_return') {
      return {
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.35)',
        text: '#FBBF24',
        label: 'Nguồn dự án',
      }
    }
    if (tx.reference_type === 'purchase_order') {
      return {
        bg: 'rgba(249, 115, 22, 0.12)',
        border: 'rgba(249, 115, 22, 0.35)',
        text: '#FB923C',
        label: 'Nguồn mua hàng',
      }
    }
    return {
      bg: 'rgba(148, 163, 184, 0.10)',
      border: 'rgba(148, 163, 184, 0.25)',
      text: 'var(--text2)',
      label: 'Nguồn khác',
    }
  }

  function toggleItems(txnId: string) {
    setExpandedItems((prev) => ({ ...prev, [txnId]: !prev[txnId] }))
  }

  function itemSummary(tx: Txn) {
    const lines = Array.isArray(tx.items) ? tx.items : []
    if (!lines.length) return 'Chưa có dòng vật tư'
    const first = lines[0]
    const firstLabel = `${first.material_name || first.material_key || '-'}${first.item_unit ? ` | ${Number(first.quantity || 0)} ${first.item_unit}` : ` | ${Number(first.quantity || 0)}`}`
    if (lines.length === 1) return firstLabel
    return `${firstLabel} và ${lines.length - 1} dòng khác`
  }

  function resetEditor() {
    setSelectedId('')
    setEditorOpen(true)
    setForm({
      txn_code: '',
      warehouse_id: warehouses[0]?.id || '',
      txn_type: 'in',
      issue_purpose: '',
      txn_date: '',
      supplier_id: '',
      note: '',
    })
    setItems([emptyItem()])
  }

  async function loadMasters() {
    const [wRes, sRes, cRes] = await Promise.all([
      fetch('/api/settings/warehouses?active_only=true'),
      fetch('/api/settings/suppliers?active_only=true'),
      fetch('/api/settings/estimate/catalog-items?active_only=true'),
    ])
    const [wJson, sJson, cJson] = await Promise.all([
      wRes.json().catch(() => ({})),
      sRes.json().catch(() => ({})),
      cRes.json().catch(() => ({})),
    ])
    const ws = Array.isArray(wJson?.data) ? wJson.data : []
    setWarehouses(ws)
    setSuppliers(Array.isArray(sJson?.data) ? sJson.data : [])
    setCatalog(Array.isArray(cJson?.data) ? cJson.data : [])
    setForm((p) => ({ ...p, warehouse_id: p.warehouse_id || ws[0]?.id || '' }))
  }

  async function loadRows(page = paging.page) {
    const sp = new URLSearchParams()
    sp.set('page', String(page))
    sp.set('page_size', String(paging.page_size))
    if (filter.q.trim()) sp.set('q', filter.q.trim())
    if (filter.warehouse_id) sp.set('warehouse_id', filter.warehouse_id)
    if (filter.txn_type) sp.set('txn_type', filter.txn_type)
    if (filter.status) sp.set('status', filter.status)
    if (filter.issue_purpose) sp.set('issue_purpose', filter.issue_purpose)
    if (filter.source_group) sp.set('source_group', filter.source_group)
    if (filter.material_key) sp.set('material_key', filter.material_key)
    if (filter.date_from) sp.set('date_from', new Date(filter.date_from).toISOString())
    if (filter.date_to) sp.set('date_to', new Date(filter.date_to).toISOString())
    const res = await fetch(`/api/inventory/transactions?${sp.toString()}`)
    const j = await res.json().catch(() => ({}))
    setRows(Array.isArray(j?.data) ? j.data : [])
    const p = j?.pagination || {}
    setPaging((prev) => ({
      ...prev,
      page: Number(p.page || page || 1),
      page_size: Number(p.page_size || prev.page_size || 20),
      total: Number(p.total || 0),
      total_pages: Number(p.total_pages || 1),
    }))
  }

  useEffect(() => {
    loadMasters()
    loadRows(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const supplierId = String(form.supplier_id || '').trim()
    if (!supplierId) {
      setSupplierPrices([])
      return
    }
    ;(async () => {
      const res = await fetch(`/api/settings/supplier-prices?active_only=true&supplier_id=${encodeURIComponent(supplierId)}`)
      const j = await res.json().catch(() => ({}))
      setSupplierPrices(Array.isArray(j?.data) ? j.data : [])
    })()
  }, [form.supplier_id])

  function suggestedUnitPrice(materialKey: string) {
    const key = String(materialKey || '').trim()
    if (!key || !supplierPrices.length) return null
    const now = Date.now()
    const matched = supplierPrices
      .filter((x) => String(x.material_key || '').trim() === key)
      .filter((x) => {
        const fromOk = !x.valid_from || new Date(String(x.valid_from)).getTime() <= now
        const toOk = !x.valid_to || new Date(String(x.valid_to)).getTime() >= now
        return fromOk && toOk
      })
      .sort((a, b) => new Date(String(b.valid_from || 0)).getTime() - new Date(String(a.valid_from || 0)).getTime())
    if (!matched.length) return null
    const p = Number(matched[0].price_per_unit || 0)
    return Number.isFinite(p) && p > 0 ? p : null
  }

  useEffect(() => {
    if (!supplierPrices.length) return
    if (!showUnitPriceInput) return
    setItems((prev) => prev.map((it) => {
      if (it.unit_price != null && Number(it.unit_price) > 0) return it
      const next = suggestedUnitPrice(it.material_key)
      if (next == null) return it
      return { ...it, unit_price: next }
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierPrices, showUnitPriceInput])

  function pickCatalog(idx: number, itemId: string) {
    const c = catalog.find((x) => x.id === itemId)
    if (!c) return
    const suggestedPrice = showUnitPriceInput ? suggestedUnitPrice(c.item_code) : null
    setItems((prev) => prev.map((it, i) => i === idx ? ({
      ...it,
      catalog_item_id: c.id,
      material_key: c.item_code,
      material_name: c.item_name,
      item_unit: c.item_unit,
      unit_price: suggestedPrice != null ? suggestedPrice : it.unit_price,
    }) : it))
  }

  function beginEdit(txn: Txn) {
    setSelectedId(txn.id)
    setEditorOpen(true)
    setForm({
      txn_code: txn.txn_code || '',
      warehouse_id: txn.warehouse_id || '',
      txn_type: txn.txn_type || 'in',
      issue_purpose: txn.issue_purpose || '',
      txn_date: txn.txn_date ? new Date(txn.txn_date).toISOString().slice(0, 16) : '',
      supplier_id: txn.supplier_id || '',
      note: txn.note || '',
    })
    setItems((txn.items || []).map((x) => ({
      id: x.id,
      catalog_item_id: x.catalog_item_id || null,
      material_key: x.material_key || '',
      material_name: x.material_name || '',
      item_unit: x.item_unit || '',
      quantity: Number(x.quantity || 0),
      unit_price: x.unit_price != null ? Number(x.unit_price) : null,
      note: x.note || '',
    })))
  }

  function cloneFromSelected() {
    if (!selected) return
    setSelectedId('')
    setEditorOpen(true)
    setForm({
      txn_code: '',
      warehouse_id: selected.warehouse_id || warehouses[0]?.id || '',
      txn_type: selected.txn_type || 'in',
      issue_purpose: selected.issue_purpose || '',
      txn_date: '',
      supplier_id: selected.supplier_id || '',
      note: selected.note || '',
    })
    setItems(
      (selected.items || []).map((x) => ({
        catalog_item_id: x.catalog_item_id || null,
        material_key: x.material_key || '',
        material_name: x.material_name || '',
        item_unit: x.item_unit || '',
        quantity: Number(x.quantity || 0),
        unit_price: x.unit_price != null ? Number(x.unit_price) : null,
        note: x.note || '',
      })),
    )
    showToast('Da tao ban sao tu phieu cu, hay luu de tao phieu moi')
  }

  async function saveTxn() {
    if (!form.warehouse_id) return showToast('Thieu kho')
    const lines = items
      .map((x) => ({
        catalog_item_id: x.catalog_item_id || null,
        material_key: String(x.material_key || '').trim(),
        material_name: String(x.material_name || '').trim() || null,
        item_unit: String(x.item_unit || '').trim() || null,
        quantity: Number(x.quantity || 0),
        unit_price: x.unit_price != null && String(x.unit_price).trim() !== '' ? Number(x.unit_price) : null,
        note: String(x.note || '').trim() || null,
      }))
      .filter((x) => x.material_key && (isAdjustTxn ? x.quantity !== 0 : x.quantity > 0))
    if (!lines.length) return showToast('Can it nhat 1 dong vat tu hop le')
    if (isAdjustTxn) {
      const badAdjust = lines.find((x) => Number(x.quantity || 0) === 0)
      if (badAdjust) return showToast('Phieu dieu chinh: so luong phai khac 0 (am: giam, duong: tang)')
    }
    if (requiresUnitPrice) {
      const bad = lines.find((x) => x.unit_price == null || Number(x.unit_price) <= 0)
      if (bad) return showToast(`Phieu ${form.txn_type} bat buoc don gia > 0`)
    }

    setSaving(true)
    const payload = {
      txn_code: form.txn_code || null,
      warehouse_id: form.warehouse_id,
      txn_type: form.txn_type,
      issue_purpose: form.txn_type === 'out' ? (form.issue_purpose || null) : null,
      txn_date: form.txn_date ? new Date(form.txn_date).toISOString() : null,
      supplier_id: form.supplier_id || null,
      note: form.note || null,
      items: lines,
    }
    const url = selectedId ? `/api/inventory/transactions/${selectedId}` : '/api/inventory/transactions'
    const method = selectedId ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return showToast(j?.error || 'Luu phieu kho that bai')
    showToast(selectedId ? 'Da cap nhat phieu kho' : 'Da tao phieu kho')
    await loadRows()
    if (selectedId) beginEdit(j?.data || selected || ({} as any))
    else resetEditor()
  }

  async function act(txnId: string, action: 'post' | 'cancel') {
    const res = await fetch(`/api/inventory/transactions/${txnId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || `Khong the ${action}`)
    showToast(action === 'post' ? 'Da ghi so phieu kho' : 'Da huy phieu kho')
    await loadRows(paging.page)
    if (selectedId === txnId) setSelectedId('')
  }

  async function removeCancelled(txnId: string) {
    if (!confirm('Xoa phieu da huy nay?')) return
    const res = await fetch(`/api/inventory/transactions/${txnId}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Khong the xoa phieu')
    showToast('Da xoa phieu da huy')
    await loadRows(paging.page)
    if (selectedId === txnId) setSelectedId('')
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text4)', letterSpacing: 2, marginBottom: 4 }}>INVENTORY TRANSACTIONS</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Phiếu kho</h1>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr auto', gap: 8 }}>
          <input className="input" placeholder="Tìm mã phiếu / nguồn phiếu / vật tư..." value={filter.q} onChange={(e) => setFilter((p) => ({ ...p, q: e.target.value }))} />
          <select className="select" value={filter.warehouse_id} onChange={(e) => setFilter((p) => ({ ...p, warehouse_id: e.target.value }))}>
            <option value="">Tất cả kho</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
          </select>
          <select className="select" value={filter.txn_type} onChange={(e) => setFilter((p) => ({ ...p, txn_type: e.target.value }))}>
            <option value="">Tất cả loại phiếu</option>
            <option value="in">Nhập kho</option>
            <option value="out">Xuất kho</option>
            <option value="adjust">Điều chỉnh</option>
            <option value="transfer_in">Nhập chuyển kho</option>
            <option value="transfer_out">Xuất chuyển kho</option>
          </select>
          <select className="select" value={filter.status} onChange={(e) => setFilter((p) => ({ ...p, status: e.target.value }))}>
            <option value="">Tất cả trạng thái</option>
            <option value="draft">Nháp</option>
            <option value="posted">Đã ghi sổ</option>
            <option value="cancelled">Đã hủy</option>
          </select>
          <select className="select" value={filter.source_group} onChange={(e) => setFilter((p) => ({ ...p, source_group: e.target.value }))}>
            <option value="">Tất cả nguồn</option>
            {SOURCE_GROUP_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select className="select" value={filter.issue_purpose} onChange={(e) => setFilter((p) => ({ ...p, issue_purpose: e.target.value }))}>
            <option value="">Tất cả mục đích xuất</option>
            {ISSUE_PURPOSE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select className="select" value={filter.material_key} onChange={(e) => setFilter((p) => ({ ...p, material_key: e.target.value }))}>
            <option value="">Tất cả vật tư</option>
            {materialOptions.map((m) => (
              <option key={m.id} value={m.item_code}>
                {m.item_name} ({m.item_code})
              </option>
            ))}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <input className="input" type="date" value={filter.date_from} onChange={(e) => setFilter((p) => ({ ...p, date_from: e.target.value }))} />
            <input className="input" type="date" value={filter.date_to} onChange={(e) => setFilter((p) => ({ ...p, date_to: e.target.value }))} />
          </div>
          <button className="btn-primary" onClick={() => loadRows(1)}>Lọc</button>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: editorOpen ? 8 : 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)', letterSpacing: 1.1 }}>
            {selectedId
              ? (selectedStatus === 'draft' ? 'SỬA PHIẾU NHÁP' : `PHIẾU ${selected?.status_label?.toUpperCase() || selectedStatus.toUpperCase()} (CHỈ XEM)`)
              : 'TẠO PHIẾU KHO'}
          </div>
          <button className="btn-ghost" onClick={() => setEditorOpen((v) => !v)}>
            {editorOpen ? 'Ẩn form' : 'Hiện form'}
          </button>
        </div>

        {editorOpen ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <input disabled={isReadonlySelected} className="input" placeholder="Mã phiếu (không bắt buộc)" value={form.txn_code} onChange={(e) => setForm((p) => ({ ...p, txn_code: e.target.value }))} />
              <select disabled={isReadonlySelected} className="select" value={form.warehouse_id} onChange={(e) => setForm((p) => ({ ...p, warehouse_id: e.target.value }))}>
                <option value="">Chọn kho</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
              </select>
              <select disabled={isReadonlySelected} className="select" value={form.txn_type} onChange={(e) => setForm((p) => ({ ...p, txn_type: e.target.value }))}>
                <option value="in">Nhập kho</option>
                <option value="out">Xuất kho</option>
                <option value="adjust">Điều chỉnh</option>
                <option value="transfer_in">Nhập chuyển kho</option>
                <option value="transfer_out">Xuất chuyển kho</option>
              </select>
              {form.txn_type === 'out' ? (
                <select disabled={isReadonlySelected} className="select" value={form.issue_purpose} onChange={(e) => setForm((p) => ({ ...p, issue_purpose: e.target.value }))}>
                  <option value="">Chọn mục đích xuất</option>
                  {ISSUE_PURPOSE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              ) : (
                <input disabled className="input" value="Không áp dụng mục đích xuất" />
              )}
              <input disabled={isReadonlySelected} className="input" type="datetime-local" value={form.txn_date} onChange={(e) => setForm((p) => ({ ...p, txn_date: e.target.value }))} />
              <select disabled={isReadonlySelected} className="select" value={form.supplier_id} onChange={(e) => setForm((p) => ({ ...p, supplier_id: e.target.value }))}>
                <option value="">(Không chọn NCC)</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
              </select>
              <input disabled={isReadonlySelected} className="input" placeholder="Ghi chú phiếu" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: showUnitPriceInput ? '1.2fr 1fr .7fr .7fr .9fr auto' : '1.3fr 1.1fr .8fr .8fr auto', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
                <div>VẬT TƯ</div><div>TÊN</div><div>SL</div><div>ĐV</div><div>{showUnitPriceInput ? 'ĐƠN GIÁ' : 'Giá vốn tự động'}</div><div />
              </div>
              {items.map((it, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: showUnitPriceInput ? '1.2fr 1fr .7fr .7fr .9fr auto' : '1.3fr 1.1fr .8fr .8fr auto', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                  <select disabled={isReadonlySelected} className="select" value={it.catalog_item_id || ''} onChange={(e) => pickCatalog(idx, e.target.value)}>
                    <option value="">Chọn vật tư...</option>
                    {catalog.map((c) => <option key={c.id} value={c.id}>{c.item_name} ({c.item_code})</option>)}
                  </select>
                  <input disabled={isReadonlySelected} className="input" value={it.material_name || ''} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, material_name: e.target.value } : x))} />
                  <input disabled={isReadonlySelected} className="input" type="number" step="0.01" value={String(it.quantity ?? '')} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value || 0) } : x))} />
                  <input disabled={isReadonlySelected} className="input" value={it.item_unit || ''} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, item_unit: e.target.value } : x))} />
                  {showUnitPriceInput ? (
                    <input disabled={isReadonlySelected} className="input" type="number" min="0" step="1" value={it.unit_price ?? ''} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, unit_price: e.target.value ? Number(e.target.value) : null } : x))} />
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>Tự động</div>
                  )}
                  <button disabled={isReadonlySelected} className="btn-ghost" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}>X</button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={isReadonlySelected} className="btn-ghost" onClick={() => setItems((p) => [...p, emptyItem()])}>+ Thêm dòng</button>
              {!isReadonlySelected ? (
                <button className="btn-primary" disabled={saving} onClick={saveTxn}>{selectedId ? 'Lưu phiếu' : 'Tạo phiếu nháp'}</button>
              ) : null}
              {selected ? <button className="btn-ghost" onClick={cloneFromSelected}>Tạo phiếu tương tự</button> : null}
              {selectedId ? <button className="btn-ghost" onClick={resetEditor}>Đóng xem</button> : null}
            </div>
          </>
        ) : null}
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text4)', letterSpacing: 1.1, marginBottom: 8 }}>DANH SÁCH PHIẾU</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 12, color: 'var(--text3)' }}>
          <span>Tổng: {paging.total}</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="btn-ghost" disabled={paging.page <= 1} onClick={() => loadRows(Math.max(1, paging.page - 1))}>Trước</button>
            <span>Trang {paging.page}/{paging.total_pages}</span>
            <button className="btn-ghost" disabled={paging.page >= paging.total_pages} onClick={() => loadRows(Math.min(paging.total_pages, paging.page + 1))}>Sau</button>
          </div>
        </div>

        <div style={{ maxHeight: 720, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {rows.map((tx) => {
            const tone = sourceTone(tx)
            return (
              <div key={tx.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: selectedId === tx.id ? 'rgba(59,130,246,.08)' : 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 2 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{tx.txn_code}</div>
                      <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text2)' }}>{tx.txn_type_label || tx.txn_type}</div>
                      <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--border)', color: tx.status === 'posted' ? 'var(--green)' : tx.status === 'cancelled' ? 'var(--red)' : 'var(--text2)' }}>{tx.status_label || tx.status}</div>
                      <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.text }}>{tone.label}</div>
                      {tx.issue_purpose_label ? (
                        <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(59,130,246,0.3)', color: '#93C5FD', background: 'rgba(59,130,246,0.10)' }}>
                          {tx.issue_purpose_label}
                        </div>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{new Date(tx.txn_date).toLocaleString('vi-VN')}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2, whiteSpace: 'normal', wordBreak: 'break-word' }}>{tx.source_label || 'Tạo tay'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, whiteSpace: 'normal', wordBreak: 'break-word' }}>{tx.movement_label || '-'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Vật tư: {itemSummary(tx)}</div>
                    {tx.items?.length > 1 ? (
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ padding: '2px 8px', fontSize: 11, marginTop: 4 }}
                        onClick={() => toggleItems(tx.id)}
                      >
                        {expandedItems[tx.id] ? 'Ẩn chi tiết vật tư' : 'Xem đủ vật tư'}
                      </button>
                    ) : null}
                    {expandedItems[tx.id] ? (
                      <div style={{ marginTop: 6, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                        {(tx.items || []).map((it, index) => (
                          <div key={`${tx.id}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1.4fr .7fr .7fr', gap: 8, padding: '6px 8px', borderBottom: index < tx.items.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 11 }}>
                            <div style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{it.material_name || it.material_key}</div>
                            <div>{Number(it.quantity || 0)}</div>
                            <div>{it.item_unit || '-'}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => beginEdit(tx)}>Chi tiết</button>
                    <a className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} href={`/inventory/transactions/${tx.id}/print`} target="_blank" rel="noreferrer">In</a>
                    {tx.status === 'draft' ? (
                      <>
                        <button className="btn-primary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => act(tx.id, 'post')}>Ghi sổ</button>
                        <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => act(tx.id, 'cancel')}>Hủy</button>
                      </>
                    ) : tx.status === 'cancelled' ? (
                      <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11, color: 'var(--red)' }} onClick={() => removeCancelled(tx.id)}>Xóa</button>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>Đã khóa</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {!rows.length ? <div style={{ padding: 12, color: 'var(--text3)' }}>Chưa có phiếu kho.</div> : null}
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
