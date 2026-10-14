'use client'

import Link from 'next/link'
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

type Subcontractor = {
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

type RegionOption = {
  code: string
  name: string
}

type FormState = {
  supplier_code: string
  supplier_name: string
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

function emptyForm(): FormState {
  return {
    supplier_code: '',
    supplier_name: '',
    contact_name: '',
    primary_phone: '',
    secondary_phone: '',
    zalo_phone: '',
    contact_email: '',
    legal_name: '',
    tax_code: '',
    business_license_no: '',
    region_code: '',
    address: '',
    payment_terms_days: '0',
    credit_limit: '',
    current_debt: '',
    note: '',
  }
}

function formatMoney(v?: number | null) {
  const n = Number(v || 0)
  if (!Number.isFinite(n) || n === 0) return '0 vnd'
  return `${n.toLocaleString('vi-VN')} vnd`
}

function slugifyCode(name: string) {
  const raw = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return raw ? `TP-${raw}`.slice(0, 40) : ''
}

export default function SubcontractorsPage() {
  const [rows, setRows] = useState<Subcontractor[]>([])
  const [regions, setRegions] = useState<RegionOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [toast, setToast] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm())
  const [codeTouched, setCodeTouched] = useState(false)

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(''), 2200)
  }

  async function loadData() {
    setLoading(true)
    try {
      const [res, regionRes] = await Promise.all([
        fetch('/api/subcontractors?active_only=false', { cache: 'no-store' }),
        fetch('/api/settings/regions?active_only=true&level=province&limit=500', { cache: 'no-store' }),
      ])
      const json = await res.json().catch(() => ({}))
      const regionJson = await regionRes.json().catch(() => ({}))
      setRows(Array.isArray(json.data) ? json.data : [])
      setRegions(Array.isArray(regionJson.data) ? regionJson.data.map((x: any) => ({ code: String(x.code || ''), name: String(x.name || x.code || '') })) : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (editingId || codeTouched) return
    const nextCode = slugifyCode(form.supplier_name)
    setForm((prev) => (prev.supplier_code === nextCode ? prev : { ...prev, supplier_code: nextCode }))
  }, [form.supplier_name, editingId, codeTouched])

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter === 'active' && !row.is_active) return false
      if (statusFilter === 'inactive' && row.is_active) return false
      if (!q) return true
      const haystack = [
        row.supplier_code,
        row.supplier_name,
        row.contact_name,
        row.phone,
        row.phone_display,
        row.profile?.primary_phone,
        row.profile?.tax_code,
        row.profile?.legal_name,
      ].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [rows, query, statusFilter])

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm())
    setCodeTouched(false)
    setShowForm(true)
  }

  function beginEdit(row: Subcontractor) {
    setEditingId(row.id)
    setCodeTouched(true)
    setShowForm(true)
    setForm({
      supplier_code: row.supplier_code || '',
      supplier_name: row.supplier_name || '',
      contact_name: row.contact_name || '',
      primary_phone: row.profile?.primary_phone || row.phone || '',
      secondary_phone: row.profile?.secondary_phone || '',
      zalo_phone: row.profile?.zalo_phone || '',
      contact_email: row.profile?.contact_email || row.email || '',
      legal_name: row.profile?.legal_name || '',
      tax_code: row.profile?.tax_code || '',
      business_license_no: row.profile?.business_license_no || '',
      region_code: row.region_code || '',
      address: row.address || '',
      payment_terms_days: row.profile?.payment_terms_days != null ? String(row.profile.payment_terms_days) : '0',
      credit_limit: row.profile?.credit_limit != null ? String(row.profile.credit_limit) : '',
      current_debt: row.profile?.current_debt != null ? String(row.profile.current_debt) : '',
      note: row.note || row.profile?.note || '',
    })
  }

  async function saveForm() {
    if (!form.supplier_name.trim()) {
      showToast('Thiếu tên thầu phụ')
      return
    }
    if (!form.supplier_code.trim()) {
      showToast('Thiếu mã thầu phụ')
      return
    }

    setSaving(true)
    try {
      const payload = {
        supplier_code: form.supplier_code.trim(),
        supplier_name: form.supplier_name.trim(),
        contact_name: form.contact_name.trim() || null,
        primary_phone: form.primary_phone.trim() || null,
        secondary_phone: form.secondary_phone.trim() || null,
        zalo_phone: form.zalo_phone.trim() || null,
        contact_email: form.contact_email.trim() || null,
        legal_name: form.legal_name.trim() || null,
        tax_code: form.tax_code.trim() || null,
        business_license_no: form.business_license_no.trim() || null,
        region_code: form.region_code.trim() || null,
        address: form.address.trim() || null,
        payment_terms_days: form.payment_terms_days.trim() ? Number(form.payment_terms_days) : 0,
        credit_limit: form.credit_limit.trim() ? Number(form.credit_limit) : null,
        current_debt: form.current_debt.trim() ? Number(form.current_debt) : null,
        note: form.note.trim() || null,
        profile_note: form.note.trim() || null,
        phone: form.primary_phone.trim() || null,
        email: form.contact_email.trim() || null,
      }

      const url = editingId ? `/api/subcontractors/${editingId}` : '/api/subcontractors'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(`Lỗi: ${json.error || 'Không lưu được thầu phụ'}`)
        return
      }
      await loadData()
      showToast(editingId ? 'Đã cập nhật thầu phụ' : 'Đã tạo thầu phụ')
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(row: Subcontractor) {
    const res = await fetch(`/api/subcontractors/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !row.is_active }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(`Lỗi: ${json.error || 'Không cập nhật được trạng thái'}`)
      return
    }
    await loadData()
  }

  async function removeRow(row: Subcontractor) {
    if (!window.confirm(`Xóa thầu phụ "${row.supplier_name}"?`)) return
    const res = await fetch(`/api/subcontractors/${row.id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(`Lỗi: ${json.error || 'Không xóa được thầu phụ'}`)
      return
    }
    await loadData()
    if (editingId === row.id) resetForm()
    showToast('Đã xóa thầu phụ')
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>DU AN / THAU PHU</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Quản lý thầu phụ</h1>
        <div style={{ color: 'var(--text3)', marginTop: 6 }}>
          Quản lý danh sách thầu phụ, tổ đội thi công và thông tin liên hệ cơ bản để sau này nối tiếp sang dự án, giao việc và công nợ.
        </div>
        <div style={{ marginTop: 10 }}>
          <Link className="btn" href="/subcontractors/reports">Mở báo cáo thầu phụ</Link>
        </div>
      </div>

      {toast ? (
        <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#bbf7d0' }}>
          {toast}
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: showForm ? 12 : 0 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{editingId ? 'Sửa thầu phụ' : 'Tạo thầu phụ mới'}</div>
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>Form tạo và form sửa dùng chung để thao tác gọn hơn.</div>
          </div>
          <button className="btn" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Ẩn form' : 'Hiện form'}
          </button>
        </div>

        {showForm ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Mã thầu phụ</div>
                <input className="input" value={form.supplier_code} onChange={(e) => { setCodeTouched(true); setForm((prev) => ({ ...prev, supplier_code: e.target.value })) }} placeholder="Tự sinh từ tên, cho phép sửa" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Tên thầu phụ</div>
                <input className="input" value={form.supplier_name} onChange={(e) => setForm((prev) => ({ ...prev, supplier_name: e.target.value }))} placeholder="VD: Tổ đội xây Anh Minh" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Người liên hệ</div>
                <input className="input" value={form.contact_name} onChange={(e) => setForm((prev) => ({ ...prev, contact_name: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Số điện thoại chính</div>
                <input className="input" value={form.primary_phone} onChange={(e) => setForm((prev) => ({ ...prev, primary_phone: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Số điện thoại phụ</div>
                <input className="input" value={form.secondary_phone} onChange={(e) => setForm((prev) => ({ ...prev, secondary_phone: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Zalo</div>
                <input className="input" value={form.zalo_phone} onChange={(e) => setForm((prev) => ({ ...prev, zalo_phone: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Email liên hệ</div>
                <input className="input" value={form.contact_email} onChange={(e) => setForm((prev) => ({ ...prev, contact_email: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Tên pháp lý</div>
                <input className="input" value={form.legal_name} onChange={(e) => setForm((prev) => ({ ...prev, legal_name: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Mã số thuế</div>
                <input className="input" value={form.tax_code} onChange={(e) => setForm((prev) => ({ ...prev, tax_code: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Số giấy phép / GPKD</div>
                <input className="input" value={form.business_license_no} onChange={(e) => setForm((prev) => ({ ...prev, business_license_no: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Vùng</div>
                <select className="select" value={form.region_code} onChange={(e) => setForm((prev) => ({ ...prev, region_code: e.target.value }))}>
                  <option value="">(Không chọn vùng)</option>
                  {regions.map((row) => <option key={row.code} value={row.code}>{row.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Hạn thanh toán mặc định (ngày)</div>
                <input className="input" type="number" value={form.payment_terms_days} onChange={(e) => setForm((prev) => ({ ...prev, payment_terms_days: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Hạn mức công nợ</div>
                <input className="input" value={form.credit_limit} onChange={(e) => setForm((prev) => ({ ...prev, credit_limit: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Công nợ hiện tại</div>
                <input className="input" value={form.current_debt} onChange={(e) => setForm((prev) => ({ ...prev, current_debt: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Địa chỉ</div>
                <input className="input" value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Ghi chú phạm vi thi công / lưu ý</div>
                <textarea className="input" rows={4} value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
              {editingId ? <button className="btn" onClick={resetForm}>Tạo mới lại</button> : null}
              <button className="btn btn-primary" onClick={saveForm} disabled={saving}>
                {saving ? 'Đang lưu...' : editingId ? 'Lưu cập nhật' : '+ Tạo thầu phụ'}
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) 180px', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Tìm kiếm</div>
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mã, tên, người liên hệ, điện thoại, MST..." />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Trạng thái</div>
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}>
              <option value="all">Tất cả</option>
              <option value="active">Đang dùng</option>
              <option value="inactive">Ngưng dùng</option>
            </select>
          </div>
        </div>

        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
          Tổng: <b>{filteredRows.length}</b> thầu phụ
        </div>

        {loading ? <div style={{ color: 'var(--text3)' }}>Đang tải dữ liệu...</div> : null}

        {!loading && !filteredRows.length ? (
          <div style={{ color: 'var(--text3)' }}>Chưa có thầu phụ nào phù hợp bộ lọc.</div>
        ) : null}

        <div style={{ display: 'grid', gap: 12 }}>
          {filteredRows.map((row) => (
            <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{row.supplier_name}</div>
                    <span className="chip">{row.supplier_code}</span>
                    <span className="chip" style={{ color: row.is_active ? 'var(--green)' : 'var(--text3)' }}>
                      {row.is_active ? 'Đang dùng' : 'Ngưng dùng'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, color: 'var(--text2)', fontSize: 14 }}>
                    <div>Người liên hệ: <b>{row.contact_name || '-'}</b></div>
                    <div>Điện thoại: <b>{row.phone_display || '-'}</b></div>
                    <div>Email: <b>{row.profile?.contact_email || row.email || '-'}</b></div>
                    <div>Vùng: <b>{row.region_code || '-'}</b></div>
                    <div>Công nợ hiện tại: <b>{formatMoney(row.profile?.current_debt)}</b></div>
                    <div>Hạn mức công nợ: <b>{formatMoney(row.profile?.credit_limit)}</b></div>
                  </div>
                  {row.note ? <div style={{ marginTop: 8, color: 'var(--text3)' }}>{row.note}</div> : null}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => beginEdit(row)}>Sửa</button>
                  <button className="btn" onClick={() => toggleStatus(row)}>{row.is_active ? 'Ngưng dùng' : 'Bật lại'}</button>
                  <button className="btn" style={{ color: 'var(--red)', borderColor: 'rgba(239,68,68,0.35)' }} onClick={() => removeRow(row)}>Xóa</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
