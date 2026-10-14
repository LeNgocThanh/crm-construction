'use client'
// src/app/(dashboard)/conversations/page.tsx
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

const CHANNEL_LABEL: Record<string, string> = { zalo: 'Zalo', messenger: 'Messenger', telegram: 'Telegram' }
const CHANNEL_COLOR: Record<string, string> = { zalo: '#0068FF', messenger: '#FF5722', telegram: '#26A5E4' }
const STAGE_LABEL: Record<string, string> = {
  tim_hieu: 'Tìm hiểu',
  tu_van: 'Đang tư vấn',
  da_chot: 'Đã chốt',
  bao_hanh: 'Bảo hành',
  khac: 'Khác',
}
const ATTITUDE_COLOR: Record<string, string> = {
  tich_cuc: '#22C55E',
  trung_lap: '#94A3B8',
  kho_tinh: '#F59E0B',
  that_vong: '#EF4444',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Đang chat',
  closed: 'Đã đóng',
  pending_callback: 'Chờ gọi lại',
}

export default function ConversationsPage() {
  useSession()
  const [convs, setConvs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    channel: 'all', status: '', urgent: '', callback: '', search: '',
  })
  const [page, setPage] = useState(1)
  const [unreadCount, setUnreadCount] = useState(0)
  const [alerts, setAlerts] = useState<any[]>([])
  const sseRef = useRef<EventSource | null>(null)

  const fetchConvs = async () => {
    setLoading(true)
    const p = new URLSearchParams({ page: String(page), limit: '30' })
    if (filter.channel !== 'all') p.set('channel', filter.channel)
    if (filter.status) p.set('status', filter.status)
    if (filter.urgent) p.set('urgent', filter.urgent)
    if (filter.callback) p.set('callback', filter.callback)
    if (filter.search) p.set('search', filter.search)
    const r = await fetch(`/api/conversations?${p}`)
    const j = await r.json()
    setConvs(j.data || [])
    setTotal(j.total || 0)
    setLoading(false)
  }

  useEffect(() => { fetchConvs() }, [filter, page])

  useEffect(() => {
    const es = new EventSource('/api/alerts/stream')
    sseRef.current = es
    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'unread_count') setUnreadCount(data.count)
      if (data.type === 'conversation_update') fetchConvs()
      if (data.type === 'urgent' || data.type === 'callback') {
        setAlerts(prev => [data, ...prev.slice(0, 4)])
        fetchConvs()
      }
    }
    return () => es.close()
  }, [])

  const timeSince = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'Vừa xong'
    if (m < 60) return `${m}p trước`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h trước`
    return `${Math.floor(h / 24)}d trước`
  }

  return (
    <div style={{ padding: '24px', background: '#080C12', minHeight: '100vh', color: '#E2EBF4', width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>Conversations</h1>
          <div style={{ fontSize: '13px', color: '#64748B' }}>
            {total} cuộc hội thoại
            {unreadCount > 0 && (
              <span style={{ marginLeft: '12px', background: '#EF4444', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                {unreadCount} chưa đọc
              </span>
            )}
          </div>
        </div>
        <a
          href="/settings/chatbot"
          style={{
            background: '#1E3048', border: '1px solid #2A4060', color: '#94A3B8',
            padding: '8px 16px', borderRadius: '8px', textDecoration: 'none',
            fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '100%',
          }}
        >
          Cấu hình chatbot
        </a>
      </div>

      {alerts.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {alerts.slice(0, 2).map((a, i) => (
            <div
              key={i}
              onClick={() => window.location.href = `/conversations/${a.conv_id}`}
              style={{
                background: a.type === 'urgent' ? 'rgba(239,68,68,0.12)' : 'rgba(249,115,22,0.12)',
                border: `1px solid ${a.type === 'urgent' ? 'rgba(239,68,68,0.4)' : 'rgba(249,115,22,0.4)'}`,
                borderRadius: '8px', padding: '10px 14px', marginBottom: '8px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
              }}
            >
              <span style={{ fontSize: '18px' }}>{a.type === 'urgent' ? '🚨' : '📞'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: '13px', color: a.type === 'urgent' ? '#EF4444' : '#F97316' }}>
                  {a.type === 'urgent' ? 'CẦN HỖ TRỢ NGAY' : 'YÊU CẦU GỌI LẠI'} — {a.display_name}
                </strong>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px', whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{a.preview}</div>
              </div>
              <span style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {CHANNEL_LABEL[a.channel] || a.channel}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{
        background: '#0F1520', border: '1px solid #1E3048', borderRadius: '10px',
        padding: '14px 16px', marginBottom: '16px',
        display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', width: '100%', maxWidth: '100%', boxSizing: 'border-box',
      }}>
        <input
          placeholder="🔍 Tìm tên, ID..."
          value={filter.search}
          onChange={e => { setFilter(f => ({ ...f, search: e.target.value })); setPage(1) }}
          style={{
            background: '#16202E', border: '1px solid #2A4060', borderRadius: '6px',
            padding: '7px 12px', color: '#E2EBF4', fontSize: '13px', width: '200px', maxWidth: '100%', boxSizing: 'border-box',
          }}
        />

        {['all', 'zalo', 'messenger', 'telegram'].map(ch => (
          <button
            key={ch}
            onClick={() => { setFilter(f => ({ ...f, channel: ch })); setPage(1) }}
            style={{
              background: filter.channel === ch ? '#1E3048' : 'transparent',
              border: `1px solid ${filter.channel === ch ? '#2A4060' : '#1E3048'}`,
              color: filter.channel === ch ? '#E2EBF4' : '#64748B',
              padding: '6px 14px', borderRadius: '6px', fontSize: '12px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {ch === 'all' ? 'Tất cả' : (
              <>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: CHANNEL_COLOR[ch], display: 'inline-block' }} />
                {CHANNEL_LABEL[ch]}
              </>
            )}
          </button>
        ))}

        <div style={{ width: '1px', height: '20px', background: '#1E3048' }} />

        {[
          { v: '', l: 'Tất cả trạng thái' },
          { v: 'active', l: '🟢 Đang chat' },
          { v: 'pending_callback', l: '📞 Chờ gọi lại' },
          { v: 'closed', l: '⚫ Đã đóng' },
        ].map(opt => (
          <button
            key={opt.v}
            onClick={() => { setFilter(f => ({ ...f, status: opt.v })); setPage(1) }}
            style={{
              background: filter.status === opt.v ? '#1E3048' : 'transparent',
              border: `1px solid ${filter.status === opt.v ? '#2A4060' : '#1E3048'}`,
              color: filter.status === opt.v ? '#E2EBF4' : '#64748B',
              padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
            }}
          >
            {opt.l}
          </button>
        ))}

        <button
          onClick={() => { setFilter(f => ({ ...f, urgent: f.urgent ? '' : 'true' })); setPage(1) }}
          style={{
            background: filter.urgent ? 'rgba(239,68,68,0.15)' : 'transparent',
            border: `1px solid ${filter.urgent ? 'rgba(239,68,68,0.4)' : '#1E3048'}`,
            color: filter.urgent ? '#EF4444' : '#64748B',
            padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
          }}
        >
          🚨 Urgent
        </button>
        <button
          onClick={() => { setFilter(f => ({ ...f, callback: f.callback ? '' : 'true' })); setPage(1) }}
          style={{
            background: filter.callback ? 'rgba(249,115,22,0.15)' : 'transparent',
            border: `1px solid ${filter.callback ? 'rgba(249,115,22,0.4)' : '#1E3048'}`,
            color: filter.callback ? '#F97316' : '#64748B',
            padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
          }}
        >
          📞 Gọi lại
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748B' }}>Đang tải...</div>
      ) : convs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: '#0F1520', border: '1px solid #1E3048', borderRadius: '12px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>💬</div>
          <div style={{ color: '#64748B' }}>Chưa có hội thoại nào</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {convs.map(conv => {
            const lastMsg = conv.messages?.[0]
            const unread = conv._count?.messages || 0
            const analysis = conv.analysis
            const isUrgent = conv.is_urgent
            const isCallback = conv.needs_callback

            return (
              <a
                key={conv.id}
                href={`/conversations/${conv.id}`}
                style={{
                  display: 'block', textDecoration: 'none',
                  background: '#0F1520',
                  border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.4)' : isCallback ? 'rgba(249,115,22,0.3)' : '#1E3048'}`,
                  borderRadius: '10px', padding: '14px 16px',
                  transition: 'all 0.15s', width: '100%', maxWidth: '100%', boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                    background: CHANNEL_COLOR[conv.channel] + '22',
                    border: `2px solid ${CHANNEL_COLOR[conv.channel]}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', position: 'relative',
                  }}>
                    {conv.channel === 'zalo' ? '💙' : conv.channel === 'messenger' ? '🟠' : '✈️'}
                    {unread > 0 && (
                      <span style={{
                        position: 'absolute', top: '-4px', right: '-4px',
                        background: '#EF4444', color: 'white',
                        borderRadius: '10px', fontSize: '9px', fontWeight: 700,
                        padding: '1px 5px', minWidth: '16px', textAlign: 'center',
                      }}>{unread}</span>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: '#E2EBF4' }}>
                          {conv.display_name || 'Khách không tên'}
                        </span>
                        <span style={{
                          fontSize: '10px', padding: '1px 7px', borderRadius: '10px',
                          background: CHANNEL_COLOR[conv.channel] + '22',
                          color: CHANNEL_COLOR[conv.channel], fontWeight: 600,
                        }}>{CHANNEL_LABEL[conv.channel]}</span>
                        {isUrgent && <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: 700 }}>🚨 URGENT</span>}
                        {isCallback && !isUrgent && <span style={{ fontSize: '11px', color: '#F97316' }}>📞 Gọi lại</span>}
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap', marginLeft: '8px', flexShrink: 0 }}>
                        {timeSince(conv.last_message_at)}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#64748B', whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.45 }}>
                      {lastMsg ? (
                        <>
                          <span style={{ color: lastMsg.sender_type === 'bot' ? '#A855F7' : lastMsg.sender_type === 'sales' ? '#3B82F6' : '#94A3B8' }}>
                            {lastMsg.sender_type === 'bot' ? 'Bot: ' : lastMsg.sender_type === 'sales' ? 'Sales: ' : ''}
                          </span>
                          {lastMsg.content}
                        </>
                      ) : 'Chưa có tin nhắn'}
                    </div>

                    {analysis && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {analysis.stage && (
                          <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '10px', background: '#1E3048', color: '#94A3B8' }}>
                            {STAGE_LABEL[analysis.stage] || analysis.stage}
                          </span>
                        )}
                        {analysis.attitude && (
                          <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '10px', background: ATTITUDE_COLOR[analysis.attitude] + '22', color: ATTITUDE_COLOR[analysis.attitude] }}>
                            {analysis.attitude === 'tich_cuc' ? '😊 Tích cực' : analysis.attitude === 'kho_tinh' ? '😤 Khó tính' : analysis.attitude === 'that_vong' ? '😞 Thất vọng' : '😐 Trung lập'}
                          </span>
                        )}
                        {analysis.close_probability && (
                          <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '10px', background: analysis.close_probability >= 7 ? 'rgba(34,197,94,0.15)' : '#1E3048', color: analysis.close_probability >= 7 ? '#22C55E' : '#64748B' }}>
                            Chốt {analysis.close_probability}/10
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
                      background: conv.status === 'active' ? 'rgba(34,197,94,0.12)' : conv.status === 'pending_callback' ? 'rgba(249,115,22,0.12)' : '#1E3048',
                      color: conv.status === 'active' ? '#22C55E' : conv.status === 'pending_callback' ? '#F97316' : '#64748B',
                      display: 'block', marginBottom: '4px',
                    }}>{STATUS_LABEL[conv.status] || conv.status}</span>
                    <span style={{ fontSize: '10px', color: conv.bot_mode === 'takeover' ? '#3B82F6' : conv.bot_mode === 'auto' ? '#A855F7' : '#64748B' }}>
                      {conv.bot_mode === 'takeover' ? '👤 Sales' : conv.bot_mode === 'auto' ? '🤖 Bot' : '⏸ Manual'}
                    </span>
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      )}

      {total > 30 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
          {page > 1 && (
            <button
              onClick={() => setPage(p => p - 1)}
              style={{ background: '#0F1520', border: '1px solid #1E3048', color: '#94A3B8', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
            >
              ← Trước
            </button>
          )}
          <span style={{ padding: '7px 12px', color: '#64748B', fontSize: '13px' }}>
            {page} / {Math.ceil(total / 30)}
          </span>
          {page < Math.ceil(total / 30) && (
            <button
              onClick={() => setPage(p => p + 1)}
              style={{ background: '#0F1520', border: '1px solid #1E3048', color: '#94A3B8', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
            >
              Sau →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
