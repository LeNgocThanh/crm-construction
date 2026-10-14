'use client'

import { useEffect, useMemo, useState } from 'react'
import { getUserDisplayLabel } from '@/lib/user-display'

type UserOption = {
  id: string
  username: string
  role: string
  full_name?: string | null
  primary_access_role?: { key?: string | null; name?: string | null } | null
}

type ResourceOption = {
  id: string
  label: string
  subtitle?: string | null
}

type GrantRow = {
  id: string
  resource_type: string
  resource_id: string
  resource?: ResourceOption | null
  user_id: string
  user?: {
    id: string
    username: string
    role: string
    full_name?: string | null
    primary_access_role?: { key?: string | null; name?: string | null } | null
  } | null
  access_level?: string | null
  can_read: boolean
  can_write: boolean
  can_approve: boolean
  can_manage: boolean
  granted_by?: string | null
  granter?: { id: string; username: string } | null
  granted_at?: string | null
  expires_at?: string | null
  is_active: boolean
  note?: string | null
}

const RESOURCE_TYPE_OPTIONS = [
  { value: 'project', label: 'Dự án' },
  { value: 'warehouse', label: 'Kho' },
  { value: 'asset', label: 'Tài sản' },
  { value: 'customer', label: 'Khách hàng' },
  { value: 'conversation', label: 'Cuộc hội thoại' },
  { value: 'labor_worker', label: 'Nhân công' },
]

const ACCESS_LEVEL_OPTIONS = [
  { value: '', label: 'Tự chọn quyền' },
  { value: 'viewer', label: 'Chỉ xem' },
  { value: 'editor', label: 'Được sửa' },
  { value: 'approver', label: 'Được duyệt' },
  { value: 'manager', label: 'Toàn quyền trên resource' },
]

const DROPDOWN_RESOURCE_TYPES = new Set(['project', 'warehouse', 'asset'])

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('vi-VN')
}

function userLabel(user?: {
  username?: string | null
  full_name?: string | null
  role?: string | null
  primary_access_role?: { key?: string | null; name?: string | null } | null
} | null) {
  const name = String(user?.full_name || '').trim()
  const username = String(user?.username || '').trim()
  const roleLabel = String(user?.primary_access_role?.name || user?.primary_access_role?.key || user?.role || '').trim()
  const title = name && username && name !== username ? `${name} (${username})` : (name || username || '-')
  return roleLabel ? `${title} (${roleLabel})` : title
}

function applyLevelDefaults<T extends {
  access_level: string
  can_read: boolean
  can_write: boolean
  can_approve: boolean
  can_manage: boolean
}>(input: T): T {
  if (input.access_level === 'viewer') return { ...input, can_read: true, can_write: false, can_approve: false, can_manage: false }
  if (input.access_level === 'editor') return { ...input, can_read: true, can_write: true, can_approve: false, can_manage: false }
  if (input.access_level === 'approver') return { ...input, can_read: true, can_write: true, can_approve: true, can_manage: false }
  if (input.access_level === 'manager') return { ...input, can_read: true, can_write: true, can_approve: true, can_manage: true }
  return input
}

