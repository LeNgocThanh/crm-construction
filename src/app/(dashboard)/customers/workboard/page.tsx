'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getUserDisplayLabel } from '@/lib/user-display'

type WorkItem = {
  id: string
  full_name?: string | null
  phone_number?: string | null
  status?: string | null
  type?: string | null
  source?: string | null
  next_action?: string | null
  active_care_pipeline_phase?: string | null
  active_care_activity_id?: string | null
  active_care_status?: string | null
  active_care_priority?: string | null
  active_care_due_at?: string | null
  active_care_owner_id?: string | null
  active_care_created_at?: string | null
  active_care_happened_at?: string | null
  updated_at: string
  assignee?: { id: string; username: string } | null
  last_timeline?: { type?: string | null; title?: string | null; description?: string | null; happened_at?: string | null } | null
  last_contact?: { source?: string | null; contact_date?: string | null } | null
}
type UserOption = {
  id: string
  username: string
  full_name?: string | null
  role?: string | null
  primary_access_role?: { key?: string | null; name?: string | null } | null
  is_active?: boolean
}

export default function CustomersWorkboardPage() {
  const [rows, setRows] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [ctype, setCtype] = useState('')
  const [mine, setMine] = useState(false)
  const [phase, setPhase] = useState('')
  const [hasNextAction, setHasNextAction] = useState(false)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({})
  const [quickActionMap, setQuickActionMap] = useState<Record<string, string>>({})
  const [quickTimelineMap, setQuickTimelineMap] = useState<Record<string, string>>({})
  const [editingActionMap, setEditingActionMap] = useState<Record<string, boolean>>({})
  const [originalActionMap, setOriginalActionMap] = useState<Record<string, string>>({})
  const [users, setUsers] = useState<UserOption[]>([])

  async function load() {
    setLoading(true)
    const q = new URLSearchParams()
    if (search.trim()) q.set('search', search.trim())
    if (status) q.set('status', status)
    if (ctype) q.set('type', ctype)
    if (phase) q.set('pipeline_phase', phase)
    if (mine) q.set('mine', '1')
    if (hasNextAction) q.set('has_next_action', '1')
    if (overdueOnly) q.set('overdue_only', '1')
    q.set('limit', '120')
    const r = await fetch(`/api/customers/workboard?${q.toString()}`)
    const j = await r.json()
    setRows(Array.isArray(j.data) ? j.data : [])
    setLoading(false)
  }

  async function loadUsers() {
    const r = await fetch('/api/users')
    const j = await r.json()
    const list = Array.isArray(j.data) ? j.data : []
    setUsers(list.filter((u: any) => u?.is_active !== false))
  }

  useEffect(() => { load() }, [status, ctype, phase, mine, hasNextAction, overdueOnly])
  useEffect(() => { loadUsers() }, [])

  function setSaving(id: string, value: boolean) {
    setSavingMap((prev) => ({ ...prev, [id]: value }))
  }

  async function saveNextAction(id: string) {
    const raw = String(quickActionMap[id] ?? '').trim()
    const row = rows.find((x) => x.id === id)
    const activityId = row?.active_care_activity_id || null
    setSaving(id, true)
    try {
      if (activityId) {
        await fetch(`/api/customers/${id}/care-activities/${activityId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: raw || 'Hanh dong can lam',
            next_action_snapshot: raw || null,
            pipeline_phase: row?.active_care_pipeline_phase || 'general',
          }),
        })
      } else {
        await fetch(`/api/customers/${id}/care-activities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activity_type: 'next_action',
            summary: raw || 'Hanh dong can lam',
            next_action_snapshot: raw || null,
            pipeline_phase: phase || 'general',
            status: 'open',
          }),
        })
      }
      await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next_action: raw || null }),
      })
      await load()
    } finally {
      setSaving(id, false)
    }
  }

  function openActionEditor(id: string, currentValue: string | null | undefined) {
    const curr = String(currentValue || '')
    setOriginalActionMap((prev) => ({ ...prev, [id]: curr }))
    setQuickActionMap((prev) => ({ ...prev, [id]: (prev[id] ?? curr) }))
    setEditingActionMap((prev) => ({ ...prev, [id]: true }))
  }

  async function closeActionEditor(id: string) {
    const original = String(originalActionMap[id] ?? '')
    const draft = String(quickActionMap[id] ?? '')
    const changed = original.trim() !== draft.trim()
    if (changed) {
      const shouldSave = window.confirm('Next action da thay doi. Ban co muon luu khong?')
      if (shouldSave) {
        await saveNextAction(id)
      } else {
        setQuickActionMap((prev) => ({ ...prev, [id]: original }))
      }
    }
    setEditingActionMap((prev) => ({ ...prev, [id]: false }))
  }

  async function markDoneAction(id: string, actionText?: string | null, actionCreatedAt?: string | null) {
    const doneText = String(actionText || quickActionMap[id] || '').trim()
    const row = rows.find((x) => x.id === id)
    const activityId = row?.active_care_activity_id || null
    const createdAtText = actionCreatedAt
      ? new Date(actionCreatedAt).toLocaleString('vi-VN')
      : null
    const doneDescription = doneText
      ? `xác nhận xong "${doneText}"${createdAtText ? ` (tạo lúc ${createdAtText})` : ''}`
      : 'xác nhận hoàn tất hành động cần làm'
    setSaving(id, true)
    try {
      if (activityId) {
        await fetch(`/api/customers/${id}/care-activities/${activityId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'done',
            outcome: doneDescription,
            next_action_snapshot: null,
          }),
        })
      }
      await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next_action: null }),
      })
      await fetch(`/api/customers/${id}/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'note',
          title: 'Hoàn tất hành động cần làm',
          description: doneDescription,
        }),
      })
      setQuickActionMap((prev) => ({ ...prev, [id]: '' }))
      await load()
    } finally {
      setSaving(id, false)
    }
  }

  async function addQuickTimeline(id: string) {
    const note = String(quickTimelineMap[id] ?? '').trim()
    if (!note) return
    setSaving(id, true)
    try {
      await fetch(`/api/customers/${id}/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'note',
          title: 'Ghi chu nhanh',
          description: note,
        }),
      })
      setQuickTimelineMap((prev) => ({ ...prev, [id]: '' }))
      await load()
    } finally {
      setSaving(id, false)
    }
  }

  async function changeOwner(id: string, ownerId: string) {
    setSaving(id, true)
    try {
      await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: ownerId || null }),
      })
      await load()
    } finally {
      setSaving(id, false)
    }
  }

  const stats = useMemo(() => {
    return {
      total: rows.length,
      withNext: rows.filter((x) => Boolean(x.next_action)).length,
    }
  }, [rows])

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Workboard Khach hang</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Tong {stats.total} | Co next action {stats.withNext}
          </div>
        </div>
        <Link href="/customers" className="btn-ghost">Ve danh sach khach hang</Link>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr auto auto auto auto auto', gap: 8, alignItems: 'center' }}>
          <input className="input" placeholder="Tim ten, sdt, username..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tat ca status</option>
            <option value="Mới">Mới</option>
            <option value="Đang tìm hiểu">Đang tìm hiểu</option>
            <option value="Hẹn gặp">Hẹn gặp</option>
            <option value="Đang thương thảo">Đang thương thảo</option>
            <option value="Chờ ký HĐ">Chờ ký HĐ</option>
            <option value="Đã ký HĐ">Đã ký HĐ</option>
            <option value="Đang thi công">Đang thi công</option>
            <option value="Hoàn công">Hoàn công</option>
            <option value="Bảo hành">Bảo hành</option>
            <option value="Hoàn tất">Hoàn tất</option>
            <option value="Tạm ngưng">Tạm ngưng</option>
            <option value="Từ chối">Từ chối</option>
          </select>
          <select className="select" value={ctype} onChange={(e) => setCtype(e.target.value)}>
            <option value="">Loai customer</option>
            <option value="unverified">unverified</option>
            <option value="verified">verified</option>
          </select>
          <select className="select" value={phase} onChange={(e) => setPhase(e.target.value)}>
            <option value="">Tat ca phase</option>
            <option value="general">general</option>
            <option value="construction_pre_sale">construction_pre_sale</option>
            <option value="construction_execution">construction_execution</option>
            <option value="construction_aftercare">construction_aftercare</option>
          </select>
          <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
            Mine
          </label>
          <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={hasNextAction} onChange={(e) => setHasNextAction(e.target.checked)} />
            Has next
          </label>
          <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
            Overdue
          </label>
          <button className="btn-ghost" onClick={() => load()}>Tai lai</button>
          <button className="btn-primary" onClick={() => load()}>Ap dung</button>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              {['Khach hang', 'Trang thai', 'Next action', 'Timeline gan nhat', 'Lien he gan nhat', 'Phu trach', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text3)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 20 }}>Dang tai...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 20 }}>Khong co du lieu</td></tr>
            ) : rows.map((r) => {
              const timelineType = String(r.last_timeline?.type || '').trim()
              const timelineDesc = String(r.last_timeline?.description || '').trim()
              const timelineDescShort = timelineDesc.length > 110 ? `${timelineDesc.slice(0, 110)}...` : timelineDesc
              const saving = Boolean(savingMap[r.id])
              const draftAction = quickActionMap[r.id] ?? (r.next_action || '')
              const draftTimeline = quickTimelineMap[r.id] ?? ''
              return (
                <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 700 }}>{r.full_name || '(Khong ten)'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{r.phone_number || '-'}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>{r.status || '-'}</td>
                  <td style={{ padding: '10px 12px', maxWidth: 360 }}>
                    {r.active_care_pipeline_phase ? (
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>
                        phase: {r.active_care_pipeline_phase}
                      </div>
                    ) : null}
                    <div
                      style={{
                        position: 'relative',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        background: 'var(--surface)',
                        padding: editingActionMap[r.id] ? '8px 32px 8px 8px' : '8px 28px 8px 8px',
                        minHeight: 62,
                      }}
                    >
                      <button
                        title="Done"
                        onClick={() => markDoneAction(r.id, draftAction || r.next_action, r.active_care_created_at || null)}
                        disabled={saving}
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          width: 18,
                          height: 18,
                          borderRadius: 999,
                          border: '1px solid rgba(34,197,94,.45)',
                          background: 'rgba(34,197,94,.12)',
                          color: 'var(--green)',
                          fontSize: 10,
                          lineHeight: '16px',
                          cursor: saving ? 'not-allowed' : 'pointer',
                          padding: 0,
                        }}
                      >
                        ✓
                      </button>

                      {editingActionMap[r.id] ? (
                        <div>
                          <textarea
                            className="input"
                            value={draftAction}
                            onChange={(e) => setQuickActionMap((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            placeholder="Nhap next action..."
                            style={{ minHeight: 64, resize: 'vertical', fontSize: 11, lineHeight: 1.4, padding: '6px 8px' }}
                            disabled={saving}
                          />
                          <div style={{ marginTop: 6, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} disabled={saving} onClick={() => saveNextAction(r.id)}>Luu</button>
                            <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} disabled={saving} onClick={() => closeActionEditor(r.id)}>Dong</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => openActionEditor(r.id, r.next_action)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            border: 'none',
                            background: 'transparent',
                            padding: 0,
                            cursor: 'pointer',
                            fontSize: 11,
                            lineHeight: 1.4,
                            color: 'var(--text)',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            minHeight: 40,
                          }}
                          title="Click de sua next action"
                        >
                          {draftAction?.trim() || '-'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                      {timelineType ? (
                        <span style={{ fontSize: 10, color: 'var(--blue)', border: '1px solid var(--border2)', borderRadius: 6, padding: '1px 6px' }}>
                          {timelineType}
                        </span>
                      ) : null}
                      <span>{r.last_timeline?.title || '-'}</span>
                    </div>
                    {timelineDescShort ? (
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{timelineDescShort}</div>
                    ) : null}
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{r.last_timeline?.happened_at ? new Date(r.last_timeline.happened_at).toLocaleString('vi-VN') : ''}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>{r.last_contact?.contact_date ? new Date(r.last_contact.contact_date).toLocaleString('vi-VN') : '-'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <select
                      className="select"
                      value={r.assignee?.id || ''}
                      disabled={saving}
                      onChange={(e) => changeOwner(r.id, e.target.value)}
                      style={{ minWidth: 140, fontSize: 12 }}
                    >
                      <option value="">(chua gan)</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{getUserDisplayLabel(u)}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <Link href={`/customers/${r.id}`} className="btn-ghost" style={{ padding: '5px 10px' }}>Chi tiet</Link>
                    <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
                      <input
                        className="input"
                        value={draftTimeline}
                        onChange={(e) => setQuickTimelineMap((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="Them ghi chu timeline..."
                        disabled={saving}
                      />
                      <button className="btn-ghost" style={{ padding: '5px 8px' }} disabled={saving || !draftTimeline.trim()} onClick={() => addQuickTimeline(r.id)}>+TL</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
