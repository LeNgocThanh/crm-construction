'use client'

import { useEffect, useMemo, useState } from 'react'

type SupplierProfile = {
  supplier_type?: string | null
  legal_name?: string | null
  tax_code?: string | null
  business_license_no?: string | null
  primary_phone?: string | null
  secondary_phone?: string | null
  zalo_phone?: string | null
  contact_email?: string | null
  payment_terms_days?: number | null
  credit_limit?: number | null
  current_debt?: number | null
  note?: string | null
}

type Supplier = {
  id: string
  supplier_code: string
  supplier_name: string
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  region_code?: string | null
  note?: string | null
  is_active: boolean
  phone_display?: string | null
  profile?: SupplierProfile | null
}

type SupplierPrice = {
  id: string
  supplier_id: string
  catalog_item_id?: string | null
  material_key: string
  material_name?: string | null
  unit?: string | null
  region_code?: string | null
  price_per_unit: number
  currency?: string | null
  min_order_qty?: number | null
  source_note?: string | null
  valid_from?: string | null
  valid_to?: string | null
  is_active: boolean
  supplier?: Supplier
}

type Material = {
  material_key: string
  material_name: string
  unit: string
}

type RegionOption = {
  code: string
  name: string
}

type SupplierForm = {
  supplier_code: string
  supplier_name: string
  supplier_type: string
  contact_name: string
  primary_phone: string
  secondary_phone: string
  zalo_phone: string
  contact_email: string
  legal_name: string
  tax_code: string
  business_license_no: string
  region_code: string
  address: string
  payment_terms_days: string
  credit_limit: string
  current_debt: string
  note: string
}

type PriceForm = {
  supplier_id: string
  material_key: string
  material_name: string
  unit: string
  region_code: string
  price_per_unit: string
  currency: string
  min_order_qty: string
  valid_from: string
  valid_to: string
  source_note: string
}

const SUPPLIER_TYPE_OPTIONS = [
  { value: 'company', label: 'Công ty' },
  { value: 'store', label: 'Cửa hàng' },
  { value: 'individual', label: 'Tư nhân' },
  { value: 'distributor', label: 'Đại lý' },
  { value: 'factory', label: 'Nhà máy' },
  { value: 'contractor', label: 'Tổ đội / thầu' },
  { value: 'service', label: 'Dịch vụ' },
]

function toDatetimeLocalValue(v?: string | null) {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  const offsetMs = d.getTimezoneOffset() * 60000
  const local = new Date(d.getTime() - offsetMs)
  return local.toISOString().slice(0, 16)
}

