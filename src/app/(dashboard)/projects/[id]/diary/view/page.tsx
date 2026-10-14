'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type DiaryItem = {
  id: string
  entry_date: string
  shift_type?: string | null
  title: string
  summary?: string | null
  work_scope?: string | null
  progress_percent_day?: number | null
  progress_percent_total?: number | null
  quality_status?: string | null
  safety_status?: string | null
  next_plan?: string | null
  is_investor_visible: boolean
  creator?: { id: string; username: string } | null
  manpower_summary?: string | null
  equipment_summary?: string | null
  material_in_summary?: string | null
  material_out_summary?: string | null
  metadata_json?: any
  events?: Array<{ id: string; title: string; detail?: string | null; severity?: string | null; event_key?: string | null }>
  media?: Array<{ id: string; file_url: string; file_type?: string | null; caption?: string | null; category?: string | null; metadata_json?: any }>
  attendances?: Array<{ id: string; work_qty?: number | null; amount?: string | null; note?: string | null; worker?: { id: string; worker_code: string; full_name: string } | null }>
}

type Pagination = {
  total: number
  page: number
  page_size: number
  total_pages: number
}

const SHIFT_OPTIONS = [
  { value: '', label: 'Tất cả ca' },
  { value: 'full_day', label: 'Cả ngày' },
  { value: 'morning', label: 'Sáng' },
  { value: 'afternoon', label: 'Chiều' },
  { value: 'night', label: 'Tối' },
]

const QUALITY_OPTIONS = [
  { value: '', label: 'Tất cả chất lượng' },
  { value: 'ok', label: 'Đạt' },
  { value: 'issue', label: 'Có lỗi' },
  { value: 'blocked', label: 'Bị chặn' },
]

const SAFETY_OPTIONS = [
  { value: '', label: 'Tất cả an toàn' },
  { value: 'ok', label: 'An toàn' },
  { value: 'warning', label: 'Cảnh báo' },
  { value: 'incident', label: 'Sự cố' },
]

