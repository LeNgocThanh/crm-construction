'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

type DashboardActivity = {
  id: string
  source: 'customer_timeline' | 'project_timeline' | 'estimate_dispatch'
  happened_at: string
  title: string
  description?: string | null
  customer?: { id: string; full_name?: string | null; phone_number?: string | null } | null
  project?: { id: string; project_name?: string | null } | null
  actor_name?: string | null
  meta_label?: string | null
}

type DashboardData = {
  scope?: 'my' | 'all'
  can_switch_scope?: boolean
  overview: {
    total_customers: number
    verified_customers: number
    unverified_customers: number
    total_projects: number
    active_projects: number
    open_actions: number
    overdue_actions: number
    active_conversations: number
    urgent_conversations: number
    estimate_dispatches_this_month: number
  }
  customer_type_counts: Array<{ type: string; count: number }>
  project_status_counts: Array<{ status: string; count: number }>
  pending_actions: Array<{
    id: string
    summary: string
    detail?: string | null
    due_at?: string | null
    status: string
    pipeline_phase?: string | null
    customer?: { id: string; full_name?: string | null; phone_number?: string | null } | null
    owner?: { id: string; username?: string | null } | null
  }>
  attention_projects: Array<{
    id: string
    project_name: string
    status: string
    risk_level?: string | null
    delay_days: number
    customer?: { id: string; full_name?: string | null } | null
    latest_diary_at?: string | null
    latest_diary_gap_days?: number | null
    latest_milestone?: { id: string; milestone_name: string; status_name?: string | null } | null
    warning_flags: string[]
  }>
  recent_activities: DashboardActivity[]
  recent_activity_groups: Array<{
    customer_id: string
    customer_name: string
    customer_phone?: string | null
    latest_at: string
    projects: Array<{ id: string; project_name: string }>
    items: DashboardActivity[]
  }>
  recent_conversations: Array<{
    id: string
    channel: string
    display_name?: string | null
    status: string
    last_message_at: string
    is_urgent: boolean
    needs_callback: boolean
    customer_id?: string | null
  }>
}

const EMPTY_DATA: DashboardData = {
  overview: {
    total_customers: 0,
    verified_customers: 0,
    unverified_customers: 0,
    total_projects: 0,
    active_projects: 0,
    open_actions: 0,
    overdue_actions: 0,
    active_conversations: 0,
    urgent_conversations: 0,
    estimate_dispatches_this_month: 0,
  },
  customer_type_counts: [],
  project_status_counts: [],
  pending_actions: [],
  attention_projects: [],
  recent_activities: [],
  recent_activity_groups: [],
  recent_conversations: [],
}

const cardStyle: CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 14,
}

function kpiTone(type: 'blue' | 'green' | 'yellow' | 'orange' | 'red') {
  if (type === 'green') return { color: 'var(--green)', bg: 'rgba(34,197,94,.12)' }
  if (type === 'yellow') return { color: 'var(--yellow)', bg: 'rgba(250,204,21,.12)' }
  if (type === 'orange') return { color: 'var(--orange)', bg: 'rgba(249,115,22,.12)' }
  if (type === 'red') return { color: 'var(--red)', bg: 'rgba(239,68,68,.12)' }
  return { color: 'var(--accent)', bg: 'rgba(59,130,246,.12)' }
}

function statusLabel(value?: string | null) {
  const v = String(value || '')
  const map: Record<string, string> = {
    draft: 'Nháp',
    confirmed: 'Đã xác nhận',
    in_progress: 'Đang thi công',
    completed: 'Hoàn thành',
    paused: 'Tạm ngưng',
    cancelled: 'Đã hủy',
    open: 'Đang mở',
    overdue: 'Quá hạn',
    done: 'Đã xong',
    active: 'Đang theo dõi',
    closed: 'Đã đóng',
    pending_callback: 'Chờ gọi lại',
    verified: 'Đã xác thực',
    unverified: 'Chưa xác thực',
  }
  return map[v] || v || '-'
}

function sourceLabel(value: DashboardActivity['source']) {
  if (value === 'project_timeline') return 'Dự án'
  if (value === 'estimate_dispatch') return 'Gửi dự toán'
  return 'Khách hàng'
}

function channelLabel(value?: string | null) {
  const v = String(value || '')
  const map: Record<string, string> = {
    telegram: 'Telegram',
    zalo: 'Zalo',
    messenger: 'Messenger',
    email: 'Email',
    other: 'Khác',
  }
  return map[v] || v || '-'
}

