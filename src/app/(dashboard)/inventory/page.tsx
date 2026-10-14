'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Warehouse = {
  id: string
  warehouse_code: string
  warehouse_name: string
}

type WarehouseSummary = {
  warehouse_id: string
  warehouse_name: string
  warehouse_code: string
  stock_value: number
  material_count: number
  low_stock_count: number
}

type MaterialSummary = {
  material_key: string
  material_name?: string | null
  item_unit?: string | null
  total_qty: number
  stock_value: number
  warehouse_count: number
}

type MovementMaterialSummary = {
  material_key: string
  material_name?: string | null
  item_unit?: string | null
  inbound_qty: number
  outbound_qty: number
  adjust_increase_qty: number
  adjust_decrease_qty: number
  movement_qty: number
  txn_count: number
}

type LowStockRow = {
  id: string
  warehouse_id: string
  warehouse_name: string
  warehouse_code: string
  material_key: string
  material_name?: string | null
  item_unit?: string | null
  on_hand_qty: number
  available_qty: number
  min_qty?: number | null
  stock_value: number
  last_in_at?: string | null
  last_out_at?: string | null
  updated_at?: string | null
}

type StaleStockRow = LowStockRow & {
  last_movement_at?: string | null
  days_idle: number
}

type AgingDraftRow = {
  id: string
  txn_code: string
  warehouse_name: string
  warehouse_code?: string
  txn_type?: string | null
  status?: string | null
  txn_date?: string | null
  created_at?: string | null
  note?: string | null
  item_count: number
  total_qty: number
  supplier_name?: string | null
  days_open: number
}

type PriceSpikeRow = {
  material_key: string
  material_name?: string | null
  item_unit?: string | null
  warehouse_name: string
  supplier_name?: string | null
  latest_price: number
  previous_price: number
  increase_percent: number
  effective_at?: string | null
}

type ProjectDemandRiskRow = {
  project_id: string
  project_name: string
  plan_id: string
  plan_name: string
  material_key: string
  material_name: string
  item_unit?: string | null
  planned_qty: number
  received_qty: number
  shortage_qty: number
  available_stock_qty: number
  risk_level: string
}

type RecentTxn = {
  id: string
  txn_code: string
  warehouse_name: string
  txn_type?: string | null
  status?: string | null
  txn_date?: string | null
  note?: string | null
  item_count: number
  total_qty: number
  supplier_name?: string | null
}

type DashboardData = {
  filters?: {
    warehouse_id?: string | null
    date_from?: string | null
    date_to?: string | null
  }
  summary?: {
    warehouse_count: number
    stock_row_count: number
    material_count: number
    total_on_hand_qty: number
    total_available_qty: number
    total_stock_value: number
    low_stock_count: number
    draft_txn_count: number
    posted_txn_count: number
    cancelled_txn_count: number
    inbound_posted_count: number
    outbound_posted_count: number
    adjust_posted_count: number
    inbound_qty_total: number
    outbound_qty_total: number
    adjust_increase_qty_total: number
    adjust_decrease_qty_total: number
    inbound_value_total: number
    stale_stock_count: number
    aging_draft_count: number
    price_spike_count: number
    project_demand_risk_count: number
    project_issue_draft_count: number
    supplier_risk_count: number
  }
  top_warehouses: WarehouseSummary[]
  top_materials: MaterialSummary[]
  top_movement_materials: MovementMaterialSummary[]
  low_stock_rows: LowStockRow[]
  stale_stock_rows: StaleStockRow[]
  aging_draft_rows: AgingDraftRow[]
  price_spike_rows: PriceSpikeRow[]
  supplier_risk_rows?: Array<{
    supplier_id?: string | null
    supplier_name?: string | null
    risk_kind?: string | null
    severity?: string | null
    material_key?: string | null
    material_name?: string | null
    warehouse_name?: string | null
    reference_code?: string | null
    metric_value?: number | null
    detail_text?: string | null
    event_at?: string | null
  }>
  project_demand_risk_rows: ProjectDemandRiskRow[]
  recent_inbound_transactions: RecentTxn[]
  recent_outbound_transactions: RecentTxn[]
}

const EMPTY_SUMMARY = {
  warehouse_count: 0,
  stock_row_count: 0,
  material_count: 0,
  total_on_hand_qty: 0,
  total_available_qty: 0,
  total_stock_value: 0,
  low_stock_count: 0,
  draft_txn_count: 0,
  posted_txn_count: 0,
  cancelled_txn_count: 0,
  inbound_posted_count: 0,
  outbound_posted_count: 0,
  adjust_posted_count: 0,
  inbound_qty_total: 0,
  outbound_qty_total: 0,
  adjust_increase_qty_total: 0,
  adjust_decrease_qty_total: 0,
  inbound_value_total: 0,
  stale_stock_count: 0,
  aging_draft_count: 0,
  price_spike_count: 0,
  project_demand_risk_count: 0,
  project_issue_draft_count: 0,
  supplier_risk_count: 0,
}

