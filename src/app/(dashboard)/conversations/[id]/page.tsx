'use client'
// src/app/(dashboard)/conversations/[id]/page.tsx — V3.0: + AI analyze modal

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

// ─── Types ────────────────────────────────────────────────────────
type SenderType = 'customer' | 'bot' | 'sales'
type Channel    = 'zalo' | 'messenger' | 'telegram'
type AnalysisMode = 'auto' | 'crm_basic' | 'estimate_v1' | 'estimate_preliminary'
type GenAction = AnalysisMode | 'close_and_auto'

interface Msg {
  id:               string
  conversation_id:  string
  direction:        'in' | 'out'
  sender_type:      SenderType
  sender_id?:       string
  sender_label?:    string
  sender_username?: string
  content:          string
  msg_type:         string
  feedback?:        'liked' | 'disliked' | null
  is_read:          boolean
  created_at:       string
}
interface Conv {
  id:               string
  channel:          Channel
  external_conv_id: string
  external_user_id: string
  display_name?:    string
  avatar_url?:      string
  status:           string
  bot_mode:         string
  close_reason?:    string
  is_urgent:        boolean
  needs_callback:   boolean
  has_contact_info: boolean
  opened_at:        string
  last_message_at:  string
  analysis?:        any
  messages?:        Msg[]
}

// ─── Constants ────────────────────────────────────────────────────
const CH: Record<Channel, { label: string; color: string; icon: string; bg: string }> = {
  zalo:      { label: 'Zalo',      color: '#0068FF', icon: '💙', bg: 'rgba(0,104,255,0.12)' },
  messenger: { label: 'Messenger', color: '#FF5722', icon: '🟠', bg: 'rgba(255,87,34,0.12)' },
  telegram:  { label: 'Telegram',  color: '#26A5E4', icon: '✈️', bg: 'rgba(38,165,228,0.12)' },
}
const STAGE_LABEL: Record<string,string> = { tim_hieu:'Tìm hiểu', tu_van:'Đang tư vấn', da_chot:'✅ Đã chốt', bao_hanh:'🔧 Bảo hành', khac:'Khác' }
const ANALYSIS_MODE_LABEL: Record<AnalysisMode, string> = {
  auto: 'Tự động',
  crm_basic: 'CRM',
  estimate_v1: 'Khái toán',
  estimate_preliminary: 'Dự toán sơ bộ',
}
const GEN_ACTION_LABEL: Record<GenAction, string> = {
  auto: 'Gen tu dong',
  crm_basic: 'Gen CRM',
  estimate_v1: 'Gen khai toan',
  estimate_preliminary: 'Gen du toan so bo',
  close_and_auto: 'Dong + Gen',
}

