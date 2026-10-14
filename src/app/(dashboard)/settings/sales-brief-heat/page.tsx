'use client'

import { useEffect, useMemo, useState } from 'react'

type HeatConfigRow = {
  id: string
  config_key: string
  config_name: string
  group_name: string
  value_type: 'number' | 'percent' | string
  config_value: string
  description?: string | null
  sort_order: number
  is_active: boolean
  is_locked: boolean
}

export default function SalesBriefHeatSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const [toast, setToast] = useState('')
  const [rows, setRows] = useState<HeatConfigRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, { config_value: string; description: string; is_active: boolean }>>({})

  async function loadData() {
    setLoading(true)
    const res = await fetch('/api/settings/sales-brief-heat?active_only=false', { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json?.error || 'Không tải được cấu hình mức độ nóng')
      setLoading(false)
      return
    }
    const nextRows = Array.isArray(json?.data) ? json.data : []
    setRows(nextRows)
    const nextDrafts: Record<string, { config_value: string; description: string; is_active: boolean }> = {}
    for (const row of nextRows) {
      nextDrafts[row.id] = {
        config_value: String(row.config_value ?? ''),
        description: String(row.description || ''),
        is_active: row.is_active !== false,
      }
    }
    setDrafts(nextDrafts)
    setLoading(false)
  }

  async function saveRow(id: string) {
    const draft = drafts[id]
    if (!draft) return
    setSavingId(id)
    const res = await fetch(`/api/settings/sales-brief-heat/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    const json = await res.json().catch(() => ({}))
    setSavingId('')
    if (!res.ok) {
      setToast(json?.error || 'Không lưu được cấu hình')
      return
    }
    setToast('Đã lưu cấu hình mức độ nóng')
    await loadData()
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const groupedRows = useMemo(() => {
    const map = new Map<string, HeatConfigRow[]>()
    for (const row of rows) {
      const list = map.get(row.group_name) || []
      list.push(row)
      map.set(row.group_name, list)
    }
    return Array.from(map.entries())
  }, [rows])

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>SETTINGS</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Cấu hình mức độ nóng brief sales</h1>
        <div style={{ marginTop: 6, color: 'var(--text3)', fontSize: 13 }}>
          Điều chỉnh điểm và ngưỡng xếp loại cho brief nội bộ sales. Hệ thống đọc trực tiếp từ DB, không dùng rule hardcode cố định.
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Hướng dẫn sử dụng</div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text3)' }}>
              Chỉ được sửa giá trị và mô tả vận hành. Mã config và tên config là chuẩn hệ thống, không cho đổi hoặc xóa.
            </div>
          </div>
          <button className="btn" onClick={() => setShowGuide((v) => !v)}>{showGuide ? 'Ẩn hướng dẫn' : 'Hiện hướng dẫn'}</button>
        </div>
        {showGuide ? (
          <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'rgba(255,255,255,0.02)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
            <div>1. Nhóm Ngân sách: quyết định khi nào phương án bị coi là vượt ngân sách nhẹ hoặc mạnh.</div>
            <div>2. Nhóm Điểm cộng / Điểm trừ: ảnh hưởng đến tổng điểm vận hành của brief.</div>
            <div>3. Nhóm Ngưỡng xếp loại: quyết định tổng điểm nào được coi là Dễ chốt, Cần nuôi thêm hoặc Cần hạ ngân sách.</div>
            <div>4. Nếu nghiệp vụ thay đổi, chỉ cần sửa giá trị ở đây rồi lưu, không cần sửa code.</div>
          </div>
        ) : null}
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {groupedRows.map(([groupName, groupRows]) => (
          <div key={groupName} className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{groupName}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {groupRows.map((row) => {
                const draft = drafts[row.id] || { config_value: row.config_value, description: row.description || '', is_active: row.is_active !== false }
                return (
                  <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .9fr .9fr auto', gap: 10, alignItems: 'end' }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Tên cấu hình</div>
                        <input className="input" value={row.config_name} disabled />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Mã cấu hình</div>
                        <input className="input" value={row.config_key} disabled />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>
                          Giá trị hiện dùng {row.value_type === 'percent' ? '(%)' : ''}
                        </div>
                        <input
                          className="input"
                          value={draft.config_value}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, config_value: e.target.value } }))}
                        />
                      </div>
                      <button
                        className="btn-primary"
                        disabled={savingId === row.id || loading}
                        onClick={() => void saveRow(row.id)}
                      >
                        {savingId === row.id ? 'Đang lưu...' : 'Lưu'}
                      </button>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Mô tả / ghi chú vận hành</div>
                      <textarea
                        className="input"
                        rows={2}
                        value={draft.description}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, description: e.target.value } }))}
                      />
                    </div>

                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
                        <input
                          type="checkbox"
                          checked={draft.is_active}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, is_active: e.target.checked } }))}
                        />
                        Đang áp dụng
                      </label>
                      <div style={{ fontSize: 11, color: 'var(--text4)' }}>
                        Khóa kỹ thuật: {row.is_locked ? 'Có' : 'Không'} | Loại giá trị: {row.value_type === 'percent' ? 'Phần trăm' : 'Số'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {loading ? <div style={{ marginTop: 12, color: 'var(--text3)' }}>Đang tải cấu hình mức độ nóng...</div> : null}
      {toast ? (
        <div style={{ position: 'fixed', right: 16, bottom: 16, background: 'rgba(15,23,42,.96)', color: '#fff', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '10px 12px', fontSize: 12, zIndex: 80 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
