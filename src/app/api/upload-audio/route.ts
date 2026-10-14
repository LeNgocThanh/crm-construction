// src/app/api/upload-audio/route.ts — V2.0 Prisma + local storage
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { transcribeAudio, extractFromText } from '@/lib/ai'
import { uploadFile } from '@/lib/storage'
import { createCareActivitySafe } from '@/lib/customer-care'
import { createRequirementSnapshotSafe } from '@/lib/project-requirement-snapshots'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData    = await req.formData()
  const file        = formData.get('audio') as File | null
  const customerId  = formData.get('customer_id') as string | null
  const contactDate = formData.get('contact_date') as string | null

  if (!file || !customerId)
    return NextResponse.json({ error: 'Thiếu file audio hoặc customer_id' }, { status: 400 })

  // 1. Upload file to local storage
  const buffer = Buffer.from(await file.arrayBuffer())
  const { path: filePath, url: fileUrl } = await uploadFile(buffer, file.name, 'audio')

  // 2. Transcribe via Groq Whisper
  let transcription: string
  try {
    transcription = await transcribeAudio(buffer, file.name)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 422 })
  }

  // 3. Extract info via AI (Ollama/Gemini)
  let aiResult
  try {
    aiResult = await extractFromText(transcription)
  } catch {
    aiResult = {
      full_name: null, address: null, house_type: null,
      floors: null, floor_area: null, estimated_budget: null,
      ai_summary:   transcription.substring(0, 200),
      ai_sentiment: 'Trung lập' as const,
      next_action:  'Nghe lại và ghi chú thủ công',
      lead_score:   5,
    }
  }

  // 4. Save contact log + extracted fields
  const log = await db.contactLog.create({
    data: {
      customer_id:       customerId,
      sales_id:          session.user.id,
      contact_date:      contactDate ? new Date(contactDate) : new Date(),
      audio_file_path:   fileUrl,
      transcription_raw: transcription,
      ai_summary:        aiResult.ai_summary,
      ai_sentiment:      aiResult.ai_sentiment,
      next_action:       aiResult.next_action,
      // Lưu bóc tách per-log để sau merge
      ext_full_name:     aiResult.full_name     || null,
      ext_address:       aiResult.address       || null,
      ext_house_type:    aiResult.house_type    || null,
      ext_floors:        aiResult.floors        || null,
      ext_floor_area:    aiResult.floor_area    || null,
      ext_budget:        aiResult.estimated_budget ? BigInt(aiResult.estimated_budget) : null,
    },
  })

  await createRequirementSnapshotSafe({
    customer_id: customerId,
    source_type: 'audio',
    source_ref_id: log.id,
    extracted_json: aiResult || null,
    normalized_json: {
      address: aiResult.address || null,
      house_type: aiResult.house_type || null,
      floors: aiResult.floors ?? null,
      floor_area: aiResult.floor_area ?? null,
      estimated_budget: aiResult.estimated_budget ?? null,
      potential_score: aiResult.lead_score ?? null,
      next_action: aiResult.next_action || null,
      audio_file_path: fileUrl,
    },
    note: 'Auto snapshot from audio transcription extraction',
    created_by: session.user.id,
  })

  await createCareActivitySafe({
    customer_id: customerId,
    activity_type: 'call',
    summary: 'Upload audio va tao contact log',
    detail: aiResult.ai_summary || transcription.substring(0, 500),
    next_action_snapshot: aiResult.next_action || null,
    source_ref_type: 'contact_log',
    source_ref_id: log.id,
    channel: 'call',
    created_by: session.user.id,
    metadata_json: {
      ai_sentiment: aiResult.ai_sentiment || null,
      audio_file_path: fileUrl,
    },
  })

  // 5. Update customer
  const customerUpdates: any = {}
  if (aiResult.full_name) customerUpdates.full_name = aiResult.full_name
  if (aiResult.lead_score) customerUpdates.potential_score = aiResult.lead_score
  await db.customer.update({
    where: { id: customerId },
    data: { ...customerUpdates, total_contacts: { increment: 1 } },
  })

  // 6. Create project if AI extracted address/house info
  if (aiResult.address || aiResult.house_type) {
    await db.constructionProject.create({
      data: {
        customer_id:      customerId,
        address:          aiResult.address          || null,
        house_type:       aiResult.house_type       || null,
        floors:           aiResult.floors           || null,
        floor_area:       aiResult.floor_area       || null,
        estimated_budget: aiResult.estimated_budget ? BigInt(aiResult.estimated_budget) : null,
      },
    })
  }

  return NextResponse.json({
    data: {
      log,
      transcription,
      aiResult,
      filePath,
    },
  })
}