export default function ResourceAccessGrantsPage() {
  const [rows, setRows] = useState<GrantRow[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [resourceOptions, setResourceOptions] = useState<ResourceOption[]>([])
  const [resourceQuery, setResourceQuery] = useState('')
  const [selectedResource, setSelectedResource] = useState<ResourceOption | null>(null)
  const [resourceLoading, setResourceLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const [editingId, setEditingId] = useState('')

  const [filters, setFilters] = useState({
    resource_type: '',
    user_id: '',
    active_only: 'true',
  })

  const emptyForm = {
    resource_type: 'project',
    resource_id: '',
    user_id: '',
    access_level: 'viewer',
    can_read: true,
    can_write: false,
    can_approve: false,
    can_manage: false,
    expires_at: '',
    is_active: true,
    note: '',
  }

  const [form, setForm] = useState(emptyForm)

  const selectedUser = useMemo(
    () => users.find((u) => u.id === form.user_id) || null,
    [users, form.user_id]
  )

  const resourceTypeLabel = useMemo(
    () => RESOURCE_TYPE_OPTIONS.find((item) => item.value === form.resource_type)?.label || form.resource_type,
    [form.resource_type]
  )

  const useDropdownPicker = useMemo(
    () => DROPDOWN_RESOURCE_TYPES.has(form.resource_type),
    [form.resource_type]
  )

  async function loadUsers() {
    const res = await fetch('/api/users?limit=300')
    const j = await res.json().catch(() => ({}))
    const data = Array.isArray(j?.data) ? j.data : []
    setUsers(
      data.map((x: any) => ({
        id: String(x.id || ''),
        username: String(x.username || x.id || ''),
        role: String(x.role || ''),
        full_name: x.full_name || null,
        primary_access_role: x.primary_access_role || null,
      }))
    )
  }

  async function loadRows() {
    setLoading(true)
    const sp = new URLSearchParams()
    if (filters.resource_type) sp.set('resource_type', filters.resource_type)
    if (filters.user_id) sp.set('user_id', filters.user_id)
    sp.set('active_only', filters.active_only)
    const res = await fetch(`/api/settings/resource-access-grants?${sp.toString()}`)
    const j = await res.json().catch(() => ({}))
    setRows(Array.isArray(j?.data) ? j.data : [])
    setLoading(false)
  }

  async function loadResourceOptions(resourceType: string, query: string) {
    if (!resourceType) {
      setResourceOptions([])
      return
    }
    setResourceLoading(true)
    const sp = new URLSearchParams()
    sp.set('resource_type', resourceType)
    sp.set('limit', '20')
    if (query.trim()) sp.set('q', query.trim())
    const res = await fetch(`/api/settings/resource-access-grants/resources?${sp.toString()}`)
    const j = await res.json().catch(() => ({}))
    setResourceOptions(Array.isArray(j?.data) ? j.data : [])
    setResourceLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    loadRows()
  }, [filters.resource_type, filters.user_id, filters.active_only])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadResourceOptions(form.resource_type, resourceQuery)
    }, 250)
    return () => clearTimeout(timeout)
  }, [form.resource_type, resourceQuery])

  function resetForm() {
    setEditingId('')
    setForm(emptyForm)
    setResourceQuery('')
    setSelectedResource(null)
  }

  function chooseResource(item: ResourceOption) {
    setSelectedResource(item)
    setResourceQuery(item.label)
    setForm((p) => ({ ...p, resource_id: item.id }))
  }

  function startEdit(row: GrantRow) {
    setEditingId(row.id)
    setForm({
      resource_type: row.resource_type || 'project',
      resource_id: row.resource_id || '',
      user_id: row.user_id || '',
      access_level: row.access_level || '',
      can_read: !!row.can_read,
      can_write: !!row.can_write,
      can_approve: !!row.can_approve,
      can_manage: !!row.can_manage,
      expires_at: row.expires_at ? String(row.expires_at).slice(0, 16) : '',
      is_active: !!row.is_active,
      note: row.note || '',
    })
    setSelectedResource(row.resource || null)
    setResourceQuery(row.resource?.label || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submitForm() {
    if (!form.user_id || !form.resource_id.trim()) {
      setToast('Cần chọn user và chọn resource')
      return
    }

    const payload = {
      resource_type: form.resource_type,
      resource_id: form.resource_id.trim(),
      user_id: form.user_id,
      access_level: form.access_level || null,
      can_read: form.can_read,
      can_write: form.can_write,
      can_approve: form.can_approve,
      can_manage: form.can_manage,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      is_active: form.is_active,
      note: form.note.trim() || null,
    }

    setSaving(true)
    const res = await fetch(
      editingId
        ? `/api/settings/resource-access-grants/${editingId}`
        : '/api/settings/resource-access-grants',
      {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )
    const j = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setToast(j?.error || 'Không lưu được grant')
      return
    }
    setToast(editingId ? 'Đã cập nhật quyền truy cập' : 'Đã tạo quyền truy cập')
    resetForm()
    await loadRows()
  }

  async function removeGrant(id: string) {
    if (!confirm('Xóa grant này?')) return
    const res = await fetch(`/api/settings/resource-access-grants/${id}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(j?.error || 'Xóa grant thất bại')
      return
    }
    setToast('Đã xóa grant')
    if (editingId === id) resetForm()
    await loadRows()
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>SETTINGS</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Cấp quyền truy cập theo Resource</h1>
        <div style={{ color: 'var(--text3)', marginTop: 6 }}>
          Quản lý quyền đọc, sửa, duyệt, quản lý trên từng dự án, kho, tài sản, khách hàng... cho từng user cụ thể.
        </div>
      </div>

      {toast ? (
        <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(34,197,94,0.08)', color: 'var(--text2)' }}>
          {toast}
        </div>
      ) : null}

      <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--panel)', padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 800 }}>Hướng dẫn sử dụng</div>
          <button className="btn ghost" onClick={() => setShowGuide((v) => !v)}>
            {showGuide ? 'Ẩn hướng dẫn' : 'Hiện hướng dẫn'}
          </button>
        </div>
        {showGuide ? (
          <div style={{ color: 'var(--text2)', lineHeight: 1.7 }}>
            <div>1. Chọn user cần được cấp quyền.</div>
            <div>2. Chọn loại resource như Dự án, Kho, Tài sản, Khách hàng...</div>
            <div>3. Gõ tên, mã hoặc số điện thoại để tìm resource thay vì phải nhớ ID.</div>
            <div>4. Chọn mức quyền nhanh hoặc tự bật các quyền đọc, sửa, duyệt, quản lý.</div>
            <div>5. Grant này dùng để mở rộng quyền trên một resource cụ thể, không thay thế toàn bộ role hệ thống.</div>
          </div>
        ) : null}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--panel)', padding: 16, marginBottom: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 12 }}>{editingId ? 'Sửa grant quyền' : 'Tạo grant quyền mới'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Loại resource</span>
            <select
              value={form.resource_type}
              onChange={(e) => {
                const nextType = e.target.value
                setSelectedResource(null)
                setResourceQuery('')
                setForm((p) => ({ ...applyLevelDefaults({ ...p, resource_type: nextType }), resource_id: '' }))
              }}
            >
              {RESOURCE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>User được cấp quyền</span>
            <select value={form.user_id} onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value }))}>
              <option value="">Chọn user</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{userLabel(u)}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Mức quyền nhanh</span>
            <select
              value={form.access_level}
              onChange={(e) => setForm((p) => applyLevelDefaults({ ...p, access_level: e.target.value }))}
            >
              {ACCESS_LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Hết hạn quyền</span>
            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value }))}
            />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12, marginTop: 12 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Tìm {resourceTypeLabel}</span>
              <input
                value={resourceQuery}
                onChange={(e) => setResourceQuery(e.target.value)}
                placeholder={`Gõ tên, mã hoặc thông tin để tìm ${resourceTypeLabel.toLowerCase()}`}
              />
            </label>

            {useDropdownPicker ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'rgba(255,255,255,0.02)', display: 'grid', gap: 8 }}>
                <div style={{ color: 'var(--text3)', fontSize: 13 }}>
                  {resourceLoading ? 'Đang tải danh sách...' : `Chọn ${resourceTypeLabel.toLowerCase()} từ danh sách đã lọc`}
                </div>
                <select
                  value={form.resource_id}
                  onChange={(e) => {
                    const item = resourceOptions.find((x) => x.id === e.target.value) || null
                    if (item) chooseResource(item)
                    else {
                      setSelectedResource(null)
                      setForm((p) => ({ ...p, resource_id: e.target.value }))
                    }
                  }}
                >
                  <option value="">{resourceLoading ? 'Đang tải...' : `Chọn ${resourceTypeLabel.toLowerCase()}`}</option>
                  {resourceOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}{item.subtitle ? ` - ${item.subtitle}` : ''}
                    </option>
                  ))}
                </select>
                <div style={{ color: 'var(--text3)', fontSize: 12 }}>
                  Gợi ý: gõ ở ô tìm kiếm phía trên để lọc danh sách ngắn và dễ chọn hơn.
                </div>
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontSize: 13 }}>
                  {resourceLoading ? 'Đang tìm resource...' : `Danh sách ${resourceTypeLabel.toLowerCase()} gợi ý`}
                </div>
                <div style={{ maxHeight: 220, overflow: 'auto' }}>
                  {resourceOptions.length === 0 ? (
                    <div style={{ padding: 12, color: 'var(--text3)' }}>Không có resource phù hợp.</div>
                  ) : (
                    resourceOptions.map((item) => {
                      const active = form.resource_id === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => chooseResource(item)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: 12,
                            border: 'none',
                            borderTop: '1px solid var(--border)',
                            background: active ? 'rgba(249,115,22,0.12)' : 'transparent',
                            color: 'inherit',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{item.label}</div>
                          <div style={{ color: 'var(--text3)', marginTop: 4, fontSize: 13 }}>
                            ID: {item.id}
                            {item.subtitle ? ` • ${item.subtitle}` : ''}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Resource ID</span>
              <input
                value={form.resource_id}
                onChange={(e) => {
                  setSelectedResource(null)
                  setForm((p) => ({ ...p, resource_id: e.target.value }))
                }}
                placeholder="Có thể nhập tay nếu cần"
              />
            </label>

            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Resource đang chọn</div>
              {selectedResource ? (
                <>
                  <div>{selectedResource.label}</div>
                  <div style={{ color: 'var(--text3)', marginTop: 4 }}>
                    ID: {selectedResource.id}
                    {selectedResource.subtitle ? ` • ${selectedResource.subtitle}` : ''}
                  </div>
                </>
              ) : form.resource_id ? (
                <div style={{ color: 'var(--text3)' }}>Đang dùng ID nhập tay: {form.resource_id}</div>
              ) : (
                <div style={{ color: 'var(--text3)' }}>Chưa chọn resource.</div>
              )}
            </div>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Ghi chú</span>
              <input
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Ví dụ: cho kế toán xem riêng dự án này"
              />
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 14, color: 'var(--text2)' }}>
          <label><input type="checkbox" checked={form.can_read} onChange={(e) => setForm((p) => ({ ...p, can_read: e.target.checked }))} /> Được xem</label>
          <label><input type="checkbox" checked={form.can_write} onChange={(e) => setForm((p) => ({ ...p, can_write: e.target.checked }))} /> Được sửa</label>
          <label><input type="checkbox" checked={form.can_approve} onChange={(e) => setForm((p) => ({ ...p, can_approve: e.target.checked }))} /> Được duyệt</label>
          <label><input type="checkbox" checked={form.can_manage} onChange={(e) => setForm((p) => ({ ...p, can_manage: e.target.checked }))} /> Được quản lý</label>
          <label><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} /> Đang hiệu lực</label>
        </div>

        <div style={{ marginTop: 12, color: 'var(--text3)' }}>
          User đang chọn: {selectedUser ? getUserDisplayLabel(selectedUser) : 'Chưa chọn'}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button className="btn" onClick={submitForm} disabled={saving}>
            {saving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Tạo grant'}
          </button>
          {editingId ? (
            <button className="btn ghost" onClick={resetForm}>
              Hủy sửa
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--panel)', padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Lọc theo loại resource</span>
            <select value={filters.resource_type} onChange={(e) => setFilters((p) => ({ ...p, resource_type: e.target.value }))}>
              <option value="">Tất cả</option>
              {RESOURCE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Lọc theo user</span>
            <select value={filters.user_id} onChange={(e) => setFilters((p) => ({ ...p, user_id: e.target.value }))}>
              <option value="">Tất cả user</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{getUserDisplayLabel(u)}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Trạng thái</span>
            <select value={filters.active_only} onChange={(e) => setFilters((p) => ({ ...p, active_only: e.target.value }))}>
              <option value="true">Chỉ đang hiệu lực</option>
              <option value="false">Bao gồm đã tắt</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div>Đang tải...</div>
        ) : rows.length === 0 ? (
          <div style={{ color: 'var(--text3)' }}>Chưa có grant nào.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {rows.map((row) => (
              <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14, background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>
                      {row.resource?.label || row.resource_id}
                    </div>
                    <div style={{ color: 'var(--text3)', marginTop: 4 }}>
                      {RESOURCE_TYPE_OPTIONS.find((x) => x.value === row.resource_type)?.label || row.resource_type}
                      {' • '}
                      ID: {row.resource_id}
                      {row.resource?.subtitle ? ` • ${row.resource.subtitle}` : ''}
                    </div>
                    <div style={{ color: 'var(--text2)', marginTop: 6 }}>
                      User: {row.user ? userLabel(row.user) : row.user_id}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn ghost" onClick={() => startEdit(row)}>Sửa</button>
                    <button className="btn ghost" onClick={() => removeGrant(row.id)}>Xóa</button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  <span className="chip">{row.access_level || 'Tự chọn quyền'}</span>
                  {row.can_read ? <span className="chip">Xem</span> : null}
                  {row.can_write ? <span className="chip">Sửa</span> : null}
                  {row.can_approve ? <span className="chip">Duyệt</span> : null}
                  {row.can_manage ? <span className="chip">Quản lý</span> : null}
                  <span className="chip" style={{ color: row.is_active ? '#34d399' : '#f87171' }}>
                    {row.is_active ? 'Đang hiệu lực' : 'Đã tắt'}
                  </span>
                </div>

                <div style={{ marginTop: 10, color: 'var(--text3)' }}>
                  Cấp bởi: {row.granter?.username || row.granted_by || '-'} • Lúc: {formatDateTime(row.granted_at)}
                </div>
                <div style={{ marginTop: 4, color: 'var(--text3)' }}>
                  Hết hạn: {formatDateTime(row.expires_at)}
                </div>
                {row.note ? (
                  <div style={{ marginTop: 8, color: 'var(--text2)' }}>
                    Ghi chú: {row.note}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
