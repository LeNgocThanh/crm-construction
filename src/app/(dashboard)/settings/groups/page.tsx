'use client'

import { useEffect, useState } from 'react'

type GroupItem = {
  id: string
  group_key: string
  group_name: string
  description?: string | null
  is_active: boolean
  _count?: { memberships?: number }
}

const EMPTY_FORM = {
  group_key: '',
  group_name: '',
  description: '',
  is_active: true,
}

export default function SettingsGroupsPage() {
  const [items, setItems] = useState<GroupItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  async function load() {
    setLoading(true)
    const r = await fetch('/api/groups')
    const j = await r.json()
    setItems(Array.isArray(j.data) ? j.data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function submit() {
    const payload = {
      group_key: form.group_key.trim().toLowerCase(),
      group_name: form.group_name.trim(),
      description: form.description.trim() || null,
      is_active: form.is_active,
    }
    if (!payload.group_key || !payload.group_name) {
      showToast('Thieu group_key hoac group_name')
      return
    }

    setSaving(true)
    const res = await fetch(editingId ? `/api/groups/${editingId}` : '/api/groups', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      showToast(j.error || 'Khong the luu group')
      return
    }
    setForm({ ...EMPTY_FORM })
    setEditingId(null)
    await load()
    showToast(editingId ? 'Da cap nhat group' : 'Da tao group')
  }

  function beginEdit(g: GroupItem) {
    setEditingId(g.id)
    setForm({
      group_key: g.group_key || '',
      group_name: g.group_name || '',
      description: g.description || '',
      is_active: Boolean(g.is_active),
    })
  }

  async function removeGroup(g: GroupItem) {
    if (!confirm(`Xoa group "${g.group_name}"?`)) return
    const r = await fetch(`/api/groups/${g.id}`, { method: 'DELETE' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      showToast(j.error || 'Khong the xoa group')
      return
    }
    await load()
    showToast('Da xoa group')
  }

  async function toggleActive(g: GroupItem) {
    const r = await fetch(`/api/groups/${g.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !g.is_active }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      showToast(j.error || 'Khong the cap nhat')
      return
    }
    await load()
    showToast('Da cap nhat trang thai')
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Quan ly Groups</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Danh muc nhom de gan user/cham soc khach hang</div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.2, color: 'var(--text3)', marginBottom: 8 }}>
          {editingId ? 'CAP NHAT GROUP' : 'TAO GROUP MOI'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.6fr auto auto', gap: 8, alignItems: 'center' }}>
          <input className="input" placeholder="group_key (vd: team_a)" value={form.group_key} onChange={(e) => setForm((p) => ({ ...p, group_key: e.target.value }))} />
          <input className="input" placeholder="Ten nhom" value={form.group_name} onChange={(e) => setForm((p) => ({ ...p, group_name: e.target.value }))} />
          <input className="input" placeholder="Mo ta" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
            Active
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-primary" disabled={saving} onClick={submit}>{editingId ? 'Cap nhat' : '+ Tao'}</button>
            {editingId ? (
              <button
                className="btn-ghost"
                onClick={() => {
                  setEditingId(null)
                  setForm({ ...EMPTY_FORM })
                }}
              >
                Huy
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              {['Group key', 'Ten nhom', 'Mo ta', 'Members', 'Trang thai', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text3)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 20 }}>Dang tai...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 20 }}>Chua co group</td></tr>
            ) : items.map((g) => (
              <tr key={g.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono',monospace", color: 'var(--blue)' }}>{g.group_key}</td>
                <td style={{ padding: '10px 12px' }}>{g.group_name}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text3)' }}>{g.description || '-'}</td>
                <td style={{ padding: '10px 12px' }}>{g._count?.memberships || 0}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 99,
                    fontSize: 11,
                    color: g.is_active ? 'var(--green)' : 'var(--text3)',
                    background: g.is_active ? 'rgba(34,197,94,.12)' : 'rgba(100,116,139,.12)',
                  }}
                  >
                    {g.is_active ? 'active' : 'inactive'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-ghost" style={{ padding: '4px 10px' }} onClick={() => beginEdit(g)}>Sua</button>
                    <button className="btn-ghost" style={{ padding: '4px 10px' }} onClick={() => toggleActive(g)}>{g.is_active ? 'Tat' : 'Bat'}</button>
                    <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => removeGroup(g)}>Xoa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast ? (
        <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 1000 }} className="card">
          <div style={{ padding: '9px 12px', fontSize: 12 }}>{toast}</div>
        </div>
      ) : null}
    </div>
  )
}

