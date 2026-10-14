'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

function fmtDate(s?: string | null) {
  if (!s) return '-'
  return new Date(s).toLocaleDateString('vi-VN')
}

export default function ProjectDiaryReportPage() {
  const params = useParams<{ id: string }>()
  const projectId = String(params?.id || '')
  const [period, setPeriod] = useState('week')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')

  async function load() {
    if (!projectId) return
    setLoading(true)
    setError('')
    const qs = new URLSearchParams()
    qs.set('period', period)
    if (period === 'custom') {
      if (fromDate) qs.set('from', fromDate)
      if (toDate) qs.set('to', toDate)
    }
    const res = await fetch(`/api/projects/${projectId}/diary/report?${qs.toString()}`, { cache: 'no-store' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(String(j?.error || 'Không tải được báo cáo'))
      setLoading(false)
      return
    }
    setData(j?.data || null)
    setLoading(false)
  }

  useEffect(() => { load() }, [projectId, period, fromDate, toDate])

  const summary = data?.summary || {}
  const mediaByCategory = data?.media_by_category || {}
  const daily = useMemo(() => (Array.isArray(data?.daily) ? data.daily : []), [data])
  const issueTop = useMemo(() => (Array.isArray(data?.issue_top) ? data.issue_top : []), [data])
  const timelineProgress = useMemo(() => (Array.isArray(data?.timeline_progress) ? data.timeline_progress : []), [data])
  const highlightsByDay = data?.highlights_by_day || {}
  const milestonesCompleted = Array.isArray(data?.milestones?.completed) ? data.milestones.completed : []
  const milestonesUpcoming = Array.isArray(data?.milestones?.upcoming) ? data.milestones.upcoming : []
  const latest = daily.length ? daily[daily.length - 1] : null

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)' }}>DỰ ÁN / BÁO CÁO NHẬT KÝ</div>
          <h1 style={{ margin: '4px 0 2px', fontSize: 22, fontWeight: 800 }}>Báo cáo nhật ký thi công</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Từ {fmtDate(data?.from)} đến {fmtDate(data?.to)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="week">7 ngày</option>
            <option value="month">30 ngày</option>
            <option value="custom">Tùy chọn</option>
          </select>
          {period === 'custom' ? (
            <>
              <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </>
          ) : null}
          <Link className="btn-ghost" href={`/projects/${projectId}/diary`}>Mở nhật ký</Link>
          <Link className="btn-ghost" href={`/projects/${projectId}/overview`}>Mở overview</Link>
          <button className="btn-ghost" onClick={() => window.print()}>In / PDF</button>
        </div>
      </div>

      {loading ? <div style={{ padding: 10 }}>Đang tải...</div> : null}
      {error ? <div style={{ padding: 10, color: 'var(--red)' }}>{error}</div> : null}

      {!loading && !error ? (
        <>
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Tổng hợp nhanh</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(140px,1fr))', gap: 8 }}>
              <div>Số nhật ký: <b>{summary.entries_count ?? 0}</b></div>
              <div>Số ngày có nhật ký: <b>{summary.days_with_entry ?? 0}</b></div>
              <div>Tiến độ ngày TB: <b>{summary.avg_day_progress ?? 0}%</b></div>
              <div>Tiến độ lũy kế mới nhất: <b>{summary.latest_total_progress ?? '-'}%</b></div>
              <div>Cảnh báo chất lượng: <b>{summary.quality_issue_count ?? 0}</b></div>
              <div>Cảnh báo an toàn: <b>{summary.safety_issue_count ?? 0}</b></div>
              <div>Sự kiện nghiêm trọng: <b>{summary.event_issue_count ?? 0}</b></div>
            </div>
          </div>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Tiến độ lũy kế theo timeline</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 140 }}>
                {timelineProgress.map((p: any, idx: number) => {
                  const val = Math.max(0, Math.min(100, Number(p.progress_total || 0)))
                  return (
                    <div key={`${p.date}_${idx}`} style={{ flex: 1, minWidth: 24, textAlign: 'center' }}>
                      <div style={{ height: `${val}px`, background: 'linear-gradient(180deg,#3b82f6,#1d4ed8)', borderRadius: 4 }} />
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{p.date.slice(5)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Media theo loại</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(140px,1fr))', gap: 8 }}>
              {Object.keys(mediaByCategory).length ? Object.entries(mediaByCategory).map(([k, v]: any) => (
                <div key={k} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{k}</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{v}</div>
                </div>
              )) : <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có media</div>}
            </div>
          </div>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Vấn đề nổi bật</div>
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {issueTop.map((x: any, idx: number) => (
                <div key={`${x.title}_${idx}`} style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px' }}>
                  <div style={{ fontWeight: 700 }}>{x.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{x.date} | {x.severity}</div>
                </div>
              ))}
              {!issueTop.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Không có vấn đề nổi bật.</div> : null}
            </div>
          </div>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Hôm nay đã làm gì / Ngày mai làm gì</div>
            {latest ? (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Bản ghi mới nhất: {latest.date}</div>
                <div style={{ fontSize: 12, marginBottom: 4 }}><b>Hôm nay:</b> {latest.summary || '-'}</div>
                <div style={{ fontSize: 12, marginBottom: 4 }}><b>Ngày mai:</b> {latest.next_plan || '-'}</div>
                <div style={{ fontSize: 12, marginBottom: 4 }}><b>Phương án xử lý:</b> {latest.issue_resolution || '-'}</div>
                <div style={{ fontSize: 12 }}><b>ETA:</b> {latest.issue_eta || '-'}</div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có dữ liệu.</div>
            )}
          </div>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Ảnh nổi bật trước/sau theo ngày</div>
            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {Object.entries(highlightsByDay).map(([day, arr]: any) => (
                <div key={day} style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px' }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{day}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 6 }}>
                    {(arr || []).map((m: any) => {
                      const isVideo = String(m.file_type || '').toLowerCase() === 'video' || String(m.file_url || '').match(/\.(mp4|webm|mov|mkv)(\?|$)/i)
                      return (
                        <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 4 }}>
                          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>{m.is_before_after ? 'Before/After' : (m.category || 'other')}</div>
                          {isVideo ? <video src={m.file_url} controls style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6 }} /> : <img src={m.file_url} alt={m.caption || 'media'} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6 }} />}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              {!Object.keys(highlightsByDay).length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Chưa có media nổi bật.</div> : null}
            </div>
          </div>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Mốc đã hoàn thành / mốc sắp tới</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Đã hoàn thành</div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 180, overflowY: 'auto' }}>
                  {milestonesCompleted.map((m: any) => <div key={m.id} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{m.milestone_name} {m.completed_at ? `| ${fmtDate(m.completed_at)}` : ''}</div>)}
                  {!milestonesCompleted.length ? <div style={{ padding: 8, fontSize: 12, color: 'var(--text3)' }}>Chưa có mốc hoàn thành.</div> : null}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Sắp tới</div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 180, overflowY: 'auto' }}>
                  {milestonesUpcoming.map((m: any) => <div key={m.id} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{m.milestone_name} {m.due_date ? `| ${fmtDate(m.due_date)}` : ''}</div>)}
                  {!milestonesUpcoming.length ? <div style={{ padding: 8, fontSize: 12, color: 'var(--text3)' }}>Không có mốc sắp tới.</div> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Nhật ký theo ngày</div>
            <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {daily.map((d: any) => (
                <div key={d.id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px' }}>
                  <div style={{ fontWeight: 700 }}>{d.date} | {d.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    Ca: {d.shift_type || '-'} | Tiến độ ngày: {d.progress_percent_day ?? '-'}% | Lũy kế: {d.progress_percent_total ?? '-'}% | Chất lượng: {d.quality_status} | An toàn: {d.safety_status}
                  </div>
                  {d.summary ? <div style={{ fontSize: 12, marginTop: 4 }}><b>Tóm tắt:</b> {d.summary}</div> : null}
                  {d.next_plan ? <div style={{ fontSize: 12, marginTop: 2 }}><b>Kế hoạch:</b> {d.next_plan}</div> : null}
                </div>
              ))}
              {!daily.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Chưa có dữ liệu trong khoảng đã chọn.</div> : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
