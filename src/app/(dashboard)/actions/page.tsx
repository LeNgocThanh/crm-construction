'use client'

import { useEffect, useMemo, useState } from 'react'

type UserOption = {
  id: string
  username: string
  role: string
  full_name?: string | null
  primary_access_role?: { key?: string | null; name?: string | null } | null
  is_active?: boolean
}
type CustomerOption = { id: string; full_name?: string | null; phone_number?: string | null; status?: string | null }
type ActionRow = {
  id: string
  title: string
  detail?: string | null
  priority: string
  status: string
  due_at?: string | null
  created_at: string
  customer?: { id: string; full_name?: string | null; phone_number?: string | null } | null
  recipients?: Array<{ user?: { id: string; username: string } | null }>
}

export default function ActionsPage() {
  const [users, setUsers] = useState<UserOption[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [rows, setRows] = useState<ActionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [rowActionMode, setRowActionMode] = useState<Record<string, '' | 'reschedule' | 'cancel'>>({})
  const [rowReason, setRowReason] = useState<Record<string, string>>({})
  const [rowDueAt, setRowDueAt] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    customer_id: '',
    assigned_to: '',
    title: '',
    detail: '',
    priority: 'normal',
    due_at: '',
    is_internal: false,
  })
  const [formDuePreset, setFormDuePreset] = useState('')
  const [rowDuePreset, setRowDuePreset] = useState<Record<string, string>>({})

  const customerLabel = (c: CustomerOption) => `${c.full_name || '(Khong ten)'} ${c.phone_number ? `- ${c.phone_number}` : ''}`
  const userLabel = (u: UserOption) => {
    const name = String(u.full_name || '').trim()
    const username = String(u.username || '').trim()
    const roleLabel = String(u.primary_access_role?.name || u.primary_access_role?.key || u.role || '').trim()
    const title = name && username && name !== username ? `${name} (${username})` : (name || username || '-')
    return roleLabel ? `${title} (${roleLabel})` : title
  }

  async function load() {
    setLoading(true)
    const [uRes, cRes, aRes] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/customers?limit=300'),
      fetch('/api/work-suggestions?mine=0&bucket=all'),
    ])
    const [uJson, cJson, aJson] = await Promise.all([uRes.json(), cRes.json(), aRes.json()])
    setUsers((Array.isArray(uJson?.data) ? uJson.data : []).filter((u: any) => u?.is_active !== false))
    setCustomers(Array.isArray(cJson?.data) ? cJson.data : [])
    setRows(Array.isArray(aJson?.data) ? aJson.data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [rows])

  async function createAction() {
    if (!form.title.trim()) {
      setToast('Thieu tieu de')
      return
    }
    if (!form.is_internal && !form.customer_id) {
      setToast('Thieu khach hang')
      return
    }
    setSaving(true)
    const res = await fetch('/api/work-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: form.customer_id,
        assigned_to: form.assigned_to || null,
        title: form.title.trim(),
        detail: form.detail.trim() || null,
        priority: form.priority,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        is_internal: form.is_internal,
      }),
    })
    const j = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setToast(j?.error || 'Khong tao duoc action')
      return
    }
    setForm({ customer_id: form.customer_id, assigned_to: form.assigned_to, title: '', detail: '', priority: 'normal', due_at: '', is_internal: form.is_internal })
    setToast('Da tao action')
    await load()
  }

  function calcPresetDue(preset: string) {
    const now = new Date()
    const d = new Date(now)
    if (preset === 'end_today') {
      d.setHours(17, 30, 0, 0)
      return d
    }
    if (preset === 'plus_1d') {
      d.setDate(d.getDate() + 1)
      d.setHours(9, 0, 0, 0)
      return d
    }
    if (preset === 'plus_3d') {
      d.setDate(d.getDate() + 3)
      d.setHours(9, 0, 0, 0)
      return d
    }
    if (preset === 'plus_7d') {
      d.setDate(d.getDate() + 7)
      d.setHours(9, 0, 0, 0)
      return d
    }
    return null
  }

  function toLocalInputValue(date: Date) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  async function runAction(id: string, action: 'done' | 'reschedule' | 'cancel') {
    if (action === 'done') {
      const r = await fetch(`/api/work-suggestions/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'done' }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setToast(j?.error || 'That bai')
        return
      }
      setToast('Da xac nhan da xu ly xong')
      await load()
      return
    }
    if (action === 'reschedule') {
      const due = String(rowDueAt[id] || '').trim()
      const reason = String(rowReason[id] || '').trim()
      if (!due) {
        setToast('Can chon han moi')
        return
      }
      if (!reason) {
        setToast('Can ly do')
        return
      }
      const r = await fetch(`/api/work-suggestions/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reschedule', due_at: new Date(due).toISOString(), note: reason }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setToast(j?.error || 'That bai')
        return
      }
      setRowActionMode((p) => ({ ...p, [id]: '' }))
      setToast('Da cap nhat han')
      await load()
      return
    }
    if (action === 'cancel') {
      const reason = String(rowReason[id] || '').trim()
      if (!reason) {
        setToast('Can ly do huy')
        return
      }
      const r = await fetch(`/api/work-suggestions/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', note: reason }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setToast(j?.error || 'That bai')
        return
      }
      setRowActionMode((p) => ({ ...p, [id]: '' }))
      setToast('Da huy action')
      await load()
    }
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Actions</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Tao cong viec gan cho khach va nguoi phu trach (khong di qua next_action).</div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={form.is_internal}
              onChange={(e) => setForm((p) => ({ ...p, is_internal: e.target.checked, customer_id: e.target.checked ? '' : p.customer_id }))}
            />
            Action noi bo (khong gan truc tiep khach hang)
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Khach hang</div>
            <select
              className="select"
              disabled={form.is_internal}
              value={form.customer_id}
              onChange={(e) => setForm((p) => ({ ...p, customer_id: e.target.value }))}
            >
              <option value="">(chon khach hang)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{customerLabel(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Nguoi phu trach</div>
            <select className="select" value={form.assigned_to} onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))}>
              <option value="">(mac dinh la toi)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{userLabel(u)}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Do uu tien</div>
            <select className="select" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
              <option value="urgent">urgent</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tieu de</div>
            <input className="input" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Vi du: Goi xac nhan lich gap" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Han xu ly</div>
            <input className="input" type="datetime-local" value={form.due_at} onChange={(e) => setForm((p) => ({ ...p, due_at: e.target.value }))} />
            <div style={{ marginTop: 6 }}>
              <select
                className="select"
                value={formDuePreset}
                onChange={(e) => {
                  const v = e.target.value
                  setFormDuePreset(v)
                  const due = calcPresetDue(v)
                  if (due) setForm((p) => ({ ...p, due_at: toLocalInputValue(due) }))
                }}
              >
                <option value="">(preset han xu ly)</option>
                <option value="end_today">Cuoi ngay hom nay (17:30)</option>
                <option value="plus_1d">+1 ngay (09:00)</option>
                <option value="plus_3d">+3 ngay (09:00)</option>
                <option value="plus_7d">+7 ngay (09:00)</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Chi tiet</div>
          <textarea className="input" style={{ minHeight: 72, resize: 'vertical' }} value={form.detail} onChange={(e) => setForm((p) => ({ ...p, detail: e.target.value }))} placeholder="Mo ta cong viec..." />
        </div>

        <button className="btn-primary" onClick={createAction} disabled={saving}>{saving ? 'Dang tao...' : 'Tao action'}</button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)' }}>
          Danh sach action gan day
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              {['Khach hang', 'Tieu de', 'Phu trach', 'Trang thai', 'Uu tien', 'Han', 'Tao luc', 'Thao tac'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: 'var(--text3)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 16 }}>Dang tai...</td></tr>
            ) : sortedRows.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 16 }}>Chua co du lieu</td></tr>
            ) : sortedRows.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 10px' }}>
                  {r.customer?.id ? (r.customer.full_name || r.customer.phone_number || '-') : <span style={{ color: 'var(--orange)' }}>[Noi bo]</span>}
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ fontWeight: 700 }}>{r.title}</div>
                  {r.detail ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>{r.detail}</div> : null}
                  {!r.customer?.id ? <div style={{ fontSize: 11, color: 'var(--orange)' }}>[Noi bo]</div> : null}
                </td>
                <td style={{ padding: '8px 10px' }}>{r.recipients?.[0]?.user?.username || '-'}</td>
                <td style={{ padding: '8px 10px' }}>{r.status}</td>
                <td style={{ padding: '8px 10px' }}>{r.priority}</td>
                <td style={{ padding: '8px 10px' }}>
                  {r.due_at ? (
                    <div>
                      <div>{new Date(r.due_at).toLocaleString('vi-VN')}</div>
                      {['pending', 'accepted', 'assigned'].includes(String(r.status || '').toLowerCase()) && new Date(r.due_at).getTime() < Date.now() ? (
                        <div style={{ fontSize: 11, color: 'var(--red)' }}>Qua han chua hoan thanh</div>
                      ) : null}
                    </div>
                  ) : '-'}
                </td>
                <td style={{ padding: '8px 10px' }}>{new Date(r.created_at).toLocaleString('vi-VN')}</td>
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['pending', 'accepted', 'assigned'].includes(String(r.status || '').toLowerCase()) ? (
                      <>
                        <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => runAction(r.id, 'done')}>Done</button>
                        <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setRowActionMode((p) => ({ ...p, [r.id]: p[r.id] === 'reschedule' ? '' : 'reschedule' }))}>Gia han</button>
                        <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11, color: 'var(--red)' }} onClick={() => setRowActionMode((p) => ({ ...p, [r.id]: p[r.id] === 'cancel' ? '' : 'cancel' }))}>Huy</button>
                      </>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>-</span>
                    )}
                  </div>
                  {rowActionMode[r.id] === 'reschedule' && (
                    <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                      <select
                        className="select"
                        value={rowDuePreset[r.id] || ''}
                        onChange={(e) => {
                          const v = e.target.value
                          setRowDuePreset((p) => ({ ...p, [r.id]: v }))
                          const due = calcPresetDue(v)
                          if (due) setRowDueAt((p) => ({ ...p, [r.id]: toLocalInputValue(due) }))
                        }}
                      >
                        <option value="">(preset han moi)</option>
                        <option value="end_today">Cuoi ngay hom nay (17:30)</option>
                        <option value="plus_1d">+1 ngay (09:00)</option>
                        <option value="plus_3d">+3 ngay (09:00)</option>
                        <option value="plus_7d">+7 ngay (09:00)</option>
                      </select>
                      <input
                        className="input"
                        type="datetime-local"
                        value={rowDueAt[r.id] || ''}
                        onChange={(e) => setRowDueAt((p) => ({ ...p, [r.id]: e.target.value }))}
                      />
                      <select
                        className="select"
                        value={rowReason[r.id] || ''}
                        onChange={(e) => setRowReason((p) => ({ ...p, [r.id]: e.target.value }))}
                      >
                        <option value="">(chon ly do gia han)</option>
                        <option value="Khach xin doi lich">Khach xin doi lich</option>
                        <option value="Cho du lieu bo sung">Cho du lieu bo sung</option>
                        <option value="Can phoi hop noi bo">Can phoi hop noi bo</option>
                        <option value="Ban ron chua xu ly kip">Ban ron chua xu ly kip</option>
                      </select>
                      <button className="btn-primary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => runAction(r.id, 'reschedule')}>Xac nhan gia han</button>
                    </div>
                  )}
                  {rowActionMode[r.id] === 'cancel' && (
                    <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                      <select
                        className="select"
                        value={rowReason[r.id] || ''}
                        onChange={(e) => setRowReason((p) => ({ ...p, [r.id]: e.target.value }))}
                      >
                        <option value="">(chon ly do huy)</option>
                        <option value="Khach khong con nhu cau">Khach khong con nhu cau</option>
                        <option value="Trung task, khong can tiep tuc">Trung task, khong can tiep tuc</option>
                        <option value="Thong tin khong con phu hop">Thong tin khong con phu hop</option>
                        <option value="Chuyen sang action khac">Chuyen sang action khac</option>
                      </select>
                      <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11, color: 'var(--red)' }} onClick={() => runAction(r.id, 'cancel')}>Xac nhan huy</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast ? (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 999 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
