'use client'

import { useEffect, useMemo, useState } from 'react'

type TaxonomyRow = {
  id: string
  kind: string
  value: string
  name: string
  description?: string | null
  sort_order: number
  is_active: boolean
}

type ProfileDraft = {
  value: string
  name: string
  sort_order: string
  geo_factor: string
  labor_factor: string
  transport_factor: string
  difficulty_factor: string
  market_factor: string
}

type ParsedProfile = {
  geo_factor: number
  labor_factor: number
  transport_factor: number
  difficulty_factor: number
  market_factor: number
}

const MIN_RECOMMENDED = 0.8
const MAX_RECOMMENDED = 1.5

const DEFAULT_DRAFT: ProfileDraft = {
  value: '',
  name: '',
  sort_order: '',
  geo_factor: '1',
  labor_factor: '1',
  transport_factor: '1',
  difficulty_factor: '1',
  market_factor: '1',
}

export default function EstimateContextProfilesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [rows, setRows] = useState<TaxonomyRow[]>([])
  const [draft, setDraft] = useState<ProfileDraft>(DEFAULT_DRAFT)
  const draftWarnings = useMemo(() => validateProfile(draftToPayload(draft)), [draft])

  useEffect(() => {
    loadRows()
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function loadRows() {
    setLoading(true)
    const res = await fetch('/api/settings/estimate/taxonomies?active_only=false&kind=context_profile')
    const j = await res.json()
    setRows(Array.isArray(j.data) ? j.data : [])
    setLoading(false)
  }

  function draftToPayload(d: ProfileDraft): ParsedProfile {
    return {
      geo_factor: toPositive(d.geo_factor),
      labor_factor: toPositive(d.labor_factor),
      transport_factor: toPositive(d.transport_factor),
      difficulty_factor: toPositive(d.difficulty_factor),
      market_factor: toPositive(d.market_factor),
    }
  }

  async function createProfile() {
    const value = draft.value.trim()
    const name = draft.name.trim()
    if (!value || !name) {
      showToast('Thiếu value hoặc name')
      return
    }

    const payload = draftToPayload(draft)
    const warns = validateProfile(payload)
    if (warns.length) {
      showToast(`Cảnh báo ngưỡng: ${warns.join(', ')}`)
    }

    setSaving(true)
    const res = await fetch('/api/settings/estimate/taxonomies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'context_profile',
        value,
        name,
        sort_order: draft.sort_order ? Number(draft.sort_order) : 0,
        description: JSON.stringify(payload),
      }),
    })
    setSaving(false)

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showToast(`Lỗi: ${j.error || 'Không thể tạo profile'}`)
      return
    }

    setDraft(DEFAULT_DRAFT)
    await loadRows()
    showToast('Đã tạo profile hệ số')
  }

  async function patchRow(id: string, patch: Partial<TaxonomyRow>) {
    const res = await fetch(`/api/settings/estimate/taxonomies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showToast(`Lỗi: ${j.error || 'Không thể cập nhật profile'}`)
      return
    }
    await loadRows()
    showToast('Đã cập nhật profile')
  }

  async function removeRow(id: string) {
    if (!confirm('Xóa profile này?')) return
    await fetch(`/api/settings/estimate/taxonomies/${id}`, { method: 'DELETE' })
    await loadRows()
    showToast('Đã xóa profile')
  }

  async function editFactors(row: TaxonomyRow) {
    const cur = parseProfile(row.description)
    const geo = prompt('geo_factor', String(cur.geo_factor))
    if (geo == null) return
    const labor = prompt('labor_factor', String(cur.labor_factor))
    if (labor == null) return
    const transport = prompt('transport_factor', String(cur.transport_factor))
    if (transport == null) return
    const difficulty = prompt('difficulty_factor', String(cur.difficulty_factor))
    if (difficulty == null) return
    const market = prompt('market_factor', String(cur.market_factor))
    if (market == null) return

    const next: ParsedProfile = {
      geo_factor: toPositive(geo),
      labor_factor: toPositive(labor),
      transport_factor: toPositive(transport),
      difficulty_factor: toPositive(difficulty),
      market_factor: toPositive(market),
    }
    const warns = validateProfile(next)
    if (warns.length) showToast(`Cảnh báo ngưỡng: ${warns.join(', ')}`)
    await patchRow(row.id, { description: JSON.stringify(next) })
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>
          CONTEXT PROFILES
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Profile Hệ Số Bối Cảnh</h1>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          Nhập theo cột số, không cần JSON tay. Khuyến nghị mỗi hệ số nằm trong khoảng 0.8 - 1.5.
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.7fr 0.7fr 0.7fr 0.8fr 0.8fr 0.8fr auto', gap: 8, marginBottom: 6, fontSize: 11, color: 'var(--text4)' }}>
          <div>value</div>
          <div>name</div>
          <div>sort</div>
          <div>geo_factor</div>
          <div>labor_factor</div>
          <div>transport_factor</div>
          <div>difficulty_factor</div>
          <div>market_factor</div>
          <div />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.7fr 0.7fr 0.7fr 0.8fr 0.8fr 0.8fr auto', gap: 8 }}>
          <input className="input" placeholder="value" value={draft.value} onChange={(e) => setDraft((p) => ({ ...p, value: e.target.value }))} />
          <input className="input" placeholder="name" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
          <input className="input" placeholder="sort" value={draft.sort_order} onChange={(e) => setDraft((p) => ({ ...p, sort_order: e.target.value }))} />
          <input className="input" placeholder="geo" value={draft.geo_factor} onChange={(e) => setDraft((p) => ({ ...p, geo_factor: e.target.value }))} />
          <input className="input" placeholder="labor" value={draft.labor_factor} onChange={(e) => setDraft((p) => ({ ...p, labor_factor: e.target.value }))} />
          <input className="input" placeholder="transport" value={draft.transport_factor} onChange={(e) => setDraft((p) => ({ ...p, transport_factor: e.target.value }))} />
          <input className="input" placeholder="difficulty" value={draft.difficulty_factor} onChange={(e) => setDraft((p) => ({ ...p, difficulty_factor: e.target.value }))} />
          <input className="input" placeholder="market" value={draft.market_factor} onChange={(e) => setDraft((p) => ({ ...p, market_factor: e.target.value }))} />
          <button className="btn-primary" onClick={createProfile} disabled={saving}>{saving ? 'Đang lưu...' : '+ Tạo'}</button>
        </div>
        {draftWarnings.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)' }}>
            Cảnh báo ngưỡng: {draftWarnings.join(', ')}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 14 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <span className="spinner" style={{ width: 24, height: 24 }} />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có profile nào.</div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.65fr 1.8fr auto', gap: 8, padding: '8px 10px', fontSize: 11, color: 'var(--text4)', borderBottom: '1px solid var(--border)' }}>
              <div>value</div>
              <div>name</div>
              <div>sort</div>
              <div>factors</div>
              <div></div>
            </div>
            {rows.map((r) => {
              const p = parseProfile(r.description)
              const warns = validateProfile(p)
              return (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.65fr 1.8fr auto', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", color: 'var(--blue)', fontSize: 12 }}>{r.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text)' }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{r.sort_order}</div>
                  <div style={{ fontSize: 12, color: warns.length ? 'var(--red)' : 'var(--text2)' }}>
                    geo {p.geo_factor} | labor {p.labor_factor} | transport {p.transport_factor} | difficulty {p.difficulty_factor} | market {p.market_factor}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => editFactors(r)} style={btnGhost}>Hệ số</button>
                    <button onClick={() => {
                      const next = prompt('Tên mới', r.name)
                      if (!next || !next.trim()) return
                      patchRow(r.id, { name: next.trim() })
                    }} style={btnGhost}>Tên</button>
                    <button onClick={() => patchRow(r.id, { is_active: !r.is_active })} style={{ ...btnGhost, color: r.is_active ? 'var(--green)' : 'var(--text3)' }}>{r.is_active ? 'On' : 'Off'}</button>
                    <button onClick={() => removeRow(r.id)} style={btnDanger}>Xóa</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 9, padding: '10px 16px', fontSize: 13, zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}

const btnGhost: React.CSSProperties = {
  background: 'var(--surface2)',
  border: '1px solid var(--border2)',
  color: 'var(--text3)',
  borderRadius: 6,
  padding: '3px 8px',
  fontSize: 11,
  cursor: 'pointer',
}

const btnDanger: React.CSSProperties = {
  background: 'rgba(239,68,68,.12)',
  border: '1px solid rgba(239,68,68,.25)',
  color: 'var(--red)',
  borderRadius: 6,
  padding: '3px 8px',
  fontSize: 11,
  cursor: 'pointer',
}

function parseProfile(raw: string | null | undefined): ParsedProfile {
  if (!raw || !String(raw).trim()) {
    return {
      geo_factor: 1,
      labor_factor: 1,
      transport_factor: 1,
      difficulty_factor: 1,
      market_factor: 1,
    }
  }
  return safeParse(raw) || {
    geo_factor: 1,
    labor_factor: 1,
    transport_factor: 1,
    difficulty_factor: 1,
    market_factor: 1,
  }
}

function safeParse(raw: string): ParsedProfile | null {
  try {
    const obj = JSON.parse(raw)
    return {
      geo_factor: toPositive(obj?.geo_factor),
      labor_factor: toPositive(obj?.labor_factor),
      transport_factor: toPositive(obj?.transport_factor),
      difficulty_factor: toPositive(obj?.difficulty_factor),
      market_factor: toPositive(obj?.market_factor),
    }
  } catch {
    return null
  }
}

function toPositive(v: unknown) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return 1
  return n
}

function validateProfile(p: ParsedProfile) {
  const warnings: string[] = []
  if (p.geo_factor < MIN_RECOMMENDED || p.geo_factor > MAX_RECOMMENDED) warnings.push('geo_factor')
  if (p.labor_factor < MIN_RECOMMENDED || p.labor_factor > MAX_RECOMMENDED) warnings.push('labor_factor')
  if (p.transport_factor < MIN_RECOMMENDED || p.transport_factor > MAX_RECOMMENDED) warnings.push('transport_factor')
  if (p.difficulty_factor < MIN_RECOMMENDED || p.difficulty_factor > MAX_RECOMMENDED) warnings.push('difficulty_factor')
  if (p.market_factor < MIN_RECOMMENDED || p.market_factor > MAX_RECOMMENDED) warnings.push('market_factor')
  return warnings
}
