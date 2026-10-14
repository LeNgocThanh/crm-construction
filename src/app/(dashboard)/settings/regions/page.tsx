'use client'

import { useEffect, useMemo, useState } from 'react'

type RegionLevel = 'province' | 'ward'

type GeoRegion = {
  id: string
  code: string
  name: string
  level: RegionLevel
  parent_code?: string | null
  source?: string | null
  source_version?: string | null
  latitude?: number | null
  longitude?: number | null
  is_active: boolean
  sort_order: number
}

type FormState = {
  level: RegionLevel
  code: string
  name: string
  parent_code: string
  source: string
  source_version: string
  latitude: string
  longitude: string
  sort_order: string
}

function emptyForm(): FormState {
  return {
    level: 'province',
    code: '',
    name: '',
    parent_code: '',
    source: 'manual',
    source_version: '',
    latitude: '',
    longitude: '',
    sort_order: '',
  }
}

function toNumberOrNull(v: string) {
  const x = String(v || '').trim()
  if (!x) return null
  const n = Number(x)
  return Number.isFinite(n) ? n : null
}

export default function RegionsPage() {
  const [items, setItems] = useState<GeoRegion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [toast, setToast] = useState('')
  const [q, setQ] = useState('')
  const [levelFilter, setLevelFilter] = useState<'all' | RegionLevel>('all')
  const [form, setForm] = useState<FormState>(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function loadAll() {
    setLoading(true)
    try {
      const sp = new URLSearchParams()
      sp.set('active_only', 'false')
      sp.set('limit', '5000')
      if (levelFilter !== 'all') sp.set('level', levelFilter)
      if (q.trim()) sp.set('q', q.trim())
      const res = await fetch(`/api/settings/regions?${sp.toString()}`)
      const json = await res.json().catch(() => ({}))
      setItems(Array.isArray(json.data) ? json.data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [levelFilter])

  const provinces = useMemo(
    () =>
      items
        .filter((x) => x.level === 'province')
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [items]
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items
      .filter((x) => (levelFilter === 'all' ? true : x.level === levelFilter))
      .filter((x) => {
        if (!needle) return true
        return x.code.toLowerCase().includes(needle) || x.name.toLowerCase().includes(needle)
      })
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  }, [items, levelFilter, q])

  function startEdit(row: GeoRegion) {
    setEditingId(row.id)
    setForm({
      level: row.level,
      code: row.code,
      name: row.name,
      parent_code: row.parent_code || '',
      source: row.source || 'manual',
      source_version: row.source_version || '',
      latitude: row.latitude != null ? String(row.latitude) : '',
      longitude: row.longitude != null ? String(row.longitude) : '',
      sort_order: String(row.sort_order || 0),
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm())
  }

  async function saveRow() {
    const code = form.code.trim()
    const name = form.name.trim()
    if (!code || !name) {
      showToast('Thieu code hoac name')
      return
    }
    if (form.level === 'ward' && !form.parent_code.trim()) {
      showToast('Ward can parent_code')
      return
    }

    setSaving(true)
    try {
      const payload = {
        level: form.level,
        code,
        name,
        parent_code: form.level === 'ward' ? form.parent_code.trim() : null,
        source: form.source.trim() || 'manual',
        source_version: form.source_version.trim() || null,
        latitude: toNumberOrNull(form.latitude),
        longitude: toNumberOrNull(form.longitude),
        sort_order: form.sort_order.trim() ? Number(form.sort_order) : 0,
      }
      const url = editingId ? `/api/settings/regions/${editingId}` : '/api/settings/regions'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        showToast(`Loi: ${j.error || 'Khong luu duoc'}`)
        return
      }
      await loadAll()
      showToast(editingId ? 'Da cap nhat region' : 'Da tao region')
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row: GeoRegion) {
    const res = await fetch(`/api/settings/regions/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !row.is_active }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showToast(`Loi: ${j.error || 'Khong cap nhat duoc trang thai'}`)
      return
    }
    await loadAll()
  }

  async function removeRow(id: string) {
    if (!confirm('Xoa region nay?')) return
    const res = await fetch(`/api/settings/regions/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showToast(`Loi: ${j.error || 'Khong xoa duoc'}`)
      return
    }
    await loadAll()
  }

  async function runSeed() {
    setSeeding(true)
    try {
      const res = await fetch('/api/settings/regions/seed', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(`Loi seed: ${json.error || 'Khong seed duoc'}`)
        return
      }
      showToast(`Seed xong: ${json?.data?.provinces || 0} provinces, ${json?.data?.wards || 0} wards`)
      await loadAll()
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text3)', marginBottom: 4 }}>GEO REGIONS</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Quan tri vung dia ly</h1>
      </div>

      {toast && <div style={{ marginBottom: 12, color: 'var(--green)' }}>{toast}</div>}

      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Seed dataset thanglequoc</h3>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
          Nguon: <code>thanglequoc/vietnamese-provinces-database</code> (file vn_only_simplified_json_generated_data_vn_units_minified.json)
        </div>
        <button className="btn btn-primary" disabled={seeding} onClick={runSeed}>
          {seeding ? 'Dang seed...' : 'Seed dữ liệu Việt Nam'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>{editingId ? 'Cap nhat region' : 'Them region'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Level</div>
            <select className="select" value={form.level} onChange={(e) => setForm((p) => ({ ...p, level: e.target.value as RegionLevel }))}>
              <option value="province">province</option>
              <option value="ward">ward</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Code</div>
            <input className="input" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Name</div>
            <input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Sort</div>
            <input className="input" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Parent province</div>
            <select
              className="select"
              disabled={form.level !== 'ward'}
              value={form.parent_code}
              onChange={(e) => setForm((p) => ({ ...p, parent_code: e.target.value }))}
            >
              <option value="">(none)</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Lat</div>
            <input className="input" value={form.latitude} onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Lng</div>
            <input className="input" value={form.longitude} onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Source</div>
            <input className="input" value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Source version</div>
            <input className="input" value={form.source_version} onChange={(e) => setForm((p) => ({ ...p, source_version: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" disabled={saving} onClick={saveRow}>
            {editingId ? 'Lưu cập nhật' : 'Thêm region'}
          </button>
          {editingId && (
            <button className="btn btn-ghost" onClick={resetForm}>
              Hủy sửa
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr .7fr auto auto', gap: 8, marginBottom: 10 }}>
          <input className="input" placeholder="Search code/name..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="select" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as 'all' | RegionLevel)}>
            <option value="all">all</option>
            <option value="province">province</option>
            <option value="ward">ward</option>
          </select>
          <button className="btn btn-ghost" onClick={loadAll}>Refresh</button>
          <div style={{ fontSize: 12, color: 'var(--text3)', alignSelf: 'center', textAlign: 'right' }}>{filtered.length} rows</div>
        </div>

        {loading ? (
          <div style={{ padding: 14 }}>Đang tải...</div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {/* Header - Đồng bộ 10 cột */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '.7fr .8fr 1.6fr .8fr .9fr .6fr .8fr 160px',
              gap: 8,
              padding: '10px 12px',
              background: 'var(--bg2, rgba(0,0,0,0.04))',
              borderBottom: '1px solid var(--border)',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>CẤP</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>MÃ</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>TÊN VÙNG MIỀN</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>CHA</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>NGUỒN</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>STT</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>TRẠNG THÁI</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>THAO TÁC</div>
            </div>

            {/* Body */}
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {filtered.map((x) => (
                <div
                  key={x.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '.7fr .8fr 1.6fr .8fr .9fr .6fr .8fr 160px',
                    gap: 8,
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--border)',
                    alignItems: 'center',
                    background: x.is_active ? 'transparent' : 'var(--bg-dim)',
                    // Highlight nhẹ dòng Province để phân đoạn
                    borderLeft: x.level === 'province' ? '3px solid var(--blue)' : '3px solid transparent'
                  }}
                >
                  {/* Level với Badge màu */}
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                    <span style={{
                      color: x.level === 'province' ? 'var(--blue)' : 'var(--text3)',
                      background: x.level === 'province' ? 'rgba(var(--blue-rgb), 0.1)' : 'transparent',
                      padding: '2px 4px',
                      borderRadius: 4
                    }}>
                      {x.level}
                    </span>
                  </div>

                  {/* Code & Name */}
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{x.code}</div>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minWidth: 0
                  }} title={x.name}>
                    {x.name}
                  </div>

                  {/* Parent & Source */}
                  <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>{x.parent_code || '-'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>{x.source || '-'}</div>

                  {/* Sort Order */}
                  <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>{x.sort_order}</div>

                  {/* Status Badge */}
                  <div style={{ textAlign: 'center' }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 10,
                      background: x.is_active ? 'rgba(var(--green-rgb), 0.1)' : 'var(--bg3)',
                      color: x.is_active ? 'var(--green)' : 'var(--text4)'
                    }}>
                      {x.is_active ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>

                  {/* Actions - Gom cụm 160px */}
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    <button className="btn btn-ghost" style={{ height: 26, padding: '0 6px', fontSize: 11 }} onClick={() => startEdit(x)}>Sửa</button>
                    <button
                      className="btn btn-ghost"
                      style={{
                        height: 26,
                        padding: '0 6px',
                        fontSize: 11,
                        color: x.is_active ? 'var(--orange)' : 'var(--blue)'
                      }}
                      onClick={() => toggleActive(x)}
                    >
                      {x.is_active ? 'Tắt' : 'Bật'}
                    </button>
                    <button className="btn btn-danger" style={{ height: 26, padding: '0 6px', fontSize: 11 }} onClick={() => removeRow(x.id)}>Xóa</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
