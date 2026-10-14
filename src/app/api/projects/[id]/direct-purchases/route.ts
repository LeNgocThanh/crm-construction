import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { createProjectTimelineEvent } from '@/lib/project-timeline'

function toNum(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function genCode() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `PDP-${y}${m}${day}-${hh}${mm}${ss}`
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const projectId = String(params.id || '').trim()
  if (!projectId) return NextResponse.json({ error: 'project_id_required' }, { status: 400 })

  const rows = await (db as any).projectDirectPurchase.findMany({
    where: { project_id: projectId },
    orderBy: [{ purchase_date: 'desc' }, { created_at: 'desc' }],
    include: {
      supplier: { select: { id: true, supplier_name: true, supplier_code: true } },
      plan: { select: { id: true, plan_name: true, status: true } },
      creator: { select: { id: true, username: true } },
      confirmer: { select: { id: true, username: true } },
      items: { orderBy: [{ created_at: 'asc' }] },
    },
  })
  const data = rows.map((x: any) => ({
    ...x,
    items: (x.items || []).map((it: any) => ({
      ...it,
      unit_price: it.unit_price != null ? Number(it.unit_price) : null,
      line_total: it.line_total != null ? Number(it.line_total) : null,
    })),
  }))
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const projectId = String(params.id || '').trim()
  if (!projectId) return NextResponse.json({ error: 'project_id_required' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const items = Array.isArray(body?.items) ? body.items : []
  if (!items.length) return NextResponse.json({ error: 'Thieu item mua truc tiep' }, { status: 400 })

  const project = await db.constructionProject.findUnique({
    where: { id: projectId },
    select: { id: true, customer_id: true, project_name: true, active_material_plan_id: true },
  })
  if (!project) return NextResponse.json({ error: 'Khong tim thay du an' }, { status: 404 })

  const activeMaterialPlanId = String((project as any)?.active_material_plan_id || '').trim()
  const requestedPlanId = body?.plan_id != null ? String(body.plan_id || '').trim() : ''
  const planIdRaw = activeMaterialPlanId || requestedPlanId
  if (activeMaterialPlanId && requestedPlanId && requestedPlanId !== activeMaterialPlanId) {
    return NextResponse.json({
      error: 'Du an da chot ke hoach vat tu dang van hanh. Phieu mua truc tiep phai gan vao ke hoach dang van hanh nay.',
    }, { status: 409 })
  }
  if (planIdRaw) {
    const plan = await db.projectResourcePlan.findFirst({
      where: { id: planIdRaw, project_id: projectId, is_active: true },
      select: { id: true, status: true },
    })
    if (!plan) return NextResponse.json({ error: 'Ke hoach khong hop le cho du an nay' }, { status: 400 })
    if (!['approved', 'locked'].includes(String(plan.status || ''))) {
      return NextResponse.json({ error: 'Chi duoc gan mua truc tiep vao ke hoach vat tu da duyet/da khoa' }, { status: 400 })
    }
  }

  const code = String(body?.purchase_code || '').trim() || genCode()
  const created = await db.$transaction(async (tx) => {
    const row = await (tx as any).projectDirectPurchase.create({
      data: {
        project_id: projectId,
        plan_id: planIdRaw || null,
        purchase_code: code,
        purchase_date: body?.purchase_date ? new Date(body.purchase_date) : new Date(),
        supplier_id: body?.supplier_id ? String(body.supplier_id) : null,
        supplier_name: body?.supplier_name ? String(body.supplier_name) : null,
        status: 'draft',
        note: body?.note ? String(body.note) : null,
        created_by: String(session.user.id || '') || null,
      },
    })
    for (const it of items) {
      const materialKey = String(it?.material_key || '').trim()
      const qty = toNum(it?.quantity)
      const unitPriceNum = toNum(it?.unit_price)
      if (!materialKey || qty == null || qty <= 0) continue
      const lineTotalNum = toNum(it?.line_total) ?? ((unitPriceNum || 0) * qty)
      await (tx as any).projectDirectPurchaseItem.create({
        data: {
          purchase_id: row.id,
          project_id: projectId,
          catalog_item_id: it?.catalog_item_id ? String(it.catalog_item_id) : null,
          material_key: materialKey,
          material_name: it?.material_name ? String(it.material_name) : null,
          item_unit: it?.item_unit ? String(it.item_unit) : null,
          quantity: qty,
          unit_price: unitPriceNum != null ? BigInt(Math.round(unitPriceNum)) : null,
          line_total: lineTotalNum != null ? BigInt(Math.round(lineTotalNum)) : null,
          note: it?.note ? String(it.note) : null,
        },
      })
    }
    return (tx as any).projectDirectPurchase.findUnique({
      where: { id: row.id },
      include: {
        items: true,
        supplier: { select: { id: true, supplier_name: true, supplier_code: true } },
        plan: { select: { id: true, plan_name: true, status: true } },
      },
    })
  })

  await createProjectTimelineEvent({
    project_id: projectId,
    customer_id: project.customer_id || null,
    event_key: 'project_direct_purchase_created',
    title: 'Tao phieu mua truc tiep',
    description: `${created?.purchase_code || code}${planIdRaw ? ` | Ke hoach: ${created?.plan?.plan_name || planIdRaw}` : ''}`,
    source_ref_type: 'project_direct_purchase',
    source_ref_id: created?.id || null,
    actor_user_id: String(session.user.id || '') || null,
    metadata_json: {
      plan_id: planIdRaw || null,
      active_material_plan_id: activeMaterialPlanId || null,
      forced_active_plan: !!activeMaterialPlanId,
    },
  })

  return NextResponse.json({
    data: {
      ...created,
      items: (created?.items || []).map((it: any) => ({
        ...it,
        unit_price: it.unit_price != null ? Number(it.unit_price) : null,
        line_total: it.line_total != null ? Number(it.line_total) : null,
      })),
    },
  }, { status: 201 })
}
