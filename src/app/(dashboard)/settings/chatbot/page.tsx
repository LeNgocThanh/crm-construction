'use client'
// src/app/(dashboard)/settings/chatbot/page.tsx — V2.5: config + webhook setup tab

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

const CH_COLOR: Record<string,string> = { zalo:'#0068FF', messenger:'#FF5722', telegram:'#26A5E4' }
const CH_ICON:  Record<string,string> = { zalo:'💙', messenger:'🟠', telegram:'✈️' }
const CH_NAME:  Record<string,string> = { zalo:'Zalo OA', messenger:'Messenger', telegram:'Telegram Bot' }

type Tab = 'config' | 'connect'
type Channel = 'zalo' | 'messenger' | 'telegram'

// ─── Connect Tab ─────────────────────────────────────────────────────────────
function ConnectTab() {
  const { data: session } = useSession()
  const roleKeys = session?.user?.role_keys || (session?.user?.role ? [session.user.role] : [])
  const [status,    setStatus]   = useState<any>(null)
  const [loading,   setLoading]  = useState(true)
  const [publicUrl, setPublicUrl] = useState('')
  const [tgLoading, setTgLoading] = useState(false)
  const [tgMsg,     setTgMsg]    = useState('')

  const canEdit = roleKeys.some((x) => ['admin', 'manager'].includes(x))

  const loadStatus = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/webhook/status')
    const j = await r.json()
    setStatus(j.data)
    if (j.data?.app_url && !j.data.app_url.includes('localhost')) {
      setPublicUrl(j.data.app_url)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  const setupTelegram = async () => {
    if (!publicUrl.startsWith('https')) {
      setTgMsg('❌ URL phải bắt đầu bằng https://')
      return
    }
    setTgLoading(true); setTgMsg('')
    const r = await fetch('/api/webhook/status', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'setup_telegram', public_url: publicUrl.replace(/\/$/, '') }),
    })
    const j = await r.json()
    setTgMsg(j.success ? `✅ ${j.message} — URL: ${j.webhook_url}` : `❌ ${j.error}`)
    setTgLoading(false)
    if (j.success) setTimeout(loadStatus, 1000)
  }

  const deleteTelegramWebhook = async () => {
    setTgLoading(true)
    const r = await fetch('/api/webhook/status', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'delete_telegram_webhook' }),
    })
    const j = await r.json()
    setTgMsg(j.success ? '✅ Đã xóa webhook' : `❌ ${j.error}`)
    setTgLoading(false)
    setTimeout(loadStatus, 1000)
  }

  if (loading) return <div style={{textAlign:'center',padding:40,color:'var(--text3)'}}>Đang kiểm tra kết nối...</div>

  const mockMode   = status?.mock_mode
  const appUrl     = status?.app_url || ''
  const isLocalhost = appUrl.includes('localhost') || appUrl.includes('127.0.0.1')

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Mock mode banner */}
      {mockMode && (
        <div style={{padding:'12px 16px',background:'rgba(234,179,8,0.07)',border:'1.5px solid rgba(234,179,8,0.3)',borderRadius:10}}>
          <div style={{fontWeight:700,fontSize:13,color:'var(--yellow)',marginBottom:4}}>⚠️ BOT_MOCK_MODE = true</div>
          <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.6}}>
            Bot đang ở chế độ giả lập — tin nhắn chỉ log ra console, không gửi/nhận thật.
            Để kết nối thật, tắt <code style={{background:'var(--surface3)',padding:'1px 6px',borderRadius:4}}>BOT_MOCK_MODE</code> trong <code style={{background:'var(--surface3)',padding:'1px 6px',borderRadius:4}}>.env.local</code> sau khi setup xong.
          </div>
        </div>
      )}

      {/* Domain setup guide */}
      <div className="card" style={{padding:20}}>
        <div style={{fontSize:11,letterSpacing:'1.5px',color:'var(--text4)',fontWeight:700,marginBottom:14}}>🌐 BƯỚC 1 — CÓ DOMAIN HTTPS PUBLIC</div>
        <div style={{fontSize:13,color:'var(--text2)',marginBottom:14}}>
          Zalo, Messenger, Telegram đều yêu cầu URL HTTPS để đăng ký webhook.
          Hiện tại app đang chạy tại: <code style={{background:'var(--surface3)',padding:'2px 8px',borderRadius:5,color:'var(--accent)'}}>{appUrl}</code>
          {isLocalhost && <span style={{color:'var(--red)',marginLeft:8}}>⚠️ Localhost không dùng được</span>}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
          {/* Cloudflare Tunnel */}
          <div style={{padding:14,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10}}>
            <div style={{fontWeight:700,fontSize:13,color:'var(--text)',marginBottom:4}}>☁️ Cloudflare Tunnel</div>
            <div style={{fontSize:11,color:'var(--green)',marginBottom:8,fontWeight:600}}>✅ Khuyên dùng — Miễn phí, domain cố định</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,background:'var(--surface3)',borderRadius:7,padding:'10px 12px',lineHeight:2.2,color:'var(--text2)'}}>
              <div style={{color:'var(--text4)'}}># Cài cloudflared</div>
              <div>winget install Cloudflare.cloudflared</div>
              <div style={{color:'var(--text4)',marginTop:4}}># Đăng nhập</div>
              <div>cloudflared tunnel login</div>
              <div style={{color:'var(--text4)',marginTop:4}}># Tạo tunnel</div>
              <div>cloudflared tunnel create crm-bot</div>
              <div style={{color:'var(--text4)',marginTop:4}}># Chạy</div>
              <div>cloudflared tunnel run --url http://localhost:3000 crm-bot</div>
            </div>
            <div style={{fontSize:11,color:'var(--text4)',marginTop:8}}>
              → Nhận được URL dạng <code>https://xxx.cfargotunnel.com</code>
            </div>
          </div>

          {/* ngrok */}
          <div style={{padding:14,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10}}>
            <div style={{fontWeight:700,fontSize:13,color:'var(--text)',marginBottom:4}}>🔌 ngrok</div>
            <div style={{fontSize:11,color:'var(--yellow)',marginBottom:8,fontWeight:600}}>⚡ Nhanh nhất — URL thay đổi mỗi lần restart</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,background:'var(--surface3)',borderRadius:7,padding:'10px 12px',lineHeight:2.2,color:'var(--text2)'}}>
              <div style={{color:'var(--text4)'}}># Cài ngrok</div>
              <div>winget install ngrok.ngrok</div>
              <div style={{color:'var(--text4)',marginTop:4}}># Đăng nhập (lấy token tại ngrok.com)</div>
              <div>ngrok config add-authtoken YOUR_TOKEN</div>
              <div style={{color:'var(--text4)',marginTop:4}}># Chạy</div>
              <div>ngrok http 3000</div>
            </div>
            <div style={{fontSize:11,color:'var(--text4)',marginTop:8}}>
              → Nhận URL từ terminal, dán vào ô bên dưới
            </div>
          </div>

          {/* VPS */}
          <div style={{padding:14,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10}}>
            <div style={{fontWeight:700,fontSize:13,color:'var(--text)',marginBottom:4}}>🖥️ VPS Production</div>
            <div style={{fontSize:11,color:'var(--blue)',marginBottom:8,fontWeight:600}}>🚀 Production — Domain thật, ~$5-10/tháng</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,background:'var(--surface3)',borderRadius:7,padding:'10px 12px',lineHeight:2.2,color:'var(--text2)'}}>
              <div style={{color:'var(--text4)'}}># Upload code lên VPS</div>
              <div>git push origin main</div>
              <div style={{color:'var(--text4)',marginTop:4}}># Build và chạy</div>
              <div>npm run build</div>
              <div>pm2 start npm -- start</div>
              <div style={{color:'var(--text4)',marginTop:4}}># Nginx reverse proxy</div>
              <div>{'proxy_pass http://localhost:3000;'}</div>
            </div>
            <div style={{fontSize:11,color:'var(--text4)',marginTop:8}}>
              → Trỏ domain vào IP VPS + SSL Let's Encrypt
            </div>
          </div>
        </div>

        {/* Public URL input */}
        <div style={{marginTop:16,padding:'14px 16px',background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:9}}>
          <div style={{fontSize:12,color:'var(--text3)',marginBottom:8,fontWeight:600}}>URL Public của bạn (dán vào đây sau khi có):</div>
          <div style={{display:'flex',gap:8}}>
            <input value={publicUrl} onChange={e=>setPublicUrl(e.target.value.trim())}
              placeholder="https://xxx.cfargotunnel.com"
              style={{flex:1,background:'var(--surface)',border:'1px solid var(--border2)',borderRadius:8,padding:'9px 12px',color:'var(--text)',fontSize:13,fontFamily:'monospace'}}
            />
          </div>
          {publicUrl && !publicUrl.startsWith('https') && (
            <div style={{fontSize:11,color:'var(--red)',marginTop:4}}>⚠️ Phải bắt đầu bằng https://</div>
          )}
        </div>
      </div>

      {/* Zalo */}
      <PlatformCard
        channel="zalo"
        connStatus={status?.zalo}
        webhookUrl={publicUrl ? `${publicUrl}/api/webhook/zalo` : null}
        steps={[
          { n:'1', title:'Tạo Zalo Official Account', desc:'Vào', link:'https://oa.zalo.me', linkText:'oa.zalo.me', suffix:'→ Tạo OA → chờ duyệt (1-3 ngày)' },
          { n:'2', title:'Tạo Zalo App', desc:'Vào', link:'https://developers.zalo.me/app', linkText:'developers.zalo.me', suffix:'→ Tạo App → vào App Settings' },
          { n:'3', title:'Đăng ký Webhook', desc:'App Settings → Official Account → Webhook URL → điền URL bên dưới → Verify' },
          { n:'4', title:'Lấy credentials', desc:'App Settings → App Info → copy App Secret. OA Management → Official Account API → copy Access Token' },
          { n:'5', title:'Cập nhật .env.local', desc:null, code:[
            'ZALO_OA_ACCESS_TOKEN="oatoken_xxx"',
            'ZALO_APP_SECRET="appsecret_xxx"',
            'BOT_MOCK_MODE=false',
          ]},
        ]}
      />

      {/* Messenger */}
      <PlatformCard
        channel="messenger"
        connStatus={status?.messenger}
        webhookUrl={publicUrl ? `${publicUrl}/api/webhook/messenger` : null}
        steps={[
          { n:'1', title:'Tạo Facebook App', desc:'Vào', link:'https://developers.facebook.com/apps', linkText:'developers.facebook.com/apps', suffix:'→ Create App → Business' },
          { n:'2', title:'Thêm Messenger product', desc:'App Dashboard → Add Product → Messenger → Settings' },
          { n:'3', title:'Đăng ký Webhook', desc:'Messenger Settings → Webhooks → Add Callback URL → điền URL bên dưới. Verify token:', code:['MESSENGER_VERIFY_TOKEN="crm-verify-token-2026"']},
          { n:'4', title:'Subscribe events', desc:'Webhooks → chọn Page → Subscribe fields: messages, messaging_echoes, messaging_postbacks' },
          { n:'5', title:'Lấy Page Access Token', desc:'Messenger Settings → Access Tokens → Generate Token cho Page của bạn' },
          { n:'6', title:'Cập nhật .env.local', desc:null, code:[
            'MESSENGER_PAGE_ACCESS_TOKEN="EAAxxxxx"',
            'MESSENGER_APP_SECRET="appsecret_xxx"',
            'MESSENGER_VERIFY_TOKEN="crm-verify-token-2026"',
            'BOT_MOCK_MODE=false',
          ]},
        ]}
      />

      {/* Telegram */}
      <PlatformCard
        channel="telegram"
        connStatus={status?.telegram}
        webhookUrl={publicUrl ? `${publicUrl}/api/webhook/telegram` : null}
        steps={[
          { n:'1', title:'Tạo Telegram Bot', desc:'Mở Telegram → nhắn @BotFather → /newbot → đặt tên → lấy token' },
          { n:'2', title:'Cập nhật .env.local', desc:null, code:[
            'TELEGRAM_BOT_TOKEN="1234567890:AAH_xxxx"',
            'TELEGRAM_WEBHOOK_SECRET="crm-tg-secret-2026"',
          ]},
          { n:'3', title:'Điền Public URL ở trên', desc:'Sau đó bấm nút "Đăng ký Webhook Tự Động" bên dưới' },
        ]}
        extra={
          canEdit ? (
            <div style={{padding:'14px 16px',background:'var(--surface2)',border:'1px solid rgba(38,165,228,.2)',borderRadius:9,marginTop:8}}>
              <div style={{fontWeight:700,fontSize:12,color:'#26A5E4',marginBottom:10}}>🤖 Đăng ký Telegram Webhook tự động</div>
              {status?.telegram?.webhook_set ? (
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:12,color:'var(--green)',marginBottom:6}}>
                    ✅ Webhook đã đăng ký: <code style={{fontSize:11,color:'var(--text3)'}}>{status.telegram.webhook_url}</code>
                  </div>
                  {status.telegram.last_error && (
                    <div style={{fontSize:11,color:'var(--red)',marginBottom:6}}>❌ Lỗi gần nhất: {status.telegram.last_error}</div>
                  )}
                  <div style={{fontSize:11,color:'var(--text4)'}}>Pending updates: {status.telegram.pending_updates}</div>
                </div>
              ) : (
                <div style={{fontSize:12,color:'var(--text3)',marginBottom:8}}>Chưa đăng ký webhook — nhấn nút bên dưới sau khi điền Public URL</div>
              )}
              <div style={{display:'flex',gap:8}}>
                <button onClick={setupTelegram} disabled={tgLoading || !publicUrl}
                  style={{background:publicUrl?'#26A5E4':'var(--surface3)',border:'none',color:'white',padding:'8px 18px',borderRadius:7,cursor:publicUrl?'pointer':'not-allowed',fontSize:12,fontWeight:700,opacity:tgLoading ? 0.7 : 1}}>
                  {tgLoading ? '⏳ Đang đăng ký...' : '✈️ Đăng ký Webhook Tự Động'}
                </button>
                {status?.telegram?.webhook_set && (
                  <button onClick={deleteTelegramWebhook} disabled={tgLoading}
                    style={{background:'transparent',border:'1px solid var(--border)',color:'var(--red)',padding:'8px 14px',borderRadius:7,cursor:'pointer',fontSize:12}}>
                    🗑 Xóa Webhook
                  </button>
                )}
                <button onClick={loadStatus}
                  style={{background:'transparent',border:'1px solid var(--border)',color:'var(--text3)',padding:'8px 14px',borderRadius:7,cursor:'pointer',fontSize:12}}>
                  🔄 Refresh
                </button>
              </div>
              {tgMsg && <div style={{marginTop:8,fontSize:12,color:tgMsg.startsWith('✅')?'var(--green)':'var(--red)'}}>{tgMsg}</div>}
            </div>
          ) : null
        }
      />

      {/* Final reminder */}
      <div style={{padding:'12px 16px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:9,fontSize:12,color:'var(--text3)',lineHeight:1.8}}>
        <strong style={{color:'var(--text)'}}>🔑 Sau khi setup xong:</strong>
        <div style={{marginTop:4}}>1. Tắt <code style={{background:'var(--surface3)',padding:'1px 5px',borderRadius:4}}>BOT_MOCK_MODE=true</code> trong .env.local</div>
        <div>2. Khởi động lại server: <code style={{background:'var(--surface3)',padding:'1px 5px',borderRadius:4}}>npm run dev</code></div>
        <div>3. Bật chatbot trong tab Cấu hình</div>
        <div>4. Test bằng cách nhắn tin vào OA/Page/Bot của bạn → kiểm tra tab Conversations</div>
      </div>
    </div>
  )
}