function toApiDateTime(v: string) {
  const raw = String(v || '').trim()
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function emptySupplierForm(): SupplierForm {
  return {
    supplier_code: '',
    supplier_name: '',
    supplier_type: 'company',
    contact_name: '',
    primary_phone: '',
    secondary_phone: '',
    zalo_phone: '',
    contact_email: '',
    legal_name: '',
    tax_code: '',
    business_license_no: '',
    region_code: 'ALL',
    address: '',
    payment_terms_days: '0',
    credit_limit: '',
    current_debt: '',
    note: '',
  }
}

function emptyPriceForm(): PriceForm {
  return {
    supplier_id: '',
    material_key: '',
    material_name: '',
    unit: 'kg',
    region_code: 'ALL',
    price_per_unit: '',
    currency: 'VND',
    min_order_qty: '',
    valid_from: toDatetimeLocalValue(new Date().toISOString()),
    valid_to: '',
    source_note: '',
  }
}

export default function SuppliersPricingPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [prices, setPrices] = useState<SupplierPrice[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>([{ code: 'ALL', name: 'ALL - Toan quoc' }])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplierForm())
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null)
  const [savingSupplier, setSavingSupplier] = useState(false)

  const [priceForm, setPriceForm] = useState<PriceForm>(emptyPriceForm())
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [savingPrice, setSavingPrice] = useState(false)

  const supplierMap = useMemo(() => {
    const m = new Map<string, Supplier>()
    for (const s of suppliers) m.set(s.id, s)
    return m
  }, [suppliers])
  const regionOptionsFor = (current: string) => {
    const code = String(current || '').trim()
    if (!code) return regionOptions
    if (regionOptions.some((x) => x.code === code)) return regionOptions
    return [{ code, name: 'Custom' }, ...regionOptions]
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function loadAll() {
    setLoading(true)
    try {
      const [sRes, pRes, mRes, rRes] = await Promise.all([
        fetch('/api/settings/suppliers?active_only=false'),
        fetch('/api/settings/supplier-prices?active_only=false'),
        fetch('/api/settings/estimate/materials?active_only=true'),
        fetch('/api/settings/regions?active_only=true&level=province&limit=500'),
      ])
      const sJson = await sRes.json().catch(() => ({}))
      const pJson = await pRes.json().catch(() => ({}))
      const mJson = await mRes.json().catch(() => ({}))
      const rJson = await rRes.json().catch(() => ({}))
      setSuppliers(Array.isArray(sJson.data) ? sJson.data : [])
      setPrices(Array.isArray(pJson.data) ? pJson.data : [])
      setMaterials(Array.isArray(mJson.data) ? mJson.data : [])
      const regions = Array.isArray(rJson?.data) ? rJson.data : []
      const opts = [
        { code: 'ALL', name: 'ALL - Toan quoc' },
        ...regions.map((x: any) => ({ code: String(x.code || ''), name: String(x.name || x.code || '') })).filter((x: RegionOption) => x.code),
      ]
      setRegionOptions(opts)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  function beginEditSupplier(s: Supplier) {
    setEditingSupplierId(s.id)
    setSupplierForm({
      supplier_code: s.supplier_code || '',
      supplier_name: s.supplier_name || '',
      supplier_type: s.profile?.supplier_type || 'company',
      contact_name: s.contact_name || '',
      primary_phone: s.profile?.primary_phone || s.phone || '',
      secondary_phone: s.profile?.secondary_phone || '',
      zalo_phone: s.profile?.zalo_phone || '',
      contact_email: s.profile?.contact_email || s.email || '',
      legal_name: s.profile?.legal_name || '',
      tax_code: s.profile?.tax_code || '',
      business_license_no: s.profile?.business_license_no || '',
      region_code: s.region_code || 'ALL',
      address: s.address || '',
      payment_terms_days: s.profile?.payment_terms_days != null ? String(s.profile.payment_terms_days) : '0',
      credit_limit: s.profile?.credit_limit != null ? String(s.profile.credit_limit) : '',
      current_debt: s.profile?.current_debt != null ? String(s.profile.current_debt) : '',
      note: s.note || s.profile?.note || '',
    })
  }

  function resetSupplierEditor() {
    setEditingSupplierId(null)
    setSupplierForm(emptySupplierForm())
  }

  async function saveSupplier() {
    if (!supplierForm.supplier_code.trim() || !supplierForm.supplier_name.trim()) {
      showToast('Thiếu mã nhà cung cấp hoặc tên nhà cung cấp')
      return
    }
    setSavingSupplier(true)
    try {
      const payload = {
        supplier_code: supplierForm.supplier_code.trim(),
        supplier_name: supplierForm.supplier_name.trim(),
        supplier_type: supplierForm.supplier_type || null,
        contact_name: supplierForm.contact_name.trim() || null,
        primary_phone: supplierForm.primary_phone.trim() || null,
        secondary_phone: supplierForm.secondary_phone.trim() || null,
        zalo_phone: supplierForm.zalo_phone.trim() || null,
        contact_email: supplierForm.contact_email.trim() || null,
        legal_name: supplierForm.legal_name.trim() || null,
        tax_code: supplierForm.tax_code.trim() || null,
        business_license_no: supplierForm.business_license_no.trim() || null,
        region_code: supplierForm.region_code.trim() || null,
        address: supplierForm.address.trim() || null,
        payment_terms_days: supplierForm.payment_terms_days.trim() ? Number(supplierForm.payment_terms_days) : 0,
        credit_limit: supplierForm.credit_limit.trim() ? Number(supplierForm.credit_limit) : null,
        current_debt: supplierForm.current_debt.trim() ? Number(supplierForm.current_debt) : null,
        note: supplierForm.note.trim() || null,
        profile_note: supplierForm.note.trim() || null,
        phone: supplierForm.primary_phone.trim() || null,
        email: supplierForm.contact_email.trim() || null,
      }

      const url = editingSupplierId ? `/api/settings/suppliers/${editingSupplierId}` : '/api/settings/suppliers'
      const method = editingSupplierId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        showToast(`Lỗi: ${j.error || 'Không lưu được nhà cung cấp'}`)
        return
      }
      await loadAll()
      showToast(editingSupplierId ? 'Đã cập nhật nhà cung cấp' : 'Đã thêm nhà cung cấp')
      resetSupplierEditor()
    } finally {
      setSavingSupplier(false)
    }
  }

  async function toggleSupplier(id: string, isActive: boolean) {
    const res = await fetch(`/api/settings/suppliers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showToast(`Lỗi: ${j.error || 'Không cập nhật được trạng thái NCC'}`)
      return
    }
    await loadAll()
  }

  function beginEditPrice(p: SupplierPrice) {
    setEditingPriceId(p.id)
    setPriceForm({
      supplier_id: p.supplier_id || '',
      material_key: p.material_key || '',
      material_name: p.material_name || '',
      unit: p.unit || 'kg',
      region_code: p.region_code || 'ALL',
      price_per_unit: p.price_per_unit != null ? String(p.price_per_unit) : '',
      currency: p.currency || 'VND',
      min_order_qty: p.min_order_qty != null ? String(p.min_order_qty) : '',
      valid_from: toDatetimeLocalValue(p.valid_from),
      valid_to: toDatetimeLocalValue(p.valid_to),
      source_note: p.source_note || '',
    })
  }

  function resetPriceEditor() {
    setEditingPriceId(null)
    setPriceForm(emptyPriceForm())
  }

  async function savePrice() {
    if (!priceForm.supplier_id || !priceForm.material_key.trim() || !priceForm.price_per_unit.trim()) {
      showToast('Thiếu nhà cung cấp, vật tư hoặc đơn giá')
      return
    }
    const unitPrice = Number(priceForm.price_per_unit)
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      showToast('Đơn giá phải lớn hơn 0')
      return
    }

    setSavingPrice(true)
    try {
      const payload = {
        supplier_id: priceForm.supplier_id,
        material_key: priceForm.material_key.trim(),
        material_name: priceForm.material_name.trim() || null,
        unit: priceForm.unit.trim() || null,
        region_code: priceForm.region_code.trim() || null,
        price_per_unit: unitPrice,
        currency: priceForm.currency.trim() || 'VND',
        min_order_qty: priceForm.min_order_qty.trim() ? Number(priceForm.min_order_qty) : null,
        valid_from: toApiDateTime(priceForm.valid_from),
        valid_to: toApiDateTime(priceForm.valid_to),
        source_note: priceForm.source_note.trim() || null,
      }
      const url = editingPriceId ? `/api/settings/supplier-prices/${editingPriceId}` : '/api/settings/supplier-prices'
      const method = editingPriceId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        showToast(`Lỗi: ${j.error || 'Không lưu được giá NCC'}`)
        return
      }
      await loadAll()
      showToast(editingPriceId ? 'Đã cập nhật giá vật tư' : 'Đã thêm giá vật tư')
      resetPriceEditor()
    } finally {
      setSavingPrice(false)
    }
  }

  async function togglePrice(id: string, isActive: boolean) {
    const res = await fetch(`/api/settings/supplier-prices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showToast(`Lỗi: ${j.error || 'Không cập nhật được trạng thái giá'}`)
      return
    }
    await loadAll()
  }

  const supplierOptions = suppliers

  if (loading) return <div className="fade-up">Đang tải dữ liệu nhà cung cấp...</div>

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text3)', marginBottom: 4 }}>SUPPLIER PRICING</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Nhà cung cấp & bảng giá vật tư</h1>
      </div>

      {toast && <div style={{ marginBottom: 12, color: 'var(--green)' }}>{toast}</div>}

      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Hồ sơ nhà cung cấp</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mã NCC</div>
            <input className="input" value={supplierForm.supplier_code} onChange={(e) => setSupplierForm((p) => ({ ...p, supplier_code: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tên NCC</div>
            <input className="input" value={supplierForm.supplier_name} onChange={(e) => setSupplierForm((p) => ({ ...p, supplier_name: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Loại NCC</div>
            <select className="select" value={supplierForm.supplier_type} onChange={(e) => setSupplierForm((p) => ({ ...p, supplier_type: e.target.value }))}>
              {SUPPLIER_TYPE_OPTIONS.map((x) => (
                <option key={x.value} value={x.value}>{x.label}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Vùng phục vụ</div>
            <select className="select" value={supplierForm.region_code} onChange={(e) => setSupplierForm((p) => ({ ...p, region_code: e.target.value }))}>
              {regionOptionsFor(supplierForm.region_code).map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} - {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Người liên hệ</div>
            <input className="input" value={supplierForm.contact_name} onChange={(e) => setSupplierForm((p) => ({ ...p, contact_name: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>SĐT chính</div>
            <input className="input" value={supplierForm.primary_phone} onChange={(e) => setSupplierForm((p) => ({ ...p, primary_phone: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>SĐT phụ</div>
            <input className="input" value={supplierForm.secondary_phone} onChange={(e) => setSupplierForm((p) => ({ ...p, secondary_phone: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Zalo</div>
            <input className="input" value={supplierForm.zalo_phone} onChange={(e) => setSupplierForm((p) => ({ ...p, zalo_phone: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Email liên hệ</div>
            <input className="input" value={supplierForm.contact_email} onChange={(e) => setSupplierForm((p) => ({ ...p, contact_email: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tên pháp lý</div>
            <input className="input" value={supplierForm.legal_name} onChange={(e) => setSupplierForm((p) => ({ ...p, legal_name: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mã số thuế</div>
            <input className="input" value={supplierForm.tax_code} onChange={(e) => setSupplierForm((p) => ({ ...p, tax_code: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Số GPKD</div>
            <input className="input" value={supplierForm.business_license_no} onChange={(e) => setSupplierForm((p) => ({ ...p, business_license_no: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Điều khoản công nợ (ngày)</div>
            <input className="input" value={supplierForm.payment_terms_days} onChange={(e) => setSupplierForm((p) => ({ ...p, payment_terms_days: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Hạn mức công nợ</div>
            <input className="input" value={supplierForm.credit_limit} onChange={(e) => setSupplierForm((p) => ({ ...p, credit_limit: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Công nợ hiện tại</div>
            <input className="input" value={supplierForm.current_debt} onChange={(e) => setSupplierForm((p) => ({ ...p, current_debt: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Địa chỉ</div>
            <input className="input" value={supplierForm.address} onChange={(e) => setSupplierForm((p) => ({ ...p, address: e.target.value }))} />
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ghi chú</div>
          <textarea className="textarea" value={supplierForm.note} onChange={(e) => setSupplierForm((p) => ({ ...p, note: e.target.value }))} rows={2} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className="btn btn-primary" disabled={savingSupplier} onClick={saveSupplier}>
            {editingSupplierId ? 'Lưu cập nhật NCC' : '+ Tạo nhà cung cấp'}
          </button>
          {editingSupplierId && (
            <button className="btn btn-ghost" onClick={resetSupplierEditor}>Hủy sửa</button>
          )}
        </div>

        <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr 1fr .9fr 1fr 1fr auto auto', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontSize: 12 }}>
            <div>Mã NCC</div>
            <div>Tên NCC</div>
            <div>Loại</div>
            <div>Điện thoại</div>
            <div>Vùng</div>
            <div>Công nợ</div>
            <div>Term (ngày)</div>
            <div />
            <div />
          </div>
          {suppliers.map((s) => (
            <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr 1fr .9fr 1fr 1fr auto auto', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <div style={{ color: 'var(--blue)' }}>{s.supplier_code}</div>
              <div>{s.supplier_name}</div>
              <div style={{ color: 'var(--text3)' }}>{s.profile?.supplier_type || '-'}</div>
              <div style={{ color: 'var(--text3)' }}>{s.phone_display || '-'}</div>
              <div style={{ color: 'var(--text3)' }}>{s.region_code || '-'}</div>
              <div style={{ color: s.profile?.current_debt ? 'var(--orange)' : 'var(--text3)' }}>
                {s.profile?.current_debt ? `${Number(s.profile.current_debt).toLocaleString('vi-VN')}đ` : '-'}
              </div>
              <div style={{ color: 'var(--text3)' }}>{s.profile?.payment_terms_days != null ? s.profile.payment_terms_days : '-'}</div>
              <button className="btn btn-ghost" onClick={() => beginEditSupplier(s)}>Sửa</button>
              <button className="btn btn-ghost" onClick={() => toggleSupplier(s.id, s.is_active)}>{s.is_active ? 'Tắt' : 'Bật'}</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Bảng giá vật tư theo NCC</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr .7fr .8fr .8fr .8fr .9fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Nhà cung cấp</div>
            <select className="select" value={priceForm.supplier_id} onChange={(e) => setPriceForm((p) => ({ ...p, supplier_id: e.target.value }))}>
              <option value="">Chọn NCC</option>
              {supplierOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.supplier_name} ({s.supplier_code}){s.is_active ? '' : ' [đang tắt]'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mã vật tư</div>
            <input
              className="input"
              list="material-options"
              value={priceForm.material_key}
              onChange={(e) => {
                const key = e.target.value
                const found = materials.find((x) => x.material_key === key)
                setPriceForm((p) => ({
                  ...p,
                  material_key: key,
                  material_name: found?.material_name || p.material_name,
                  unit: found?.unit || p.unit,
                }))
              }}
            />
            <datalist id="material-options">
              {materials.map((m) => (
                <option key={m.material_key} value={m.material_key} />
              ))}
            </datalist>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tên vật tư</div>
            <input className="input" value={priceForm.material_name} onChange={(e) => setPriceForm((p) => ({ ...p, material_name: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đơn vị</div>
            <input className="input" value={priceForm.unit} onChange={(e) => setPriceForm((p) => ({ ...p, unit: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Vùng</div>
            <select className="select" value={priceForm.region_code} onChange={(e) => setPriceForm((p) => ({ ...p, region_code: e.target.value }))}>
              {regionOptionsFor(priceForm.region_code).map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} - {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đơn giá</div>
            <input className="input" value={priceForm.price_per_unit} onChange={(e) => setPriceForm((p) => ({ ...p, price_per_unit: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tiền tệ</div>
            <input className="input" value={priceForm.currency} onChange={(e) => setPriceForm((p) => ({ ...p, currency: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Min SL</div>
            <input className="input" value={priceForm.min_order_qty} onChange={(e) => setPriceForm((p) => ({ ...p, min_order_qty: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Hiệu lực từ</div>
            <input className="input" type="datetime-local" value={priceForm.valid_from} onChange={(e) => setPriceForm((p) => ({ ...p, valid_from: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Hiệu lực đến</div>
            <input className="input" type="datetime-local" value={priceForm.valid_to} onChange={(e) => setPriceForm((p) => ({ ...p, valid_to: e.target.value }))} />
          </div>
          <button className="btn btn-primary" disabled={savingPrice} onClick={savePrice}>
            {editingPriceId ? 'Lưu giá' : '+ Thêm giá'}
          </button>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ghi chú nguồn giá</div>
          <textarea className="textarea" value={priceForm.source_note} onChange={(e) => setPriceForm((p) => ({ ...p, source_note: e.target.value }))} rows={2} />
          {editingPriceId && (
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={resetPriceEditor}>Hủy sửa giá</button>
            </div>
          )}
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {/* Header: Đồng bộ Grid 10 cột */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1.1fr .8fr .9fr .7fr .7fr 1fr 1fr 140px',
            gap: 8,
            padding: '10px 12px',
            background: 'var(--bg2, rgba(0,0,0,0.04))',
            borderBottom: '1px solid var(--border)',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>NHÀ CUNG CẤP</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>VẬT TƯ</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>VÙNG</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'right' }}>ĐƠN GIÁ</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>ĐV</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>MIN</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>HIỆU LỰC TỪ</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>ĐẾN</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>THAO TÁC</div>
          </div>

          {/* Body */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {prices.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1.1fr .8fr .9fr .7fr .7fr 1fr 1fr 140px',
                  gap: 8,
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                  opacity: p.is_active ? 1 : 0.5,
                  background: p.is_active ? 'transparent' : 'var(--bg-dim)'
                }}
              >
                {/* Nhà cung cấp - Xử lý tên dài */}
                <div style={{
                  fontSize: 12,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0
                }} title={p.supplier?.supplier_name || p.supplier_id}>
                  {p.supplier?.supplier_name || supplierMap.get(p.supplier_id)?.supplier_name || p.supplier_id}
                </div>

                {/* Vật tư - Font Mono cho Key */}
                <div style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: 'var(--blue)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0
                }}>
                  {p.material_key}
                </div>

                {/* Vùng */}
                <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
                  <span style={{ background: 'var(--bg3)', padding: '1px 4px', borderRadius: 4 }}>{p.region_code || 'ALL'}</span>
                </div>

                {/* Đơn giá - Căn phải cho số */}
                <div style={{ color: 'var(--green)', fontWeight: 700, fontSize: 12, textAlign: 'right' }}>
                  {Number(p.price_per_unit || 0).toLocaleString('vi-VN')}đ
                </div>

                {/* Đơn vị & Min SL */}
                <div style={{ fontSize: 11, textAlign: 'center' }}>{p.unit || '-'}</div>
                <div style={{ fontSize: 11, textAlign: 'center' }}>{p.min_order_qty ?? '-'}</div>

                {/* Ngày tháng - Rút gọn để không chiếm chỗ */}
                <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.2 }}>
                  {p.valid_from ? new Date(p.valid_from).toLocaleDateString('vi-VN') : '-'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.2 }}>
                  {p.valid_to ? new Date(p.valid_to).toLocaleDateString('vi-VN') : '-'}
                </div>

                {/* Nút thao tác */}
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                  <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: 11 }} onClick={() => beginEditPrice(p)}>
                    Sửa
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{
                      height: 26,
                      padding: '0 8px',
                      fontSize: 11,
                      color: p.is_active ? 'var(--orange)' : 'var(--blue)'
                    }}
                    onClick={() => togglePrice(p.id, p.is_active)}
                  >
                    {p.is_active ? 'Tắt' : 'Bật'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
