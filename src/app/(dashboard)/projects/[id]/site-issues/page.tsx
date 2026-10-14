'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getUserDisplayLabel, getUserDisplayName } from '@/lib/user-display'

type UserOption = {
  id: string
  username: string
  full_name?: string | null
  role?: string | null
  primary_access_role?: { key?: string | null; name?: string | null } | null
}

type IssueRow = {
  id: string
  issue_code: string
  title: string
  issue_type: string
  workflow_type: string
  severity: string
  status: string
  due_at?: string | null
  location_text?: string | null
  source_type?: string | null
  reporter?: { id: string; username: string } | null
  assignee?: { id: string; username: string } | null
  source_diary_entry?: { id: string; title: string; entry_date: string; shift_type?: string | null } | null
}

type Summary = {
  open_count: number
  overdue_count: number
  waiting_verify_count: number
}

type Pagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'open', label: 'Mới mở' },
  { value: 'assigned', label: 'Đã phân công' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'fixed_waiting_verify', label: 'Chờ nghiệm thu' },
  { value: 'verified', label: 'Đã nghiệm thu' },
  { value: 'reopened', label: 'Mở lại' },
  { value: 'cancelled', label: 'Đã hủy' },
]

const ISSUE_TYPE_OPTIONS = [
  { value: '', label: 'Tất cả loại lỗi' },
  { value: 'quality', label: 'QC / Chất lượng' },
  { value: 'safety', label: 'An toàn' },
  { value: 'housekeeping', label: 'Hiện trường' },
  { value: 'material', label: 'Vật tư' },
]

const SOURCE_TYPE_OPTIONS = [
  { value: '', label: 'Tất cả nguồn' },
  { value: 'project_diary', label: 'Từ nhật ký' },
  { value: 'manual', label: 'Tạo tay' },
]

const DUE_BUCKET_OPTIONS = [
  { value: '', label: 'Tất cả hạn xử lý' },
  { value: 'overdue', label: 'Quá hạn' },
  { value: 'today', label: 'Đến hạn hôm nay' },
  { value: 'no_due', label: 'Chưa có hạn' },
]

const STATUS_LABELS: Record<string, string> = {
  open: 'Mới mở',
  assigned: 'Đã phân công',
  in_progress: 'Đang xử lý',
  fixed_waiting_verify: 'Chờ nghiệm thu',
  verified: 'Đã nghiệm thu',
  reopened: 'Mở lại',
  cancelled: 'Đã hủy',
}

