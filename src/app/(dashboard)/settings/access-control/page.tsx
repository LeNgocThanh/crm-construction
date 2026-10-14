'use client'

import { useEffect, useMemo, useState } from 'react'

type ModuleItem = {
  id: string
  module_key: string
  module_name: string
  is_active: boolean
}

type ResourceItem = {
  id: string
  resource_key: string
  resource_name: string
  is_active: boolean
  module_id: string
  module?: { id: string; module_key: string; module_name: string }
}

type PermissionItem = {
  id: string
  permission_key: string
  permission_name: string
  action_key: string
  description?: string | null
  is_active: boolean
  sort_order: number
  module_id: string
  resource_id?: string | null
  module?: { id: string; module_key: string; module_name: string }
  resource?: { id: string; resource_key: string; resource_name: string } | null
  _count?: { role_permissions?: number }
}

type RolePermissionRef = {
  id: string
  permission_key: string
  permission_name: string
  module?: { module_key: string; module_name: string }
}

type RoleItem = {
  id: string
  role_key: string
  role_name: string
  description?: string | null
  is_system: boolean
  is_active: boolean
  sort_order: number
  permissions?: RolePermissionRef[]
  _count?: { role_permissions?: number; user_memberships?: number }
}

const ACTION_OPTIONS = [
  { value: 'read', label: 'Xem' },
  { value: 'write', label: 'Ghi / cập nhật' },
  { value: 'create', label: 'Tạo mới' },
  { value: 'update', label: 'Sửa' },
  { value: 'delete', label: 'Xóa' },
  { value: 'approve', label: 'Duyệt' },
  { value: 'assign', label: 'Phân công / gán' },
  { value: 'manage', label: 'Quản lý' },
]

const EMPTY_PERMISSION_FORM = {
  module_id: '',
  resource_id: '',
  permission_key: '',
  permission_name: '',
  action_key: 'read',
  description: '',
  sort_order: '0',
  is_active: true,
}

const EMPTY_ROLE_FORM = {
  role_key: '',
  role_name: '',
  description: '',
  sort_order: '0',
  is_active: true,
  permission_ids: [] as string[],
}

