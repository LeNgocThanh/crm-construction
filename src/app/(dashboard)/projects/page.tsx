'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'

type ProjectStatus = 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'paused' | 'cancelled'

type Project = {
  id: string
  customer_id: string
  project_name: string | null
  address: string | null
  house_type: string | null
  floors: number | null
  floor_area: number | null
  estimated_budget: number | null
  contract_value: number | null
  budget_baseline: number | null
  budget_current: number | null
  budget_allocated: number | null
  cost_committed: number | null
  cost_actual: number | null
  cash_on_hand: number | null
  receivable_planned_30d: number | null
  payable_planned_30d: number | null
  progress_planned_percent: number | null
  progress_actual_percent: number | null
  delay_days: number | null
  risk_level: string | null
  notes: string | null
  status: ProjectStatus
  stage: string | null
  start_date: string | null
  expected_end_date: string | null
  actual_end_date: string | null
  created_at: string
  updated_at: string
  customer: {
    id: string
    full_name: string | null
    phone_number: string
    status: string
  }
  latest_cashflow_warning?: string | null
  latest_cashflow_gap_30d?: number | null
  labor_finance_summary?: {
    planned_cost: number
    planned_qty: number
    actual_cost: number
    actual_qty: number
    paid_amount: number
    payable_amount: number
    planned_gap_amount: number
    cash_gap_for_payable: number
    warning_state: string
  } | null
}

type CustomerOption = {
  id: string
  full_name: string | null
  phone_number: string
  status: string
}

type FormState = {
  customer_id: string
  project_name: string
  house_type: string
  address: string
  floors: string
  floor_area: string
  estimated_budget: string
  contract_value: string
  budget_baseline: string
  notes: string
  stage: string
  start_date: string
  expected_end_date: string
  status: ProjectStatus
}

const HOUSE_TYPE_OPTIONS = ['nha_pho', 'biet_thu', 'nha_cap_4', 'chung_cu', 'van_phong', 'kho_xuong', 'khac']
const HOUSE_TYPE_LABEL: Record<string, string> = {
  nha_pho: 'Nhà phố',
  biet_thu: 'Biệt thự',
  nha_cap_4: 'Nhà cấp 4',
  chung_cu: 'Chung cư',
  van_phong: 'Văn phòng',
  kho_xuong: 'Kho xưởng',
  khac: 'Khác',
}

const STATUS_OPTIONS: ProjectStatus[] = ['draft', 'confirmed', 'in_progress', 'completed', 'paused', 'cancelled']
const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: 'Nháp',
  confirmed: 'Đã xác nhận',
  in_progress: 'Đang thi công',
  completed: 'Hoàn thành',
  paused: 'Tạm dừng',
  cancelled: 'Đã hủy',
}

const STAGE_OPTIONS = [
  'thiet_ke',
  'xin_phep',
  'mong',
  'tho',
  'hoan_thien',
  'ban_giao',
]
const STAGE_LABEL: Record<string, string> = {
  thiet_ke: 'Thiết kế',
  xin_phep: 'Xin phép',
  mong: 'Móng',
  tho: 'Thi công thô',
  hoan_thien: 'Hoàn thiện',
  ban_giao: 'Bàn giao',
}

const emptyForm = (): FormState => ({
  customer_id: '',
  project_name: '',
  house_type: '',
  address: '',
  floors: '',
  floor_area: '',
  estimated_budget: '',
  contract_value: '',
  budget_baseline: '',
  notes: '',
  stage: '',
  start_date: '',
  expected_end_date: '',
  status: 'draft',
})

