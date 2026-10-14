'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getProjectPlanDirectEditGuard } from '@/lib/projects/execution-axis'

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '-'
  return Number(n).toLocaleString('vi-VN') + ' vnd'
}

const FORM_LABEL = { fontSize: 11, color: 'var(--text3)', marginBottom: 4 } as const

const MATERIAL_OTHER_VALUE = '__other__'
const LABOR_OTHER_VALUE = '__other_labor__'

const MATERIAL_CATEGORY_OPTIONS = [
  { value: 'ket_cau', label: 'Kết cấu' },
  { value: 'hoan_thien', label: 'Hoàn thiện' },
  { value: 'mep', label: 'Điện nước (MEP)' },
  { value: 'nhan_cong', label: 'Nhân công' },
  { value: 'khac', label: 'Khác' },
]

const MILESTONE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ thực hiện' },
  { value: 'in_progress', label: 'Đang thực hiện' },
  { value: 'completed', label: 'Đã hoàn thành' },
  { value: 'blocked', label: 'Bị chặn' },
  { value: 'cancelled', label: 'Đã hủy' },
]

function executionStateLabel(value?: string | null) {
  switch (String(value || '')) {
    case 'locked': return 'Đã khóa'
    case 'started': return 'Đã bắt đầu thực hiện'
    default: return 'Chưa bắt đầu'
  }
}

function executionStateColor(value?: string | null) {
  switch (String(value || '')) {
    case 'locked': return 'var(--red)'
    case 'started': return 'var(--orange)'
    default: return 'var(--green)'
  }
}

function executionStateReasons(plan?: any) {
  const reasons: string[] = []
  if (!plan) return reasons
  const counters = plan?.execution_counters || {}
  if (String(plan?.status || '') === 'locked') reasons.push('Kế hoạch đã được khóa')
  if (Number(counters?.inventory_posted_count || 0) > 0) reasons.push(`Đã có ${Number(counters.inventory_posted_count)} phiếu kho đã ghi sổ`)
  if (Number(counters?.direct_purchase_confirmed_count || 0) > 0) reasons.push(`Đã có ${Number(counters.direct_purchase_confirmed_count)} mua trực tiếp đã xác nhận`)
  if (Number(counters?.labor_attendance_confirmed_count || 0) > 0) reasons.push(`Đã có ${Number(counters.labor_attendance_confirmed_count)} dòng chấm công đã xác nhận`)
  if (Number(counters?.labor_payment_count || 0) > 0) reasons.push(`Đã có ${Number(counters.labor_payment_count)} dòng thanh toán công`)
  return reasons
}

function planRoleLabel(value?: string | null) {
  switch (String(value || 'primary')) {
    case 'backup': return 'Dự phòng'
    case 'supplement': return 'Bổ sung'
    default: return 'Chính'
  }
}

function planScheduleLabel(plan?: any) {
  if (!plan?.planned_start_date || !plan?.planned_end_date) return 'Chưa đặt khoảng thời gian'
  const now = Date.now()
  const start = new Date(String(plan.planned_start_date)).getTime()
  const end = new Date(String(plan.planned_end_date)).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Chưa đặt khoảng thời gian'
  if (now < start) return 'Chưa tới ngày bắt đầu'
  if (now > end) return 'Đã qua ngày kết thúc'
  return 'Đang trong thời gian kế hoạch'
}

function planScheduleColor(plan?: any) {
  const label = planScheduleLabel(plan)
  if (label === 'Đang trong thời gian kế hoạch') return 'var(--green)'
  if (label === 'Đã qua ngày kết thúc') return 'var(--red)'
  return 'var(--text3)'
}

