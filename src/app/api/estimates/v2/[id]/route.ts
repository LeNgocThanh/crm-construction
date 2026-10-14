import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

function toNum(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function parseTemplateNote(note: unknown) {
  const raw = String(note || '').trim()
  if (!raw.startsWith('template:')) return null
  const body = raw.slice('template:'.length).trim()
  if (!body) return null
  const [codeVerRaw, nameRaw] = body.split('|')
  const codeVer = String(codeVerRaw || '').trim()
  if (!codeVer) return null
  const at = codeVer.indexOf('@v')
  if (at < 0) return null
  const templateCode = codeVer.slice(0, at).trim()
  const versionNum = Number(codeVer.slice(at + 2).trim())
  if (!templateCode || !Number.isFinite(versionNum)) return null
  const templateName = String(nameRaw || '').trim() || null
  return {
    template_key: `${templateCode}@v${versionNum}`,
    template_code: templateCode,
    version: versionNum,
    template_name_from_note: templateName,
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const prismaAny = db as any
  const quote = await prismaAny.estimationQuote.findUnique({
    where: { id: params.id },
    include: { items: true },
  })
  if (!quote) {
    return NextResponse.json({ error: 'Khong tim thay du toan' }, { status: 404 })
  }

  const normalizedItems = (quote.items || []).map((it: any) => ({
    id: it.id,
    material_key: it.material_key,
    material_name: it.material_name,
    unit: it.unit,
    quantity: it.quantity,
    unit_price: it.unit_price != null ? Number(it.unit_price) : null,
    ratio_percent: it.ratio_percent,
    cost: toNum(it.cost),
    price_source: it.price_source,
    note: it.note,
  }))

  const groupMap = new Map<string, any>()
  for (const it of normalizedItems) {
    const parsed = parseTemplateNote(it.note)
    if (!parsed) continue
    if (!groupMap.has(parsed.template_key)) {
      groupMap.set(parsed.template_key, {
        template_key: parsed.template_key,
        template_code: parsed.template_code,
        version: parsed.version,
        template_name: parsed.template_name_from_note,
        template_type: null as string | null,
        items: [],
        subtotal_cost: 0,
      })
    }
    const g = groupMap.get(parsed.template_key)
    g.items.push(it)
    g.subtotal_cost += toNum(it.cost)
  }

  const groups = Array.from(groupMap.values())
  const templates = await prismaAny.estimationTemplateHeader.findMany({
    where: {
      OR: groups.map((x) => ({
        template_code: x.template_code,
        version: x.version,
      })),
    },
    select: {
      id: true,
      template_code: true,
      version: true,
      template_name: true,
      template_type: true,
      house_type: true,
      style: true,
      finish_level: true,
      room_type: true,
      is_active: true,
    },
  })
  const tmplMap = new Map<string, any>()
  for (const t of templates) {
    tmplMap.set(`${t.template_code}@v${t.version}`, t)
  }

  const groupData = groups
    .map((g) => {
      const t = tmplMap.get(g.template_key)
      return {
        ...g,
        template_name: t?.template_name || g.template_name || g.template_code,
        template_type: t?.template_type || null,
        template_id: t?.id || null,
        house_type: t?.house_type || null,
        style: t?.style || null,
        finish_level: t?.finish_level || null,
        room_type: t?.room_type || null,
      }
    })
    .sort((a, b) => b.subtotal_cost - a.subtotal_cost)

  const data = {
    id: quote.id,
    customer_id: quote.customer_id,
    region_code: quote.region_code,
    quote_date: quote.quote_date,
    floor_area_total: quote.floor_area_total,
    floors: quote.floors,
    tum_count: quote.tum_count,
    basement_count: quote.basement_count,
    finish_level: quote.finish_level,
    subtotal_cost: quote.subtotal_cost != null ? Number(quote.subtotal_cost) : null,
    total_cost: quote.total_cost != null ? Number(quote.total_cost) : null,
    pricing_mode: quote.pricing_mode,
    status: quote.status,
    input_snapshot: quote.input_snapshot || {},
    result_snapshot: quote.result_snapshot || {},
    items: normalizedItems,
    template_groups: groupData,
  }

  return NextResponse.json({ data })
}

