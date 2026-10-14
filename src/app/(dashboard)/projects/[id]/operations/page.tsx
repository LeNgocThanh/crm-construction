'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '-'
  return Number(n).toLocaleString('vi-VN') + ' vnd'
}

function directPurchaseStatusLabel(value?: string | null) {
  switch (String(value || '')) {
    case 'confirmed': return 'Đã xác nhận'
    case 'cancelled': return 'Đã hủy'
    default: return 'Nháp'
  }
}

export default function ProjectOperationsPage() {
  const MATERIAL_OTHER_VALUE = '__other__'
  const params = useParams<{ id: string }>()
  const id = String(params?.id || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [data, setData] = useState<any>(null)
  const [warehouseOptions, setWarehouseOptions] = useState<Array<{ id: string; warehouse_name: string; warehouse_code: string }>>([])
  const [supplierOptions, setSupplierOptions] = useState<Array<{ id: string; supplier_name: string; supplier_code: string }>>([])
  const [materialOptions, setMaterialOptions] = useState<Array<{ material_key: string; material_name: string; unit: string }>>([])
  const [directPurchases, setDirectPurchases] = useState<any[]>([])
  const [onSiteMaterials, setOnSiteMaterials] = useState<any[]>([])
  const [expandedDirectPurchaseId, setExpandedDirectPurchaseId] = useState('')
  const [creatingDirect, setCreatingDirect] = useState(false)
  const [directForm, setDirectForm] = useState({
    purchase_date: new Date().toISOString().slice(0, 10),
    plan_id: '',
    supplier_id: '',
    supplier_name: '',
    note: '',
    material_key: '',
    material_name: '',
    item_unit: '',
    quantity: '',
    unit_price: '',
    item_note: '',
  })
  const [warehouseByPlan, setWarehouseByPlan] = useState<Record<string, string>>({})
  const [summaryByPlan, setSummaryByPlan] = useState<Record<string, { shortage_items: number; excess_items: number; enough_items: number }>>({})
  const [shortageByPlan, setShortageByPlan] = useState<Record<string, Array<{ item_name: string; material_key: string; unit: string; shortage_qty: number }>>>({})
  const [allocatingKey, setAllocatingKey] = useState('')
  const [allocPickByPlan, setAllocPickByPlan] = useState<Record<string, string>>({})
  const [allocQtyByPlan, setAllocQtyByPlan] = useState<Record<string, string>>({})
  const [detailByPlan, setDetailByPlan] = useState<Record<string, Array<{
    item_name: string
    material_key: string
    unit: string
    planned_qty: number
    issued_qty: number
    returned_qty: number
    net_received_qty: number
    allocated_qty: number
    delta_qty: number
    status_label: string
  }>>>({})

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function load() {
    if (!id) return
    setLoading(true)
    setError('')
    const [viewRes, wRes, sRes, mRes, dpRes, osRes] = await Promise.all([
      fetch(`/api/projects/${id}/investor-view`, { cache: 'no-store' }),
      fetch('/api/settings/warehouses?active_only=true'),
      fetch('/api/settings/suppliers?active_only=true'),
      fetch('/api/settings/estimate/materials?active_only=true'),
      fetch(`/api/projects/${id}/direct-purchases`, { cache: 'no-store' }),
      fetch(`/api/projects/${id}/materials/on-site`, { cache: 'no-store' }),
    ])
    const viewJson = await viewRes.json().catch(() => ({}))
    const wJson = await wRes.json().catch(() => ({}))
    const sJson = await sRes.json().catch(() => ({}))
    const mJson = await mRes.json().catch(() => ({}))
    const dpJson = await dpRes.json().catch(() => ({}))
    const osJson = await osRes.json().catch(() => ({}))
    if (!viewRes.ok) {
      setError(String(viewJson?.error || 'Không tải được dữ liệu dự án'))
      setLoading(false)
      return
    }
    setData(viewJson?.data || null)
    const whRaw = Array.isArray(wJson?.data) ? wJson.data : []
    const nextWarehouses = whRaw
      .map((x: any) => ({
        id: String(x?.id || ''),
        warehouse_name: String(x?.warehouse_name || ''),
        warehouse_code: String(x?.warehouse_code || ''),
      }))
      .filter((x: any) => x.id && x.warehouse_name)
    setWarehouseOptions(nextWarehouses)
    setSupplierOptions(
      (Array.isArray(sJson?.data) ? sJson.data : [])
        .map((x: any) => ({ id: String(x?.id || ''), supplier_name: String(x?.supplier_name || ''), supplier_code: String(x?.supplier_code || '') }))
        .filter((x: any) => x.id && x.supplier_name),
    )
    const matMap = new Map<string, { material_key: string; material_name: string; unit: string }>()
    for (const x of (Array.isArray(mJson?.data) ? mJson.data : [])) {
      const key = String(x?.material_key || '').trim()
      if (!key || matMap.has(key)) continue
      matMap.set(key, {
        material_key: key,
        material_name: String(x?.material_name || key),
        unit: String(x?.unit || ''),
      })
    }
    setMaterialOptions(Array.from(matMap.values()))
    setDirectPurchases(Array.isArray(dpJson?.data) ? dpJson.data : [])
    setOnSiteMaterials(Array.isArray(osJson?.data) ? osJson.data : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const plans = useMemo(() => (Array.isArray(data?.resources?.plans) ? data.resources.plans : []), [data])
  const items = useMemo(() => (Array.isArray(data?.resources?.items) ? data.resources.items : []), [data])
  const executionAxis = data?.execution_axis || {}
  const activeMaterialPlanId = String(executionAxis?.active_material_plan?.id || '')
  const activeMaterialPlan = plans.find((x: any) => String(x?.id || '') === activeMaterialPlanId) || null
  const operationalMaterialPlans = useMemo(() => plans.filter((x: any) => {
    const kinds = Array.isArray(x?.plan_kinds) ? x.plan_kinds.map((k: any) => String(k || '')) : []
    return kinds.includes('material')
      && (
        String(x?.execution_state || '') === 'started'
        || String(x?.execution_state || '') === 'locked'
        || String(x?.id || '') === activeMaterialPlanId
      )
  }), [plans, activeMaterialPlanId])
  const operationalMaterialPlansByTime = useMemo(() => {
    return [...operationalMaterialPlans].sort((a: any, b: any) => {
      const aActive = String(a?.id || '') === activeMaterialPlanId ? 1 : 0
      const bActive = String(b?.id || '') === activeMaterialPlanId ? 1 : 0
      if (aActive !== bActive) return bActive - aActive
      const ta = new Date(String(a?.planned_start_date || a?.created_at || 0)).getTime()
      const tb = new Date(String(b?.planned_start_date || b?.created_at || 0)).getTime()
      return ta - tb
    })
  }, [operationalMaterialPlans, activeMaterialPlanId])
  const actionMaterialPlans = useMemo(() => {
    if (activeMaterialPlan) return [activeMaterialPlan]
    return operationalMaterialPlansByTime
  }, [activeMaterialPlan, operationalMaterialPlansByTime])

  useEffect(() => {
    if (!operationalMaterialPlans.length) return
    ;(async () => {
      const next: Record<string, { shortage_items: number; excess_items: number; enough_items: number }> = {}
      const nextShortage: Record<string, Array<{ item_name: string; material_key: string; unit: string; shortage_qty: number }>> = {}
      const nextDetail: Record<string, Array<{
        item_name: string
        material_key: string
        unit: string
        planned_qty: number
        issued_qty: number
        returned_qty: number
        net_received_qty: number
        allocated_qty: number
        delta_qty: number
        status_label: string
      }>> = {}
      for (const p of operationalMaterialPlans) {
        const res = await fetch(`/api/projects/${id}/resource-plans/${p.id}/actual-summary`, { cache: 'no-store' })
        const j = await res.json().catch(() => ({}))
        const t = j?.data?.totals || {}
        next[p.id] = {
          shortage_items: Number(t.shortage_items || 0),
          excess_items: Number(t.excess_items || 0),
          enough_items: Number(t.enough_items || 0),
        }
        nextShortage[p.id] = (Array.isArray(j?.data?.shortage) ? j.data.shortage : [])
          .map((x: any) => ({
            item_name: String(x?.item_name || x?.material_key || ''),
            material_key: String(x?.material_key || ''),
            unit: String(x?.unit || ''),
            shortage_qty: Number(x?.shortage_qty || 0),
          }))
          .filter((x: any) => x.material_key && x.shortage_qty > 0)
        nextDetail[p.id] = (Array.isArray(j?.data?.all_items) ? j.data.all_items : [])
          .map((x: any) => {
            const delta = Number(x?.delta_qty || 0)
            return {
              item_name: String(x?.item_name || x?.material_key || ''),
              material_key: String(x?.material_key || ''),
              unit: String(x?.unit || ''),
              planned_qty: Number(x?.planned_qty || 0),
              issued_qty: Number(x?.issued_qty || 0),
              returned_qty: Number(x?.returned_qty || 0),
              net_received_qty: Number(x?.net_received_qty || 0),
              allocated_qty: Number(x?.allocated_qty || 0),
              delta_qty: delta,
              status_label: delta < 0 ? 'Thiếu' : delta > 0 ? 'Thừa' : 'Đủ',
            }
          })
          .filter((x: any) => x.material_key)
      }
      setSummaryByPlan(next)
      setShortageByPlan(nextShortage)
      setDetailByPlan(nextDetail)
    })()
  }, [operationalMaterialPlans, id])

  const onSiteMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of onSiteMaterials || []) {
      const key = String(x?.material_key || '').trim()
      if (!key) continue
      m.set(key, Number(x?.on_site_qty || 0))
    }
    return m
  }, [onSiteMaterials])

  const allocatedProjectMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const rows of Object.values(detailByPlan)) {
      for (const r of rows || []) {
        const key = String(r.material_key || '').trim()
        if (!key) continue
        m.set(key, (m.get(key) || 0) + Number(r.allocated_qty || 0))
      }
    }
    return m
  }, [detailByPlan])

  const planMaterialAggregate = useMemo(() => {
    const result: Record<string, Array<{
      material_key: string
      item_name: string
      unit: string
      planned_qty: number
      net_received_qty: number
      delta_qty: number
      on_site_qty: number
    }>> = {}
    for (const p of operationalMaterialPlansByTime) {
      const rows = detailByPlan[p.id] || []
      const map = new Map<string, {
        material_key: string
        item_name: string
        unit: string
        planned_qty: number
        net_received_qty: number
      }>()
      for (const r of rows) {
        const key = String(r.material_key || '').trim()
        if (!key) continue
        const prev = map.get(key) || {
          material_key: key,
          item_name: r.item_name || key,
          unit: r.unit || '',
          planned_qty: 0,
          net_received_qty: 0,
        }
        prev.planned_qty += Number(r.planned_qty || 0)
        prev.net_received_qty += Number(r.net_received_qty || 0)
        map.set(key, prev)
      }
      result[p.id] = Array.from(map.values())
        .map((x) => ({
          ...x,
          delta_qty: Number(x.net_received_qty || 0) - Number(x.planned_qty || 0),
          on_site_qty: Number(onSiteMap.get(x.material_key) || 0),
        }))
        .sort((a, b) => String(a.item_name || a.material_key).localeCompare(String(b.item_name || b.material_key)))
    }
    return result
  }, [operationalMaterialPlansByTime, detailByPlan, onSiteMap])

  useEffect(() => {
    if (!activeMaterialPlanId) return
    setDirectForm((prev) => prev.plan_id ? prev : { ...prev, plan_id: activeMaterialPlanId })
  }, [activeMaterialPlanId])

  async function allocateFromProjectStock(planId: string, materialKey: string, shortageQty: number) {
    const key = `${planId}_${materialKey}`
    setAllocatingKey(key)
    const res = await fetch(`/api/projects/${id}/resource-plans/${planId}/allocate-from-stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ material_key: materialKey, quantity: shortageQty }),
    })
    const j = await res.json().catch(() => ({}))
    setAllocatingKey('')
    if (!res.ok) return showToast(j?.error || 'Không phân bổ được vật tư')
    await load()
    showToast(`Da phan bo ${Number(j?.data?.allocated_qty || 0)} cho ${materialKey}`)
  }

  async function generateIssueDraft(planId: string) {
    const warehouseId = String(warehouseByPlan[planId] || '').trim() || warehouseOptions[0]?.id || ''
    if (!warehouseId) return showToast('Chua chon kho xuat')
    const res = await fetch(`/api/projects/${id}/resource-plans/${planId}/generate-issue-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warehouse_id: warehouseId }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không sinh được phiếu xuất kho')
    const code = String(j?.data?.txn_code || '').trim()
    const skippedCount = Array.isArray(j?.meta?.skipped) ? j.meta.skipped.length : 0
    showToast(skippedCount > 0
      ? `Da sinh phieu ${code || ''}, bo qua ${skippedCount} item`
      : `Đã sinh phiếu xuất kho nháp ${code || ''}`)
  }

  async function generateReturnDraft(planId: string) {
    const warehouseId = String(warehouseByPlan[planId] || '').trim() || warehouseOptions[0]?.id || ''
    if (!warehouseId) return showToast('Chưa chọn kho nhập lại')
    const res = await fetch(`/api/projects/${id}/resource-plans/${planId}/generate-return-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warehouse_id: warehouseId }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không sinh được phiếu nhập lại')
    const code = String(j?.data?.txn_code || '').trim()
    showToast(`Đã sinh phiếu nhập lại ${code || ''}`)
  }

  async function createDirectPurchase() {
    const materialKeyRaw = String(directForm.material_key || '').trim()
    const materialKey = materialKeyRaw === MATERIAL_OTHER_VALUE
      ? String(directForm.material_name || '')
          .trim()
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s_-]/gu, '')
          .replace(/\s+/g, '_')
      : materialKeyRaw
    const qty = Number(directForm.quantity || 0)
    if (!materialKey || !Number.isFinite(qty) || qty <= 0) return showToast('Thiếu vật tư hoặc số lượng')
    if (materialKeyRaw === MATERIAL_OTHER_VALUE && !String(directForm.material_name || '').trim()) {
      return showToast('Vui lòng nhập tên vật tư khi chọn Khác')
    }
    if (directForm.plan_id) {
      const plannedSet = new Set(
        items
          .filter((x: any) => x.plan_id === directForm.plan_id && x.resource_kind === 'material')
          .map((x: any) => String(x.item_key || '').trim())
          .filter(Boolean),
      )
      if (!plannedSet.has(materialKey)) {
        const ok = confirm('Vật tư này không thuộc kế hoạch đã chọn. Hệ thống sẽ tính là vật tư thừa của kế hoạch. Tiếp tục?')
        if (!ok) return
      }
    }
    setCreatingDirect(true)
    const res = await fetch(`/api/projects/${id}/direct-purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purchase_date: directForm.purchase_date || null,
        plan_id: directForm.plan_id || null,
        supplier_id: directForm.supplier_id || null,
        supplier_name: directForm.supplier_name || null,
        note: directForm.note || null,
        items: [{
          material_key: materialKey,
          material_name: directForm.material_name || null,
          item_unit: directForm.item_unit || null,
          quantity: qty,
          unit_price: directForm.unit_price ? Number(directForm.unit_price) : null,
          note: directForm.item_note || null,
        }],
      }),
    })
    const j = await res.json().catch(() => ({}))
    setCreatingDirect(false)
    if (!res.ok) return showToast(j?.error || 'Không tạo được phiếu mua trực tiếp')
    setDirectForm((p) => ({ ...p, note: '', material_key: '', material_name: '', item_unit: '', quantity: '', unit_price: '', item_note: '' }))
    await load()
    showToast('Da tao phieu mua truc tiep (draft)')
  }

  async function confirmDirectPurchase(purchaseId: string) {
    const res = await fetch(`/api/projects/${id}/direct-purchases/${purchaseId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm' }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không xác nhận được phiếu')
    await load()
    showToast('Da xac nhan phieu mua truc tiep')
  }

  if (loading) return <div style={{ padding: 16 }}>Đang tải dữ liệu...</div>
  if (error) return <div style={{ padding: 16, color: 'var(--red)' }}>{error}</div>

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)' }}>PROJECT OPERATIONS</div>
          <h1 style={{ margin: '4px 0 2px', fontSize: 22, fontWeight: 800 }}>Vận hành dự án</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {data?.overview?.project_name || '-'} | {data?.overview?.customer?.full_name || '-'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Link className="btn-ghost" href={`/projects/${id}/planning`}>Mở planning</Link>
          <Link className="btn-ghost" href={`/projects/${id}/overview`}>Mở overview</Link>
          <Link className="btn-ghost" href={`/projects/${id}/diary`}>Mở nhật ký</Link>
          <Link className="btn-ghost" href="/inventory/transactions">Phiếu kho</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Tổng hợp kế hoạch theo thời gian (gộp theo vật tư)</div>
        <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}>
          {actionMaterialPlans.map((p: any) => {
            const agg = planMaterialAggregate[p.id] || []
            const planStart = p?.planned_start_date ? new Date(String(p.planned_start_date)).toLocaleDateString('vi-VN') : '-'
            const planEnd = p?.planned_end_date ? new Date(String(p.planned_end_date)).toLocaleDateString('vi-VN') : '-'
            return (
              <div key={`agg_${p.id}`} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700 }}>{p.plan_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                  Thời gian: {planStart} - {planEnd} | Vật tư gộp: {agg.length}
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>Vật tư</th>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>Mã</th>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>Đơn vị</th>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>Kế hoạch (gộp)</th>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>Thực nhận (gộp)</th>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>Chênh lệch</th>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>Tồn dự án</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agg.map((r) => (
                        <tr key={`agg_row_${p.id}_${r.material_key}`} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '7px 8px', fontSize: 12 }}>{r.item_name || r.material_key}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12, color: 'var(--text3)' }}>{r.material_key}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12 }}>{r.unit || '-'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12 }}>{r.planned_qty}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12 }}>{r.net_received_qty}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12, color: r.delta_qty < 0 ? 'var(--red)' : r.delta_qty > 0 ? 'var(--orange)' : 'var(--green)' }}>
                            {r.delta_qty > 0 ? `+${r.delta_qty}` : r.delta_qty}
                          </td>
                          <td style={{ padding: '7px 8px', fontSize: 12 }}>{r.on_site_qty}</td>
                        </tr>
                      ))}
                      {!agg.length ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text3)' }}>
                            Chưa có dữ liệu vật tư cho kế hoạch này.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
          {!actionMaterialPlans.length ? (
            <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>
              Chưa có kế hoạch đã duyệt để tổng hợp.
            </div>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Action kho từ kế hoạch vật tư đang vận hành</div>
        <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {actionMaterialPlans.map((p: any) => {
            const rows = items.filter((x: any) => x.plan_id === p.id && x.resource_kind === 'material')
            const rowsWithQty = rows.filter((x: any) => Number(x?.quantity || 0) > 0)
            const total = rows.reduce((s: number, x: any) => s + Number(x.estimated_cost || 0), 0)
            const shortageCount = Number(summaryByPlan[p.id]?.shortage_items || 0)
            const excessCount = Number(summaryByPlan[p.id]?.excess_items || 0)
            const canIssue = rowsWithQty.length > 0 && shortageCount > 0
            const canReturn = rowsWithQty.length > 0 && excessCount > 0
            const hasAction = canIssue || canReturn
            return (
              <div key={p.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700 }}>{p.plan_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                  Item vật tư: {rowsWithQty.length} | Tổng dự kiến: {fmtMoney(total)}{String(p?.id || '') === activeMaterialPlanId ? ' | Đang vận hành' : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                  Du: {summaryByPlan[p.id]?.enough_items || 0} | Thieu: {shortageCount} | Thua: {excessCount}
                </div>
                {shortageCount > 0 ? (
                  <div style={{ border: '1px dashed var(--border2)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Phân bổ từ tồn dự án (không qua kho)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .8fr auto', gap: 6 }}>
                      <select
                        className="select"
                        value={allocPickByPlan[p.id] || ''}
                        onChange={(e) => {
                          const mk = e.target.value
                          const row = (shortageByPlan[p.id] || []).find((x) => x.material_key === mk)
                          const onSite = Number(onSiteMap.get(mk) || 0)
                          const allocated = Number(allocatedProjectMap.get(mk) || 0)
                          const free = Math.max(0, onSite - allocated)
                          const suggest = row ? Math.min(Number(row.shortage_qty || 0), free) : 0
                          setAllocPickByPlan((prev) => ({ ...prev, [p.id]: mk }))
                          setAllocQtyByPlan((prev) => ({ ...prev, [p.id]: suggest > 0 ? String(suggest) : '' }))
                        }}
                      >
                        <option value="">(Chọn vật tư thiếu)</option>
                        {(shortageByPlan[p.id] || []).map((x) => {
                          const onSite = Number(onSiteMap.get(x.material_key) || 0)
                          const allocated = Number(allocatedProjectMap.get(x.material_key) || 0)
                          const free = Math.max(0, onSite - allocated)
                          return (
                            <option key={`${p.id}_${x.material_key}`} value={x.material_key}>
                              {x.item_name} ({x.material_key}) - thiếu {x.shortage_qty} {x.unit || ''} | tồn chưa PB: {free}
                            </option>
                          )
                        })}
                      </select>
                      <input
                        className="input"
                        placeholder="Số lượng PB"
                        value={allocQtyByPlan[p.id] || ''}
                        onChange={(e) => setAllocQtyByPlan((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      />
                      <button
                        className="btn-ghost"
                        onClick={() => {
                          const mk = String(allocPickByPlan[p.id] || '').trim()
                          const qty = Number(allocQtyByPlan[p.id] || 0)
                          if (!mk || !(qty > 0)) return showToast('Chọn vật tư thiếu và nhập số lượng > 0')
                          allocateFromProjectStock(p.id, mk, qty)
                        }}
                        disabled={!allocPickByPlan[p.id] || !(Number(allocQtyByPlan[p.id] || 0) > 0)}
                      >
                        Phân bổ từ tồn dự án
                      </button>
                    </div>
                  </div>
                ) : null}
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflowX: 'auto', marginBottom: 8 }}>
                  <table style={{ width: '100%', minWidth: 920, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>Vật tư</th>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>Mã</th>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>Đơn vị</th>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>Kế hoạch</th>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>Đã xuất kho</th>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>Đã nhập lại</th>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>PB từ tồn dự án</th>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>Thực nhận</th>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>Chênh lệch</th>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>Trạng thái</th>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>Tồn chưa PB</th>
                        <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailByPlan[p.id] || []).map((d) => {
                        const onSite = Number(onSiteMap.get(d.material_key) || 0)
                        const allocated = Number(allocatedProjectMap.get(d.material_key) || 0)
                        const free = onSite - allocated
                        const canAllocate = d.delta_qty < 0 && free > 0
                        const runQty = canAllocate ? Math.min(Math.abs(d.delta_qty), free) : 0
                        const rowKey = `${p.id}_${d.material_key}`
                        return (
                        <tr key={rowKey} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '7px 8px', fontSize: 12 }}>{d.item_name || d.material_key}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12, color: 'var(--text3)' }}>{d.material_key}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12 }}>{d.unit || '-'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12 }}>{d.planned_qty}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12 }}>{d.issued_qty}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12 }}>{d.returned_qty}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12, color: d.allocated_qty > 0 ? 'var(--blue)' : 'var(--text3)' }}>{d.allocated_qty || 0}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12 }}>{d.net_received_qty}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12, color: d.delta_qty < 0 ? 'var(--red)' : d.delta_qty > 0 ? 'var(--orange)' : 'var(--green)' }}>
                            {d.delta_qty > 0 ? `+${d.delta_qty}` : d.delta_qty}
                          </td>
                          <td style={{ padding: '7px 8px', fontSize: 12, color: d.status_label === 'Thiếu' ? 'var(--red)' : d.status_label === 'Thừa' ? 'var(--orange)' : 'var(--green)' }}>
                            {d.status_label}
                          </td>
                          <td style={{ padding: '7px 8px', fontSize: 12, color: free > 0 ? 'var(--green)' : 'var(--text3)' }}>
                            {free > 0 ? free : 0}
                          </td>
                          <td style={{ padding: '7px 8px', fontSize: 12 }}>
                            {canAllocate ? (
                              <button
                                className="btn-ghost"
                                disabled={allocatingKey === rowKey}
                                onClick={() => allocateFromProjectStock(p.id, d.material_key, runQty)}
                                style={{ padding: '4px 8px', fontSize: 11 }}
                              >
                                {allocatingKey === rowKey ? 'Dang PB...' : `PB ${runQty}`}
                              </button>
                            ) : <span style={{ color: 'var(--text3)' }}>-</span>}
                          </td>
                        </tr>
                      )})}
                      {!(detailByPlan[p.id] || []).length ? (
                        <tr>
                          <td colSpan={12} style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text3)' }}>
                            Chưa có chi tiết vật tư cho kế hoạch này.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                {hasAction ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                    <select
                      className="select"
                      value={warehouseByPlan[p.id] || ''}
                      onChange={(e) => setWarehouseByPlan((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    >
                      <option value="">(Chon kho xuat)</option>
                      {warehouseOptions.map((w) => (
                        <option key={w.id} value={w.id}>{w.warehouse_name} ({w.warehouse_code})</option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {canIssue ? <button className="btn-primary" onClick={() => generateIssueDraft(p.id)}>Tạo phiếu xuất bổ sung</button> : null}
                      {canReturn ? <button className="btn-ghost" onClick={() => generateReturnDraft(p.id)}>Tạo phiếu nhập lại</button> : null}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--green)' }}>
                    Kế hoạch này đã đủ, không có vật tư thiếu/thừa để tạo phiếu.
                  </div>
                )}
              </div>
            )
          })}
          {!actionMaterialPlans.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Chưa có kế hoạch vật tư đang vận hành để tạo action kho.</div> : null}
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Mua trực tiếp từ nhà cung cấp (không qua kho)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ngày mua</div>
            <input className="input" type="date" value={directForm.purchase_date} onChange={(e) => setDirectForm((p) => ({ ...p, purchase_date: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ke hoach ap dung</div>
            <select className="select" value={directForm.plan_id} onChange={(e) => setDirectForm((p) => ({ ...p, plan_id: e.target.value }))}>
              <option value="">(Không gắn kế hoạch)</option>
              {(activeMaterialPlan ? [activeMaterialPlan] : operationalMaterialPlans).map((p: any) => <option key={p.id} value={p.id}>{p.plan_name}{String(p?.id || '') === activeMaterialPlanId ? ' (dang van hanh)' : ''}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Nha cung cap</div>
            <select className="select" value={directForm.supplier_id} onChange={(e) => {
              const idv = e.target.value
              const hit = supplierOptions.find((s) => s.id === idv)
              setDirectForm((p) => ({ ...p, supplier_id: idv, supplier_name: hit?.supplier_name || '' }))
            }}>
              <option value="">(Chon NCC)</option>
              {supplierOptions.map((s) => <option key={s.id} value={s.id}>{s.supplier_name} ({s.supplier_code})</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / span 2' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ghi chú phiếu</div>
            <input className="input" value={directForm.note} onChange={(e) => setDirectForm((p) => ({ ...p, note: e.target.value }))} />
          </div>
        </div>
        {directForm.plan_id ? (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Vật tư còn thiếu từ kế hoạch (chọn để điền nhanh)</div>
            <select
              className="select"
              value=""
              onChange={(e) => {
                const key = e.target.value
                if (!key) return
                const row = (shortageByPlan[directForm.plan_id] || []).find((x) => x.material_key === key)
                if (!row) return
                setDirectForm((p) => ({
                  ...p,
                  material_key: row.material_key,
                  material_name: row.item_name,
                  item_unit: row.unit || p.item_unit,
                  quantity: String(row.shortage_qty || ''),
                }))
              }}
            >
              <option value="">(Chọn vật tư thiếu)</option>
              {(shortageByPlan[directForm.plan_id] || []).map((x) => (
                <option key={x.material_key} value={x.material_key}>
                  {x.item_name} ({x.material_key}) - thieu {x.shortage_qty} {x.unit || ''}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr .7fr .6fr .8fr', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Vat tu</div>
            <select className="select" value={directForm.material_key} onChange={(e) => {
              const key = e.target.value
              const hit = materialOptions.find((m) => m.material_key === key)
              setDirectForm((p) => ({
                ...p,
                material_key: key,
                material_name: key === MATERIAL_OTHER_VALUE ? '' : (hit?.material_name || ''),
                item_unit: key === MATERIAL_OTHER_VALUE ? '' : (hit?.unit || ''),
              }))
            }}>
              <option value="">(Chọn vật tư)</option>
              {materialOptions.map((m) => <option key={m.material_key} value={m.material_key}>{m.material_name} ({m.material_key})</option>)}
              <option value={MATERIAL_OTHER_VALUE}>Khac (nhap tay)</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tên vật tư</div>
            <input className="input" value={directForm.material_name} onChange={(e) => setDirectForm((p) => ({ ...p, material_name: e.target.value }))} />
          </div>
          {directForm.material_key === MATERIAL_OTHER_VALUE ? (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mã vật tư (tự sinh từ tên)</div>
              <input
                className="input"
                value={String(directForm.material_name || '')
                  .trim()
                  .toLowerCase()
                  .replace(/[^\p{L}\p{N}\s_-]/gu, '')
                  .replace(/\s+/g, '_')}
                disabled
              />
            </div>
          ) : null}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Don vi</div>
            <input className="input" value={directForm.item_unit} onChange={(e) => setDirectForm((p) => ({ ...p, item_unit: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Số lượng</div>
            <input className="input" value={directForm.quantity} onChange={(e) => setDirectForm((p) => ({ ...p, quantity: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đơn giá</div>
            <input className="input" value={directForm.unit_price} onChange={(e) => setDirectForm((p) => ({ ...p, unit_price: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
          <input className="input" placeholder="Ghi chú item (nếu có)" value={directForm.item_note} onChange={(e) => setDirectForm((p) => ({ ...p, item_note: e.target.value }))} />
          <button className="btn-primary" disabled={creatingDirect} onClick={createDirectPurchase}>{creatingDirect ? 'Đang tạo...' : 'Tạo phiếu mua trực tiếp'}</button>
        </div>

        <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {directPurchases.map((p: any) => (
            <div key={p.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {p.purchase_code} | {directPurchaseStatusLabel(p.status)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {p.supplier_name || p.supplier?.supplier_name || '-'} | {p.purchase_date ? new Date(p.purchase_date).toLocaleDateString('vi-VN') : '-'}
                    {p?.plan?.plan_name ? ` | KH: ${p.plan.plan_name}` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    Số dòng: {Array.isArray(p.items) ? p.items.length : 0}
                    {' '}| Tổng tiền:{' '}
                    <span style={{ color: 'var(--text)' }}>
                      {fmtMoney((Array.isArray(p.items) ? p.items : []).reduce((sum: number, it: any) => {
                        const qty = Number(it?.quantity || 0)
                        const unitPrice = Number(it?.unit_price || 0)
                        return sum + (qty * unitPrice)
                      }, 0))}
                    </span>
                  </div>
                  {Array.isArray(p.items) && p.items.length ? (
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                      {(p.items as any[]).slice(0, 2).map((it: any, idx: number) => (
                        <div key={`${p.id}_item_${idx}`}>
                          {it?.material_name || it?.material_key || '-'}: {Number(it?.quantity || 0)} {it?.item_unit || ''}{Number(it?.unit_price || 0) > 0 ? ` x ${fmtMoney(Number(it.unit_price || 0))}` : ''}
                        </div>
                      ))}
                      {p.items.length > 2 ? (
                        <div>... và thêm {p.items.length - 2} dòng vật tư khác</div>
                      ) : null}
                    </div>
                  ) : null}
                  {p?.note ? (
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                      Ghi chú: {String(p.note)}
                    </div>
                  ) : null}
                </div>
                {/* direct purchase actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-ghost" type="button" onClick={() => setExpandedDirectPurchaseId((prev) => prev === p.id ? '' : String(p.id))}>
                    {expandedDirectPurchaseId === p.id ? 'Ẩn chi tiết' : 'Chi tiết'}
                  </button>
                  {String(p.status) === 'draft' ? (
                    <button className="btn-primary" onClick={() => confirmDirectPurchase(p.id)}>Xác nhận nhập dự án</button>
                  ) : null}
                </div>
              </div>
              {expandedDirectPurchaseId === p.id && Array.isArray(p.items) && p.items.length ? (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border2)', display: 'grid', gap: 6 }}>
                  {p.items.map((it: any, idx: number) => (
                    <div key={`${p.id}_detail_${idx}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: 'var(--text3)' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{it?.material_name || it?.material_key || '-'}</div>
                      <div>
                        Mã: {it?.material_key || '-'} | Số lượng: {Number(it?.quantity || 0)} {it?.item_unit || ''}
                      </div>
                      <div>
                        Đơn giá: {fmtMoney(Number(it?.unit_price || 0))} | Thành tiền: {fmtMoney(Number(it?.quantity || 0) * Number(it?.unit_price || 0))}
                      </div>
                      {it?.note ? <div>Ghi chú item: {String(it.note)}</div> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {!directPurchases.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Chưa có phiếu mua trực tiếp.</div> : null}
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Vật tư đang có tại dự án (tổng hợp kho + mua trực tiếp)</div>
        <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {onSiteMaterials.map((m: any) => (
            <div key={m.material_key} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700 }}>{m.material_name || m.material_key} ({m.material_key})</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                Tồn tại công trường: <b style={{ color: 'var(--text)' }}>{Number(m.on_site_qty || 0)}</b> {m.item_unit || ''}
                {' '}| Nhập: {Number(m.in_qty || 0)} | Xuất trả: {Number(m.out_qty || 0)} | Tiêu hao: {Number(m.consume_qty || 0)} | Điều chỉnh: {Number(m.adjust_qty || 0)}
              </div>
            </div>
          ))}
          {!onSiteMaterials.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Chưa có dữ liệu vật tư on-site.</div> : null}
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
