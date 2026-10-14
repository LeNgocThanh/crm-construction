'use client'

import { useEffect, useMemo, useState } from 'react'

type Row = {
  id: string
  action_key: string
  action_name: string
  category: string
  requires_due_at: boolean
  requires_note: boolean
  requires_customer: boolean
  requires_project: boolean
  requires_handover_from: boolean
  requires_handover_to: boolean
  apply_owner_transfer: boolean
  requires_warranty_from_date: boolean
  requires_warranty_to_date: boolean
  requires_warranty_provider: boolean
  requires_attachment: boolean
  requires_status_to: boolean
  requires_quantity: boolean
  allowed_status_to_json?: any
  form_schema_json?: any
  document_template_key?: string | null
  default_priority?: string | null
  is_active: boolean
  sort_order: number
  description?: string | null
}

type FormState = {
  action_key: string
  action_name: string
  category: string
  requires_due_at: boolean
  requires_note: boolean
  requires_customer: boolean
  requires_project: boolean
  requires_handover_from: boolean
  requires_handover_to: boolean
  apply_owner_transfer: boolean
  requires_warranty_from_date: boolean
  requires_warranty_to_date: boolean
  requires_warranty_provider: boolean
  requires_attachment: boolean
  requires_status_to: boolean
  requires_quantity: boolean
  allowedStatuses: string[]
  document_template_key: string
  default_priority: string
  sort_order: string
  description: string
  is_active: boolean
}

const CATEGORY_OPTIONS = [
  { value: 'lifecycle', label: 'Vòng đời' },
  { value: 'maintenance', label: 'Bảo trì' },
  { value: 'warranty', label: 'Bảo hành' },
  { value: 'audit', label: 'Kiểm tra/đánh giá' },
  { value: 'handover', label: 'Bàn giao/thu hồi' },
]

const STATUS_OPTIONS = ['available', 'in_use', 'maintenance', 'retired', 'lost']

const STATUS_LABELS: Record<string, string> = {
  available: 'Sẵn sàng',
  in_use: 'Đang sử dụng',
  maintenance: 'Đang bảo trì',
  retired: 'Ngừng sử dụng',
  lost: 'Thất lạc',
}

const PRIORITY_OPTIONS = [
  { value: '', label: '(Không mặc định)' },
  { value: 'low', label: 'Thấp' },
  { value: 'normal', label: 'Bình thường' },
  { value: 'high', label: 'Cao' },
  { value: 'urgent', label: 'Khẩn' },
]

const EMPTY_FORM: FormState = {
  action_key: '',
  action_name: '',
  category: 'lifecycle',
  requires_due_at: false,
  requires_note: false,
  requires_customer: false,
  requires_project: false,
  requires_handover_from: false,
  requires_handover_to: false,
  apply_owner_transfer: false,
  requires_warranty_from_date: false,
  requires_warranty_to_date: false,
  requires_warranty_provider: false,
  requires_attachment: false,
  requires_status_to: false,
  requires_quantity: false,
  allowedStatuses: [],
  document_template_key: '',
  default_priority: '',
  sort_order: '0',
  description: '',
  is_active: true,
}

function toArrayString(input: any): string[] {
  if (!Array.isArray(input)) return []
  return input.map((x) => String(x || '').trim()).filter(Boolean)
}

function toggleInArray(arr: string[], value: string) {
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]
}

