'use client'
// src/app/(dashboard)/settings/rag/page.tsx — RAG Knowledge Base Manager

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

// ─── Types ────────────────────────────────────────────────────────
type EntryType = 'qa' | 'knowledge' | 'price' | 'process' | 'policy'

interface RagEntry {
  id:          string
  type:        EntryType
  category:    string | null
  question:    string | null
  answer:      string
  tags:        string[]
  quality:     number
  is_active:   boolean
  qdrant_id:   string | null
  sheet_row:   number | null
  created_at:  string
  creator?:    { username: string } | null
}

interface SyncStatus {
  qdrant_status:  string
  qdrant_points:  number
  db_entries:     number
  db_synced?:     number
  in_sync:        boolean
}

// ─── Constants ────────────────────────────────────────────────────
const TYPE_META: Record<EntryType, { label: string; icon: string; color: string; desc: string; placeholder_q?: string; placeholder_a: string }> = {
  qa:        { label:'Hỏi - Đáp',  icon:'💬', color:'#3B82F6', desc:'Câu hỏi thường gặp & câu trả lời chuẩn', placeholder_q:'VD: Xây nhà phố 5 tầng hết bao nhiêu?', placeholder_a:'VD: Chi phí xây nhà phố 5 tầng thường dao động từ 1.5 - 2.5 tỷ tùy vào diện tích...' },
  knowledge: { label:'Kiến thức',  icon:'📚', color:'#8B5CF6', desc:'Thông tin chuyên môn, kỹ thuật', placeholder_a:'VD: Bê tông cốt thép thông thường có mác M200-M300 cho nhà dân dụng...' },
  price:     { label:'Bảng giá',   icon:'💰', color:'#10B981', desc:'Giá vật liệu, đơn giá xây dựng', placeholder_a:'VD: Đơn giá xây thô: 4.5-6.5 triệu/m². Đơn giá hoàn thiện: 6-9 triệu/m²...' },
  process:   { label:'Quy trình',  icon:'📋', color:'#F59E0B', desc:'Quy trình thi công, tiến độ', placeholder_a:'VD: Quy trình xây dựng gồm 5 giai đoạn: 1. Thiết kế & cấp phép, 2. Móng...' },
  policy:    { label:'Chính sách', icon:'📜', color:'#EF4444', desc:'Bảo hành, thanh toán, cam kết', placeholder_a:'VD: Công ty bảo hành kết cấu 5 năm, hoàn thiện 2 năm kể từ ngày bàn giao...' },
}

const CATEGORIES = ['Nhà phố', 'Biệt thự', 'Nhà cấp 4', 'Chung cư', 'Văn phòng', 'Kho xưởng', 'Chung']

