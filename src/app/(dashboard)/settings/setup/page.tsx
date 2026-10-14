'use client'
// src/app/(dashboard)/settings/setup/page.tsx
// Wizard setup Telegram Bot + Cloudflare Tunnel

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

type Step = 'tunnel' | 'token' | 'webhook' | 'done'

export default function SetupPage() {
  const { data: session } = useSession()
  const roleKeys = session?.user?.role_keys || (session?.user?.role ? [session.user.role] : [])
  const [step,       setStep]       = useState<Step>('tunnel')
  const [current,    setCurrent]    = useState<any>(null)  // existing env values
  const [tunnelUrl,  setTunnelUrl]  = useState('')
  const [tgToken,    setTgToken]    = useState('')
  const [tgSecret,   setTgSecret]   = useState('crm-tg-secret-2026')
  const [verifying,  setVerifying]  = useState(false)
  const [botInfo,    setBotInfo]    = useState<any>(null)
  const [tokenError, setTokenError] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [result,     setResult]     = useState<any>(null)
  const [toast,      setToast]      = useState('')

  const canEdit = roleKeys.some((x) => ['admin', 'manager'].includes(x))

  useEffect(() => {
    fetch('/api/setup').then(r => r.json()).then(j => {
      const d = j.data || {}
      setCurrent(d)
      // Pre-fill nếu đã có
      if (d.nextauth_url && !d.nextauth_url.includes('localhost')) setTunnelUrl(d.nextauth_url)
      if (d.tg_secret)    setTgSecret(d.tg_secret)
      // Nếu đã có token, skip token step
      if (d.has_tg_token) {
        setBotInfo({ already_set: true, masked: d.tg_token_masked })
        if (!d.nextauth_url.includes('localhost')) setStep('webhook')
        else setStep('tunnel')
      }
    })
  }, [])

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000) }

  // ── Verify token ──────────────────────────────────────────────────
  const verifyToken = async () => {
    if (!tgToken.trim()) { setTokenError('Nhập token trước'); return }
    setVerifying(true); setTokenError(''); setBotInfo(null)
    const r = await fetch('/api/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_token', token: tgToken.trim() }),
    })
    const j = await r.json()
    if (j.data?.valid) {
      setBotInfo(j.data.bot)
      setTokenError('')
    } else {
      setTokenError(j.data?.error || 'Token không hợp lệ')
    }
    setVerifying(false)
  }

  // ── Save + Register ───────────────────────────────────────────────
  const saveAndRegister = async () => {
    setSaving(true)
    const r = await fetch('/api/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:     'save_and_register',
        tg_token:   tgToken.trim() || undefined,
        tg_secret:  tgSecret.trim(),
        tunnel_url: tunnelUrl.trim(),
      }),
    })
    const j = await r.json()
    setSaving(false)
    setResult(j.data)
    if (j.data?.webhook?.ok || j.data?.saved) setStep('done')
    else showToast(j.data?.message || j.error || 'Lỗi')
  }

  // ── Register only (token already in env) ─────────────────────────
  const registerOnly = async () => {
    setSaving(true)
    const r = await fetch('/api/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:     'register_only',
        tunnel_url: tunnelUrl.trim(),
        tg_secret:  tgSecret.trim(),
      }),
    })
    const j = await r.json()
    setSaving(false)
    if (j.data?.ok) { setResult(j.data); setStep('done') }
    else showToast(j.data?.description || j.error || 'Lỗi')
  }

  // ────────────────────────────────────────────────────────────────────
  const STEPS = [
    { key:'tunnel',  label:'Tunnel URL',   icon:'☁️' },
    { key:'token',   label:'Bot Token',    icon:'🤖' },
    { key:'webhook', label:'Kết nối',      icon:'🔗' },
    { key:'done',    label:'Hoàn thành',   icon:'✅' },
  ] as { key: Step; label: string; icon: string }[]

  const stepIndex = STEPS.findIndex(s => s.key === step)

  if (!canEdit) return (
    <div style={{textAlign:'center',padding:60,color:'var(--text3)'}}>
      Cần quyền Admin hoặc Manager để truy cập trang này.
    </div>
  )

  return (
    <div className="fade-up" style={{maxWidth:620,margin:'0 auto'}}>

      {/* Header */}
      <div style={{marginBottom:28}}>
        <h1 style={{fontSize:22,fontWeight:800,color:'var(--text)',marginBottom:4}}>
          ✈️ Setup Telegram Bot
        </h1>
        <div style={{fontSize:13,color:'var(--text3)'}}>
          Điền token + URL tunnel → tự động đăng ký webhook
        </div>
      </div>

      {/* Step indicator */}
      <div style={{display:'flex',gap:0,marginBottom:28,background:'var(--surface2)',borderRadius:10,padding:4}}>
        {STEPS.map((s, i) => {
          const done   = i < stepIndex
          const active = s.key === step
          return (
            <div key={s.key} style={{flex:1,textAlign:'center',padding:'8px 4px',borderRadius:8,
              background: active ? 'var(--accent)' : done ? 'rgba(34,197,94,.12)' : 'transparent',
              transition:'all .2s', cursor: done ? 'pointer' : 'default'}}
              onClick={() => { if (done) setStep(s.key) }}>
              <div style={{fontSize:16,marginBottom:2}}>{done ? '✅' : s.icon}</div>
              <div style={{fontSize:10,fontWeight: active ? 700 : 400,
                color: active ? 'white' : done ? 'var(--green)' : 'var(--text4)',whiteSpace:'nowrap'}}>
                {s.label}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── STEP: Tunnel URL ─────────────────────────────────────── */}
      {step === 'tunnel' && (
        <div className="card" style={{padding:24}}>
          <div style={{fontSize:12,letterSpacing:'1.5px',color:'var(--text4)',fontWeight:700,marginBottom:16}}>
            BƯỚC 1 — URL CLOUDFLARE TUNNEL
          </div>

          {/* Status: đã có hay chưa */}
          {current?.nextauth_url && !current.nextauth_url.includes('localhost') ? (
            <div style={{padding:'10px 14px',background:'rgba(34,197,94,.08)',border:'1px solid rgba(34,197,94,.25)',borderRadius:8,fontSize:12,color:'var(--green)',marginBottom:16}}>
              ✅ Đang dùng: <code style={{color:'var(--text)'}}>{current.nextauth_url}</code>
            </div>
          ) : (
            <div style={{padding:'10px 14px',background:'rgba(249,115,22,.07)',border:'1px solid rgba(249,115,22,.2)',borderRadius:8,fontSize:12,color:'var(--accent)',marginBottom:16}}>
              ⚠️ Chưa có domain HTTPS — cần chạy Cloudflare Tunnel trước
            </div>
          )}

          {/* How to get URL */}
          <div style={{marginBottom:16,padding:'12px 14px',background:'var(--surface2)',borderRadius:9}}>
            <div style={{fontSize:11,color:'var(--text3)',fontWeight:600,marginBottom:8}}>Chạy lệnh này để lấy URL:</div>
            <div style={{fontFamily:'monospace',fontSize:12,background:'var(--surface3)',borderRadius:7,padding:'10px 14px',color:'var(--text2)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>cloudflared tunnel run --url http://localhost:3000 crm-construction</span>
              <button onClick={() => { navigator.clipboard.writeText('cloudflared tunnel run --url http://localhost:3000 crm-construction'); showToast('Đã copy!') }}
                style={{background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text3)',padding:'3px 10px',borderRadius:5,cursor:'pointer',fontSize:10,marginLeft:10,flexShrink:0}}>
                Copy
              </button>
            </div>
            <div style={{fontSize:11,color:'var(--text4)',marginTop:7}}>
              Terminal sẽ hiển thị URL dạng: <code style={{color:'var(--accent)'}}>https://xxx.cfargotunnel.com</code>
            </div>
          </div>

          <div style={{marginBottom:18}}>
            <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:6,fontWeight:600}}>
              Tunnel URL <span style={{color:'var(--red)'}}>*</span>
            </label>
            <input
              value={tunnelUrl}
              onChange={e => setTunnelUrl(e.target.value)}
              placeholder="https://xxx.cfargotunnel.com"
              style={{width:'100%',background:'var(--surface2)',border:`1.5px solid ${tunnelUrl && !tunnelUrl.startsWith('https') ? 'var(--red)' : 'var(--border2)'}`,borderRadius:9,padding:'11px 14px',color:'var(--text)',fontSize:14,fontFamily:'monospace',boxSizing:'border-box'}}
            />
            {tunnelUrl && !tunnelUrl.startsWith('https') && (
              <div style={{fontSize:11,color:'var(--red)',marginTop:4}}>Phải bắt đầu bằng https://</div>
            )}
            {tunnelUrl && tunnelUrl.startsWith('https') && (
              <div style={{fontSize:11,color:'var(--green)',marginTop:4}}>
                ✅ Webhook URL sẽ là: {tunnelUrl}/api/webhook/telegram
              </div>
            )}
          </div>

          <button
            onClick={() => setStep('token')}
            disabled={!tunnelUrl.startsWith('https://')}
            style={{width:'100%',background: tunnelUrl.startsWith('https://') ? 'var(--accent)' : 'var(--surface3)', border:'none',color:'white',padding:'12px',borderRadius:9,cursor: tunnelUrl.startsWith('https://') ? 'pointer' : 'not-allowed',fontSize:14,fontWeight:700,opacity: tunnelUrl.startsWith('https://') ? 1 : 0.5}}>
            Tiếp theo →
          </button>
        </div>
      )}

      {/* ── STEP: Token ──────────────────────────────────────────── */}
      {step === 'token' && (
        <div className="card" style={{padding:24}}>
          <div style={{fontSize:12,letterSpacing:'1.5px',color:'var(--text4)',fontWeight:700,marginBottom:16}}>
            BƯỚC 2 — TELEGRAM BOT TOKEN
          </div>

          {/* Already set */}
          {botInfo?.already_set && (
            <div style={{padding:'10px 14px',background:'rgba(34,197,94,.08)',border:'1px solid rgba(34,197,94,.25)',borderRadius:8,fontSize:12,color:'var(--green)',marginBottom:16}}>
              ✅ Token đã được lưu ({botInfo.masked}) — bạn có thể bỏ qua bước này hoặc cập nhật token mới
            </div>
          )}

          {/* How to get */}
          <div style={{marginBottom:16,padding:'12px 14px',background:'var(--surface2)',borderRadius:9,fontSize:12,color:'var(--text2)',lineHeight:1.8}}>
            <strong>Lấy token từ @BotFather:</strong>
            <div>1. Mở Telegram → tìm <strong>@BotFather</strong></div>
            <div>2. Gửi: <code style={{background:'var(--surface3)',padding:'1px 6px',borderRadius:4}}>/newbot</code></div>
            <div>3. Đặt tên bot → đặt username (kết thúc bằng <code style={{background:'var(--surface3)',padding:'1px 6px',borderRadius:4}}>_bot</code>)</div>
            <div>4. Copy token dạng: <code style={{color:'var(--accent)'}}>1234567890:AAH_xxxx</code></div>
          </div>

          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:6,fontWeight:600}}>
              Bot Token {!botInfo?.already_set && <span style={{color:'var(--red)'}}>*</span>}
            </label>
            <div style={{display:'flex',gap:8}}>
              <input
                value={tgToken}
                onChange={e => { setTgToken(e.target.value); setTokenError(''); setBotInfo(null) }}
                placeholder={botInfo?.already_set ? '(để trống để giữ token cũ)' : '1234567890:AAHxxxxxxxx'}
                style={{flex:1,background:'var(--surface2)',border:`1.5px solid ${tokenError ? 'var(--red)' : botInfo && !botInfo.already_set ? 'rgba(34,197,94,.5)' : 'var(--border2)'}`,borderRadius:9,padding:'10px 14px',color:'var(--text)',fontSize:13,fontFamily:'monospace'}}
              />
              <button onClick={verifyToken} disabled={verifying || !tgToken.trim()}
                style={{background:'var(--surface3)',border:'1px solid var(--border)',color:'var(--text2)',padding:'10px 16px',borderRadius:9,cursor: tgToken.trim() ? 'pointer' : 'not-allowed',fontSize:12,fontWeight:600,flexShrink:0,whiteSpace:'nowrap'}}>
                {verifying ? '...' : '🔍 Verify'}
              </button>
            </div>
            {tokenError && <div style={{fontSize:11,color:'var(--red)',marginTop:4}}>❌ {tokenError}</div>}
            {botInfo && !botInfo.already_set && (
              <div style={{fontSize:12,color:'var(--green)',marginTop:6,display:'flex',alignItems:'center',gap:6}}>
                ✅ Bot hợp lệ: <strong>@{botInfo.username}</strong> ({botInfo.first_name})
              </div>
            )}
          </div>

          <div style={{marginBottom:18}}>
            <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:6,fontWeight:600}}>
              Webhook Secret <span style={{fontSize:11,color:'var(--text4)',fontWeight:400}}>(tự tạo, dùng để xác thực request)</span>
            </label>
            <input
              value={tgSecret}
              onChange={e => setTgSecret(e.target.value)}
              placeholder="crm-tg-secret-2026"
              style={{width:'100%',background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:9,padding:'10px 14px',color:'var(--text)',fontSize:13,fontFamily:'monospace',boxSizing:'border-box'}}
            />
            <div style={{fontSize:11,color:'var(--text4)',marginTop:4}}>Chuỗi bất kỳ, càng ngẫu nhiên càng tốt</div>
          </div>

          <div style={{display:'flex',gap:10}}>
            <button onClick={() => setStep('tunnel')}
              style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text3)',padding:'11px 18px',borderRadius:9,cursor:'pointer',fontSize:13}}>
              ← Quay lại
            </button>
            <button
              onClick={() => setStep('webhook')}
              disabled={!botInfo?.already_set && !botInfo?.username}
              style={{flex:1,background: (botInfo?.already_set || botInfo?.username) ? 'var(--accent)' : 'var(--surface3)',border:'none',color:'white',padding:'11px',borderRadius:9,cursor: (botInfo?.already_set || botInfo?.username) ? 'pointer' : 'not-allowed',fontSize:14,fontWeight:700,opacity: (botInfo?.already_set || botInfo?.username) ? 1 : 0.5}}>
              Tiếp theo →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: Webhook ────────────────────────────────────────── */}
      {step === 'webhook' && (
        <div className="card" style={{padding:24}}>
          <div style={{fontSize:12,letterSpacing:'1.5px',color:'var(--text4)',fontWeight:700,marginBottom:16}}>
            BƯỚC 3 — XÁC NHẬN VÀ KẾT NỐI
          </div>

          {/* Summary */}
          <div style={{marginBottom:18,display:'flex',flexDirection:'column',gap:8}}>
            {[
              { label:'Webhook URL', val:`${tunnelUrl}/api/webhook/telegram`, highlight:true },
              { label:'Bot token',   val: tgToken ? `${tgToken.slice(0,10)}…` : `(đã lưu: ${current?.tg_token_masked || '?'})` },
              { label:'Secret',      val: tgSecret },
              { label:'Mock mode',   val:'Sẽ TẮT (false) sau khi lưu', color:'var(--green)' },
            ].map(row => (
              <div key={row.label} style={{display:'flex',justifyContent:'space-between',padding:'9px 12px',background:'var(--surface2)',borderRadius:7}}>
                <span style={{fontSize:12,color:'var(--text3)',fontWeight:600}}>{row.label}</span>
                <span style={{fontSize:12,fontFamily:'monospace',color: row.color || (row.highlight ? 'var(--accent)' : 'var(--text2)'),textAlign:'right',maxWidth:340,overflow:'hidden',textOverflow:'ellipsis'}}>{row.val}</span>
              </div>
            ))}
          </div>

          <div style={{padding:'10px 14px',background:'rgba(59,130,246,.07)',border:'1px solid rgba(59,130,246,.2)',borderRadius:8,fontSize:12,color:'var(--text2)',marginBottom:18,lineHeight:1.7}}>
            <strong style={{color:'var(--blue)'}}>Thao tác sẽ thực hiện:</strong><br/>
            1. Lưu các giá trị trên vào <code style={{background:'var(--surface3)',padding:'1px 5px',borderRadius:3}}>.env.local</code><br/>
            2. Gọi Telegram API đăng ký webhook<br/>
            3. Tắt BOT_MOCK_MODE<br/>
            <strong style={{color:'var(--accent)'}}>⚠️ Cần restart server sau khi lưu!</strong>
          </div>

          <div style={{display:'flex',gap:10}}>
            <button onClick={() => setStep('token')}
              style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text3)',padding:'11px 18px',borderRadius:9,cursor:'pointer',fontSize:13}}>
              ← Quay lại
            </button>
            <button onClick={tgToken ? saveAndRegister : registerOnly} disabled={saving}
              style={{flex:1,background:'var(--accent)',border:'none',color:'white',padding:'11px',borderRadius:9,cursor:saving?'not-allowed':'pointer',fontSize:14,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:saving?.7:1}}>
              {saving ? <><span className="spinner" style={{width:16,height:16,borderWidth:2}}/>Đang đăng ký...</> : '🔗 Lưu & Đăng ký Webhook'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: Done ───────────────────────────────────────────── */}
      {step === 'done' && (
        <div className="card" style={{padding:28,textAlign:'center'}}>
          <div style={{fontSize:56,marginBottom:12}}>🎉</div>
          <div style={{fontSize:18,fontWeight:800,color:'var(--text)',marginBottom:8}}>
            {result?.webhook?.ok ? 'Webhook đã đăng ký thành công!' : 'Đã lưu cấu hình!'}
          </div>

          {result?.webhook?.ok && (
            <div style={{fontSize:12,color:'var(--text3)',marginBottom:16,fontFamily:'monospace',background:'var(--surface2)',padding:'10px 14px',borderRadius:8}}>
              {result.webhook.url}
            </div>
          )}
          {result?.webhook && !result.webhook.ok && (
            <div style={{fontSize:12,color:'var(--red)',marginBottom:16,background:'rgba(239,68,68,.07)',padding:'10px 14px',borderRadius:8}}>
              ⚠️ Lưu .env thành công nhưng đăng ký webhook thất bại: {result.webhook.description || result.webhook.error}<br/>
              Thử lại sau khi restart server.
            </div>
          )}

          <div style={{padding:'14px 16px',background:'rgba(249,115,22,.07)',border:'1px solid rgba(249,115,22,.2)',borderRadius:9,fontSize:13,color:'var(--accent)',marginBottom:20,textAlign:'left',lineHeight:2}}>
            <strong>Bước tiếp theo:</strong><br/>
            1. Restart server: <code style={{background:'var(--surface3)',padding:'2px 8px',borderRadius:4,fontSize:12}}>Ctrl+C</code> rồi <code style={{background:'var(--surface3)',padding:'2px 8px',borderRadius:4,fontSize:12}}>npm run dev</code><br/>
            2. Vào <strong>Settings → Chatbot → Cấu hình → Telegram → Bật toggle</strong><br/>
            3. Nhắn tin vào bot của bạn trên Telegram để test<br/>
            4. Kiểm tra <strong>Conversations</strong> trong CRM
          </div>

          <div style={{display:'flex',gap:10,justifyContent:'center'}}>
            <a href="/settings/chatbot"
              style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text2)',padding:'10px 20px',borderRadius:8,textDecoration:'none',fontSize:13}}>
              ⚙️ Cấu hình Bot
            </a>
            <a href="/conversations"
              style={{background:'var(--accent)',border:'none',color:'white',padding:'10px 24px',borderRadius:8,textDecoration:'none',fontSize:13,fontWeight:700}}>
              💬 Conversations →
            </a>
          </div>
        </div>
      )}

      {toast && (
        <div style={{position:'fixed',bottom:28,left:'50%',transform:'translateX(-50%)',background:'var(--surface)',border:'1px solid var(--border2)',color:'var(--text)',padding:'10px 22px',borderRadius:10,fontSize:13,zIndex:9999,boxShadow:'var(--shadow-md)',whiteSpace:'nowrap'}}>
          {toast}
        </div>
      )}
    </div>
  )
}
