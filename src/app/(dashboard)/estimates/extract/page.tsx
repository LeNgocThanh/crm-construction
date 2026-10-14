'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type ProfileKey = 'crm_basic' | 'estimate_v1' | 'estimate_preliminary'

type ExtractionResponse = {
  mode: 'full' | 'incremental'
  source_type: string
  input_text: string
  customer_id: string | null
  conversation_id: string | null
  contact_log_id: string | null
  profiles: ProfileKey[]
  results: Array<{
    profile_key: ProfileKey
    run_id: string | null
    status: 'completed' | 'needs_data'
    summary: string | null
    confidence: number | null
    facts: Array<{ key: string; value: unknown; confidence?: number | null }>
    extracted: Record<string, unknown>
    missing_fields: string[]
    recommended_questions: string[]
  }>
  estimate_prefill: Record<string, unknown>
}

export default function EstimateExtractPage() {
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [result, setResult] = useState<ExtractionResponse | null>(null)

  const [text, setText] = useState('')
  const [sourceType, setSourceType] = useState('text')
  const [customerId, setCustomerId] = useState('')
  const [conversationId, setConversationId] = useState('')
  const [contactLogId, setContactLogId] = useState('')
  const [mode, setMode] = useState<'full' | 'incremental'>('full')

  const [selectedProfiles, setSelectedProfiles] = useState<Record<ProfileKey, boolean>>({
    crm_basic: true,
    estimate_v1: false,
    estimate_preliminary: true,
  })

  const profileList = useMemo(() => {
    const out: ProfileKey[] = []
    for (const key of Object.keys(selectedProfiles) as ProfileKey[]) {
      if (selectedProfiles[key]) out.push(key)
    }
    return out
  }, [selectedProfiles])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function runExtraction() {
    if (!text.trim() && !conversationId.trim() && !contactLogId.trim()) {
      showToast('Nhập nội dung hoặc chọn conversation_id/contact_log_id để bóc tách')
      return
    }
    if (!profileList.length) {
      showToast('Cần chọn ít nhất 1 profile')
      return
    }

    setLoading(true)
    setResult(null)

    const res = await fetch('/api/extractions/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profiles: profileList,
        auto_detect: false,
        mode,
        source_type: sourceType,
        text: text.trim() || undefined,
        customer_id: customerId.trim() || null,
        conversation_id: conversationId.trim() || null,
        contact_log_id: contactLogId.trim() || null,
      }),
    })

    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      showToast(`Lỗi: ${json.error || 'Bóc tách thất bại'}`)
      return
    }

    setResult(json.data)
    showToast('Đã bóc tách xong')
  }

  const prefillHref = useMemo(() => {
    if (!result?.estimate_prefill) return ''
    const compact = JSON.stringify(result.estimate_prefill)
    return `/estimates/generate-v2?prefill=${encodeURIComponent(compact)}`
  }, [result])

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>
          EXTRACTOR HUB
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
          Bóc tách từ mô tả / chat / call
        </h1>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          Chọn profile theo mục đích, lấy JSON chuẩn và danh sách dữ liệu thiếu trước khi tạo dự toán.
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Field label="Nguồn dữ liệu">
            <select className="select" value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              <option value="text">Văn bản</option>
              <option value="chat">Chat</option>
              <option value="call">Cuộc gọi</option>
              <option value="manual">Nhập tay</option>
            </select>
          </Field>
          <Field label="Chế độ bóc tách">
            <select className="select" value={mode} onChange={(e) => setMode((e.target.value as 'full' | 'incremental'))}>
              <option value="full">Toàn bộ</option>
              <option value="incremental">Bổ sung</option>
            </select>
          </Field>
          <Field label="Mã khách hàng">
            <input className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="Không bắt buộc" />
          </Field>
          <Field label="Mã hội thoại">
            <input className="input" value={conversationId} onChange={(e) => setConversationId(e.target.value)} placeholder="Không bắt buộc" />
          </Field>
          <Field label="Mã nhật ký liên hệ">
            <input className="input" value={contactLogId} onChange={(e) => setContactLogId(e.target.value)} placeholder="Không bắt buộc" />
          </Field>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Profile bóc tách</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <Check
            checked={selectedProfiles.crm_basic}
            label="CRM cơ bản"
            onChange={(v) => setSelectedProfiles((p) => ({ ...p, crm_basic: v }))}
          />
          <Check
            checked={selectedProfiles.estimate_v1}
            label="Khái toán V1"
            onChange={(v) => setSelectedProfiles((p) => ({ ...p, estimate_v1: v }))}
          />
          <Check
            checked={selectedProfiles.estimate_preliminary}
            label="Dự toán sơ bộ"
            onChange={(v) => setSelectedProfiles((p) => ({ ...p, estimate_preliminary: v }))}
          />
        </div>

        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Nội dung cần bóc tách</div>
        <textarea
          className="input"
          style={{ minHeight: 160, resize: 'vertical' }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Dán nội dung chat / call vào đây nếu không dùng conversation_id hoặc contact_log_id"
        />

        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button className="btn-primary" onClick={runExtraction} disabled={loading}>
            {loading ? 'Đang bóc tách...' : 'Bóc tách'}
          </button>
          {prefillHref && (
            <Link href={prefillHref} style={{
              display: 'inline-flex',
              alignItems: 'center',
              textDecoration: 'none',
              borderRadius: 8,
              padding: '8px 12px',
              border: '1px solid rgba(59,130,246,.35)',
              background: 'rgba(59,130,246,.12)',
              color: 'var(--blue)',
              fontSize: 12,
              fontWeight: 700,
            }}>
              Dùng cho dự toán sơ bộ
            </Link>
          )}
        </div>
      </div>

      {result && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
            Profile đã chạy: <span style={{ color: 'var(--blue)' }}>{result.profiles.join(', ')}</span>
          </div>

          {result.results.map((r) => (
            <div key={r.profile_key} style={{ marginBottom: 12, border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>{r.profile_key}</div>
                <div style={{ fontSize: 11, color: r.status === 'needs_data' ? 'var(--orange)' : 'var(--green)' }}>
                  {r.status === 'needs_data' ? 'Cần bổ sung dữ liệu' : 'Đủ dữ liệu'}
                </div>
              </div>
              {r.summary && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>{r.summary}</div>}

              {r.missing_fields.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 6 }}>
                  Thiếu: {r.missing_fields.join(', ')}
                </div>
              )}

              {r.recommended_questions.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {r.recommended_questions.map((q, idx) => (
                    <div key={`${q}-${idx}`} style={{ fontSize: 12, color: 'var(--text3)' }}>- {q}</div>
                  ))}
                </div>
              )}

              <pre style={{
                margin: 0,
                fontSize: 11,
                lineHeight: 1.55,
                color: 'var(--text2)',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 10,
                overflowX: 'auto',
              }}>
{JSON.stringify(r.extracted, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 9, padding: '10px 16px', fontSize: 13, zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  )
}

function Check({ checked, label, onChange }: { checked: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