// ─── Entry Form Modal ─────────────────────────────────────────────
function EntryModal({ entry, onClose, onSaved }: {
  entry?: RagEntry | null
  onClose: () => void
  onSaved: (e: RagEntry) => void
}) {
  const [type,     setType]     = useState<EntryType>(entry?.type || 'qa')
  const [category, setCategory] = useState(entry?.category || '')
  const [question, setQuestion] = useState(entry?.question || '')
  const [answer,   setAnswer]   = useState(entry?.answer   || '')
  const [tagInput, setTagInput] = useState(entry?.tags?.join(', ') || '')
  const [quality,  setQuality]  = useState(entry?.quality  || 5)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const meta = TYPE_META[type]
  const isEdit = !!entry

  const handleSave = async () => {
    if (!answer.trim()) { setError('Vui lòng nhập nội dung / câu trả lời'); return }
    if (type === 'qa' && !question.trim()) { setError('Loại Hỏi-Đáp cần có câu hỏi'); return }

    setSaving(true); setError('')
    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean)
    const body = { type, category: category || null, question: question.trim() || null, answer: answer.trim(), tags, quality }

    try {
      const r = await fetch(isEdit ? `/api/rag/entries/${entry!.id}` : '/api/rag/entries', {
        method:  isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) { setError(j.error || 'Lỗi lưu'); setSaving(false); return }
      onSaved(j.data)
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, width:'100%', maxWidth:680, maxHeight:'90vh', overflowY:'auto' }}>
        {/* Header */}
        <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>
            {isEdit ? '✏️ Chỉnh sửa kiến thức' : '✨ Thêm kiến thức mới'}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text3)', fontSize:20, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>

        <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:18 }}>
          {/* Type selector */}
          <div>
            <label style={{ fontSize:11, color:'var(--text3)', fontWeight:700, letterSpacing:'0.08em', display:'block', marginBottom:8 }}>LOẠI KIẾN THỨC</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:7 }}>
              {(Object.entries(TYPE_META) as [EntryType, typeof TYPE_META[EntryType]][]).map(([t, m]) => (
                <button key={t} onClick={() => setType(t)}
                  style={{
                    padding:'9px 6px', borderRadius:9, cursor:'pointer', textAlign:'center',
                    border:`1.5px solid ${type===t ? m.color : 'var(--border)'}`,
                    background: type===t ? `${m.color}15` : 'var(--surface2)',
                    transition:'all .15s',
                  }}>
                  <div style={{ fontSize:20, marginBottom:3 }}>{m.icon}</div>
                  <div style={{ fontSize:10, fontWeight:700, color: type===t ? m.color : 'var(--text3)', lineHeight:1.3 }}>{m.label}</div>
                </button>
              ))}
            </div>
            <div style={{ fontSize:11, color:'var(--text4)', marginTop:6, fontStyle:'italic' }}>{meta.desc}</div>
          </div>

          {/* Category */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div>
              <label style={{ fontSize:11, color:'var(--text3)', fontWeight:700, letterSpacing:'0.08em', display:'block', marginBottom:6 }}>DANH MỤC (tùy chọn)</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:8, padding:'9px 12px', color:'var(--text)', fontSize:13 }}>
                <option value="">Tất cả / Chung</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--text3)', fontWeight:700, letterSpacing:'0.08em', display:'block', marginBottom:6 }}>CHẤT LƯỢNG (1-10)</label>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <input type="range" min={1} max={10} value={quality} onChange={e => setQuality(+e.target.value)}
                  style={{ flex:1 }} />
                <span style={{
                  fontSize:14, fontWeight:800, minWidth:28, textAlign:'center',
                  color: quality>=7?'var(--green)':quality>=5?'var(--accent)':'var(--red)',
                }}>{quality}</span>
              </div>
            </div>
          </div>

          {/* Question (QA only) */}
          {type === 'qa' && (
            <div>
              <label style={{ fontSize:11, color:'var(--text3)', fontWeight:700, letterSpacing:'0.08em', display:'block', marginBottom:6 }}>
                CÂU HỎI <span style={{ color:'var(--red)' }}>*</span>
              </label>
              <input value={question} onChange={e => setQuestion(e.target.value)}
                placeholder={meta.placeholder_q}
                style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:8, padding:'10px 12px', color:'var(--text)', fontSize:13 }}
              />
            </div>
          )}

          {/* Answer / Content */}
          <div>
            <label style={{ fontSize:11, color:'var(--text3)', fontWeight:700, letterSpacing:'0.08em', display:'block', marginBottom:6 }}>
              {type==='qa' ? 'CÂU TRẢ LỜI' : 'NỘI DUNG KIẾN THỨC'} <span style={{ color:'var(--red)' }}>*</span>
            </label>
            <textarea value={answer} onChange={e => setAnswer(e.target.value)}
              placeholder={meta.placeholder_a} rows={5}
              style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:8, padding:'10px 12px', color:'var(--text)', fontSize:13, resize:'vertical', lineHeight:1.6 }}
            />
            <div style={{ fontSize:11, color:'var(--text4)', marginTop:4 }}>
              Viết rõ ràng, cụ thể — càng chi tiết bot càng trả lời tốt hơn
            </div>
          </div>

          {/* Tags */}
          <div>
            <label style={{ fontSize:11, color:'var(--text3)', fontWeight:700, letterSpacing:'0.08em', display:'block', marginBottom:6 }}>TAGS (cách nhau bằng dấu phẩy)</label>
            <input value={tagInput} onChange={e => setTagInput(e.target.value)}
              placeholder="VD: giá, thi công, bê tông, móng"
              style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:8, padding:'9px 12px', color:'var(--text)', fontSize:13 }}
            />
          </div>

          {error && (
            <div style={{ padding:'10px 14px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, fontSize:12, color:'var(--red)' }}>
              ❌ {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', paddingTop:4 }}>
            <button onClick={onClose}
              style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text2)', padding:'9px 20px', borderRadius:8, cursor:'pointer', fontSize:13 }}>
              Hủy
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ background: saving?'var(--surface3)':'var(--accent)', border:'none', color:'white', padding:'9px 22px', borderRadius:8, cursor:saving?'not-allowed':'pointer', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:7, opacity:saving?0.7:1 }}>
              {saving ? <><span className="spinner" style={{width:14,height:14,borderWidth:2}} /> Đang lưu...</> : isEdit ? '💾 Lưu thay đổi' : '✨ Thêm & Embed'}
            </button>
          </div>

          {/* Async note */}
          {!isEdit && (
            <div style={{ fontSize:11, color:'var(--text4)', textAlign:'center', fontStyle:'italic' }}>
              Sau khi lưu, hệ thống tự động embed vào Qdrant & sync Google Sheets trong nền
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Test Search Panel ────────────────────────────────────────────
function TestSearchPanel() {
  const [query,     setQuery]   = useState('')
  const [results,   setResults] = useState<any[]>([])
  const [loading,   setLoading] = useState(false)
  const [threshold, setThreshold] = useState(0.60)
  const [searched,  setSearched] = useState(false)

  const run = async () => {
    if (!query.trim()) return
    setLoading(true); setSearched(false)
    const r = await fetch(`/api/rag/search?q=${encodeURIComponent(query)}&threshold=${threshold}`)
    const j = await r.json()
    setResults(j.data || [])
    setLoading(false); setSearched(true)
  }

  return (
    <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, padding:16 }}>
      <div style={{ fontSize:11, color:'var(--text3)', fontWeight:700, letterSpacing:'1.5px', marginBottom:12 }}>🔍 TEST RAG SEARCH</div>
      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
        <input value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if(e.key==='Enter') run() }}
          placeholder="Nhập câu hỏi như khách hàng..."
          style={{ flex:1, background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:8, padding:'8px 12px', color:'var(--text)', fontSize:13 }}
        />
        <button onClick={run} disabled={loading || !query.trim()}
          style={{ background:'var(--accent)', border:'none', color:'white', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
          {loading ? '...' : 'Tìm'}
        </button>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <span style={{ fontSize:11, color:'var(--text4)' }}>Ngưỡng tương đồng:</span>
        <input type="range" min={0.4} max={0.95} step={0.05} value={threshold} onChange={e => setThreshold(+e.target.value)} style={{ flex:1 }} />
        <span style={{ fontSize:12, fontWeight:700, color:'var(--text2)', minWidth:30 }}>{threshold}</span>
      </div>
      {searched && results.length === 0 && (
        <div style={{ fontSize:12, color:'var(--text4)', textAlign:'center', padding:'10px 0' }}>
          Không tìm thấy kết quả phù hợp (threshold: {threshold})
        </div>
      )}
      {results.map((r, i) => (
        <div key={i} style={{ padding:'10px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, marginBottom:7 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <span style={{ fontSize:10, fontWeight:700, color: TYPE_META[r.type as EntryType]?.color || 'var(--text3)', background:`${TYPE_META[r.type as EntryType]?.color || '#888'}15`, padding:'2px 7px', borderRadius:5 }}>
                {TYPE_META[r.type as EntryType]?.icon} {TYPE_META[r.type as EntryType]?.label || r.type}
              </span>
              {r.category && <span style={{ fontSize:10, color:'var(--text4)' }}>{r.category}</span>}
            </div>
            <span style={{ fontSize:11, fontWeight:800, color: r.score>=0.80?'var(--green)':r.score>=0.70?'var(--accent)':'var(--text3)' }}>
              {(r.score*100).toFixed(1)}%
            </span>
          </div>
          {r.question && <div style={{ fontSize:11, color:'var(--text3)', marginBottom:3 }}>❓ {r.question}</div>}
          <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.55 }}>{r.answer.substring(0, 200)}{r.answer.length>200?'...':''}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Entry Card ───────────────────────────────────────────────────
function EntryCard({ entry, onEdit, onToggle, onDelete, onDeletePoint }: {
  entry:    RagEntry
  onEdit:   () => void
  onToggle: () => void
  onDelete: () => void
  onDeletePoint: () => void
}) {
  const meta = TYPE_META[entry.type] || { label: entry.type, icon: '📄', color: '#888' }

  return (
    <div style={{
      background:'var(--surface2)', border:`1px solid ${entry.is_active ? 'var(--border)' : 'var(--border)'}`,
      borderRadius:10, padding:'13px 16px', opacity: entry.is_active ? 1 : 0.55,
      transition:'opacity .2s',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
        <div style={{ flex:1, minWidth:0 }}>
          {/* Type + category + qdrant badge */}
          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', marginBottom:7 }}>
            <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:5, background:`${meta.color}15`, color: meta.color }}>
              {meta.icon} {meta.label}
            </span>
            {entry.category && (
              <span style={{ fontSize:10, color:'var(--text4)', background:'var(--surface3)', padding:'2px 7px', borderRadius:5 }}>{entry.category}</span>
            )}
            {entry.qdrant_id ? (
              <span style={{ fontSize:9, color:'#10B981', background:'rgba(16,185,129,0.1)', padding:'2px 7px', borderRadius:5 }}>⚡ Qdrant</span>
            ) : (
              <span style={{ fontSize:9, color:'var(--yellow)', background:'rgba(234,179,8,0.1)', padding:'2px 7px', borderRadius:5 }}>⏳ Pending</span>
            )}
            {entry.sheet_row && (
              <span style={{ fontSize:9, color:'#34A853', background:'rgba(52,168,83,0.1)', padding:'2px 7px', borderRadius:5 }}>📊 Sheets #{entry.sheet_row}</span>
            )}
            <span style={{ fontSize:10, fontWeight:700, marginLeft:'auto',
              color: entry.quality>=7?'var(--green)':entry.quality>=5?'var(--accent)':'var(--red)',
            }}>★ {entry.quality}/10</span>
          </div>

          {/* Question */}
          {entry.question && (
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:4, fontStyle:'italic' }}>❓ {entry.question}</div>
          )}
          {/* Answer preview */}
          <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.55, marginBottom:entry.tags.length?6:0 }}>
            {entry.answer.substring(0,150)}{entry.answer.length>150?'...':''}
          </div>
          {/* Tags */}
          {entry.tags.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {entry.tags.map(t => (
                <span key={t} style={{ fontSize:10, color:'var(--text4)', background:'var(--surface3)', padding:'1px 6px', borderRadius:4 }}>#{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display:'flex', flexDirection:'column', gap:5, flexShrink:0 }}>
          <button onClick={onEdit}
            style={{ background:'var(--surface3)', border:'1px solid var(--border2)', color:'var(--text2)', padding:'5px 12px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>
            ✏️ Sửa
          </button>
          <button onClick={onToggle}
            style={{ background:'transparent', border:`1px solid ${entry.is_active?'rgba(239,68,68,0.3)':'rgba(16,185,129,0.3)'}`, color:entry.is_active?'var(--red)':'var(--green)', padding:'5px 12px', borderRadius:6, cursor:'pointer', fontSize:11 }}>
            {entry.is_active ? '🔕 Tắt' : '✅ Bật'}
          </button>
          <button onClick={onDeletePoint}
            style={{ background:'transparent', border:'1px solid rgba(245,158,11,0.35)', color:'var(--yellow)', padding:'5px 12px', borderRadius:6, cursor:'pointer', fontSize:11 }}>
            🧹 Xóa point
          </button>
          <button onClick={onDelete}
            style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--text4)', padding:'5px 12px', borderRadius:6, cursor:'pointer', fontSize:11 }}>
            🗑
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────
export default function RagSettingsPage() {
  const { data: session } = useSession()
  const roleKeys = session?.user?.role_keys || (session?.user?.role ? [session.user.role] : [])
  const [entries,     setEntries]     = useState<RagEntry[]>([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [syncStatus,  setSyncStatus]  = useState<SyncStatus | null>(null)
  const [syncing,     setSyncing]     = useState(false)
  const [showModal,   setShowModal]   = useState(false)
  const [editEntry,   setEditEntry]   = useState<RagEntry | null>(null)
  const [filterType,  setFilterType]  = useState('')
  const [filterCat,   setFilterCat]   = useState('')
  const [search,      setSearch]      = useState('')
  const [activeTab,   setActiveTab]   = useState<'entries'|'test'|'config'>('entries')
  const [toast,       setToast]       = useState('')

  const canEdit = roleKeys.some((x) => ['admin', 'manager'].includes(x))

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    const q = new URLSearchParams()
    if (filterType) q.set('type', filterType)
    if (filterCat)  q.set('category', filterCat)
    if (search)     q.set('search', search)
    const r = await fetch(`/api/rag/entries?${q}`)
    const j = await r.json()
    setEntries(j.data || [])
    setTotal(j.total || 0)
    setLoading(false)
  }, [filterType, filterCat, search])

  const loadSyncStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/rag/sync')
      const j = await r.json()
      setSyncStatus(j.data)
    } catch {}
  }, [])

  useEffect(() => { load() },           [load])
  useEffect(() => { loadSyncStatus() }, [loadSyncStatus])

  const handleSaved = (entry: RagEntry) => {
    setShowModal(false); setEditEntry(null)
    load()
    showToast('✅ Đã lưu! Đang embed vào Qdrant...')
  }

  const handleToggle = async (entry: RagEntry) => {
    await fetch(`/api/rag/entries/${entry.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !entry.is_active }),
    })
    load()
    showToast(entry.is_active ? '🔕 Đã tắt entry' : '✅ Đã bật entry')
  }

  const handleDelete = async (entry: RagEntry) => {
    if (!confirm(`Xóa "${entry.question || entry.answer.substring(0,50)}..."?\nEntry này cũng sẽ bị xóa khỏi Qdrant.`)) return
    await fetch(`/api/rag/entries/${entry.id}`, { method: 'DELETE' })
    load(); loadSyncStatus()
    showToast('🗑 Đã xóa')
  }

  const handleDeletePoint = async (entry: RagEntry) => {
    if (!entry.qdrant_id) {
      showToast('Entry nay chua co point trong Qdrant')
      return
    }
    if (!confirm(`Xoa point Qdrant cua entry "${entry.question || entry.answer.substring(0, 50)}..."?`)) return
    const r = await fetch(`/api/rag/entries/${entry.id}/point`, { method: 'DELETE' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      showToast(`❌ ${j.error || 'Khong the xoa point'}`)
      return
    }
    load(); loadSyncStatus()
    showToast('🧹 Da xoa point khoi Qdrant (giu entry DB)')
  }

  const handleSync = async () => {
    setSyncing(true)
    const r = await fetch('/api/rag/sync', { method: 'POST' })
    const j = await r.json()
    setSyncing(false)
    loadSyncStatus()
    showToast(`✅ Synced ${j.data?.synced || 0} entries${j.data?.errors ? `, ${j.data.errors} lỗi` : ''}`)
  }

  const handlePullPreview = async () => {
    const r = await fetch('/api/rag/pull-from-qdrant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apply: false, limit: 10000 }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      showToast(`❌ ${j.error || 'Preview pull that bai'}`)
      return
    }
    const d = j.data || {}
    showToast(`Preview: scan ${d.scanned || 0}, tao moi ${d.will_create || 0}, cap nhat ${d.will_update || 0}`)
  }

  const handlePullApply = async () => {
    if (!confirm('Pull du lieu cu tu Qdrant vao DB va ghi du lieu?')) return
    const r = await fetch('/api/rag/pull-from-qdrant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apply: true, limit: 10000 }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      showToast(`❌ ${j.error || 'Pull apply that bai'}`)
      return
    }
    const d = j.data || {}
    load(); loadSyncStatus()
    showToast(`✅ Pull xong: tao ${d.created || 0}, cap nhat ${d.updated || 0}`)
  }

  // Stats
  const activeCount = entries.filter(e => e.is_active).length
  const syncedCount = entries.filter(e => e.qdrant_id).length

  return (
    <div className="fade-up" style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text)', marginBottom:4 }}>🧠 RAG Knowledge Base</h1>
          <div style={{ fontSize:13, color:'var(--text3)' }}>
            Quản lý kiến thức cho chatbot — Qdrant vector search + Google Sheets backup
          </div>
        </div>
        {canEdit && (
          <button onClick={() => { setEditEntry(null); setShowModal(true) }}
            style={{ background:'var(--accent)', border:'none', color:'white', padding:'10px 20px', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:8, boxShadow:'0 2px 12px rgba(249,115,22,0.3)' }}>
            ✨ Thêm kiến thức
          </button>
        )}
      </div>

      {/* Status cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:22 }}>
        {[
          { label:'Tổng entries', val: total, icon:'📚', color:'var(--blue)' },
          { label:'Đang hoạt động', val: activeCount, icon:'✅', color:'var(--green)' },
          { label:'Đã embed Qdrant', val: syncedCount, icon:'⚡', color:'#10B981' },
          { label:'Qdrant points', val: syncStatus?.qdrant_points ?? '...', icon:'🔮', color: syncStatus?.in_sync ? 'var(--green)' : 'var(--yellow)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding:'14px 16px' }}>
            <div style={{ fontSize:20, marginBottom:5 }}>{s.icon}</div>
            <div style={{ fontSize:22, fontWeight:800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Qdrant status bar */}
      {syncStatus && (
        <div style={{
          padding:'10px 16px', borderRadius:9, marginBottom:18,
          background: syncStatus.in_sync ? 'rgba(16,185,129,0.07)' : 'rgba(234,179,8,0.07)',
          border: `1px solid ${syncStatus.in_sync ? 'rgba(16,185,129,0.25)' : 'rgba(234,179,8,0.3)'}`,
          display:'flex', justifyContent:'space-between', alignItems:'center',
        }}>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ color: syncStatus.qdrant_status==='ok' ? 'var(--green)' : 'var(--red)' }}>
              {syncStatus.qdrant_status==='ok' ? '🟢' : '🔴'}
            </span>
            <span style={{ fontSize:12, color:'var(--text2)' }}>
              Qdrant: <strong>{syncStatus.qdrant_points}</strong> points | DB: <strong>{syncStatus.db_entries}</strong> entries
              {typeof syncStatus.db_synced === 'number' && (
                <span> | Synced: <strong>{syncStatus.db_synced}</strong></span>
              )}
              {syncStatus.in_sync ? ' — ✅ Đồng bộ' : ' — ⚠️ Chưa đồng bộ'}
            </span>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={handlePullPreview}
              style={{ background:'var(--surface2)', border:'1px solid var(--border2)', color:'var(--text2)', padding:'5px 12px', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:600 }}>
              👀 Preview Pull
            </button>
            <button onClick={handlePullApply}
              style={{ background:'var(--surface2)', border:'1px solid var(--border2)', color:'var(--text2)', padding:'5px 12px', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:600 }}>
              ⬇ Pull from Qdrant
            </button>
            <button onClick={handleSync} disabled={syncing}
              style={{ background:'var(--surface2)', border:'1px solid var(--border2)', color:'var(--text2)', padding:'5px 14px', borderRadius:7, cursor:syncing?'not-allowed':'pointer', fontSize:12, fontWeight:600 }}>
              {syncing ? '⏳ Syncing...' : '🔄 Sync to Qdrant'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, background:'var(--surface2)', borderRadius:9, padding:4, marginBottom:18, width:'fit-content' }}>
        {([['entries','📚 Danh sách'],['test','🔍 Test Search'],['config','⚙️ Cấu hình']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding:'7px 18px', borderRadius:7, border:'none', cursor:'pointer', fontSize:12, fontWeight: activeTab===t?700:400,
              background: activeTab===t?'var(--accent)':'transparent', color: activeTab===t?'white':'var(--text3)', transition:'all .15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Entries list ──────────────────────────────────────── */}
      {activeTab === 'entries' && (
        <>
          {/* Filters */}
          <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Tìm kiếm..."
              style={{ flex:1, minWidth:180, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', color:'var(--text)', fontSize:13 }}
            />
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', color:'var(--text)', fontSize:13 }}>
              <option value="">Tất cả loại</option>
              {(Object.entries(TYPE_META) as [EntryType, any][]).map(([t,m]) => <option key={t} value={t}>{m.icon} {m.label}</option>)}
            </select>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', color:'var(--text)', fontSize:13 }}>
              <option value="">Tất cả danh mục</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>
              <span className="spinner" style={{ width:28, height:28 }} />
            </div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 24px', background:'var(--surface2)', borderRadius:12, border:'1px dashed var(--border2)' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🧠</div>
              <div style={{ fontSize:15, fontWeight:600, color:'var(--text)', marginBottom:6 }}>Chưa có kiến thức nào</div>
              <div style={{ fontSize:13, color:'var(--text3)', marginBottom:18 }}>Thêm kiến thức để chatbot có thể trả lời chính xác hơn</div>
              {canEdit && (
                <button onClick={() => { setEditEntry(null); setShowModal(true) }}
                  style={{ background:'var(--accent)', border:'none', color:'white', padding:'10px 24px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                  ✨ Thêm kiến thức đầu tiên
                </button>
              )}
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {entries.map(entry => (
                <EntryCard key={entry.id} entry={entry}
                  onEdit={() => { setEditEntry(entry); setShowModal(true) }}
                  onToggle={() => handleToggle(entry)}
                  onDeletePoint={() => handleDeletePoint(entry)}
                  onDelete={() => handleDelete(entry)}
                />
              ))}
              {total > entries.length && (
                <div style={{ textAlign:'center', fontSize:12, color:'var(--text4)', padding:'8px 0' }}>
                  Hiển thị {entries.length}/{total} entries
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── TAB: Test Search ──────────────────────────────────────── */}
      {activeTab === 'test' && <TestSearchPanel />}

      {/* ── TAB: Config ──────────────────────────────────────────── */}
      {activeTab === 'config' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="card" style={{ padding:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:14 }}>⚡ Qdrant Configuration</div>
            {[
              { var:'QDRANT_URL',        val:'http://localhost:6333',  desc:'URL của Qdrant server' },
              { var:'QDRANT_COLLECTION', val:'crm_rag',               desc:'Tên collection trong Qdrant' },
              { var:'OLLAMA_EMBED_MODEL',val:'nomic-embed-text',      desc:'Model embed của Ollama (768 dims)' },
            ].map(c => (
              <div key={c.var} style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:10, padding:'10px 12px', background:'var(--surface2)', borderRadius:8 }}>
                <code style={{ fontSize:11, color:'var(--blue)', background:'rgba(59,130,246,0.1)', padding:'2px 8px', borderRadius:4, flexShrink:0, fontFamily:"'JetBrains Mono',monospace" }}>{c.var}</code>
                <div>
                  <div style={{ fontSize:12, color:'var(--text)', fontFamily:"'JetBrains Mono',monospace" }}>{c.val}</div>
                  <div style={{ fontSize:11, color:'var(--text4)', marginTop:2 }}>{c.desc}</div>
                </div>
              </div>
            ))}
            <div style={{ fontSize:11, color:'var(--text4)', marginTop:8, fontStyle:'italic' }}>
              Cấu hình trong .env.local — khởi động lại server để áp dụng
            </div>
          </div>

          <div className="card" style={{ padding:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:14 }}>📊 Google Sheets Configuration</div>
            {[
              { var:'GOOGLE_SHEET_ID',       val:'your-sheet-id',       desc:'ID từ URL Google Sheet' },
              { var:'GOOGLE_SHEET_NAME',     val:'RAG Knowledge Base',  desc:'Tên sheet/tab' },
              { var:'GOOGLE_SERVICE_EMAIL',  val:'sa@project.iam.g...',  desc:'Email của Service Account' },
              { var:'GOOGLE_SERVICE_KEY',    val:'-----BEGIN PRIVATE...',desc:'Private key của Service Account' },
            ].map(c => (
              <div key={c.var} style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:10, padding:'10px 12px', background:'var(--surface2)', borderRadius:8 }}>
                <code style={{ fontSize:11, color:'#34A853', background:'rgba(52,168,83,0.1)', padding:'2px 8px', borderRadius:4, flexShrink:0, fontFamily:"'JetBrains Mono',monospace" }}>{c.var}</code>
                <div>
                  <div style={{ fontSize:12, color:'var(--text)', fontFamily:"'JetBrains Mono',monospace" }}>{c.val}</div>
                  <div style={{ fontSize:11, color:'var(--text4)', marginTop:2 }}>{c.desc}</div>
                </div>
              </div>
            ))}
            <div style={{ padding:'12px 14px', background:'rgba(52,168,83,0.07)', border:'1px solid rgba(52,168,83,0.2)', borderRadius:8, fontSize:12, color:'var(--text2)', marginTop:6 }}>
              <strong>Hướng dẫn:</strong> Tạo Service Account → Download JSON → Share Google Sheet với email SA (Editor) → Copy private_key và client_email vào .env.local
            </div>
          </div>

          <div className="card" style={{ padding:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:14 }}>🤖 Cài Ollama Embed Model</div>
            <div style={{ background:'var(--surface3)', borderRadius:8, padding:'12px 14px', fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'var(--text2)' }}>
              <div style={{ color:'var(--text4)', marginBottom:4 }}># Pull embedding model (chỉ cần 1 lần)</div>
              <div>ollama pull nomic-embed-text</div>
            </div>
            <div style={{ fontSize:11, color:'var(--text4)', marginTop:8 }}>Model 768 dims, nhẹ (~274MB), tốt cho tiếng Việt</div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <EntryModal
          entry={editEntry}
          onClose={() => { setShowModal(false); setEditEntry(null) }}
          onSaved={handleSaved}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)', background:'var(--surface)', border:'1px solid var(--border2)', color:'var(--text)', padding:'10px 22px', borderRadius:10, fontSize:13, zIndex:9999, boxShadow:'var(--shadow-md)', whiteSpace:'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
