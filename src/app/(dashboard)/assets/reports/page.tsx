'use client'

import { useEffect, useMemo, useState } from 'react'
import { ASSET_STATUS_LABELS } from '@/lib/assets/dictionaries'
import { getUserDisplayLabel, getUserDisplayName } from '@/lib/user-display'

type AssetRow = {
  id: string
  asset_code: string
  asset_name: string
  status: string
  status_label?: string
  condition_status: string
  condition_status_label?: string
  asset_type_label?: string
  current_location?: string | null
  unit?: { id: string; unit_key: string; unit_name: string } | null
  current_holder?: { id: string; username: string } | null
  current_customer?: { id: string; full_name?: string | null; phone_number?: string | null } | null
  current_project?: { id: string; project_name?: string | null } | null
  last_action?: { id: string; event_key: string; title: string; happened_at: string } | null
}

type UserOption = { id: string; username: string; full_name?: string | null; role?: string | null; primary_access_role?: { key?: string | null; name?: string | null } | null }

type UserTimelineEvent = {
  id: string
  event_key: string
  title: string
  description?: string | null
  happened_at: string
  asset?: { id: string; asset_code: string; asset_name: string } | null
  actor?: { id: string; username: string } | null
  user_roles: string[]
}

export default function AssetReportsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')

  const [timelineRows, setTimelineRows] = useState<UserTimelineEvent[]>([])
  const [timelineSummary, setTimelineSummary] = useState({ total: 0, actor_count: 0, handover_from_count: 0, handover_to_count: 0 })
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineFilter, setTimelineFilter] = useState({ user_id: '', role: 'all', from: '', to: '' })

  async function loadAssets() {
    setLoading(true)
    const sp = new URLSearchParams()
    if (q.trim()) sp.set('q', q.trim())
    if (status) sp.set('status', status)
    const res = await fetch(`/api/assets?${sp.toString()}`)
    const j = await res.json().catch(() => ({}))
    setAssets(Array.isArray(j?.data) ? j.data : [])
    setLoading(false)
  }

  async function loadUsers() {
    const res = await fetch('/api/users')
    const j = await res.json().catch(() => ({}))
    const rows = Array.isArray(j?.data) ? j.data : []
    const normalized = rows.map((x: any) => ({ id: String(x.id), username: String(x.username || x.id), full_name: x.full_name || null, role: x.role || null, primary_access_role: x.primary_access_role || null }))
    setUsers(normalized)
    setTimelineFilter((p) => ({ ...p, user_id: p.user_id || normalized[0]?.id || '' }))
  }

  async function loadTimeline() {
    if (!timelineFilter.user_id) {
      setTimelineRows([])
      setTimelineSummary({ total: 0, actor_count: 0, handover_from_count: 0, handover_to_count: 0 })
      return
    }
    setTimelineLoading(true)
    const sp = new URLSearchParams()
    sp.set('user_id', timelineFilter.user_id)
    sp.set('role', timelineFilter.role || 'all')
    if (timelineFilter.from) sp.set('from', timelineFilter.from)
    if (timelineFilter.to) sp.set('to', timelineFilter.to)
    sp.set('limit', '300')
    const res = await fetch(`/api/assets/lifecycle-by-user?${sp.toString()}`)
    const j = await res.json().catch(() => ({}))
    setTimelineRows(Array.isArray(j?.data) ? j.data : [])
    setTimelineSummary(j?.summary || { total: 0, actor_count: 0, handover_from_count: 0, handover_to_count: 0 })
    setTimelineLoading(false)
  }

  useEffect(() => {
    loadAssets()
    loadUsers()
  }, [])

  const assetsByHolder = useMemo(() => {
    const map = new Map<string, { holderId: string; holderName: string; items: AssetRow[] }>()
    for (const a of assets) {
      const holderId = a.current_holder?.id || 'UNASSIGNED'
      const holderName = a.current_holder ? getUserDisplayName(a.current_holder) : 'Chưa có người giữ'
      const bucket = map.get(holderId) || { holderId, holderName, items: [] }
      bucket.items.push(a)
      map.set(holderId, bucket)
    }
    return Array.from(map.values()).sort((x, y) => y.items.length - x.items.length)
  }, [assets])

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>ASSET REPORTS</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Báo cáo tài sản</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Thống kê nhanh người giữ tài sản, danh sách tổng quan và timeline vận hành theo người.</div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr auto', gap: 8 }}>
          <input className="input" placeholder="Tìm mã/tên tài sản..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="available">{ASSET_STATUS_LABELS.available}</option>
            <option value="in_use">{ASSET_STATUS_LABELS.in_use}</option>
            <option value="maintenance">{ASSET_STATUS_LABELS.maintenance}</option>
            <option value="retired">{ASSET_STATUS_LABELS.retired}</option>
            <option value="lost">{ASSET_STATUS_LABELS.lost}</option>
          </select>
          <button className="btn-primary" onClick={loadAssets}>Lọc</button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 16, color: 'var(--text3)' }}>Đang tải...</div>
      ) : (
        <>
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)', letterSpacing: 1.2, marginBottom: 8 }}>AI ĐANG GIỮ TÀI SẢN</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {assetsByHolder.map((g) => (
                <div key={g.holderId} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{g.holderName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Đang giữ: {g.items.length}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', maxHeight: 120, overflowY: 'auto' }}>
                    {g.items.map((it) => (
                      <div key={it.id}>- {it.asset_name} ({it.asset_code})</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)', letterSpacing: 1.2, marginBottom: 8 }}>DANH SÁCH TÀI SẢN TỔNG QUAN</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 420, overflow: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.7fr 0.9fr 0.9fr 0.9fr 1fr 1fr', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
                <div>Tài sản</div>
                <div>Đơn vị</div>
                <div>Vị trí</div>
                <div>Hiện trạng</div>
                <div>Người giữ</div>
                <div>Ở đâu</div>
                <div>Action cuối</div>
              </div>
              {assets.map((a) => (
                <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.7fr 0.9fr 0.9fr 0.9fr 1fr 1fr', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <div>{a.asset_name} ({a.asset_code})</div>
                  <div>{a.unit?.unit_name || '-'}</div>
                  <div>{a.current_location || '-'}</div>
                  <div>{a.status_label || a.status} / {a.condition_status_label || a.condition_status}</div>
                  <div>{a.current_holder ? getUserDisplayName(a.current_holder) : '-'}</div>
                  <div>{a.current_project?.project_name || a.current_customer?.full_name || a.current_customer?.phone_number || '-'}</div>
                  <div>{a.last_action?.title ? `${a.last_action.title} (${new Date(a.last_action.happened_at).toLocaleDateString('vi-VN')})` : '-'}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)', letterSpacing: 1.2, marginBottom: 8 }}>TIMELINE VẬN HÀNH THEO NGƯỜI</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr 0.8fr 0.8fr auto', gap: 8, marginBottom: 8 }}>
              <select className="select" value={timelineFilter.user_id} onChange={(e) => setTimelineFilter((p) => ({ ...p, user_id: e.target.value }))}>
                <option value="">(Chọn người)</option>
                {users.map((u) => <option key={u.id} value={u.id}>{getUserDisplayLabel(u)}</option>)}
              </select>
              <select className="select" value={timelineFilter.role} onChange={(e) => setTimelineFilter((p) => ({ ...p, role: e.target.value }))}>
                <option value="all">Tất cả vai trò</option>
                <option value="actor">Người thao tác</option>
                <option value="handover_from">Người giao</option>
                <option value="handover_to">Người nhận</option>
              </select>
              <input className="input" type="date" value={timelineFilter.from} onChange={(e) => setTimelineFilter((p) => ({ ...p, from: e.target.value }))} />
              <input className="input" type="date" value={timelineFilter.to} onChange={(e) => setTimelineFilter((p) => ({ ...p, to: e.target.value }))} />
              <button className="btn-primary" onClick={loadTimeline}>Xem</button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
              Tổng: {timelineSummary.total} | thao tác: {timelineSummary.actor_count} | giao: {timelineSummary.handover_from_count} | nhận: {timelineSummary.handover_to_count}
            </div>

            {timelineLoading ? (
              <div style={{ padding: 14, color: 'var(--text3)' }}>Đang tải timeline...</div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 420, overflowY: 'auto' }}>
                {timelineRows.map((r) => (
                  <div key={r.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(r.happened_at).toLocaleString('vi-VN')}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      asset={r.asset?.asset_name || '-'} ({r.asset?.asset_code || '-'}) | roles={r.user_roles.join(', ') || '-'} | actor={r.actor ? getUserDisplayName(r.actor) : '-'}
                    </div>
                    {r.description && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{r.description}</div>}
                  </div>
                ))}
                {!timelineRows.length && <div style={{ padding: 14, color: 'var(--text3)' }}>Chưa có dữ liệu.</div>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
