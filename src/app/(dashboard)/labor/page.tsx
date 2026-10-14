'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Trade = {
  id: string
  trade_key: string
  trade_name: string
  unit_text?: string | null
  default_rate?: string | null
  description?: string | null
  sort_order: number
  is_active: boolean
}

type Crew = {
  id: string
  crew_key: string
  crew_name: string
  leader_name?: string | null
  phone?: string | null
  description?: string | null
  sort_order: number
  is_active: boolean
}

type SkillLevel = {
  id: string
  skill_key: string
  skill_name: string
  default_rate?: string | null
  description?: string | null
  sort_order: number
  is_active: boolean
}

type Worker = {
  id: string
  worker_code: string
  full_name: string
  phone?: string | null
  default_unit_text?: string | null
  default_rate?: string | null
  home_area?: string | null
  worker_category?: string | null
  employment_mode?: string | null
  status: string
  notes?: string | null
  trade?: { id: string; trade_key: string; trade_name: string } | null
  crew?: { id: string; crew_key: string; crew_name: string } | null
  skill_level?: { id: string; skill_key: string; skill_name: string; default_rate?: string | null } | null
  is_active?: boolean
}

type WorkerFilters = {
  q: string
  worker_category: string
  skill_level_id: string
  active_only: boolean
}

const EMPTY_TRADE = {
  trade_key: '',
  trade_name: '',
  unit_text: '',
  default_rate: '',
  description: '',
  sort_order: '0',
  is_active: true,
}

const EMPTY_CREW = {
  crew_key: '',
  crew_name: '',
  leader_name: '',
  phone: '',
  description: '',
  sort_order: '0',
  is_active: true,
}

const EMPTY_SKILL_LEVEL = {
  skill_key: '',
  skill_name: '',
  default_rate: '',
  description: '',
  sort_order: '0',
  is_active: true,
}

const EMPTY_WORKER = {
  worker_code: '',
  full_name: '',
  phone: '',
  trade_id: '',
  crew_id: '',
  skill_level_id: '',
  worker_category: 'external',
  employment_mode: 'daily',
  default_unit_text: '',
  default_rate: '',
  home_area: '',
  status: 'active',
  notes: '',
  is_active: true,
}

const EMPTY_FILTERS: WorkerFilters = {
  q: '',
  worker_category: '',
  skill_level_id: '',
  active_only: true,
}

const WORKER_CATEGORY_OPTIONS = [
  { value: 'external', label: 'Nhân công thuê ngoài' },
  { value: 'company', label: 'Nhân công công ty' },
]

const EMPLOYMENT_MODE_OPTIONS = [
  { value: 'daily', label: 'Theo công' },
  { value: 'monthly', label: 'Theo tháng' },
  { value: 'piecework', label: 'Theo khoán' },
  { value: 'subcontract', label: 'Tổ/đội nhận khoán' },
]

function slugifyCode(text: string) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function money(v?: string | number | null) {
  if (v == null || v === '') return '-'
  const n = typeof v === 'string' ? Number(v) : v
  if (!Number.isFinite(n)) return '-'
  return Number(n).toLocaleString('vi-VN') + ' vnd'
}

function activeText(active: boolean) {
  return active ? 'Đang bật' : 'Đang tắt'
}

function workerCategoryLabel(value?: string | null) {
  switch (value) {
    case 'company':
      return 'Nhân công công ty'
    case 'external':
      return 'Nhân công thuê ngoài'
    default:
      return 'Chưa phân loại'
  }
}

function employmentModeLabel(value?: string | null) {
  switch (value) {
    case 'daily':
      return 'Theo công'
    case 'monthly':
      return 'Theo tháng'
    case 'piecework':
      return 'Theo khoán'
    case 'subcontract':
      return 'Tổ/đội nhận khoán'
    default:
      return 'Chưa chọn'
  }
}