export default function ProjectSiteIssuesPage() {
  const params = useParams<{ id: string }>()
  const projectId = String(params?.id || '')
  const [rows, setRows] = useState<IssueRow[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [summary, setSummary] = useState<Summary>({ open_count: 0, overdue_count: 0, waiting_verify_count: 0 })
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 10, total: 0, totalPages: 1 })
  const [status, setStatus] = useState('')
  const [issueType, setIssueType] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueBucket, setDueBucket] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState('')

  async function load() {
    if (!projectId) return
    setLoading(true)
    const [res, usersRes] = await Promise.all([
      fetch(
        `/api/projects/${projectId}/site-issues?status=${encodeURIComponent(status)}&issue_type=${encodeURIComponent(issueType)}&source_type=${encodeURIComponent(sourceType)}&assigned_to=${encodeURIComponent(assignedTo)}&due_bucket=${encodeURIComponent(dueBucket)}&q=${encodeURIComponent(keyword)}&page=${page}&pageSize=${pageSize}`,
        { cache: 'no-store' },
      ),
      fetch('/api/users', { cache: 'no-store' }),
    ])
    const [j, usersJson] = await Promise.all([
      res.json().catch(() => ({})),
      usersRes.json().catch(() => ({})),
    ])
    setRows(Array.isArray(j?.data) ? j.data : [])
    setSummary({
      open_count: Number(j?.summary?.open_count || 0),
      overdue_count: Number(j?.summary?.overdue_count || 0),
      waiting_verify_count: Number(j?.summary?.waiting_verify_count || 0),
    })
    setPagination({
      page: Number(j?.pagination?.page || page),
      pageSize: Number(j?.pagination?.pageSize || pageSize),
      total: Number(j?.pagination?.total || 0),
      totalPages: Math.max(1, Number(j?.pagination?.totalPages || 1)),
    })
    setUsers(Array.isArray(usersJson?.data) ? usersJson.data.map((x: any) => ({ id: String(x.id || ''), username: String(x.username || ''), full_name: x.full_name || null, role: x.role || null, primary_access_role: x.primary_access_role || null })) : [])
    setLoading(false)
  }

  async function quickAction(issueId: string, action: 'start' | 'submit_fix' | 'verify' | 'reopen', detail?: string | null) {
    setActingId(`${issueId}_${action}`)
    const res = await fetch(`/api/projects/${projectId}/site-issues/${issueId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, detail: detail || null }),
    })
    const j = await res.json().catch(() => ({}))
    setActingId('')
    if (!res.ok) {
      alert(j?.error || 'Không cập nhật được trạng thái lỗi')
      return
    }
    await load()
  }

  useEffect(() => {
    load()
  }, [projectId, status, issueType, sourceType, assignedTo, dueBucket, keyword, page, pageSize])

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>DỰ ÁN / QC - HSE</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Lỗi hiện trường / Punch list</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn-ghost" href={`/projects/${projectId}/diary`}>Về nhật ký</Link>
          <Link className="btn-ghost" href={`/projects/${projectId}/overview`}>Mở overview</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 8, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12, borderColor: 'rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Lỗi đang mở</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{summary.open_count}</div>
        </div>
        <div className="card" style={{ padding: 12, borderColor: 'rgba(255,120,80,0.35)', background: 'rgba(255,120,80,0.08)' }}>
          <div style={{ fontSize: 11, color: 'var(--orange)', marginBottom: 4 }}>Lỗi quá hạn</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--orange)' }}>{summary.overdue_count}</div>
        </div>
        <div className="card" style={{ padding: 12, borderColor: 'rgba(80,170,255,0.35)', background: 'rgba(80,170,255,0.08)' }}>
          <div style={{ fontSize: 11, color: 'var(--blue)', marginBottom: 4 }}>Chờ nghiệm thu</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--blue)' }}>{summary.waiting_verify_count}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Trạng thái</div>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((x) => <option key={x.value || 'all'} value={x.value}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Loại lỗi</div>
            <select className="select" value={issueType} onChange={(e) => setIssueType(e.target.value)}>
              {ISSUE_TYPE_OPTIONS.map((x) => <option key={x.value || 'all'} value={x.value}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Nguồn tạo</div>
            <select className="select" value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              {SOURCE_TYPE_OPTIONS.map((x) => <option key={x.value || 'all'} value={x.value}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Người phụ trách</div>
            <select className="select" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">Tất cả người phụ trách</option>
              {users.map((x) => <option key={x.id} value={x.id}>{getUserDisplayLabel(x)}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Hạn xử lý</div>
            <select className="select" value={dueBucket} onChange={(e) => setDueBucket(e.target.value)}>
              {DUE_BUCKET_OPTIONS.map((x) => <option key={x.value || 'all'} value={x.value}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tìm nhanh</div>
            <input className="input" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Mã lỗi, tiêu đề, vị trí..." />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Tổng: {pagination.total} lỗi</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Số dòng / trang</div>
            <select className="select" style={{ width: 96 }} value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value) || 10) }}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {rows.map((row) => (
          <div key={row.id} style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Link href={`/projects/${projectId}/site-issues/${row.id}`} style={{ fontWeight: 800, color: 'var(--text)' }}>{row.issue_code}</Link>
                  <span style={{ color: row.issue_type === 'safety' ? 'var(--red)' : 'var(--orange)' }}>
                    {row.issue_type === 'safety' ? 'An toàn' : 'QC'}
                  </span>
                  <span style={{ color: 'var(--text3)' }}>{STATUS_LABELS[row.status] || row.status}</span>
                  <span style={{ color: row.severity === 'critical' ? 'var(--red)' : row.severity === 'high' ? 'var(--orange)' : 'var(--text3)' }}>{row.severity}</span>
                  <span style={{ color: 'var(--text3)' }}>{row.source_type === 'project_diary' ? 'Từ nhật ký' : 'Tạo tay'}</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{row.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  {row.location_text ? `Vị trí: ${row.location_text}` : 'Chưa ghi vị trí'}
                  {row.assignee ? ` | Phụ trách: ${getUserDisplayName(row.assignee)}` : ' | Chưa phân công'}
                  {row.due_at ? ` | Hạn: ${new Date(row.due_at).toLocaleDateString('vi-VN')}` : ' | Chưa có hạn'}
                </div>
                {row.source_diary_entry ? (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                    Nguồn nhật ký: {row.source_diary_entry.title} | {new Date(row.source_diary_entry.entry_date).toLocaleDateString('vi-VN')}
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {['open', 'assigned', 'reopened'].includes(row.status) ? (
                    <button className="btn-ghost" type="button" disabled={actingId === `${row.id}_start`} onClick={() => quickAction(row.id, 'start')}>
                      {actingId === `${row.id}_start` ? 'Đang cập nhật...' : 'Bắt đầu'}
                    </button>
                  ) : null}
                  {['in_progress', 'reopened'].includes(row.status) ? (
                    <button className="btn-ghost" type="button" disabled={actingId === `${row.id}_submit_fix`} onClick={() => quickAction(row.id, 'submit_fix')}>
                      {actingId === `${row.id}_submit_fix` ? 'Đang cập nhật...' : 'Báo đã sửa'}
                    </button>
                  ) : null}
                  {row.status === 'fixed_waiting_verify' ? (
                    <>
                      <button className="btn-ghost" type="button" disabled={actingId === `${row.id}_verify`} onClick={() => quickAction(row.id, 'verify')}>
                        {actingId === `${row.id}_verify` ? 'Đang cập nhật...' : 'Xác nhận đạt'}
                      </button>
                      <button
                        className="btn-ghost"
                        type="button"
                        disabled={actingId === `${row.id}_reopen`}
                        onClick={() => {
                          const reason = window.prompt('Lý do nghiệm thu không đạt (không bắt buộc):') || ''
                          quickAction(row.id, 'reopen', reason.trim() ? `Nghiệm thu không đạt: ${reason.trim()}` : 'Nghiệm thu không đạt')
                        }}
                      >
                        {actingId === `${row.id}_reopen` ? 'Đang cập nhật...' : 'Không đạt / mở lại'}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <Link className="btn-ghost" href={`/projects/${projectId}/site-issues/${row.id}`}>Chi tiết</Link>
            </div>
          </div>
        ))}
        {!rows.length ? <div style={{ padding: 12, color: 'var(--text3)', fontSize: 12 }}>{loading ? 'Đang tải...' : 'Chưa có lỗi hiện trường.'}</div> : null}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          Trang {pagination.page}/{pagination.totalPages}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn-ghost" type="button" disabled={page <= 1 || loading} onClick={() => setPage(1)}>Trang đầu</button>
          <button className="btn-ghost" type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Trang trước</button>
          <button className="btn-ghost" type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}>Trang sau</button>
          <button className="btn-ghost" type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage(pagination.totalPages)}>Trang cuối</button>
        </div>
      </div>
    </div>
  )
}
