import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

function toNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function serTxn(txn: any) {
  return {
    ...txn,
    items: Array.isArray(txn.items)
      ? txn.items.map((it: any) => ({
        ...it,
        unit_price: it.unit_price != null ? Number(it.unit_price) : null,
        line_total: it.line_total != null ? Number(it.line_total) : null,
      }))
      : [],
  }
}

function describeTxnType(txnType: string) {
  switch (String(txnType || '')) {
    case 'in': return 'Phiếu nhập kho'
    case 'out': return 'Phiếu xuất kho'
    case 'adjust': return 'Phiếu điều chỉnh tồn'
    case 'transfer_in': return 'Phiếu nhập chuyển kho'
    case 'transfer_out': return 'Phiếu xuất chuyển kho'
    default: return String(txnType || '-')
  }
}

function describeTxnStatus(status: string) {
  switch (String(status || '')) {
    case 'draft': return 'Nháp'
    case 'accepted': return 'Đã chấp nhận'
    case 'adjust_requested': return 'Yêu cầu điều chỉnh'
    case 'rejected': return 'Từ chối'
    case 'posted': return 'Đã ghi sổ'
    case 'cancelled': return 'Đã hủy'
    default: return String(status || '-')
  }
}

function describeIssuePurpose(purpose: string | null | undefined) {
  switch (String(purpose || '')) {
    case 'project_supply': return 'Cấp cho dự án'
    case 'crew_supply': return 'Cấp cho đội thi công'
    case 'maintenance_supply': return 'Cấp cho bảo trì'
    case 'loss_damage': return 'Hao hụt / hư hỏng'
    case 'internal_use': return 'Dùng nội bộ'
    case 'other': return 'Mục đích khác'
    default: return null
  }
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.inventoryRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const warehouseId = String(sp.get('warehouse_id') || '').trim()
  const status = String(sp.get('status') || '').trim()
  const txnType = String(sp.get('txn_type') || '').trim()
  const issuePurpose = String(sp.get('issue_purpose') || '').trim()
  const sourceGroup = String(sp.get('source_group') || '').trim()
  const materialKey = String(sp.get('material_key') || '').trim()
  const dateFrom = String(sp.get('date_from') || '').trim()
  const dateTo = String(sp.get('date_to') || '').trim()
  const q = String(sp.get('q') || '').trim()
  const pageSize = Math.min(200, Math.max(1, Number(sp.get('page_size') || sp.get('limit') || 50)))
  const page = Math.max(1, Number(sp.get('page') || 1))
  const skip = (page - 1) * pageSize

  const where: any = {}
  if (warehouseId) where.warehouse_id = warehouseId
  if (status) where.status = status
  if (txnType) where.txn_type = txnType
  if (issuePurpose) where.issue_purpose = issuePurpose
  if (sourceGroup === 'project') {
    where.reference_type = { in: ['project_resource_plan', 'project_resource_plan_return'] }
  } else if (sourceGroup === 'purchase') {
    where.reference_type = 'purchase_order'
  } else if (sourceGroup === 'stock_audit') {
    where.reference_type = 'stock_audit'
  } else if (sourceGroup === 'manual') {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
      { reference_type: null },
      { reference_type: '' },
      { reference_type: 'manual' },
        ],
      },
    ]
  }
  if (dateFrom || dateTo) {
    where.txn_date = {}
    if (dateFrom) where.txn_date.gte = new Date(dateFrom)
    if (dateTo) where.txn_date.lte = new Date(dateTo)
  }
  if (materialKey) {
    where.items = {
      some: {
        material_key: materialKey,
      },
    }
  }
  if (q) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { txn_code: { contains: q, mode: 'insensitive' } },
          { note: { contains: q, mode: 'insensitive' } },
          { reference_id: { contains: q, mode: 'insensitive' } },
          { items: { some: { material_key: { contains: q, mode: 'insensitive' } } } },
          { items: { some: { material_name: { contains: q, mode: 'insensitive' } } } },
        ],
      },
    ]
  }

  const [total, rows] = await Promise.all([
    db.inventoryTransaction.count({ where }),
    db.inventoryTransaction.findMany({
    where,
    include: {
      warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
      supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
      items: true,
    },
    orderBy: [{ txn_date: 'desc' }, { created_at: 'desc' }],
    skip,
    take: pageSize,
  }),
  ])

  const planIds = Array.from(new Set(rows
    .filter((row) => row.reference_type === 'project_resource_plan' || row.reference_type === 'project_resource_plan_return')
    .map((row) => String(row.reference_id || '').trim())
    .filter(Boolean)))
  const purchaseOrderIds = Array.from(new Set(rows
    .filter((row) => row.reference_type === 'purchase_order')
    .map((row) => String(row.reference_id || '').trim())
    .filter(Boolean)))
  const stockAuditIds = Array.from(new Set(rows
    .filter((row) => row.reference_type === 'stock_audit')
    .map((row) => String(row.reference_id || '').trim())
    .filter(Boolean)))

  const [plans, purchaseOrders, stockAudits] = await Promise.all([
    planIds.length
      ? db.projectResourcePlan.findMany({
          where: { id: { in: planIds } },
          select: {
            id: true,
            plan_name: true,
            project: { select: { id: true, project_name: true } },
          },
        })
      : Promise.resolve([]),
    purchaseOrderIds.length
      ? (db as any).inventoryPurchaseOrder.findMany({
          where: { id: { in: purchaseOrderIds } },
          select: { id: true, order_code: true },
        })
      : Promise.resolve([]),
    stockAuditIds.length
      ? (db as any).inventoryStockAudit.findMany({
          where: { id: { in: stockAuditIds } },
          select: { id: true, audit_code: true },
        })
      : Promise.resolve([]),
  ])

  const planMap = new Map(plans.map((row: any) => [row.id, row]))
  const purchaseOrderMap = new Map(purchaseOrders.map((row: any) => [row.id, row]))
  const stockAuditMap = new Map(stockAudits.map((row: any) => [row.id, row]))

  return NextResponse.json({
    data: rows.map((row) => {
      const base = serTxn(row)
      const plan: any = row.reference_id ? planMap.get(String(row.reference_id)) : null
      const purchaseOrder: any = row.reference_id ? purchaseOrderMap.get(String(row.reference_id)) : null
      const stockAudit: any = row.reference_id ? stockAuditMap.get(String(row.reference_id)) : null

      let sourceLabel = 'Tạo tay'
      let movementLabel = `${describeTxnType(row.txn_type)} tại ${row?.warehouse?.warehouse_name || 'kho'}`

      if (row.reference_type === 'project_resource_plan') {
        sourceLabel = `Từ kế hoạch dự án${plan?.plan_name ? `: ${plan.plan_name}` : ''}${plan?.project?.project_name ? ` | ${plan.project.project_name}` : ''}`
        movementLabel = `Xuất từ kho ${row?.warehouse?.warehouse_name || '-'} cho dự án${plan?.project?.project_name ? ` ${plan.project.project_name}` : ''}`
      } else if (row.reference_type === 'project_resource_plan_return') {
        sourceLabel = `Từ nhập lại vật tư dự án${plan?.plan_name ? `: ${plan.plan_name}` : ''}${plan?.project?.project_name ? ` | ${plan.project.project_name}` : ''}`
        movementLabel = `Nhập lại từ dự án${plan?.project?.project_name ? ` ${plan.project.project_name}` : ''} về kho ${row?.warehouse?.warehouse_name || '-'}`
      } else if (row.reference_type === 'purchase_order') {
        sourceLabel = `Từ đơn mua${purchaseOrder?.order_code ? `: ${purchaseOrder.order_code}` : ''}`
        movementLabel = `Nhập từ nhà cung cấp ${row?.supplier?.supplier_name || '-'} vào kho ${row?.warehouse?.warehouse_name || '-'}`
      } else if (row.reference_type === 'stock_audit') {
        sourceLabel = `Từ kiểm kê kho${stockAudit?.audit_code ? `: ${stockAudit.audit_code}` : ''}`
        movementLabel = `Điều chỉnh tồn theo kiểm kê tại kho ${row?.warehouse?.warehouse_name || '-'}`
      } else if (row.txn_type === 'in') {
        movementLabel = `Nhập vào kho ${row?.warehouse?.warehouse_name || '-'}${row?.supplier?.supplier_name ? ` từ ${row.supplier.supplier_name}` : ''}`
      } else if (row.txn_type === 'out') {
        movementLabel = `Xuất từ kho ${row?.warehouse?.warehouse_name || '-'}`
      } else if (row.txn_type === 'adjust') {
        movementLabel = `Điều chỉnh tồn tại kho ${row?.warehouse?.warehouse_name || '-'}`
      } else if (row.txn_type === 'transfer_in') {
        movementLabel = `Nhập chuyển vào kho ${row?.warehouse?.warehouse_name || '-'}`
      } else if (row.txn_type === 'transfer_out') {
        movementLabel = `Xuất chuyển từ kho ${row?.warehouse?.warehouse_name || '-'}`
      }

      const issuePurposeLabel = describeIssuePurpose((row as any).issue_purpose)
      if (issuePurposeLabel && row.txn_type === 'out') {
        movementLabel = `${movementLabel} | ${issuePurposeLabel}`
      }

      return {
        ...base,
        txn_type_label: describeTxnType(row.txn_type),
        status_label: describeTxnStatus(row.status),
        issue_purpose_label: issuePurposeLabel,
        source_label: sourceLabel,
        movement_label: movementLabel,
      }
    }),
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
}

export async function POST(req: NextRequest) {
  const access = await requirePermission(PERMISSIONS.inventoryManage)
  if (access.error) return access.error
  const session: any = access.ctx!.session

  const body = await req.json()
  const warehouseId = String(body?.warehouse_id || '').trim()
  const txnType = String(body?.txn_type || '').trim()
  if (!warehouseId || !txnType) return NextResponse.json({ error: 'Thieu warehouse_id hoac txn_type' }, { status: 400 })
  if (!['in', 'out', 'adjust', 'transfer_in', 'transfer_out'].includes(txnType)) {
    return NextResponse.json({ error: 'txn_type khong hop le' }, { status: 400 })
  }
  const requiresUnitPrice = txnType === 'in' || txnType === 'transfer_in'
  const isAdjust = txnType === 'adjust'
  const rawIssuePurpose = body?.issue_purpose ? String(body.issue_purpose).trim() : ''
  const issuePurpose = txnType === 'out'
    ? (rawIssuePurpose || (String(body?.reference_type || '').trim() === 'project_resource_plan' ? 'project_supply' : ''))
    : null
  if (txnType === 'out' && !issuePurpose) {
    return NextResponse.json({ error: 'Phieu xuat kho can chon muc dich xuat' }, { status: 400 })
  }

  const items = Array.isArray(body?.items) ? body.items : []
  if (!items.length) return NextResponse.json({ error: 'Phieu kho can it nhat 1 dong vat tu' }, { status: 400 })

  const now = Date.now()
  const txnCode = String(body?.txn_code || '').trim() || `TXN-${now}`

  const created = await db.$transaction(async (tx) => {
    const txn = await tx.inventoryTransaction.create({
      data: {
        txn_code: txnCode,
        warehouse_id: warehouseId,
        txn_type: txnType,
        issue_purpose: issuePurpose || null,
        txn_date: body?.txn_date ? new Date(body.txn_date) : new Date(),
        supplier_id: body?.supplier_id ? String(body.supplier_id) : null,
        reference_type: body?.reference_type ? String(body.reference_type) : null,
        reference_id: body?.reference_id ? String(body.reference_id) : null,
        status: 'draft',
        note: body?.note ? String(body.note) : null,
        created_by: String(session.user.id || ''),
      },
    })

    for (const raw of items) {
      const materialKey = String(raw?.material_key || '').trim()
      const qty = toNum(raw?.quantity)
      if (!materialKey || qty == null) {
        throw new Error('Dong vat tu khong hop le (material_key/quantity)')
      }
      if (isAdjust ? qty === 0 : qty <= 0) {
        throw new Error(isAdjust
          ? 'Phieu dieu chinh yeu cau quantity khac 0 (am: giam, duong: tang)'
          : 'Dong vat tu khong hop le (material_key/quantity)')
      }
      const unitPrice = toNum(raw?.unit_price)
      if (requiresUnitPrice && (unitPrice == null || unitPrice <= 0)) {
        throw new Error(`Phieu ${txnType} bat buoc unit_price > 0 cho ${materialKey}`)
      }
      const lineTotal = unitPrice != null ? Math.round(unitPrice * qty) : null
      await tx.inventoryTransactionItem.create({
        data: {
          txn_id: txn.id,
          catalog_item_id: raw?.catalog_item_id ? String(raw.catalog_item_id) : null,
          material_key: materialKey,
          material_name: raw?.material_name ? String(raw.material_name) : null,
          item_unit: raw?.item_unit ? String(raw.item_unit) : null,
          quantity: qty,
          unit_price: unitPrice != null ? BigInt(Math.round(unitPrice)) : null,
          line_total: lineTotal != null ? BigInt(lineTotal) : null,
          note: raw?.note ? String(raw.note) : null,
        },
      })
    }
    return tx.inventoryTransaction.findUnique({
      where: { id: txn.id },
      include: { warehouse: true, supplier: true, items: true },
    })
  })
  return NextResponse.json({ data: serTxn(created) }, { status: 201 })
}
