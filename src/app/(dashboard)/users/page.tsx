'use client'

import { useState, useEffect, useCallback } from 'react'
import type { User } from '@/types'

type GroupOption = {
  id: string
  group_key: string
  group_name: string
  is_active: boolean
}

type AccountTypeOption = {
  id: string
  account_type_key: string
  account_type_name: string
  is_active: boolean
}

type AccessRoleOption = {
  id: string
  role_key: string
  role_name: string
  is_active: boolean
}

type UserGroupRef = {
  id: string
  key: string
  name: string
  is_primary?: boolean
}

type UserAccountTypeRef = {
  id: string
  key: string
  name: string
  is_primary?: boolean
}

type UserAccessRoleRef = {
  id: string
  key: string
  name: string
  is_primary?: boolean
}

type UIUser = User & {
  groups?: UserGroupRef[]
  primary_group?: UserGroupRef | null
  account_types?: UserAccountTypeRef[]
  primary_account_type?: UserAccountTypeRef | null
  access_roles?: UserAccessRoleRef[]
  primary_access_role?: UserAccessRoleRef | null
}

function countLabel(total: number, noun: string) {
  return `${total} ${noun}`
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div className="card" style={{ width: '100%', maxWidth: 720, padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

function UserForm({
  initial,
  onSave,
  onCancel,
  isEdit,
  groups,
  accountTypes,
  accessRoles,
}: {
  initial?: Partial<UIUser & { password?: string }>
  onSave: (data: any) => Promise<void>
  onCancel: () => void
  isEdit?: boolean
  groups: GroupOption[]
  accountTypes: AccountTypeOption[]
  accessRoles: AccessRoleOption[]
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    username: initial?.username || '',
    password: '',
    full_name: initial?.full_name || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    avatar_url: initial?.avatar_url || '',
    employee_code: initial?.employee_code || '',
    job_title: initial?.job_title || '',
    group_ids: (initial?.groups || []).map((g) => g.id),
    primary_group_id: initial?.primary_group?.id || '',
    account_type_ids: (initial?.account_types || []).map((a) => a.id),
    primary_account_type_id: initial?.primary_account_type?.id || '',
    role_ids: (initial?.access_roles || []).map((r) => r.id),
    primary_role_id: initial?.primary_access_role?.id || '',
  })

  function toggleGroup(groupId: string) {
    setForm((prev) => {
      const has = prev.group_ids.includes(groupId)
      const nextIds = has ? prev.group_ids.filter((x) => x !== groupId) : [...prev.group_ids, groupId]
      const nextPrimary = has && prev.primary_group_id === groupId ? '' : prev.primary_group_id
      return { ...prev, group_ids: nextIds, primary_group_id: nextPrimary }
    })
  }

  function toggleAccountType(accountTypeId: string) {
    setForm((prev) => {
      const has = prev.account_type_ids.includes(accountTypeId)
      const nextIds = has ? prev.account_type_ids.filter((x) => x !== accountTypeId) : [...prev.account_type_ids, accountTypeId]
      const nextPrimary = has && prev.primary_account_type_id === accountTypeId ? '' : prev.primary_account_type_id
      return { ...prev, account_type_ids: nextIds, primary_account_type_id: nextPrimary }
    })
  }

  function toggleAccessRole(roleId: string) {
    setForm((prev) => {
      const has = prev.role_ids.includes(roleId)
      const nextIds = has ? prev.role_ids.filter((x) => x !== roleId) : [...prev.role_ids, roleId]
      const nextPrimary = has && prev.primary_role_id === roleId ? '' : prev.primary_role_id
      return { ...prev, role_ids: nextIds, primary_role_id: nextPrimary }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        password: form.password || undefined,
      }
      await onSave(isEdit ? payload : { ...payload, password: form.password })
    } catch (err: any) {
      setError(err.message || 'Save failed')
      setSaving(false)
      return
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <label className="label">Username *</label>
          <input
            className="input"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            required={!isEdit}
            disabled={isEdit}
            style={isEdit ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="label">{isEdit ? 'Mat khau moi (de trong = khong doi)' : 'Mat khau *'}</label>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required={!isEdit}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="label">Ho ten</label>
          <input className="input" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="label">Email</label>
          <input className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="label">So dien thoai</label>
          <input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="label">Ma nhan su</label>
          <input className="input" value={form.employee_code} onChange={(e) => setForm((f) => ({ ...f, employee_code: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="label">Chuc danh</label>
          <input className="input" value={form.job_title} onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="label">Avatar URL</label>
          <input className="input" value={form.avatar_url} onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ marginBottom: 14 }}>
          <label className="label">Gán nhóm làm việc</label>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, maxHeight: 180, overflowY: 'auto' }}>
            {groups.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có nhóm. Tạo tại /settings/groups</div>
            ) : (
              groups.map((g) => (
                <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
                  <input type="checkbox" checked={form.group_ids.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                  <span>{g.group_name}</span>
                  <span style={{ color: 'var(--text3)' }}>({g.group_key})</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="label">Gán loại tài khoản</label>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, maxHeight: 180, overflowY: 'auto' }}>
            {accountTypes.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có loại tài khoản. Tạo tại /settings/account-types</div>
            ) : (
              accountTypes.map((item) => (
                <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
                  <input type="checkbox" checked={form.account_type_ids.includes(item.id)} onChange={() => toggleAccountType(item.id)} />
                  <span>{item.account_type_name}</span>
                  <span style={{ color: 'var(--text3)' }}>({item.account_type_key})</span>
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
          <label className="label">Gán vai trò truy cập</label>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, maxHeight: 180, overflowY: 'auto' }}>
          {accessRoles.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có vai trò truy cập. Tạo tại /settings/access-control</div>
          ) : (
            accessRoles.map((item) => (
              <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
                <input type="checkbox" checked={form.role_ids.includes(item.id)} onChange={() => toggleAccessRole(item.id)} />
                <span>{item.role_name}</span>
                <span style={{ color: 'var(--text3)' }}>({item.role_key})</span>
              </label>
            ))
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div style={{ marginBottom: 14 }}>
          <label className="label">Nhóm chính</label>
          <select className="select" value={form.primary_group_id} onChange={(e) => setForm((f) => ({ ...f, primary_group_id: e.target.value }))}>
            <option value="">(khong chon)</option>
            {groups.filter((g) => form.group_ids.includes(g.id)).map((g) => (
              <option key={g.id} value={g.id}>{g.group_name}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label className="label">Loại tài khoản chính</label>
          <select className="select" value={form.primary_account_type_id} onChange={(e) => setForm((f) => ({ ...f, primary_account_type_id: e.target.value }))}>
            <option value="">(khong chon)</option>
            {accountTypes.filter((a) => form.account_type_ids.includes(a.id)).map((a) => (
              <option key={a.id} value={a.id}>{a.account_type_name}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label className="label">Vai trò truy cập chính</label>
          <select className="select" value={form.primary_role_id} onChange={(e) => setForm((f) => ({ ...f, primary_role_id: e.target.value }))}>
            <option value="">(khong chon)</option>
            {accessRoles.filter((r) => form.role_ids.includes(r.id)).map((r) => (
              <option key={r.id} value={r.id}>{r.role_name}</option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div style={{ padding: '9px 12px', borderRadius: 8, background: '#EF444415', border: '1px solid #EF444430', color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Huy</button>
        <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={saving}>
          {saving ? 'Dang luu...' : isEdit ? 'Cap nhat' : 'Tao user'}
        </button>
      </div>
    </form>
  )
}

export default function UsersPage() {
  const [users, setUsers] = useState<UIUser[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [accountTypes, setAccountTypes] = useState<AccountTypeOption[]>([])
  const [accessRoles, setAccessRoles] = useState<AccessRoleOption[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<UIUser | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ ...(search && { search }) })
    const res = await fetch(`/api/users?${params}`)
    const json = await res.json()
    setUsers(json.data || [])
    setTotal((json.data || []).length)
    setLoading(false)
  }, [search])

  const loadGroups = useCallback(async () => {
    const res = await fetch('/api/groups?active_only=true')
    const json = await res.json()
    setGroups(Array.isArray(json.data) ? json.data : [])
  }, [])

  const loadAccountTypes = useCallback(async () => {
    const res = await fetch('/api/account-types?active_only=true')
    const json = await res.json()
    setAccountTypes(Array.isArray(json.data) ? json.data : [])
  }, [])

  const loadAccessRoles = useCallback(async () => {
    const res = await fetch('/api/access/roles?active_only=true')
    const json = await res.json()
    setAccessRoles(Array.isArray(json.data) ? json.data : [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadGroups()
    loadAccountTypes()
    loadAccessRoles()
  }, [loadGroups, loadAccountTypes, loadAccessRoles])

  async function handleCreate(data: any) {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    setShowCreate(false)
    await load()
  }

  async function handleEdit(data: any) {
    if (!editUser) return
    const res = await fetch(`/api/users/${editUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    setEditUser(null)
    await load()
  }

  async function handleToggleActive(user: UIUser) {
    await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !user.is_active }),
    })
    await load()
  }

  async function handleDelete(user: UIUser) {
    if (!confirm(`Xoa user "${user.username}"?`)) return
    await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Quản lý người dùng</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{total} tài khoản</div>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ Tạo người dùng</button>
      </div>

      <div className="card" style={{ padding: '12px 14px', marginBottom: 14 }}>
        <input className="input" style={{ maxWidth: 420 }} placeholder="Tìm username, họ tên, email, SĐT, mã nhân sự..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              {['Tài khoản', 'Liên hệ', 'Nhóm làm việc', 'Loại tài khoản', 'Vai trò truy cập', 'Trạng thái', 'Đăng nhập cuối', ''].map((h) => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center' }}><span className="spinner" /></td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="table-row">
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)' }}>{u.username}</div>
                    <div style={{ fontSize: 12, marginTop: 2 }}>{u.full_name || '-'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{u.employee_code || '-'}</div>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>
                    <div>{u.phone || '-'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{u.email || '-'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{u.job_title || '-'}</div>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>
                    {u.groups && u.groups.length ? (
                      <div>
                        <div>{u.primary_group?.name || u.groups[0]?.name || '-'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{countLabel(u.groups.length, 'nhóm')}</div>
                      </div>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>
                    {u.account_types && u.account_types.length ? (
                      <div>
                        <div>{u.primary_account_type?.name || u.account_types[0]?.name || '-'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{countLabel(u.account_types.length, 'loại')}</div>
                      </div>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>
                    {u.access_roles && u.access_roles.length ? (
                      <div>
                        <div>{u.primary_access_role?.name || u.access_roles[0]?.name || '-'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {u.primary_access_role?.key || u.access_roles[0]?.key || u.role || '-'} | {countLabel(u.access_roles.length, 'vai trò')}
                        </div>
                      </div>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span className="badge" style={{ background: u.is_active ? '#22C55E15' : '#64748B15', color: u.is_active ? 'var(--green)' : 'var(--text3)' }}>
                      {u.is_active ? 'Hoat dong' : 'Da tat'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)' }}>
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString('vi-VN') : 'Chua dang nhap'}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid #F9731630', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }} onClick={() => setEditUser(u)}>Sua</button>
                      <button style={{ background: u.is_active ? '#64748B15' : '#22C55E15', color: u.is_active ? 'var(--text3)' : 'var(--green)', border: '1px solid transparent', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }} onClick={() => handleToggleActive(u)}>
                        {u.is_active ? 'Tat' : 'Bat'}
                      </button>
                      <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => handleDelete(u)}>Xoa</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate ? (
        <Modal title="Tạo người dùng mới" onClose={() => setShowCreate(false)}>
          <UserForm onSave={handleCreate} onCancel={() => setShowCreate(false)} groups={groups} accountTypes={accountTypes} accessRoles={accessRoles} />
        </Modal>
      ) : null}

      {editUser ? (
        <Modal title="Cập nhật người dùng" onClose={() => setEditUser(null)}>
          <UserForm initial={editUser} onSave={handleEdit} onCancel={() => setEditUser(null)} isEdit groups={groups} accountTypes={accountTypes} accessRoles={accessRoles} />
        </Modal>
      ) : null}
    </div>
  )
}