// ─── Platform Card component ─────────────────────────────────────────────────
function PlatformCard({channel, connStatus, webhookUrl, steps, extra}: {
  channel:   Channel
  connStatus:any
  webhookUrl:string|null
  steps:     {n:string;title:string;desc:string|null;link?:string;linkText?:string;suffix?:string;code?:string[]}[]
  extra?:    React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const color  = CH_COLOR[channel]
  const isConn = connStatus?.connected

  return (
    <div className="card" style={{padding:0,overflow:'hidden',border:`1px solid ${isConn?`${color}40`:'var(--border)'}`,background:isConn?`${color}05`:'var(--surface)'}}>
      {/* Header */}
      <div onClick={()=>setOpen(!open)} style={{padding:'14px 18px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <span style={{fontSize:24}}>{CH_ICON[channel]}</span>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:'var(--text)'}}>{CH_NAME[channel]}</div>
            {isConn ? (
              <div style={{fontSize:11,color:'var(--green)',marginTop:1}}>
                ● Đã kết nối — {connStatus.name}{connStatus.username?` (@${connStatus.username})`:''}
              </div>
            ) : (
              <div style={{fontSize:11,color:'var(--red)',marginTop:1}}>
                ○ Chưa kết nối{connStatus?.error?` — ${connStatus.error}`:''}
              </div>
            )}
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {webhookUrl && (
            <div style={{fontFamily:'monospace',fontSize:10,color:'var(--text4)',background:'var(--surface3)',padding:'4px 10px',borderRadius:6,maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {webhookUrl}
            </div>
          )}
          <span style={{color:'var(--text4)',fontSize:16,transition:'transform .2s',transform:open?'rotate(90deg)':'none'}}>›</span>
        </div>
      </div>

      {/* Expanded steps */}
      {open && (
        <div style={{padding:'0 18px 18px',borderTop:'1px solid var(--border)'}}>
          <div style={{fontSize:10,letterSpacing:'1.5px',color:'var(--text4)',fontWeight:700,margin:'14px 0 10px'}}>HƯỚNG DẪN KẾT NỐI</div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {steps.map(step => (
              <div key={step.n} style={{display:'flex',gap:12}}>
                <div style={{width:24,height:24,borderRadius:'50%',background:`${color}20`,color:color,fontSize:11,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}>{step.n}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:3}}>{step.title}</div>
                  {step.desc && (
                    <div style={{fontSize:12,color:'var(--text3)',lineHeight:1.5}}>
                      {step.desc}
                      {step.link&&<> <a href={step.link} target="_blank" rel="noopener" style={{color:color}}>{step.linkText}</a></>}
                      {step.suffix&&<> {step.suffix}</>}
                    </div>
                  )}
                  {step.code && (
                    <div style={{fontFamily:'monospace',fontSize:11,background:'var(--surface3)',borderRadius:7,padding:'9px 12px',marginTop:6,lineHeight:2,color:'var(--text2)'}}>
                      {step.code.map((l,i)=><div key={i}>{l}</div>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Webhook URL highlight */}
          {webhookUrl && (
            <div style={{marginTop:14,padding:'11px 14px',background:`${color}08`,border:`1px solid ${color}25`,borderRadius:8}}>
              <div style={{fontSize:10,color:color,fontWeight:700,letterSpacing:'1px',marginBottom:5}}>WEBHOOK URL CHO {channel.toUpperCase()}</div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <code style={{fontSize:12,color:'var(--text)',flex:1,wordBreak:'break-all'}}>{webhookUrl}</code>
                <button onClick={()=>navigator.clipboard.writeText(webhookUrl)}
                  style={{background:`${color}15`,border:`1px solid ${color}30`,color:color,padding:'5px 12px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600,flexShrink:0}}>
                  Copy
                </button>
              </div>
            </div>
          )}

          {extra}
        </div>
      )}
    </div>
  )
}

// ─── Config Tab (giữ nguyên logic cũ, nâng cấp style) ────────────────────────
function ConfigTab() {
  const [configs, setConfigs] = useState<Record<string,any>>({})
  const [active,  setActive]  = useState<Channel>('zalo')
  const [saving,  setSaving]  = useState(false)
  const [toast,   setToast]   = useState('')
  const [loading, setLoading] = useState(true)
  const [newKw,   setNewKw]   = useState('')

  useEffect(() => {
    fetch('/api/bot-config').then(r=>r.json()).then(j=>{
      const map:Record<string,any>={}
      for(const c of j.data||[]) map[c.channel]=c
      setConfigs(map); setLoading(false)
    })
  }, [])

  const cfg = configs[active] || {}
  const set = (k:string,v:any) => setConfigs(p=>({...p,[active]:{...p[active],[k]:v}}))

  const save = async () => {
    setSaving(true)
    const r = await fetch('/api/bot-config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel:active,...cfg})})
    if(r.ok){setToast(`✅ Đã lưu ${CH_NAME[active]}`);setTimeout(()=>setToast(''),3000)}
    setSaving(false)
  }

  if(loading) return <div style={{textAlign:'center',padding:40,color:'var(--text3)'}}>Đang tải...</div>

  const inp = (label:string, key:string, opts?:{type?:string;min?:number;max?:number;suffix?:string}) => (
    <div style={{marginBottom:14}}>
      <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:5}}>{label}</label>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <input type={opts?.type||'text'} min={opts?.min} max={opts?.max} value={cfg[key]||''}
          onChange={e=>set(key, opts?.type==='number'?parseInt(e.target.value):e.target.value)}
          style={{width:opts?.type==='number'?80:'100%',background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:7,padding:'8px 10px',color:'var(--text)',fontSize:13}}/>
        {opts?.suffix&&<span style={{fontSize:12,color:'var(--text4)'}}>{opts.suffix}</span>}
      </div>
    </div>
  )

  return (
    <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:20}}>
      {/* Channel selector */}
      <div>
        {(['zalo','messenger','telegram'] as Channel[]).map(ch=>(
          <button key={ch} onClick={()=>setActive(ch)}
            style={{width:'100%',padding:'12px 14px',borderRadius:10,cursor:'pointer',textAlign:'left',marginBottom:8,display:'flex',alignItems:'center',gap:10,
              background:active===ch?`${CH_COLOR[ch]}15`:'var(--surface2)',
              border:`1px solid ${active===ch?CH_COLOR[ch]+'50':'var(--border)'}`,
              color:'var(--text)'}}>
            <span style={{fontSize:20}}>{CH_ICON[ch]}</span>
            <div>
              <div style={{fontWeight:600,fontSize:13}}>{CH_NAME[ch]}</div>
              <div style={{fontSize:11,marginTop:1,color:configs[ch]?.is_enabled?'var(--green)':'var(--text4)'}}>
                {configs[ch]?.is_enabled?'● Đang bật':'○ Đã tắt'}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Form */}
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        {/* Toggle */}
        <div className="card" style={{padding:16,display:'flex',justifyContent:'space-between',alignItems:'center',border:`1px solid ${cfg.is_enabled?'rgba(34,197,94,.3)':'var(--border)'}`}}>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:'var(--text)',marginBottom:3}}>{CH_ICON[active]} Bật chatbot {CH_NAME[active]}</div>
            <div style={{fontSize:12,color:'var(--text3)'}}>Bot tự động trả lời theo điều kiện bên dưới</div>
          </div>
          <div onClick={()=>set('is_enabled',!cfg.is_enabled)} style={{width:48,height:26,borderRadius:13,cursor:'pointer',background:cfg.is_enabled?'#22C55E':'var(--surface3)',border:`1px solid ${cfg.is_enabled?'#22C55E':'var(--border2)'}`,position:'relative',transition:'all .2s',flexShrink:0}}>
            <div style={{position:'absolute',top:3,left:cfg.is_enabled?24:3,width:18,height:18,borderRadius:'50%',background:'white',transition:'left .2s'}}/>
          </div>
        </div>

        {/* Trigger */}
        <div className="card" style={{padding:16}}>
          <div style={{fontSize:11,letterSpacing:'1.5px',color:'var(--text4)',fontWeight:700,marginBottom:12}}>🎯 ĐIỀU KIỆN KÍCH HOẠT</div>
          {inp('Bot bật khi sales offline hơn','offline_threshold_min',{type:'number',min:5,max:240,suffix:'phút'})}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:cfg.schedule_enabled?10:0}}>
            <label style={{fontSize:12,color:'var(--text3)'}}>Bot theo khung giờ cố định</label>
            <div onClick={()=>set('schedule_enabled',!cfg.schedule_enabled)} style={{width:40,height:22,borderRadius:11,cursor:'pointer',background:cfg.schedule_enabled?'var(--blue)':'var(--surface3)',position:'relative',transition:'all .2s'}}>
              <div style={{position:'absolute',top:3,left:cfg.schedule_enabled?20:3,width:14,height:14,borderRadius:'50%',background:'white',transition:'left .2s'}}/>
            </div>
          </div>
          {cfg.schedule_enabled&&(
            <div style={{display:'flex',gap:12,alignItems:'center',marginTop:8}}>
              <input type="time" value={cfg.schedule_start||'22:00'} onChange={e=>set('schedule_start',e.target.value)}
                style={{background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:7,padding:'6px 10px',color:'var(--text)',fontSize:13}}/>
              <span style={{color:'var(--text4)'}}>→</span>
              <input type="time" value={cfg.schedule_end||'07:00'} onChange={e=>set('schedule_end',e.target.value)}
                style={{background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:7,padding:'6px 10px',color:'var(--text)',fontSize:13}}/>
              <span style={{fontSize:11,color:'var(--text4)'}}>(ngoài giờ làm việc)</span>
            </div>
          )}
        </div>

        {/* Timeout */}
        <div className="card" style={{padding:16}}>
          <div style={{fontSize:11,letterSpacing:'1.5px',color:'var(--text4)',fontWeight:700,marginBottom:10}}>⏱️ TỰ ĐỘNG ĐÓNG CONVERSATION</div>
          {inp('Đóng sau','timeout_close_min',{type:'number',min:30,max:1440,suffix:'phút không có tin nhắn → phân tích AI'})}
        </div>

        {/* RAG */}
        <div className="card" style={{padding:16}}>
          <div style={{fontSize:11,letterSpacing:'1.5px',color:'var(--text4)',fontWeight:700,marginBottom:12}}>🧠 RAG KNOWLEDGE BASE</div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:cfg.rag_enabled?12:0}}>
            <div>
              <div style={{fontSize:13,color:'var(--text)',marginBottom:2}}>Bật tìm kiếm kiến thức (Qdrant)</div>
              <div style={{fontSize:11,color:'var(--text4)'}}>Bot tìm trong knowledge base trước khi trả lời</div>
            </div>
            <div onClick={()=>set('rag_enabled',!cfg.rag_enabled)} style={{width:40,height:22,borderRadius:11,cursor:'pointer',background:cfg.rag_enabled?'var(--accent)':'var(--surface3)',position:'relative',transition:'all .2s',flexShrink:0}}>
              <div style={{position:'absolute',top:3,left:cfg.rag_enabled?20:3,width:14,height:14,borderRadius:'50%',background:'white',transition:'left .2s'}}/>
            </div>
          </div>
          {cfg.rag_enabled&&(
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <span style={{fontSize:12,color:'var(--text3)'}}>Ngưỡng tương đồng</span>
              <input type="range" min={0.4} max={0.95} step={0.05} value={cfg.rag_score_threshold||0.65} onChange={e=>set('rag_score_threshold',parseFloat(e.target.value))} style={{flex:1}}/>
              <span style={{fontSize:12,fontWeight:700,color:'var(--text)',minWidth:32}}>{(cfg.rag_score_threshold||0.65).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Sensitive keywords */}
        <div className="card" style={{padding:16}}>
          <div style={{fontSize:11,letterSpacing:'1.5px',color:'var(--text4)',fontWeight:700,marginBottom:6}}>🔒 TỪ KHÓA NHẠY CẢM</div>
          <div style={{fontSize:12,color:'var(--text3)',marginBottom:12}}>Bot không tự trả lời — chuyển sang "sales gọi lại"</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
            {(cfg.sensitive_keywords||[]).map((kw:string)=>(
              <span key={kw} style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.25)',color:'#FCA5A5',padding:'3px 10px',borderRadius:6,fontSize:12,display:'flex',alignItems:'center',gap:5}}>
                {kw}
                <button onClick={()=>set('sensitive_keywords',(cfg.sensitive_keywords||[]).filter((k:string)=>k!==kw))} style={{background:'none',border:'none',color:'var(--red)',cursor:'pointer',fontSize:12,padding:0,lineHeight:1}}>×</button>
              </span>
            ))}
          </div>
          <div style={{display:'flex',gap:8}}>
            <input value={newKw} onChange={e=>setNewKw(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&newKw.trim()){set('sensitive_keywords',[...(cfg.sensitive_keywords||[]),newKw.trim()]);setNewKw('')}}}
              placeholder="Thêm từ khóa (Enter)..."
              style={{flex:1,background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:7,padding:'7px 10px',color:'var(--text)',fontSize:13}}/>
            <button onClick={()=>{if(newKw.trim()){set('sensitive_keywords',[...(cfg.sensitive_keywords||[]),newKw.trim()]);setNewKw('')}}}
              style={{background:'var(--surface3)',border:'1px solid var(--border)',color:'var(--text3)',padding:'7px 14px',borderRadius:7,cursor:'pointer',fontSize:13}}>
              + Thêm
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="card" style={{padding:16}}>
          <div style={{fontSize:11,letterSpacing:'1.5px',color:'var(--text4)',fontWeight:700,marginBottom:12}}>💬 TIN NHẮN MẪU</div>
          {[
            {key:'welcome_msg',       label:'Chào mừng (tin đầu tiên)'},
            {key:'ask_contact_msg',   label:'Xin SĐT + tên'},
            {key:'ask_address_msg',   label:'Hỏi địa chỉ (sau khi có SĐT)'},
            {key:'ask_meeting_msg',   label:'Mời hẹn gặp (sau khi có địa chỉ)'},
            {key:'confirm_meeting_msg', label:'Xác nhận lịch hẹn {time} {location}'},
            {key:'callback_msg',      label:'Xác nhận yêu cầu gọi lại'},
            {key:'no_info_msg',       label:'Không có thông tin trong RAG'},
            {key:'offline_msg',       label:'Ngoài giờ làm việc'},
          ].map(f=>(
            <div key={f.key} style={{marginBottom:12}}>
              <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:5}}>{f.label}</label>
              <textarea rows={2} value={cfg[f.key]||''} onChange={e=>set(f.key,e.target.value)}
                style={{width:'100%',background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:7,padding:'8px 10px',color:'var(--text)',fontSize:12,lineHeight:1.5,resize:'vertical'}}/>
            </div>
          ))}
        </div>

        {/* Credentials — lưu DB, không cần restart */}
        <div className="card" style={{padding:16}}>
          <div style={{fontSize:11,letterSpacing:'1.5px',color:'var(--text4)',fontWeight:700,marginBottom:4}}>🔑 CREDENTIALS</div>
          <div style={{fontSize:12,color:'var(--text4)',marginBottom:12}}>Lưu vào DB — thay đổi có hiệu lực ngay, không cần restart</div>

          {/* Mock mode toggle */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
            <div>
              <div style={{fontSize:13,color:'var(--text)',fontWeight:600}}>Mock mode</div>
              <div style={{fontSize:11,color: cfg.mock_mode===false ? 'var(--green)' : 'var(--yellow)',marginTop:2}}>
                {cfg.mock_mode===false ? '● Live — đang gửi thật' : '⚠ Mock — chỉ log, không gửi về Telegram'}
              </div>
            </div>
            <div onClick={()=>set('mock_mode', cfg.mock_mode===false ? true : false)}
              style={{width:48,height:26,borderRadius:13,cursor:'pointer',
                background: cfg.mock_mode===false ? '#22C55E' : 'var(--surface3)',
                border:`1px solid ${cfg.mock_mode===false ? '#22C55E' : 'var(--border2)'}`,
                position:'relative',transition:'all .2s',flexShrink:0}}>
              <div style={{position:'absolute',top:3,left: cfg.mock_mode===false ? 24 : 3,width:18,height:18,borderRadius:'50%',background:'white',transition:'left .2s'}}/>
            </div>
          </div>

          {/* Bot token */}
          <div style={{marginTop:12}}>
            <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:5}}>
              {active==='telegram' ? 'Telegram Bot Token' : active==='zalo' ? 'Zalo OA Access Token' : 'Messenger Page Access Token'}
            </label>
            <input
              type="password"
              value={cfg.bot_token||''}
              onChange={e=>set('bot_token',e.target.value)}
              placeholder={active==='telegram' ? '1234567890:AAH...' : active==='zalo' ? 'oatoken_xxx' : 'EAAxxxxx'}
              style={{width:'100%',background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:7,padding:'8px 10px',color:'var(--text)',fontSize:13,fontFamily:'monospace'}}
            />
            <div style={{fontSize:11,color:'var(--text4)',marginTop:4}}>
              {active==='telegram' && 'Lấy từ @BotFather → /newbot'}
              {active==='zalo' && 'Lấy từ developers.zalo.me → Official Account API'}
              {active==='messenger' && 'Lấy từ developers.facebook.com → Messenger Settings → Access Tokens'}
            </div>
          </div>
        </div>

        <button onClick={save} disabled={saving}
          style={{background:saving?'var(--surface3)':'var(--accent)',border:'none',color:'white',padding:'12px 28px',borderRadius:8,cursor:saving?'not-allowed':'pointer',fontSize:14,fontWeight:700,width:'100%',opacity:saving ? 0.7 : 1}}>
          {saving?'Đang lưu...':`💾 Lưu cấu hình ${CH_NAME[active]}`}
        </button>
      </div>
      {toast&&<div style={{position:'fixed',bottom:24,right:24,background:'var(--surface)',border:'1px solid var(--border2)',color:'var(--text)',padding:'11px 20px',borderRadius:9,fontSize:13,zIndex:1000,boxShadow:'var(--shadow-md)'}}>{toast}</div>}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ChatbotSettingsPage() {
  const [tab, setTab] = useState<Tab>('connect')

  return (
    <div className="fade-up" style={{maxWidth:1000,margin:'0 auto'}}>
      <div style={{marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
          <a href="/conversations" style={{color:'var(--text4)',textDecoration:'none',fontSize:18}}>←</a>
          <h1 style={{fontSize:22,fontWeight:800,color:'var(--text)'}}>⚙️ Cấu hình Chatbot</h1>
        </div>
        <p style={{fontSize:13,color:'var(--text3)',marginLeft:28}}>Kết nối webhook + cài đặt bot cho từng kênh</p>
      </div>

      {/* Tab switcher */}
      <div style={{display:'flex',background:'var(--surface2)',borderRadius:9,padding:4,width:'fit-content',gap:2,marginBottom:22}}>
        {([['connect','🔌 Kết nối & Webhook'],['config','⚙️ Cấu hình Bot']] as [Tab,string][]).map(([t,label])=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:'7px 20px',borderRadius:7,border:'none',cursor:'pointer',fontSize:13,fontWeight:tab===t?700:400,background:tab===t?'var(--accent)':'transparent',color:tab===t?'white':'var(--text3)',transition:'all .15s'}}>
            {label}
          </button>
        ))}
      </div>

      {tab==='connect' ? <ConnectTab/> : <ConfigTab/>}
    </div>
  )
}
