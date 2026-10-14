'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

const C = {
  bg: '#0C1117',
  surface: '#151C24',
  surface2: '#1C2532',
  border: '#2A3441',
  blue: '#3B82F6',
  violet: '#8B5CF6',
  amber: '#F59E0B',
  orange: '#F97316',
  red: '#EF4444',
  green: '#22C55E',
  emerald: '#10B981',
  cyan: '#06B6D4',
  indigo: '#6366F1',
  teal: '#1D9E75',
  gray: '#64748B',
  slate: '#475569',
  text: '#E2EBF4',
  text2: '#94A3B8',
  text3: '#64748B',
}

const COLUMNS = [
  'Mới',
  'Đang tìm hiểu',
  'Hẹn gặp',
  'Đang thương thảo',
  'Chờ ký HĐ',
  'Đã ký HĐ',
  'Đang thi công',
  'Hoàn công',
  'Bảo hành',
  'Hoàn tất',
  'Tạm ngưng',
  'Từ chối',
] as const

type ColKey = typeof COLUMNS[number]

const GROUPS = [
  { key: 'pre', label: 'Tiếp cận', statuses: ['Mới', 'Đang tìm hiểu', 'Hẹn gặp', 'Đang thương thảo'] as ColKey[] },
  { key: 'contract', label: 'Hợp đồng', statuses: ['Chờ ký HĐ', 'Đã ký HĐ', 'Đang thi công'] as ColKey[] },
  { key: 'after', label: 'Hậu mãi', statuses: ['Hoàn công', 'Bảo hành', 'Hoàn tất'] as ColKey[] },
  { key: 'other', label: 'Khác', statuses: ['Tạm ngưng', 'Từ chối'] as ColKey[] },
]

const COL_CONFIG: Record<ColKey, { color: string; icon: string; bg: string }> = {
  'Mới': { color: C.blue, icon: '🆕', bg: '#3B82F610' },
  'Đang tìm hiểu': { color: C.violet, icon: '🔎', bg: '#8B5CF610' },
  'Hẹn gặp': { color: C.amber, icon: '📅', bg: '#F59E0B10' },
  'Đang thương thảo': { color: C.orange, icon: '🤝', bg: '#F9731610' },
  'Chờ ký HĐ': { color: C.red, icon: '📝', bg: '#EF444410' },
  'Đã ký HĐ': { color: C.green, icon: '✅', bg: '#22C55E10' },
  'Đang thi công': { color: C.emerald, icon: '🏗️', bg: '#10B98110' },
  'Hoàn công': { color: C.cyan, icon: '🏠', bg: '#06B6D410' },
  'Bảo hành': { color: C.indigo, icon: '🛠️', bg: '#6366F110' },
  'Hoàn tất': { color: C.teal, icon: '🎉', bg: '#1D9E7510' },
  'Tạm ngưng': { color: C.gray, icon: '⏸️', bg: '#64748B10' },
  'Từ chối': { color: C.slate, icon: '✖', bg: '#47556910' },
}

interface Customer {
  id: string
  phone_number: string
  full_name?: string
  status: ColKey
  potential_score?: number
  total_contacts: number
  updated_at: string
}

function emptyColumns(): Record<ColKey, Customer[]> {
  return {
    'Mới': [],
    'Đang tìm hiểu': [],
    'Hẹn gặp': [],
    'Đang thương thảo': [],
    'Chờ ký HĐ': [],
    'Đã ký HĐ': [],
    'Đang thi công': [],
    'Hoàn công': [],
    'Bảo hành': [],
    'Hoàn tất': [],
    'Tạm ngưng': [],
    'Từ chối': [],
  }
}

const scoreColor = (score?: number) =>
  !score ? C.text3 : score >= 7 ? C.green : score >= 4 ? C.orange : C.red