function toInputDate(value: Date) {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function displayDate(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('vi-VN')
}

function shiftLabel(value?: string | null) {
  switch (value) {
    case 'full_day': return 'Cả ngày'
    case 'morning': return 'Sáng'
    case 'afternoon': return 'Chiều'
    case 'night': return 'Tối'
    default: return value || '-'
  }
}

function qualityLabel(value?: string | null) {
  switch (value) {
    case 'ok': return 'Đạt'
    case 'issue': return 'Có lỗi'
    case 'blocked': return 'Bị chặn'
    default: return value || '-'
  }
}

function safetyLabel(value?: string | null) {
  switch (value) {
    case 'ok': return 'An toàn'
    case 'warning': return 'Cảnh báo'
    case 'incident': return 'Sự cố'
    default: return value || '-'
  }
}

function qualityColor(value?: string | null) {
  switch (value) {
    case 'ok': return 'var(--green)'
    case 'issue': return 'var(--orange)'
    case 'blocked': return 'var(--red)'
    default: return 'var(--text3)'
  }
}

function safetyColor(value?: string | null) {
  switch (value) {
    case 'ok': return 'var(--green)'
    case 'warning': return 'var(--orange)'
    case 'incident': return 'var(--red)'
    default: return 'var(--text3)'
  }
}

function mediaKind(item: { file_type?: string | null; file_url?: string | null }) {
  const kind = String(item.file_type || '').toLowerCase()
  if (kind === 'video') return 'video'
  if (kind === 'image') return 'image'
  return String(item.file_url || '').match(/\.(mp4|webm|mov|mkv)(\?|$)/i) ? 'video' : 'image'
}

export default function ProjectDiaryTimelineViewPage() {
  const params = useParams<{ id: string }>()
  const projectId = String(params?.id || '')
  const today = new Date()
  const [viewMode, setViewMode] = useState<'detail' | 'media' | 'labor'>('detail')
  const [mediaMode, setMediaMode] = useState<'all' | 'image' | 'video'>('all')
  const [period, setPeriod] = useState<'week' | 'month' | 'custom'>('month')
  const [fromDate, setFromDate] = useState(toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [toDate, setToDate] = useState(toInputDate(today))
  const [shiftType, setShiftType] = useState('')
  const [qualityStatus, setQualityStatus] = useState('')
  const [safetyStatus, setSafetyStatus] = useState('')
  const [issueOnly, setIssueOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [rows, setRows] = useState<DiaryItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, page_size: 12, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    if (!projectId) return
    setLoading(true)
    setError('')
    const qs = new URLSearchParams()
    qs.set('period', period)
    qs.set('page', String(page))
    qs.set('page_size', String(pageSize))
    if (period === 'custom') {
      if (fromDate) qs.set('from', fromDate)
      if (toDate) qs.set('to', toDate)
    }
    if (shiftType) qs.set('shift_type', shiftType)
    if (qualityStatus) qs.set('quality_status', qualityStatus)
    if (safetyStatus) qs.set('safety_status', safetyStatus)
    if (issueOnly) qs.set('issue_only', '1')
    const res = await fetch(`/api/projects/${projectId}/diary/view?${qs.toString()}`, { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(String(json?.error || 'Không tải được dữ liệu nhật ký'))
      setRows([])
      setPagination({ total: 0, page: 1, page_size: pageSize, total_pages: 1 })
      setLoading(false)
      return
    }
    setRows(Array.isArray(json?.data) ? json.data : [])
    setPagination(json?.pagination || { total: 0, page: 1, page_size: pageSize, total_pages: 1 })
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [projectId, period, fromDate, toDate, shiftType, qualityStatus, safetyStatus, issueOnly, page, pageSize])

  useEffect(() => {
    setPage(1)
  }, [period, fromDate, toDate, shiftType, qualityStatus, safetyStatus, issueOnly, pageSize])

  const visibleMediaRows = useMemo(() => {
    return rows
      .map((row) => ({
        ...row,
        media: (row.media || []).filter((item) => {
          if (mediaMode === 'all') return true
          return mediaKind(item) === mediaMode
        }),
      }))
      .filter((row) => (row.media || []).length > 0)
  }, [rows, mediaMode])

  const laborRows = useMemo(() => {
    return rows
      .map((row) => ({
        id: row.id,
        entry_date: row.entry_date,
        shift_type: row.shift_type,
        title: row.title,
        workers: (row.attendances || []).map((item) => ({
          key: item.id,
          worker_name: item.worker?.full_name || '-',
          worker_code: item.worker?.worker_code || '',
          work_qty: Number(item.work_qty || 0),
        })),
      }))
      .filter((row) => row.workers.length > 0)
  }, [rows])

  const totalMedia = useMemo(() => rows.reduce((sum, row) => sum + (row.media?.length || 0), 0), [rows])
  const totalLabor = useMemo(() => rows.reduce((sum, row) => sum + (row.attendances?.length || 0), 0), [rows])

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>DỰ ÁN / NHẬT KÝ / VIEW</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Dòng thời gian nhật ký thi công</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
            Màn hình chỉ xem để lọc, đọc timeline, ảnh/video và nhân công theo thời gian
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn-ghost" href={`/projects/${projectId}/diary`}>Mở nhật ký thao tác</Link>
          <Link className="btn-ghost" href={`/projects/${projectId}/diary/report`}>Mở báo cáo nhật ký</Link>
          <Link className="btn-ghost" href={`/projects/${projectId}/overview`}>Mở overview</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Bộ lọc và chế độ xem</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Chế độ xem</div>
            <select className="select" value={viewMode} onChange={(e) => setViewMode(e.target.value as any)}>
              <option value="detail">Chi tiết theo timeline</option>
              <option value="media">Ảnh / video</option>
              <option value="labor">Nhân công</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Khoảng thời gian</div>
            <select className="select" value={period} onChange={(e) => setPeriod(e.target.value as any)}>
              <option value="week">Tuần gần nhất</option>
              <option value="month">Tháng gần nhất</option>
              <option value="custom">Tùy chọn</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ca làm</div>
            <select className="select" value={shiftType} onChange={(e) => setShiftType(e.target.value)}>
              {SHIFT_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Số dòng mỗi trang</div>
            <select className="select" value={String(pageSize)} onChange={(e) => setPageSize(Number(e.target.value))}>
              <option value="8">8 dòng</option>
              <option value="12">12 dòng</option>
              <option value="20">20 dòng</option>
              <option value="32">32 dòng</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Chất lượng</div>
            <select className="select" value={qualityStatus} onChange={(e) => setQualityStatus(e.target.value)}>
              {QUALITY_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>An toàn</div>
            <select className="select" value={safetyStatus} onChange={(e) => setSafetyStatus(e.target.value)}>
              {SAFETY_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Từ ngày</div>
            <input className="input" type="date" disabled={period !== 'custom'} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đến ngày</div>
            <input className="input" type="date" disabled={period !== 'custom'} value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={issueOnly} onChange={(e) => setIssueOnly(e.target.checked)} />
            Chỉ hiện nhật ký có vấn đề
          </label>
          {viewMode === 'media' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Lọc media</div>
              <select className="select" value={mediaMode} onChange={(e) => setMediaMode(e.target.value as any)} style={{ minWidth: 160 }}>
                <option value="all">Tất cả ảnh / video</option>
                <option value="image">Chỉ ảnh</option>
                <option value="video">Chỉ video</option>
              </select>
            </div>
          ) : <div />}
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: 8 }}>
          <div>Tổng nhật ký: <b>{pagination.total.toLocaleString('vi-VN')}</b></div>
          <div>Tổng media trên trang: <b>{totalMedia.toLocaleString('vi-VN')}</b></div>
          <div>Tổng nhân công trên trang: <b>{totalLabor.toLocaleString('vi-VN')}</b></div>
          <div>Trang hiện tại: <b>{pagination.page}/{pagination.total_pages}</b></div>
        </div>
      </div>

      {loading ? <div className="card" style={{ padding: 12 }}>Đang tải dữ liệu...</div> : null}
      {error ? <div className="card" style={{ padding: 12, color: 'var(--red)' }}>{error}</div> : null}

      {!loading && !error && viewMode === 'detail' ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((row) => (
            <div key={row.id} className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {displayDate(row.entry_date)} | {shiftLabel(row.shift_type)} | {row.creator?.username || 'Không rõ người lập'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{row.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                    Hạng mục: {row.work_scope || '-'} | Hiển thị chủ đầu tư: {row.is_investor_visible ? 'Có' : 'Không'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 220 }}>
                  <div style={{ fontSize: 12, color: qualityColor(row.quality_status) }}>Chất lượng: {qualityLabel(row.quality_status)}</div>
                  <div style={{ fontSize: 12, color: safetyColor(row.safety_status) }}>An toàn: {safetyLabel(row.safety_status)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Tiến độ ngày: {row.progress_percent_day ?? '-'}%</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Tiến độ lũy kế: {row.progress_percent_total ?? '-'}%</div>
                </div>
              </div>

              {row.summary ? <div style={{ marginTop: 10, fontSize: 13 }}><b>Tóm tắt:</b> {row.summary}</div> : null}
              {row.next_plan ? <div style={{ marginTop: 6, fontSize: 13 }}><b>Kế hoạch tiếp:</b> {row.next_plan}</div> : null}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', gap: 8, marginTop: 10 }}>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Nhân lực / máy / vật tư</div>
                  <div style={{ fontSize: 12, marginBottom: 4 }}><b>Nhân lực:</b> {row.manpower_summary || '-'}</div>
                  <div style={{ fontSize: 12, marginBottom: 4 }}><b>Máy chính:</b> {row.equipment_summary || '-'}</div>
                  <div style={{ fontSize: 12, marginBottom: 4 }}><b>Vật tư vào:</b> {row.material_in_summary || '-'}</div>
                  <div style={{ fontSize: 12 }}><b>Vật tư ra:</b> {row.material_out_summary || '-'}</div>
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Sự kiện / xử lý</div>
                  <div style={{ fontSize: 12, marginBottom: 4 }}><b>Rủi ro ngày:</b> {row.metadata_json?.risk_flag || '-'}</div>
                  <div style={{ fontSize: 12, marginBottom: 4 }}><b>Phương án xử lý:</b> {row.metadata_json?.issue_resolution || '-'}</div>
                  <div style={{ fontSize: 12 }}><b>ETA:</b> {row.metadata_json?.issue_eta || '-'}</div>
                </div>
              </div>

              {(row.events || []).length ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Sự kiện nổi bật</div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {(row.events || []).map((event) => (
                      <div key={event.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                        <div style={{ fontWeight: 700 }}>{event.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{event.severity || '-'} | {event.event_key || '-'}</div>
                        {event.detail ? <div style={{ fontSize: 12, marginTop: 4 }}>{event.detail}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {(row.attendances || []).length ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Nhân công trong nhật ký</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(row.attendances || []).map((attendance) => (
                      <div key={attendance.id} style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '6px 10px', fontSize: 12 }}>
                        {(attendance.worker?.full_name || '-')}
                        {attendance.worker?.worker_code ? ` (${attendance.worker.worker_code})` : ''}
                        {attendance.work_qty != null ? ` | ${attendance.work_qty} công` : ''}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
          {!rows.length ? <div className="card" style={{ padding: 12, color: 'var(--text3)' }}>Không có nhật ký trong khoảng lọc này.</div> : null}
        </div>
      ) : null}

      {!loading && !error && viewMode === 'media' ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {visibleMediaRows.map((row) => (
            <div key={row.id} className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 700 }}>{displayDate(row.entry_date)} | {shiftLabel(row.shift_type)} | {row.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                {row.media?.length || 0} media | Chất lượng: {qualityLabel(row.quality_status)} | An toàn: {safetyLabel(row.safety_status)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginTop: 10 }}>
                {(row.media || []).map((media) => {
                  const kind = mediaKind(media)
                  return (
                    <div key={media.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 6 }}>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>
                        {kind === 'video' ? 'Video' : 'Ảnh'} | {media.category || 'other'}
                      </div>
                      {kind === 'video' ? (
                        <video src={media.file_url} controls style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6 }} />
                      ) : (
                        <img src={media.file_url} alt={media.caption || 'media'} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6 }} />
                      )}
                      <div style={{ fontSize: 12, marginTop: 6 }}>{media.caption || '(Không có ghi chú)'}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {!visibleMediaRows.length ? <div className="card" style={{ padding: 12, color: 'var(--text3)' }}>Không có ảnh/video phù hợp với bộ lọc hiện tại.</div> : null}
        </div>
      ) : null}

      {!loading && !error && viewMode === 'labor' ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {laborRows.map((row) => (
            <div key={row.id} className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 700 }}>{displayDate(row.entry_date)} | {shiftLabel(row.shift_type)} | {row.title}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginTop: 10 }}>
                {row.workers.map((worker) => (
                  <div key={worker.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontWeight: 700 }}>{worker.worker_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{worker.worker_code || '-'}</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Số công: <b>{worker.work_qty.toLocaleString('vi-VN')}</b></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!laborRows.length ? <div className="card" style={{ padding: 12, color: 'var(--text3)' }}>Không có nhân công trong các nhật ký đang lọc.</div> : null}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="card" style={{ padding: 12, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>
              Tổng {pagination.total.toLocaleString('vi-VN')} nhật ký | Trang {pagination.page}/{pagination.total_pages}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn-ghost" disabled={pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Trang trước</button>
              <div style={{ minWidth: 90, textAlign: 'center', fontSize: 13 }}>Trang {pagination.page}</div>
              <button className="btn-ghost" disabled={pagination.page >= pagination.total_pages} onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}>Trang sau</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