function KpiCard({ label, value, tone, href, sub }: { label: string; value: string | number; tone: 'blue' | 'green' | 'yellow' | 'orange' | 'red'; href?: string; sub?: string }) {
  const t = kpiTone(tone)
  const body = (
    <div style={{ ...cardStyle, minHeight: 104 }}>
      <div style={{ fontSize: 11, letterSpacing: 1.5, color: 'var(--text4)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, background: t.bg, color: t.color, fontWeight: 800, fontSize: 24 }}>
        {value}
      </div>
      {sub ? <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>{sub}</div> : null}
    </div>
  )
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{body}</Link> : body
}

export default function DashboardV11({ username, role, roleKeys }: { username: string; role: string; roleKeys?: string[] }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<DashboardData>(EMPTY_DATA)
  const [scope, setScope] = useState<'my' | 'all'>('my')
  const roleSummary = roleKeys && roleKeys.length ? roleKeys.join(', ') : role

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/dashboard?scope=${encodeURIComponent(scope)}`, { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(String(json?.error || 'Không tải được dashboard'))
        if (!alive) return
        setData({
          ...EMPTY_DATA,
          ...json,
          scope: json?.scope === 'all' ? 'all' : 'my',
          can_switch_scope: Boolean(json?.can_switch_scope),
          overview: { ...EMPTY_DATA.overview, ...(json?.overview || {}) },
          customer_type_counts: Array.isArray(json?.customer_type_counts) ? json.customer_type_counts : [],
          project_status_counts: Array.isArray(json?.project_status_counts) ? json.project_status_counts : [],
          pending_actions: Array.isArray(json?.pending_actions) ? json.pending_actions : [],
          attention_projects: Array.isArray(json?.attention_projects) ? json.attention_projects : [],
          recent_activities: Array.isArray(json?.recent_activities) ? json.recent_activities : [],
          recent_activity_groups: Array.isArray(json?.recent_activity_groups) ? json.recent_activity_groups : [],
          recent_conversations: Array.isArray(json?.recent_conversations) ? json.recent_conversations : [],
        })
      } catch (err: any) {
        if (!alive) return
        setError(String(err?.message || 'Không tải được dashboard'))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [scope])

  const overview = data.overview

  const projectStatusMap = useMemo(() => {
    return data.project_status_counts.reduce<Record<string, number>>((acc, row) => {
      acc[String(row.status || '')] = Number(row.count || 0)
      return acc
    }, {})
  }, [data.project_status_counts])

  if (loading) return <div style={{ padding: 16 }}>Đang tải dashboard...</div>
  if (error) return <div style={{ padding: 16, color: 'var(--red)' }}>{error}</div>

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 6 }}>DASHBOARD</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Tổng quan điều hành</h1>
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text3)' }}>
            Xin chào {username} | Vai trò: {roleSummary}{data.can_switch_scope ? ` | Chế độ xem: ${scope === 'all' ? 'Toàn bộ' : 'Của tôi'}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {data.can_switch_scope ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={scope === 'my' ? 'btn-primary' : 'btn-ghost'} onClick={() => setScope('my')}>
                Chỉ của tôi
              </button>
              <button className={scope === 'all' ? 'btn-primary' : 'btn-ghost'} onClick={() => setScope('all')}>
                Toàn bộ
              </button>
            </div>
          ) : null}
          <Link className="btn-ghost" href="/customers/workboard">Workboard khách hàng</Link>
          <Link className="btn-ghost" href="/projects/reports">Báo cáo dự án</Link>
          <Link className="btn-ghost" href="/projects/diary-manager">Nhật ký công trình</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
        <KpiCard label="Khách hàng" value={overview.total_customers} tone="blue" href="/customers" sub={`${overview.verified_customers} đã xác thực`} />
        <KpiCard label="Dự án" value={overview.total_projects} tone="green" href="/projects" sub={`${overview.active_projects} đang vận hành`} />
        <KpiCard label="Next Action mở" value={overview.open_actions} tone="orange" href="/customers/workboard" sub={`${overview.overdue_actions} quá hạn`} />
        <KpiCard label="Hội thoại đang theo dõi" value={overview.active_conversations} tone="yellow" href="/conversations" sub={`${overview.urgent_conversations} cần ưu tiên`} />
        <KpiCard label="Dự toán đã gửi tháng này" value={overview.estimate_dispatches_this_month} tone="blue" href="/estimates" />
        <KpiCard label="Khách chưa xác thực" value={overview.unverified_customers} tone="red" href="/customers" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 12, alignItems: 'start', marginBottom: 14 }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Việc cần làm ngay</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Lấy từ next action / chăm sóc khách hàng đang mở</div>
            </div>
            <Link className="btn-ghost" href="/customers/workboard">Mở workboard</Link>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {data.pending_actions.map((row) => (
              <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontWeight: 700 }}>{row.summary}</div>
                  <div style={{ fontSize: 11, color: row.status === 'overdue' ? 'var(--red)' : 'var(--text3)' }}>{statusLabel(row.status)}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {row.customer?.full_name || row.customer?.phone_number || 'Khách hàng chưa rõ'}{row.owner?.username ? ` | Phụ trách: ${row.owner.username}` : ''}
                </div>
                {row.detail ? <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>{row.detail}</div> : null}
                <div style={{ marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: 'var(--text3)' }}>
                  <span>Hạn: {row.due_at ? formatDate(row.due_at) : 'Chưa đặt'}</span>
                  {row.pipeline_phase ? <span>Pha: {row.pipeline_phase}</span> : null}
                </div>
              </div>
            ))}
            {!data.pending_actions.length ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Hiện chưa có next action mở.</div> : null}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>Phân bổ nhanh</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {data.customer_type_counts.map((row) => (
              <div key={row.type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{statusLabel(row.type)}</span>
                <b>{row.count}</b>
              </div>
            ))}
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            {Object.entries(projectStatusMap).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Dự án {statusLabel(status)}</span>
                <b>{count}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start', marginBottom: 14 }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Dự án cần chú ý</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Trễ tiến độ, rủi ro cao, hoặc lâu chưa có nhật ký</div>
            </div>
            <Link className="btn-ghost" href="/projects/reports">Mở báo cáo</Link>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {data.attention_projects.map((row) => (
              <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontWeight: 700 }}>{row.project_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{statusLabel(row.status)}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{row.customer?.full_name || 'Chưa gắn khách hàng'}</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {row.warning_flags.map((flag) => (
                    <span key={flag} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: 'rgba(249,115,22,.12)', color: 'var(--orange)' }}>{flag}</span>
                  ))}
                  {!row.warning_flags.length ? <span style={{ fontSize: 11, color: 'var(--text3)' }}>Chưa có cờ cảnh báo nổi bật</span> : null}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>
                  Mốc gần: {row.latest_milestone?.milestone_name || '-'}{row.latest_milestone?.status_name ? ` | ${row.latest_milestone.status_name}` : ''}
                </div>
              </div>
            ))}
            {!data.attention_projects.length ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có dự án nào cần chú ý đặc biệt.</div> : null}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Hội thoại gần đây</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Theo dõi các cuộc chat mới hoặc đang cần gọi lại</div>
            </div>
            <Link className="btn-ghost" href="/conversations">Mở conversations</Link>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {data.recent_conversations.map((row) => (
              <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>{row.display_name || 'Khách chưa rõ tên'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{channelLabel(row.channel)}</div>
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text3)' }}>
                  {statusLabel(row.status)} | {formatDate(row.last_message_at)}
                </div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {row.is_urgent ? <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: 'rgba(239,68,68,.12)', color: 'var(--red)' }}>Khẩn</span> : null}
                  {row.needs_callback ? <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: 'rgba(250,204,21,.12)', color: 'var(--yellow)' }}>Cần gọi lại</span> : null}
                  {row.customer_id ? <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: 'rgba(34,197,94,.12)', color: 'var(--green)' }}>Đã gắn khách hàng</span> : null}
                </div>
              </div>
            ))}
            {!data.recent_conversations.length ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có hội thoại gần đây.</div> : null}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Hành trình khách hàng gần nhất</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Gom hoạt động khách hàng, dự án và gửi dự toán theo từng khách để dễ theo dõi hơn</div>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {data.recent_activity_groups.map((group) => (
            <div key={group.customer_id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{group.customer_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {group.customer_phone || 'Chưa có số điện thoại'}
                    {group.projects.length ? ` | ${group.projects.map((x) => x.project_name).join(' | ')}` : ''}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatDate(group.latest_at)}</div>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {group.items.map((row) => (
                  <div key={row.id} style={{ background: 'rgba(255,255,255,.02)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <div style={{ fontWeight: 600 }}>{row.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatDate(row.happened_at)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                      <span>{sourceLabel(row.source)}</span>
                      {row.project?.project_name ? <span>| {row.project.project_name}</span> : null}
                      {row.meta_label ? <span>| {row.meta_label}</span> : null}
                      {row.actor_name ? <span>| {row.actor_name}</span> : null}
                    </div>
                    {row.description ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>{row.description}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!data.recent_activity_groups.length ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có hoạt động gần đây.</div> : null}
        </div>
      </div>
    </div>
  )
}
