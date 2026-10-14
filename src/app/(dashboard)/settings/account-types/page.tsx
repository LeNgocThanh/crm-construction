'use client'

import { useEffect, useMemo, useState } from 'react'

type AccountTypeItem = {
  id: string
  account_type_key: string
  account_type_name: string
  description?: string | null
  is_active: boolean
  _count?: { memberships?: number }
}

const EMPTY_FORM = {
  account_type_key: '',
  account_type_name: '',
  description: '',
  is_active: true,
}

function slugifyKey(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export default function SettingsAccountTypesPage() {
  const [items, setItems] = useState<AccountTypeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const suggestedKey = useMemo(() => slugifyKey(form.account_type_name || ''), [form.account_type_name])

  async function load() {
    setLoading(true)
    const r = await fetch('/api/account-types')
    const j = await r.json()
    setItems(Array.isArray(j.data) ? j.data : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function submit() {
    const payload = {
      account_type_key: (form.account_type_key.trim() || suggestedKey).toLowerCase(),
      account_type_name: form.account_type_name.trim(),
      description: form.description.trim() || null,
      is_active: form.is_active,
    }
    if (!payload.account_type_key || !payload.account_type_name) {
      showToast('Thieu ma hoac ten loai tai khoan')
      return
    }

    setSaving(true)
    const res = await fetch(editingId ? `/api/account-types/${editingId}` : '/api/account-types', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      showToast(j.error || 'Khong the luu loai tai khoan')
      return
    }

    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    await load()
    showToast(editingId ? 'Da cap nhat loai tai khoan' : 'Da tao loai tai khoan')
  }

  function beginEdit(item: AccountTypeItem) {
    setEditingId(item.id)
    setForm({
      account_type_key: item.account_type_key || '',
      account_type_name: item.account_type_name || '',
      description: item.description || '',
      is_active: Boolean(item.is_active),
    })
  }

  async function toggleActive(item: AccountTypeItem) {
    const r = await fetch(`/api/account-types/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !item.is_active }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      showToast(j.error || 'Khong the cap nhat')
      return
    }
    await load()
    showToast('Da cap nhat trang thai')
  }

  async function removeItem(item: AccountTypeItem) {
    if (!confirm(`Xoa loai tai khoan "${item.account_type_name}"?`)) return
    const r = await fetch(`/api/account-types/${item.id}`, { method: 'DELETE' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      showToast(j.error || 'Khong the xoa loai tai khoan')
      return
    }
    await load()
    showToast('Da xoa loai tai khoan')
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Quan ly Loai tai khoan</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Danh muc loai tai khoan de gan user, investor, doi tac, nha cung cap...</div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.2, color: 'var(--text3)', marginBottom: 8 }}>
          {editingId ? 'CAP NHAT LOAI TAI KHOAN' : 'TAO LOAI TAI KHOAN MOI'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.6fr auto auto', gap: 8, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ma loai tai khoan</div>
            <input
              className="input"
              placeholder="vd: investor"
              value={form.account_type_key}
              onChange={(e) => setForm((p) => ({ ...p, account_type_key: e.target.value }))}
            />
            {!form.account_type_key && suggestedKey ? (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Tu sinh tu ten: {suggestedKey}</div>
            ) : null}
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ten loai tai khoan</div>
            <input
              className="input"
              placeholder="Chu dau tu"
              value={form.account_type_name}
              onChange={(e) => setForm((p) => ({ ...p, account_type_name: e.target.value }))}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mo ta</div>
            <input
              className="input"
              placeholder="Mo ta ngan"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginTop: 18 }}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
            Active
          </label>
          <div style={{ display: 'flex', gap: 6, marginTop: 18 }}>
            <button className="btn-primary" disabled={saving} onClick={submit}>
              {editingId ? 'Cap nhat' : '+ Tao'}
            </button>
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
              {['Ma', 'Ten loai tai khoan', 'Mo ta', 'Users', 'Trang thai', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text3)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 20 }}>Dang tai...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 20 }}>Chua co loai tai khoan</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono',monospace", color: 'var(--blue)' }}>{item.account_type_key}</td>
                <td style={{ padding: '10px 12px' }}>{item.account_type_name}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text3)' }}>{item.description || '-'}</td>
                <td style={{ padding: '10px 12px' }}>{item._count?.memberships || 0}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 99,
                      fontSize: 11,
                      color: item.is_active ? 'var(--green)' : 'var(--text3)',
                      background: item.is_active ? 'rgba(34,197,94,.12)' : 'rgba(100,116,139,.12)',
                    }}
                  >
                    {item.is_active ? 'active' : 'inactive'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-ghost" style={{ padding: '4px 10px' }} onClick={() => beginEdit(item)}>Sua</button>
                    <button className="btn-ghost" style={{ padding: '4px 10px' }} onClick={() => toggleActive(item)}>{item.is_active ? 'Tat' : 'Bat'}</button>
                    <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => removeItem(item)}>Xoa</button>
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
