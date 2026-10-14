import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateEstimate, validateEstimateInput } from '@/lib/estimate/engine'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const estimateInput = {
    customer_id: body.customer_id || null,
    recipe_id: body.recipe_id || null,
    recipe_key: body.recipe_key || null,
    region_code: body.region_code || 'ALL',
    quote_date: body.quote_date || null,
    floor_area_total: body.floor_area_total,
    floors: body.floors,
    tum_count: body.tum_count,
    basement_count: body.basement_count,
    has_elevator: body.has_elevator,
    finish_level: body.finish_level || 'tieu_chuan',
    base_cost_per_m2: body.base_cost_per_m2,
    created_by: session.user.id,
  }

  const validation = await validateEstimateInput(estimateInput)
  if (!validation.ok) {
    return NextResponse.json(
      {
        error: 'Chua du du lieu de gen khai toan',
        missing_fields: validation.missing_fields,
        details: validation.details,
        required_fields: ['floor_area_total', 'recipe_or_base_cost'],
        suggested_inputs: validation.suggested_inputs,
      },
      { status: 400 }
    )
  }

  try {
    const data = await generateEstimate(estimateInput)
    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    const message = err?.message || 'Khong the gen khai toan'
    const normalized = String(message).toLowerCase()
    if (normalized.includes('du lieu gia') || normalized.includes('dinh muc')) {
      return NextResponse.json(
        {
          error: 'Chua du du lieu gia/dinh muc de tinh',
          missing_fields: ['material_price_or_base_cost', 'recipe_item_ratio_or_qty', 'base_cost_per_m2_for_ratio_items', 'material_price_for_qty_items'],
          suggested_inputs: {
            material_price_or_base_cost: 'Nhap bang gia vat tu theo vung/ngay hoac nhap base_cost_per_m2 neu recipe dung ratio',
            recipe_item_ratio_or_qty: 'Moi vat tu trong recipe can co ratio_percent hoac quantity_per_m2',
            base_cost_per_m2_for_ratio_items: 'Neu item dung % ratio thi can base_cost_per_m2',
            material_price_for_qty_items: 'Neu item dung qty/m2 thi can bang gia vat tu theo region/ngay',
          },
        },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
