'use client'
// src/app/(dashboard)/settings/rag/import/page.tsx
// Báo cáo import liked messages vào RAG

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

const STATUS_COLOR: Record<string, string> = {
  imported: '#22C55E',
  similar:  '#F59E0B',
  skipped:  '#64748B',
  error:    '#EF4444',
  pending:  '#378ADD',
}
const STATUS_LABEL: Record<string, string> = {
  imported: '✅ Đã import',
  similar:  '⚠️ Tương tự',
  skipped:  '⏭ Bỏ qua',
  error:    '❌ Lỗi',
  pending:  '⏳ Chờ',
}

export default function RagImportPage() {
  const [preview,    setPreview]    = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [running,    setRunning]    = useState(false)
  const [results,    setResults]    = useState<any[] | null>(null)
  const [summary,    setSummary]    = useState<any | null>(null)
  const [countdown,  setCountdown]  = useState<number | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    loadPreview()
  }, [])

  // Auto countdown
  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) { runImport(); return }
    timerRef.current = setInterval(() => setCountdown(c => (c ?? 1) - 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [countdown])

  async function loadPreview() {
    setLoading(true)
    const r = await fetch('/api/rag/import-from-feedback')
    const j = await r.json()
    setPreview(j.data || [])
    setLoading(false)
  }

  function startCountdown() {
    setShowPreview(true)
    setCountdown(3)
  }

  function cancelCountdown() {
    if (timerRef.current) clearInterval(timerRef.current)
    setCountdown(null)
  }

  async function runImport(ids?: string[], forceOverride = false) {
    if (timerRef.current) clearInterval(timerRef.current)
    setCountdown(null)
    setRunning(true)
    setResults(null)
    setSummary(null)

    const r = await fetch('/api/rag/import-from-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message_ids:    ids || null,
        force_override: forceOverride,
      }),
    })
    const j = await r.json()
    setResults(j.results || [])
    setSummary(j.summary || {})
    setRunning(false)
    loadPreview()  // reload preview
  }

  async function deleteRagEntry(entryId: string, msgId: string) {
    if (!confirm('Xóa RAG entry này?')) return
    await fetch(`/api/rag/entries/${entryId}`, { method: 'DELETE' })
    // Reset message rag_status về pending
    await fetch(`/api/conversations/messages/${msgId}/rag-reset`, { method: 'POST' })
    loadPreview()
    setResults(prev => prev?.map(r => r.entry_id === entryId ? { ...r, status: 'deleted' } : r) || null)
  }

  async function importSingle(msgId: string, forceOverride = false) {
    await runImport([msgId], forceOverride)
  }

  const pendingCount = preview.filter(p => ['pending','similar'].includes(p.rag_status || 'pending')).length

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <Link href="/settings/rag" style={{ fontSize:12, color:'var(--color-text-tertiary)', textDecoration:'none' }}>← RAG Knowledge</Link>
          </div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--color-text-primary)', marginBottom:4 }}>
            📥 Import từ Feedback
          </h1>
          <div style={{ fontSize:13, color:'var(--color-text-secondary)' }}>
            {pendingCount} câu trả lời được 👍 chờ import vào RAG
          </div>
        </div>
        {pendingCount > 0 && !running && (
          <button onClick={startCountdown}
            style={{ background:'var(--color-background-success)', color:'var(--color-text-success)', border:'1px solid var(--color-border-success)', borderRadius:9, padding:'10px 22px', cursor:'pointer', fontSize:14, fontWeight:800 }}>
            📥 Import tất cả ({pendingCount})
          </button>
        )}
      </div>

      {/* Preview + countdown */}
      {showPreview && countdown !== null && (
        <div className="card" style={{ padding:'14px 18px', marginBottom:16, border:'1px solid var(--color-border-success)', background:'rgba(34,197,94,0.05)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:13, color:'var(--color-text-primary)' }}>
              Sẽ import <strong>{pendingCount} entries</strong> vào RAG...
              {countdown > 0
                ? <span style={{ color:'var(--color-text-success)', marginLeft:8 }}>Tự động chạy sau <strong>{countdown}s</strong></span>
                : <span style={{ color:'var(--color-text-success)', marginLeft:8 }}>Đang chạy...</span>
              }
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => { cancelCountdown(); runImport() }}
                style={{ background:'var(--color-background-success)', color:'var(--color-text-success)', border:'none', borderRadius:7, padding:'6px 16px', cursor:'pointer', fontSize:13, fontWeight:700 }}>
                ▶ Chạy ngay
              </button>
              <button onClick={() => { cancelCountdown(); setShowPreview(false) }}
                style={{ background:'transparent', border:'1px solid var(--color-border-tertiary)', color:'var(--color-text-secondary)', borderRadius:7, padding:'6px 14px', cursor:'pointer', fontSize:13 }}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Running indicator */}
      {running && (
        <div className="card" style={{ padding:'20px', marginBottom:16, textAlign:'center' }}>
          <div style={{ fontSize:13, color:'var(--color-text-secondary)' }}>
            <span className="spinner" style={{ width:16, height:16, display:'inline-block', marginRight:8 }} />
            Đang import + AI kiểm tra trùng lặp...
          </div>
        </div>
      )}

      {/* Import Results */}
      {results && summary && (
        <div style={{ marginBottom:20 }}>
          {/* Summary bar */}
          <div className="card" style={{ padding:'14px 18px', marginBottom:12 }}>
            <div style={{ fontSize:11, letterSpacing:'1.5px', color:'var(--color-text-tertiary)', fontWeight:700, marginBottom:10 }}>KẾT QUẢ IMPORT</div>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
              {[
                { label:'Tổng',      val: summary.total,    color:'var(--color-text-primary)' },
                { label:'Đã import', val: summary.imported, color:'#22C55E' },
                { label:'Tương tự',  val: summary.similar,  color:'#F59E0B' },
                { label:'Bỏ qua',   val: summary.skipped,  color:'#64748B' },
                { label:'Lỗi',      val: summary.error,    color:'#EF4444' },
              ].map(s => (
                <div key={s.label} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:24, fontWeight:900, color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Result list */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {results.map((r, i) => (
              <div key={r.id || i} className="card" style={{ padding:'14px 16px', borderLeft:`3px solid ${STATUS_COLOR[r.status] || '#64748B'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                  <span style={{ fontSize:12, fontWeight:700, color: STATUS_COLOR[r.status] }}>
                    {STATUS_LABEL[r.status] || r.status}
                  </span>
                  {r.status === 'imported' && r.entry_id && (
                    <button onClick={() => deleteRagEntry(r.entry_id, r.id)}
                      style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#EF4444', borderRadius:6, padding:'3px 10px', cursor:'pointer', fontSize:11 }}>
                      🗑 Xóa RAG
                    </button>
                  )}
                  {r.status === 'similar' && (
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => importSingle(r.id, true)}
                        style={{ background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.25)', color:'#F97316', borderRadius:6, padding:'3px 10px', cursor:'pointer', fontSize:11 }}>
                        Ghi đè
                      </button>
                      <button onClick={() => importSingle(r.id, false)}
                        style={{ background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.25)', color:'#22C55E', borderRadius:6, padding:'3px 10px', cursor:'pointer', fontSize:11 }}>
                        Import thêm
                      </button>
                    </div>
                  )}
                </div>

                {/* Q & A */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <div style={{ fontSize:10, letterSpacing:'1.5px', color:'var(--color-text-tertiary)', fontWeight:700, marginBottom:4 }}>CÂU HỎI KHÁCH</div>
                    <div style={{ fontSize:12, color:'var(--color-text-secondary)', lineHeight:1.5, padding:'8px 10px', background:'var(--color-background-tertiary)', borderRadius:6 }}>
                      {r.question || <em style={{ color:'var(--color-text-tertiary)' }}>Không tìm được câu hỏi</em>}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:10, letterSpacing:'1.5px', color:'var(--color-text-tertiary)', fontWeight:700, marginBottom:4 }}>CÂU TRẢ LỜI BOT</div>
                    <div style={{ fontSize:12, color:'var(--color-text-primary)', lineHeight:1.5, padding:'8px 10px', background:'var(--color-background-secondary)', borderRadius:6, maxHeight:100, overflowY:'auto' }}>
                      {r.answer}
                    </div>
                  </div>
                </div>

                {/* Similar entry comparison */}
                {r.status === 'similar' && (
                  <div style={{ marginTop:10, padding:'10px 12px', background:'rgba(249,115,22,0.05)', border:'1px solid rgba(249,115,22,0.2)', borderRadius:8 }}>
                    <div style={{ fontSize:10, letterSpacing:'1.5px', color:'#F97316', fontWeight:700, marginBottom:6 }}>
                      RAG TƯƠNG TỰ ĐÃ CÓ (similarity: {((r.score||0)*100).toFixed(0)}%)
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <div>
                        <div style={{ fontSize:10, color:'var(--color-text-tertiary)', marginBottom:3 }}>Câu hỏi cũ</div>
                        <div style={{ fontSize:12, color:'var(--color-text-secondary)', lineHeight:1.5 }}>{r.similar_question || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:10, color:'var(--color-text-tertiary)', marginBottom:3 }}>Câu trả lời cũ</div>
                        <div style={{ fontSize:12, color:'var(--color-text-secondary)', lineHeight:1.5, maxHeight:80, overflowY:'auto' }}>{r.similar_answer}</div>
                      </div>
                    </div>
                  </div>
                )}

                {r.reason && (
                  <div style={{ marginTop:6, fontSize:11, color:'var(--color-text-tertiary)' }}>Lý do: {r.reason}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview list — pending items */}
      {!results && (
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--color-text-primary)', marginBottom:12 }}>
            Danh sách chờ import
          </div>
          {loading ? (
            <div className="card" style={{ padding:40, textAlign:'center' }}><span className="spinner" /></div>
          ) : preview.length === 0 ? (
            <div className="card" style={{ padding:40, textAlign:'center', color:'var(--color-text-tertiary)', fontSize:13 }}>
              Chưa có câu trả lời nào được 👍 — vào Conversations và bấm 👍 trên bubble bot tốt
            </div>
          ) : preview.map((p, i) => (
            <div key={p.id} className="card" style={{ padding:'12px 16px', marginBottom:8, borderLeft:`3px solid ${STATUS_COLOR[p.rag_status || 'pending']}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ fontSize:11, fontWeight:700, color: STATUS_COLOR[p.rag_status || 'pending'] }}>
                    {STATUS_LABEL[p.rag_status || 'pending']}
                  </span>
                  {p.conversation && (
                    <span style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>
                      {p.conversation.channel} · {p.conversation.display_name || p.conversation.id.slice(-6)}
                    </span>
                  )}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  {['pending','similar'].includes(p.rag_status || 'pending') && (
                    <button onClick={() => importSingle(p.id)}
                      style={{ background:'var(--color-background-info)', color:'var(--color-text-info)', border:'1px solid var(--color-border-info)', borderRadius:6, padding:'3px 10px', cursor:'pointer', fontSize:11 }}>
                      Import
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div style={{ fontSize:12, color:'var(--color-text-secondary)', padding:'6px 8px', background:'var(--color-background-tertiary)', borderRadius:6 }}>
                  <span style={{ fontSize:10, color:'var(--color-text-tertiary)', display:'block', marginBottom:2 }}>Câu hỏi</span>
                  {p.customer_question || <em style={{ color:'var(--color-text-tertiary)' }}>Không tìm được</em>}
                </div>
                <div style={{ fontSize:12, color:'var(--color-text-primary)', padding:'6px 8px', background:'var(--color-background-secondary)', borderRadius:6, maxHeight:80, overflowY:'auto' }}>
                  <span style={{ fontSize:10, color:'var(--color-text-tertiary)', display:'block', marginBottom:2 }}>Câu trả lời bot</span>
                  {p.bot_answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
