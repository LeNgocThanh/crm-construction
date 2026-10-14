'use client'
// src/components/layout/Topbar.tsx — V2.1: hamburger + theme switcher + read notifications
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLayout } from './ThemeProvider'

function getUserDisplayName(user: any) {
  const fullName = String(user?.full_name || '').trim()
  const username = String(user?.username || '').trim()
  if (fullName && username && fullName !== username) return `${fullName} (${username})`
  return fullName || username || '-'
}

function getUserRoleLabel(user: any) {
  return String(user?.primary_access_role?.name || user?.primary_access_role?.key || user?.role || '').trim() || '-'
}


// ─── Global Search ─────────────────────────────────────────────────
function GlobalSearch() {
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }
      if (e.key === 'Escape') { setOpen(false); setQuery('') }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  useEffect(() => {
    if (!query || query.length < 2) { setResults(null); return }
    const t = setTimeout(async () => {
      setLoading(true)
      const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      setResults((await r.json()).data)
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const total = results ? (results.customers?.length||0)+(results.projects?.length||0)+(results.users?.length||0) : 0
  const STATUS_CLR: Record<string,string> = { 'Mới':'var(--blue)','Đang tư vấn':'var(--accent)','Đã chốt':'var(--green)','Tạm ngưng':'var(--text4)' }

  return (
    <>
      <button onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        style={{
          display:'flex', alignItems:'center', gap:10, padding:'7px 14px',
          borderRadius:8, background:'var(--surface2)', border:'1px solid var(--border2)',
          color:'var(--text3)', cursor:'pointer', fontSize:13, width:240,
        }}>
        <span>🔍</span>
        <span style={{flex:1, textAlign:'left'}}>Tìm kiếm...</span>
        <kbd style={{fontFamily:"'JetBrains Mono',monospace", fontSize:10, padding:'1px 6px', borderRadius:4, background:'var(--surface3)', color:'var(--text4)'}}>⌘K</kbd>
      </button>

      {open && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:80 }}
          onClick={() => { setOpen(false); setQuery('') }}>
          <div style={{ width:'100%', maxWidth:560, background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow-lg)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
              <span style={{fontSize:16, color:'var(--text3)'}}>🔍</span>
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Tìm SĐT, tên khách hàng, địa chỉ..."
                style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'var(--text)', fontSize:15, fontFamily:'DM Sans,sans-serif' }}
                autoFocus />
              {loading && <span className="spinner" style={{width:16,height:16,flexShrink:0}} />}
              {!loading && query && <button onClick={() => setQuery('')} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:18}}>×</button>}
            </div>
            {!results && !loading && query.length < 2 && (
              <div style={{padding:'20px 18px', color:'var(--text3)', fontSize:13, textAlign:'center'}}>Nhập ít nhất 2 ký tự</div>
            )}
            {results && total === 0 && (
              <div style={{padding:32, textAlign:'center', color:'var(--text3)', fontSize:13}}>Không tìm thấy "{query}"</div>
            )}
            {results && total > 0 && (
              <div style={{maxHeight:420, overflowY:'auto'}}>
                {results.customers?.length > 0 && (
                  <div>
                    <div style={{padding:'10px 18px 6px', fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:2, color:'var(--text3)', fontWeight:700}}>KHÁCH HÀNG</div>
                    {results.customers.map((c: any) => (
                      <Link key={c.id} href={`/customers/${c.id}`} onClick={() => { setOpen(false); setQuery('') }} style={{textDecoration:'none'}}>
                        <div style={{display:'flex', alignItems:'center', gap:12, padding:'10px 18px', cursor:'pointer'}} className="search-row">
                          <div style={{width:34,height:34,borderRadius:9,flexShrink:0,background:'rgba(96,165,250,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>👤</div>
                          <div style={{flex:1, minWidth:0}}>
                            <div style={{fontSize:13, fontWeight:600, color:'var(--text)'}}>{c.full_name||<span style={{color:'var(--text4)',fontStyle:'italic'}}>Chưa có tên</span>}</div>
                            <div style={{fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'var(--blue)'}}>{c.phone_number}</div>
                          </div>
                          <span style={{fontSize:11, padding:'2px 8px', borderRadius:5, background:`${STATUS_CLR[c.status]||'var(--text4)'}20`, color:STATUS_CLR[c.status]||'var(--text4)'}}>{c.status}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {results.projects?.length > 0 && (
                  <div style={{borderTop:'1px solid var(--border)'}}>
                    <div style={{padding:'10px 18px 6px', fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:2, color:'var(--text3)', fontWeight:700}}>DỰ ÁN XÂY DỰNG</div>
                    {results.projects.map((p: any) => (
                      <Link key={p.id} href={`/customers/${p.customer_id}`} onClick={() => { setOpen(false); setQuery('') }} style={{textDecoration:'none'}}>
                        <div style={{display:'flex', alignItems:'center', gap:12, padding:'10px 18px', cursor:'pointer'}} className="search-row">
                          <div style={{width:34,height:34,borderRadius:9,flexShrink:0,background:'rgba(249,115,22,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>🏗️</div>
                          <div style={{flex:1, minWidth:0}}>
                            <div style={{fontSize:13, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{p.address}</div>
                            <div style={{fontSize:11, color:'var(--text3)'}}>{p.house_type} · {p.customer?.full_name||p.customer?.phone_number}</div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {results.users?.length > 0 && (
                  <div style={{borderTop:'1px solid var(--border)'}}>
                    <div style={{padding:'10px 18px 6px', fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:2, color:'var(--text3)', fontWeight:700}}>NHÂN VIÊN</div>
                    {results.users.map((u: any) => (
                      <Link key={u.id} href="/users" onClick={() => { setOpen(false); setQuery('') }} style={{textDecoration:'none'}}>
                        <div style={{display:'flex', alignItems:'center', gap:12, padding:'10px 18px', cursor:'pointer'}} className="search-row">
                          <div style={{width:34,height:34,borderRadius:9,flexShrink:0,background:'rgba(192,132,252,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>👔</div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13, fontWeight:600, color:'var(--text)'}}>{getUserDisplayName(u)}</div>
                            <div style={{fontSize:11, color:'var(--text3)'}}>{getUserRoleLabel(u)}</div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div style={{padding:'10px 18px', borderTop:'1px solid var(--border)', display:'flex', gap:16, fontSize:11, color:'var(--text4)'}}>
              <span><kbd style={{fontFamily:'monospace', background:'var(--surface3)', padding:'1px 5px', borderRadius:3, color:'var(--text3)'}}>↵</kbd> mở</span>
              <span><kbd style={{fontFamily:'monospace', background:'var(--surface3)', padding:'1px 5px', borderRadius:3, color:'var(--text3)'}}>Esc</kbd> đóng</span>
            </div>
          </div>
        </div>
      )}
      <style>{`.search-row:hover { background: var(--surface2) !important; }`}</style>
    </>
  )
}

// ─── Theme Switcher ────────────────────────────────────────────────
function ThemeSwitcher() {
  const { theme, setTheme } = useLayout()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const THEMES = [
    { key: 'dark',    label: 'Tối',      icon: '🌑', desc: 'Nền đen sâu' },
    { key: 'balance', label: 'Cân bằng', icon: '🌗', desc: 'Xám xanh trung tính' },
    { key: 'light',   label: 'Sáng',     icon: '☀️', desc: 'Nền trắng' },
  ] as const

  const current = THEMES.find(t => t.key === theme)

  return (
    <div style={{ position:'relative' }} ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        title="Đổi giao diện"
        style={{
          width:36, height:36, borderRadius:8,
          border:'1px solid var(--border2)',
          background: open ? 'var(--surface2)' : 'var(--surface)',
          cursor:'pointer', fontSize:16,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
        {current?.icon}
      </button>

      {open && (
        <div style={{
          position:'absolute', top:44, right:0, width:200, zIndex:1000,
          background:'var(--surface)', border:'1px solid var(--border2)',
          borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-lg)',
          animation:'fadeUp .15s ease',
        }}>
          <div style={{padding:'10px 14px 6px', fontSize:10, fontFamily:"'JetBrains Mono',monospace", letterSpacing:2, color:'var(--text3)', fontWeight:700}}>GIAO DIỆN</div>
          {THEMES.map(t => (
            <button key={t.key} onClick={() => { setTheme(t.key); setOpen(false) }}
              style={{
                width:'100%', display:'flex', alignItems:'center', gap:10,
                padding:'9px 14px', background: theme === t.key ? 'var(--accent-dim)' : 'transparent',
                border:'none', cursor:'pointer', textAlign:'left',
                borderLeft: theme === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              }}>
              <span style={{fontSize:18}}>{t.icon}</span>
              <div>
                <div style={{fontSize:13, fontWeight:600, color: theme===t.key ? 'var(--accent-text)' : 'var(--text)'}}>{t.label}</div>
                <div style={{fontSize:11, color:'var(--text3)'}}>{t.desc}</div>
              </div>
              {theme === t.key && <span style={{marginLeft:'auto', color:'var(--accent)', fontSize:14}}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Notifications Panel ───────────────────────────────────────────
function NotificationsPanel() {
  const [open, setOpen]       = useState(false)
  const [data, setData]       = useState<any[]>([])
  const [unread, setUnread]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [assignDrafts, setAssignDrafts] = useState<Record<string, { user_id: string; due_at: string }>>({})
  const panelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/notifications', {
        headers: { Accept: 'application/json' },
      })
      const contentType = r.headers.get('content-type') || ''
      const j = contentType.includes('application/json') ? await r.json() : null

      if (!r.ok) {
        throw new Error(j?.error || `Failed to load notifications (${r.status})`)
      }

      setData(j?.data || [])
      setUnread(j?.unread || 0)
    } catch (error) {
      console.error('Failed to load notifications', error)
      setData([])
      setUnread(0)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        const r = await fetch('/api/users', { headers: { Accept: 'application/json' } })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) return
        const list = Array.isArray(j?.data) ? j.data : []
        setUsers(list.filter((u: any) => u?.is_active !== false))
      } catch {
        setUsers([])
      }
    })()
  }, [open])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const markRead = async (keys: string[]) => {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    })
    setData(prev => prev.map(n => keys.includes(n.id) ? { ...n, is_read: true } : n))
    setUnread(prev => Math.max(0, prev - keys.length))
  }

  const markAll = async () => {
    setLoading(true)
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all: true }),
    })
    setData(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnread(0)
    setLoading(false)
  }

  const runWorkAction = async (n: any, action: 'accept' | 'reject' | 'assign' | 'done') => {
    const sourceType = String(n?.source_type || '')
    const sourceId = String(n?.source_id || '')
    if (sourceType !== 'work_suggestion' || !sourceId) return

    let body: any = { action }
    if (action === 'reject') {
      const reason = window.prompt('Ly do tu choi:')
      if (reason == null) return
      body.note = String(reason).trim()
    }
    if (action === 'assign') {
      const draft = assignDrafts[n.id] || { user_id: '', due_at: '' }
      if (!draft.user_id) {
        alert('Vui long chon nguoi duoc giao')
        return
      }
      body.assign_to = String(draft.user_id).trim()
      if (draft.due_at && String(draft.due_at).trim()) {
        body.due_at = new Date(String(draft.due_at)).toISOString()
      }
    }
    if (action === 'done') {
      // Done nhanh tu notifications: khong bat buoc note/popup
    }

    const r = await fetch(`/api/work-suggestions/${sourceId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      alert(j?.error || 'Thao tac that bai')
      return
    }
    await load()
  }

  const TYPE_ICON: Record<string,string> = { urgent:'🔴', reminder:'🔔', hot_lead:'🔥' }
  const TYPE_CLR:  Record<string,string> = { urgent:'var(--red)', reminder:'var(--accent)', hot_lead:'var(--yellow)' }

  return (
    <div style={{ position:'relative' }} ref={panelRef}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          position:'relative', width:36, height:36, borderRadius:8,
          border:'1px solid var(--border2)',
          background: open ? 'var(--surface2)' : 'var(--surface)',
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', fontSize:16, flexShrink:0,
        }}>
        🔔
        {unread > 0 && (
          <div style={{
            position:'absolute', top:-4, right:-4,
            minWidth:18, height:18, borderRadius:10, padding:'0 4px',
            background:'var(--red)', border:'2px solid var(--bg)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:9, fontWeight:800, color:'#fff',
            fontFamily:"'JetBrains Mono',monospace",
          }}>
            {unread > 9 ? '9+' : unread}
          </div>
        )}
      </button>

      {open && (
        <div style={{
          position:'absolute', top:44, right:0, width:390, zIndex:1000,
          background:'var(--surface)', border:'1px solid var(--border2)',
          borderRadius:13, overflow:'hidden', boxShadow:'var(--shadow-lg)',
          animation:'fadeUp .15s ease',
        }}>
          {/* Header */}
          <div style={{ padding:'13px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <span style={{fontSize:14, fontWeight:700, color:'var(--text)'}}>Nhắc nhở</span>
              {unread > 0 && (
                <span style={{fontSize:11, background:'rgba(239,68,68,0.15)', color:'var(--red)', padding:'1px 7px', borderRadius:5, fontWeight:700, fontFamily:"'JetBrains Mono',monospace"}}>
                  {unread} mới
                </span>
              )}
            </div>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              {unread > 0 && (
                <button onClick={markAll} disabled={loading}
                  style={{fontSize:11, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', padding:'2px 6px', borderRadius:4, fontWeight:600}}>
                  {loading ? '...' : 'Đọc tất cả'}
                </button>
              )}
              <button onClick={() => setOpen(false)}
                style={{background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:20, lineHeight:1, padding:'0 2px'}}>×</button>
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight:440, overflowY:'auto' }}>
            {data.length === 0 ? (
              <div style={{padding:'36px 18px', textAlign:'center', color:'var(--text3)', fontSize:13}}>
                <div style={{fontSize:32, marginBottom:10}}>✅</div>
                Không có nhắc nhở nào!
              </div>
            ) : (
              data.map((n, i) => (
                <Link key={n.id}
                  href={n.href || (n.customer_id ? `/customers/${n.customer_id}` : '/customers')}
                  onClick={() => { if (!n.is_read) markRead([n.id]); setOpen(false) }}
                  style={{ textDecoration:'none', display:'block' }}>
                  <div style={{
                    padding:'11px 16px',
                    borderBottom: i < data.length-1 ? '1px solid var(--border)' : 'none',
                    display:'flex', gap:11, alignItems:'flex-start',
                    cursor:'pointer',
                    background: n.is_read ? 'transparent' : 'rgba(249,115,22,0.04)',
                    position:'relative',
                  }} className="notif-row">
                    {/* Unread dot */}
                    {!n.is_read && (
                      <div style={{
                        position:'absolute', left:5, top:'50%', transform:'translateY(-50%)',
                        width:5, height:5, borderRadius:'50%', background:'var(--accent)',
                        flexShrink:0,
                      }} />
                    )}

                    {/* Icon */}
                    <div style={{
                      width:33, height:33, borderRadius:8, flexShrink:0,
                      background:`${TYPE_CLR[n.type]||'var(--accent)'}18`,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:15,
                      marginLeft: 6,
                      opacity: n.is_read ? 0.6 : 1,
                    }}>
                      {TYPE_ICON[n.type]||'🔔'}
                    </div>

                    {/* Content */}
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{
                        fontSize:12, fontWeight: n.is_read ? 500 : 700,
                        color: n.is_read ? 'var(--text2)' : 'var(--text)',
                        marginBottom:2,
                        display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:6,
                      }}>
                        <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                          {n.headline || n.customer?.full_name || n.customer?.phone_number || 'Thông báo'}
                        </span>
                        {n.days_ago !== null && (
                          <span style={{fontSize:10, color:'var(--text4)', fontFamily:"'JetBrains Mono',monospace", flexShrink:0}}>
                            {n.days_ago}d trước
                          </span>
                        )}
                      </div>
                      {n.source_label && (
                        <div style={{ fontSize:10, color:'var(--text4)', marginBottom:3, textTransform:'uppercase', letterSpacing:0.6 }}>
                          {n.source_label}
                          {n.project_name ? ` | ${n.project_name}` : ''}
                          {n.issue_code ? ` | ${n.issue_code}` : ''}
                        </div>
                      )}
                      <div style={{
                        fontSize:11, color: n.is_read ? 'var(--text3)' : 'var(--text2)',
                        lineHeight:1.5, overflow:'hidden', display:'-webkit-box',
                        WebkitLineClamp:2, WebkitBoxOrient:'vertical',
                      }}>
                        {n.body || n.next_action}
                      </div>
                      {n.ai_sentiment === 'Gay gắt' && !n.is_read && (
                        <div style={{fontSize:10, color:'var(--red)', marginTop:3, fontWeight:700}}>⚠ Cần xử lý gấp</div>
                      )}
                      {n.notif_status && (
                        <div style={{ fontSize:10, color:'var(--text4)', marginTop:3 }}>
                          Trang thai: <strong>{n.notif_status}</strong>
                        </div>
                      )}
                    </div>

                    {/* Lead score */}
                    {n.lead_score && (
                      <div style={{
                        flexShrink:0, fontFamily:"'JetBrains Mono',monospace",
                        fontSize:11, fontWeight:800, color:'var(--accent)',
                        background:'var(--accent-dim)', borderRadius:6, padding:'2px 8px',
                        opacity: n.is_read ? 0.5 : 1,
                      }}>
                        {n.lead_score}
                      </div>
                    )}

                    {/* Mark read button */}
                    {!n.is_read && (
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); markRead([n.id]) }}
                        title="Đánh dấu đã đọc"
                        style={{
                          flexShrink:0, background:'none', border:'1px solid var(--border2)',
                          borderRadius:5, color:'var(--text3)', cursor:'pointer',
                          fontSize:10, padding:'3px 7px', whiteSpace:'nowrap',
                        }}>
                        ✓ Đọc
                      </button>
                    )}
                    {n.source_type === 'work_suggestion' && ['pending', 'assigned'].includes(String(n.notif_status || '').toLowerCase()) && (
                      <div style={{ display:'flex', flexDirection:'column', gap:4, flexShrink:0 }}>
                        <button
                          onClick={e => { e.preventDefault(); e.stopPropagation(); runWorkAction(n, 'accept') }}
                          style={{ background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.35)', borderRadius:5, color:'var(--green)', cursor:'pointer', fontSize:10, padding:'3px 6px' }}>
                          Accept
                        </button>
                        <button
                          onClick={e => { e.preventDefault(); e.stopPropagation(); runWorkAction(n, 'reject') }}
                          style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.35)', borderRadius:5, color:'var(--red)', cursor:'pointer', fontSize:10, padding:'3px 6px' }}>
                          Reject
                        </button>
                        <button
                          onClick={e => { e.preventDefault(); e.stopPropagation(); runWorkAction(n, 'assign') }}
                          style={{ background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.35)', borderRadius:5, color:'var(--blue)', cursor:'pointer', fontSize:10, padding:'3px 6px' }}>
                          Assign
                        </button>
                        <select
                          value={(assignDrafts[n.id]?.user_id || '')}
                          onClick={e => { e.preventDefault(); e.stopPropagation() }}
                          onChange={e => {
                            const v = e.target.value
                            setAssignDrafts(prev => ({ ...prev, [n.id]: { user_id: v, due_at: prev[n.id]?.due_at || '' } }))
                          }}
                          style={{
                            background:'var(--surface2)',
                            border:'1px solid var(--border2)',
                            borderRadius:5,
                            color:'var(--text)',
                            fontSize:10,
                            padding:'3px 6px',
                            minWidth:140,
                          }}
                        >
                          <option value="">Chon nguoi</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {getUserDisplayName(u)} ({getUserRoleLabel(u)})
                            </option>
                          ))}
                        </select>
                        <input
                          type="datetime-local"
                          value={(assignDrafts[n.id]?.due_at || '')}
                          onClick={e => { e.preventDefault(); e.stopPropagation() }}
                          onChange={e => {
                            const v = e.target.value
                            setAssignDrafts(prev => ({ ...prev, [n.id]: { user_id: prev[n.id]?.user_id || '', due_at: v } }))
                          }}
                          style={{
                            background:'var(--surface2)',
                            border:'1px solid var(--border2)',
                            borderRadius:5,
                            color:'var(--text)',
                            fontSize:10,
                            padding:'3px 6px',
                          }}
                        />
                        <button
                          onClick={e => { e.preventDefault(); e.stopPropagation(); runWorkAction(n, 'done') }}
                          style={{ background:'rgba(168,85,247,0.12)', border:'1px solid rgba(168,85,247,0.35)', borderRadius:5, color:'#A855F7', cursor:'pointer', fontSize:10, padding:'3px 6px' }}>
                          Done
                        </button>
                      </div>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Footer */}
          {data.length > 0 && (
            <div style={{padding:'9px 16px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span style={{fontSize:11, color:'var(--text4)'}}>
                {data.filter(n=>n.is_read).length}/{data.length} đã đọc
              </span>
              <Link href="/my-profile"
                onClick={() => setOpen(false)}
                style={{fontSize:12, color:'var(--accent)', textDecoration:'none', fontWeight:600}}>
                Xem tất cả →
              </Link>
            </div>
          )}
        </div>
      )}

      <style>{`.notif-row:hover { background: var(--surface2) !important; }`}</style>
    </div>
  )
}

// ─── Topbar ────────────────────────────────────────────────────────
export default function Topbar() {
  const { sidebarOpen, toggleSidebar, isMobile } = useLayout()
  const showHamburger = isMobile || !sidebarOpen

  return (
    <div className="topbar-el" style={{
      position:'fixed', top:0,
      left: (!isMobile && sidebarOpen) ? 220 : 0,
      right:0, zIndex:50,
      height:56,
      background:'color-mix(in srgb, var(--bg) 90%, transparent)',
      backdropFilter:'blur(12px)',
      borderBottom:'1px solid var(--border)',
      display:'flex', alignItems:'center',
      padding:'0 20px', gap:12,
      transition:'left .25s cubic-bezier(.4,0,.2,1)',
    }}>
      {/* Hamburger / open sidebar */}
      <button onClick={toggleSidebar}
        title={sidebarOpen ? 'Đóng sidebar' : 'Mở sidebar'}
        style={{
          width:34, height:34, borderRadius:7,
          border:'1px solid var(--border2)',
          background: 'var(--surface)',
          color:'var(--text2)', cursor:'pointer', fontSize:14,
          display:'flex', alignItems:'center', justifyContent:'center',
          flexShrink:0,
        }}>
        {sidebarOpen && !isMobile ? '☰' : '☰'}
      </button>

      <div style={{flex:1}} />
      <GlobalSearch />
      <ThemeSwitcher />
      <NotificationsPanel />
    </div>
  )
}