function numOrNull(v: string) {
  const s = String(v || '').trim()
  if (!s) return null
  const n = Number(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function money(v: number | null | undefined) {
  if (v == null) return '-'
  return `${Number(v).toLocaleString('vi-VN')} đ`
}
function moneySigned(v: number | null | undefined) {
  const n = Number(v || 0)
  const sign = n >= 0 ? '+' : '-'
  return `${sign}${Math.abs(n).toLocaleString('vi-VN')} đ`
}

function laborCashStateLabel(state?: string | null) {
  switch (state) {
    case 'missing': return 'Thiếu tiền trả công'
    case 'tight': return 'Sắp thiếu tiền trả công'
    default: return 'Đủ tiền trả công'
  }
}

function d(v: string | null | undefined) {
  if (!v) return '-'
  try {
    return new Date(v).toLocaleDateString('vi-VN')
  } catch {
    return '-'
  }
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string>('')
  const [form, setForm] = useState<FormState>(emptyForm())
  const [q, setQ] = useState('')

  const editingProject = useMemo(() => projects.find((x) => x.id === editingId) || null, [projects, editingId])

  async function loadAll() {
    setLoading(true)
    const [pRes, cRes] = await Promise.all([
      fetch('/api/projects?limit=300'),
      fetch('/api/customers?limit=300'),
    ])
    const pJson = await pRes.json().catch(() => ({}))
    const cJson = await cRes.json().catch(() => ({}))
    setProjects(Array.isArray(pJson.data) ? pJson.data : [])
    setCustomers(Array.isArray(cJson.data) ? cJson.data : [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  function patchForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function mapProjectToForm(p: Project): FormState {
    return {
      customer_id: p.customer_id || '',
      project_name: p.project_name || '',
      house_type: p.house_type || '',
      address: p.address || '',
      floors: p.floors == null ? '' : String(p.floors),
      floor_area: p.floor_area == null ? '' : String(p.floor_area),
      estimated_budget: p.estimated_budget == null ? '' : String(p.estimated_budget),
      contract_value: p.contract_value == null ? '' : String(p.contract_value),
      budget_baseline: p.budget_baseline == null ? '' : String(p.budget_baseline),
      notes: p.notes || '',
      stage: p.stage || '',
      start_date: p.start_date ? p.start_date.slice(0, 10) : '',
      expected_end_date: p.expected_end_date ? p.expected_end_date.slice(0, 10) : '',
      status: p.status,
    }
  }

  async function createProject() {
    if (!form.customer_id) {
      alert('Vui lòng chọn khách hàng')
      return
    }
    setSaving(true)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: form.customer_id,
        project_name: form.project_name || null,
        house_type: form.house_type || null,
        address: form.address || null,
        floors: numOrNull(form.floors),
        floor_area: numOrNull(form.floor_area),
        estimated_budget: numOrNull(form.estimated_budget),
        contract_value: numOrNull(form.contract_value),
        budget_baseline: numOrNull(form.budget_baseline),
        notes: form.notes || null,
        stage: form.stage || null,
        start_date: form.start_date || null,
        expected_end_date: form.expected_end_date || null,
        status: form.status,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error || 'Không tạo được dự án')
      return
    }
    setForm(emptyForm())
    setShowCreate(false)
    await loadAll()
  }

  async function saveEdit() {
    if (!editingId) return
    setSaving(true)
    const res = await fetch(`/api/projects/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: form.customer_id,
        project_name: form.project_name || null,
        house_type: form.house_type || null,
        address: form.address || null,
        floors: numOrNull(form.floors),
        floor_area: numOrNull(form.floor_area),
        estimated_budget: numOrNull(form.estimated_budget),
        contract_value: numOrNull(form.contract_value),
        budget_baseline: numOrNull(form.budget_baseline),
        notes: form.notes || null,
        stage: form.stage || null,
        start_date: form.start_date || null,
        expected_end_date: form.expected_end_date || null,
        status: form.status,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error || 'Không cập nhật được dự án')
      return
    }
    setEditingId('')
    setForm(emptyForm())
    await loadAll()
  }

  async function removeProject(id: string, name: string) {
    if (!confirm(`Xóa dự án "${name}"?`)) return
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error || 'Không xóa được dự án')
      return
    }
    await loadAll()
  }

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return projects
    return projects.filter((p) => {
      const name = String(p.project_name || '').toLowerCase()
      const customer = String(p.customer?.full_name || p.customer?.phone_number || '').toLowerCase()
      const addr = String(p.address || '').toLowerCase()
      return name.includes(t) || customer.includes(t) || addr.includes(t)
    })
  }, [projects, q])

  const isEditing = !!editingId

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)' }}>PROJECTS</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Quản lý dự án</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={() => setShowCreate((v) => !v)}>{showCreate ? 'Ẩn form tạo' : 'Hiện form tạo'}</button>
          <Link className="btn-ghost" href="/projects/dashboard">Dashboard</Link>
          <Link className="btn-ghost" href="/projects/reports">Báo cáo</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Tìm kiếm</label>
        <input className="input" placeholder="Nhập tên dự án, tên khách, địa chỉ" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {(showCreate || isEditing) && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{isEditing ? 'Sửa dự án' : 'Tạo dự án mới'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 10 }}>
            <Field label="Khách hàng">
              <select className="select" value={form.customer_id} onChange={(e) => patchForm('customer_id', e.target.value)}>
                <option value="">(Chọn khách hàng)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name || '(không tên)'} - {c.phone_number}</option>
                ))}
              </select>
            </Field>
            <Field label="Tên dự án"><input className="input" value={form.project_name} onChange={(e) => patchForm('project_name', e.target.value)} /></Field>
            <Field label="Loại nhà">
              <select className="select" value={form.house_type} onChange={(e) => patchForm('house_type', e.target.value)}>
                <option value="">(Không chọn)</option>
                {HOUSE_TYPE_OPTIONS.map((k) => <option key={k} value={k}>{HOUSE_TYPE_LABEL[k]}</option>)}
              </select>
            </Field>
            <Field label="Trạng thái">
              <select className="select" value={form.status} onChange={(e) => patchForm('status', e.target.value as ProjectStatus)}>
                {STATUS_OPTIONS.map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
              </select>
            </Field>

            <Field label="Giai đoạn">
              <select className="select" value={form.stage} onChange={(e) => patchForm('stage', e.target.value)}>
                <option value="">(Không chọn)</option>
                {STAGE_OPTIONS.map((k) => <option key={k} value={k}>{STAGE_LABEL[k]}</option>)}
              </select>
            </Field>
            <Field label="Ngày bắt đầu"><input className="input" type="date" value={form.start_date} onChange={(e) => patchForm('start_date', e.target.value)} /></Field>
            <Field label="Ngày kết thúc dự kiến"><input className="input" type="date" value={form.expected_end_date} onChange={(e) => patchForm('expected_end_date', e.target.value)} /></Field>
            <Field label="Địa chỉ"><input className="input" value={form.address} onChange={(e) => patchForm('address', e.target.value)} /></Field>

            <Field label="Số tầng"><input className="input" type="number" value={form.floors} onChange={(e) => patchForm('floors', e.target.value)} /></Field>
            <Field label="Diện tích sàn (m2)"><input className="input" type="number" value={form.floor_area} onChange={(e) => patchForm('floor_area', e.target.value)} /></Field>
            <Field label="Ngân sách dự kiến"><input className="input" value={form.estimated_budget} onChange={(e) => patchForm('estimated_budget', e.target.value)} /></Field>
            <Field label="Giá trị hợp đồng"><input className="input" value={form.contract_value} onChange={(e) => patchForm('contract_value', e.target.value)} /></Field>

            <Field label="Ngân sách gốc"><input className="input" value={form.budget_baseline} onChange={(e) => patchForm('budget_baseline', e.target.value)} /></Field>

            <Field label="Ghi chú" full><textarea className="input" rows={3} value={form.notes} onChange={(e) => patchForm('notes', e.target.value)} /></Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            {isEditing && <button className="btn-ghost" onClick={() => { setEditingId(''); setForm(emptyForm()) }}>Hủy</button>}
            <button className="btn-primary" onClick={isEditing ? saveEdit : createProject} disabled={saving}>{saving ? 'Đang lưu...' : isEditing ? 'Lưu sửa' : 'Tạo dự án'}</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 20 }}>Đang tải...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <Th>Dự án / Khách hàng</Th>
                <Th>Trạng thái</Th>
                <Th>Tiến độ</Th>
                <Th>Chi phí</Th>
                <Th>Mốc thời gian</Th>
                <Th>Thao tác</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <Td>
                    <div style={{ fontWeight: 700 }}>{p.project_name || '(Không tên dự án)'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{p.customer?.full_name || '(Không tên)'} - {p.customer?.phone_number}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{p.address || '-'}</div>
                    {p.latest_cashflow_gap_30d != null && (
                      <div style={{ marginTop: 4, fontSize: 11 }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: 999,
                            border: '1px solid var(--border2)',
                            color: Number(p.latest_cashflow_gap_30d || 0) < 0 ? 'var(--red)' : 'var(--green)',
                          }}
                        >
                          {Number(p.latest_cashflow_gap_30d || 0) < 0 ? 'Thiếu vốn' : 'Đủ vốn'} ({moneySigned(p.latest_cashflow_gap_30d ?? 0)})
                        </span>
                      </div>
                    )}
                    {p.labor_finance_summary && Number(p.labor_finance_summary.payable_amount || 0) > 0 && (
                      <div style={{ marginTop: 4, fontSize: 11 }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: 999,
                            border: '1px solid var(--border2)',
                            color:
                              p.labor_finance_summary.warning_state === 'missing'
                                ? 'var(--red)'
                                : p.labor_finance_summary.warning_state === 'tight'
                                  ? 'var(--orange)'
                                  : 'var(--green)',
                          }}
                        >
                          {laborCashStateLabel(p.labor_finance_summary.warning_state)} ({moneySigned(p.labor_finance_summary.cash_gap_for_payable)})
                        </span>
                      </div>
                    )}
                  </Td>
                  <Td>
                    <div>{STATUS_LABEL[p.status] || p.status}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{p.stage ? (STAGE_LABEL[p.stage] || p.stage) : '-'}</div>
                  </Td>
                  <Td>
                    <div>Kế hoạch: {p.progress_planned_percent ?? '-'}%</div>
                    <div>Thực tế: {p.progress_actual_percent ?? '-'}%</div>
                    <div>Trễ: {p.delay_days ?? 0} ngày</div>
                  </Td>
                  <Td>
                    <div>HD: {money(p.contract_value)}</div>
                    <div>Cam kết: {money(p.cost_committed)}</div>
                    <div>Thực tế: {money(p.cost_actual)}</div>
                  </Td>
                  <Td>
                    <div>Bắt đầu: {d(p.start_date)}</div>
                    <div>Dự kiến KT: {d(p.expected_end_date)}</div>
                    <div>Cập nhật: {d(p.updated_at)}</div>
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn-ghost" onClick={() => { setEditingId(p.id); setForm(mapProjectToForm(p)); setShowCreate(true) }}>Sửa</button>
                      <button className="btn-ghost" onClick={() => removeProject(p.id, p.project_name || p.customer?.full_name || p.id)}>Xóa</button>
                      <Link className="btn-ghost" href={`/projects/${p.id}/investor`}>Investor</Link>
                      <Link className="btn-ghost" href={`/projects/${p.id}/overview`}>Overview</Link>
                      <Link className="btn-ghost" href={`/projects/${p.id}/operations`}>Vận hành</Link>
                    </div>
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 16, color: 'var(--text3)', textAlign: 'center' }}>Không có dự án</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <div style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function Th({ children }: { children: ReactNode }) {
  return <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{children}</th>
}

function Td({ children }: { children: ReactNode }) {
  return <td style={{ verticalAlign: 'top', padding: '10px 12px', fontSize: 13 }}>{children}</td>
}
