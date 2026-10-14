'use client'
// src/app/(dashboard)/customers/[id]/page.tsx — V3.0
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── Constants ─────────────────────────────────────────────────────
const PIPELINE = [
  'Mới','Đang tìm hiểu','Hẹn gặp','Đang thương thảo',
  'Chờ ký HĐ','Đã ký HĐ','Đang thi công',
  'Hoàn công','Bảo hành','Hoàn tất','Tạm ngưng','Từ chối',
]
const STATUS_COLOR: Record<string,string> = {
  'Mới':'#378ADD','Đang tìm hiểu':'#8B5CF6','Hẹn gặp':'#F59E0B',
  'Đang thương thảo':'#F97316','Chờ ký HĐ':'#EF4444','Đã ký HĐ':'#22C55E',
  'Đang thi công':'#10B981','Hoàn công':'#06B6D4','Bảo hành':'#6366F1',
  'Hoàn tất':'#1D9E75','Tạm ngưng':'#64748B','Từ chối':'#475569',
}
const POTENTIAL_COLOR: Record<string,string> = { 'cao':'#22C55E','trung':'#F59E0B','thấp':'#EF4444' }
const SOURCE_ICON: Record<string,string> = {
  'telegram':'✈️','zalo':'💙','messenger':'🟠','call':'📞','referral':'🤝','google':'🔍','other':'📌',
}
const TIMELINE_TYPES = [
  { type:'meeting',      label:'Gặp trực tiếp',   icon:'🤝' },
  { type:'contract',     label:'Ký hợp đồng',      icon:'✍️' },
  { type:'construction', label:'Khởi công',         icon:'🔨' },
  { type:'handover',     label:'Hoàn công',         icon:'🏁' },
  { type:'warranty',     label:'Bảo hành',          icon:'🛡️' },
  { type:'note',         label:'Ghi chú',           icon:'📝' },
]
const TIMELINE_ICON: Record<string,string> = {
  chat_started:'💬', call:'📞', status_change:'🔄', project_created:'📋',
  meeting:'🤝', contract:'✍️', construction:'🔨', handover:'🏁', warranty:'🛡️', note:'📝',
}