export default function ProjectPlanningPage() {
  const params = useParams<{ id: string }>()
  const id = String(params?.id || '')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [data, setData] = useState<any>(null)

  const [editingResourceItemId, setEditingResourceItemId] = useState('')
  const [selectedResourcePlanId, setSelectedResourcePlanId] = useState('')
  const [actualSummary, setActualSummary] = useState<any>(null)
  const [selectedPlanMilestoneId, setSelectedPlanMilestoneId] = useState('')
  const [editingResourcePlanId, setEditingResourcePlanId] = useState('')
  const [materialOptions, setMaterialOptions] = useState<Array<{ material_key: string; material_name: string; unit: string }>>([])
  const [laborTradeOptions, setLaborTradeOptions] = useState<Array<{ id: string; trade_key: string; trade_name: string; unit_text?: string | null }>>([])
  const [supplierOptions, setSupplierOptions] = useState<Array<{ id: string; supplier_name: string; supplier_code: string }>>([])
  const [subcontractorOptions, setSubcontractorOptions] = useState<Array<{ id: string; supplier_name: string; supplier_code: string }>>([])
  const [supplierPrices, setSupplierPrices] = useState<Array<{ material_key: string; price_per_unit: number }>>([])
  const [selectedMaterialKey, setSelectedMaterialKey] = useState('')
  const [editingMilestoneId, setEditingMilestoneId] = useState('')
  const [milestoneTemplateOptions, setMilestoneTemplateOptions] = useState<any[]>([])
  const [milestoneDefinitionOptions, setMilestoneDefinitionOptions] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateApplyMode, setTemplateApplyMode] = useState<'append' | 'replace'>('append')
  const [templateBaseDate, setTemplateBaseDate] = useState('')
  const [showForms, setShowForms] = useState(true)
  const [showResourceItemForm, setShowResourceItemForm] = useState(true)
  const [showResourceItemList, setShowResourceItemList] = useState(true)
  const [resourceItemTab, setResourceItemTab] = useState<'all' | 'material' | 'labor'>('all')
  const [onlyOutOfPlanExcess, setOnlyOutOfPlanExcess] = useState(false)
  const [milestoneForm, setMilestoneForm] = useState({
    milestone_definition_id: '',
    milestone_name: '',
    status_key: 'pending',
    due_date: '',
    sort_order: '0',
  })

  const [newResourceItem, setNewResourceItem] = useState({
    resource_kind: 'material',
    category: '',
    item_key: '',
    item_name: '',
    unit: '',
    quantity: '',
    unit_cost: '',
    estimated_cost: '',
    labor_type: '',
    labor_trade_id: '',
    supplier_id: '',
    supplier_name: '',
    note: '',
  })
  const [resourcePlanForm, setResourcePlanForm] = useState({
    plan_name: '',
    plan_role: 'primary',
    plan_stage: '',
    status: 'draft',
    milestone_id: '',
    subcontractor_id: '',
    planned_start_date: '',
    planned_end_date: '',
    note: '',
  })

  function switchResourceItemKind(kind: 'material' | 'labor') {
    setSelectedMaterialKey('')
    setNewResourceItem((x) => ({
      ...x,
      resource_kind: kind,
      category: '',
      item_key: '',
      item_name: '',
      unit: kind === 'labor' ? 'công' : '',
      supplier_id: '',
      supplier_name: '',
      labor_type: '',
      labor_trade_id: '',
      quantity: '',
      unit_cost: '',
      estimated_cost: '',
    }))
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function load() {
    if (!id) return
    setLoading(true)
    setError('')
    const [res, mRes, lRes, sRes, subRes, tplRes, defRes] = await Promise.all([
      fetch(`/api/projects/${id}/investor-view`, { cache: 'no-store' }),
      fetch('/api/settings/estimate/materials?active_only=true'),
      fetch('/api/labor/trades?active_only=true'),
      fetch('/api/settings/suppliers?active_only=true'),
      fetch('/api/subcontractors?active_only=true'),
      fetch('/api/settings/project-milestone-templates'),
      fetch('/api/settings/project-milestone-definitions?active_only=true'),
    ])
    const j = await res.json().catch(() => ({}))
    const mJson = await mRes.json().catch(() => ({}))
    const lJson = await lRes.json().catch(() => ({}))
    const sJson = await sRes.json().catch(() => ({}))
    const subJson = await subRes.json().catch(() => ({}))
    const tplJson = await tplRes.json().catch(() => ({}))
    const defJson = await defRes.json().catch(() => ({}))
    if (!res.ok) {
      setError(String(j?.error || 'Khong tai duoc du lieu du an'))
      setLoading(false)
      return
    }
    setData(j?.data || null)
    const mats = Array.isArray(mJson?.data) ? mJson.data : []
    setMaterialOptions(
      mats
        .map((x: any) => ({
          material_key: String(x?.material_key || '').trim(),
          material_name: String(x?.material_name || '').trim(),
          unit: String(x?.unit || '').trim(),
        }))
        .filter((x: any) => x.material_key && x.material_name)
    )
    const laborTrades = Array.isArray(lJson?.data) ? lJson.data : []
    setLaborTradeOptions(
      laborTrades
        .map((x: any) => ({
          id: String(x?.id || ''),
          trade_key: String(x?.trade_key || '').trim(),
          trade_name: String(x?.trade_name || '').trim(),
          unit_text: String(x?.unit_text || '').trim(),
        }))
        .filter((x: any) => x.id && x.trade_key && x.trade_name)
    )
    const suppliers = Array.isArray(sJson?.data) ? sJson.data : []
    setSupplierOptions(
      suppliers
        .map((x: any) => ({ id: String(x?.id || ''), supplier_name: String(x?.supplier_name || ''), supplier_code: String(x?.supplier_code || '') }))
        .filter((x: any) => x.id && x.supplier_name)
    )
    const subcontractors = Array.isArray(subJson?.data) ? subJson.data : []
    setSubcontractorOptions(
      subcontractors
        .map((x: any) => ({ id: String(x?.id || ''), supplier_name: String(x?.supplier_name || ''), supplier_code: String(x?.supplier_code || '') }))
        .filter((x: any) => x.id && x.supplier_name)
    )
    const templates = Array.isArray(tplJson?.data) ? tplJson.data : []
    setMilestoneTemplateOptions(templates)
    if (!selectedTemplateId && templates[0]?.id) setSelectedTemplateId(String(templates[0].id))
    const definitions = Array.isArray(defJson?.data) ? defJson.data : []
    setMilestoneDefinitionOptions(definitions)
    setLoading(false)
  }

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const ov = data?.overview || {}
  const executionAxis = data?.execution_axis || {}
  const resourcePlans = Array.isArray(data?.resources?.plans) ? data.resources.plans : []
  const resourceItems = Array.isArray(data?.resources?.items) ? data.resources.items : []
  const resourceTxns = Array.isArray(data?.resources?.inventory_transactions) ? data.resources.inventory_transactions : []
  const materialLedger = Array.isArray(data?.resources?.material_ledger) ? data.resources.material_ledger : []
  const sortedResourcePlans = [...resourcePlans].sort((a: any, b: any) => {
    const ta = new Date(String(a?.planned_start_date || a?.created_at || 0)).getTime()
    const tb = new Date(String(b?.planned_start_date || b?.created_at || 0)).getTime()
    return ta - tb
  })
  const planSummaryById = (() => {
    const result: Record<string, {
      enough_count: number
      shortage_count: number
      excess_count: number
      total_planned_qty: number
      total_received_qty: number
      total_shortage_qty: number
      total_excess_qty: number
      materials: Array<{
        material_key: string
        material_name: string
        unit: string
        planned_qty: number
        received_qty: number
        shortage_qty: number
        excess_qty: number
      }>
    }> = {}
    for (const plan of sortedResourcePlans) {
      const rows = resourceItems.filter((x: any) => x.plan_id === plan.id && String(x.resource_kind || '') === 'material')
      const matMap = new Map<string, { material_key: string; material_name: string; unit: string; planned_qty: number }>()
      const receivedMap = new Map<string, number>()
      for (const r of rows) {
        const key = String(r?.item_key || '').trim()
        if (!key) continue
        const prev = matMap.get(key) || {
          material_key: key,
          material_name: String(r?.item_name || key),
          unit: String(r?.unit || ''),
          planned_qty: 0,
        }
        prev.planned_qty += Number(r?.quantity || 0)
        matMap.set(key, prev)
        receivedMap.set(key, Number(receivedMap.get(key) || 0) + Number(r?.actual_received_qty || 0))
      }
      const materials = Array.from(matMap.values()).map((x) => {
        const received = Number(receivedMap.get(x.material_key) || 0)
        const shortage = Math.max(0, x.planned_qty - received)
        const excess = Math.max(0, received - x.planned_qty)
        return {
          ...x,
          received_qty: received,
          shortage_qty: shortage,
          excess_qty: excess,
        }
      })
      const totalPlannedQty = materials.reduce((sum, x) => sum + Number(x.planned_qty || 0), 0)
      const totalReceivedQty = materials.reduce((sum, x) => sum + Number(x.received_qty || 0), 0)
      const totalShortageQty = materials.reduce((sum, x) => sum + Number(x.shortage_qty || 0), 0)
      const totalExcessQty = materials.reduce((sum, x) => sum + Number(x.excess_qty || 0), 0)
      result[plan.id] = {
        enough_count: materials.filter((x) => x.shortage_qty === 0 && x.excess_qty === 0).length,
        shortage_count: materials.filter((x) => x.shortage_qty > 0).length,
        excess_count: materials.filter((x) => x.excess_qty > 0).length,
        total_planned_qty: totalPlannedQty,
        total_received_qty: totalReceivedQty,
        total_shortage_qty: totalShortageQty,
        total_excess_qty: totalExcessQty,
        materials,
      }
    }
    return result
  })()

  const selectedResourcePlan = resourcePlans.find((x: any) => x.id === selectedResourcePlanId) || resourcePlans[0] || null
  const milestones = Array.isArray(data?.milestones) ? data.milestones : []
  const availablePlanningMilestones = milestones.filter((m: any) => !['completed', 'cancelled', 'blocked'].includes(String(m?.status_key || '')))
  const selectedResourcePlanItems = resourceItems.filter((x: any) => x.plan_id === (selectedResourcePlan?.id || ''))
  const filteredResourcePlanItems = selectedResourcePlanItems.filter((x: any) => {
    if (resourceItemTab === 'material') return String(x?.resource_kind || '') === 'material'
    if (resourceItemTab === 'labor') return String(x?.resource_kind || '') === 'labor'
    return true
  })
  const selectedResourcePlanTxns = resourceTxns.filter((x: any) => String(x?.reference_id || '') === String(selectedResourcePlan?.id || ''))
  const hasActualFlow = Array.isArray(actualSummary?.all_items)
    ? actualSummary.all_items.some((x: any) =>
        Number(x?.issued_qty || 0) > 0 ||
        Number(x?.received_qty || 0) > 0 ||
        Number(x?.returned_qty || 0) > 0 ||
        Number(x?.actual_issued_qty || 0) > 0 ||
        Number(x?.actual_received_qty || 0) > 0 ||
        Number(x?.actual_returned_qty || 0) > 0,
      )
    : false
  const selectedPlanEditGuard = getProjectPlanDirectEditGuard(selectedResourcePlan, executionAxis)
  const canDirectEditSelectedPlan = !!selectedResourcePlan?.id && selectedPlanEditGuard.can_edit
  const canEditPlanMilestone = !!selectedResourcePlan?.id && canDirectEditSelectedPlan && String(selectedResourcePlan?.status || '') !== 'locked' && !hasActualFlow
  const formatTxnItems = (items: any[]) => {
    if (!Array.isArray(items) || !items.length) return 'Không có vật tư'
    return items
      .map((it: any) => {
        const name = String(it?.material_name || it?.material_key || '-').trim()
        const key = String(it?.material_key || '').trim()
        const qty = Number(it?.quantity || 0)
        const unit = String(it?.item_unit || '').trim()
        return `${name}${key ? ` (${key})` : ''}: ${qty}${unit ? ` ${unit}` : ''}`
      })
      .join(' | ')
  }

  useEffect(() => {
    if (!selectedResourcePlan?.id) {
      setActualSummary(null)
      setSelectedPlanMilestoneId('')
      return
    }
    setSelectedPlanMilestoneId(String(selectedResourcePlan?.milestone_id || ''))
    ;(async () => {
      const res = await fetch(`/api/projects/${id}/resource-plans/${selectedResourcePlan.id}/actual-summary`, { cache: 'no-store' })
      const j = await res.json().catch(() => ({}))
      setActualSummary(j?.data || null)
    })()
  }, [id, selectedResourcePlan?.id])

  async function savePlanMilestone() {
    if (!selectedResourcePlan?.id) return showToast('Chưa chọn kế hoạch')
    const res = await fetch(`/api/projects/${id}/resource-plans/${selectedResourcePlan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ milestone_id: selectedPlanMilestoneId || null }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không cập nhật được tiến độ cho kế hoạch')
    await load()
    showToast('Đã cập nhật tiến độ cho kế hoạch')
  }

  useEffect(() => {
    if (newResourceItem.resource_kind !== 'material') return
    const supplierId = String(newResourceItem.supplier_id || '').trim()
    if (!supplierId) {
      setSupplierPrices([])
      return
    }
    ;(async () => {
      const res = await fetch(`/api/settings/supplier-prices?active_only=true&supplier_id=${encodeURIComponent(supplierId)}`)
      const j = await res.json().catch(() => ({}))
      const rows = Array.isArray(j?.data) ? j.data : []
      setSupplierPrices(
        rows
          .map((x: any) => ({ material_key: String(x?.material_key || '').trim(), price_per_unit: Number(x?.price_per_unit || 0) }))
          .filter((x: any) => x.material_key && x.price_per_unit > 0)
      )
    })()
  }, [newResourceItem.supplier_id, newResourceItem.resource_kind])

  useEffect(() => {
    if (newResourceItem.resource_kind !== 'material') return
    const matKey = String(selectedMaterialKey || '').trim()
    if (!matKey || matKey === MATERIAL_OTHER_VALUE) return
    const mat = materialOptions.find((x) => x.material_key === matKey)
    if (!mat) return
    setNewResourceItem((prev) => ({
      ...prev,
      item_key: mat.material_key,
      item_name: mat.material_name,
      unit: mat.unit || prev.unit,
    }))
  }, [selectedMaterialKey, materialOptions])

  useEffect(() => {
    if (newResourceItem.resource_kind !== 'material') return
    const matKey = String(newResourceItem.item_key || '').trim()
    if (!matKey) return
    const price = supplierPrices.find((x) => x.material_key === matKey)
    if (!price || !(price.price_per_unit > 0)) return
    setNewResourceItem((prev) => ({ ...prev, unit_cost: String(price.price_per_unit) }))
  }, [newResourceItem.item_key, supplierPrices])

  async function submitResourceItem() {
    if (!selectedResourcePlan?.id) return showToast('Chua chon ke hoach')
    if (!newResourceItem.item_name.trim()) return showToast('Thieu ten hang muc')
    const isEdit = !!editingResourceItemId
    const url = isEdit
      ? `/api/projects/${id}/resource-items/${editingResourceItemId}`
      : `/api/projects/${id}/resource-plans/${selectedResourcePlan.id}/items`
    const res = await fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newResourceItem),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Khong luu duoc item')
    resetResourceItemForm()
    await load()
    showToast('Da luu item')
  }

  function resetResourcePlanForm() {
    setEditingResourcePlanId('')
    setResourcePlanForm({
      plan_name: '',
      plan_role: 'primary',
      plan_stage: '',
      status: 'draft',
      milestone_id: '',
      subcontractor_id: '',
      planned_start_date: '',
      planned_end_date: '',
      note: '',
    })
  }

  function createSupplementaryPlanFromSelected() {
    if (!selectedResourcePlan) return
    const baseName = String(selectedResourcePlan.plan_name || 'Kế hoạch').trim()
    const nextName = /bổ sung/i.test(baseName) ? baseName : `${baseName} - bổ sung`
    setEditingResourcePlanId('')
    setResourcePlanForm({
        plan_name: nextName,
        plan_role: 'supplement',
        plan_stage: String(selectedResourcePlan.plan_stage || ''),
        status: 'draft',
      milestone_id: String(selectedResourcePlan.milestone_id || ''),
      subcontractor_id: String(selectedResourcePlan.subcontractor_id || ''),
      planned_start_date: '',
      planned_end_date: '',
      note: `Bổ sung từ kế hoạch: ${baseName}`,
    })
    setShowForms(true)
  }

  async function submitResourcePlan() {
    const name = String(resourcePlanForm.plan_name || '').trim()
    if (!name) return showToast('Thiếu tên kế hoạch')
    const isEdit = !!editingResourcePlanId
    const url = isEdit
      ? `/api/projects/${id}/resource-plans/${editingResourcePlanId}`
      : `/api/projects/${id}/resource-plans`
    const res = await fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_name: name,
        plan_role: resourcePlanForm.plan_role || 'primary',
        plan_stage: resourcePlanForm.plan_stage || null,
        status: resourcePlanForm.status || 'draft',
        milestone_id: resourcePlanForm.milestone_id || null,
        subcontractor_id: resourcePlanForm.subcontractor_id || null,
        planned_start_date: resourcePlanForm.planned_start_date || null,
        planned_end_date: resourcePlanForm.planned_end_date || null,
        note: resourcePlanForm.note || null,
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không lưu được kế hoạch')
    const savedId = String(j?.data?.id || '').trim()
    await load()
    if (savedId) setSelectedResourcePlanId(savedId)
    resetResourcePlanForm()
    showToast(isEdit ? 'Đã cập nhật kế hoạch' : 'Đã tạo kế hoạch')
  }

  async function removeResourcePlan(planId: string) {
    if (!confirm('Xóa kế hoạch này?')) return
    const res = await fetch(`/api/projects/${id}/resource-plans/${planId}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không xóa được kế hoạch')
    if (selectedResourcePlanId === planId) setSelectedResourcePlanId('')
    if (editingResourcePlanId === planId) resetResourcePlanForm()
    await load()
    showToast('Đã xóa kế hoạch')
  }

  async function setPlanRole(planId: string, planRole: string) {
    const res = await fetch(`/api/projects/${id}/resource-plans/${planId}/activation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_role', plan_role: planRole }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Khong cap nhat duoc vai tro ke hoach')
    await load()
    showToast('Da cap nhat vai tro ke hoach')
  }

  async function activatePlan(planId: string, resourceKind: 'material' | 'labor') {
    const res = await fetch(`/api/projects/${id}/resource-plans/${planId}/activation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate', resource_kind: resourceKind }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Khong kich hoat duoc ke hoach')
    await load()
    showToast(resourceKind === 'material' ? 'Da dat ke hoach vat tu dang van hanh' : 'Da dat ke hoach nhan cong dang van hanh')
  }

  function resetResourceItemForm() {
    setEditingResourceItemId('')
    setNewResourceItem({
      resource_kind: 'material',
      category: '',
      item_key: '',
      item_name: '',
      unit: '',
      quantity: '',
      unit_cost: '',
      estimated_cost: '',
      labor_type: '',
      labor_trade_id: '',
      supplier_id: '',
      supplier_name: '',
      note: '',
    })
    setSelectedMaterialKey('')
  }

  async function removeResourceItem(itemId: string) {
    if (!confirm('Xoa item nay?')) return
    const res = await fetch(`/api/projects/${id}/resource-items/${itemId}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Khong xoa duoc item')
    await load()
    showToast('Da xoa item')
  }

  async function submitMilestone() {
    if (!milestoneForm.milestone_definition_id) return showToast('Vui lòng chọn mốc gốc')
    const name = String(milestoneForm.milestone_name || '').trim()
    if (!name) return showToast('Thiếu tên tiến độ')
    const isEdit = !!editingMilestoneId
    const url = isEdit
      ? `/api/projects/${id}/milestones/${editingMilestoneId}`
      : `/api/projects/${id}/milestones`
    const res = await fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        milestone_definition_id: milestoneForm.milestone_definition_id || null,
        milestone_name: name,
        status_key: milestoneForm.status_key || 'pending',
        due_date: milestoneForm.due_date || null,
        sort_order: Number(milestoneForm.sort_order || 0),
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không lưu được tiến độ')
    if (Array.isArray(j?.warnings) && j.warnings.length > 0) {
      showToast(j.warnings.join(' | '))
    }
    setEditingMilestoneId('')
    setMilestoneForm({ milestone_definition_id: '', milestone_name: '', status_key: 'pending', due_date: '', sort_order: '0' })
    await load()
    showToast(isEdit ? 'Đã cập nhật tiến độ' : 'Đã tạo tiến độ')
  }

  async function removeMilestone(milestoneId: string) {
    if (!confirm('Xóa mốc tiến độ này?')) return
    const res = await fetch(`/api/projects/${id}/milestones/${milestoneId}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không xóa được tiến độ')
    if (editingMilestoneId === milestoneId) {
      setEditingMilestoneId('')
      setMilestoneForm({ milestone_definition_id: '', milestone_name: '', status_key: 'pending', due_date: '', sort_order: '0' })
    }
    await load()
    showToast('Đã xóa tiến độ')
  }

  async function applyTemplateToProject() {
    if (!selectedTemplateId) return showToast('Chưa chọn mẫu tiến độ')
    const ok = confirm(templateApplyMode === 'replace'
      ? 'Thay thế toàn bộ tiến độ hiện tại bằng mẫu đã chọn?'
      : 'Bổ sung các mốc từ mẫu vào tiến độ hiện tại?')
    if (!ok) return
    const res = await fetch(`/api/projects/${id}/milestones/apply-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: selectedTemplateId, mode: templateApplyMode, base_date: templateBaseDate || null }),
    })
    const j = await res.json().catch(() => ({}))
    if (j?.error === 'Thieu moc_dau_de_tinh_thoi_han_hoan_thanh') {
      return showToast('Mẫu có thời hạn mặc định, vui lòng nhập mốc đầu')
    }
    if (!res.ok) return showToast(j?.error || 'Không áp được mẫu tiến độ')
    await load()
    showToast(`Đã áp mẫu (${j?.data?.created_count || 0} mốc)`)
  }

  if (loading) return <div style={{ padding: 16 }}>Dang tai du lieu...</div>
  if (error) return <div style={{ padding: 16, color: 'var(--red)' }}>{error}</div>

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)' }}>KE HOACH DU AN</div>
          <h1 style={{ margin: '4px 0 2px', fontSize: 22, fontWeight: 800 }}>Lập kế hoạch dự án</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{ov.project_name || '-'} | {ov.customer?.full_name || '-'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn-ghost" href={`/projects/${id}/overview`}>Tổng quan</Link>
          <Link className="btn-ghost" href={`/projects/${id}/operations`}>Vận hành</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>Quản lý tiến độ dự án</div>
          <button className="btn-ghost" onClick={() => setShowForms((x) => !x)}>
            {showForms ? 'Ẩn form tạo/sửa' : 'Hiện form tạo/sửa'}
          </button>
        </div>

        {showForms ? (
          <>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Mẫu tiến độ</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .8fr .8fr auto', gap: 6 }}>
                <select className="select" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                  <option value="">(Chọn mẫu tiến độ)</option>
                  {milestoneTemplateOptions.map((x: any) => <option key={x.id} value={x.id}>{x.template_name} ({x.items?.length || 0} mốc)</option>)}
                </select>
                <select className="select" value={templateApplyMode} onChange={(e) => setTemplateApplyMode(String(e.target.value) === 'replace' ? 'replace' : 'append')}>
                  <option value="append">Bổ sung mốc</option>
                  <option value="replace">Thay thế toàn bộ</option>
                </select>
                <input className="input" type="date" value={templateBaseDate} onChange={(e) => setTemplateBaseDate(e.target.value)} placeholder="Mốc đầu" />
                <button className="btn-primary" onClick={applyTemplateToProject}>Áp mẫu vào dự án</button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                Mốc đầu dùng để tính tự động hạn hoàn thành theo số ngày mặc định của từng mốc trong mẫu.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr .9fr .9fr .6fr auto', gap: 6, marginBottom: 8 }}>
              <div>
                <div style={FORM_LABEL}>Mốc gốc</div>
                <select className="select" value={milestoneForm.milestone_definition_id} onChange={(e) => {
                  const defId = e.target.value
                  const d = milestoneDefinitionOptions.find((x: any) => String(x.id) === defId)
                  setMilestoneForm((x) => ({
                    ...x,
                    milestone_definition_id: defId,
                    milestone_name: d?.definition_name ? String(d.definition_name) : x.milestone_name,
                    status_key: d?.default_status_key ? String(d.default_status_key) : x.status_key,
                  }))
                }}>
                  <option value="">(Chọn mốc gốc)</option>
                  {milestoneDefinitionOptions.map((d: any) => <option key={d.id} value={d.id}>{d.definition_name}</option>)}
                </select>
              </div>
              <div>
                <div style={FORM_LABEL}>Tên tiến độ</div>
                <input
                  className="input"
                  value={milestoneForm.milestone_name}
                  onChange={(e) => setMilestoneForm((x) => ({ ...x, milestone_name: e.target.value }))}
                  disabled={!milestoneForm.milestone_definition_id}
                  placeholder={!milestoneForm.milestone_definition_id ? 'Chọn mốc gốc trước' : ''}
                />
              </div>
              <div>
                <div style={FORM_LABEL}>Trạng thái</div>
                <select className="select" value={milestoneForm.status_key} onChange={(e) => setMilestoneForm((x) => ({ ...x, status_key: e.target.value }))}>
                  {MILESTONE_STATUS_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </div>
              <div>
                <div style={FORM_LABEL}>Hạn mốc</div>
                <input className="input" type="date" value={milestoneForm.due_date} onChange={(e) => setMilestoneForm((x) => ({ ...x, due_date: e.target.value }))} />
              </div>
              <div>
                <div style={FORM_LABEL}>Thứ tự</div>
                <input className="input" type="number" value={milestoneForm.sort_order} onChange={(e) => setMilestoneForm((x) => ({ ...x, sort_order: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                <button className="btn-primary" onClick={submitMilestone} disabled={!milestoneForm.milestone_definition_id}>{editingMilestoneId ? 'Lưu sửa' : '+ Tạo mốc'}</button>
                {editingMilestoneId ? <button className="btn-ghost" onClick={() => { setEditingMilestoneId(''); setMilestoneForm({ milestone_definition_id: '', milestone_name: '', status_key: 'pending', due_date: '', sort_order: '0' }) }}>Hủy</button> : null}
              </div>
            </div>

            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12 }}>
              {milestones.map((m: any) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{m.milestone_name}</div>
                    <div style={{ color: 'var(--text3)' }}>
                      Trạng thái: {m?.status_ref?.status_name || m.status_key || '-'} | Hạn: {m?.due_date ? new Date(String(m.due_date)).toLocaleDateString('vi-VN') : '-'} | Thứ tự: {m?.sort_order ?? 0}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => {
                      setEditingMilestoneId(String(m.id || ''))
                      setMilestoneForm({
                        milestone_definition_id: String(m.milestone_definition_id || ''),
                        milestone_name: String(m.milestone_name || ''),
                        status_key: String(m.status_key || 'pending'),
                        due_date: m?.due_date ? new Date(String(m.due_date)).toISOString().slice(0, 10) : '',
                        sort_order: String(m?.sort_order ?? 0),
                      })
                    }}>Sửa</button>
                    <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => removeMilestone(m.id)}>Xóa</button>
                  </div>
                </div>
              ))}
              {!milestones.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Chưa có mốc tiến độ.</div> : null}
            </div>

            <div style={{ fontWeight: 700, marginBottom: 8 }}>Kế hoạch vật tư / nhân công</div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              {editingResourcePlanId ? 'Sửa kế hoạch' : 'Tạo kế hoạch mới'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, lineHeight: 1.5 }}>
              Một kế hoạch là vỏ chứa item nguồn lực. Sau khi tạo kế hoạch, chọn kế hoạch đó ở danh sách bên dưới rồi thêm từng item với <b>Loại nguồn lực = Vật tư</b> hoặc <b>Nhân công</b>.
              Nếu muốn tách riêng, hãy tạo 2 kế hoạch khác nhau: 1 kế hoạch vật tư và 1 kế hoạch nhân công.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr .8fr .8fr .8fr .8fr auto', gap: 6, marginBottom: 8 }}>
                <div>
                  <div style={FORM_LABEL}>Tên kế hoạch</div>
                  <input className="input" value={resourcePlanForm.plan_name} onChange={(e) => setResourcePlanForm((x) => ({ ...x, plan_name: e.target.value }))} />
                </div>
                <div>
                  <div style={FORM_LABEL}>Vai trò</div>
                  <select className="select" value={resourcePlanForm.plan_role} onChange={(e) => setResourcePlanForm((x) => ({ ...x, plan_role: e.target.value }))}>
                    <option value="primary">Chính</option>
                    <option value="backup">Dự phòng</option>
                    <option value="supplement">Bổ sung</option>
                  </select>
                </div>
                <div>
                  <div style={FORM_LABEL}>Giai đoạn</div>
                  <input className="input" value={resourcePlanForm.plan_stage} onChange={(e) => setResourcePlanForm((x) => ({ ...x, plan_stage: e.target.value }))} placeholder="Ví dụ: đợt 1" />
                </div>
                <div>
                  <div style={FORM_LABEL}>Trạng thái</div>
                  <select className="select" value={resourcePlanForm.status} onChange={(e) => setResourcePlanForm((x) => ({ ...x, status: e.target.value }))}>
                    <option value="draft">Nháp</option>
                    <option value="in_review">Đang duyệt</option>
                    <option value="approved">Đã duyệt</option>
                    <option value="locked">Đã khóa</option>
                  </select>
                </div>
                <div>
                  <div style={FORM_LABEL}>Tiến độ</div>
                  <select className="select" value={resourcePlanForm.milestone_id} onChange={(e) => setResourcePlanForm((x) => ({ ...x, milestone_id: e.target.value }))}>
                    <option value="">(Chưa gán tiến độ)</option>
                    {availablePlanningMilestones.map((m: any) => <option key={m.id} value={m.id}>{m.milestone_name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={FORM_LABEL}>Bắt đầu</div>
                  <input className="input" type="date" value={resourcePlanForm.planned_start_date} onChange={(e) => setResourcePlanForm((x) => ({ ...x, planned_start_date: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                  <button className="btn-primary" onClick={submitResourcePlan}>{editingResourcePlanId ? 'Lưu sửa' : '+ Tạo kế hoạch'}</button>
                  {editingResourcePlanId ? <button className="btn-ghost" onClick={resetResourcePlanForm}>Hủy</button> : null}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '.8fr 1fr 2fr', gap: 6 }}>
                <div>
                  <div style={FORM_LABEL}>Kết thúc</div>
                  <input className="input" type="date" value={resourcePlanForm.planned_end_date} onChange={(e) => setResourcePlanForm((x) => ({ ...x, planned_end_date: e.target.value }))} />
                </div>
                <div>
                  <div style={FORM_LABEL}>Thầu phụ phụ trách</div>
                  <select className="select" value={resourcePlanForm.subcontractor_id} onChange={(e) => setResourcePlanForm((x) => ({ ...x, subcontractor_id: e.target.value }))}>
                    <option value="">(Chưa gán thầu phụ)</option>
                    {subcontractorOptions.map((row) => <option key={row.id} value={row.id}>{row.supplier_name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={FORM_LABEL}>Ghi chú kế hoạch</div>
                  <input className="input" value={resourcePlanForm.note} onChange={(e) => setResourcePlanForm((x) => ({ ...x, note: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr', gap: 6, marginBottom: 8 }}>
              <div style={FORM_LABEL}>Kế hoạch</div>
              <select className="select" value={selectedResourcePlan?.id || ''} onChange={(e) => setSelectedResourcePlanId(e.target.value)}>
                {resourcePlans.map((p: any) => {
                  const activeBadges = [
                    p?.is_active_material_plan ? 'Vat tu dang van hanh' : '',
                    p?.is_active_labor_plan ? 'Nhan cong dang van hanh' : '',
                  ].filter(Boolean).join(' + ')
                  return (
                    <option key={p.id} value={p.id}>
                      {p.plan_name} ({p.status}) | {planRoleLabel(p.plan_role)} | {executionStateLabel(p.execution_state)}{p?.milestone?.milestone_name ? ` | ${p.milestone.milestone_name}` : ''}{p?.subcontractor?.supplier_name ? ` | TP: ${p.subcontractor.supplier_name}` : ''}{activeBadges ? ` | ${activeBadges}` : ''}
                    </option>
                  )
                })}
                {!resourcePlans.length ? <option value="">(Chưa có kế hoạch)</option> : null}
              </select>
            </div>
            {selectedResourcePlan ? (
              <div style={{ fontSize: 12, color: executionStateColor(selectedResourcePlan.execution_state), marginBottom: 8, fontWeight: 700 }}>
                Trạng thái thực thi kế hoạch: {executionStateLabel(selectedResourcePlan.execution_state)}
              </div>
            ) : null}
            {selectedResourcePlan ? (
              <div style={{ fontSize: 12, color: planScheduleColor(selectedResourcePlan), marginBottom: 8 }}>
                Trạng thái theo thời gian: <b>{planScheduleLabel(selectedResourcePlan)}</b>
              </div>
            ) : null}
            {selectedResourcePlan ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, lineHeight: 1.5 }}>
                Lưu ý: <b>Đã bắt đầu thực hiện</b> chỉ xuất hiện khi kế hoạch đã có phát sinh thực tế như phiếu kho đã ghi sổ, mua trực tiếp đã xác nhận, chấm công đã xác nhận hoặc thanh toán công.
                Ngày bắt đầu chỉ dùng để thể hiện kế hoạch đang tới kỳ hay chưa.
              </div>
            ) : null}
            {selectedResourcePlan && ['started', 'locked'].includes(String(selectedResourcePlan.execution_state || 'not_started')) ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                Lý do: {executionStateReasons(selectedResourcePlan).join(' | ') || 'Đã có phát sinh thực tế'}
              </div>
            ) : null}
            {selectedResourcePlan ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                Vai tro trong truc van hanh:
                {' '}
                {selectedResourcePlan.is_active_material_plan || selectedResourcePlan.is_active_labor_plan
                  ? 'Day la ke hoach dang van hanh'
                  : 'Day khong phai ke hoach dang van hanh'}
              </div>
            ) : null}
            {selectedResourcePlan ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                Vai tro ke hoach: <b style={{ color: 'var(--text)' }}>{planRoleLabel(selectedResourcePlan.plan_role)}</b>
              </div>
            ) : null}
            {selectedResourcePlan?.subcontractor?.supplier_name ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                Thầu phụ phụ trách: <b style={{ color: 'var(--text)' }}>{selectedResourcePlan.subcontractor.supplier_name}</b>
              </div>
            ) : null}
            {selectedResourcePlan && !canDirectEditSelectedPlan ? (
              <div style={{ fontSize: 12, color: 'var(--orange)', marginBottom: 8 }}>
                Khoa sua truc tiep: {selectedPlanEditGuard.reasons.join(' | ')}
              </div>
            ) : null}
            {selectedResourcePlan ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 8 }}>
                <button className="btn-ghost" onClick={createSupplementaryPlanFromSelected}>
                  Tạo kế hoạch bổ sung
                </button>
                <button
                  className="btn-ghost"
                  disabled={!canDirectEditSelectedPlan}
                  onClick={() => {
                    if (!canDirectEditSelectedPlan) return
                    setEditingResourcePlanId(String(selectedResourcePlan.id || ''))
                    setResourcePlanForm({
                      plan_name: String(selectedResourcePlan.plan_name || ''),
                      plan_role: String(selectedResourcePlan.plan_role || 'primary'),
                      plan_stage: String(selectedResourcePlan.plan_stage || ''),
                      status: String(selectedResourcePlan.status || 'draft'),
                      milestone_id: String(selectedResourcePlan.milestone_id || ''),
                      subcontractor_id: String(selectedResourcePlan.subcontractor_id || ''),
                      planned_start_date: selectedResourcePlan?.planned_start_date ? new Date(String(selectedResourcePlan.planned_start_date)).toISOString().slice(0, 10) : '',
                      planned_end_date: selectedResourcePlan?.planned_end_date ? new Date(String(selectedResourcePlan.planned_end_date)).toISOString().slice(0, 10) : '',
                      note: String(selectedResourcePlan.note || ''),
                    })
                  }}
                >
                  Sửa kế hoạch đang chọn
                </button>
                {String(selectedResourcePlan.execution_state || '') === 'not_started' ? (
                  <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => removeResourcePlan(selectedResourcePlan.id)}>
                    Xóa kế hoạch đang chọn
                  </button>
                ) : null}
              </div>
            ) : null}
            {selectedResourcePlan ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                <button className="btn-ghost" onClick={() => setPlanRole(selectedResourcePlan.id, 'primary')}>
                  Đặt làm kế hoạch chính
                </button>
                <button className="btn-ghost" onClick={() => setPlanRole(selectedResourcePlan.id, 'backup')}>
                  Đặt làm kế hoạch dự phòng
                </button>
                <button className="btn-ghost" onClick={() => setPlanRole(selectedResourcePlan.id, 'supplement')}>
                  Đặt làm kế hoạch bổ sung
                </button>
                {Array.isArray(selectedResourcePlan?.plan_kinds) && selectedResourcePlan.plan_kinds.includes('material') ? (
                  <button className="btn-primary" onClick={() => activatePlan(selectedResourcePlan.id, 'material')}>
                    Đặt kế hoạch vật tư đang vận hành
                  </button>
                ) : null}
                {Array.isArray(selectedResourcePlan?.plan_kinds) && selectedResourcePlan.plan_kinds.includes('labor') ? (
                  <button className="btn-primary" onClick={() => activatePlan(selectedResourcePlan.id, 'labor')}>
                    Đặt kế hoạch nhân công đang vận hành
                  </button>
                ) : null}
              </div>
            ) : null}
            {selectedResourcePlan ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                `/projects/[id]/operations` chỉ nhận kế hoạch <b>vật tư đang vận hành</b>. Vì vậy cần bấm <b>Đặt kế hoạch vật tư đang vận hành</b> thì kế hoạch đó mới hiện ở trang vận hành để tạo action kho.
              </div>
            ) : null}
            {selectedResourcePlan ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr auto', gap: 6, marginBottom: 10 }}>
                  <div>
                    <div style={FORM_LABEL}>Tiến độ áp dụng cho kế hoạch</div>
                    <select className="select" value={selectedPlanMilestoneId} onChange={(e) => setSelectedPlanMilestoneId(e.target.value)} disabled={!canEditPlanMilestone}>
                      <option value="">(Chưa gán tiến độ)</option>
                      {availablePlanningMilestones.map((m: any) => <option key={m.id} value={m.id}>{m.milestone_name}</option>)}
                    </select>
                  </div>
                  {canEditPlanMilestone ? (
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button className="btn-ghost" onClick={savePlanMilestone}>Lưu tiến độ</button>
                    </div>
                  ) : null}
                </div>
                {!canEditPlanMilestone ? (
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                    Kế hoạch khong cho doi tien do truc tiep.
                  </div>
                ) : null}
              </>
            ) : null}

            {selectedResourcePlan ? (
              <div style={{ marginBottom: 8, border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Tổng hợp vật tư theo thực tế</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                  Đã đủ: <b style={{ color: 'var(--text)' }}>{actualSummary?.totals?.enough_items || 0}</b> |
                  Thiếu: <b style={{ color: 'var(--yellow)' }}> {actualSummary?.totals?.shortage_items || 0}</b> |
                  Thừa: <b style={{ color: 'var(--orange)' }}> {actualSummary?.totals?.excess_items || 0}</b>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, maxHeight: 160, overflowY: 'auto' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Đã đủ</div>
                    {(actualSummary?.enough || []).map((x: any) => (
                      <div key={`en_${x.id}`} style={{ fontSize: 12, marginBottom: 4 }}>{x.item_name}: {x.net_received_qty}/{x.planned_qty}</div>
                    ))}
                    {!(actualSummary?.enough || []).length ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Không có</div> : null}
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, maxHeight: 160, overflowY: 'auto' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Còn thiếu</div>
                    {(actualSummary?.shortage || []).map((x: any) => (
                      <div key={`sh_${x.id}`} style={{ fontSize: 12, marginBottom: 4 }}>{x.item_name}: thiếu {x.shortage_qty} {x.unit || ''}</div>
                    ))}
                    {!(actualSummary?.shortage || []).length ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Không có</div> : null}
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, maxHeight: 160, overflowY: 'auto' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Đang thừa</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        checked={onlyOutOfPlanExcess}
                        onChange={(e) => setOnlyOutOfPlanExcess(e.target.checked)}
                      />
                      Chỉ xem thừa ngoài kế hoạch
                    </label>
                    {(actualSummary?.excess || [])
                      .filter((x: any) => !onlyOutOfPlanExcess || String(x?.source || '') === 'direct_purchase_out_of_plan')
                      .map((x: any) => (
                      <div key={`ex_${x.id || x.material_key}`} style={{ fontSize: 12, marginBottom: 4 }}>
                        {x.item_name}: thừa {x.excess_qty} {x.unit || ''}
                        {String(x?.source || '') === 'direct_purchase_out_of_plan' ? (
                          <span style={{ marginLeft: 6, color: 'var(--orange)' }}>[Thừa ngoài kế hoạch]</span>
                        ) : null}
                      </div>
                    ))}
                    {!((actualSummary?.excess || [])
                      .filter((x: any) => !onlyOutOfPlanExcess || String(x?.source || '') === 'direct_purchase_out_of_plan')
                      .length) ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Không có</div> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {selectedResourcePlan ? (
              <div style={{ marginBottom: 8, border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Tổng hợp nhân công theo thực tế</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                  Đã đủ: <b style={{ color: 'var(--text)' }}>{actualSummary?.labor_totals?.enough_items || 0}</b> |
                  Thiếu: <b style={{ color: 'var(--yellow)' }}> {actualSummary?.labor_totals?.shortage_items || 0}</b> |
                  Thừa: <b style={{ color: 'var(--orange)' }}> {actualSummary?.labor_totals?.excess_items || 0}</b>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, maxHeight: 160, overflowY: 'auto' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Đã đủ</div>
                    {(actualSummary?.labor_enough || []).map((x: any) => (
                      <div key={`len_${x.id}`} style={{ fontSize: 12, marginBottom: 4 }}>{x.item_name}: {x.actual_qty}/{x.planned_qty}</div>
                    ))}
                    {!(actualSummary?.labor_enough || []).length ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Không có</div> : null}
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, maxHeight: 160, overflowY: 'auto' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Còn thiếu</div>
                    {(actualSummary?.labor_shortage || []).map((x: any) => (
                      <div key={`lsh_${x.id}`} style={{ fontSize: 12, marginBottom: 4 }}>{x.item_name}: thiếu {x.shortage_qty} {x.unit || ''}</div>
                    ))}
                    {!(actualSummary?.labor_shortage || []).length ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Không có</div> : null}
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, maxHeight: 160, overflowY: 'auto' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Đang thừa</div>
                    {(actualSummary?.labor_excess || []).map((x: any) => (
                      <div key={`lex_${x.id}`} style={{ fontSize: 12, marginBottom: 4 }}>
                        {x.item_name}: thừa {x.excess_qty} {x.unit || ''}
                      </div>
                    ))}
                    {!(actualSummary?.labor_excess || []).length ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Không có</div> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {selectedResourcePlan ? (
              <div style={{ marginBottom: 8, border: '1px solid var(--border)', borderRadius: 8, maxHeight: 180, overflowY: 'auto' }}>
                <div style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
                  Lịch sử phiếu kho của kế hoạch này
                </div>
                {selectedResourcePlanTxns.map((tx: any) => (
                  <div key={tx.id} style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                    {tx.txn_code} | {tx.txn_type === 'in' ? 'Nhập' : tx.txn_type === 'out' ? 'Xuất' : tx.txn_type} | {tx.status} | {tx.warehouse?.warehouse_name || '-'}
                    <div style={{ marginTop: 4, color: 'var(--text3)' }}>
                      {formatTxnItems(Array.isArray(tx.items) ? tx.items : [])}
                    </div>
                  </div>
                ))}
                {!selectedResourcePlanTxns.length ? (
                  <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Chưa có phiếu kho liên kết.</div>
                ) : null}
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>Khối nhập item kế hoạch</div>
              <button className="btn-ghost" type="button" onClick={() => setShowResourceItemForm((v) => !v)}>
                {showResourceItemForm ? 'Ẩn khối nhập item' : 'Hiện khối nhập item'}
              </button>
            </div>

            {showResourceItemForm ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <button
                    type="button"
                    className={newResourceItem.resource_kind === 'material' ? 'btn-primary' : 'btn-ghost'}
                    onClick={() => switchResourceItemKind('material')}
                    style={{ textAlign: 'left', padding: 10 }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Khối item vật tư</div>
                    <div style={{ fontSize: 12, opacity: .9 }}>Dùng để thêm vật tư, nhà cung cấp, đơn giá và số lượng dự kiến.</div>
                  </button>
                  <button
                    type="button"
                    className={newResourceItem.resource_kind === 'labor' ? 'btn-primary' : 'btn-ghost'}
                    onClick={() => switchResourceItemKind('labor')}
                    style={{ textAlign: 'left', padding: 10 }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Khối item nhân công</div>
                    <div style={{ fontSize: 12, opacity: .9 }}>Dùng để thêm loại thợ, khối lượng công và chi phí nhân công dự kiến.</div>
                  </button>
                </div>

                <div style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    {newResourceItem.resource_kind === 'material' ? 'Đang nhập item vật tư' : 'Đang nhập item nhân công'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {newResourceItem.resource_kind === 'material'
                      ? 'Khối này phục vụ kế hoạch vật tư: chọn nhóm vật tư, vật tư, đơn vị, số lượng, đơn giá và nhà cung cấp nếu có.'
                      : 'Khối này phục vụ kế hoạch nhân công: chọn nhóm thợ, loại thợ, khối lượng công, đơn giá công và tổng dự kiến.'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr .9fr 1fr 1fr .7fr .8fr .8fr .9fr auto', gap: 6, marginBottom: 8 }}>
              <div>
                <div style={FORM_LABEL}>Loại nguồn lực</div>
                <select
                  className="select"
                  value={newResourceItem.resource_kind}
                  onChange={(e) => switchResourceItemKind(e.target.value === 'labor' ? 'labor' : 'material')}
                >
                  <option value="material">Vật tư</option>
                  <option value="labor">Nhân công</option>
                </select>
              </div>
              <div>
                <div style={FORM_LABEL}>Nhóm/Loại</div>
                {newResourceItem.resource_kind === 'material' ? (
                  <select className="select" value={newResourceItem.category} onChange={(e) => setNewResourceItem((x) => ({ ...x, category: e.target.value }))}>
                    <option value="">(Chọn nhóm)</option>
                    {MATERIAL_CATEGORY_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                  </select>
                ) : (
                  <select className="select" value={newResourceItem.category} onChange={(e) => setNewResourceItem((x) => ({ ...x, category: e.target.value }))}>
                    <option value="">(Chọn nhóm thợ)</option>
                    <option value="tho_xay">Thợ xây</option>
                    <option value="tho_sat">Thợ sắt</option>
                    <option value="tho_dien">Thợ điện</option>
                    <option value="tho_nuoc">Thợ nước</option>
                    <option value="tho_moc">Thợ mộc</option>
                    <option value="tho_op_lat">Thợ ốp lát</option>
                    <option value="phu">Phụ</option>
                    <option value="khac">Khác</option>
                  </select>
                )}
              </div>
              <div>
                <div style={FORM_LABEL}>{newResourceItem.resource_kind === 'material' ? 'Vật tư' : 'Loại thợ'}</div>
                {newResourceItem.resource_kind === 'material' ? (
                  <select className="select" value={selectedMaterialKey} onChange={(e) => {
                    const val = e.target.value
                    setSelectedMaterialKey(val)
                    if (val === MATERIAL_OTHER_VALUE) {
                      setNewResourceItem((prev) => ({ ...prev, item_key: '', item_name: '', unit: '' }))
                    }
                  }}>
                    <option value="">(Chọn vật tư)</option>
                    {materialOptions.map((m) => <option key={m.material_key} value={m.material_key}>{m.material_name} ({m.material_key})</option>)}
                    <option value={MATERIAL_OTHER_VALUE}>Khác</option>
                  </select>
                ) : (
                  <select
                    className="select"
                    value={newResourceItem.labor_trade_id || ''}
                    onChange={(e) => {
                      const tradeId = e.target.value
                      if (tradeId === LABOR_OTHER_VALUE) {
                        setNewResourceItem((prev) => ({ ...prev, labor_trade_id: '', item_key: '', item_name: '', unit: 'công', labor_type: '', unit_cost: '', estimated_cost: '' }))
                        return
                      }
                      const trade = laborTradeOptions.find((x) => x.id === tradeId) || null
                      setNewResourceItem((prev) => ({
                        ...prev,
                        labor_trade_id: tradeId,
                        item_key: trade?.trade_key || '',
                        item_name: trade?.trade_name || '',
                        unit: trade?.unit_text || 'công',
                        labor_type: trade?.trade_name || '',
                      }))
                    }}
                  >
                    <option value="">(Chọn loại thợ)</option>
                    {laborTradeOptions.map((t) => <option key={t.id} value={t.id}>{t.trade_name} ({t.trade_key})</option>)}
                    <option value={LABOR_OTHER_VALUE}>Khác</option>
                  </select>
                )}
              </div>
              <div>
                <div style={FORM_LABEL}>Tên hạng mục</div>
                <input className="input" value={newResourceItem.item_name} onChange={(e) => setNewResourceItem((x) => ({ ...x, item_name: e.target.value }))} placeholder={selectedMaterialKey === MATERIAL_OTHER_VALUE || newResourceItem.labor_trade_id === LABOR_OTHER_VALUE ? 'Nhập tên khác' : ''} />
              </div>
              <div>
                <div style={FORM_LABEL}>Đơn vị</div>
                <input className="input" value={newResourceItem.unit} onChange={(e) => setNewResourceItem((x) => ({ ...x, unit: e.target.value }))} />
              </div>
              <div>
                <div style={FORM_LABEL}>{newResourceItem.resource_kind === 'material' ? 'Số lượng' : 'Khối lượng công'}</div>
                <input className="input" type="number" value={newResourceItem.quantity} onChange={(e) => setNewResourceItem((x) => ({ ...x, quantity: e.target.value }))} />
              </div>
              <div>
                <div style={FORM_LABEL}>{newResourceItem.resource_kind === 'material' ? 'Đơn giá' : 'Đơn giá công'}</div>
                <input className="input" type="number" value={newResourceItem.unit_cost} onChange={(e) => setNewResourceItem((x) => ({ ...x, unit_cost: e.target.value }))} />
              </div>
              <div>
                <div style={FORM_LABEL}>{newResourceItem.resource_kind === 'material' ? 'Thành tiền' : 'Tổng dự kiến'}</div>
                <input className="input" type="number" value={newResourceItem.estimated_cost} onChange={(e) => setNewResourceItem((x) => ({ ...x, estimated_cost: e.target.value }))} />
              </div>
              <div>
                <div style={FORM_LABEL}>{newResourceItem.resource_kind === 'material' ? 'Nhà cung cấp' : 'Ghi chú thợ'}</div>
                {newResourceItem.resource_kind === 'material' ? (
                  <select className="select" value={newResourceItem.supplier_id} onChange={(e) => {
                    const supplierId = e.target.value
                    const supplier = supplierOptions.find((s) => s.id === supplierId)
                    setNewResourceItem((x) => ({ ...x, supplier_id: supplierId, supplier_name: supplier?.supplier_name || '' }))
                  }}>
                    <option value="">(Chọn nhà cung cấp)</option>
                    {supplierOptions.map((s) => <option key={s.id} value={s.id}>{s.supplier_name} ({s.supplier_code})</option>)}
                  </select>
                ) : (
                  <input className="input" value={newResourceItem.labor_type} onChange={(e) => setNewResourceItem((x) => ({ ...x, labor_type: e.target.value }))} placeholder="Không bắt buộc" />
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                <button className="btn-primary" onClick={submitResourceItem}>{editingResourceItemId ? 'Lưu sửa' : '+ Item'}</button>
                {editingResourceItemId ? <button className="btn-ghost" onClick={resetResourceItemForm}>Hủy sửa</button> : null}
              </div>
            </div>

                <input className="input" placeholder="Ghi chú item" value={newResourceItem.note} onChange={(e) => setNewResourceItem((x) => ({ ...x, note: e.target.value }))} style={{ marginBottom: 8 }} />
              </>
            ) : (
              <div style={{ border: '1px dashed var(--border2)', borderRadius: 8, padding: 12, marginBottom: 8, fontSize: 12, color: 'var(--text3)' }}>
                Khối nhập item đang được ẩn. Bấm <b>Hiện khối nhập item</b> để thêm hoặc sửa vật tư, nhân công trong kế hoạch.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className={resourceItemTab === 'all' ? 'btn-primary' : 'btn-ghost'} type="button" onClick={() => setResourceItemTab('all')}>Tất cả item</button>
                <button className={resourceItemTab === 'material' ? 'btn-primary' : 'btn-ghost'} type="button" onClick={() => setResourceItemTab('material')}>Danh sách vật tư</button>
                <button className={resourceItemTab === 'labor' ? 'btn-primary' : 'btn-ghost'} type="button" onClick={() => setResourceItemTab('labor')}>Danh sách nhân công</button>
              </div>
              <button className="btn-ghost" type="button" onClick={() => setShowResourceItemList((v) => !v)}>
                {showResourceItemList ? 'Ẩn danh sách item' : 'Hiện danh sách item'}
              </button>
            </div>

            {showResourceItemList ? (
              <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {filteredResourcePlanItems.map((it: any) => (
                <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '8px 10px', fontSize: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{it.item_name} ({it.resource_kind === 'material' ? 'Vật tư' : 'Nhân công'})</div>
                    <div style={{ color: 'var(--text3)' }}>
                      {it.category || '-'} | {it.quantity ?? '-'} {it.unit || ''} | {fmtMoney(it.estimated_cost)}
                      {' '}| Thực nhận: {Number(it.actual_received_qty || 0)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => {
                      setEditingResourceItemId(it.id)
                      setNewResourceItem({
                        resource_kind: String(it.resource_kind || 'material'),
                        category: String(it.category || ''),
                        item_key: String(it.item_key || ''),
                        item_name: String(it.item_name || ''),
                        unit: String(it.unit || ''),
                        quantity: it.quantity != null ? String(it.quantity) : '',
                        unit_cost: it.unit_cost != null ? String(it.unit_cost) : '',
                        estimated_cost: it.estimated_cost != null ? String(it.estimated_cost) : '',
                        labor_type: String(it.labor_type || ''),
                        labor_trade_id: String(it.labor_trade_id || ''),
                        supplier_id: '',
                        supplier_name: String(it.supplier_name || ''),
                        note: String(it.note || ''),
                      })
                      setSelectedMaterialKey(String(it.resource_kind === 'material' ? it.item_key || MATERIAL_OTHER_VALUE : ''))
                    }}>Sửa</button>
                    <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => removeResourceItem(it.id)}>Xóa</button>
                  </div>
                </div>
              ))}
              {!filteredResourcePlanItems.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Không có item phù hợp với tab đang chọn.</div> : null}
              {!selectedResourcePlanItems.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Chưa có item trong kế hoạch này.</div> : null}
            </div>
            ) : (
              <div style={{ border: '1px dashed var(--border2)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text3)' }}>
                Danh sách item đang được ẩn. Bấm <b>Hiện danh sách item</b> để xem vật tư và nhân công đã nhập.
              </div>
            )}
          </>
        ) : (
          <div style={{ border: '1px dashed var(--border2)', borderRadius: 8, padding: 14, color: 'var(--text3)', fontSize: 12 }}>
            Form tạo/sửa đang được ẩn. Bấm <b>Hiện form tạo/sửa</b> để mở lại khi cần cập nhật kế hoạch.
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700 }}>Kế hoạch vật tư / nhân công theo thời gian</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Mỗi kế hoạch hiển thị tổng hợp vật tư theo toàn bộ nguồn lực dự án, không đi theo từng item.</div>
          </div>
        </div>
        {!sortedResourcePlans.length ? (
          <div style={{ padding: 12, fontSize: 12, color: 'var(--text3)' }}>Chưa có kế hoạch nào.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {sortedResourcePlans.map((plan: any) => {
              const summary = planSummaryById[plan.id] || {
                enough_count: 0,
                shortage_count: 0,
                excess_count: 0,
                total_planned_qty: 0,
                total_received_qty: 0,
                total_shortage_qty: 0,
                total_excess_qty: 0,
                materials: [],
              }
              return (
                <div key={plan.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: selectedResourcePlan?.id === plan.id ? 'rgba(59,130,246,.04)' : 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{plan.plan_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                        {plan.plan_stage || '-'} | {plan.status || '-'}{plan?.milestone?.milestone_name ? ` | ${plan.milestone.milestone_name}` : ''}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                        {plan?.planned_start_date ? new Date(String(plan.planned_start_date)).toLocaleDateString('vi-VN') : '-'} → {plan?.planned_end_date ? new Date(String(plan.planned_end_date)).toLocaleDateString('vi-VN') : '-'}
                      </div>
                    </div>
                    <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setSelectedResourcePlanId(String(plan.id || ''))}>
                      Chọn kế hoạch
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                    <span>Đủ: <b style={{ color: 'var(--text)' }}>{summary.enough_count}</b></span>
                    <span>Thiếu: <b style={{ color: 'var(--yellow)' }}>{summary.shortage_count}</b></span>
                    <span>Thừa: <b style={{ color: 'var(--orange)' }}>{summary.excess_count}</b></span>
                    <span>Tổng cần: <b style={{ color: 'var(--text)' }}>{summary.total_planned_qty}</b></span>
                    <span>Thực nhận: <b style={{ color: 'var(--text)' }}>{summary.total_received_qty}</b></span>
                  </div>

                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,.02)' }}>
                          <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Vật tư</th>
                          <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Mã</th>
                          <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Đơn vị</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Cần</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Thực nhận</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Thiếu</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Thừa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.materials.map((row: any) => (
                          <tr key={row.material_key}>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{row.material_name || '-'}</td>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--blue)' }}>{row.material_key}</td>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{row.unit || '-'}</td>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>{row.planned_qty}</td>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>{row.received_qty}</td>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: row.shortage_qty > 0 ? 'var(--yellow)' : 'var(--text3)' }}>{row.shortage_qty}</td>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: row.excess_qty > 0 ? 'var(--orange)' : 'var(--text3)' }}>{row.excess_qty}</td>
                          </tr>
                        ))}
                        {!summary.materials.length ? (
                          <tr>
                            <td colSpan={7} style={{ padding: 10, color: 'var(--text3)' }}>Chưa có vật tư trong kế hoạch này.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toast ? (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