// ─── Avatar component ─────────────────────────────────────────────
function Avatar({ name, size = 32, color }: { name: string; size?: number; color: string }) {
  const initials = name.slice(0,2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: color + '20', border: `1.5px solid ${color}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color, letterSpacing: '-0.5px',
    }}>{initials}</div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────
function MessageBubble({ msg, conv, prevMsg, feedbackMap, onFeedback }: {
  msg: Msg; conv: Conv; prevMsg?: Msg
  feedbackMap?: Record<string, string>
  onFeedback?: (msgId: string, val: 'liked'|'disliked'|null) => void
}) {
  const isIn     = msg.direction === 'in'
  const isBot    = msg.sender_type === 'bot'
  const isSales  = msg.sender_type === 'sales'
  const ch       = CH[conv.channel] || CH.zalo

  // Nhóm tin nhắn liên tiếp cùng sender
  const sameAsPrev = prevMsg &&
    prevMsg.sender_type === msg.sender_type &&
    prevMsg.direction   === msg.direction &&
    (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < 60000

  const senderLabel = msg.sender_label || (
    isIn    ? (conv.display_name || 'Khách') :
    isBot   ? 'Chatbot' :
    isSales ? (msg.sender_username || 'Sales') :
    'Hệ thống'
  )

  // Color per sender
  const bubbleStyle = isIn
    ? { bg: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '4px 18px 18px 18px' }
    : isBot
    ? { bg: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', color: '#DDD6FE', borderRadius: '18px 4px 18px 18px' }
    : { bg: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#BFDBFE', borderRadius: '18px 4px 18px 18px' }

  const senderColor = isIn ? ch.color : isBot ? '#A855F7' : '#3B82F6'
  const timestamp   = new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' })

  if (msg.msg_type === 'image' || msg.msg_type === 'file') {
    return (
      <div style={{ display:'flex', justifyContent: isIn ? 'flex-start' : 'flex-end', marginBottom: sameAsPrev ? 3 : 12, gap: 8, alignItems:'flex-end' }}>
        {isIn && !sameAsPrev && <Avatar name={senderLabel} size={28} color={ch.color} />}
        {isIn && sameAsPrev  && <div style={{ width:28 }} />}
        <div style={{ maxWidth:'65%' }}>
          {!sameAsPrev && (
            <div style={{ fontSize:10, color: senderColor, fontWeight:700, marginBottom:3, textAlign: isIn ? 'left' : 'right', letterSpacing:'0.03em' }}>
              {senderLabel}
            </div>
          )}
          <div style={{
            padding:'10px 14px', fontSize:13, lineHeight:1.5,
            background: bubbleStyle.bg, border: bubbleStyle.border,
            borderRadius: bubbleStyle.borderRadius, color: bubbleStyle.color,
            display:'flex', alignItems:'center', gap:8,
          }}>
            <span>{msg.msg_type === 'image' ? '🖼️' : '📎'}</span>
            <span style={{ fontStyle:'italic', opacity:0.8 }}>{msg.content}</span>
          </div>
          <div style={{ fontSize:10, color:'var(--text4)', marginTop:3, textAlign: isIn ? 'left' : 'right' }}>{timestamp}</div>
        </div>
        {!isIn && !sameAsPrev && <Avatar name={senderLabel} size={28} color={senderColor} />}
        {!isIn && sameAsPrev  && <div style={{ width:28 }} />}
      </div>
    )
  }

  return (
    <div style={{ display:'flex', justifyContent: isIn ? 'flex-start' : 'flex-end', marginBottom: sameAsPrev ? 3 : 12, gap: 8, alignItems:'flex-end' }}>
      {/* Avatar bên trái cho tin nhận */}
      {isIn && !sameAsPrev && <Avatar name={senderLabel} size={28} color={ch.color} />}
      {isIn && sameAsPrev  && <div style={{ width:28 }} />}

      <div style={{ maxWidth:'65%', minWidth:60 }}>
        {/* Sender label — chỉ hiện khi đầu nhóm */}
        {!sameAsPrev && (
          <div style={{
            fontSize:10, fontWeight:700, letterSpacing:'0.03em',
            color: senderColor, marginBottom:3,
            textAlign: isIn ? 'left' : 'right',
          }}>
            {senderLabel}
            {/* Badge platform cho "Trả lời trên X" */}
            {!isIn && (msg.sender_label?.startsWith('Trả lời')) && (
              <span style={{ marginLeft:5, fontSize:9, opacity:0.7, fontWeight:400 }}>
                [{msg.sender_label}]
              </span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div style={{
          padding:'9px 14px', fontSize:13, lineHeight:1.6,
          background: bubbleStyle.bg, border: bubbleStyle.border,
          borderRadius: bubbleStyle.borderRadius, color: bubbleStyle.color,
          wordBreak:'break-word', whiteSpace:'pre-wrap',
        }}>
          {msg.content}
        </div>

        {/* Timestamp */}
        <div style={{ fontSize:10, color:'var(--text4)', marginTop:3, textAlign: isIn ? 'left' : 'right' }}>
          {timestamp}
          {!isIn && msg.sender_type === 'sales' && !msg.sender_label?.startsWith('Trả lời') && (
            <span style={{ marginLeft:5, opacity:0.6 }}>✓✓</span>
          )}
        </div>

        {/* Feedback buttons — chỉ hiện cho bot message */}
        {isBot && onFeedback && (
          <div style={{
            display:'flex', gap:4, marginTop:4,
            justifyContent:'flex-end',
            opacity: (feedbackMap?.[msg.id] || msg.feedback) ? 1 : 0,
            transition:'opacity .15s',
          }} className="feedback-btns">
            {(['liked','disliked'] as const).map(val => {
              const current = feedbackMap?.[msg.id] || msg.feedback
              const isActive = current === val
              return (
                <button key={val} onClick={() => onFeedback(msg.id, isActive ? null : val)}
                  title={val === 'liked' ? 'Câu trả lời tốt → thêm vào RAG' : 'Câu trả lời chưa tốt'}
                  style={{
                    background: isActive
                      ? (val==='liked' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)')
                      : 'var(--surface2)',
                    border: `1px solid ${isActive ? (val==='liked'?'rgba(34,197,94,0.4)':'rgba(239,68,68,0.4)') : 'var(--border)'}`,
                    borderRadius:6, padding:'2px 8px', cursor:'pointer', fontSize:13,
                    transition:'all .15s',
                  }}>
                  {val === 'liked' ? '👍' : '👎'}
                  {val === 'liked' && (feedbackMap?.[msg.id] || msg.feedback) === 'liked' && (
                    <span style={{ fontSize:10, marginLeft:3, color:'#22C55E' }}>RAG</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Avatar bên phải cho tin gửi */}
      {!isIn && !sameAsPrev && <Avatar name={senderLabel} size={28} color={senderColor} />}
      {!isIn && sameAsPrev  && <div style={{ width:28 }} />}
    </div>
  )
}

// ─── Date separator ───────────────────────────────────────────────
function DateSep({ date }: { date: string }) {
  const d = new Date(date)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate()-1)
  let label = d.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' })
  if (d.toDateString() === today.toDateString())     label = 'Hôm nay'
  if (d.toDateString() === yesterday.toDateString()) label = 'Hôm qua'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, margin:'16px 0 12px' }}>
      <div style={{ flex:1, height:1, background:'var(--border)' }} />
      <span style={{ fontSize:10, color:'var(--text4)', fontWeight:600, letterSpacing:'0.08em', whiteSpace:'nowrap',
        padding:'3px 10px', border:'1px solid var(--border)', borderRadius:20, background:'var(--surface2)' }}>
        {label}
      </span>
      <div style={{ flex:1, height:1, background:'var(--border)' }} />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────
export default function ConversationDetailPage() {
  const { id }            = useParams<{ id: string }>()
  const { data: session } = useSession()
  const [conv, setConv]       = useState<Conv | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading]   = useState(true)
  const [reply, setReply]       = useState('')
  const [sending, setSending]   = useState(false)
  const [toast, setToast]       = useState('')
  const [botGuidanceText, setBotGuidanceText] = useState('')
  const [savingBotGuidance, setSavingBotGuidance] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(true)

  // ── AI Analyze modal ─────────────────────────────────────────────
  // ── Feedback state ──────────────────────────────────────────────
  const [feedbacks, setFeedbacks] = useState<Record<string,string>>({})

  const handleFeedback = async (msgId: string, val: 'liked'|'disliked'|null) => {
    const current = feedbacks[msgId]
    const newVal  = current === val ? null : val  // toggle
    setFeedbacks(p => ({ ...p, [msgId]: newVal || '' }))
    await fetch(`/api/conversations/${id}/messages/${msgId}/feedback`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: newVal }),
    })
    if (newVal === 'liked') showToast('👍 Đã đánh dấu — vào RAG Import để thêm vào kiến thức')
  }

  // ── Feedback counter ─────────────────────────────────────────────
  const likedCount = messages.filter(m => m.sender_type==='bot' && (feedbacks[m.id]==='liked' || (!feedbacks[m.id] && m.feedback==='liked'))).length

  const [analyzing,    setAnalyzing]    = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<any>(null)
  const [genAction, setGenAction] = useState<GenAction>('auto')
  const [analyzeFromMessageId, setAnalyzeFromMessageId] = useState('')
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false)
  const [editField,    setEditField]    = useState<string | null>(null)
  const [editValues,   setEditValues]   = useState<Record<string, any>>({})
  const [saving,       setSaving]       = useState(false)
  const [autoSaveCountdown, setAutoSaveCountdown] = useState<number | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Dev simulator
  const [testMsg, setTestMsg]     = useState('')
  const [testCh, setTestCh]       = useState<Channel>('zalo')
  const [testSending, setTestSending] = useState(false)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevMsgCount = useRef(0)

  const loadConv = useCallback(async () => {
    const r = await fetch(`/api/conversations/${id}`)
    const j = await r.json()
    if (j.data) {
      setConv(j.data)
      setMessages(j.data.messages || [])
      const guidance = String(j.data?.analysis?.sentiment_timeline?.bot_guidance_text || '').trim()
      setBotGuidanceText(guidance)
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadConv() }, [loadConv])

  // Scroll to bottom khi có tin mới
  useEffect(() => {
    if (messages.length !== prevMsgCount.current) {
      prevMsgCount.current = messages.length
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [messages.length])

  // Poll message bằng cùng endpoint detail để tránh lệch dữ liệu (full vs limit 50)
  useEffect(() => {
    if (!conv) return
    const t = setInterval(async () => {
      const r = await fetch(`/api/conversations/${id}`)
      const j = await r.json()
      if (j.data) {
        const nextMsgs = j.data.messages || []
        const prevLastId = messages[messages.length - 1]?.id || ''
        const nextLastId = nextMsgs[nextMsgs.length - 1]?.id || ''
        if (nextMsgs.length !== messages.length || nextLastId !== prevLastId) {
          setConv(j.data)
          setMessages(nextMsgs)
        }
      }
    }, 4000)
    return () => clearInterval(t)
  }, [conv?.id, messages.length, messages[messages.length - 1]?.id, id])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const sendReply = async () => {
    if (!reply.trim() || sending) return
    setSending(true)
    const optimisticMsg: Msg = {
      id: `opt_${Date.now()}`,
      conversation_id: id,
      direction: 'out',
      sender_type: 'sales',
      sender_label: session?.user?.username || 'Sales',
      sender_username: session?.user?.username,
      content: reply,
      msg_type: 'text',
      is_read: true,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticMsg])
    setReply('')
    const r = await fetch(`/api/conversations/${id}/messages`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ content: optimisticMsg.content }),
    })
    if (r.ok) {
      const j = await r.json()
      setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? j.data : m))
    } else {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      showToast('❌ Gửi thất bại')
    }
    setSending(false)
    textareaRef.current?.focus()
  }

  const handleTakeover = async (action: 'take' | 'release') => {
    await fetch(`/api/conversations/${id}/takeover`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    await loadConv()
    showToast(action === 'take' ? '👤 Bạn đang xử lý' : '🤖 Bot đã bật lại')
    if (action === 'take') setTimeout(() => textareaRef.current?.focus(), 100)
  }

  const handleSaveBotGuidance = async () => {
    setSavingBotGuidance(true)
    try {
      const r = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_guidance_text: botGuidanceText }),
      })
      const j = await r.json()
      if (!r.ok) {
        showToast('❌ ' + (j.error || 'Luu dinh huong that bai'))
        setSavingBotGuidance(false)
        return
      }
      showToast('✅ Da luu dinh huong chatbot')
      await loadConv()
    } catch (e: any) {
      showToast('❌ ' + (e?.message || 'Luu dinh huong that bai'))
    }
    setSavingBotGuidance(false)
  }

  const handleClose = async () => {
    if (!confirm('Đóng conversation? AI sẽ phân tích ngay sau đó.')) return
    await fetch(`/api/conversations/${id}/close`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'sales_closed' }),
    })
    await loadConv()
    showToast('✅ Đã đóng — AI đang phân tích...')
  }

  const handleReopen = async () => {
    if (!confirm('Mo lai conversation nay?')) return
    await fetch(`/api/conversations/${id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    await loadConv()
    showToast('Da mo lai conversation')
  }

  const handleAnalyze = async (mode: AnalysisMode) => {
    setAnalyzing(true)
    setShowAnalyzeModal(true)
    try {
      const requestedMode = mode === 'auto' ? undefined : mode
      const r = await fetch(`/api/conversations/${id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_mode: requestedMode,
          auto_detect: mode === 'auto',
          ...(analyzeFromMessageId ? { from_message_id: analyzeFromMessageId } : {}),
        }),
      })
      const j = await r.json()
      if (!r.ok) { showToast('❌ ' + (j.error || 'Lỗi phân tích')); setShowAnalyzeModal(false); return }
      setAnalyzeResult(j)
      setEditValues(normalizeExtractedForCustomer(j.extracted || {}))
      // Auto-save countdown cho các field mới (chưa có customer hoặc field trống)
      if (!j.existing_customer && j.status !== 'needs_data') {
        setAutoSaveCountdown(30)
      } else {
        setAutoSaveCountdown(null)
      }
      if (j.status === 'needs_data' && Array.isArray(j.missing_fields) && j.missing_fields.length) {
        showToast('ℹ️ Cần bổ sung thêm dữ liệu để khái toán chính xác')
      }
    } catch (e: any) {
      showToast('❌ ' + e.message)
      setShowAnalyzeModal(false)
    }
    setAnalyzing(false)
  }

  const handleRunGen = async () => {
    if (genAction === 'close_and_auto') {
      await handleClose()
      return
    }
    await handleAnalyze(genAction)
  }

  // Auto-save countdown
  useEffect(() => {
    if (autoSaveCountdown === null) return
    if (autoSaveCountdown <= 0) {
      handleSaveCustomer(false)
      return
    }
    const t = setTimeout(() => setAutoSaveCountdown(c => (c ?? 1) - 1), 1000)
    return () => clearTimeout(t)
  }, [autoSaveCountdown])

  const handleSaveCustomer = async (isConfirm = true) => {
    if (!analyzeResult) return
    setSaving(true)
    setAutoSaveCountdown(null)
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)

    const payload = {
      ...editValues,
      customer_id:      analyzeResult.existing_customer?.id || null,
      conversation_id:  analyzeResult.conversation_id,
      channel:          analyzeResult.channel,
      external_user_id: analyzeResult.external_user_id,
      display_name:     analyzeResult.display_name,
    }

    const r = await fetch('/api/customers/from-analysis', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await r.json()
    setSaving(false)

    if (r.ok) {
      showToast(j.action === 'created' ? '✅ Đã tạo khách hàng mới' : '✅ Đã cập nhật khách hàng')
      setShowAnalyzeModal(false)
      await loadConv()
    } else {
      showToast('❌ ' + (j.error || 'Lỗi lưu'))
    }
  }

  function copyField(val: any) {
    navigator.clipboard.writeText(String(val ?? '')).then(() => showToast('📋 Đã copy'))
  }

  function normalizeExtractedForCustomer(extracted: Record<string, any>) {
    const normalized = { ...extracted }
    if ((normalized.budget_min === null || normalized.budget_min === undefined || normalized.budget_min === '') && normalized.budget_target) {
      normalized.budget_min = normalized.budget_target
    }
    if ((normalized.budget_max === null || normalized.budget_max === undefined || normalized.budget_max === '') && normalized.budget_target) {
      normalized.budget_max = normalized.budget_target
    }
    return normalized
  }

  const sendTestMessage = async () => {
    if (!testMsg.trim() || testSending || !conv) return
    setTestSending(true)
    await fetch('/api/webhook/test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: testCh, user_id: conv.external_user_id,
        conversation_id: conv.external_conv_id,
        display_name: conv.display_name, content: testMsg,
      }),
    })
    setTestMsg('')
    setTimeout(loadConv, 1200)
    setTestSending(false)
  }

  // ── Group messages by date ─────────────────────────────────────
  const grouped: Array<{ date: string; msgs: Msg[] }> = []
  let curDate = ''
  for (const m of messages) {
    const d = new Date(m.created_at).toDateString()
    if (d !== curDate) { curDate = d; grouped.push({ date: m.created_at, msgs: [] }) }
    grouped[grouped.length-1].msgs.push(m)
  }
  const analyzeScopeOptions = messages
    .filter((m) => m.content && m.content.trim())
    .slice(-80)

  if (loading) return (
    <div style={{ height:'calc(100vh - 60px)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', background:'var(--bg)' }}>
      <div className="spinner" style={{ width:32, height:32, borderWidth:3, marginRight:12 }} />
      Đang tải...
    </div>
  )
  if (!conv) return (
    <div style={{ padding:40, color:'var(--red)', textAlign:'center' }}>Không tìm thấy conversation</div>
  )

  const ch          = CH[conv.channel] || CH.zalo
  const isTakeover  = conv.bot_mode === 'takeover'
  const isActive    = conv.status === 'active'
  const isClosed    = conv.status === 'closed'
  const canType     = isActive && isTakeover
  const analysis    = conv.analysis
  const analyzeResultMode: AnalysisMode = ((analyzeResult?.analysis_mode || 'crm_basic') as AnalysisMode)

  return (
    <div style={{ display:'flex', height:'calc(100vh - 56px - 48px)', background:'var(--bg)', borderRadius:12, overflow:'hidden', border:'1px solid var(--border)' }}>
      <style>{`.feedback-btns{opacity:0} div:hover>.feedback-btns{opacity:1}`}</style>

      {/* ══ LEFT: Chat Area ══════════════════════════════════════ */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, background:'var(--bg)' }}>

        {/* Chat header */}
        <div style={{
          padding:'12px 18px', background:'var(--surface)',
          borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', gap:12, flexShrink:0,
        }}>
          <a href="/conversations" style={{ color:'var(--text3)', textDecoration:'none', fontSize:20, lineHeight:1, flexShrink:0 }}>←</a>

          {/* Channel avatar */}
          <div style={{
            width:40, height:40, borderRadius:'50%', flexShrink:0,
            background: ch.bg, border:`2px solid ${ch.color}40`,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
          }}>{ch.icon}</div>

          {/* Info */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:700, fontSize:15, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {conv.display_name || 'Khách không tên'}
              </span>
              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background: ch.bg, color: ch.color, fontWeight:700, flexShrink:0 }}>
                {ch.label}
              </span>
              {conv.is_urgent    && <span style={{ fontSize:10, color:'var(--red)',    fontWeight:800, flexShrink:0 }}>🚨 URGENT</span>}
              {conv.needs_callback && <span style={{ fontSize:10, color:'var(--accent)', fontWeight:700, flexShrink:0 }}>📞 Gọi lại</span>}
            </div>
            <div style={{ fontSize:11, color:'var(--text4)', marginTop:1 }}>
              {conv.external_user_id}
              {conv.has_contact_info && <span style={{ marginLeft:8, color:'var(--green)' }}>✓ Có SĐT</span>}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display:'flex', gap:8, flexShrink:0, alignItems:'center' }}>
            {/* Liked badge */}
            {likedCount > 0 && (
              <a href="/settings/rag/import" target="_blank"
                style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', color:'#22C55E', borderRadius:7, padding:'5px 10px', fontSize:11, fontWeight:700, textDecoration:'none' }}>
                ???? {likedCount} ??? RAG
              </a>
            )}
            {isActive && (
              isTakeover ? (
                <button onClick={() => handleTakeover('release')} style={{
                  background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.35)',
                  color:'var(--blue)', padding:'6px 14px', borderRadius:7, cursor:'pointer',
                  fontSize:12, fontWeight:700, display:'flex', alignItems:'center', gap:5,
                }}>???? B???t Bot</button>
              ) : (
                <button onClick={() => handleTakeover('take')} style={{
                  background:'var(--surface2)', border:'1px solid var(--border2)',
                  color:'var(--text2)', padding:'6px 14px', borderRadius:7, cursor:'pointer',
                  fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:5,
                }}>???? Takeover</button>
              )
            )}
            <select
              value={genAction}
              onChange={(e) => setGenAction(e.target.value as GenAction)}
              title="Ch???n ch??? ????? ph??n t??ch AI"
              style={{
                background:'var(--surface2)',
                border:'1px solid var(--border2)',
                color:'var(--text2)',
                padding:'6px 10px',
                borderRadius:7,
                fontSize:12,
                fontWeight:600,
                cursor:'pointer',
              }}
            >
              <option value="auto">{GEN_ACTION_LABEL.auto}</option>
              <option value="crm_basic">{GEN_ACTION_LABEL.crm_basic}</option>
              <option value="estimate_v1">{GEN_ACTION_LABEL.estimate_v1}</option>
              <option value="estimate_preliminary">{GEN_ACTION_LABEL.estimate_preliminary}</option>
              <option value="close_and_auto">{GEN_ACTION_LABEL.close_and_auto}</option>
            </select>
            <select
              value={analyzeFromMessageId}
              onChange={(e) => setAnalyzeFromMessageId(e.target.value)}
              title="Phan tich tu moc tin nhan"
              style={{
                background:'var(--surface2)',
                border:'1px solid var(--border2)',
                color:'var(--text2)',
                padding:'6px 10px',
                borderRadius:7,
                fontSize:12,
                maxWidth: 240,
                cursor:'pointer',
              }}
            >
              <option value="">Toan bo 260 tin moi nhat</option>
              {analyzeScopeOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {new Date(m.created_at).toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' })} - {m.sender_type}: {String(m.content || '').slice(0, 40)}
                </option>
              ))}
            </select>
            <button onClick={handleRunGen} disabled={analyzing}
              style={{
                background:'rgba(168,85,247,0.12)', border:'1px solid rgba(168,85,247,0.35)',
                color:'#A855F7', padding:'6px 14px', borderRadius:7,
                cursor: analyzing ? 'not-allowed' : 'pointer',
                fontSize:12, fontWeight:700, opacity: analyzing ? 0.7 : 1,
              }}>
              {analyzing ? '???...' : '???? Gen'}
            </button>
            {isClosed && (
              <button onClick={handleReopen} style={{
                background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.35)',
                color:'var(--green)', padding:'6px 12px', borderRadius:7,
                cursor:'pointer', fontSize:12, fontWeight:700,
              }}>Mo lai</button>
            )}
            <button onClick={() => setShowAnalysis(s => !s)}
              title="???n/hi???n panel ph??n t??ch"
              style={{
                background: showAnalysis ? 'var(--accent-dim)' : 'transparent',
                border:`1px solid ${showAnalysis ? 'rgba(249,115,22,0.3)' : 'var(--border2)'}`,
                color: showAnalysis ? 'var(--accent-text)' : 'var(--text3)',
                padding:'6px 10px', borderRadius:7, cursor:'pointer', fontSize:13,
              }}>????</button>
          </div>
        </div>

        {/* Status bar */}
        {isActive && isTakeover && (
          <div style={{ padding:'5px 18px', background:'rgba(59,130,246,0.07)', borderBottom:'1px solid rgba(59,130,246,0.15)', fontSize:11, color:'var(--blue)', display:'flex', alignItems:'center', gap:6 }}>
            <span>●</span> <strong>Bạn đang xử lý</strong> — tin nhắn sẽ gửi qua {ch.label}
          </div>
        )}
        {isActive && !isTakeover && (
          <div style={{ padding:'5px 18px', background:'rgba(168,85,247,0.06)', borderBottom:'1px solid rgba(168,85,247,0.15)', fontSize:11, color:'#A855F7', display:'flex', alignItems:'center', gap:6 }}>
            <span>●</span> <strong>Bot đang tự động</strong> — Takeover để tự gửi
          </div>
        )}
        {!isActive && (
          <div style={{ padding:'5px 18px', background:'var(--surface2)', borderBottom:'1px solid var(--border)', fontSize:11, color:'var(--text4)' }}>
            ⚫ Đã đóng {conv.close_reason ? `(${conv.close_reason})` : ''} — {new Date(conv.last_message_at).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
          </div>
        )}

        {/* ── Messages scroll area ────────────────────────────── */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column' }}>
          {messages.length === 0 && (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text4)', fontSize:13, flexDirection:'column', gap:8 }}>
              <div style={{ fontSize:40 }}>{ch.icon}</div>
              <div>Chưa có tin nhắn nào</div>
              {process.env.NODE_ENV !== 'production' && (
                <div style={{ fontSize:11, color:'var(--text4)', marginTop:4 }}>Dùng DEV simulator bên dưới để test</div>
              )}
            </div>
          )}

          {grouped.map((group, gi) => (
            <div key={gi}>
              <DateSep date={group.date} />
              {group.msgs.map((msg, mi) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  conv={conv}
                  feedbackMap={feedbacks}
                  onFeedback={handleFeedback}
                  prevMsg={mi > 0 ? group.msgs[mi-1] : (gi > 0 ? grouped[gi-1].msgs.at(-1) : undefined)}
                />
              ))}
            </div>
          ))}

          <div ref={bottomRef} style={{ height:1 }} />
        </div>

        {/* ── Reply input ─────────────────────────────────────── */}
        <div style={{ padding:'12px 16px', background:'var(--surface)', borderTop:'1px solid var(--border)', flexShrink:0 }}>
          {!canType && isActive && (
            <div style={{ fontSize:11, color:'var(--text4)', marginBottom:7, display:'flex', alignItems:'center', gap:8 }}>
              🤖 Bot đang xử lý —
              <button onClick={() => handleTakeover('take')}
                style={{ background:'none', border:'none', color:'var(--blue)', cursor:'pointer', fontSize:11, padding:'0 2px', textDecoration:'underline', fontWeight:600 }}>
                Takeover để nhắn thủ công
              </button>
            </div>
          )}
          <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
            {/* Emoji / attach placeholder */}
            <div style={{ display:'flex', gap:6, flexShrink:0, paddingBottom:4 }}>
              <button title="Đính kèm (sắp ra mắt)" style={{ background:'none', border:'none', color:'var(--text4)', cursor:'not-allowed', fontSize:16, padding:2, opacity:0.5 }}>📎</button>
            </div>
            <textarea
              ref={textareaRef}
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
              placeholder={
                !isActive    ? 'Conversation đã đóng' :
                !canType     ? 'Takeover để nhắn tin...' :
                `Nhắn qua ${ch.label}... (Enter gửi, Shift+Enter xuống dòng)`
              }
              disabled={!canType}
              rows={1}
              style={{
                flex:1, background: canType ? 'var(--surface2)' : 'var(--surface3)',
                border:`1.5px solid ${canType ? 'var(--border2)' : 'var(--border)'}`,
                borderRadius:10, padding:'10px 14px',
                color: canType ? 'var(--text)' : 'var(--text4)',
                fontSize:13, resize:'none', lineHeight:1.5,
                maxHeight:120, overflowY:'auto',
                outline:'none',
                transition:'border-color .15s',
              }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 120) + 'px'
              }}
              onFocus={e => { if (canType) e.target.style.borderColor = 'var(--accent)' }}
              onBlur={e  => { e.target.style.borderColor = canType ? 'var(--border2)' : 'var(--border)' }}
            />
            <button
              onClick={sendReply}
              disabled={!canType || sending || !reply.trim()}
              style={{
                width:40, height:40, borderRadius:10, border:'none', cursor: canType && reply.trim() ? 'pointer' : 'not-allowed',
                background: canType && reply.trim() ? 'var(--accent)' : 'var(--surface3)',
                color: canType && reply.trim() ? 'white' : 'var(--text4)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:17, flexShrink:0,
                transition:'all .15s',
                boxShadow: canType && reply.trim() ? '0 2px 8px rgba(249,115,22,0.3)' : 'none',
              }}>
              {sending ? <span className="spinner" style={{ width:16, height:16, borderWidth:2 }} /> : '➤'}
            </button>
          </div>
        </div>

        {/* ── DEV: Message simulator ───────────────────────────── */}
        {process.env.NODE_ENV !== 'production' && (
          <div style={{ padding:'8px 16px 10px', background:'var(--bg)', borderTop:'1px dashed var(--border)', flexShrink:0 }}>
            <div style={{ fontSize:9, color:'var(--text4)', marginBottom:5, fontFamily:"'JetBrains Mono',monospace", letterSpacing:'1.5px', fontWeight:700 }}>
              DEV — SIMULATE CUSTOMER MSG
            </div>
            <div style={{ display:'flex', gap:7, alignItems:'center' }}>
              {/* Channel picker */}
              {(['zalo','messenger','telegram'] as Channel[]).map(ch2 => (
                <button key={ch2} onClick={() => setTestCh(ch2)}
                  style={{
                    padding:'4px 9px', borderRadius:6, fontSize:10, cursor:'pointer', fontWeight:600,
                    border:`1px solid ${testCh === ch2 ? CH[ch2].color : 'var(--border)'}`,
                    background: testCh === ch2 ? CH[ch2].bg : 'transparent',
                    color: testCh === ch2 ? CH[ch2].color : 'var(--text4)',
                  }}>
                  {CH[ch2].icon} {CH[ch2].label}
                </button>
              ))}
              <input
                value={testMsg}
                onChange={e => setTestMsg(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendTestMessage() }}
                placeholder="Nhắn như khách..."
                style={{ flex:1, background:'var(--surface2)', border:'1px dashed var(--border2)', borderRadius:6, padding:'5px 10px', color:'var(--text)', fontSize:12 }}
              />
              <button onClick={sendTestMessage} disabled={testSending}
                style={{ background:'var(--surface2)', border:'1px solid var(--border2)', color:'var(--text2)', padding:'5px 12px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                {testSending ? '...' : '▶ Gửi'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══ RIGHT: Analysis Panel ════════════════════════════════ */}
      {showAnalysis && (
        <div style={{ width:290, flexShrink:0, overflowY:'auto', background:'var(--surface)', borderLeft:'1px solid var(--border)' }}>
          <div style={{ padding:14 }}>

            {/* Conv info card */}
            <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, padding:13, marginBottom:10 }}>
              <div style={{ fontSize:9, letterSpacing:'2px', color:'var(--text4)', marginBottom:8, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>
                BOT GUIDANCE
              </div>
              <textarea
                value={botGuidanceText}
                onChange={(e) => setBotGuidanceText(e.target.value)}
                placeholder="VD: Uu tien hoi kheo so dien thoai va dia chi sau khi da tra loi cau hoi cua khach"
                rows={4}
                style={{
                  width:'100%',
                  background:'var(--surface3)',
                  border:'1px solid var(--border2)',
                  borderRadius:8,
                  padding:'8px 10px',
                  color:'var(--text)',
                  fontSize:12,
                  resize:'vertical',
                  lineHeight:1.5,
                }}
              />
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
                <button
                  onClick={handleSaveBotGuidance}
                  disabled={savingBotGuidance}
                  style={{
                    background:'rgba(34,197,94,0.12)',
                    border:'1px solid rgba(34,197,94,0.35)',
                    color:'var(--green)',
                    padding:'6px 10px',
                    borderRadius:7,
                    cursor: savingBotGuidance ? 'not-allowed' : 'pointer',
                    fontSize:12,
                    fontWeight:700,
                    opacity: savingBotGuidance ? 0.7 : 1,
                  }}
                >
                  {savingBotGuidance ? 'Dang luu...' : 'Luu dinh huong'}
                </button>
              </div>
            </div>

            {/* Conv info card */}
            <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, padding:13, marginBottom:10 }}>
              <div style={{ fontSize:9, letterSpacing:'2px', color:'var(--text4)', marginBottom:9, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>
                THÔNG TIN
              </div>
              {[
                { label:'Kênh',     val: <span style={{ color:ch.color, fontWeight:700 }}>{ch.icon} {ch.label}</span> },
                { label:'Trạng thái', val: conv.status === 'active' ? <span style={{color:'var(--green)'}}>🟢 Đang chat</span> : conv.status === 'pending_callback' ? <span style={{color:'var(--accent)'}}>📞 Chờ gọi lại</span> : <span style={{color:'var(--text4)'}}>⚫ Đã đóng</span> },
                { label:'Bot mode',  val: <span style={{color: isTakeover ? 'var(--blue)' : '#A855F7'}}>{isTakeover ? '👤 Sales' : '🤖 Bot'}</span> },
                { label:'Tin nhắn', val: <span style={{color:'var(--text)'}}>{messages.length}</span> },
                { label:'Bắt đầu',  val: <span style={{color:'var(--text2)', fontSize:11}}>{new Date(conv.opened_at).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span> },
              ].map(({label, val}) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, fontSize:12 }}>
                  <span style={{ color:'var(--text3)' }}>{label}</span>
                  {val}
                </div>
              ))}
            </div>

            {/* Analysis */}
            {analysis ? (
              <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, padding:13 }}>
                <div style={{ fontSize:9, letterSpacing:'2px', color:'var(--text4)', marginBottom:10, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>
                  PHÂN TÍCH AI
                </div>

                {/* Stage + attitude chips */}
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
                  {analysis.stage && (
                    <span style={{ fontSize:10, padding:'2px 9px', borderRadius:10, background:'var(--surface3)', color:'var(--text2)', fontWeight:600 }}>
                      {STAGE_LABEL[analysis.stage]||analysis.stage}
                    </span>
                  )}
                  {analysis.attitude && (
                    <span style={{ fontSize:10, padding:'2px 9px', borderRadius:10, background:'var(--surface3)', color:'var(--text2)' }}>
                      {analysis.attitude==='tich_cuc'?'😊 Tích cực':analysis.attitude==='kho_tinh'?'😤 Khó tính':analysis.attitude==='that_vong'?'😞 Thất vọng':'😐 Trung lập'}
                    </span>
                  )}
                </div>

                {/* Close probability bar */}
                {analysis.close_probability && (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text3)', marginBottom:4 }}>
                      <span>Khả năng chốt</span>
                      <span style={{ fontWeight:800, color: analysis.close_probability>=7?'var(--green)':analysis.close_probability>=5?'var(--yellow)':'var(--text3)' }}>
                        {analysis.close_probability}/10
                      </span>
                    </div>
                    <div style={{ background:'var(--surface3)', borderRadius:3, height:5 }}>
                      <div style={{
                        background: analysis.close_probability>=7?'var(--green)':analysis.close_probability>=5?'var(--yellow)':'var(--red)',
                        width:`${analysis.close_probability*10}%`, height:'100%', borderRadius:3, transition:'width .4s',
                      }} />
                    </div>
                  </div>
                )}

                {/* Extracted info */}
                {(analysis.extracted_name||analysis.extracted_phone||analysis.extracted_address) && (
                  <div style={{ padding:'9px 11px', background:'var(--surface3)', borderRadius:8, marginBottom:10 }}>
                    <div style={{ fontSize:9, color:'var(--text4)', marginBottom:6, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>THÔNG TIN KH</div>
                    {analysis.extracted_name    && <div style={{fontSize:12,color:'var(--text)',marginBottom:2}}>👤 {analysis.extracted_name}</div>}
                    {analysis.extracted_phone   && <div style={{fontSize:12,color:'var(--blue)',marginBottom:2}}>📞 {analysis.extracted_phone}</div>}
                    {analysis.extracted_address && <div style={{fontSize:12,color:'var(--text2)',marginBottom:2}}>📍 {analysis.extracted_address}</div>}
                    {analysis.extracted_budget  && <div style={{fontSize:12,color:'var(--green)'}}>💰 {(analysis.extracted_budget/1e9).toFixed(1)} tỷ</div>}
                  </div>
                )}

                {/* Summary */}
                {analysis.summary && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:10, color:'var(--text3)', marginBottom:4, fontWeight:600 }}>TÓM TẮT</div>
                    <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.55 }}>{analysis.summary}</div>
                  </div>
                )}

                {/* Next action */}
                {analysis.next_action && (
                  <div style={{ padding:'9px 11px', background:'rgba(249,115,22,0.07)', border:'1px solid rgba(249,115,22,0.2)', borderRadius:8, borderLeft:'3px solid var(--accent)' }}>
                    <div style={{ fontSize:9, color:'var(--accent)', fontWeight:800, marginBottom:3, letterSpacing:'0.08em' }}>HÀNH ĐỘNG TIẾP</div>
                    <div style={{ fontSize:12, color:'var(--text)' }}>{analysis.next_action}</div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, padding:'20px 14px', textAlign:'center' }}>
                <div style={{ color:'var(--text4)', fontSize:12, marginBottom:8 }}>
                  {conv.status==='closed' ? '⏳ AI đang phân tích...' : '📊 Phân tích có sau khi đóng'}
                </div>
                {isActive && (
                  <button onClick={() => { setGenAction('close_and_auto'); handleRunGen() }}
                    style={{ background:'var(--surface3)', border:'1px solid var(--border2)', color:'var(--text2)', padding:'6px 14px', borderRadius:7, cursor:'pointer', fontSize:12 }}>
                    Đóng & Phân tích ngay
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)',
          background:'var(--surface)', border:'1px solid var(--border2)',
          color:'var(--text)', padding:'10px 20px', borderRadius:10, fontSize:13,
          zIndex:9999, boxShadow:'var(--shadow-md)', animation:'fadeUp .2s ease',
          whiteSpace:'nowrap',
        }}>{toast}</div>
      )}

      {/* ── AI Analyze Modal ─────────────────────────────────────── */}
      {showAnalyzeModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={e => e.target === e.currentTarget && setShowAnalyzeModal(false)}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:14, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 60px rgba(0,0,0,0.5)' }}>

            {/* Header */}
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>🤖 Phân tích AI</div>
                {analyzeResult && (
                  <div style={{ fontSize:11, color:'var(--text4)', marginTop:2 }}>
                    {analyzeResult.transcript_length} tin nhắn · {analyzeResult.channel}
                    {analyzeResult.existing_customer && (
                      <span style={{ color:'var(--blue)', marginLeft:8 }}>→ Khách đã có: {analyzeResult.existing_customer.full_name || analyzeResult.existing_customer.phone_number}</span>
                    )}
                  </div>
                )}
                {analyzeResult && (
                  <div style={{ display:'flex', gap:6, marginTop:7, flexWrap:'wrap' }}>
                    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'var(--surface3)', color:'var(--text2)' }}>
                      Mode: {ANALYSIS_MODE_LABEL[(analyzeResult.analysis_mode || 'crm_basic') as AnalysisMode] || analyzeResult.analysis_mode}
                    </span>
                    <span style={{
                      fontSize:10, padding:'2px 8px', borderRadius:10,
                      background: analyzeResult.status === 'needs_data' ? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.18)',
                      color: analyzeResult.status === 'needs_data' ? '#F59E0B' : '#22C55E',
                    }}>
                      {analyzeResult.status === 'needs_data' ? 'Cần bổ sung dữ liệu' : 'Đủ dữ liệu'}
                    </span>
                  </div>
                )}
              </div>
              <button onClick={() => { setShowAnalyzeModal(false); setAutoSaveCountdown(null) }}
                style={{ background:'none', border:'none', color:'var(--text4)', cursor:'pointer', fontSize:20, lineHeight:1 }}>✕</button>
            </div>

            {analyzing ? (
              <div style={{ padding:48, textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:12 }}>🤖</div>
                <div style={{ fontSize:13, color:'var(--text3)' }}>AI đang phân tích hội thoại...</div>
              </div>
            ) : analyzeResult ? (
              <div style={{ padding:'16px 20px' }}>

                {/* Potential score */}
                {(analyzeResultMode === 'crm_basic' || analyzeResultMode === 'auto') && analyzeResult.extracted?.potential_score && (
                  <div style={{ marginBottom:16, padding:'12px 16px', background:'rgba(168,85,247,0.07)', border:'1px solid rgba(168,85,247,0.2)', borderRadius:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
                      <div style={{ fontSize:28, fontWeight:900, color: analyzeResult.extracted.potential_level === 'cao' ? 'var(--green)' : analyzeResult.extracted.potential_level === 'trung' ? 'var(--yellow)' : 'var(--red)' }}>
                        {analyzeResult.extracted.potential_score}/10
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', textTransform:'capitalize' }}>
                          Tiềm năng {analyzeResult.extracted.potential_level}
                        </div>
                        <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                          {analyzeResult.extracted.potential_reason}
                        </div>
                      </div>
                    </div>
                    {analyzeResult.extracted.next_action && (
                      <div style={{ fontSize:12, color:'var(--text2)', borderTop:'1px solid rgba(168,85,247,0.15)', paddingTop:8 }}>
                        💡 <strong>Gợi ý:</strong> {analyzeResult.extracted.next_action}
                      </div>
                    )}
                  </div>
                )}

                {(analyzeResultMode === 'estimate_v1' || analyzeResultMode === 'estimate_preliminary') && Array.isArray(analyzeResult.missing_fields) && analyzeResult.missing_fields.length > 0 && (
                  <div style={{ marginBottom:14, padding:'10px 12px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)' }}>
                    <div style={{ fontSize:10, letterSpacing:'1.4px', color:'#F59E0B', fontWeight:700, marginBottom:6 }}>THIẾU DỮ LIỆU KHÁI TOÁN</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                      {analyzeResult.missing_fields.map((f: string) => (
                        <span key={f} style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:'rgba(245,158,11,0.12)', color:'#F59E0B' }}>
                          {f}
                        </span>
                      ))}
                    </div>
                    {Array.isArray(analyzeResult.recommended_questions) && analyzeResult.recommended_questions.length > 0 && (
                      <div>
                        <div style={{ fontSize:10, color:'var(--text3)', marginBottom:5 }}>Câu hỏi gợi ý để hỏi khách:</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {analyzeResult.recommended_questions.map((q: string, idx: number) => (
                            <div key={`${idx}-${q}`} style={{ fontSize:12, color:'var(--text2)', lineHeight:1.5 }}>
                              {idx + 1}. {q}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Fields */}
                <div style={{ fontSize:10, letterSpacing:'1.5px', color:'var(--text4)', fontWeight:700, marginBottom:10 }}>THÔNG TIN KHÁCH HÀNG</div>
                {[
                  { key:'full_name',              label:'Họ tên', placeholder:'Chưa có' },
                  { key:'phone_number',           label:'Số điện thoại', placeholder:'Chưa có' },
                  { key:'address',                label:'Địa chỉ', placeholder:'Chưa có' },
                  { key:'house_type',             label:'Loại nhà', placeholder:'Chưa rõ' },
                  { key:'floors',                 label:'Số tầng', placeholder:'Chưa rõ' },
                  { key:'floor_area',             label:'Diện tích (m²)', placeholder:'Chưa rõ' },
                  { key:'budget_min',             label:'Ngân sách từ (VND)', placeholder:'Chưa rõ' },
                  { key:'budget_max',             label:'Ngân sách đến (VND)', placeholder:'Chưa rõ' },
                  { key:'budget_target',          label:'Ngân sách mục tiêu', placeholder:'Chưa rõ' },
                  { key:'finish_level',           label:'Mức hoàn thiện', placeholder:'Chưa rõ' },
                  { key:'construction_timeframe', label:'Thời điểm thi công', placeholder:'Chưa rõ' },
                  { key:'alley_access',           label:'Điều kiện hẻm/mặt tiền', placeholder:'Chưa rõ' },
                ].map(f => {
                  const val = editValues[f.key]
                  const isEmpty = val === null || val === undefined || val === ''
                  const isEditing = editField === f.key

                  return (
                    <div key={f.key} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, padding:'8px 10px', background:'var(--surface2)', borderRadius:8, border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:11, color:'var(--text4)', width:130, flexShrink:0 }}>{f.label}</div>
                      {isEditing ? (
                        <input autoFocus value={String(val ?? '')}
                          onChange={e => setEditValues(p => ({ ...p, [f.key]: e.target.value }))}
                          onBlur={() => setEditField(null)}
                          onKeyDown={e => e.key === 'Enter' && setEditField(null)}
                          style={{ flex:1, background:'var(--surface3)', border:'1px solid var(--accent)', borderRadius:6, padding:'4px 8px', color:'var(--text)', fontSize:12 }} />
                      ) : (
                        <div style={{ flex:1, fontSize:12, color: isEmpty ? 'var(--text4)' : 'var(--text)', fontStyle: isEmpty ? 'italic' : 'normal' }}>
                          {isEmpty ? f.placeholder : String(val)}
                        </div>
                      )}
                      <button onClick={() => setEditField(f.key)}
                        style={{ background:'none', border:'1px solid var(--border2)', color:'var(--text4)', borderRadius:5, padding:'3px 8px', cursor:'pointer', fontSize:11 }}>
                        ✏️
                      </button>
                      <button onClick={() => copyField(val)}
                        disabled={isEmpty}
                        style={{ background:'none', border:'1px solid var(--border2)', color: isEmpty ? 'var(--text4)' : 'var(--blue)', borderRadius:5, padding:'3px 8px', cursor: isEmpty ? 'not-allowed' : 'pointer', fontSize:11, opacity: isEmpty ? 0.4 : 1 }}>
                        📋
                      </button>
                    </div>
                  )
                })}

                {/* Summary */}
                {analyzeResult.extracted?.summary && (
                  <div style={{ marginTop:12, padding:'10px 12px', background:'var(--surface2)', borderRadius:8, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:10, letterSpacing:'1.5px', color:'var(--text4)', fontWeight:700, marginBottom:6 }}>TÓM TẮT</div>
                    <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6 }}>{analyzeResult.extracted.summary}</div>
                  </div>
                )}

                {/* Auto-save countdown */}
                {autoSaveCountdown !== null && autoSaveCountdown > 0 && !analyzeResult.existing_customer && analyzeResult.status !== 'needs_data' && (
                  <div style={{ marginTop:12, padding:'8px 12px', background:'rgba(34,197,94,0.07)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:8, fontSize:12, color:'var(--green)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span>⏱ Tự động tạo khách hàng sau <strong>{autoSaveCountdown}s</strong> (các field mới)</span>
                    <button onClick={() => setAutoSaveCountdown(null)}
                      style={{ background:'none', border:'none', color:'var(--text4)', cursor:'pointer', fontSize:12 }}>Hủy</button>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ marginTop:16, display:'flex', gap:10 }}>
                  <button onClick={() => handleSaveCustomer(true)} disabled={saving}
                    style={{ flex:1, padding:'10px', borderRadius:8, border:'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize:13, fontWeight:700,
                      background: analyzeResult.existing_customer ? 'var(--blue)' : 'var(--green)', color:'white', opacity: saving ? 0.7 : 1 }}>
                    {saving ? '⏳ Đang lưu...' : analyzeResult.existing_customer ? '↻ Cập nhật Customer' : '+ Tạo Customer mới'}
                  </button>
                  <button onClick={() => { setShowAnalyzeModal(false); setAutoSaveCountdown(null) }}
                    style={{ padding:'10px 20px', borderRadius:8, border:'1px solid var(--border2)', background:'transparent', color:'var(--text3)', cursor:'pointer', fontSize:13 }}>
                    Bỏ qua
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