function fmtBudget(min?: number|null, max?: number|null) {
  if (!min && !max) return null
  const f = (v: number) => v >= 1e9 ? `${(v/1e9).toFixed(1)}tỷ` : v >= 1e6 ? `${(v/1e6).toFixed(0)}tr` : v.toLocaleString('vi-VN')
  if (min && max) return `${f(min)} – ${f(max)}`
  if (min) return `từ ${f(min)}`
  return `đến ${f(max!)}`
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' })
}
function fmtDatetime(s: string) {
  return new Date(s).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

// ─── Field row with edit ────────────────────────────────────────────
function EditableField({ label, value, onSave, type='text' }: {
  label: string; value: any; onSave: (v: any) => void; type?: string
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(value ?? '')
  useEffect(() => setVal(value ?? ''), [value])

  if (editing) return (
    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
      <span style={{ fontSize:11, color:'var(--color-text-tertiary)', width:110, flexShrink:0 }}>{label}</span>
      <input type={type} value={val} onChange={e => setVal(e.target.value)} autoFocus
        style={{ flex:1, background:'var(--color-background-tertiary)', border:'1px solid var(--color-border-primary)', borderRadius:6, padding:'4px 8px', color:'var(--color-text-primary)', fontSize:12 }}
        onKeyDown={e => { if (e.key==='Enter') { onSave(val); setEditing(false) } if (e.key==='Escape') setEditing(false) }} />
      <button onClick={() => { onSave(val); setEditing(false) }}
        style={{ background:'var(--color-background-success)', border:'none', color:'var(--color-text-success)', borderRadius:5, padding:'4px 8px', cursor:'pointer', fontSize:11 }}>✓</button>
      <button onClick={() => setEditing(false)}
        style={{ background:'transparent', border:'1px solid var(--color-border-tertiary)', color:'var(--color-text-tertiary)', borderRadius:5, padding:'4px 8px', cursor:'pointer', fontSize:11 }}>✕</button>
    </div>
  )

  return (
    <div style={{ display:'flex', gap:6, alignItems:'center', padding:'5px 0', borderBottom:'1px solid var(--color-border-tertiary)' }}>
      <span style={{ fontSize:11, color:'var(--color-text-tertiary)', width:110, flexShrink:0 }}>{label}</span>
      <span style={{ flex:1, fontSize:12, color: value ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', fontStyle: value ? 'normal' : 'italic' }}>
        {value ?? 'Chưa có'}
      </span>
      <button onClick={() => setEditing(true)}
        style={{ background:'transparent', border:'none', color:'var(--color-text-tertiary)', cursor:'pointer', fontSize:11, opacity:0, transition:'opacity .15s' }}
        className="edit-btn">✏️</button>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function CustomerDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const [customer, setCustomer] = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [activeTab, setActiveTab] = useState<'info'|'timeline'|'logs'|'projects'>('info')
  const [toast,    setToast]    = useState('')
  // Contact log form
  const [logTab,      setLogTab]      = useState<'audio'|'manual'>('audio')
  const [logFile,     setLogFile]     = useState<File|null>(null)
  const [logText,     setLogText]     = useState('')
  const [logNotes,    setLogNotes]    = useState('')
  const [logStage,    setLogStage]    = useState<'idle'|'uploading'|'transcribing'|'extracting'|'saving'|'done'>('idle')
  const [logError,    setLogError]    = useState('')
  const [logResult,   setLogResult]   = useState<any>(null)
  const [dragOver,    setDragOver]    = useState(false)
  const [selectedLog, setSelectedLog] = useState<any>(null)
  const [selectedLogMode, setSelectedLogMode] = useState<'crm_basic' | 'estimate_v1' | 'estimate_preliminary'>('estimate_v1')
  const [selectedLogAnalysis, setSelectedLogAnalysis] = useState<any>(null)
  const [selectedLogLoading, setSelectedLogLoading] = useState(false)
  const [updatingFromAnalysis, setUpdatingFromAnalysis] = useState(false)
  const [nextActionDraft, setNextActionDraft] = useState('')

  // Timeline form
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [newEvent, setNewEvent] = useState({ type:'note', title:'', description:'', happened_at: new Date().toISOString().slice(0,16) })
  const [addingEvent, setAddingEvent] = useState(false)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/customers/${id}`)
    const j = await r.json()
    setCustomer(j.data)
    setNextActionDraft(String(j?.data?.next_action || ''))
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function save(field: string, value: any) {
    await fetch(`/api/customers/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    showToast('✅ Đã lưu')
    load()
  }

  async function saveNextActionFromDetail() {
    if (!customer) return
    const raw = String(nextActionDraft || '').trim()
    const current = String(customer.next_action || '').trim()
    if (raw === current) return
    const activityId = String(customer.active_care_activity_id || '').trim()

    if (activityId) {
      await fetch(`/api/customers/${id}/care-activities/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: raw || 'Hanh dong can lam',
          next_action_snapshot: raw || null,
          pipeline_phase: String(customer.active_care_pipeline_phase || 'general'),
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
          pipeline_phase: 'general',
          status: 'open',
        }),
      })
    }

    await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ next_action: raw || null }),
    })
    showToast('✅ Đã lưu')
    await load()
  }

  async function addTimelineEvent() {
    if (!newEvent.title.trim()) return
    setAddingEvent(true)
    const typeLabel = TIMELINE_TYPES.find(t => t.type === newEvent.type)?.label || newEvent.type
    await fetch(`/api/customers/${id}/timeline`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type:        newEvent.type,
        title:       newEvent.title || typeLabel,
        description: newEvent.description || null,
        happened_at: newEvent.happened_at,
      }),
    })
    setAddingEvent(false)
    setShowAddEvent(false)
    setNewEvent({ type:'note', title:'', description:'', happened_at: new Date().toISOString().slice(0,16) })
    showToast('✅ Đã thêm sự kiện')
    load()
  }

  async function deleteEvent(eventId: string) {
    if (!confirm('Xóa sự kiện này?')) return
    await fetch(`/api/customers/${id}/timeline`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId }),
    })
    load()
  }

  async function deleteProject(projectId: string, projectName: string) {
    if (!confirm(`Xóa dự án "${projectName}"? Hành động này không thể hoàn tác.`)) return
    const r = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
    if (r.ok) {
      showToast('🗑 Đã xóa dự án')
      load()
    } else {
      const j = await r.json()
      showToast('❌ ' + (j.error || 'Xóa thất bại'))
    }
  }

  async function handleAddLog() {
    if (logTab === 'audio' && !logFile) return
    if (logTab === 'manual' && !logText.trim()) return
    setLogStage('uploading')
    setLogError('')
    setLogResult(null)
    try {
      let res: Response
      if (logTab === 'audio') {
        setLogStage('uploading')
        const fd = new FormData()
        fd.append('audio', logFile!)
        fd.append('customer_id', id)
        fd.append('notes', logNotes)
        res = await fetch('/api/upload-audio', { method: 'POST', body: fd })
      } else {
        setLogStage('extracting')
        res = await fetch(`/api/customers/${id}/contact-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: logText.trim(), source: 'call' }),
        })
      }
      if (!res.ok) throw new Error((await res.json()).error || 'Lỗi server')
      const j = await res.json()
      setLogResult(j.ai_result || j.data || j)
      setLogStage('done')
      setLogFile(null); setLogText(''); setLogNotes('')
      showToast('✅ Đã lưu — AI đã phân tích xong')
      load()
    } catch (e: any) {
      setLogError(e.message)
      setLogStage('idle')
    }
  }

  async function analyzeSelectedLog(mode: 'crm_basic' | 'estimate_v1' | 'estimate_preliminary') {
    if (!selectedLog) return
    setSelectedLogMode(mode)
    setSelectedLogLoading(true)
    setSelectedLogAnalysis(null)
    try {
      const r = await fetch('/api/analysis/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_key: mode,
          auto_detect: false,
          contact_log_id: selectedLog.id,
          source_type: selectedLog.source || 'call',
          customer_id: id,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Phân tích thất bại')
      setSelectedLogAnalysis(j.data)
    } catch (e: any) {
      setSelectedLogAnalysis({ error: e.message || 'Lỗi không xác định' })
    }
    setSelectedLogLoading(false)
  }

  async function applyPreliminaryToCustomer() {
    if (!selectedLogAnalysis || selectedLogAnalysis.error) return
    const facts = Array.isArray(selectedLogAnalysis.facts) ? selectedLogAnalysis.facts : []
    if (!facts.length) {
      showToast('Khong co facts de cap nhat')
      return
    }

    const factMap: Record<string, unknown> = {}
    for (const f of facts) {
      const key = String(f?.key || '').trim()
      if (!key) continue
      factMap[key] = f?.value ?? null
    }

    const toStringOrNull = (v: unknown) => {
      const s = String(v ?? '').trim()
      return s ? s : null
    }
    const toNumberOrNull = (v: unknown) => {
      if (v === null || v === undefined || v === '') return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    const toIntOrNull = (v: unknown) => {
      const n = toNumberOrNull(v)
      if (n == null) return null
      return Math.trunc(n)
    }

    const normalized = {
      construction_address: toStringOrNull(factMap.construction_address ?? factMap.address),
      address: toStringOrNull(factMap.construction_address ?? factMap.address),
      next_action: toStringOrNull(factMap.next_action),
      region_code: toStringOrNull(factMap.region_code),
      house_type: toStringOrNull(factMap.house_type) || 'khac',
      style: toStringOrNull(factMap.style) || 'khac',
      foundation_type: toStringOrNull(factMap.foundation_type) || 'mong_bang',
      finish_level: toStringOrNull(factMap.finish_level) || 'tieu_chuan',
      build_length_m: toNumberOrNull(factMap.build_length_m),
      build_width_m: toNumberOrNull(factMap.build_width_m),
      floor_height_m: toNumberOrNull(factMap.floor_height_m),
      stair_void_area: toNumberOrNull(factMap.stair_void_area),
      floors: toIntOrNull(factMap.floors),
      tum_count: toIntOrNull(factMap.tum_count),
      basement_count: toIntOrNull(factMap.basement_count),
      bedroom_count: toIntOrNull(factMap.bedroom_count),
      wc_count: toIntOrNull(factMap.wc_count),
      kitchen_count: toIntOrNull(factMap.kitchen_count),
      living_room_count: toIntOrNull(factMap.living_room_count),
      base_cost_per_m2: toNumberOrNull(factMap.base_cost_per_m2),
      floor_area: toNumberOrNull(factMap.floor_area),
    }

    const customerUpdate: Record<string, unknown> = {}
    const fullName = toStringOrNull(factMap.full_name)
    const phone = toStringOrNull(factMap.phone_number)
    const residentialAddress = toStringOrNull(factMap.residential_address)
    const nextAction = toStringOrNull(factMap.next_action)
    if (fullName) customerUpdate.full_name = fullName
    if (phone) customerUpdate.phone_number = phone
    if (residentialAddress) customerUpdate.address = residentialAddress
    if (nextAction) customerUpdate.next_action = nextAction
    if (normalized.house_type) customerUpdate.house_type = normalized.house_type
    if (normalized.floors != null) customerUpdate.floors = normalized.floors
    if (normalized.floor_area != null) customerUpdate.floor_area = normalized.floor_area

    setUpdatingFromAnalysis(true)
    try {
      const snapshotRes = await fetch(`/api/customers/${id}/requirement-snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: 'analysis',
          source_ref_id: selectedLogAnalysis.run_id || selectedLog?.id || null,
          extracted_json: {
            profile_key: selectedLogAnalysis.profile_key || 'estimate_preliminary',
            status: selectedLogAnalysis.status || null,
            summary: selectedLogAnalysis.summary || null,
            facts,
            missing_fields: Array.isArray(selectedLogAnalysis.missing_fields) ? selectedLogAnalysis.missing_fields : [],
            recommended_questions: Array.isArray(selectedLogAnalysis.recommended_questions) ? selectedLogAnalysis.recommended_questions : [],
          },
          normalized_json: normalized,
          confidence_score: typeof selectedLogAnalysis.confidence === 'number' ? selectedLogAnalysis.confidence : null,
          note: 'Cap nhat tu ket qua /api/analysis/run (estimate_preliminary)',
        }),
      })
      if (!snapshotRes.ok) {
        const snapshotJson = await snapshotRes.json().catch(() => ({}))
        throw new Error(snapshotJson?.error || 'Khong the tao requirement snapshot')
      }

      if (Object.keys(customerUpdate).length) {
        const customerRes = await fetch(`/api/customers/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customerUpdate),
        })
        if (!customerRes.ok) {
          const customerJson = await customerRes.json().catch(() => ({}))
          throw new Error(customerJson?.error || 'Khong the cap nhat customer')
        }
      }

      showToast('✅ Da cap nhat snapshot va thong tin khach hang')
      await load()
    } catch {
      showToast('❌ Khong the cap nhat tu ket qua phan tich')
    }
    setUpdatingFromAnalysis(false)
  }

  if (loading) return <div style={{ padding:48, textAlign:'center' }}><span className="spinner" /></div>
  if (!customer) return <div style={{ padding:48, textAlign:'center', color:'var(--color-text-tertiary)' }}>Không tìm thấy khách hàng</div>

  const statusColor   = STATUS_COLOR[customer.status] || '#64748B'
  const potColor      = POTENTIAL_COLOR[customer.potential_level] || 'var(--color-text-tertiary)'
  const budget        = fmtBudget(customer.budget_min, customer.budget_max)
  const timeline      = customer.timeline || []
  const logs          = customer.logs || []
  const projects      = customer.projects || []

  // Display name logic
  const displayName = customer.full_name || customer.phone_number ||
    (customer.telegram_username ? `@${customer.telegram_username}` :
     customer.zalo_username     ? `@${customer.zalo_username}` :
     customer.messenger_username ? `@${customer.messenger_username}` : 'Khách ẩn danh')

  return (
    <div className="fade-up">
      <style>{`.edit-btn { opacity: 0 } div:hover > .edit-btn { opacity: 1 }`}</style>

      {/* Back */}
      <Link href="/customers" style={{ fontSize:12, color:'var(--color-text-tertiary)', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:4, marginBottom:16 }}>
        ← Danh sách khách hàng
      </Link>

      {/* Header card */}
      <div className="card" style={{ padding:'20px 24px', marginBottom:16, borderLeft:`4px solid ${statusColor}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16 }}>
          <div style={{ flex:1 }}>
            {/* Name */}
            <div style={{ fontSize:22, fontWeight:800, color:'var(--color-text-primary)', marginBottom:6 }}>
              {displayName}
            </div>
            {/* Sub info */}
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center', marginBottom:10 }}>
              {customer.phone_number && customer.full_name && (
                <span style={{ fontSize:13, color:'var(--color-text-secondary)', fontFamily:'monospace' }}>📞 {customer.phone_number}</span>
              )}
              {customer.source && (
                <span style={{ fontSize:12, color:'var(--color-text-secondary)' }}>
                  {SOURCE_ICON[customer.source] || '📌'} {customer.source}
                  {customer.referrer_name && ` · giới thiệu: ${customer.referrer_name}${customer.referrer_phone ? ` (${customer.referrer_phone})` : ''}`}
                </span>
              )}
              {/* Social nicks */}
              {customer.telegram_username && <span style={{ fontSize:11, color:'#26A5E4' }}>✈️ @{customer.telegram_username}</span>}
              {customer.zalo_username     && <span style={{ fontSize:11, color:'#0068FF' }}>💙 @{customer.zalo_username}</span>}
              {customer.messenger_username && <span style={{ fontSize:11, color:'#FF5722' }}>🟠 @{customer.messenger_username}</span>}
            </div>
            {/* Tags */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              {customer.house_type && <span style={{ fontSize:11, background:'var(--color-background-tertiary)', color:'var(--color-text-secondary)', padding:'2px 8px', borderRadius:5 }}>🏠 {customer.house_type}</span>}
              {customer.floors     && <span style={{ fontSize:11, background:'var(--color-background-tertiary)', color:'var(--color-text-secondary)', padding:'2px 8px', borderRadius:5 }}>🏢 {customer.floors} tầng</span>}
              {customer.floor_area && <span style={{ fontSize:11, background:'var(--color-background-tertiary)', color:'var(--color-text-secondary)', padding:'2px 8px', borderRadius:5 }}>📐 {customer.floor_area}m²</span>}
              {budget              && <span style={{ fontSize:11, color:'#F59E0B', fontWeight:700 }}>💰 {budget}</span>}
              {customer.address && <span style={{ fontSize:11, color:'var(--color-text-secondary)' }}>🏠 {customer.address}</span>}
              {customer.construction_address && <span style={{ fontSize:11, color:'var(--color-text-secondary)' }}>🏗 {customer.construction_address}</span>}
            </div>
          </div>

          {/* Right: status + potential */}
          <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'flex-end', flexShrink:0 }}>
            <select value={customer.status} onChange={e => save('status', e.target.value)}
              style={{ background:`${statusColor}18`, color:statusColor, border:`1px solid ${statusColor}40`, borderRadius:8, padding:'6px 12px', fontSize:13, fontWeight:700, cursor:'pointer', outline:'none' }}>
              {PIPELINE.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={customer.type || 'unverified'} onChange={e => save('type', e.target.value)}
              style={{ background: (customer.type || 'unverified') === 'verified' ? 'rgba(34,197,94,.12)' : 'rgba(100,116,139,.12)', color: (customer.type || 'unverified') === 'verified' ? 'var(--green)' : 'var(--color-text-secondary)', border:'1px solid var(--color-border-tertiary)', borderRadius:8, padding:'6px 12px', fontSize:12, fontWeight:700, cursor:'pointer', outline:'none' }}>
              <option value="unverified">unverified</option>
              <option value="verified">verified</option>
            </select>
            {customer.potential_score && (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ fontSize:20, fontWeight:900, color:potColor }}>{customer.potential_score}/10</div>
                <span style={{ fontSize:11, color:potColor, fontWeight:700, textTransform:'capitalize' }}>{customer.potential_level}</span>
              </div>
            )}
            {customer.next_action && (
              <div style={{ fontSize:11, color:'var(--color-text-secondary)', maxWidth:220, textAlign:'right', lineHeight:1.4 }}>
                💡 {customer.next_action}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:14, borderBottom:'1px solid var(--color-border-tertiary)', paddingBottom:0 }}>
        {[
          { key:'info',     label:'📋 Thông tin' },
          { key:'timeline', label:`⏱ Timeline (${timeline.length})` },
          { key:'logs',     label:`📞 Liên hệ (${logs.length})` },
          { key:'projects', label:`🏗 Dự án (${projects.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            style={{ padding:'8px 16px', border:'none', cursor:'pointer', fontSize:13, fontWeight: activeTab===t.key ? 700 : 400,
              borderBottom: activeTab===t.key ? '2px solid var(--color-text-info)' : '2px solid transparent',
              color: activeTab===t.key ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
              background:'transparent', marginBottom:-1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: INFO ── */}
      {activeTab === 'info' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          {/* Thông tin cá nhân */}
          <div className="card" style={{ padding:16 }}>
            <div style={{ fontSize:10, letterSpacing:'1.5px', color:'var(--color-text-tertiary)', fontWeight:700, marginBottom:12 }}>THÔNG TIN CÁ NHÂN</div>
            <EditableField label="Họ tên"       value={customer.full_name}    onSave={v => save('full_name', v)} />
            <EditableField label="Số điện thoại" value={customer.phone_number} onSave={v => save('phone_number', v)} />
            <EditableField label="Đ/c cư trú"    value={customer.address}      onSave={v => save('address', v)} />
            <EditableField label="Đ/c xây dựng"  value={customer.construction_address} onSave={v => save('construction_address', v)} />
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:10, letterSpacing:'1.5px', color:'var(--color-text-tertiary)', fontWeight:700, marginBottom:8 }}>SOCIAL</div>
              <EditableField label="Telegram"  value={customer.telegram_username}  onSave={v => save('telegram_username', v)} />
              <EditableField label="Zalo"      value={customer.zalo_username}      onSave={v => save('zalo_username', v)} />
              <EditableField label="Messenger" value={customer.messenger_username} onSave={v => save('messenger_username', v)} />
            </div>
          </div>

          {/* Nhu cầu xây dựng */}
          <div className="card" style={{ padding:16 }}>
            <div style={{ fontSize:10, letterSpacing:'1.5px', color:'var(--color-text-tertiary)', fontWeight:700, marginBottom:12 }}>NHU CẦU XÂY DỰNG</div>
            <EditableField label="Loại nhà"    value={customer.house_type}  onSave={v => save('house_type', v)} />
            <EditableField label="Số tầng"     value={customer.floors}      onSave={v => save('floors', parseInt(v))} type="number" />
            <EditableField label="Diện tích m²" value={customer.floor_area}  onSave={v => save('floor_area', parseFloat(v))} type="number" />
            <EditableField label="Ngân sách từ" value={customer.budget_min}  onSave={v => save('budget_min', v)} type="number" />
            <EditableField label="Ngân sách đến" value={customer.budget_max} onSave={v => save('budget_max', v)} type="number" />
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:10, letterSpacing:'1.5px', color:'var(--color-text-tertiary)', fontWeight:700, marginBottom:8 }}>NGUỒN KHÁCH</div>
              <EditableField label="Nguồn"          value={customer.source}         onSave={v => save('source', v)} />
              <EditableField label="Người giới thiệu" value={customer.referrer_name}  onSave={v => save('referrer_name', v)} />
              <EditableField label="SĐT giới thiệu"  value={customer.referrer_phone} onSave={v => save('referrer_phone', v)} />
            </div>
          </div>

          {/* Tiềm năng */}
          <div className="card" style={{ padding:16 }}>
            <div style={{ fontSize:10, letterSpacing:'1.5px', color:'var(--color-text-tertiary)', fontWeight:700, marginBottom:12 }}>ĐÁNH GIÁ TIỀM NĂNG</div>
            <EditableField label="Điểm (1-10)"  value={customer.potential_score} onSave={v => save('potential_score', parseInt(v))} type="number" />
            <EditableField label="Mức độ"       value={customer.potential_level} onSave={v => save('potential_level', v)} />
            <div style={{ marginTop:8 }}>
              <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginBottom:4 }}>Gợi ý bước tiếp theo</div>
              <textarea value={nextActionDraft} rows={3}
                onChange={e => setNextActionDraft(e.target.value)}
                onBlur={saveNextActionFromDetail}
                style={{ width:'100%', background:'var(--color-background-tertiary)', border:'1px solid var(--color-border-tertiary)', borderRadius:7, padding:'8px 10px', color:'var(--color-text-primary)', fontSize:12, resize:'vertical' }} />
            </div>
          </div>

          {/* Meta */}
          <div className="card" style={{ padding:16 }}>
            <div style={{ fontSize:10, letterSpacing:'1.5px', color:'var(--color-text-tertiary)', fontWeight:700, marginBottom:12 }}>THÔNG TIN THÊM</div>
            <div style={{ fontSize:12, color:'var(--color-text-secondary)', display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:'var(--color-text-tertiary)' }}>Ngày tạo</span>
                <span>{fmtDate(customer.created_at)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:'var(--color-text-tertiary)' }}>Cập nhật</span>
                <span>{fmtDate(customer.updated_at)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:'var(--color-text-tertiary)' }}>Số liên hệ</span>
                <span>{logs.length} lần</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:'var(--color-text-tertiary)' }}>Dự án</span>
                <span>{projects.length} dự án</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: TIMELINE ── */}
      {activeTab === 'timeline' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ fontSize:13, color:'var(--color-text-secondary)' }}>Lịch sử tương tác với khách hàng</div>
            <button onClick={() => setShowAddEvent(true)}
              style={{ background:'var(--color-background-info)', color:'var(--color-text-info)', border:'1px solid var(--color-border-info)', borderRadius:8, padding:'7px 16px', cursor:'pointer', fontSize:13, fontWeight:700 }}>
              + Thêm sự kiện
            </button>
          </div>

          {/* Add event form */}
          {showAddEvent && (
            <div className="card" style={{ padding:16, marginBottom:14, border:'1px solid var(--color-border-info)' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--color-text-primary)', marginBottom:12 }}>Thêm sự kiện</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={{ fontSize:11, color:'var(--color-text-tertiary)', display:'block', marginBottom:4 }}>Loại sự kiện</label>
                  <select value={newEvent.type} onChange={e => setNewEvent(p => ({ ...p, type: e.target.value, title: TIMELINE_TYPES.find(t => t.type===e.target.value)?.label || '' }))}
                    style={{ width:'100%', background:'var(--color-background-tertiary)', border:'1px solid var(--color-border-tertiary)', borderRadius:7, padding:'7px 10px', color:'var(--color-text-primary)', fontSize:13 }}>
                    {TIMELINE_TYPES.map(t => <option key={t.type} value={t.type}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'var(--color-text-tertiary)', display:'block', marginBottom:4 }}>Thời gian</label>
                  <input type="datetime-local" value={newEvent.happened_at} onChange={e => setNewEvent(p => ({ ...p, happened_at: e.target.value }))}
                    style={{ width:'100%', background:'var(--color-background-tertiary)', border:'1px solid var(--color-border-tertiary)', borderRadius:7, padding:'7px 10px', color:'var(--color-text-primary)', fontSize:13 }} />
                </div>
              </div>
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:11, color:'var(--color-text-tertiary)', display:'block', marginBottom:4 }}>Tiêu đề</label>
                <input value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))}
                  placeholder="VD: Gặp khách tại văn phòng Q1"
                  style={{ width:'100%', background:'var(--color-background-tertiary)', border:'1px solid var(--color-border-tertiary)', borderRadius:7, padding:'7px 10px', color:'var(--color-text-primary)', fontSize:13 }} />
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, color:'var(--color-text-tertiary)', display:'block', marginBottom:4 }}>Ghi chú (tuỳ chọn)</label>
                <textarea value={newEvent.description} onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))} rows={2}
                  placeholder="Chi tiết thêm..."
                  style={{ width:'100%', background:'var(--color-background-tertiary)', border:'1px solid var(--color-border-tertiary)', borderRadius:7, padding:'7px 10px', color:'var(--color-text-primary)', fontSize:13, resize:'vertical' }} />
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={addTimelineEvent} disabled={addingEvent || !newEvent.title.trim()}
                  style={{ background:'var(--color-background-success)', color:'var(--color-text-success)', border:'1px solid var(--color-border-success)', borderRadius:7, padding:'8px 20px', cursor:'pointer', fontSize:13, fontWeight:700, opacity: addingEvent ? 0.7 : 1 }}>
                  {addingEvent ? '⏳...' : '✓ Lưu'}
                </button>
                <button onClick={() => setShowAddEvent(false)}
                  style={{ background:'transparent', border:'1px solid var(--color-border-tertiary)', color:'var(--color-text-secondary)', borderRadius:7, padding:'8px 16px', cursor:'pointer', fontSize:13 }}>
                  Hủy
                </button>
              </div>
            </div>
          )}

          {/* Timeline list */}
          {timeline.length === 0 ? (
            <div className="card" style={{ padding:40, textAlign:'center', color:'var(--color-text-tertiary)', fontSize:13 }}>
              Chưa có sự kiện nào. Thêm sự kiện để theo dõi lịch sử chăm sóc khách.
            </div>
          ) : (
            <div style={{ position:'relative' }}>
              {/* Vertical line */}
              <div style={{ position:'absolute', left:19, top:8, bottom:8, width:2, background:'var(--color-border-tertiary)', borderRadius:1 }} />
              {timeline.map((ev: any) => (
                <div key={ev.id} style={{ display:'flex', gap:14, marginBottom:12, position:'relative' }}>
                  {/* Icon dot */}
                  <div style={{ width:38, height:38, borderRadius:'50%', background:'var(--color-background-secondary)', border:'2px solid var(--color-border-secondary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0, zIndex:1 }}>
                    {TIMELINE_ICON[ev.type] || '📌'}
                  </div>
                  {/* Content */}
                  <div className="card" style={{ flex:1, padding:'10px 14px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--color-text-primary)', marginBottom:2 }}>{ev.title}</div>
                        {ev.description && <div style={{ fontSize:12, color:'var(--color-text-secondary)', lineHeight:1.5 }}>{ev.description}</div>}
                        {ev.metadata && ev.metadata.contract_no && (
                          <div style={{ fontSize:11, color:'var(--color-text-secondary)', marginTop:4 }}>
                            📄 HĐ #{ev.metadata.contract_no}
                            {ev.metadata.value && ` · ${fmtBudget(ev.metadata.value, null)}`}
                          </div>
                        )}
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0, marginLeft:12 }}>
                        <span style={{ fontSize:11, color:'var(--color-text-tertiary)', fontFamily:'monospace', whiteSpace:'nowrap' }}>{fmtDatetime(ev.happened_at)}</span>
                        {ev.creator && <span style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>bởi {ev.creator.username}</span>}
                        {ev.type !== 'chat_started' && ev.type !== 'call' && ev.type !== 'status_change' && (
                          <button onClick={() => deleteEvent(ev.id)}
                            style={{ background:'transparent', border:'none', color:'var(--color-text-tertiary)', cursor:'pointer', fontSize:11, opacity:0.5 }}>
                            🗑
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: LOGS (ContactLog) ── */}
      {activeTab === 'logs' && (
        <div>
          {/* Form thêm nhật ký */}
          <div className="card" style={{ padding:16, marginBottom:14 }}>
            <div style={{ fontSize:11, letterSpacing:'1.5px', color:'var(--color-text-tertiary)', fontWeight:700, marginBottom:12 }}>THÊM NHẬT KÝ LIÊN HỆ</div>

            {/* Tab toggle */}
            <div style={{ display:'flex', gap:0, marginBottom:14, background:'var(--color-background-tertiary)', borderRadius:8, padding:3 }}>
              {(['audio','manual'] as const).map(t => (
                <button key={t} onClick={() => setLogTab(t)}
                  style={{ flex:1, padding:'7px', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600,
                    background: logTab===t ? 'var(--color-background-primary)' : 'transparent',
                    color: logTab===t ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                    boxShadow: logTab===t ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
                  }}>
                  {t === 'audio' ? '🎙 Import Audio' : '✏️ Nhập tay'}
                </button>
              ))}
            </div>

            {/* Audio upload */}
            {logTab === 'audio' && (
              <div>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setLogFile(f) }}
                  onClick={() => document.getElementById('log-audio-input')?.click()}
                  style={{ border:`2px dashed ${dragOver ? 'var(--color-border-info)' : logFile ? 'var(--color-border-success)' : 'var(--color-border-secondary)'}`, borderRadius:10, padding:'24px 16px', textAlign:'center', cursor:'pointer', marginBottom:10, background: dragOver ? 'var(--color-background-info)' : 'transparent' }}>
                  <input id="log-audio-input" type="file" accept=".mp3,.wav,.m4a,.ogg" style={{ display:'none' }}
                    onChange={e => setLogFile(e.target.files?.[0] || null)} />
                  {logFile ? (
                    <div>
                      <div style={{ fontSize:20, marginBottom:4 }}>🎵</div>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--color-text-primary)' }}>{logFile.name}</div>
                      <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:2 }}>{(logFile.size/1024/1024).toFixed(1)} MB</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize:28, marginBottom:8 }}>🎙</div>
                      <div style={{ fontSize:13, color:'var(--color-text-secondary)' }}>Kéo thả file hoặc click để chọn</div>
                      <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:4 }}>MP3, WAV, M4A — tối đa 25MB</div>
                    </div>
                  )}
                </div>
                <textarea value={logNotes} onChange={e => setLogNotes(e.target.value)} rows={2}
                  placeholder="Ghi chú thêm (tuỳ chọn)..."
                  style={{ width:'100%', background:'var(--color-background-tertiary)', border:'1px solid var(--color-border-tertiary)', borderRadius:7, padding:'8px 10px', color:'var(--color-text-primary)', fontSize:12, resize:'vertical' }} />
              </div>
            )}

            {/* Manual input */}
            {logTab === 'manual' && (
              <div>
                <textarea value={logText} onChange={e => setLogText(e.target.value)} rows={5}
                  placeholder="Nhập nội dung cuộc gọi hoặc ghi chú liên hệ..."
                  style={{ width:'100%', background:'var(--color-background-tertiary)', border:'1px solid var(--color-border-tertiary)', borderRadius:7, padding:'8px 10px', color:'var(--color-text-primary)', fontSize:13, lineHeight:1.6, resize:'vertical', marginBottom:8 }} />
              </div>
            )}

            {/* Error */}
            {logError && (
              <div style={{ padding:'8px 12px', background:'var(--color-background-danger)', border:'1px solid var(--color-border-danger)', borderRadius:7, color:'var(--color-text-danger)', fontSize:12, marginBottom:8 }}>
                ❌ {logError}
              </div>
            )}

            {/* Submit button */}
            <button onClick={handleAddLog}
              disabled={logStage !== 'idle' && logStage !== 'done' || (logTab==='audio' ? !logFile : !logText.trim())}
              style={{ width:'100%', padding:'11px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:700,
                background: logStage !== 'idle' ? 'var(--color-background-tertiary)' : '#F97316',
                color: logStage !== 'idle' ? 'var(--color-text-tertiary)' : 'white',
                opacity: (logTab==='audio' ? !logFile : !logText.trim()) ? 0.5 : 1,
              }}>
              {logStage === 'uploading'    ? '⏳ Đang upload...'
                : logStage === 'transcribing' ? '⏳ Đang chuyển giọng nói...'
                : logStage === 'extracting'   ? '🤖 AI đang phân tích...'
                : logStage === 'saving'       ? '💾 Đang lưu...'
                : logStage === 'done'          ? '✅ Đã lưu — Thêm log khác'
                : logTab === 'audio'           ? '⚡ Upload & Phân tích AI'
                : '🤖 Lưu ghi chú'}
            </button>

            {/* AI result preview */}
            {logStage === 'done' && logResult && (
              <div style={{ marginTop:12, padding:'12px 14px', background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:8 }}>
                <div style={{ fontSize:10, letterSpacing:'1.5px', color:'#22C55E', fontWeight:700, marginBottom:8 }}>KẾT QUẢ AI PHÂN TÍCH</div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {logResult.ai_summary && (
                    <div style={{ fontSize:12, color:'var(--color-text-primary)', lineHeight:1.6 }}>{logResult.ai_summary}</div>
                  )}
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:4 }}>
                    {logResult.ai_sentiment && (
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:5, fontWeight:600,
                        background: logResult.ai_sentiment==='Tích cực'?'rgba(34,197,94,0.1)':logResult.ai_sentiment==='Gay gắt'?'rgba(239,68,68,0.1)':'rgba(245,158,11,0.1)',
                        color: logResult.ai_sentiment==='Tích cực'?'#22C55E':logResult.ai_sentiment==='Gay gắt'?'#EF4444':'#F59E0B',
                      }}>{logResult.ai_sentiment}</span>
                    )}
                    {logResult.potential_score && (
                      <span style={{ fontSize:11, fontWeight:700, color: logResult.potential_level==='cao'?'#22C55E':logResult.potential_level==='thấp'?'#EF4444':'#F59E0B' }}>
                        Tiềm năng: {logResult.potential_score}/10 ({logResult.potential_level})
                      </span>
                    )}
                  </div>
                  {logResult.next_action && (
                    <div style={{ fontSize:12, color:'var(--color-text-info)', marginTop:2 }}>💡 {logResult.next_action}</div>
                  )}
                  {(logResult.full_name||logResult.address||logResult.house_type) && (
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:2 }}>
                      {logResult.full_name  && <span style={{ fontSize:11, background:'var(--color-background-tertiary)', padding:'2px 8px', borderRadius:4, color:'var(--color-text-secondary)' }}>👤 {logResult.full_name}</span>}
                      {logResult.address    && <span style={{ fontSize:11, background:'var(--color-background-tertiary)', padding:'2px 8px', borderRadius:4, color:'var(--color-text-secondary)' }}>📍 {logResult.address}</span>}
                      {logResult.house_type && <span style={{ fontSize:11, background:'var(--color-background-tertiary)', padding:'2px 8px', borderRadius:4, color:'var(--color-text-secondary)' }}>🏠 {logResult.house_type}</span>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Log history */}
          {logs.length === 0 ? (
            <div className="card" style={{ padding:40, textAlign:'center', color:'var(--color-text-tertiary)', fontSize:13 }}>
              Chưa có nhật ký liên hệ nào
            </div>
          ) : logs.map((log: any) => (
            <div key={log.id} className="card" style={{ padding:16, marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ fontSize:13 }}>
                    {log.source === 'call' ? '📞' : log.source === 'telegram' ? '✈️' : log.source === 'zalo' ? '💙' : '🟠'}
                  </span>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--color-text-primary)', textTransform:'capitalize' }}>{log.source || 'Gọi điện'}</span>
                  {log.ai_sentiment && (
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:5, background:`${log.ai_sentiment==='Tích cực'?'#22C55E':log.ai_sentiment==='Gay gắt'?'#EF4444':'#F59E0B'}15`, color: log.ai_sentiment==='Tích cực'?'#22C55E':log.ai_sentiment==='Gay gắt'?'#EF4444':'#F59E0B', fontWeight:600 }}>
                      {log.ai_sentiment}
                    </span>
                  )}
                  {log.potential_score && (
                    <span style={{ fontSize:11, color: POTENTIAL_COLOR[log.potential_level] || 'var(--color-text-tertiary)', fontWeight:700 }}>
                      {log.potential_score}/10
                    </span>
                  )}
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'var(--color-text-tertiary)', fontFamily:'monospace' }}>{fmtDatetime(log.contact_date)}</span>
                  {log.sales && <span style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>bởi {log.sales.username}</span>}
                  <button
                    onClick={() => { setSelectedLog(log); setSelectedLogAnalysis(null) }}
                    style={{ fontSize:11, color:'var(--color-text-info)', background:'var(--color-background-info)', border:'1px solid var(--color-border-info)', borderRadius:6, padding:'3px 9px', cursor:'pointer' }}
                  >
                    👁 Chi tiết
                  </button>
                </div>
              </div>
              {log.ai_summary && <div style={{ fontSize:12, color:'var(--color-text-secondary)', lineHeight:1.6, marginBottom:8, padding:'8px 10px', background:'var(--color-background-secondary)', borderRadius:6 }}>{log.ai_summary}</div>}
              {log.next_action && <div style={{ fontSize:12, color:'var(--color-text-info)' }}>💡 {log.next_action}</div>}
              {/* Extracted fields */}
              {(log.ext_full_name || log.ext_house_type || log.ext_budget) && (
                <div style={{ marginTop:8, display:'flex', gap:8, flexWrap:'wrap' }}>
                  {log.ext_full_name  && <span style={{ fontSize:11, background:'var(--color-background-tertiary)', padding:'2px 8px', borderRadius:4, color:'var(--color-text-secondary)' }}>👤 {log.ext_full_name}</span>}
                  {log.ext_house_type && <span style={{ fontSize:11, background:'var(--color-background-tertiary)', padding:'2px 8px', borderRadius:4, color:'var(--color-text-secondary)' }}>🏠 {log.ext_house_type}</span>}
                  {log.ext_floors     && <span style={{ fontSize:11, background:'var(--color-background-tertiary)', padding:'2px 8px', borderRadius:4, color:'var(--color-text-secondary)' }}>🏢 {log.ext_floors}T</span>}
                  {log.ext_budget     && <span style={{ fontSize:11, color:'#F59E0B', fontWeight:600 }}>💰 {fmtBudget(Number(log.ext_budget), null)}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: PROJECTS ── */}
      {activeTab === 'projects' && (
        <div>
          {projects.length === 0 ? (
            <div className="card" style={{ padding:40, textAlign:'center', color:'var(--color-text-tertiary)', fontSize:13 }}>Chưa có dự án</div>
          ) : projects.map((p: any) => (
            <div key={p.id} className="card" style={{ padding:16, marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--color-text-primary)', marginBottom:4 }}>{p.project_name || `Dự án ${p.house_type || ''}`}</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {p.house_type  && <span style={{ fontSize:11, background:'var(--color-background-tertiary)', padding:'2px 8px', borderRadius:4, color:'var(--color-text-secondary)' }}>{p.house_type}</span>}
                    {p.floors      && <span style={{ fontSize:11, background:'var(--color-background-tertiary)', padding:'2px 8px', borderRadius:4, color:'var(--color-text-secondary)' }}>{p.floors} tầng</span>}
                    {p.floor_area  && <span style={{ fontSize:11, background:'var(--color-background-tertiary)', padding:'2px 8px', borderRadius:4, color:'var(--color-text-secondary)' }}>{p.floor_area}m²</span>}
                    {p.contract_value && <span style={{ fontSize:11, color:'#22C55E', fontWeight:700 }}>💰 {fmtBudget(Number(p.contract_value), null)}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                  <span style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:6, background:`${p.status==='completed'?'#22C55E':p.status==='in_progress'?'#F59E0B':'#64748B'}15`, color: p.status==='completed'?'#22C55E':p.status==='in_progress'?'#F59E0B':'#64748B' }}>
                    {p.status}
                  </span>
                  <div style={{ display:'flex', gap:6 }}>
                    <Link href={`/projects`} style={{ fontSize:11, color:'var(--color-text-info)', textDecoration:'none' }}>Xem →</Link>
                    <button onClick={() => deleteProject(p.id, p.project_name || `Dự án ${p.house_type || ''}`)}
                      style={{ fontSize:11, color:'var(--color-text-danger)', background:'var(--color-background-danger)', border:'1px solid var(--color-border-danger)', borderRadius:5, padding:'2px 8px', cursor:'pointer' }}>
                      🗑 Xóa
                    </button>
                  </div>
                </div>
              </div>
              {p.address && <div style={{ fontSize:12, color:'var(--color-text-secondary)' }}>📍 {p.address}</div>}
            </div>
          ))}
        </div>
      )}

      {selectedLog && (
        <div
          style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.72)', display:'flex', alignItems:'center', justifyContent:'center', padding:18 }}
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="card"
            style={{ width:'100%', maxWidth:860, maxHeight:'92vh', overflowY:'auto', padding:20 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:12 }}>
              <div>
                <div style={{ fontSize:10, letterSpacing:'1.5px', color:'var(--color-text-tertiary)', fontFamily:'monospace', marginBottom:4 }}>CHI TIẾT NHẬT KÝ LIÊN HỆ</div>
                <div style={{ fontSize:16, color:'var(--color-text-primary)', fontWeight:700 }}>
                  {customer.full_name || customer.phone_number || 'Khách hàng'}
                </div>
                <div style={{ fontSize:12, color:'var(--color-text-tertiary)', marginTop:4 }}>
                  {(selectedLog.source || 'call')} · {fmtDatetime(selectedLog.contact_date)}
                  {selectedLog.sales?.username ? ` · ${selectedLog.sales.username}` : ''}
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)} style={{ background:'none', border:'none', color:'var(--color-text-tertiary)', fontSize:22, cursor:'pointer', lineHeight:1 }}>×</button>
            </div>

            {selectedLog.audio_file_path && (
              <div style={{ marginBottom:12, background:'var(--color-background-secondary)', border:'1px solid var(--color-border-tertiary)', borderRadius:9, padding:10 }}>
                <div style={{ fontSize:10, letterSpacing:'1.5px', color:'var(--color-text-tertiary)', fontFamily:'monospace', marginBottom:6 }}>AUDIO</div>
                <audio controls src={selectedLog.audio_file_path} style={{ width:'100%' }} />
              </div>
            )}

            {(selectedLog.transcription_raw || selectedLog.notes) && (
              <div style={{ marginBottom:12, background:'var(--color-background-secondary)', border:'1px solid var(--color-border-tertiary)', borderRadius:9, padding:12 }}>
                <div style={{ fontSize:10, letterSpacing:'1.5px', color:'var(--color-text-tertiary)', fontFamily:'monospace', marginBottom:8 }}>NỘI DUNG GỐC</div>
                {selectedLog.transcription_raw && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:11, color:'var(--color-text-info)', marginBottom:4 }}>Transcript</div>
                    <div style={{ fontSize:12, color:'var(--color-text-secondary)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{selectedLog.transcription_raw}</div>
                  </div>
                )}
                {selectedLog.notes && (
                  <div>
                    <div style={{ fontSize:11, color:'#F59E0B', marginBottom:4 }}>Ghi chú</div>
                    <div style={{ fontSize:12, color:'var(--color-text-secondary)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{selectedLog.notes}</div>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom:12, background:'var(--color-background-secondary)', border:'1px solid var(--color-border-tertiary)', borderRadius:9, padding:12 }}>
              <div style={{ fontSize:10, letterSpacing:'1.5px', color:'var(--color-text-tertiary)', fontFamily:'monospace', marginBottom:8 }}>PHÂN TÍCH CRM HIỆN CÓ</div>
              {selectedLog.ai_summary && <div style={{ fontSize:12, color:'var(--color-text-secondary)', lineHeight:1.6, marginBottom:7 }}>{selectedLog.ai_summary}</div>}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {selectedLog.ai_sentiment && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:5, background:`${selectedLog.ai_sentiment==='Tích cực'?'#22C55E':selectedLog.ai_sentiment==='Gay gắt'?'#EF4444':'#F59E0B'}15`, color:selectedLog.ai_sentiment==='Tích cực'?'#22C55E':selectedLog.ai_sentiment==='Gay gắt'?'#EF4444':'#F59E0B' }}>{selectedLog.ai_sentiment}</span>}
                {selectedLog.potential_score && <span style={{ fontSize:11, fontWeight:700, color: POTENTIAL_COLOR[selectedLog.potential_level] || 'var(--color-text-tertiary)' }}>Tiềm năng {selectedLog.potential_score}/10</span>}
                {selectedLog.ext_house_type && <span style={{ fontSize:11, color:'var(--color-text-secondary)' }}>🏠 {selectedLog.ext_house_type}</span>}
                {selectedLog.ext_floors && <span style={{ fontSize:11, color:'var(--color-text-secondary)' }}>🏢 {selectedLog.ext_floors} tầng</span>}
                {selectedLog.ext_floor_area && <span style={{ fontSize:11, color:'var(--color-text-secondary)' }}>📐 {selectedLog.ext_floor_area}m²</span>}
                {selectedLog.ext_budget && <span style={{ fontSize:11, color:'#F59E0B' }}>💰 {Number(selectedLog.ext_budget).toLocaleString('vi-VN')}đ</span>}
              </div>
              {selectedLog.next_action && <div style={{ marginTop:6, fontSize:12, color:'var(--color-text-info)' }}>💡 {selectedLog.next_action}</div>}
            </div>

            <div style={{ marginBottom:8, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <button
                onClick={() => analyzeSelectedLog('crm_basic')}
                disabled={selectedLogLoading}
                style={{ background:selectedLogMode==='crm_basic' ? 'var(--color-background-info)' : 'var(--color-background-tertiary)', border:'1px solid var(--color-border-info)', color:'var(--color-text-info)', borderRadius:7, padding:'6px 10px', fontSize:12, cursor:'pointer' }}
              >
                🤖 Phân tích CRM
              </button>
              <button
                onClick={() => analyzeSelectedLog('estimate_v1')}
                disabled={selectedLogLoading}
                style={{ background:selectedLogMode==='estimate_v1' ? 'rgba(168,85,247,0.15)' : 'var(--color-background-tertiary)', border:'1px solid rgba(168,85,247,0.35)', color:'#A855F7', borderRadius:7, padding:'6px 10px', fontSize:12, cursor:'pointer' }}
              >
                📐 Phân tích khái toán
              </button>
              <button
                onClick={() => analyzeSelectedLog('estimate_preliminary')}
                disabled={selectedLogLoading}
                style={{ background:selectedLogMode==='estimate_preliminary' ? 'rgba(14,165,233,0.15)' : 'var(--color-background-tertiary)', border:'1px solid rgba(14,165,233,0.35)', color:'#0EA5E9', borderRadius:7, padding:'6px 10px', fontSize:12, cursor:'pointer' }}
              >
                🧱 Dự toán sơ bộ
              </button>
              {selectedLogLoading && <span style={{ fontSize:12, color:'var(--color-text-tertiary)' }}>Đang phân tích...</span>}
            </div>

            {selectedLogAnalysis && (
              <div style={{ background:'var(--color-background-secondary)', border:'1px solid var(--color-border-tertiary)', borderRadius:9, padding:12 }}>
                <div style={{ fontSize:10, letterSpacing:'1.5px', color:'var(--color-text-tertiary)', fontFamily:'monospace', marginBottom:8 }}>KẾT QUẢ PHÂN TÍCH MỚI</div>
                {selectedLogAnalysis.error ? (
                  <div style={{ fontSize:12, color:'var(--color-text-danger)' }}>❌ {selectedLogAnalysis.error}</div>
                ) : (
                  <>
                    {selectedLogAnalysis.summary && <div style={{ fontSize:12, color:'var(--color-text-secondary)', lineHeight:1.6, marginBottom:8 }}>{selectedLogAnalysis.summary}</div>}
                    {selectedLogAnalysis.status && (
                      <div style={{ marginBottom:8 }}>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:5, background:selectedLogAnalysis.status==='needs_data'?'rgba(245,158,11,0.12)':'rgba(34,197,94,0.12)', color:selectedLogAnalysis.status==='needs_data'?'#F59E0B':'#22C55E' }}>
                          {selectedLogAnalysis.status === 'needs_data' ? 'Cần bổ sung dữ liệu' : 'Đủ dữ liệu'}
                        </span>
                      </div>
                    )}
                    {Array.isArray(selectedLogAnalysis.missing_fields) && selectedLogAnalysis.missing_fields.length > 0 && (
                      <div style={{ marginBottom:8 }}>
                        <div style={{ fontSize:11, color:'#F59E0B', marginBottom:4 }}>Thiếu dữ liệu:</div>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          {selectedLogAnalysis.missing_fields.map((m: string) => (
                            <span key={m} style={{ fontSize:11, color:'#F59E0B', background:'rgba(245,158,11,0.1)', padding:'2px 8px', borderRadius:4 }}>{m}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {Array.isArray(selectedLogAnalysis.recommended_questions) && selectedLogAnalysis.recommended_questions.length > 0 && (
                      <div style={{ marginBottom:8 }}>
                        <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginBottom:4 }}>Câu hỏi gợi ý:</div>
                        {selectedLogAnalysis.recommended_questions.map((q: string, idx: number) => (
                          <div key={`${idx}-${q}`} style={{ fontSize:12, color:'var(--color-text-secondary)', lineHeight:1.6 }}>{idx + 1}. {q}</div>
                        ))}
                      </div>
                    )}
                    {Array.isArray(selectedLogAnalysis.facts) && selectedLogAnalysis.facts.length > 0 && (
                      <div>
                        <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginBottom:4 }}>Facts:</div>
                        <div style={{ display:'grid', gridTemplateColumns:'minmax(160px,220px) 1fr', gap:6 }}>
                          {selectedLogAnalysis.facts.map((f: any, idx: number) => (
                            <div key={`${f.key}-${idx}`} style={{ display:'contents' }}>
                              <div style={{ fontSize:11, color:'var(--color-text-info)' }}>{f.key}</div>
                              <div style={{ fontSize:12, color:'var(--color-text-secondary)' }}>{typeof f.value === 'object' ? JSON.stringify(f.value) : String(f.value ?? 'null')}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedLogMode === 'estimate_preliminary' && (
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--color-border-tertiary)' }}>
                        <button
                          onClick={applyPreliminaryToCustomer}
                          disabled={updatingFromAnalysis}
                          style={{
                            background: 'rgba(16,185,129,0.12)',
                            border: '1px solid rgba(16,185,129,0.35)',
                            color: '#10B981',
                            borderRadius: 7,
                            padding: '7px 11px',
                            fontSize: 12,
                            cursor: updatingFromAnalysis ? 'not-allowed' : 'pointer',
                            opacity: updatingFromAnalysis ? 0.6 : 1,
                          }}
                        >
                          {updatingFromAnalysis
                            ? 'Dang cap nhat du lieu khach...'
                            : 'Cap nhat du lieu khach tu ket qua du toan so bo'}
                        </button>
                        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6 }}>
                          Se tao 1 ban ghi moi trong project_requirement_snapshots va cap nhat them mot so thong tin co san vao customer.
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

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, background:'var(--color-background-success)', color:'var(--color-text-success)', border:'1px solid var(--color-border-success)', padding:'10px 18px', borderRadius:9, fontSize:13, fontWeight:600, zIndex:9999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
