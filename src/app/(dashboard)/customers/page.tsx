'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const PIPELINE = ['Mới', 'Đang tìm hiểu', 'Hẹn gặp', 'Đang thương thảo', 'Chờ ký HĐ', 'Đã ký HĐ', 'Đang thi công', 'Hoàn công', 'Bảo hành', 'Hoàn tất', 'Tạm ngưng', 'Từ chối']
const GROUPS = [
  { key: 'pre', label: 'Tiếp cận', statuses: ['Mới', 'Đang tìm hiểu', 'Hẹn gặp', 'Đang thương thảo'] },
  { key: 'contract', label: 'Hợp đồng', statuses: ['Chờ ký HĐ', 'Đã ký HĐ', 'Đang thi công'] },
  { key: 'after', label: 'Hậu mãi', statuses: ['Hoàn công', 'Bảo hành', 'Hoàn tất'] },
  { key: 'other', label: 'Khác', statuses: ['Tạm ngưng', 'Từ chối'] },
] as const
const STATUS_COLOR: Record<string, string> = { 'Mới': '#378ADD', 'Đang tìm hiểu': '#8B5CF6', 'Hẹn gặp': '#F59E0B', 'Đang thương thảo': '#F97316', 'Chờ ký HĐ': '#EF4444', 'Đã ký HĐ': '#22C55E', 'Đang thi công': '#10B981', 'Hoàn công': '#06B6D4', 'Bảo hành': '#6366F1', 'Hoàn tất': '#1D9E75', 'Tạm ngưng': '#64748B', 'Từ chối': '#475569' }
const POTENTIAL_COLOR: Record<string, string> = { cao: '#22C55E', trung: '#F59E0B', thấp: '#EF4444' }
const SOURCE_ICON: Record<string, string> = { telegram: 'TG', zalo: 'ZL', messenger: 'FB', call: 'CL', referral: 'RF', google: 'GG', other: 'OT' }
const EMPTY_FORM = { full_name: '', phone_number: '', status: 'Mới', type: 'unverified', potential_score: '', source: '', zalo_username: '', facebook: '' }

function fmtBudget(min?: number | bigint | null, max?: number | bigint | null) {
  if (!min && !max) return ''
  const fmt = (v: number | bigint) => {
    const n = Number(v)
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}tr`
    return n.toLocaleString('vi-VN')
  }
  if (min && max) return `${fmt(min)} - ${fmt(max)}`
  if (min) return `từ ${fmt(min)}`
  return `đến ${fmt(max as number | bigint)}`
}

function fmtDate(v?: string | null) {
  return v ? new Date(v).toLocaleDateString('vi-VN') : '—'
}

function CustomerModal({ open, mode, form, saving, error, onClose, onChange, onSubmit }: any) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 9998 }}>
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 640, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)' }}>{mode === 'create' ? 'Tạo khách hàng' : 'Sửa khách hàng'}</h2>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4 }}>`source`, `zalo`, `facebook` có thể để trống.</div>
          </div>
          <button type="button" onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--color-border-tertiary)', background: 'transparent', cursor: 'pointer' }}>×</button>
        </div>
        <form onSubmit={onSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label className="label">Số điện thoại *</label><input className="input" required value={form.phone_number} onChange={(e) => onChange('phone_number', e.target.value)} /></div>
            <div><label className="label">Họ và tên</label><input className="input" value={form.full_name} onChange={(e) => onChange('full_name', e.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label className="label">Trạng thái</label><select className="select" value={form.status} onChange={(e) => onChange('status', e.target.value)}>{PIPELINE.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className="label">Potential Score (1-10)</label><input className="input" type="number" min="1" max="10" value={form.potential_score} onChange={(e) => onChange('potential_score', e.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label className="label">Loại xác thực</label>
              <select className="select" value={form.type} onChange={(e) => onChange('type', e.target.value)}>
                <option value="unverified">unverified</option>
                <option value="verified">verified</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label className="label">Zalo</label><input className="input" value={form.zalo_username} onChange={(e) => onChange('zalo_username', e.target.value)} /></div>
            <div><label className="label">Facebook</label><input className="input" value={form.facebook} onChange={(e) => onChange('facebook', e.target.value)} /></div>
            <div><label className="label">Source</label><select className="select" value={form.source} onChange={(e) => onChange('source', e.target.value)}><option value="">Không chọn</option><option value="call">call</option><option value="zalo">zalo</option><option value="messenger">messenger</option><option value="telegram">telegram</option><option value="referral">referral</option><option value="google">google</option><option value="other">other</option></select></div>
          </div>
          {error && <div style={{ marginBottom: 16, padding: '10px 12px', background: '#EF444415', border: '1px solid #EF444430', borderRadius: 8, color: '#DC2626', fontSize: 13 }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : mode === 'create' ? 'Tạo khách hàng' : 'Lưu thay đổi'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Card({ c, onEdit, onDelete, onOpen }: any) {
  const color = STATUS_COLOR[c.status] || '#64748B'
  const budget = fmtBudget(c.budget_min, c.budget_max)
  const potColor = c.potential_level ? POTENTIAL_COLOR[c.potential_level] : 'var(--color-text-tertiary)'
  const nick = c.telegram_username || c.zalo_username || c.messenger_username
  return (
    <div style={{ background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-tertiary)', borderLeft: `3px solid ${color}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
      <button type="button" onClick={() => onOpen(c.id)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>{c.full_name || <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Chưa có tên</span>}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6, fontFamily: 'monospace' }}>{c.phone_number || (nick ? `@${nick}` : '—')}</div>
      </button>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, background: c.type === 'verified' ? 'rgba(34,197,94,.12)' : 'rgba(100,116,139,.12)', color: c.type === 'verified' ? 'var(--green)' : 'var(--text3)', padding: '1px 6px', borderRadius: 4 }}>
          {c.type || 'unverified'}
        </span>
        {c.source && <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{SOURCE_ICON[c.source] || 'OT'} {c.source}</span>}
        {c.house_type && <span style={{ fontSize: 10, background: 'var(--color-background-tertiary)', color: 'var(--color-text-secondary)', padding: '1px 6px', borderRadius: 4 }}>{c.house_type}</span>}
        {budget && <span style={{ fontSize: 10, color: '#F59E0B', fontWeight: 700 }}>{budget}</span>}
        {c.potential_score && <span style={{ fontSize: 10, fontWeight: 700, color: potColor, marginLeft: 'auto' }}>{c.potential_score}/10</span>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn-ghost" style={{ flex: 1, padding: '6px 10px' }} onClick={() => onEdit(c)}>Sửa</button>
        <button type="button" onClick={() => onDelete(c)} style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer', fontWeight: 700 }}>Xóa</button>
      </div>
    </div>
  )
}

