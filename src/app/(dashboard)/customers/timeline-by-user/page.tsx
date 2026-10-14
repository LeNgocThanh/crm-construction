'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type UserOption = {
  id: string
  username: string
  role: string
  full_name?: string | null
  primary_access_role?: { key?: string | null; name?: string | null } | null
  is_active?: boolean
}
type TimelineRow = {
  id: string
  type: string
  title: string
  description?: string | null
  happened_at: string
  created_at: string
  due_at?: string | null
  deadline_status?: 'open' | 'overdue' | string
  action_status?: string
  action_priority?: string
  customer?: { id: string; full_name?: string | null; phone_number?: string | null; status?: string | null } | null
  creator?: { id: string; username: string; role?: string | null } | null
}

export default function TimelineByUserPage() {
  const [users, setUsers] = useState<UserOption[]>([])
  const [rows, setRows] = useState<TimelineRow[]>([])
  const [loading, setLoading] = useState(true)

  const [mine, setMine] = useState(true)
  const [userId, setUserId] = useState('')
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const userLabel = (u: UserOption) => {
    const name = String(u.full_name || '').trim()
    const username = String(u.username || '').trim()
    const roleLabel = String(u.primary_access_role?.name || u.primary_access_role?.key || u.role || '').trim()
    const title = name && username && name !== username ? `${name} (${username})` : (name || username || '-')
    return roleLabel ? `${title} (${roleLabel})` : title
  }

  async function loadUsers() {
    const res = await fetch('/api/users')
    const j = await res.json().catch(() => ({}))
    setUsers((Array.isArray(j?.data) ? j.data : []).filter((x: any) => x?.is_active !== false))
  }

  async function loadData() {
    setLoading(true)
    const q = new URLSearchParams()
    q.set('limit', '300')
    if (mine) q.set('mine', '1')
    if (!mine && userId) q.set('user_id', userId)
    if (type) q.set('type', type)
    if (search.trim()) q.set('search', search.trim())
    if (dateFrom) q.set('date_from', dateFrom)
    if (dateTo) q.set('date_to', dateTo)
    const res = await fetch(`/api/customers/timeline-by-user?${q.toString()}`)
    const j = await res.json().catch(() => ({}))
    setRows(Array.isArray(j?.data) ? j.data : [])
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])
  useEffect(() => { loadData() }, [mine, userId, type, dateFrom, dateTo])

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => new Date(b.happened_at).getTime() - new Date(a.happened_at).getTime())
  }, [rows])

  const stats = useMemo(() => {
    const total = rows.length
    const actionRows = rows.filter((r) => r.type === 'action_deadline')
    const overdue = actionRows.filter((r) => String(r.deadline_status || '') === 'overdue').length
    const openDue = actionRows.filter((r) => String(r.deadline_status || '') === 'open').length
    const customerSet = new Set(rows.map((r) => r.customer?.id).filter(Boolean))
    return { total, actionRows: actionRows.length, overdue, openDue, customers: customerSet.size }
  }, [rows])

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Timeline Theo Nhan Vien</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Theo doi lich su cham soc khach hang theo tung user.</div>
        </div>
        <Link href="/customers/workboard" className="btn-ghost">Ve Workboard</Link>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 8, marginBottom: 10 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Tong su kien</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.total}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Action co deadline</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.actionRows}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Qua han</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)' }}>{stats.overdue}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Chua toi han</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>{stats.openDue}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>So khach lien quan</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.customers}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
            Mine
          </label>
          <select className="select" value={userId} disabled={mine} onChange={(e) => setUserId(e.target.value)}>
            <option value="">(chon user)</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{userLabel(u)}</option>
            ))}
          </select>
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tat ca type</option>
            <option value="action_event">action_event</option>
            <option value="note">note</option>
            <option value="status_change">status_change</option>
            <option value="customer_created">customer_created</option>
            <option value="owner_changed">owner_changed</option>
          </select>
          <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <input className="input" placeholder="Tim title, mo ta, ten/sdt khach..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn-primary" onClick={loadData}>Loc</button>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              {['Thoi gian', 'User', 'Khach hang', 'Type', 'Title', 'Noi dung', 'Deadline'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: 'var(--text3)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 16 }}>Dang tai...</td></tr>
            ) : sortedRows.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 16 }}>Khong co du lieu</td></tr>
            ) : sortedRows.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{new Date(r.happened_at).toLocaleString('vi-VN')}</td>
                <td style={{ padding: '8px 10px' }}>{r.creator?.username || '-'}</td>
                <td style={{ padding: '8px 10px' }}>
                  {r.customer?.id ? (
                    <Link href={`/customers/${r.customer.id}`} style={{ color: 'var(--blue)', textDecoration: 'none' }}>
                      {r.customer.full_name || r.customer.phone_number || r.customer.id}
                    </Link>
                  ) : '-'}
                </td>
                <td style={{ padding: '8px 10px' }}>{r.type}</td>
                <td style={{ padding: '8px 10px', fontWeight: 700 }}>{r.title}</td>
                <td style={{ padding: '8px 10px', color: 'var(--text3)' }}>{r.description || '-'}</td>
                <td style={{ padding: '8px 10px' }}>
                  {r.due_at ? (
                    <div>
                      <div style={{ fontSize: 12 }}>{new Date(r.due_at).toLocaleString('vi-VN')}</div>
                      <div style={{ fontSize: 11, color: r.deadline_status === 'overdue' ? 'var(--red)' : 'var(--green)' }}>
                        {r.deadline_status === 'overdue' ? 'Qua han chua hoan thanh' : 'Chua toi han'}
                      </div>
                    </div>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
