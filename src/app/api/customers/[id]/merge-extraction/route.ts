// src/app/api/customers/[id]/merge-extraction/route.ts
// Dung AI de merge tat ca boc tach tu cac cuoc goi thanh 1 profile tong hop

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const MODEL = process.env.OLLAMA_MODEL || 'gemma3:4b'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.customersRead)
  if (auth.error) return auth.error

  const logs = await db.contactLog.findMany({
    where: { customer_id: params.id },
    orderBy: { contact_date: 'asc' },
    select: {
      id: true,
      contact_date: true,
      ai_summary: true,
      ai_sentiment: true,
      next_action: true,
      ext_full_name: true,
      ext_address: true,
      ext_house_type: true,
      ext_floors: true,
      ext_floor_area: true,
      ext_budget: true,
      ext_notes: true,
    },
  })

  if (logs.length === 0) {
    return NextResponse.json({ error: 'Khong co log nao' }, { status: 400 })
  }

  if (logs.length === 1) {
    const log = logs[0]
    return NextResponse.json({
      data: {
        full_name: log.ext_full_name,
        address: log.ext_address,
        house_type: log.ext_house_type,
        floors: log.ext_floors,
        floor_area: log.ext_floor_area,
        budget: log.ext_budget ? Number(log.ext_budget) : null,
        summary: log.ai_summary,
        next_action: log.next_action,
        from_logs: 1,
        merged_by: 'single',
      },
    })
  }

  const logContext = logs
    .map((log, i) => {
      const date = new Date(log.contact_date).toLocaleDateString('vi-VN')
      const fields = [
        log.ext_full_name ? `Ten: ${log.ext_full_name}` : null,
        log.ext_address ? `Dia chi: ${log.ext_address}` : null,
        log.ext_house_type ? `Loai nha: ${log.ext_house_type}` : null,
        log.ext_floors ? `So tang: ${log.ext_floors}` : null,
        log.ext_floor_area ? `Dien tich: ${log.ext_floor_area}m2` : null,
        log.ext_budget ? `Ngan sach: ${Number(log.ext_budget).toLocaleString('vi-VN')}d` : null,
        log.ai_summary ? `Tom tat: ${log.ai_summary}` : null,
      ]
        .filter(Boolean)
        .join('\n    ')
      return `[Cuoc goi ${i + 1} - ${date}]\n    ${fields || '(Khong co du lieu boc tach)'}`
    })
    .join('\n\n')

  const prompt = `Ban la AI tong hop thong tin khach hang xay dung Viet Nam.
Duoi day la du lieu boc tach tu ${logs.length} cuoc goi voi khach hang, sap xep tu cu den moi.

QUY TAC MERGE:
1. Thong tin cuoc goi SAU se de len thong tin cuoc goi TRUOC neu no ro rang va cu the hon
2. Neu thong tin moi khong ro rang (null, trong, hoac mo ho) thi giu thong tin cu hon
3. Dia chi cu the hon duoc uu tien
4. Truong moi hon khong de cap thi khong xoa truong cu
5. Ngan sach lay con so cu the nhat, moi nhat
6. Tom tat la hanh trinh tu van, khong lap lai

DU LIEU CAC CUOC GOI:
${logContext}

Tra ve JSON thuan:
{
  "full_name": "ten ro rang nhat hoac null",
  "address": "dia chi cu the nhat hoac null",
  "house_type": "Nha pho|Biet thu|Nha cap 4|Chung cu|Khac|null",
  "floors": so_tang_hoac_null,
  "floor_area": dien_tich_m2_hoac_null,
  "budget": so_tien_VND_hoac_null,
  "summary": "tom tat hanh trinh tu van 2-4 cau",
  "next_action": "hanh dong sales can lam tiep theo dua tren lich su",
  "confidence": "high|medium|low",
  "merge_notes": "giai thich ngan gon quyet dinh merge quan trong"
}

JSON:`

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 600 },
      }),
      signal: AbortSignal.timeout(60000),
    })
    const data = await res.json()
    const rawText = (data.response || '').trim()
    const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()

    let result: any
    try {
      result = JSON.parse(cleaned)
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (m) result = JSON.parse(m[0])
      else throw new Error('AI khong tra ve JSON hop le')
    }

    return NextResponse.json({
      data: {
        ...result,
        from_logs: logs.length,
        merged_by: 'ai',
        merged_at: new Date().toISOString(),
      },
    })
  } catch (err: any) {
    const merged: any = {
      full_name: null,
      address: null,
      house_type: null,
      floors: null,
      floor_area: null,
      budget: null,
    }
    for (const log of logs) {
      if (log.ext_full_name) merged.full_name = log.ext_full_name
      if (log.ext_address) merged.address = log.ext_address
      if (log.ext_house_type) merged.house_type = log.ext_house_type
      if (log.ext_floors) merged.floors = log.ext_floors
      if (log.ext_floor_area) merged.floor_area = log.ext_floor_area
      if (log.ext_budget) merged.budget = Number(log.ext_budget)
    }
    const lastLog = logs[logs.length - 1]
    merged.summary = lastLog.ai_summary
    merged.next_action = lastLog.next_action
    merged.confidence = 'low'
    merged.merge_notes = `Fallback merge (AI error: ${err.message})`
    merged.from_logs = logs.length
    merged.merged_by = 'fallback'

    return NextResponse.json({ data: merged })
  }
}
