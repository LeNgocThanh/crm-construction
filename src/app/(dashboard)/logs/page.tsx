'use client'
// src/app/(dashboard)/logs/page.tsx
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

const C = {
  bg: '#0C1117', surface: '#151C24', surface2: '#1C2532',
  border: '#2A3441', border2: '#3A4858',
  orange: '#F97316', blue: '#3B82F6', green: '#22C55E',
  red: '#EF4444', purple: '#A855F7', yellow: '#EAB308',
  text: '#E2EBF4', text2: '#94A3B8', text3: '#64748B',
}

const SENT_ICON: Record<string, string> = { 'Tích cực': '😊', 'Trung lập': '😐', 'Gay gắt': '😤' }
const SENT_CLR: Record<string, string>  = { 'Tích cực': C.green, 'Trung lập': C.orange, 'Gay gắt': C.red }

interface Log {
  id: string
  source?: string
  contact_date: string
  ai_summary?: string
  ai_sentiment?: string
  next_action?: string
  notes?: string
  transcription_raw?: string
  audio_file_path?: string
  ext_full_name?: string
  ext_address?: string
  ext_house_type?: string
  ext_floors?: number
  ext_floor_area?: number
  ext_budget?: number
  potential_score?: number
  potential_level?: string
  customer?: { id: string; phone_number: string; full_name?: string }
  sales?: { username: string }
}

interface EditModal {
  log: Log
  next_action: string
  ai_summary: string
}