function slugifyKey(input: string) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export default function AssetActionTypesPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editId, setEditId] = useState('')
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)
  const [keyTouched, setKeyTouched] = useState(false)

  useEffect(() => {
    if (keyTouched) return
    const next = slugifyKey(form.action_name)
    if (!next) return
    setForm((p) => (p.action_key === next ? p : { ...p, action_key: next }))
  }, [form.action_name, keyTouched])

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(t)
  }, [toast])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/settings/asset-action-types')
    const j = await res.json().catch(() => ({}))
    setRows(Array.isArray(j?.data) ? j.data : [])
    setLoading(false)
  }

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.sort_order - b.sort_order || a.action_name.localeCompare(b.action_name)),
    [rows]
  )

  function toPayload(f: FormState) {
    return {
      action_key: f.action_key.trim().toLowerCase(),
      action_name: f.action_name.trim(),
      category: f.category,
      requires_due_at: f.requires_due_at,
      requires_note: f.requires_note,
      requires_customer: f.requires_customer,
      requires_project: f.requires_project,
      requires_handover_from: f.requires_handover_from,
      requires_handover_to: f.requires_handover_to,
      apply_owner_transfer: f.apply_owner_transfer,
      requires_warranty_from_date: f.requires_warranty_from_date,
      requires_warranty_to_date: f.requires_warranty_to_date,
      requires_warranty_provider: f.requires_warranty_provider,
      requires_attachment: f.requires_attachment,
      requires_status_to: f.requires_status_to,
      requires_quantity: f.requires_quantity,
      allowed_status_to_json: f.allowedStatuses,
      form_schema_json: {},
      document_template_key: f.document_template_key.trim() || null,
      default_priority: f.default_priority.trim() || null,
      sort_order: Number(f.sort_order || 0),
      description: f.description.trim() || null,
      is_active: f.is_active,
    }
  }

  async function createRow() {
    if (!form.action_key.trim() || !form.action_name.trim()) return setToast('Thiếu mã hoặc tên hành động')
    const res = await fetch('/api/settings/asset-action-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toPayload(form)),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return setToast(j?.error || 'Tạo hành động thất bại')
    setToast('Đã tạo hành động')
    setForm(EMPTY_FORM)
    setKeyTouched(false)
    await load()
  }

  async function patchRow(id: string, patch: any) {
    const res = await fetch(`/api/settings/asset-action-types/${id}`, {
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
    if (!confirm('Xóa loại hành động này?')) return
    const res = await fetch(`/api/settings/asset-action-types/${id}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return setToast(j?.error || 'Xóa thất bại')
    setToast('Đã xóa')
    await load()
  }

  function startEdit(r: Row) {
    setEditId(r.id)
    setEditForm({
      action_key: r.action_key || '',
      action_name: r.action_name || '',
      category: r.category || 'lifecycle',
      requires_due_at: !!r.requires_due_at,
      requires_note: !!r.requires_note,
      requires_customer: !!r.requires_customer,
      requires_project: !!r.requires_project,
      requires_handover_from: !!r.requires_handover_from,
      requires_handover_to: !!r.requires_handover_to,
      apply_owner_transfer: !!r.apply_owner_transfer,
      requires_warranty_from_date: !!r.requires_warranty_from_date,
      requires_warranty_to_date: !!r.requires_warranty_to_date,
      requires_warranty_provider: !!r.requires_warranty_provider,
      requires_attachment: !!r.requires_attachment,
      requires_status_to: !!r.requires_status_to,
      requires_quantity: !!r.requires_quantity,
      allowedStatuses: toArrayString(r.allowed_status_to_json),
      document_template_key: r.document_template_key || '',
      default_priority: r.default_priority || '',
      sort_order: String(r.sort_order ?? 0),
      description: r.description || '',
      is_active: !!r.is_active,
    })
  }

  async function saveEdit() {
    if (!editId) return
    if (!editForm.action_key.trim() || !editForm.action_name.trim()) return setToast('Thiếu mã hoặc tên hành động')
    if (!confirm('Xác nhận lưu thay đổi cấu hình hành động?')) return
    await patchRow(editId, toPayload(editForm))
    setEditId('')
  }

  function RuleFlags({
    data,
    onChange,
  }: {
    data: FormState
    onChange: (patch: Partial<FormState>) => void
  }) {
    return (
      <>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: 'var(--text3)', flexWrap: 'wrap' }}>
          <label><input type="checkbox" checked={data.requires_due_at} onChange={(e) => onChange({ requires_due_at: e.target.checked })} /> cần hạn xử lý</label>
          <label><input type="checkbox" checked={data.requires_note} onChange={(e) => onChange({ requires_note: e.target.checked })} /> cần mô tả</label>
          <label><input type="checkbox" checked={data.requires_customer} onChange={(e) => onChange({ requires_customer: e.target.checked })} /> cần khách hàng</label>
          <label><input type="checkbox" checked={data.requires_project} onChange={(e) => onChange({ requires_project: e.target.checked })} /> cần dự án</label>
          <label><input type="checkbox" checked={data.requires_status_to} onChange={(e) => onChange({ requires_status_to: e.target.checked })} /> cần trạng thái đích</label>
          <label><input type="checkbox" checked={data.requires_quantity} onChange={(e) => onChange({ requires_quantity: e.target.checked })} /> cần số lượng</label>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 12, color: 'var(--text3)', flexWrap: 'wrap' }}>
          <label><input type="checkbox" checked={data.requires_handover_from} onChange={(e) => onChange({ requires_handover_from: e.target.checked })} /> cần người giao</label>
          <label><input type="checkbox" checked={data.requires_handover_to} onChange={(e) => onChange({ requires_handover_to: e.target.checked })} /> cần người nhận</label>
          <label><input type="checkbox" checked={data.apply_owner_transfer} onChange={(e) => onChange({ apply_owner_transfer: e.target.checked })} /> chuyển người giữ tài sản sang người nhận</label>
          <label><input type="checkbox" checked={data.requires_warranty_from_date} onChange={(e) => onChange({ requires_warranty_from_date: e.target.checked })} /> cần ngày BH từ</label>
          <label><input type="checkbox" checked={data.requires_warranty_to_date} onChange={(e) => onChange({ requires_warranty_to_date: e.target.checked })} /> cần ngày BH đến</label>
          <label><input type="checkbox" checked={data.requires_warranty_provider} onChange={(e) => onChange({ requires_warranty_provider: e.target.checked })} /> cần NCC bảo hành</label>
          <label><input type="checkbox" checked={data.requires_attachment} onChange={(e) => onChange({ requires_attachment: e.target.checked })} /> cần tệp đính kèm</label>
        </div>
      </>
    )
  }

  function MultiSelectChecklist({
    title,
    options,
    selected,
    onToggle,
  }: {
    title: string
    options: { value: string; label: string }[]
    selected: string[]
    onToggle: (value: string) => void
  }) {
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{title}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
          {options.map((x) => (
            <label key={x.value}>
              <input type="checkbox" checked={selected.includes(x.value)} onChange={() => onToggle(x.value)} /> {x.label}
            </label>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>SETTINGS</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Cấu hình Hành động Tài sản</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Thiết lập các hành động nghiệp vụ (bàn giao, bảo hành, bảo trì...) để hệ thống tự hiểu và kiểm tra dữ liệu bắt buộc.</div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Hướng dẫn sử dụng</div>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowGuide((v) => !v)}>
            {showGuide ? 'Ẩn hướng dẫn' : 'Hiện hướng dẫn'}
          </button>
        </div>
        {showGuide && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
            <div>1. Mỗi hành động (action) mô tả một nghiệp vụ cụ thể: bàn giao, thu hồi, cập nhật bảo hành, bảo trì.</div>
            <div>2. Bật các tùy chọn “cần ...” để bắt buộc người dùng nhập đúng dữ liệu khi thao tác.</div>
            <div>3. “Trạng thái đích cho phép” giúp giới hạn chuyển trạng thái tài sản theo action.</div>
            <div>4. Khi thay đổi action đang dùng, cần kiểm tra ảnh hưởng form thao tác ở trang vận hành tài sản.</div>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 8, letterSpacing: 1.1 }}>THÊM HÀNH ĐỘNG MỚI</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.9fr 0.7fr auto', gap: 8 }}>
          <input
            className="input"
            placeholder="Mã hành động (tự sinh từ tên)"
            value={form.action_key}
            onChange={(e) => {
              setKeyTouched(true)
              setForm((p) => ({ ...p, action_key: e.target.value }))
            }}
          />
          <input className="input" placeholder="Tên hành động (vd: Bàn giao tài sản)" value={form.action_name} onChange={(e) => setForm((p) => ({ ...p, action_name: e.target.value }))} />
          <select className="select" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
            {CATEGORY_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
          <input className="input" placeholder="Thứ tự" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} />
          <button className="btn-primary" onClick={createRow}>+ Tạo</button>
        </div>

        <RuleFlags data={form} onChange={(patch) => setForm((p) => ({ ...p, ...patch }))} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginTop: 8 }}>
          <MultiSelectChecklist
            title="Trạng thái đích cho phép"
            options={STATUS_OPTIONS.map((x) => ({ value: x, label: STATUS_LABELS[x] || x }))}
            selected={form.allowedStatuses}
            onToggle={(v) => setForm((p) => ({ ...p, allowedStatuses: toggleInArray(p.allowedStatuses, v) }))}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <input className="input" placeholder="Mẫu văn bản (template_key) - không bắt buộc" value={form.document_template_key} onChange={(e) => setForm((p) => ({ ...p, document_template_key: e.target.value }))} />
          <select className="select" value={form.default_priority} onChange={(e) => setForm((p) => ({ ...p, default_priority: e.target.value }))}>
            {PRIORITY_OPTIONS.map((x) => <option key={x.value || 'none'} value={x.value}>{x.label}</option>)}
          </select>
        </div>
        <textarea className="input" style={{ marginTop: 8, minHeight: 54 }} placeholder="Mô tả thêm (không bắt buộc)" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 8, letterSpacing: 1.1 }}>DANH SÁCH HÀNH ĐỘNG</div>
        {loading ? (
          <div style={{ padding: 16, color: 'var(--text3)' }}>Đang tải...</div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 560, overflowY: 'auto' }}>
            {sortedRows.map((r) => (
              <div key={r.id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{r.action_name} ({r.action_key})</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      nhóm={r.category} | cần người nhận={String(r.requires_handover_to)} | chuyển owner={String(r.apply_owner_transfer)} | bắt buộc đính kèm={String(r.requires_attachment)} | active={String(r.is_active)} | thứ tự={r.sort_order}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => patchRow(r.id, { is_active: !r.is_active })}>
                      {r.is_active ? 'Tắt' : 'Bật'}
                    </button>
                    <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => startEdit(r)}>
                      Sửa
                    </button>
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

      {editId && (
        <div className="card" style={{ padding: 12, marginTop: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 8, letterSpacing: 1.1 }}>CHỈNH SỬA HÀNH ĐỘNG</div>
          <div style={{ fontSize: 12, color: 'var(--orange)', marginBottom: 8 }}>
            Cảnh báo: thay đổi cấu hình có thể ảnh hưởng form thao tác ở trang vận hành tài sản.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.9fr 0.7fr', gap: 8 }}>
            <input className="input" placeholder="Mã hành động" value={editForm.action_key} onChange={(e) => setEditForm((p) => ({ ...p, action_key: e.target.value }))} />
            <input className="input" placeholder="Tên hành động" value={editForm.action_name} onChange={(e) => setEditForm((p) => ({ ...p, action_name: e.target.value }))} />
            <select className="select" value={editForm.category} onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}>
              {CATEGORY_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
            <input className="input" placeholder="Thứ tự" value={editForm.sort_order} onChange={(e) => setEditForm((p) => ({ ...p, sort_order: e.target.value }))} />
          </div>

          <RuleFlags data={editForm} onChange={(patch) => setEditForm((p) => ({ ...p, ...patch }))} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginTop: 8 }}>
            <MultiSelectChecklist
              title="Trạng thái đích cho phép"
              options={STATUS_OPTIONS.map((x) => ({ value: x, label: STATUS_LABELS[x] || x }))}
              selected={editForm.allowedStatuses}
              onToggle={(v) => setEditForm((p) => ({ ...p, allowedStatuses: toggleInArray(p.allowedStatuses, v) }))}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <input className="input" placeholder="Mẫu văn bản (template_key)" value={editForm.document_template_key} onChange={(e) => setEditForm((p) => ({ ...p, document_template_key: e.target.value }))} />
            <select className="select" value={editForm.default_priority} onChange={(e) => setEditForm((p) => ({ ...p, default_priority: e.target.value }))}>
              {PRIORITY_OPTIONS.map((x) => <option key={x.value || 'none'} value={x.value}>{x.label}</option>)}
            </select>
          </div>
          <textarea className="input" style={{ marginTop: 8, minHeight: 54 }} placeholder="Mô tả thêm" value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} />

          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={saveEdit}>Lưu thay đổi</button>
            <button className="btn-ghost" onClick={() => setEditId('')}>Hủy</button>
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