function statusLabel(value?: string | null) {
  switch (value) {
    case 'active':
      return 'Đang hoạt động'
    case 'paused':
      return 'Tạm dừng'
    case 'inactive':
      return 'Ngừng'
    default:
      return value || '-'
  }
}

export default function LaborPage() {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [trades, setTrades] = useState<Trade[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [skillLevels, setSkillLevels] = useState<SkillLevel[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [filters, setFilters] = useState<WorkerFilters>(EMPTY_FILTERS)

  const [editingTradeId, setEditingTradeId] = useState('')
  const [editingCrewId, setEditingCrewId] = useState('')
  const [editingSkillLevelId, setEditingSkillLevelId] = useState('')
  const [editingWorkerId, setEditingWorkerId] = useState('')

  const [tradeForm, setTradeForm] = useState(EMPTY_TRADE)
  const [crewForm, setCrewForm] = useState(EMPTY_CREW)
  const [skillLevelForm, setSkillLevelForm] = useState(EMPTY_SKILL_LEVEL)
  const [workerForm, setWorkerForm] = useState(EMPTY_WORKER)

  async function loadAll() {
    setLoading(true)
    try {
      const [tRes, cRes, sRes, wRes] = await Promise.all([
        fetch('/api/labor/trades'),
        fetch('/api/labor/crews'),
        fetch('/api/labor/skill-levels'),
        fetch('/api/labor/workers'),
      ])
      const [tJson, cJson, sJson, wJson] = await Promise.all([
        tRes.json().catch(() => ({})),
        cRes.json().catch(() => ({})),
        sRes.json().catch(() => ({})),
        wRes.json().catch(() => ({})),
      ])
      setTrades(Array.isArray(tJson?.data) ? tJson.data : [])
      setCrews(Array.isArray(cJson?.data) ? cJson.data : [])
      setSkillLevels(Array.isArray(sJson?.data) ? sJson.data : [])
      setWorkers(Array.isArray(wJson?.data) ? wJson.data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const filteredWorkers = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    return workers.filter((row) => {
      if (filters.active_only && row.is_active === false) return false
      if (filters.worker_category && row.worker_category !== filters.worker_category) return false
      if (filters.skill_level_id && row.skill_level?.id !== filters.skill_level_id) return false
      if (!q) return true
      const haystack = [
        row.worker_code,
        row.full_name,
        row.phone || '',
        row.home_area || '',
        row.trade?.trade_name || '',
        row.crew?.crew_name || '',
        row.skill_level?.skill_name || '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [workers, filters])

  function resetTradeForm() {
    setEditingTradeId('')
    setTradeForm(EMPTY_TRADE)
  }

  function resetCrewForm() {
    setEditingCrewId('')
    setCrewForm(EMPTY_CREW)
  }

  function resetSkillLevelForm() {
    setEditingSkillLevelId('')
    setSkillLevelForm(EMPTY_SKILL_LEVEL)
  }

  function resetWorkerForm() {
    setEditingWorkerId('')
    setWorkerForm(EMPTY_WORKER)
  }

  function applySkillRate(nextSkillLevelId: string, currentCategory?: string, currentRate?: string, previousSkillLevelId?: string) {
    const nextSkill = skillLevels.find((row) => row.id === nextSkillLevelId)
    const previousSkill = skillLevels.find((row) => row.id === previousSkillLevelId)
    const previousDefault = previousSkill?.default_rate || ''
    const nextDefault = nextSkill?.default_rate || ''
    const shouldAutofill = currentCategory === 'external' && (!currentRate || currentRate === previousDefault)
    return shouldAutofill ? nextDefault : (currentRate || '')
  }

  async function submitTrade() {
    const nextKey = slugifyCode(tradeForm.trade_key || tradeForm.trade_name)
    if (!nextKey || !tradeForm.trade_name.trim()) {
      setToast('Thiếu mã hoặc tên nghề')
      return
    }
    const payload = {
      trade_key: nextKey,
      trade_name: tradeForm.trade_name.trim(),
      unit_text: tradeForm.unit_text.trim() || null,
      default_rate: tradeForm.default_rate.trim() || null,
      description: tradeForm.description.trim() || null,
      sort_order: Number(tradeForm.sort_order || 0),
      is_active: !!tradeForm.is_active,
    }
    const url = editingTradeId ? `/api/labor/trades/${editingTradeId}` : '/api/labor/trades'
    const method = editingTradeId ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json?.error || 'Không lưu được nghề')
      return
    }
    setToast(editingTradeId ? 'Đã cập nhật nghề' : 'Đã tạo nghề')
    resetTradeForm()
    await loadAll()
  }

  async function submitCrew() {
    const nextKey = slugifyCode(crewForm.crew_key || crewForm.crew_name)
    if (!nextKey || !crewForm.crew_name.trim()) {
      setToast('Thiếu mã hoặc tên đội')
      return
    }
    const payload = {
      crew_key: nextKey,
      crew_name: crewForm.crew_name.trim(),
      leader_name: crewForm.leader_name.trim() || null,
      phone: crewForm.phone.trim() || null,
      description: crewForm.description.trim() || null,
      sort_order: Number(crewForm.sort_order || 0),
      is_active: !!crewForm.is_active,
    }
    const url = editingCrewId ? `/api/labor/crews/${editingCrewId}` : '/api/labor/crews'
    const method = editingCrewId ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json?.error || 'Không lưu được đội')
      return
    }
    setToast(editingCrewId ? 'Đã cập nhật đội' : 'Đã tạo đội')
    resetCrewForm()
    await loadAll()
  }

  async function submitSkillLevel() {
    const nextKey = slugifyCode(skillLevelForm.skill_key || skillLevelForm.skill_name)
    if (!nextKey || !skillLevelForm.skill_name.trim()) {
      setToast('Thiếu mã hoặc tên cấp bậc')
      return
    }
    const payload = {
      skill_key: nextKey,
      skill_name: skillLevelForm.skill_name.trim(),
      default_rate: skillLevelForm.default_rate.trim() || null,
      description: skillLevelForm.description.trim() || null,
      sort_order: Number(skillLevelForm.sort_order || 0),
      is_active: !!skillLevelForm.is_active,
    }
    const url = editingSkillLevelId ? `/api/labor/skill-levels/${editingSkillLevelId}` : '/api/labor/skill-levels'
    const method = editingSkillLevelId ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json?.error || 'Không lưu được cấp bậc')
      return
    }
    setToast(editingSkillLevelId ? 'Đã cập nhật cấp bậc' : 'Đã tạo cấp bậc')
    resetSkillLevelForm()
    await loadAll()
  }

  async function submitWorker() {
    const nextCode = slugifyCode(workerForm.worker_code || workerForm.full_name)
    if (!nextCode || !workerForm.full_name.trim()) {
      setToast('Thiếu mã hoặc tên nhân công')
      return
    }
    const payload = {
      worker_code: nextCode,
      full_name: workerForm.full_name.trim(),
      phone: workerForm.phone.trim() || null,
      trade_id: workerForm.trade_id || null,
      crew_id: workerForm.crew_id || null,
      skill_level_id: workerForm.skill_level_id || null,
      worker_category: workerForm.worker_category || null,
      employment_mode: workerForm.employment_mode || null,
      default_unit_text: workerForm.default_unit_text.trim() || null,
      default_rate: workerForm.default_rate.trim() || null,
      home_area: workerForm.home_area.trim() || null,
      status: workerForm.status,
      notes: workerForm.notes.trim() || null,
      is_active: !!workerForm.is_active,
    }
    const url = editingWorkerId ? `/api/labor/workers/${editingWorkerId}` : '/api/labor/workers'
    const method = editingWorkerId ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json?.error || 'Không lưu được nhân công')
      return
    }
    setToast(editingWorkerId ? 'Đã cập nhật nhân công' : 'Đã tạo nhân công')
    resetWorkerForm()
    await loadAll()
  }

  if (loading) {
    return <div style={{ padding: 16 }}>Đang tải dữ liệu...</div>
  }

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)' }}>NHÂN CÔNG</div>
          <h1 style={{ margin: '4px 0 4px', fontSize: 22, fontWeight: 800 }}>Quản lý nhân công</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 760 }}>
            Quản lý danh mục nền cho nghề, đội, cấp bậc tay nghề và hồ sơ nhân công. Phần chấm công, thanh toán công và giao khoán vẫn vận hành ở các trang riêng.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link className="btn-ghost" href="/labor/assignments">Phân công khoán việc</Link>
          <Link className="btn-ghost" href="/labor/attendance">Chấm công</Link>
          <Link className="btn-ghost" href="/labor/payments">Thanh toán công</Link>
          <Link className="btn-ghost" href="/labor/reports">Báo cáo nhân công</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Nghề</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{trades.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{trades.filter((x) => x.is_active).length} đang bật</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Đội</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{crews.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{crews.filter((x) => x.is_active).length} đang bật</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Cấp bậc tay nghề</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{skillLevels.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{skillLevels.filter((x) => x.is_active).length} đang bật</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Nhân công</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{workers.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{workers.filter((x) => x.is_active !== false).length} đang hoạt động</div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700 }}>Danh mục cấp bậc tay nghề</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Dùng để phân biệt thợ chính, thợ phụ... và gợi ý đơn giá mặc định, nhất là cho nhân công thuê ngoài.</div>
          </div>
          <button className="btn-ghost" onClick={resetSkillLevelForm}>Mới</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr .7fr auto', gap: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mã cấp bậc</div>
            <input className="input" value={skillLevelForm.skill_key} placeholder="Tự sinh từ tên" onChange={(e) => setSkillLevelForm((p) => ({ ...p, skill_key: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tên cấp bậc</div>
            <input
              className="input"
              value={skillLevelForm.skill_name}
              placeholder="Ví dụ: Thợ chính"
              onChange={(e) => setSkillLevelForm((p) => {
                const nextName = e.target.value
                const autoPrev = slugifyCode(p.skill_name)
                const keepAuto = !p.skill_key || p.skill_key === autoPrev
                return { ...p, skill_name: nextName, skill_key: keepAuto ? slugifyCode(nextName) : p.skill_key }
              })}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đơn giá gợi ý</div>
            <input className="input" value={skillLevelForm.default_rate} placeholder="Không bắt buộc" onChange={(e) => setSkillLevelForm((p) => ({ ...p, default_rate: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Thứ tự</div>
            <input className="input" type="number" value={skillLevelForm.sort_order} onChange={(e) => setSkillLevelForm((p) => ({ ...p, sort_order: e.target.value }))} />
          </div>
          <button className="btn-primary" onClick={submitSkillLevel}>{editingSkillLevelId ? 'Lưu sửa' : '+ Tạo'}</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr auto auto', gap: 8, marginTop: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mô tả</div>
            <input className="input" value={skillLevelForm.description} placeholder="Không bắt buộc" onChange={(e) => setSkillLevelForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, paddingTop: 20 }}>
            <input type="checkbox" checked={skillLevelForm.is_active} onChange={(e) => setSkillLevelForm((p) => ({ ...p, is_active: e.target.checked }))} />
            Hoạt động
          </label>
          {editingSkillLevelId ? <button className="btn-ghost" onClick={resetSkillLevelForm}>Hủy sửa</button> : <div />}
        </div>

        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginTop: 10 }}>
          {skillLevels.map((row) => (
            <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{row.skill_name} ({row.skill_key})</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {money(row.default_rate)} | {activeText(row.is_active)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11 }}
                  onClick={() => {
                    setEditingSkillLevelId(row.id)
                    setSkillLevelForm({
                      skill_key: row.skill_key,
                      skill_name: row.skill_name,
                      default_rate: row.default_rate || '',
                      description: row.description || '',
                      sort_order: String(row.sort_order ?? 0),
                      is_active: row.is_active,
                    })
                  }}
                >
                  Sửa
                </button>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11 }}
                  onClick={async () => {
                    await fetch(`/api/labor/skill-levels/${row.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ is_active: !row.is_active }),
                    })
                    await loadAll()
                  }}
                >
                  {row.is_active ? 'Tắt' : 'Bật'}
                </button>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11, color: 'var(--red)' }}
                  onClick={async () => {
                    if (!confirm('Xóa cấp bậc này?')) return
                    await fetch(`/api/labor/skill-levels/${row.id}`, { method: 'DELETE' })
                    await loadAll()
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
          {!skillLevels.length ? <div style={{ padding: 10, color: 'var(--text3)' }}>Chưa có cấp bậc tay nghề.</div> : null}
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700 }}>Danh mục nghề</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Mã nghề tự sinh từ tên nếu để trống. Có thể sửa mã khi cần.</div>
          </div>
          <button className="btn-ghost" onClick={resetTradeForm}>Mới</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr .7fr auto', gap: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mã nghề</div>
            <input className="input" value={tradeForm.trade_key} placeholder="Tự sinh từ tên" onChange={(e) => setTradeForm((p) => ({ ...p, trade_key: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tên nghề</div>
            <input
              className="input"
              value={tradeForm.trade_name}
              placeholder="Ví dụ: Thợ xây"
              onChange={(e) => setTradeForm((p) => {
                const nextName = e.target.value
                const autoPrev = slugifyCode(p.trade_name)
                const keepAuto = !p.trade_key || p.trade_key === autoPrev
                return { ...p, trade_name: nextName, trade_key: keepAuto ? slugifyCode(nextName) : p.trade_key }
              })}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đơn vị mặc định</div>
            <input className="input" value={tradeForm.unit_text} placeholder="Ví dụ: công, ngày, m2" onChange={(e) => setTradeForm((p) => ({ ...p, unit_text: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Thứ tự</div>
            <input className="input" type="number" value={tradeForm.sort_order} onChange={(e) => setTradeForm((p) => ({ ...p, sort_order: e.target.value }))} />
          </div>
          <button className="btn-primary" onClick={submitTrade}>{editingTradeId ? 'Lưu sửa' : '+ Tạo'}</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.1fr .7fr auto', gap: 8, marginTop: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đơn giá mặc định</div>
            <input className="input" value={tradeForm.default_rate} placeholder="Có thể để trống" onChange={(e) => setTradeForm((p) => ({ ...p, default_rate: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mô tả</div>
            <input className="input" value={tradeForm.description} placeholder="Không bắt buộc" onChange={(e) => setTradeForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, paddingTop: 20 }}>
            <input type="checkbox" checked={tradeForm.is_active} onChange={(e) => setTradeForm((p) => ({ ...p, is_active: e.target.checked }))} />
            Hoạt động
          </label>
          {editingTradeId ? <button className="btn-ghost" onClick={resetTradeForm}>Hủy sửa</button> : <div />}
        </div>

        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginTop: 10 }}>
          {trades.map((row) => (
            <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{row.trade_name} ({row.trade_key})</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {row.unit_text || '-'} | {money(row.default_rate)} | {activeText(row.is_active)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11 }}
                  onClick={() => {
                    setEditingTradeId(row.id)
                    setTradeForm({
                      trade_key: row.trade_key,
                      trade_name: row.trade_name,
                      unit_text: row.unit_text || '',
                      default_rate: row.default_rate || '',
                      description: row.description || '',
                      sort_order: String(row.sort_order ?? 0),
                      is_active: row.is_active,
                    })
                  }}
                >
                  Sửa
                </button>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11 }}
                  onClick={async () => {
                    await fetch(`/api/labor/trades/${row.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ is_active: !row.is_active }),
                    })
                    await loadAll()
                  }}
                >
                  {row.is_active ? 'Tắt' : 'Bật'}
                </button>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11, color: 'var(--red)' }}
                  onClick={async () => {
                    if (!confirm('Xóa nghề này?')) return
                    await fetch(`/api/labor/trades/${row.id}`, { method: 'DELETE' })
                    await loadAll()
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
          {!trades.length ? <div style={{ padding: 10, color: 'var(--text3)' }}>Chưa có nghề.</div> : null}
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700 }}>Danh mục đội</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Mã đội tự sinh từ tên nếu để trống. Tổ trưởng và số điện thoại chỉ là thông tin tham khảo nhanh.</div>
          </div>
          <button className="btn-ghost" onClick={resetCrewForm}>Mới</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr 1fr .7fr auto', gap: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mã đội</div>
            <input className="input" value={crewForm.crew_key} placeholder="Tự sinh từ tên" onChange={(e) => setCrewForm((p) => ({ ...p, crew_key: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tên đội</div>
            <input
              className="input"
              value={crewForm.crew_name}
              placeholder="Ví dụ: Tổ xây A"
              onChange={(e) => setCrewForm((p) => {
                const nextName = e.target.value
                const autoPrev = slugifyCode(p.crew_name)
                const keepAuto = !p.crew_key || p.crew_key === autoPrev
                return { ...p, crew_name: nextName, crew_key: keepAuto ? slugifyCode(nextName) : p.crew_key }
              })}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tổ trưởng</div>
            <input className="input" value={crewForm.leader_name} placeholder="Không bắt buộc" onChange={(e) => setCrewForm((p) => ({ ...p, leader_name: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Điện thoại</div>
            <input className="input" value={crewForm.phone} placeholder="Không bắt buộc" onChange={(e) => setCrewForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Thứ tự</div>
            <input className="input" type="number" value={crewForm.sort_order} onChange={(e) => setCrewForm((p) => ({ ...p, sort_order: e.target.value }))} />
          </div>
          <button className="btn-primary" onClick={submitCrew}>{editingCrewId ? 'Lưu sửa' : '+ Tạo'}</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr auto auto', gap: 8, marginTop: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mô tả</div>
            <input className="input" value={crewForm.description} placeholder="Không bắt buộc" onChange={(e) => setCrewForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, paddingTop: 20 }}>
            <input type="checkbox" checked={crewForm.is_active} onChange={(e) => setCrewForm((p) => ({ ...p, is_active: e.target.checked }))} />
            Hoạt động
          </label>
          {editingCrewId ? <button className="btn-ghost" onClick={resetCrewForm}>Hủy sửa</button> : <div />}
        </div>

        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginTop: 10 }}>
          {crews.map((row) => (
            <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{row.crew_name} ({row.crew_key})</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {row.leader_name || '-'} | {row.phone || '-'} | {activeText(row.is_active)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11 }}
                  onClick={() => {
                    setEditingCrewId(row.id)
                    setCrewForm({
                      crew_key: row.crew_key,
                      crew_name: row.crew_name,
                      leader_name: row.leader_name || '',
                      phone: row.phone || '',
                      description: row.description || '',
                      sort_order: String(row.sort_order ?? 0),
                      is_active: row.is_active,
                    })
                  }}
                >
                  Sửa
                </button>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11 }}
                  onClick={async () => {
                    await fetch(`/api/labor/crews/${row.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ is_active: !row.is_active }),
                    })
                    await loadAll()
                  }}
                >
                  {row.is_active ? 'Tắt' : 'Bật'}
                </button>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11, color: 'var(--red)' }}
                  onClick={async () => {
                    if (!confirm('Xóa đội này?')) return
                    await fetch(`/api/labor/crews/${row.id}`, { method: 'DELETE' })
                    await loadAll()
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
          {!crews.length ? <div style={{ padding: 10, color: 'var(--text3)' }}>Chưa có đội.</div> : null}
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Danh mục nhân công</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Mỗi nhân công có thể gắn nghề chính, đội hiện tại, loại nhân công, cấp bậc tay nghề và hình thức làm việc. `skill_level` có thể để trống nếu chưa rõ.
            </div>
          </div>
          <button className="btn-ghost" onClick={resetWorkerForm}>Mới</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tìm nhân công</div>
            <input className="input" value={filters.q} placeholder="Tên, mã, điện thoại, khu vực..." onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Lọc theo loại nhân công</div>
            <select className="select" value={filters.worker_category} onChange={(e) => setFilters((p) => ({ ...p, worker_category: e.target.value }))}>
              <option value="">Tất cả loại nhân công</option>
              {WORKER_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Lọc theo cấp bậc</div>
            <select className="select" value={filters.skill_level_id} onChange={(e) => setFilters((p) => ({ ...p, skill_level_id: e.target.value }))}>
              <option value="">Tất cả cấp bậc</option>
              {skillLevels.filter((row) => row.is_active).map((row) => <option key={row.id} value={row.id}>{row.skill_name}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-end', gap: 8, fontSize: 12 }}>
            <input type="checkbox" checked={filters.active_only} onChange={(e) => setFilters((p) => ({ ...p, active_only: e.target.checked }))} />
            Chỉ hiện nhân công đang hoạt động
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr 1fr 1fr 1fr', gap: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mã nhân công</div>
            <input className="input" value={workerForm.worker_code} placeholder="Tự sinh từ tên" onChange={(e) => setWorkerForm((p) => ({ ...p, worker_code: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Họ tên</div>
            <input
              className="input"
              value={workerForm.full_name}
              placeholder="Ví dụ: Nguyễn Văn A"
              onChange={(e) => setWorkerForm((p) => {
                const nextName = e.target.value
                const autoPrev = slugifyCode(p.full_name)
                const keepAuto = !p.worker_code || p.worker_code === autoPrev
                return { ...p, full_name: nextName, worker_code: keepAuto ? slugifyCode(nextName) : p.worker_code }
              })}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Điện thoại</div>
            <input className="input" value={workerForm.phone} placeholder="Không bắt buộc" onChange={(e) => setWorkerForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Loại nhân công</div>
            <select
              className="select"
              value={workerForm.worker_category}
              onChange={(e) => {
                const nextCategory = e.target.value
                const currentSkill = skillLevels.find((row) => row.id === workerForm.skill_level_id)
                const nextRate = nextCategory === 'external' && !workerForm.default_rate ? (currentSkill?.default_rate || '') : workerForm.default_rate
                setWorkerForm((p) => ({ ...p, worker_category: nextCategory, default_rate: nextRate }))
              }}
            >
              <option value="">(Chưa chọn loại nhân công)</option>
              {WORKER_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Cấp bậc tay nghề</div>
            <select
              className="select"
              value={workerForm.skill_level_id}
              onChange={(e) => {
                const nextSkillLevelId = e.target.value
                setWorkerForm((p) => ({
                  ...p,
                  skill_level_id: nextSkillLevelId,
                  default_rate: applySkillRate(nextSkillLevelId, p.worker_category, p.default_rate, p.skill_level_id),
                }))
              }}
            >
              <option value="">(Để trống nếu chưa rõ)</option>
              {skillLevels.filter((row) => row.is_active).map((row) => (
                <option key={row.id} value={row.id}>{row.skill_name}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={submitWorker}>{editingWorkerId ? 'Lưu sửa' : '+ Tạo'}</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 8, marginTop: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Nghề chính</div>
            <select className="select" value={workerForm.trade_id} onChange={(e) => setWorkerForm((p) => ({ ...p, trade_id: e.target.value }))}>
              <option value="">(Chọn nghề)</option>
              {trades.map((row) => <option key={row.id} value={row.id}>{row.trade_name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đội hiện tại</div>
            <select className="select" value={workerForm.crew_id} onChange={(e) => setWorkerForm((p) => ({ ...p, crew_id: e.target.value }))}>
              <option value="">(Chọn đội)</option>
              {crews.map((row) => <option key={row.id} value={row.id}>{row.crew_name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Hình thức làm việc</div>
            <select className="select" value={workerForm.employment_mode} onChange={(e) => setWorkerForm((p) => ({ ...p, employment_mode: e.target.value }))}>
              <option value="">(Chưa chọn)</option>
              {EMPLOYMENT_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đơn vị mặc định</div>
            <input className="input" value={workerForm.default_unit_text} placeholder="Ví dụ: công, ngày" onChange={(e) => setWorkerForm((p) => ({ ...p, default_unit_text: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đơn giá mặc định</div>
            <input className="input" value={workerForm.default_rate} placeholder="Có thể để trống" onChange={(e) => setWorkerForm((p) => ({ ...p, default_rate: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto auto', gap: 8, marginTop: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Khu vực</div>
            <input className="input" value={workerForm.home_area} placeholder="Không bắt buộc" onChange={(e) => setWorkerForm((p) => ({ ...p, home_area: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Trạng thái</div>
            <select className="select" value={workerForm.status} onChange={(e) => setWorkerForm((p) => ({ ...p, status: e.target.value }))}>
              <option value="active">Đang hoạt động</option>
              <option value="paused">Tạm dừng</option>
              <option value="inactive">Ngừng</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ghi chú</div>
            <input className="input" value={workerForm.notes} placeholder="Không bắt buộc" onChange={(e) => setWorkerForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, paddingTop: 20 }}>
            <input type="checkbox" checked={workerForm.is_active} onChange={(e) => setWorkerForm((p) => ({ ...p, is_active: e.target.checked }))} />
            Hoạt động
          </label>
          {editingWorkerId ? <button className="btn-ghost" onClick={resetWorkerForm}>Hủy sửa</button> : <div />}
        </div>

        <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginTop: 10 }}>
          {filteredWorkers.map((row) => (
            <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{row.full_name} ({row.worker_code})</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {workerCategoryLabel(row.worker_category)} | {row.skill_level?.skill_name || 'Chưa có cấp bậc'} | {employmentModeLabel(row.employment_mode)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  Nghề: {row.trade?.trade_name || '-'} | Đội: {row.crew?.crew_name || '-'} | Đơn vị: {row.default_unit_text || '-'} | Đơn giá: {money(row.default_rate)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {row.phone || '-'} | {row.home_area || '-'} | {statusLabel(row.status)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11 }}
                  onClick={() => {
                    setEditingWorkerId(row.id)
                    setWorkerForm({
                      worker_code: row.worker_code,
                      full_name: row.full_name,
                      phone: row.phone || '',
                      trade_id: row.trade?.id || '',
                      crew_id: row.crew?.id || '',
                      skill_level_id: row.skill_level?.id || '',
                      worker_category: row.worker_category || 'external',
                      employment_mode: row.employment_mode || 'daily',
                      default_unit_text: row.default_unit_text || '',
                      default_rate: row.default_rate || '',
                      home_area: row.home_area || '',
                      status: row.status,
                      notes: row.notes || '',
                      is_active: row.is_active !== false,
                    })
                  }}
                >
                  Sửa
                </button>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11, color: 'var(--red)' }}
                  onClick={async () => {
                    if (!confirm('Xóa nhân công này?')) return
                    await fetch(`/api/labor/workers/${row.id}`, { method: 'DELETE' })
                    await loadAll()
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
          {!filteredWorkers.length ? <div style={{ padding: 10, color: 'var(--text3)' }}>Không có nhân công phù hợp bộ lọc.</div> : null}
        </div>
      </div>

      {toast ? (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
