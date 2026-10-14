// src/app/api/customers/[id]/contact-logs/route.ts
// Nhập tay ghi chú liên hệ + Ollama AI phân tích

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createCareActivitySafe } from '@/lib/customer-care'
import { createRequirementSnapshotSafe } from '@/lib/project-requirement-snapshots'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const MODEL       = process.env.OLLAMA_MODEL    || 'gemma3:12b'

const toInt = (value: any) => {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : parseInt(String(value).replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

const toFloat = (value: any) => {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).replace(',', '.').replace(/[^\d.-]/g, '')
  const n = typeof value === 'number' ? value : parseFloat(normalized)
  return Number.isFinite(n) ? n : null
}

const toBigIntValue = (value: any) => {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).replace(/[^\d-]/g, '')
  if (!normalized) return null
  try {
    return BigInt(normalized)
  } catch {
    return null
  }
}

const serializeLog = (log: any) => ({
  ...log,
  ext_budget: log.ext_budget ? Number(log.ext_budget) : null,
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.customersWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const { notes, source = 'call' } = await req.json()
  if (!notes?.trim()) return NextResponse.json({ error: 'Thiếu nội dung' }, { status: 400 })

  const customer = await db.customer.findUnique({ where: { id: params.id } })
  if (!customer) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })

  // ── AI phân tích nội dung nhập tay ────────────────────────────────
  let aiResult: any = {}
  try {
    aiResult = await analyzeContactNote(notes.trim())
  } catch (err) {
    console.error('[CONTACT LOG] Ollama failed:', err)
    // Vẫn lưu được dù AI lỗi
  }

   const extractedFloors = toInt(aiResult.floors)
  const extractedFloorArea = toFloat(aiResult.floor_area)
  const extractedBudget = toBigIntValue(aiResult.budget)
  const extractedPotentialScore = toInt(aiResult.potential_score)

  // ── Lưu ContactLog vào DB ─────────────────────────────────────────
  const log = await db.contactLog.create({
    data: {
      customer_id:      params.id,
      sales_id:         session.user.id,
      source,
      notes:            notes.trim(),
      contact_date:     new Date(),
      ai_summary:       aiResult.ai_summary       || null,
      ai_sentiment:     aiResult.ai_sentiment      || null,
      next_action:      aiResult.next_action       || null,
      ext_full_name:    aiResult.full_name         || null,
      ext_address:      aiResult.address           || null,
      ext_house_type:   aiResult.house_type        || null,
      ext_floors:       extractedFloors,
      ext_floor_area:   extractedFloorArea,
      ext_budget:       extractedBudget,
      potential_score:  extractedPotentialScore,
      potential_level:  aiResult.potential_level   || null,
    },
  })

  await createRequirementSnapshotSafe({
    customer_id: params.id,
    source_type: 'contact_log',
    source_ref_id: log.id,
    extracted_json: aiResult || null,
    normalized_json: {
      address: aiResult.address || null,
      house_type: aiResult.house_type || null,
      floors: extractedFloors,
      floor_area: extractedFloorArea,
      estimated_budget: extractedBudget ? String(extractedBudget) : null,
      potential_score: extractedPotentialScore,
      potential_level: aiResult.potential_level || null,
      next_action: aiResult.next_action || null,
      source_channel: source || 'call',
    },
    note: 'Auto snapshot from customer contact note',
    created_by: session.user.id,
  })

  // ── Update Customer nếu có thông tin mới ──────────────────────────
  const updateData: any = { total_contacts: { increment: 1 } }
  if (!customer.full_name    && aiResult.full_name)    updateData.full_name    = aiResult.full_name
  if (!customer.house_type   && aiResult.house_type)   updateData.house_type   = aiResult.house_type
  if (!customer.floors       && extractedFloors)       updateData.floors       = extractedFloors
  if (!customer.floor_area   && extractedFloorArea)    updateData.floor_area   = extractedFloorArea
  if (!customer.budget_min   && extractedBudget)       updateData.budget_min   = extractedBudget
  if (!customer.potential_score && extractedPotentialScore) {
    updateData.potential_score = extractedPotentialScore
    updateData.potential_level = aiResult.potential_level
  }
  if (aiResult.next_action) updateData.next_action = aiResult.next_action

  await db.customer.update({ where: { id: params.id }, data: updateData })

  try {
    const timelineType = source && source !== 'call' ? 'chat_started' : 'call'
    const timelineTitle = source && source !== 'call'
      ? `Lien he ${source}`
      : 'Nhat ky lien he'

    await db.customerTimeline.create({
      data: {
        customer_id: params.id,
        type: timelineType,
        title: timelineTitle,
        description: aiResult.ai_summary || notes.trim().slice(0, 500),
        happened_at: log.contact_date || new Date(),
        created_by: session.user.id,
        metadata: {
          contact_log_id: log.id,
          source: source || 'call',
          ai_sentiment: aiResult.ai_sentiment || null,
          next_action: aiResult.next_action || null,
        },
      },
    })
  } catch (err) {
    console.error('[CONTACT LOG] create timeline failed:', err)
  }

  if (aiResult.next_action) {
    await createCareActivitySafe({
      customer_id: params.id,
      activity_type: 'next_action_update',
      summary: 'AI de xuat next_action tu ghi chu lien he',
      detail: aiResult.ai_summary || notes.trim().slice(0, 500),
      next_action_snapshot: aiResult.next_action,
      source_ref_type: 'contact_log',
      source_ref_id: log.id,
      channel: source || 'call',
      created_by: session.user.id,
      metadata_json: {
        ai_sentiment: aiResult.ai_sentiment || null,
        potential_score: extractedPotentialScore,
      },
    })
  }

  return NextResponse.json({
    data: serializeLog(log),
    ai_result: aiResult,
  }, { status: 201 })
}

// ── Ollama phân tích ghi chú liên hệ ──────────────────────────────
async function analyzeContactNote(text: string): Promise<any> {
  const prompt = `Bạn là AI phân tích CRM cho công ty xây dựng. Đọc ghi chú cuộc gọi/liên hệ sau và trả về JSON thuần (không markdown, không text thêm).

GHI CHÚ:
${text}

Trả về JSON:
{
  "ai_summary": "tóm tắt ngắn 1-2 câu về nội dung cuộc liên hệ",
  "ai_sentiment": "Tích cực|Trung lập|Gay gắt",
  "next_action": "gợi ý bước tiếp theo cho sales",
  "full_name": "tên khách nếu được nhắc đến, null nếu không",
  "address": "địa chỉ/khu vực nếu có, null nếu không",
  "house_type": "Nhà phố|Biệt thự|Nhà cấp 4|Chung cư|Khác hoặc null",
  "floors": số_tầng_hoặc_null,
  "floor_area": diện_tích_m2_hoặc_null,
  "budget": ngân_sách_VND_hoặc_null,
  "potential_score": điểm_1_đến_10,
  "potential_level": "cao|trung|thấp"
}`

  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, prompt, stream: false,
      options: { temperature: 0.1, num_predict: 400 },
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) throw new Error(`Ollama ${res.status}`)
  const data  = await res.json()
  let raw = (data.response || '').trim()
      raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')

  return JSON.parse(raw)
}