function toInputDate(value: Date) {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatMoney(value?: number | null) {
  return `${Number(value || 0).toLocaleString('vi-VN')} vnd`
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

function txnTypeLabel(value?: string | null) {
  switch (value) {
    case 'in': return 'Nhập kho'
    case 'out': return 'Xuất kho'
    case 'adjust': return 'Điều chỉnh'
    case 'transfer_in': return 'Nhập chuyển kho'
    case 'transfer_out': return 'Xuất chuyển kho'
    default: return value || '-'
  }
}

function statusLabel(value?: string | null) {
  switch (value) {
    case 'draft': return 'Nháp'
    case 'posted': return 'Đã ghi sổ'
    case 'cancelled': return 'Đã hủy'
    default: return value || '-'
  }
}

function severityBadge(level: 'ok' | 'warning' | 'critical', label: string) {
  const palette =
    level === 'critical'
      ? { bg: 'rgba(239,68,68,0.12)', color: 'var(--red)', border: 'rgba(239,68,68,0.28)' }
      : level === 'warning'
        ? { bg: 'rgba(245,158,11,0.12)', color: 'var(--orange)', border: 'rgba(245,158,11,0.28)' }
        : { bg: 'rgba(34,197,94,0.12)', color: 'var(--green)', border: 'rgba(34,197,94,0.28)' }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: 999,
        background: palette.bg,
        color: palette.color,
        border: `1px solid ${palette.border}`,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function tooltipMark(text: string) {
  return (
    <span
      title={text}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        borderRadius: 999,
        border: '1px solid var(--border)',
        color: 'var(--text3)',
        fontSize: 10,
        cursor: 'help',
        marginLeft: 6,
      }}
    >
      i
    </span>
  )
}

export default function InventoryDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [creatingPlanId, setCreatingPlanId] = useState('')
  const [hiddenPriorityKeys, setHiddenPriorityKeys] = useState<string[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [data, setData] = useState<DashboardData>({
    top_warehouses: [],
    top_materials: [],
  top_movement_materials: [],
  low_stock_rows: [],
  stale_stock_rows: [],
  aging_draft_rows: [],
  price_spike_rows: [],
  supplier_risk_rows: [],
  project_demand_risk_rows: [],
  recent_inbound_transactions: [],
  recent_outbound_transactions: [],
  })
  const [filters, setFilters] = useState({
    warehouse_id: '',
    date_from: toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    date_to: toInputDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)),
  })

  async function loadWarehouses() {
    const res = await fetch('/api/settings/warehouses?active_only=true', { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    setWarehouses(Array.isArray(json?.data) ? json.data : [])
  }

  async function loadDashboard(nextFilters = filters) {
    setLoading(true)
    try {
      const sp = new URLSearchParams()
      if (nextFilters.warehouse_id) sp.set('warehouse_id', nextFilters.warehouse_id)
      if (nextFilters.date_from) sp.set('date_from', new Date(nextFilters.date_from).toISOString())
      if (nextFilters.date_to) sp.set('date_to', new Date(nextFilters.date_to).toISOString())
      const res = await fetch(`/api/inventory/dashboard?${sp.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast(json?.error || 'Không tải được dashboard kho')
        return
      }
      setData({
        filters: json?.filters || {},
        summary: json?.summary || EMPTY_SUMMARY,
        top_warehouses: Array.isArray(json?.top_warehouses) ? json.top_warehouses : [],
        top_materials: Array.isArray(json?.top_materials) ? json.top_materials : [],
        top_movement_materials: Array.isArray(json?.top_movement_materials) ? json.top_movement_materials : [],
        low_stock_rows: Array.isArray(json?.low_stock_rows) ? json.low_stock_rows : [],
        stale_stock_rows: Array.isArray(json?.stale_stock_rows) ? json.stale_stock_rows : [],
        aging_draft_rows: Array.isArray(json?.aging_draft_rows) ? json.aging_draft_rows : [],
        price_spike_rows: Array.isArray(json?.price_spike_rows) ? json.price_spike_rows : [],
        supplier_risk_rows: Array.isArray(json?.supplier_risk_rows) ? json.supplier_risk_rows : [],
        project_demand_risk_rows: Array.isArray(json?.project_demand_risk_rows) ? json.project_demand_risk_rows : [],
        recent_inbound_transactions: Array.isArray(json?.recent_inbound_transactions) ? json.recent_inbound_transactions : [],
        recent_outbound_transactions: Array.isArray(json?.recent_outbound_transactions) ? json.recent_outbound_transactions : [],
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadWarehouses()
    void loadDashboard()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('inventory-dashboard-priority-hidden-v1')
      const parsed = raw ? JSON.parse(raw) : []
      setHiddenPriorityKeys(Array.isArray(parsed) ? parsed.map((x) => String(x)) : [])
    } catch {
      setHiddenPriorityKeys([])
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('inventory-dashboard-priority-hidden-v1', JSON.stringify(hiddenPriorityKeys))
    } catch {}
  }, [hiddenPriorityKeys])

  const summary = data.summary || EMPTY_SUMMARY
  const selectedWarehouseName = useMemo(
    () => warehouses.find((row) => row.id === filters.warehouse_id)?.warehouse_name || 'Tất cả kho',
    [warehouses, filters.warehouse_id]
  )

  const cardStyle: React.CSSProperties = {
    padding: 12,
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'var(--panel)',
  }

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    fontSize: 11,
    color: 'var(--text3)',
    padding: '8px 10px',
    borderBottom: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.02)',
  }

  const tdStyle: React.CSSProperties = {
    padding: '9px 10px',
    borderBottom: '1px solid var(--border)',
    fontSize: 12,
    verticalAlign: 'top',
  }

  const cardLinkStyle: React.CSSProperties = {
    color: 'inherit',
    textDecoration: 'none',
    display: 'block',
  }

  const warningCardStyle = (count: number, level: 'warning' | 'critical'): React.CSSProperties => {
    const active = Number(count || 0) > 0
    if (!active) return cardStyle
    if (level === 'critical') {
      return {
        ...cardStyle,
        border: '1px solid rgba(239,68,68,0.35)',
        background: 'linear-gradient(180deg, rgba(239,68,68,0.16), rgba(17,24,39,0.96))',
        boxShadow: '0 0 0 1px rgba(239,68,68,0.08) inset',
      }
    }
    return {
      ...cardStyle,
      border: '1px solid rgba(245,158,11,0.35)',
      background: 'linear-gradient(180deg, rgba(245,158,11,0.14), rgba(17,24,39,0.96))',
      boxShadow: '0 0 0 1px rgba(245,158,11,0.08) inset',
    }
  }

  const buildStocksLink = (row: { warehouse_id?: string | null; material_key?: string | null; low_only?: boolean }) => {
    const sp = new URLSearchParams()
    if (row.warehouse_id) sp.set('warehouse_id', String(row.warehouse_id))
    if (row.material_key) sp.set('material_key', String(row.material_key))
    if (row.low_only) sp.set('low_only', 'true')
    return `/inventory/stocks?${sp.toString()}`
  }

  const buildPricesLink = (row: { warehouse_name?: string | null; material_key?: string | null }) => {
    const sp = new URLSearchParams()
    if (row.material_key) sp.set('material_key', String(row.material_key))
    if (filters.date_from) sp.set('date_from', filters.date_from)
    if (filters.date_to) sp.set('date_to', filters.date_to)
    return `/inventory/prices?${sp.toString()}`
  }

  const buildTransactionsLink = (row: { txn_code?: string | null }) => {
    const sp = new URLSearchParams()
    sp.set('status', 'draft')
    if (row.txn_code) sp.set('q', String(row.txn_code))
    return `/inventory/transactions?${sp.toString()}`
  }

  const buildDraftTransactionsLink = () => {
    const sp = new URLSearchParams()
    sp.set('status', 'draft')
    if (filters.warehouse_id) sp.set('warehouse_id', filters.warehouse_id)
    return `/inventory/transactions?${sp.toString()}`
  }

  const buildPriceDashboardLink = () => {
    const sp = new URLSearchParams()
    if (filters.date_from) sp.set('date_from', filters.date_from)
    if (filters.date_to) sp.set('date_to', filters.date_to)
    if (filters.warehouse_id) sp.set('warehouse_id', filters.warehouse_id)
    return `/inventory/prices?${sp.toString()}`
  }

  const buildDashboardExportLink = () => {
    const sp = new URLSearchParams()
    if (filters.warehouse_id) sp.set('warehouse_id', filters.warehouse_id)
    if (filters.date_from) sp.set('date_from', new Date(filters.date_from).toISOString())
    if (filters.date_to) sp.set('date_to', new Date(filters.date_to).toISOString())
    return `/api/inventory/dashboard/export?${sp.toString()}`
  }

  const buildDashboardPrintLink = () => {
    const sp = new URLSearchParams()
    if (filters.warehouse_id) sp.set('warehouse_id', filters.warehouse_id)
    if (filters.date_from) sp.set('date_from', new Date(filters.date_from).toISOString())
    if (filters.date_to) sp.set('date_to', new Date(filters.date_to).toISOString())
    sp.set('print', '1')
    return `/api/inventory/dashboard/print?${sp.toString()}`
  }

  async function createIssueDraft(row: ProjectDemandRiskRow) {
    if (!filters.warehouse_id) {
      setToast('Hãy chọn kho trong bộ lọc trước khi tạo phiếu xuất nhanh')
      return
    }
    setCreatingPlanId(row.plan_id)
    try {
      const res = await fetch(`/api/projects/${row.project_id}/resource-plans/${row.plan_id}/generate-issue-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouse_id: filters.warehouse_id,
          mode: 'remaining',
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast(json?.error || 'Không tạo được phiếu xuất nhanh')
        return
      }
      const txnCode = String(json?.data?.txn_code || '')
      setToast(txnCode ? `Đã tạo phiếu xuất nháp: ${txnCode}` : 'Đã tạo phiếu xuất nháp')
      await loadDashboard(filters)
      if (txnCode) {
        window.open(`/inventory/transactions?status=draft&q=${encodeURIComponent(txnCode)}`, '_blank')
      }
    } finally {
      setCreatingPlanId('')
    }
  }

  const priorityItems = useMemo(() => {
    const items: Array<{
      key: string
      level: 'critical' | 'warning'
      title: string
      detail: string
      href?: string
      actionLabel?: string
      actionKind?: 'link' | 'create_issue'
      row?: ProjectDemandRiskRow
    }> = []

    data.project_demand_risk_rows.slice(0, 5).forEach((row) => {
      items.push({
        key: `project-${row.plan_id}-${row.material_key}`,
        level: row.risk_level === 'critical' ? 'critical' : 'warning',
        title: `${row.project_name} - ${row.material_name}`,
        detail: `Kế hoạch ${row.plan_name}: thiếu ${Number(row.shortage_qty || 0).toLocaleString('vi-VN')} ${row.item_unit || ''}, tồn khả dụng ${Number(row.available_stock_qty || 0).toLocaleString('vi-VN')} ${row.item_unit || ''}`.trim(),
        href: `/projects/${row.project_id}/operations`,
        actionLabel: 'Tạo phiếu',
        actionKind: 'create_issue',
        row,
      })
    })

    data.low_stock_rows.slice(0, 5).forEach((row) => {
      items.push({
        key: `low-${row.id}`,
        level: Number(row.available_qty || 0) <= 0 ? 'critical' : 'warning',
        title: `${row.warehouse_name} - ${row.material_name || row.material_key}`,
        detail: `Tồn ${Number(row.on_hand_qty || 0).toLocaleString('vi-VN')} / min ${Number(row.min_qty || 0).toLocaleString('vi-VN')} ${row.item_unit || ''}`.trim(),
        href: buildStocksLink({ ...row, low_only: true }),
        actionLabel: 'Mở tồn kho',
        actionKind: 'link',
      })
    })

    data.aging_draft_rows.slice(0, 3).forEach((row) => {
      items.push({
        key: `draft-${row.id}`,
        level: row.days_open >= 7 ? 'critical' : 'warning',
        title: `${row.txn_code} - ${txnTypeLabel(row.txn_type)}`,
        detail: `Để ${row.days_open} ngày tại ${row.warehouse_name}`,
        href: buildTransactionsLink(row),
        actionLabel: 'Mở phiếu',
        actionKind: 'link',
      })
    })

    data.price_spike_rows.slice(0, 3).forEach((row) => {
      items.push({
        key: `price-${row.material_key}-${row.warehouse_name}`,
        level: row.increase_percent >= 30 ? 'critical' : 'warning',
        title: `${row.material_name || row.material_key} - giá tăng`,
        detail: `${row.warehouse_name}: ${Number(row.increase_percent || 0).toLocaleString('vi-VN')}%`,
        href: buildPricesLink(row),
        actionLabel: 'Mở biến động giá',
        actionKind: 'link',
      })
    })

    data.stale_stock_rows.slice(0, 3).forEach((row) => {
      items.push({
        key: `stale-${row.warehouse_id}-${row.material_key}`,
        level: row.days_idle >= 90 ? 'critical' : 'warning',
        title: `${row.material_name || row.material_key} - đứng yên`,
        detail: `${row.warehouse_name}: ${row.days_idle} ngày không biến động`,
        href: buildStocksLink(row),
        actionLabel: 'Mở tồn kho',
        actionKind: 'link',
      })
    })

    return items
      .sort((a, b) => {
        if (a.level !== b.level) return a.level === 'critical' ? -1 : 1
        return a.title.localeCompare(b.title)
      })
      .slice(0, 5)
  }, [data, filters.warehouse_id, filters.date_from, filters.date_to])

  const visiblePriorityItems = useMemo(
    () => priorityItems.filter((item) => !hiddenPriorityKeys.includes(item.key)),
    [priorityItems, hiddenPriorityKeys]
  )

  function hidePriorityItem(key: string) {
    setHiddenPriorityKeys((prev) => (prev.includes(key) ? prev : [...prev, key]))
  }

  function resetHiddenPriorityItems() {
    setHiddenPriorityKeys([])
  }

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>KHO</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Dashboard kho vật tư</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, maxWidth: 860 }}>
            Dashboard này giúp xem nhanh tồn kho, giá trị tồn, cảnh báo dưới mức tối thiểu và biến động nhập xuất điều chỉnh trong kỳ.
            Người vận hành và kế toán mở vào là thấy ngay kho nào đang có vấn đề và phiếu nào cần xử lý.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="btn-ghost" href={buildDashboardExportLink()}>Xuất Excel cảnh báo</a>
          <a className="btn-ghost" href={buildDashboardPrintLink()} target="_blank" rel="noreferrer">In / xuất PDF cảnh báo</a>
          <Link className="btn-ghost" href="/inventory/transactions">Mở phiếu kho</Link>
          <Link className="btn-ghost" href="/inventory/stocks">Mở tồn kho</Link>
          <Link className="btn-ghost" href="/inventory/prices">Mở biến động giá</Link>
          <Link className="btn-ghost" href="/settings/warehouses">Cấu hình kho</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Bộ lọc dashboard</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Kho</div>
            <select className="select" value={filters.warehouse_id} onChange={(e) => setFilters((prev) => ({ ...prev, warehouse_id: e.target.value }))}>
              <option value="">Tất cả kho</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.warehouse_name} ({warehouse.warehouse_code})
                </option>
              ))}
            </select>
          </div>
          <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Từ ngày</div>
            <input className="input" type="date" value={filters.date_from} onChange={(e) => setFilters((prev) => ({ ...prev, date_from: e.target.value }))} />
          </div>
          <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đến ngày</div>
            <input className="input" type="date" value={filters.date_to} onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))} />
          </div>
          <button className="btn-primary" onClick={() => void loadDashboard(filters)}>Xem dashboard</button>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12, border: '1px solid rgba(239,68,68,0.18)', background: 'linear-gradient(180deg, rgba(239,68,68,0.08), rgba(17,24,39,0.96))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800 }}>Ưu tiên xử lý</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
              Gom 5 cảnh báo nặng nhất để đội kho vào là biết việc cần xử lý trước.
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {filters.warehouse_id ? `Kho đang áp dụng tạo phiếu nhanh: ${selectedWarehouseName}` : 'Chưa chọn kho để tạo phiếu nhanh'}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Phiếu xuất nhập đã tạo từ dự án, chưa ghi sổ: <b>{Number(summary.project_issue_draft_count || 0).toLocaleString('vi-VN')}</b>
          </div>
          {hiddenPriorityKeys.length > 0 ? (
            <button className="btn-ghost" onClick={resetHiddenPriorityItems}>Hiện lại mục đã ẩn</button>
          ) : null}
        </div>
        {!visiblePriorityItems.length ? (
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Không có cảnh báo ưu tiên nào trong kỳ đang lọc.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {visiblePriorityItems.map((item) => (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: item.level === 'critical' ? '1px solid rgba(239,68,68,0.28)' : '1px solid rgba(245,158,11,0.28)',
                  background: item.level === 'critical' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ minWidth: 0, flex: '1 1 420px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    {severityBadge(item.level, item.level === 'critical' ? 'Cần gấp' : 'Cần xử lý')}
                    <div style={{ fontWeight: 700 }}>{item.title}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{item.detail}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {item.actionKind === 'create_issue' && item.row ? (
                    <button className="btn-primary" disabled={creatingPlanId === item.row!.plan_id} onClick={() => void createIssueDraft(item.row!)}>
                      {creatingPlanId === item.row.plan_id ? 'Đang tạo...' : 'Tạo phiếu'}
                    </button>
                  ) : null}
                  {item.href ? <Link className="btn-ghost" href={item.href}>{item.actionLabel || 'Mở'}</Link> : null}
                  <button className="btn-ghost" onClick={() => hidePriorityItem(item.key)}>Ẩn tạm</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Kho đang theo dõi</div><div style={{ fontSize: 22, fontWeight: 800 }}>{summary.warehouse_count}</div><div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{selectedWarehouseName}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Mã vật tư đang có tồn</div><div style={{ fontSize: 22, fontWeight: 800 }}>{summary.material_count}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Tổng tồn khả dụng</div><div style={{ fontSize: 22, fontWeight: 800 }}>{Number(summary.total_available_qty || 0).toLocaleString('vi-VN')}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Giá trị tồn kho</div><div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(summary.total_stock_value)}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <Link href={buildStocksLink({ warehouse_id: filters.warehouse_id || null, low_only: true })} style={cardLinkStyle}><div style={warningCardStyle(summary.low_stock_count, data.low_stock_rows.some((row) => Number(row.available_qty || 0) <= 0) ? 'critical' : 'warning')}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Vật tư dưới min {tooltipMark('Vật tư có tồn hiện tại đã chạm hoặc thấp hơn mức min. Bấm vào để mở danh sách tồn kho cần bổ sung.')}</div><div style={{ fontSize: 22, fontWeight: 800, color: Number(summary.low_stock_count || 0) > 0 ? 'var(--orange)' : 'var(--green)' }}>{summary.low_stock_count}</div><div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Bấm để mở tồn kho cần xử lý</div></div></Link>
        <Link href={buildDraftTransactionsLink()} style={cardLinkStyle}><div style={warningCardStyle(summary.aging_draft_count, data.aging_draft_rows.some((row) => row.days_open >= 7) ? 'critical' : 'warning')}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Phiếu nháp để lâu {tooltipMark('Phiếu kho đang ở trạng thái nháp trong nhiều ngày, dễ gây bỏ quên ghi sổ hoặc sai tồn.')}</div><div style={{ fontSize: 22, fontWeight: 800, color: Number(summary.aging_draft_count || 0) > 0 ? 'var(--orange)' : 'var(--green)' }}>{summary.aging_draft_count}</div><div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Bấm để mở danh sách phiếu nháp</div></div></Link>
        <Link href={buildStocksLink({ warehouse_id: filters.warehouse_id || null })} style={cardLinkStyle}><div style={warningCardStyle(summary.stale_stock_count, data.stale_stock_rows.some((row) => row.days_idle >= 90) ? 'critical' : 'warning')}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Vật tư lâu không biến động {tooltipMark('Vật tư còn tồn nhưng rất lâu không nhập/xuất. Thường cần xem lại mức dự trữ, điều chuyển, hoặc giải phóng tồn.')}</div><div style={{ fontSize: 22, fontWeight: 800, color: Number(summary.stale_stock_count || 0) > 0 ? 'var(--orange)' : 'var(--green)' }}>{summary.stale_stock_count}</div><div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Bấm để xem tồn kho đứng yên</div></div></Link>
        <Link href={buildPriceDashboardLink()} style={cardLinkStyle}><div style={warningCardStyle(summary.price_spike_count, data.price_spike_rows.some((row) => Number(row.increase_percent || 0) >= 30) ? 'critical' : 'warning')}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Giá nhập tăng mạnh {tooltipMark('Đơn giá nhập gần đây tăng mạnh so với lần trước. Dùng để nhìn nhanh xu hướng tăng giá theo vật tư/NCC.')}</div><div style={{ fontSize: 22, fontWeight: 800, color: Number(summary.price_spike_count || 0) > 0 ? 'var(--orange)' : 'var(--green)' }}>{summary.price_spike_count}</div><div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Bấm để xem biến động giá</div></div></Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <div style={warningCardStyle(summary.project_demand_risk_count, data.project_demand_risk_rows.some((row) => row.risk_level === 'critical') ? 'critical' : 'warning')}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Vật tư sắp thiếu theo dự án {tooltipMark('Kế hoạch vật tư của dự án đang thiếu so với thực nhận. Có thể tạo phiếu xuất nhanh ngay từ bảng cảnh báo bên dưới.')}</div><div style={{ fontSize: 22, fontWeight: 800, color: Number(summary.project_demand_risk_count || 0) > 0 ? 'var(--orange)' : 'var(--green)' }}>{summary.project_demand_risk_count}</div><div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Phiếu xuất nhập đang mở: {Number(summary.project_issue_draft_count || 0).toLocaleString('vi-VN')}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Phiếu nháp</div><div style={{ fontSize: 22, fontWeight: 800 }}>{summary.draft_txn_count}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Phiếu đã ghi sổ</div><div style={{ fontSize: 22, fontWeight: 800 }}>{summary.posted_txn_count}</div></div>
        <div style={warningCardStyle(summary.supplier_risk_count || 0, (data.supplier_risk_rows || []).some((row) => row.severity === 'critical') ? 'critical' : 'warning')}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Cảnh báo theo NCC {tooltipMark('Tổng hợp NCC đang tăng giá mạnh hoặc đơn mua quá hạn nhận hàng nhưng chưa nhận đủ.')}</div><div style={{ fontSize: 22, fontWeight: 800, color: Number(summary.supplier_risk_count || 0) > 0 ? 'var(--orange)' : 'var(--green)' }}>{summary.supplier_risk_count || 0}</div><div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Tăng giá hoặc giao hàng chậm</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Nhập kho đã ghi sổ</div><div style={{ fontSize: 22, fontWeight: 800 }}>{summary.inbound_posted_count}</div><div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>SL: {Number(summary.inbound_qty_total || 0).toLocaleString('vi-VN')}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Xuất kho đã ghi sổ</div><div style={{ fontSize: 22, fontWeight: 800 }}>{summary.outbound_posted_count}</div><div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>SL: {Number(summary.outbound_qty_total || 0).toLocaleString('vi-VN')}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Điều chỉnh tăng</div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{Number(summary.adjust_increase_qty_total || 0).toLocaleString('vi-VN')}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Điều chỉnh giảm</div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--orange)' }}>{Number(summary.adjust_decrease_qty_total || 0).toLocaleString('vi-VN')}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Tổng hợp nhập kho trong kỳ</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>Phiếu đã ghi sổ: <b>{summary.inbound_posted_count}</b></div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>Tổng số lượng nhập: <b>{Number(summary.inbound_qty_total || 0).toLocaleString('vi-VN')}</b></div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Giá trị nhập có đơn giá: <b>{formatMoney(summary.inbound_value_total)}</b></div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Tổng hợp xuất kho trong kỳ</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>Phiếu đã ghi sổ: <b>{summary.outbound_posted_count}</b></div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>Tổng số lượng xuất: <b>{Number(summary.outbound_qty_total || 0).toLocaleString('vi-VN')}</b></div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Đã tách riêng phiếu xuất gần đây ở bảng bên dưới.</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Điều chỉnh tồn trong kỳ</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>Tăng tồn: <b style={{ color: 'var(--green)' }}>{Number(summary.adjust_increase_qty_total || 0).toLocaleString('vi-VN')}</b></div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>Giảm tồn: <b style={{ color: 'var(--orange)' }}>{Number(summary.adjust_decrease_qty_total || 0).toLocaleString('vi-VN')}</b></div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Dùng để nhìn nhanh các đợt điều chỉnh kho trong kỳ.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10, alignItems: 'center' }}>
            <div style={{ fontWeight: 700 }}>Top kho theo giá trị tồn</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Giá trị nhập có đơn giá trong kỳ: <b>{formatMoney(summary.inbound_value_total)}</b></div>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Kho</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Số vật tư</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Dưới min</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Giá trị tồn</th>
                </tr>
              </thead>
              <tbody>
                {data.top_warehouses.map((row) => (
                  <tr key={row.warehouse_id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>{row.warehouse_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.warehouse_code}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{row.material_count}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: Number(row.low_stock_count || 0) > 0 ? 'var(--orange)' : 'var(--text2)' }}>{row.low_stock_count}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{formatMoney(row.stock_value)}</td>
                  </tr>
                ))}
                {!data.top_warehouses.length ? <tr><td style={tdStyle} colSpan={4}>Không có dữ liệu kho.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Top vật tư theo giá trị tồn</div>
          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Vật tư</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Tổng tồn</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Số kho</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Giá trị tồn</th>
                </tr>
              </thead>
              <tbody>
                {data.top_materials.map((row) => (
                  <tr key={row.material_key}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>{row.material_name || row.material_key}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.material_key}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {Number(row.total_qty || 0).toLocaleString('vi-VN')}
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.item_unit || '-'}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{row.warehouse_count}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{formatMoney(row.stock_value)}</td>
                  </tr>
                ))}
                {!data.top_materials.length ? <tr><td style={tdStyle} colSpan={4}>Không có dữ liệu vật tư tồn.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Cảnh báo theo nhà cung cấp</div>
        <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>NCC</th>
                <th style={thStyle}>Loại</th>
                <th style={thStyle}>Chi tiết</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Thời điểm</th>
              </tr>
            </thead>
            <tbody>
              {(data.supplier_risk_rows || []).map((row, idx) => (
                <tr key={`${row.supplier_id || row.supplier_name || 'ncc'}-${row.risk_kind || 'risk'}-${idx}`}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 700 }}>{row.supplier_name || 'Không gắn NCC'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.reference_code || '-'}</div>
                  </td>
                  <td style={tdStyle}>
                    {severityBadge(row.severity === 'critical' ? 'critical' : 'warning', row.risk_kind === 'delivery_delay' ? 'Giao chậm' : 'Tăng giá')}
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{row.material_name || '-'}</div>
                  </td>
                  <td style={tdStyle}>
                    <div>{row.detail_text || '-'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{row.warehouse_name || '-'}</div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{formatDateTime(row.event_at || null)}</td>
                </tr>
              ))}
              {!(data.supplier_risk_rows || []).length ? <tr><td style={tdStyle} colSpan={4}>Không có cảnh báo nào theo nhà cung cấp.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Vật tư lâu không biến động</div>
          <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Kho / vật tư</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Tồn hiện tại</th>
                  <th style={thStyle}>Mức độ</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Ngày đứng yên</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Xử lý</th>
                </tr>
              </thead>
              <tbody>
                {data.stale_stock_rows.map((row) => (
                  <tr key={`${row.warehouse_id}-${row.material_key}`}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>{row.warehouse_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.material_name || row.material_key}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {Number(row.on_hand_qty || 0).toLocaleString('vi-VN')}
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.item_unit || '-'}</div>
                    </td>
                    <td style={tdStyle}>{severityBadge(row.days_idle >= 90 ? 'critical' : 'warning', row.days_idle >= 90 ? 'Rất lâu' : 'Cần xem')}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--orange)', fontWeight: 700 }}>{row.days_idle}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ marginBottom: 6 }}>{formatDateTime(row.last_movement_at)}</div>
                      <Link className="btn-ghost" href={buildStocksLink(row)}>Mở tồn kho</Link>
                    </td>
                  </tr>
                ))}
                {!data.stale_stock_rows.length ? <tr><td style={tdStyle} colSpan={5}>Không có vật tư nào bị đứng yên quá lâu.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Giá nhập tăng mạnh</div>
          <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Vật tư</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Giá cũ</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Giá mới</th>
                  <th style={thStyle}>Mức độ</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Xử lý</th>
                </tr>
              </thead>
              <tbody>
                {data.price_spike_rows.map((row) => (
                  <tr key={`${row.warehouse_name}-${row.material_key}`}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>{row.material_name || row.material_key}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.warehouse_name} {row.supplier_name ? `| ${row.supplier_name}` : ''}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{formatMoney(row.previous_price)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{formatMoney(row.latest_price)}</td>
                    <td style={tdStyle}>{severityBadge(row.increase_percent >= 30 ? 'critical' : 'warning', `${Number(row.increase_percent || 0).toLocaleString('vi-VN')}%`)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{formatDateTime(row.effective_at)}</div>
                      <Link className="btn-ghost" href={buildPricesLink(row)}>Mở biến động giá</Link>
                    </td>
                  </tr>
                ))}
                {!data.price_spike_rows.length ? <tr><td style={tdStyle} colSpan={5}>Không có giá nhập nào tăng mạnh trong kỳ gần đây.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Phiếu nháp để lâu chưa ghi sổ</div>
          <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Phiếu</th>
                  <th style={thStyle}>Kho / NCC</th>
                  <th style={thStyle}>Mức độ</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Xử lý</th>
                </tr>
              </thead>
              <tbody>
                {data.aging_draft_rows.map((row) => (
                  <tr key={row.id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>{row.txn_code}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{txnTypeLabel(row.txn_type)}</div>
                    </td>
                    <td style={tdStyle}>
                      <div>{row.warehouse_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.supplier_name || '-'}</div>
                    </td>
                    <td style={tdStyle}>{severityBadge(row.days_open >= 7 ? 'critical' : 'warning', `${row.days_open} ngày`)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{formatDateTime(row.created_at)}</div>
                      <Link className="btn-ghost" href={buildTransactionsLink(row)}>Mở phiếu</Link>
                    </td>
                  </tr>
                ))}
                {!data.aging_draft_rows.length ? <tr><td style={tdStyle} colSpan={4}>Không có phiếu nháp nào để lâu.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Vật tư sắp thiếu theo nhu cầu dự án</div>
          <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Dự án / kế hoạch</th>
                  <th style={thStyle}>Vật tư</th>
                  <th style={thStyle}>Mức độ</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Xử lý</th>
                </tr>
              </thead>
              <tbody>
                {data.project_demand_risk_rows.map((row) => (
                  <tr key={`${row.plan_id}-${row.material_key}`}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>{row.project_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.plan_name}</div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>{row.material_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.material_key}</div>
                    </td>
                    <td style={tdStyle}>
                      {severityBadge(row.risk_level === 'critical' ? 'critical' : 'warning', row.risk_level === 'critical' ? 'Không đủ tồn' : 'Sắp thiếu')}
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                        Thiếu {Number(row.shortage_qty || 0).toLocaleString('vi-VN')} {row.item_unit || ''}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                        Tồn khả dụng: {Number(row.available_stock_qty || 0).toLocaleString('vi-VN')} {row.item_unit || ''}
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button className="btn-primary" disabled={!filters.warehouse_id || creatingPlanId === row.plan_id} onClick={() => void createIssueDraft(row)}>
                          {creatingPlanId === row.plan_id ? 'Đang tạo...' : 'Tạo phiếu'}
                        </button>
                        <Link className="btn-ghost" href={`/projects/${row.project_id}/operations`}>Mở vận hành dự án</Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {!data.project_demand_risk_rows.length ? <tr><td style={tdStyle} colSpan={4}>Không có nhu cầu dự án đang cảnh báo.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Cảnh báo tồn dưới min</div>
          <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Kho / vật tư</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Tồn hiện tại</th>
                  <th style={thStyle}>Mức độ</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Xử lý</th>
                </tr>
              </thead>
              <tbody>
                {data.low_stock_rows.map((row) => (
                  <tr key={row.id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>{row.warehouse_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.material_name || row.material_key}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--orange)', fontWeight: 700 }}>
                      {Number(row.on_hand_qty || 0).toLocaleString('vi-VN')}
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.item_unit || '-'}</div>
                    </td>
                    <td style={tdStyle}>
                      {severityBadge(Number(row.available_qty || 0) <= 0 ? 'critical' : 'warning', Number(row.available_qty || 0) <= 0 ? 'Hết khả dụng' : 'Dưới min')}
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                        Min: {Number(row.min_qty || 0).toLocaleString('vi-VN')}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ marginBottom: 6 }}>{formatMoney(row.stock_value)}</div>
                      <Link className="btn-ghost" href={buildStocksLink({ ...row, low_only: true })}>Mở tồn kho</Link>
                    </td>
                  </tr>
                ))}
                {!data.low_stock_rows.length ? <tr><td style={tdStyle} colSpan={4}>Không có vật tư dưới mức tối thiểu.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Vật tư biến động mạnh trong kỳ</div>
          <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Vật tư</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Nhập</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Xuất</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Tổng biến động</th>
                </tr>
              </thead>
              <tbody>
                {data.top_movement_materials.map((row) => (
                  <tr key={row.material_key}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>{row.material_name || row.material_key}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.material_key}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--green)' }}>
                      {Number(row.inbound_qty || 0).toLocaleString('vi-VN')}
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>+ DC: {Number(row.adjust_increase_qty || 0).toLocaleString('vi-VN')}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--orange)' }}>
                      {Number(row.outbound_qty || 0).toLocaleString('vi-VN')}
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>- DC: {Number(row.adjust_decrease_qty || 0).toLocaleString('vi-VN')}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>{Number(row.movement_qty || 0).toLocaleString('vi-VN')}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.txn_count} lần | {row.item_unit || '-'}</div>
                    </td>
                  </tr>
                ))}
                {!data.top_movement_materials.length ? <tr><td style={tdStyle} colSpan={4}>Chưa có biến động vật tư trong kỳ này.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Phiếu nhập gần đây</div>
          <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Phiếu</th>
                  <th style={thStyle}>Trạng thái / NCC</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Dòng / SL</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_inbound_transactions.map((row) => (
                  <tr key={row.id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>{row.txn_code}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.warehouse_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatDateTime(row.txn_date)}</div>
                    </td>
                    <td style={tdStyle}>
                      <div>{txnTypeLabel(row.txn_type)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{statusLabel(row.status)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.supplier_name || '-'}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>{row.item_count}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{Number(row.total_qty || 0).toLocaleString('vi-VN')}</div>
                    </td>
                  </tr>
                ))}
                {!data.recent_inbound_transactions.length ? <tr><td style={tdStyle} colSpan={3}>Chưa có phiếu nhập trong kỳ này.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Phiếu xuất gần đây</div>
          <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Phiếu</th>
                  <th style={thStyle}>Trạng thái</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Dòng / SL</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_outbound_transactions.map((row) => (
                  <tr key={row.id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>{row.txn_code}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.warehouse_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatDateTime(row.txn_date)}</div>
                    </td>
                    <td style={tdStyle}>
                      <div>{txnTypeLabel(row.txn_type)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{statusLabel(row.status)}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>{row.item_count}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{Number(row.total_qty || 0).toLocaleString('vi-VN')}</div>
                    </td>
                  </tr>
                ))}
                {!data.recent_outbound_transactions.length ? <tr><td style={tdStyle} colSpan={3}>Chưa có phiếu xuất trong kỳ này.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {loading ? <div style={{ marginTop: 12, color: 'var(--text3)' }}>Đang tải dashboard kho...</div> : null}
      {toast ? (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