export default function LogsPage() {
  const { data: session } = useSession()
  const roleKeys = session?.user?.role_keys || (session?.user?.role ? [session.user.role] : [])

  const [logs, setLogs]     = useState<Log[]>([])
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage]     = useState(1)

  // Filters
  const [search, setSearch]         = useState('')
  const [debouncedSearch, setDebounced] = useState('')
  const [sentiment, setSentiment]   = useState('')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')

  // Modals
  const [editModal, setEditModal]     = useState<EditModal | null>(null)
  const [detailLog, setDetailLog]     = useState<Log | null>(null)
  const [analysisMode, setAnalysisMode] = useState<'crm_basic' | 'estimate_v1' | 'estimate_preliminary'>('estimate_v1')
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)

  const limit = 15

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [debouncedSearch, sentiment, dateFrom, dateTo])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page), limit: String(limit),
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(sentiment && { sentiment }),
      ...(dateFrom && { date_from: dateFrom }),
      ...(dateTo   && { date_to: dateTo }),
    })
    const res  = await fetch(`/api/contact-logs?${params}`)
    const json = await res.json()
    setLogs(json.data || [])
    setTotal(json.total || 0)
    setLoading(false)
  }, [page, debouncedSearch, sentiment, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string) {
    if (!confirm('Xóa nhật ký này?')) return
    setDeletingId(id)
    await fetch(`/api/contact-logs/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    load()
  }

  async function handleSaveEdit() {
    if (!editModal) return
    setSaving(true)
    await fetch(`/api/contact-logs/${editModal.log.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ next_action: editModal.next_action, ai_summary: editModal.ai_summary }),
    })
    setSaving(false)
    setEditModal(null)
    load()
  }

  async function runLogAnalysis(mode: 'crm_basic' | 'estimate_v1' | 'estimate_preliminary') {
    if (!detailLog) return
    setAnalysisMode(mode)
    setAnalysisLoading(true)
    setAnalysisResult(null)
    try {
      const res = await fetch('/api/analysis/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_key: mode,
          auto_detect: false,
          contact_log_id: detailLog.id,
          source_type: detailLog.source || 'call',
          customer_id: detailLog.customer?.id || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Phân tích thất bại')
      setAnalysisResult(json.data)
    } catch (err: any) {
      setAnalysisResult({ error: err.message || 'Lỗi không xác định' })
    }
    setAnalysisLoading(false)
  }

  const isAdminManager = roleKeys.some((x) => ['admin', 'manager'].includes(x))
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2.5, color: C.text3, marginBottom: 6 }}>NHẬT KÝ LIÊN HỆ</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Tất cả cuộc gọi</h1>
          <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>{total.toLocaleString('vi-VN')} bản ghi</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 260 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.text3, pointerEvents: 'none' }}>🔍</span>
            <input className="input" style={{ paddingLeft: 32 }}
              placeholder="Tìm tên, SĐT, nội dung..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Sentiment */}
          <select className="select" style={{ maxWidth: 160 }}
            value={sentiment} onChange={e => setSentiment(e.target.value)}>
            <option value="">Tất cả cảm xúc</option>
            <option value="Tích cực">😊 Tích cực</option>
            <option value="Trung lập">😐 Trung lập</option>
            <option value="Gay gắt">😤 Gay gắt</option>
          </select>

          {/* Date range */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: C.text3, flexShrink: 0 }}>Từ:</span>
            <input type="date" className="input" style={{ maxWidth: 140 }}
              value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span style={{ fontSize: 11, color: C.text3, flexShrink: 0 }}>đến:</span>
            <input type="date" className="input" style={{ maxWidth: 140 }}
              value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>

          {(search || sentiment || dateFrom || dateTo) && (
            <button className="btn-ghost" style={{ fontSize: 12 }}
              onClick={() => { setSearch(''); setSentiment(''); setDateFrom(''); setDateTo('') }}>
              ✕ Xóa lọc
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {(debouncedSearch || sentiment || dateFrom || dateTo) && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: C.text3 }}>Lọc:</span>
            {debouncedSearch && (
              <span style={{ fontSize: 11, background: '#3B82F615', color: C.blue, padding: '2px 10px', borderRadius: 5 }}>
                "{debouncedSearch}"
              </span>
            )}
            {sentiment && (
              <span style={{ fontSize: 11, background: `${SENT_CLR[sentiment]}15`, color: SENT_CLR[sentiment], padding: '2px 10px', borderRadius: 5 }}>
                {SENT_ICON[sentiment]} {sentiment}
              </span>
            )}
            {(dateFrom || dateTo) && (
              <span style={{ fontSize: 11, background: `${C.purple}15`, color: C.purple, padding: '2px 10px', borderRadius: 5, fontFamily: "'JetBrains Mono',monospace" }}>
                {dateFrom || '…'} → {dateTo || '…'}
              </span>
            )}
            <span style={{ fontSize: 11, color: C.text3 }}>· {total} kết quả</span>
          </div>
        )}
      </div>

      {/* Logs list */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
            <span className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center', color: C.text3, fontSize: 13 }}>
            {debouncedSearch || sentiment || dateFrom || dateTo
              ? 'Không tìm thấy kết quả phù hợp'
              : 'Chưa có nhật ký nào'}
          </div>
        ) : (
          logs.map((log, i) => {
            const isExpanded = expandedId === log.id
            const sentColor  = SENT_CLR[log.ai_sentiment || 'Trung lập'] || C.text3
            const sentIcon   = SENT_ICON[log.ai_sentiment || 'Trung lập']

            return (
              <div key={log.id} style={{ borderBottom: i < logs.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                {/* Main row */}
                <div style={{ padding: '14px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {/* Sentiment icon */}
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${sentColor}12`, border: `1px solid ${sentColor}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {sentIcon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Customer */}
                        <Link href={`/customers/${log.customer?.id}`} style={{ textDecoration: 'none' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{log.customer?.full_name || log.customer?.phone_number || '—'}</span>
                          {log.customer?.full_name && (
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: C.blue, marginLeft: 8 }}>{log.customer.phone_number}</span>
                          )}
                        </Link>
                        {/* Sentiment badge */}
                        <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: sentColor, background: `${sentColor}12`, padding: '2px 8px', borderRadius: 4, border: `1px solid ${sentColor}25` }}>
                          {log.ai_sentiment || '—'}
                        </span>
                        {/* Has audio */}
                        {log.audio_file_path && (
                          <span style={{ fontSize: 10, color: C.purple, background: '#A855F712', padding: '2px 7px', borderRadius: 4 }}>🎙️ Audio</span>
                        )}
                      </div>
                      {/* Meta right */}
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                        {log.sales && (
                          <span style={{ fontSize: 11, color: C.text3, fontFamily: "'JetBrains Mono',monospace" }}>{log.sales.username}</span>
                        )}
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: C.text3 }}>
                          {log.contact_date?.split('T')[0]}
                        </span>
                      </div>
                    </div>

                    {/* Summary */}
                    {log.ai_summary && (
                      <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.6, marginBottom: 5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: isExpanded ? 999 : 2, WebkitBoxOrient: 'vertical' }}>
                        {log.ai_summary}
                      </div>
                    )}

                    {/* Next action */}
                    {log.next_action && (
                      <div style={{ fontSize: 11, color: C.orange, fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>
                        → {log.next_action}
                      </div>
                    )}

                    {/* Expanded: transcription */}
                    {isExpanded && log.transcription_raw && (
                      <div style={{ marginTop: 12, padding: '12px 14px', background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: 2, color: C.text3, marginBottom: 8 }}>TRANSCRIPT GỐC</div>
                        <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: 180, overflowY: 'auto' }}>
                          {log.transcription_raw}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    <button
                      onClick={() => {
                        setDetailLog(log)
                        setAnalysisResult(null)
                      }}
                      style={{ background: '#8B5CF615', border: '1px solid #8B5CF635', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11, color: C.purple }}
                      title="Xem chi tiết cuộc gọi"
                    >
                      👁
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11, color: C.text3 }}
                      title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                    <button
                      onClick={() => setEditModal({ log, next_action: log.next_action || '', ai_summary: log.ai_summary || '' })}
                      style={{ background: '#3B82F615', border: '1px solid #3B82F630', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11, color: C.blue }}
                      title="Chỉnh sửa"
                    >
                      ✏️
                    </button>
                    {(isAdminManager || log.sales?.username === session?.user?.username) && (
                      <button
                        onClick={() => handleDelete(log.id)}
                        disabled={deletingId === log.id}
                        style={{ background: '#EF444415', border: '1px solid #EF444430', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11, color: C.red, opacity: deletingId === log.id ? 0.5 : 1 }}
                        title="Xóa"
                      >
                        {deletingId === log.id ? '…' : '🗑️'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: C.text3 }}>
              {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} disabled={page === 1} onClick={() => setPage(1)}>«</button>
              <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
              <span style={{ padding: '5px 12px', fontSize: 12, color: C.text2, fontFamily: "'JetBrains Mono',monospace" }}>{page}/{totalPages}</span>
              <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
              <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} disabled={page >= totalPages} onClick={() => setPage(totalPages)}>»</button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setEditModal(null)}>
          <div style={{ background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 14, width: '100%', maxWidth: 520, padding: 28, boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2, color: C.text3, marginBottom: 4 }}>CHỈNH SỬA NHẬT KÝ</div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20 }}>
              {editModal.log.customer?.full_name || editModal.log.customer?.phone_number}
            </h2>

            <label className="label">Tóm tắt AI</label>
            <textarea
              className="input"
              style={{ minHeight: 100, resize: 'vertical', marginBottom: 16 }}
              value={editModal.ai_summary}
              onChange={e => setEditModal({ ...editModal, ai_summary: e.target.value })}
              placeholder="Tóm tắt nội dung cuộc gọi..."
            />

            <label className="label">Hành động tiếp theo</label>
            <input
              className="input"
              style={{ marginBottom: 24 }}
              value={editModal.next_action}
              onChange={e => setEditModal({ ...editModal, next_action: e.target.value })}
              placeholder="Gọi lại vào ngày... / Gửi báo giá..."
            />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setEditModal(null)}>Hủy</button>
              <button className="btn-primary" onClick={handleSaveEdit} disabled={saving}>
                {saving ? 'Đang lưu...' : '💾 Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailLog && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}
          onClick={() => setDetailLog(null)}
        >
          <div
            style={{ width: '100%', maxWidth: 880, maxHeight: '92vh', overflowY: 'auto', background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 14, padding: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2, color: C.text3, marginBottom: 4 }}>CHI TIẾT NHẬT KÝ</div>
                <div style={{ fontSize: 18, color: C.text, fontWeight: 700 }}>
                  {detailLog.customer?.full_name || detailLog.customer?.phone_number || 'Khách hàng'}
                </div>
                <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>
                  {detailLog.source || 'call'} · {new Date(detailLog.contact_date).toLocaleString('vi-VN')}
                  {detailLog.sales?.username ? ` · ${detailLog.sales.username}` : ''}
                </div>
              </div>
              <button onClick={() => setDetailLog(null)} style={{ background: 'none', border: 'none', color: C.text3, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            {detailLog.audio_file_path && (
              <div style={{ marginBottom: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 10, color: C.text3, letterSpacing: 1.5, fontFamily: "'JetBrains Mono',monospace", marginBottom: 8 }}>AUDIO</div>
                <audio controls src={detailLog.audio_file_path} style={{ width: '100%' }} />
              </div>
            )}

            {(detailLog.transcription_raw || detailLog.notes) && (
              <div style={{ marginBottom: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 10, color: C.text3, letterSpacing: 1.5, fontFamily: "'JetBrains Mono',monospace", marginBottom: 8 }}>NỘI DUNG GỐC</div>
                {detailLog.transcription_raw && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: C.blue, marginBottom: 4 }}>Transcript</div>
                    <div style={{ fontSize: 12, color: C.text2, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{detailLog.transcription_raw}</div>
                  </div>
                )}
                {detailLog.notes && (
                  <div>
                    <div style={{ fontSize: 11, color: C.orange, marginBottom: 4 }}>Ghi chú</div>
                    <div style={{ fontSize: 12, color: C.text2, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{detailLog.notes}</div>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: 12, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 10, color: C.text3, letterSpacing: 1.5, fontFamily: "'JetBrains Mono',monospace", marginBottom: 8 }}>PHÂN TÍCH CRM HIỆN TẠI</div>
              {detailLog.ai_summary && <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.7, marginBottom: 8 }}>{detailLog.ai_summary}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {detailLog.ai_sentiment && <span style={{ fontSize: 11, color: SENT_CLR[detailLog.ai_sentiment] || C.text3, background: `${SENT_CLR[detailLog.ai_sentiment] || C.text3}15`, padding: '2px 8px', borderRadius: 5 }}>{detailLog.ai_sentiment}</span>}
                {detailLog.potential_score && <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>Tiềm năng {detailLog.potential_score}/10 {detailLog.potential_level ? `(${detailLog.potential_level})` : ''}</span>}
                {detailLog.ext_house_type && <span style={{ fontSize: 11, color: C.text2 }}>🏠 {detailLog.ext_house_type}</span>}
                {detailLog.ext_floors && <span style={{ fontSize: 11, color: C.text2 }}>🏢 {detailLog.ext_floors} tầng</span>}
                {detailLog.ext_floor_area && <span style={{ fontSize: 11, color: C.text2 }}>📐 {detailLog.ext_floor_area}m²</span>}
                {detailLog.ext_budget && <span style={{ fontSize: 11, color: C.orange }}>💰 {detailLog.ext_budget.toLocaleString('vi-VN')}đ</span>}
              </div>
              {detailLog.next_action && <div style={{ marginTop: 6, fontSize: 12, color: C.orange }}>→ {detailLog.next_action}</div>}
            </div>

            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => runLogAnalysis('crm_basic')}
                disabled={analysisLoading}
                style={{ background: analysisMode === 'crm_basic' ? '#3B82F625' : C.surface2, border: '1px solid #3B82F640', color: C.blue, borderRadius: 7, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
              >
                🤖 Phân tích CRM
              </button>
              <button
                onClick={() => runLogAnalysis('estimate_v1')}
                disabled={analysisLoading}
                style={{ background: analysisMode === 'estimate_v1' ? '#A855F725' : C.surface2, border: '1px solid #A855F740', color: C.purple, borderRadius: 7, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
              >
                📐 Phân tích khái toán
              </button>
              <button
                onClick={() => runLogAnalysis('estimate_preliminary')}
                disabled={analysisLoading}
                style={{ background: analysisMode === 'estimate_preliminary' ? 'rgba(14,165,233,0.15)' : C.surface2, border: '1px solid rgba(14,165,233,0.35)', color: '#0EA5E9', borderRadius: 7, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
              >
                🧱 Dự toán sơ bộ
              </button>
              {analysisLoading && <span style={{ fontSize: 12, color: C.text3 }}>Đang phân tích...</span>}
            </div>

            {analysisResult && (
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 10, color: C.text3, letterSpacing: 1.5, fontFamily: "'JetBrains Mono',monospace", marginBottom: 8 }}>KẾT QUẢ PHÂN TÍCH MỚI</div>
                {analysisResult.error ? (
                  <div style={{ fontSize: 12, color: C.red }}>❌ {analysisResult.error}</div>
                ) : (
                  <>
                    {analysisResult.summary && <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.7, marginBottom: 8 }}>{analysisResult.summary}</div>}
                    {analysisResult.status && (
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: analysisResult.status === 'needs_data' ? C.orange : C.green, background: `${analysisResult.status === 'needs_data' ? C.orange : C.green}15`, padding: '2px 8px', borderRadius: 5 }}>
                          {analysisResult.status === 'needs_data' ? 'Cần bổ sung dữ liệu' : 'Đủ dữ liệu'}
                        </span>
                      </div>
                    )}
                    {Array.isArray(analysisResult.missing_fields) && analysisResult.missing_fields.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: C.orange, marginBottom: 4 }}>Thiếu dữ liệu:</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {analysisResult.missing_fields.map((m: string) => (
                            <span key={m} style={{ fontSize: 11, color: C.orange, background: '#F9731614', padding: '2px 8px', borderRadius: 4 }}>{m}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {Array.isArray(analysisResult.recommended_questions) && analysisResult.recommended_questions.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>Câu hỏi gợi ý:</div>
                        {analysisResult.recommended_questions.map((q: string, idx: number) => (
                          <div key={`${idx}-${q}`} style={{ fontSize: 12, color: C.text2, lineHeight: 1.6 }}>{idx + 1}. {q}</div>
                        ))}
                      </div>
                    )}
                    {Array.isArray(analysisResult.facts) && analysisResult.facts.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>Facts:</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,220px) 1fr', gap: 6 }}>
                          {analysisResult.facts.map((f: any, idx: number) => (
                            <div key={`${f.key}-${idx}`} style={{ display: 'contents' }}>
                              <div style={{ fontSize: 11, color: C.blue }}>{f.key}</div>
                              <div style={{ fontSize: 12, color: C.text2 }}>{typeof f.value === 'object' ? JSON.stringify(f.value) : String(f.value ?? 'null')}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