export default function PipelinePage() {
  const [columns, setColumns] = useState<Record<ColKey, Customer[]>>(emptyColumns())
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState<{ id: string; fromCol: ColKey } | null>(null)
  const [dragOver, setDragOver] = useState<ColKey | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/pipeline')
      .then((r) => r.json())
      .then((data) => {
        setColumns({ ...emptyColumns(), ...(data.columns || {}) })
        setLoading(false)
      })
  }, [])

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  function onDragStart(e: React.DragEvent, id: string, fromCol: ColKey) {
    setDragging({ id, fromCol })
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e: React.DragEvent, col: ColKey) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(col)
  }

  async function onDrop(e: React.DragEvent, toCol: ColKey) {
    e.preventDefault()
    setDragOver(null)
    if (!dragging || dragging.fromCol === toCol) {
      setDragging(null)
      return
    }

    const { id, fromCol } = dragging
    setDragging(null)
    const customer = columns[fromCol].find((item) => item.id === id)
    if (!customer) return

    setColumns((prev) => ({
      ...prev,
      [fromCol]: prev[fromCol].filter((item) => item.id !== id),
      [toCol]: [{ ...customer, status: toCol }, ...prev[toCol]],
    }))

    const res = await fetch('/api/pipeline', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: toCol }),
    })

    if (res.ok) {
      showToast(`${customer.full_name || customer.phone_number} → ${toCol}`)
      return
    }

    setColumns((prev) => ({
      ...prev,
      [fromCol]: [{ ...customer, status: fromCol }, ...prev[fromCol]],
      [toCol]: prev[toCol].filter((item) => item.id !== id),
    }))
    showToast('Cập nhật thất bại', false)
  }

  const q = search.trim().toLowerCase()
  const filteredColumns = useMemo(() => {
    const next = emptyColumns()
    COLUMNS.forEach((col) => {
      next[col] = q
        ? columns[col].filter((c) =>
            c.phone_number.toLowerCase().includes(q) ||
            c.full_name?.toLowerCase().includes(q)
          )
        : columns[col]
    })
    return next
  }, [columns, q])

  const totalAll = COLUMNS.reduce((sum, col) => sum + columns[col].length, 0)

  return (
    <div className="fade-up" style={{ height: 'calc(100vh - 56px - 28px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2.5, color: C.text3, marginBottom: 4 }}>PIPELINE</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Kanban</h1>
          <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>{totalAll} khách hàng · kéo thả để đổi trạng thái</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.text3, pointerEvents: 'none' }}>🔍</span>
            <input className="input" style={{ paddingLeft: 32, maxWidth: 240 }} placeholder="Lọc tên, SĐT..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Link href="/customers">
            <button className="btn-ghost" style={{ fontSize: 13 }}>Danh sách KH</button>
          </Link>
          <Link href="/customers/create">
            <button className="btn-primary" style={{ fontSize: 13 }}>+ Thêm KH</button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflowY: 'auto', paddingRight: 2 }}>
          {GROUPS.map((group) => (
            <div key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
                <div style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: C.text2, fontWeight: 800 }}>{group.label}</div>
                <div style={{ fontSize: 11, color: C.text3 }}>
                  {group.statuses.reduce((sum, status) => sum + columns[status].length, 0)} khách hàng
                </div>
              </div>

              <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
                <div style={{ display: 'flex', gap: 12, minWidth: 'max-content', alignItems: 'stretch' }}>
                  {group.statuses.map((col) => {
                    const cfg = COL_CONFIG[col]
                    const cards = filteredColumns[col]
                    const isDragTarget = dragOver === col

                    return (
                      <div
                        key={col}
                        onDragOver={(e) => onDragOver(e, col)}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={(e) => onDrop(e, col)}
                        style={{
                          width: 300,
                          display: 'flex',
                          flexDirection: 'column',
                          background: isDragTarget ? cfg.bg : C.surface2,
                          border: `2px solid ${isDragTarget ? cfg.color : C.border}`,
                          borderRadius: 12,
                          transition: 'border-color .15s, background .15s',
                          overflow: 'hidden',
                          minHeight: 240,
                        }}
                      >
                        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                              <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{col}</span>
                            </div>
                            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: cfg.color, background: `${cfg.color}15`, padding: '2px 8px', borderRadius: 5 }}>
                              {columns[col].length}
                            </div>
                          </div>
                          <div style={{ marginTop: 8, height: 3, background: C.bg, borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${totalAll > 0 ? (columns[col].length / totalAll) * 100 : 0}%`, background: cfg.color, borderRadius: 2 }} />
                          </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {cards.length === 0 && !isDragTarget && (
                            <div style={{ textAlign: 'center', color: C.text3, fontSize: 12, padding: '24px 0', opacity: 0.6 }}>
                              {q ? 'Không tìm thấy' : 'Chưa có khách hàng'}
                            </div>
                          )}
                          {isDragTarget && cards.length === 0 && (
                            <div style={{ textAlign: 'center', color: cfg.color, fontSize: 12, padding: '24px 0', border: `2px dashed ${cfg.color}40`, borderRadius: 8 }}>
                              Thả vào đây
                            </div>
                          )}

                          {cards.map((c) => (
                            <div
                              key={c.id}
                              draggable
                              onDragStart={(e) => onDragStart(e, c.id, col)}
                              style={{
                                background: C.surface,
                                border: `1px solid ${C.border}`,
                                borderRadius: 10,
                                padding: '11px 13px',
                                cursor: 'grab',
                                userSelect: 'none',
                                opacity: dragging?.id === c.id ? 0.4 : 1,
                                transition: 'opacity .15s, box-shadow .15s',
                                boxShadow: dragging?.id === c.id ? 'none' : '0 1px 3px rgba(0,0,0,0.2)',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {c.full_name || <span style={{ color: C.text3, fontStyle: 'italic', fontWeight: 400 }}>Chưa có tên</span>}
                                  </div>
                                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: C.blue, marginTop: 1 }}>{c.phone_number}</div>
                                </div>
                                {c.potential_score && (
                                  <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginLeft: 6, background: `${scoreColor(c.potential_score)}15`, border: `1.5px solid ${scoreColor(c.potential_score)}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 800, color: scoreColor(c.potential_score) }}>{c.potential_score}</span>
                                  </div>
                                )}
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: C.text3 }}>📞 {c.total_contacts} lần</span>
                                <Link href={`/customers/${c.id}`} onClick={(e) => e.stopPropagation()}>
                                  <span style={{ fontSize: 10, color: cfg.color, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", letterSpacing: 0.5 }}>
                                    CHI TIẾT →
                                  </span>
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            background: toast.ok ? '#22C55E' : C.red,
            color: '#fff',
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: `0 8px 24px ${toast.ok ? '#22C55E40' : '#EF444440'}`,
          }}
        >
          {toast.ok ? '✓' : '✕'} {toast.msg}
        </div>
      )}
    </div>
  )
}