function slugifyKey(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export default function SettingsAccessControlPage() {
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savingPermission, setSavingPermission] = useState(false)
  const [savingRole, setSavingRole] = useState(false)
  const [permissionForm, setPermissionForm] = useState({ ...EMPTY_PERMISSION_FORM })
  const [roleForm, setRoleForm] = useState({ ...EMPTY_ROLE_FORM })
  const [editingPermissionId, setEditingPermissionId] = useState<string | null>(null)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const [showPermissionForm, setShowPermissionForm] = useState(true)
  const [showPermissionList, setShowPermissionList] = useState(true)
  const [showRoleForm, setShowRoleForm] = useState(true)
  const [showRoleList, setShowRoleList] = useState(true)
  const [permissionSearch, setPermissionSearch] = useState('')
  const [permissionModuleFilter, setPermissionModuleFilter] = useState('')
  const [permissionStatusFilter, setPermissionStatusFilter] = useState('all')
  const [roleSearch, setRoleSearch] = useState('')
  const [roleStatusFilter, setRoleStatusFilter] = useState('all')
  const [permissionPage, setPermissionPage] = useState(1)
  const permissionPageSize = 20

  const filteredResources = useMemo(
    () => resources.filter((item) => !permissionForm.module_id || item.module_id === permissionForm.module_id),
    [resources, permissionForm.module_id]
  )

  const selectedModule = useMemo(
    () => modules.find((item) => item.id === permissionForm.module_id) || null,
    [modules, permissionForm.module_id]
  )

  const selectedAction = useMemo(
    () => ACTION_OPTIONS.find((item) => item.value === permissionForm.action_key) || null,
    [permissionForm.action_key]
  )

  const selectedResource = useMemo(
    () => resources.find((item) => item.id === permissionForm.resource_id) || null,
    [resources, permissionForm.resource_id]
  )

  const suggestedPermissionKey = useMemo(() => {
    const namespace = selectedResource?.module?.module_key || selectedModule?.module_key || ''
    if (!namespace || !permissionForm.action_key) return ''
    return `${namespace}.${permissionForm.action_key}`
  }, [selectedModule, selectedResource, permissionForm.action_key])

  const suggestedRoleKey = useMemo(() => slugifyKey(roleForm.role_name || ''), [roleForm.role_name])

  const filteredPermissions = useMemo(() => {
    return permissions.filter((item) => {
      if (permissionModuleFilter && item.module_id !== permissionModuleFilter) return false
      if (permissionStatusFilter === 'active' && !item.is_active) return false
      if (permissionStatusFilter === 'inactive' && item.is_active) return false
      if (!permissionSearch.trim()) return true
      const q = permissionSearch.trim().toLowerCase()
      return [
        item.permission_key,
        item.permission_name,
        item.action_key,
        item.module?.module_name,
        item.resource?.resource_name,
      ].some((value) => String(value || '').toLowerCase().includes(q))
    })
  }, [permissions, permissionModuleFilter, permissionStatusFilter, permissionSearch])

  const filteredRoles = useMemo(() => {
    return roles.filter((item) => {
      if (roleStatusFilter === 'active' && !item.is_active) return false
      if (roleStatusFilter === 'inactive' && item.is_active) return false
      if (!roleSearch.trim()) return true
      const q = roleSearch.trim().toLowerCase()
      return [
        item.role_key,
        item.role_name,
        item.description,
      ].some((value) => String(value || '').toLowerCase().includes(q))
    })
  }, [roles, roleSearch, roleStatusFilter])

  const permissionsByModule = useMemo(() => {
    return modules.map((moduleItem) => ({
      ...moduleItem,
      permissions: permissions.filter((permission) => permission.module_id === moduleItem.id),
    })).filter((item) => item.permissions.length > 0)
  }, [modules, permissions])

  const permissionTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredPermissions.length / permissionPageSize)),
    [filteredPermissions.length]
  )

  const paginatedPermissions = useMemo(() => {
    const start = (permissionPage - 1) * permissionPageSize
    return filteredPermissions.slice(start, start + permissionPageSize)
  }, [filteredPermissions, permissionPage])

  async function loadAll() {
    setLoading(true)
    const [modulesRes, resourcesRes, permissionsRes, rolesRes] = await Promise.all([
      fetch('/api/access/modules?active_only=false'),
      fetch('/api/access/resources?active_only=false'),
      fetch('/api/access/permissions?active_only=false'),
      fetch('/api/access/roles?active_only=false'),
    ])
    const [modulesJson, resourcesJson, permissionsJson, rolesJson] = await Promise.all([
      modulesRes.json().catch(() => ({})),
      resourcesRes.json().catch(() => ({})),
      permissionsRes.json().catch(() => ({})),
      rolesRes.json().catch(() => ({})),
    ])
    setModules(Array.isArray(modulesJson.data) ? modulesJson.data : [])
    setResources(Array.isArray(resourcesJson.data) ? resourcesJson.data : [])
    setPermissions(Array.isArray(permissionsJson.data) ? permissionsJson.data : [])
    setRoles(Array.isArray(rolesJson.data) ? rolesJson.data : [])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    setPermissionPage(1)
  }, [permissionSearch, permissionModuleFilter, permissionStatusFilter])

  useEffect(() => {
    if (permissionPage > permissionTotalPages) {
      setPermissionPage(permissionTotalPages)
    }
  }, [permissionPage, permissionTotalPages])

  function resetPermissionForm() {
    setEditingPermissionId(null)
    setPermissionForm({ ...EMPTY_PERMISSION_FORM })
  }

  function resetRoleForm() {
    setEditingRoleId(null)
    setRoleForm({ ...EMPTY_ROLE_FORM })
  }

  async function submitPermission() {
    const payload = {
      module_id: permissionForm.module_id,
      resource_id: permissionForm.resource_id || null,
      permission_name: permissionForm.permission_name.trim(),
      action_key: permissionForm.action_key,
      description: permissionForm.description.trim() || null,
      sort_order: Number(permissionForm.sort_order || 0),
      is_active: permissionForm.is_active,
    }

    if (!payload.module_id || !payload.permission_name || !payload.action_key) {
      setToast('Thiếu module, tên quyền hoặc action')
      return
    }

    setSavingPermission(true)
    const res = await fetch(editingPermissionId ? `/api/access/permissions/${editingPermissionId}` : '/api/access/permissions', {
      method: editingPermissionId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    setSavingPermission(false)
    if (!res.ok) {
      setToast(json.error || 'Không thể lưu permission')
      return
    }
    resetPermissionForm()
    await loadAll()
    setToast(editingPermissionId ? 'Đã cập nhật permission' : 'Đã tạo permission')
  }

  function beginEditPermission(item: PermissionItem) {
    setEditingPermissionId(item.id)
    setShowPermissionForm(true)
    setPermissionForm({
      module_id: item.module_id || '',
      resource_id: item.resource_id || '',
      permission_key: item.permission_key || '',
      permission_name: item.permission_name || '',
      action_key: item.action_key || 'read',
      description: item.description || '',
      sort_order: String(item.sort_order || 0),
      is_active: Boolean(item.is_active),
    })
  }

  async function togglePermissionActive(item: PermissionItem) {
    const res = await fetch(`/api/access/permissions/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !item.is_active }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json.error || 'Không thể cập nhật permission')
      return
    }
    await loadAll()
    setToast('Đã cập nhật trạng thái permission')
  }

  async function deletePermission(item: PermissionItem) {
    if (!confirm(`Xóa permission "${item.permission_name}"?`)) return
    const res = await fetch(`/api/access/permissions/${item.id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json.error || 'Không thể xóa permission')
      return
    }
    await loadAll()
    setToast('Đã xóa permission')
  }

  function toggleRolePermission(permissionId: string) {
    setRoleForm((prev) => {
      const has = prev.permission_ids.includes(permissionId)
      return {
        ...prev,
        permission_ids: has ? prev.permission_ids.filter((id) => id !== permissionId) : [...prev.permission_ids, permissionId],
      }
    })
  }

  async function submitRole() {
    const payload = {
      role_key: (roleForm.role_key.trim() || suggestedRoleKey).toLowerCase(),
      role_name: roleForm.role_name.trim(),
      description: roleForm.description.trim() || null,
      sort_order: Number(roleForm.sort_order || 0),
      is_active: roleForm.is_active,
      permission_ids: roleForm.permission_ids,
    }

    if (!payload.role_key || !payload.role_name) {
      setToast('Thiếu mã role hoặc tên role')
      return
    }

    setSavingRole(true)
    const res = await fetch(editingRoleId ? `/api/access/roles/${editingRoleId}` : '/api/access/roles', {
      method: editingRoleId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    setSavingRole(false)
    if (!res.ok) {
      setToast(json.error || 'Không thể lưu role')
      return
    }
    resetRoleForm()
    await loadAll()
    setToast(editingRoleId ? 'Đã cập nhật role' : 'Đã tạo role')
  }

  function beginEditRole(item: RoleItem) {
    setEditingRoleId(item.id)
    setShowRoleForm(true)
    setRoleForm({
      role_key: item.role_key || '',
      role_name: item.role_name || '',
      description: item.description || '',
      sort_order: String(item.sort_order || 0),
      is_active: Boolean(item.is_active),
      permission_ids: Array.isArray(item.permissions) ? item.permissions.map((permission) => permission.id) : [],
    })
  }

  async function toggleRoleActive(item: RoleItem) {
    const res = await fetch(`/api/access/roles/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !item.is_active, permission_ids: Array.isArray(item.permissions) ? item.permissions.map((p) => p.id) : [] }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json.error || 'Không thể cập nhật role')
      return
    }
    await loadAll()
    setToast('Đã cập nhật trạng thái role')
  }

  async function deleteRole(item: RoleItem) {
    if (!confirm(`Xóa role "${item.role_name}"?`)) return
    const res = await fetch(`/api/access/roles/${item.id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json.error || 'Không thể xóa role')
      return
    }
    await loadAll()
    setToast('Đã xóa role')
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>SETTINGS</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Vai trò, Quyền và Gán quyền</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
          Quản lý role hệ thống, permission kỹ thuật và bộ permission gắn cho từng role để dùng song song với users.role hiện tại.
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--panel)', padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 800 }}>Hướng dẫn sử dụng</div>
          <button className="btn ghost" onClick={() => setShowGuide((v) => !v)}>
            {showGuide ? 'Ẩn hướng dẫn' : 'Hiện hướng dẫn'}
          </button>
        </div>
        {showGuide ? (
          <div style={{ color: 'var(--text2)', lineHeight: 1.7 }}>
            <div>1. Permission là quyền kỹ thuật như xem, sửa, duyệt, quản lý.</div>
            <div>2. Role là gói quyền để gán cho user. Một role có thể gồm nhiều permission.</div>
            <div>3. users.role hiện tại vẫn giữ nguyên. Phần role mới này là lớp mở rộng để chuẩn hóa dần.</div>
            <div>4. Sau khi tạo role, vào trang Users để gắn role membership cho từng người dùng.</div>
          </div>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: showPermissionForm ? 12 : 0 }}>
            <div style={{ fontWeight: 800 }}>{editingPermissionId ? 'Sửa permission' : 'Tạo permission mới'}</div>
            <button className="btn ghost" onClick={() => setShowPermissionForm((v) => !v)}>
              {showPermissionForm ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
          {showPermissionForm ? (
            <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Module</span>
              <select value={permissionForm.module_id} onChange={(e) => setPermissionForm((p) => ({ ...p, module_id: e.target.value, resource_id: '' }))}>
                <option value="">Chọn module</option>
                {modules.map((item) => (
                  <option key={item.id} value={item.id}>{item.module_name}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Resource</span>
              <select value={permissionForm.resource_id} onChange={(e) => setPermissionForm((p) => ({ ...p, resource_id: e.target.value }))}>
                <option value="">(không bắt buộc)</option>
                {filteredResources.map((item) => (
                  <option key={item.id} value={item.id}>{item.resource_name}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Loại action</span>
              <select value={permissionForm.action_key} onChange={(e) => setPermissionForm((p) => ({ ...p, action_key: e.target.value }))}>
                {ACTION_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Thứ tự</span>
              <input value={permissionForm.sort_order} onChange={(e) => setPermissionForm((p) => ({ ...p, sort_order: e.target.value }))} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr auto', gap: 10, marginTop: 10, alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Mã permission</span>
              <input value={suggestedPermissionKey} readOnly style={{ opacity: 0.85 }} />
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Tự sinh theo resource/module và action để tránh nhập sai key.</div>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Tên permission</span>
              <input value={permissionForm.permission_name} onChange={(e) => setPermissionForm((p) => ({ ...p, permission_name: e.target.value }))} placeholder={`VD: ${selectedAction?.label || 'Xem'} ${selectedModule?.module_name || 'dữ liệu'}`} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Mô tả</span>
              <input value={permissionForm.description} onChange={(e) => setPermissionForm((p) => ({ ...p, description: e.target.value }))} placeholder="Mô tả ngắn" />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input type="checkbox" checked={permissionForm.is_active} onChange={(e) => setPermissionForm((p) => ({ ...p, is_active: e.target.checked }))} />
              Active
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={submitPermission} disabled={savingPermission}>{savingPermission ? 'Đang lưu...' : editingPermissionId ? 'Lưu permission' : '+ Tạo permission'}</button>
            {editingPermissionId ? <button className="btn ghost" onClick={resetPermissionForm}>Hủy sửa</button> : null}
          </div>
            </>
          ) : null}
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: 14, borderBottom: showPermissionList ? '1px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: showPermissionList ? 12 : 0 }}>
              <div style={{ fontWeight: 800 }}>Mã quyền</div>
              <button className="btn ghost" onClick={() => setShowPermissionList((v) => !v)}>
                {showPermissionList ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            {showPermissionList ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 160px', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span>Tìm permission</span>
                  <input value={permissionSearch} onChange={(e) => setPermissionSearch(e.target.value)} placeholder="Tìm mã quyền, tên quyền, action..." />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span>Lọc theo module</span>
                  <select value={permissionModuleFilter} onChange={(e) => setPermissionModuleFilter(e.target.value)}>
                    <option value="">Tất cả module</option>
                    {modules.map((item) => (
                      <option key={item.id} value={item.id}>{item.module_name}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span>Trạng thái</span>
                  <select value={permissionStatusFilter} onChange={(e) => setPermissionStatusFilter(e.target.value)}>
                    <option value="all">Tất cả</option>
                    <option value="active">Đang bật</option>
                    <option value="inactive">Đang tắt</option>
                  </select>
                </label>
              </div>
            ) : null}
          </div>
          {showPermissionList ? (
            <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['Mã quyền', 'Tên quyền', 'Module / Resource', 'Action', 'Roles', 'Trạng thái', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 20 }}>Đang tải...</td></tr>
              ) : paginatedPermissions.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 20 }}>Chưa có permission</td></tr>
              ) : paginatedPermissions.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono',monospace", color: 'var(--blue)' }}>{item.permission_key}</td>
                  <td style={{ padding: '10px 12px' }}>{item.permission_name}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text3)' }}>
                    <div>{item.module?.module_name || '-'}</div>
                    <div style={{ fontSize: 11 }}>{item.resource?.resource_name || '(không gắn resource)'}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>{item.action_key}</td>
                  <td style={{ padding: '10px 12px' }}>{item._count?.role_permissions || 0}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className="chip" style={{ color: item.is_active ? '#34d399' : '#94a3b8' }}>{item.is_active ? 'active' : 'inactive'}</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn ghost" onClick={() => beginEditPermission(item)}>Sửa</button>
                      <button className="btn ghost" onClick={() => togglePermissionActive(item)}>{item.is_active ? 'Tắt' : 'Bật'}</button>
                      <button className="btn ghost" onClick={() => deletePermission(item)}>Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {filteredPermissions.length === 0 ? '0 permission' : `${(permissionPage - 1) * permissionPageSize + 1}-${Math.min(permissionPage * permissionPageSize, filteredPermissions.length)} / ${filteredPermissions.length} permission`}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost" disabled={permissionPage <= 1} onClick={() => setPermissionPage((p) => Math.max(1, p - 1))}>Trước</button>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text2)' }}>Trang {permissionPage}/{permissionTotalPages}</div>
              <button className="btn ghost" disabled={permissionPage >= permissionTotalPages} onClick={() => setPermissionPage((p) => Math.min(permissionTotalPages, p + 1))}>Sau</button>
            </div>
          </div>
            </>
          ) : null}
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: showRoleForm ? 12 : 0 }}>
            <div style={{ fontWeight: 800 }}>{editingRoleId ? 'Sửa role' : 'Tạo role mới'}</div>
            <button className="btn ghost" onClick={() => setShowRoleForm((v) => !v)}>
              {showRoleForm ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
          {showRoleForm ? (
            <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Mã role</span>
              <input value={roleForm.role_key} onChange={(e) => setRoleForm((p) => ({ ...p, role_key: e.target.value }))} placeholder="vd: mod" />
              {!roleForm.role_key && suggestedRoleKey ? <div style={{ fontSize: 11, color: 'var(--text3)' }}>Tự sinh từ tên: {suggestedRoleKey}</div> : null}
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Tên role</span>
              <input value={roleForm.role_name} onChange={(e) => setRoleForm((p) => ({ ...p, role_name: e.target.value }))} placeholder="Điều phối / Moderation" />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Thứ tự</span>
              <input value={roleForm.sort_order} onChange={(e) => setRoleForm((p) => ({ ...p, sort_order: e.target.value }))} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input type="checkbox" checked={roleForm.is_active} onChange={(e) => setRoleForm((p) => ({ ...p, is_active: e.target.checked }))} />
              Active
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            <span>Mô tả</span>
            <input value={roleForm.description} onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))} placeholder="Mô tả vai trò" />
          </label>

          <div style={{ marginTop: 12, fontWeight: 700 }}>Permission gắn cho role</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 10 }}>
            {permissionsByModule.map((moduleItem) => (
              <div key={moduleItem.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{moduleItem.module_name}</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {moduleItem.permissions.map((permission) => (
                    <label key={permission.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <input type="checkbox" checked={roleForm.permission_ids.includes(permission.id)} onChange={() => toggleRolePermission(permission.id)} />
                      <span>{permission.permission_name}</span>
                      <span style={{ color: 'var(--text3)' }}>({permission.permission_key})</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={submitRole} disabled={savingRole}>{savingRole ? 'Đang lưu...' : editingRoleId ? 'Lưu role' : '+ Tạo role'}</button>
            {editingRoleId ? <button className="btn ghost" onClick={resetRoleForm}>Hủy sửa</button> : null}
          </div>
            </>
          ) : null}
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: 14, borderBottom: showRoleList ? '1px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: showRoleList ? 12 : 0 }}>
              <div style={{ fontWeight: 800 }}>Mã role</div>
              <button className="btn ghost" onClick={() => setShowRoleList((v) => !v)}>
                {showRoleList ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            {showRoleList ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 220px', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span>Tìm role</span>
                  <input value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} placeholder="Tìm mã role, tên role..." />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span>Trạng thái</span>
                  <select value={roleStatusFilter} onChange={(e) => setRoleStatusFilter(e.target.value)}>
                    <option value="all">Tất cả</option>
                    <option value="active">Đang bật</option>
                    <option value="inactive">Đang tắt</option>
                  </select>
                </label>
              </div>
            ) : null}
          </div>
          {showRoleList ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['Mã role', 'Tên role', 'Permission', 'Users', 'Loại', 'Trạng thái', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 20 }}>Đang tải...</td></tr>
              ) : filteredRoles.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 20 }}>Chưa có role</td></tr>
              ) : filteredRoles.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono',monospace", color: 'var(--blue)' }}>{item.role_key}</td>
                  <td style={{ padding: '10px 12px' }}>{item.role_name}</td>
                  <td style={{ padding: '10px 12px' }}>{item._count?.role_permissions || 0}</td>
                  <td style={{ padding: '10px 12px' }}>{item._count?.user_memberships || 0}</td>
                  <td style={{ padding: '10px 12px' }}>{item.is_system ? 'Hệ thống' : 'Tự tạo'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className="chip" style={{ color: item.is_active ? '#34d399' : '#94a3b8' }}>{item.is_active ? 'active' : 'inactive'}</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn ghost" onClick={() => beginEditRole(item)}>Sửa</button>
                      <button className="btn ghost" onClick={() => toggleRoleActive(item)}>{item.is_active ? 'Tắt' : 'Bật'}</button>
                      {!item.is_system ? <button className="btn ghost" onClick={() => deleteRole(item)}>Xóa</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          ) : null}
        </div>
      </div>

      {toast ? (
        <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 1000 }} className="card">
          <div style={{ padding: '9px 12px', fontSize: 12 }}>{toast}</div>
        </div>
      ) : null}
    </div>
  )
}
