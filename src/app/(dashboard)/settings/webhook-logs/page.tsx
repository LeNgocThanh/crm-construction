'use client'
// src/app/(dashboard)/settings/webhook-logs/page.tsx
// Real-time webhook log viewer + debug tools

import { useState, useEffect, useRef, useCallback } from 'react'

interface Log {
  id: string; channel: string; direction: 'in'|'out'; event_type: string|null
  chat_id: string|null; content: string|null; status: string
  error: string|null; duration_ms: number|null; created_at: string
}

const STATUS_COLOR: Record<string,string> = {
  ok:       'var(--green)',
  error:    'var(--red)',
  rejected: 'var(--yellow)',
  dedup:    'var(--text4)',
}
const DIR_COLOR: Record<string,string> = {
  in:  '#26A5E4',
  out: '#F59E0B',
}

function fmtTime(s: string) {
  const d = new Date(s)
  return d.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
}
function fmtMs(ms: number|null) {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms/1000).toFixed(1)}s`
}

export default function WebhookLogsPage() {
  const [logs,      setLogs]      = useState<Log[]>([])
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState<any>(null)   // full log with raw
  const [rawLoading,setRawLoading]= useState(false)
  const [autoRefresh,setAutoRefresh] = useState(true)
  const [filterCh,  setFilterCh]  = useState('')
  const [filterSt,  setFilterSt]  = useState('')
  const [filterDir, setFilterDir] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null)

  const load = useCallback(async () => {
    const q = new URLSearchParams({ limit:'120' })
    if (filterCh)  q.set('channel',   filterCh)
    if (filterSt)  q.set('status',    filterSt)
    if (filterDir) q.set('direction', filterDir)
    const r = await fetch(`/api/webhook-logs?${q}`)
    const j = await r.json()
    setLogs(j.data || [])
    setLoading(false)
  }, [filterCh, filterSt, filterDir])

  useEffect(() => { load() }, [load])

  // Auto-refresh mỗi 2.5 giây
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoRefresh) {
      timerRef.current = setInterval(load, 2500)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [autoRefresh, load])

  const showRaw = async (log: Log) => {
    setRawLoading(true)
    const r = await fetch('/api/webhook-logs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_raw', id: log.id }),
    })
    const j = await r.json()
    setSelected(j.data)
    setRawLoading(false)
  }

  // Stats từ logs hiện tại (24h)
  const statsMap: Record<string,number> = {}
  for (const l of logs) statsMap[l.status] = (statsMap[l.status]||0) + 1
  const inCount  = logs.filter(l=>l.direction==='in').length
  const outCount = logs.filter(l=>l.direction==='out').length
  const errCount = logs.filter(l=>l.status==='error').length

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:'var(--text)',marginBottom:4}}>📡 Webhook Logs</h1>
          <div style={{fontSize:13,color:'var(--text3)'}}>
            Tất cả request vào/ra — cập nhật mỗi 2.5 giây
          </div>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text3)',cursor:'pointer'}}>
            <div onClick={()=>setAutoRefresh(!autoRefresh)}
              style={{width:36,height:20,borderRadius:10,background:autoRefresh?'var(--green)':'var(--surface3)',position:'relative',cursor:'pointer',transition:'all .2s'}}>
              <div style={{position:'absolute',top:2,left:autoRefresh?17:2,width:14,height:14,borderRadius:'50%',background:'white',transition:'left .2s'}}/>
            </div>
            {autoRefresh ? '🔴 Live' : 'Paused'}
          </label>
          <button onClick={load}
            style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text2)',padding:'7px 14px',borderRadius:8,cursor:'pointer',fontSize:12}}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
        {[
          {label:'Tổng (hiển thị)', val:logs.length,   color:'var(--text)'},
          {label:'Nhận vào',        val:inCount,        color:'#26A5E4'},
          {label:'Gửi ra',          val:outCount,       color:'#F59E0B'},
          {label:'Lỗi',             val:errCount,       color:'var(--red)'},
        ].map(s=>(
          <div key={s.label} className="card" style={{padding:'12px 16px'}}>
            <div style={{fontSize:22,fontWeight:800,color:s.color}}>{s.val}</div>
            <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:9,marginBottom:14,flexWrap:'wrap'}}>
        <select value={filterCh} onChange={e=>setFilterCh(e.target.value)}
          style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:7,padding:'7px 12px',color:'var(--text)',fontSize:12}}>
          <option value="">Tất cả channel</option>
          <option value="telegram">✈️ Telegram</option>
          <option value="zalo">💙 Zalo</option>
          <option value="messenger">🟠 Messenger</option>
        </select>
        <select value={filterDir} onChange={e=>setFilterDir(e.target.value)}
          style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:7,padding:'7px 12px',color:'var(--text)',fontSize:12}}>
          <option value="">In + Out</option>
          <option value="in">⬇ Nhận vào</option>
          <option value="out">⬆ Gửi ra</option>
        </select>
        <select value={filterSt} onChange={e=>setFilterSt(e.target.value)}
          style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:7,padding:'7px 12px',color:'var(--text)',fontSize:12}}>
          <option value="">Tất cả status</option>
          <option value="ok">✅ OK</option>
          <option value="error">❌ Error</option>
          <option value="rejected">⚠ Rejected</option>
          <option value="dedup">🔁 Dedup</option>
        </select>
        {(filterCh||filterDir||filterSt)&&(
          <button onClick={()=>{setFilterCh('');setFilterDir('');setFilterSt('')}}
            style={{background:'transparent',border:'1px solid var(--border)',color:'var(--text3)',padding:'7px 12px',borderRadius:7,cursor:'pointer',fontSize:12}}>
            ✕ Reset
          </button>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:selected?'1fr 360px':'1fr',gap:14}}>
        {/* Log table */}
        <div className="card" style={{overflow:'hidden',padding:0}}>
          {loading ? (
            <div style={{padding:40,textAlign:'center',color:'var(--text3)'}}>
              <span className="spinner" style={{width:24,height:24}}/>
            </div>
          ) : logs.length === 0 ? (
            <div style={{padding:40,textAlign:'center'}}>
              <div style={{fontSize:32,marginBottom:10}}>📭</div>
              <div style={{fontSize:14,color:'var(--text3)',marginBottom:6}}>Chưa có log nào</div>
              <div style={{fontSize:12,color:'var(--text4)'}}>
                Nhắn tin vào Telegram bot của bạn để test webhook
              </div>
            </div>
          ) : (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:'var(--surface2)'}}>
                    {['Thời gian','Dir','Channel','Event','Chat ID','Nội dung','Status','ms'].map(h=>(
                      <th key={h} style={{padding:'8px 12px',fontSize:10,letterSpacing:'1.5px',color:'var(--text4)',fontWeight:700,textAlign:'left',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log,i)=>(
                    <tr key={log.id}
                      onClick={()=>showRaw(log)}
                      style={{borderBottom:i<logs.length-1?'1px solid var(--border)':'none',cursor:'pointer',background:selected?.id===log.id?'var(--surface2)':'transparent'}}
                      onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background='var(--surface2)'}
                      onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background=selected?.id===log.id?'var(--surface2)':'transparent'}>
                      <td style={{padding:'8px 12px',fontSize:11,color:'var(--text4)',whiteSpace:'nowrap',fontFamily:'monospace'}}>
                        {fmtTime(log.created_at)}
                      </td>
                      <td style={{padding:'8px 12px'}}>
                        <span style={{fontSize:11,fontWeight:700,color:DIR_COLOR[log.direction]||'var(--text3)'}}>
                          {log.direction==='in'?'⬇ IN':'⬆ OUT'}
                        </span>
                      </td>
                      <td style={{padding:'8px 12px',fontSize:11,color:'var(--text2)',whiteSpace:'nowrap'}}>
                        {log.channel==='telegram'?'✈️':log.channel==='zalo'?'💙':'🟠'} {log.channel}
                      </td>
                      <td style={{padding:'8px 12px',fontSize:11,color:'var(--text3)',fontFamily:'monospace',whiteSpace:'nowrap'}}>
                        {log.event_type||'—'}
                      </td>
                      <td style={{padding:'8px 12px',fontSize:11,color:'var(--text3)',fontFamily:'monospace'}}>
                        {log.chat_id||'—'}
                      </td>
                      <td style={{padding:'8px 12px',fontSize:12,color:'var(--text)',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {log.content||'—'}
                      </td>
                      <td style={{padding:'8px 12px'}}>
                        <span style={{fontSize:11,fontWeight:700,color:STATUS_COLOR[log.status]||'var(--text3)'}}>
                          {log.status==='ok'?'✅':log.status==='error'?'❌':log.status==='rejected'?'⚠️':'🔁'} {log.status}
                        </span>
                        {log.error&&<div style={{fontSize:10,color:'var(--red)',marginTop:1,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.error}</div>}
                      </td>
                      <td style={{padding:'8px 12px',fontSize:11,color:'var(--text4)',whiteSpace:'nowrap',textAlign:'right'}}>
                        {fmtMs(log.duration_ms)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="card" style={{padding:0,overflow:'hidden',height:'fit-content',maxHeight:'calc(100vh - 200px)',overflowY:'auto'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>Raw Payload</span>
              <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',color:'var(--text4)',cursor:'pointer',fontSize:18}}>✕</button>
            </div>
            {rawLoading ? (
              <div style={{padding:24,textAlign:'center'}}><span className="spinner" style={{width:20,height:20}}/></div>
            ) : (
              <div style={{padding:'12px 14px'}}>
                {/* Meta */}
                <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:14}}>
                  {[
                    ['Status',    selected.status],
                    ['Direction', selected.direction],
                    ['Channel',   selected.channel],
                    ['Event',     selected.event_type],
                    ['Chat ID',   selected.chat_id],
                    ['Duration',  fmtMs(selected.duration_ms)],
                    ['Time',      new Date(selected.created_at).toLocaleString('vi-VN')],
                  ].map(([k,v])=>(
                    <div key={k} style={{display:'flex',gap:8,fontSize:12}}>
                      <span style={{color:'var(--text4)',minWidth:70,fontWeight:600}}>{k}</span>
                      <span style={{color:'var(--text)',fontFamily:'monospace',wordBreak:'break-all'}}>{v||'—'}</span>
                    </div>
                  ))}
                  {selected.error&&(
                    <div style={{padding:'7px 10px',background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.2)',borderRadius:6,fontSize:12,color:'var(--red)'}}>
                      ❌ {selected.error}
                    </div>
                  )}
                </div>

                {/* Content */}
                {selected.content&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:10,letterSpacing:'1.5px',color:'var(--text4)',fontWeight:700,marginBottom:6}}>CONTENT</div>
                    <div style={{fontSize:12,color:'var(--text)',background:'var(--surface2)',padding:'8px 10px',borderRadius:7}}>{selected.content}</div>
                  </div>
                )}

                {/* Raw JSON */}
                {selected.raw&&(
                  <div>
                    <div style={{fontSize:10,letterSpacing:'1.5px',color:'var(--text4)',fontWeight:700,marginBottom:6}}>RAW PAYLOAD</div>
                    <pre style={{fontSize:10,color:'var(--text2)',background:'var(--surface2)',padding:'10px 12px',borderRadius:7,overflow:'auto',maxHeight:400,margin:0,lineHeight:1.6,fontFamily:"'JetBrains Mono',monospace"}}>
                      {JSON.stringify(selected.raw, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Guide nếu chưa có log nào từ Telegram */}
      {!loading && logs.filter(l=>l.channel==='telegram').length === 0 && (
        <div style={{marginTop:16,padding:'14px 18px',background:'rgba(38,165,228,.06)',border:'1px solid rgba(38,165,228,.2)',borderRadius:10}}>
          <div style={{fontSize:13,fontWeight:700,color:'#26A5E4',marginBottom:10}}>
            ✈️ Chưa có log Telegram — Kiểm tra theo thứ tự:
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:7,fontSize:12,color:'var(--text2)',lineHeight:1.7}}>
            <div><strong>1.</strong> Chạy lệnh trong terminal: <code style={{background:'var(--surface3)',padding:'1px 7px',borderRadius:4}}>cloudflared tunnel run --url http://localhost:3000 crm-construction</code></div>
            <div><strong>2.</strong> Đảm bảo <code style={{background:'var(--surface3)',padding:'1px 7px',borderRadius:4}}>NEXTAUTH_URL</code> trong .env.local đúng với URL tunnel</div>
            <div><strong>3.</strong> Kiểm tra webhook đã đăng ký: <a href="/api/webhook/telegram" target="_blank" style={{color:'#26A5E4'}}>GET /api/webhook/telegram</a> → xem <code>webhook.url</code></div>
            <div><strong>4.</strong> Tắt <code style={{background:'var(--surface3)',padding:'1px 7px',borderRadius:4}}>BOT_MOCK_MODE=false</code> rồi restart server</div>
            <div><strong>5.</strong> Nhắn tin vào bot → trang này tự cập nhật sau 2.5 giây</div>
            <div style={{marginTop:4,padding:'8px 12px',background:'var(--surface2)',borderRadius:7}}>
              <strong>Nếu không thấy log:</strong> Webhook chưa tới server → kiểm tra tunnel đang chạy + URL đúng
              <br/><strong>Nếu thấy log "rejected":</strong> Secret token không khớp → kiểm tra <code>TELEGRAM_WEBHOOK_SECRET</code>
              <br/><strong>Nếu thấy log "error":</strong> Xem cột raw để biết lỗi cụ thể
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