export default function CustomersPage() {
  const router = useRouter()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [customers, setCustomers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debSearch, setDebSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterHouse, setFilterHouse] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [toast, setToast] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const limit = 30

  useEffect(() => {
    const timer = setTimeout(() => setDebSearch(search), 350)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    const q = new URLSearchParams({ view, limit: String(view === 'kanban' ? 200 : limit), page: String(page) })
    if (debSearch) q.set('search', debSearch)
    if (filterStatus) q.set('status', filterStatus)
    if (filterSource) q.set('source', filterSource)
    if (filterType) q.set('type', filterType)
    if (filterLevel) q.set('potential_level', filterLevel)
    if (filterHouse) q.set('house_type', filterHouse)
    if (view === 'list') { q.set('sort', sortKey); q.set('dir', sortDir) }
    const r = await fetch(`/api/customers?${q}`)
    const j = await r.json()
    setCustomers(j.data || [])
    setTotal(j.total || 0)
    setLoading(false)
  }, [view, page, debSearch, filterStatus, filterSource, filterType, filterLevel, filterHouse, sortKey, sortDir])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [view, debSearch, filterStatus, filterSource, filterType, filterLevel, filterHouse])

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  function openCreateModal() {
    setModalMode('create')
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(customer: any) {
    setModalMode('edit')
    setEditingId(customer.id)
    setForm({ full_name: customer.full_name || '', phone_number: customer.phone_number || '', status: customer.status || 'Mới', type: customer.type || 'unverified', potential_score: customer.potential_score ? String(customer.potential_score) : '', source: customer.source || '', zalo_username: customer.zalo_username || '', facebook: customer.messenger_username || '' })
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (!saving) setModalOpen(false)
  }

  function updateForm(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const payload = {
      phone_number: form.phone_number,
      full_name: form.full_name,
      status: form.status,
      type: form.type,
      potential_score: form.potential_score ? Number(form.potential_score) : null,
      source: form.source,
      zalo_username: form.zalo_username,
      facebook: form.facebook,
      messenger_username: form.facebook,
    }
    const endpoint = modalMode === 'create' ? '/api/customers' : `/api/customers/${editingId}`
    const method = modalMode === 'create' ? 'POST' : 'PUT'
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) {
      setFormError(json.error || 'Có lỗi xảy ra')
      setSaving(false)
      return
    }
    setSaving(false)
    setModalOpen(false)
    showToast(modalMode === 'create' ? 'Đã tạo khách hàng' : 'Đã cập nhật khách hàng')
    await load()
    if (modalMode === 'create' && json.data?.id) router.push(`/customers/${json.data.id}`)
  }

  async function quickStatus(id: string, status: string) {
    await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    showToast(`Đã đổi trạng thái sang ${status}`)
    load()
  }

  async function deleteCustomer(customer: any) {
    const ok = window.confirm(`Xóa khách hàng "${customer.full_name || customer.phone_number || 'không tên'}"?`)
    if (!ok) return
    const res = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      showToast(json?.error || 'Không thể xóa khách hàng')
      return
    }
    showToast('Đã xóa khách hàng')
    load()
  }

  const kanbanCols = useMemo(() => (
    PIPELINE.map((status) => ({
      status,
      color: STATUS_COLOR[status] || '#64748B',
      items: customers.filter((c) => c.status === status),
    })).filter((col) => col.items.length > 0 || !filterStatus)
  ), [customers, filterStatus])

  const sections = useMemo(() => (
    GROUPS.map((group) => ({
      ...group,
      columns: group.statuses.map((status) => kanbanCols.find((col) => col.status === status)).filter(Boolean),
    })).filter((group) => group.columns.length > 0)
  ), [kanbanCols])

  const hasFilter = debSearch || filterStatus || filterSource || filterType || filterLevel || filterHouse

  return (
    <div className="fade-up" style={{ height: '100%' }}>
      <CustomerModal open={modalOpen} mode={modalMode} form={form} saving={saving} error={formError} onClose={closeModal} onChange={updateForm} onSubmit={submitForm} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 2 }}>Khách hàng</h1>
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{total.toLocaleString('vi-VN')} khách hàng</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/customers/workboard"><button className="btn-ghost">Workboard</button></Link>
          <div style={{ display: 'flex', background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden' }}>
            {(['kanban', 'list'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '7px 16px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: view === v ? 'var(--color-background-info)' : 'transparent', color: view === v ? 'var(--color-text-info)' : 'var(--color-text-secondary)' }}>
                {v === 'kanban' ? 'Kanban' : 'Danh sách'}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={openCreateModal}>+ Thêm khách hàng</button>
          <Link href="/customers/create"><button className="btn-ghost">Form riêng</button></Link>
        </div>
      </div>

      <div className="card" style={{ padding: '12px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 260 }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tên, SĐT, @username..." style={{ width: '100%', background: 'var(--color-background-tertiary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 7, padding: '7px 30px 7px 10px', color: 'var(--color-text-primary)', fontSize: 13 }} />
            {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>}
          </div>
          <select className="select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{PIPELINE.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <select className="select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Loại xác thực</option>
            <option value="unverified">unverified</option>
            <option value="verified">verified</option>
          </select>
          <select className="select" value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}><option value="">Tiềm năng</option><option value="cao">Cao</option><option value="trung">Trung</option><option value="thấp">Thấp</option></select>
          <select className="select" value={filterSource} onChange={(e) => setFilterSource(e.target.value)}><option value="">Nguồn khách</option>{Object.keys(SOURCE_ICON).map((k) => <option key={k} value={k}>{k}</option>)}</select>
          <select className="select" value={filterHouse} onChange={(e) => setFilterHouse(e.target.value)}><option value="">Loại nhà</option>{['Nhà phố', 'Biệt thự', 'Nhà cấp 4', 'Chung cư', 'Khác'].map((h) => <option key={h} value={h}>{h}</option>)}</select>
          {hasFilter && <button className="btn-ghost" onClick={() => { setSearch(''); setFilterStatus(''); setFilterSource(''); setFilterType(''); setFilterLevel(''); setFilterHouse('') }}>Xóa lọc</button>}
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>{total} kết quả</span>
        </div>
      </div>

      {view === 'kanban' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 16 }}>
          {loading ? (
            <div style={{ padding: 48, color: 'var(--color-text-tertiary)', fontSize: 13 }}>Đang tải...</div>
          ) : sections.map((group) => (
            <div key={group.key} className="card" style={{ padding: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>{group.label}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>{group.columns.reduce((sum, col) => sum + (col?.items.length || 0), 0)} khách hàng</div>
              </div>
              <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
                <div style={{ display: 'flex', gap: 12, minWidth: 'max-content', alignItems: 'flex-start' }}>
                  {group.columns.map((col) => {
                    if (!col) return null
                    return (
                      <div key={col.status} style={{ width: 260, flexShrink: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '6px 8px', background: `${col.color}12`, borderRadius: 8, borderTop: `3px solid ${col.color}` }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: col.color }}>{col.status}</span>
                          <span style={{ fontSize: 11, background: `${col.color}25`, color: col.color, padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>{col.items.length}</span>
                        </div>
                        <div style={{ minHeight: 80 }}>
                          {col.items.map((c) => <Card key={c.id} c={c} onEdit={openEditModal} onDelete={deleteCustomer} onOpen={(id: string) => router.push(`/customers/${id}`)} />)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
          {!loading && sections.length === 0 && <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>{hasFilter ? 'Không tìm thấy kết quả' : 'Chưa có khách hàng'}</div>}
        </div>
      )}

      {view === 'list' && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-background-secondary)' }}>
                {[
                  { key: 'full_name', label: 'Khách hàng' },
                  { key: 'status', label: 'Trạng thái' },
                  { key: 'potential_score', label: 'Tiềm năng' },
                  { key: 'house_type', label: 'Nhu cầu' },
                  { key: 'source', label: 'Nguồn' },
                  { key: 'created_at', label: 'Ngày tạo' },
                  { key: '', label: 'Thao tác' },
                ].map((h) => (
                  <th key={h.key || h.label} onClick={() => { if (!h.key) return; setSortKey(h.key); setSortDir((d) => (sortKey === h.key ? (d === 'desc' ? 'asc' : 'desc') : 'desc')) }} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, letterSpacing: '1.5px', color: 'var(--color-text-tertiary)', fontWeight: 700, borderBottom: '1px solid var(--color-border-tertiary)', cursor: h.key ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
                    {h.label} {h.key === sortKey && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>{hasFilter ? 'Không tìm thấy kết quả' : 'Chưa có khách hàng'}</td></tr>
              ) : customers.map((c, i) => {
                const color = STATUS_COLOR[c.status] || '#64748B'
                const potColor = c.potential_level ? POTENTIAL_COLOR[c.potential_level] : 'var(--color-text-tertiary)'
                const budget = fmtBudget(c.budget_min, c.budget_max)
                const nick = c.telegram_username || c.zalo_username || c.messenger_username
                return (
                  <tr key={c.id} style={{ borderBottom: i < customers.length - 1 ? '1px solid var(--color-border-tertiary)' : 'none' }} onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-background-secondary)' }} onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)', marginBottom: 2 }}>{c.full_name || <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Chưa có tên</span>}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{c.phone_number || (nick ? `@${nick}` : '—')}</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}><select value={c.status} onChange={(e) => quickStatus(c.id, e.target.value)} style={{ background: `${color}15`, color, border: `1px solid ${color}40`, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none' }}>{PIPELINE.map((s) => <option key={s} value={s}>{s}</option>)}</select></td>
                    <td style={{ padding: '12px 14px' }}>{c.potential_score ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 28, height: 28, borderRadius: '50%', background: `${potColor}15`, border: `1.5px solid ${potColor}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: potColor }}>{c.potential_score}</div>{c.potential_level && <span style={{ fontSize: 10, color: potColor, fontWeight: 600 }}>{c.potential_level}</span>}</div> : <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>—</span>}</td>
                    <td style={{ padding: '12px 14px' }}>{(c.house_type || budget) ? <div>{c.house_type && <div style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>{c.house_type}</div>}{budget && <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600 }}>{budget}</div>}</div> : <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>—</span>}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--color-text-secondary)' }}>{c.source ? `${SOURCE_ICON[c.source] || 'OT'} ${c.source}` : '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{fmtDate(c.created_at)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn-ghost" onClick={() => openEditModal(c)}>Sửa</button>
                        <button type="button" onClick={() => deleteCustomer(c)} style={{ borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer', fontWeight: 700, padding: '6px 12px' }}>Xóa</button>
                        <button type="button" className="btn-primary" onClick={() => router.push(`/customers/${c.id}`)}>Chi tiết</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {view === 'list' && total > limit && (
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--color-border-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{(page - 1) * limit + 1}-{Math.min(page * limit, total)} / {total}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[['«', 1], ['‹', page - 1], ['›', page + 1], ['»', Math.ceil(total / limit)]].map(([label, target]) => (
                  <button key={String(label)} onClick={() => setPage(Number(target))} disabled={(label === '«' || label === '‹') ? page === 1 : page * limit >= total} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--color-border-tertiary)', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 12, opacity: ((label === '«' || label === '‹') ? page === 1 : page * limit >= total) ? 0.4 : 1 }}>
                    {label}
                  </button>
                ))}
                <span style={{ padding: '5px 10px', fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{page}/{Math.ceil(total / limit)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--color-background-success)', color: 'var(--color-text-success)', border: '1px solid var(--color-border-success)', padding: '10px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600, zIndex: 9999 }}>{toast}</div>}
    </div>
  )
}
