import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runExtractionProfiles } from '@/lib/analysis/extractor'
import { type AnalysisProfileKey, detectEstimateIntent } from '@/lib/analysis/profiles'
import { requireConversationAccess } from '@/lib/access-control'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireConversationAccess('write', params.id)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const conv = await db.conversation.findUnique({
    where: { id: params.id },
    include: {
      messages: { orderBy: { created_at: 'desc' }, take: 260 },
      analysis: true,
    },
  })
  if (!conv) return NextResponse.json({ error: 'Khong tim thay' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const fromMessageId = typeof body?.from_message_id === 'string' ? body.from_message_id.trim() : ''

  const ascMessages = [...conv.messages].reverse()
  let scopedMessages = ascMessages
  if (fromMessageId) {
    const startIdx = ascMessages.findIndex((m) => m.id === fromMessageId)
    if (startIdx === -1) {
      return NextResponse.json(
        {
          error: 'from_message_id khong nam trong cua so 260 tin nhan moi nhat',
          code: 'from_message_not_in_recent_window',
        },
        { status: 400 }
      )
    }
    scopedMessages = ascMessages.slice(startIdx)
  }

  const transcript = scopedMessages
    .filter((m) => m.content && m.content.trim())
    .map((m) => {
      const who = m.sender_type === 'customer' ? 'Khach' : m.sender_type === 'bot' ? 'Bot' : 'Sales'
      return `${who}: ${m.content}`
    })
    .join('\n')

  if (!transcript.trim()) {
    return NextResponse.json({ error: 'Chua co noi dung de phan tich' }, { status: 400 })
  }

  const requestedMode = typeof body?.analysis_mode === 'string' ? body.analysis_mode : null
  const autoDetect = body?.auto_detect !== false

  const profileKey: AnalysisProfileKey =
    requestedMode === 'crm_basic' || requestedMode === 'estimate_v1' || requestedMode === 'estimate_preliminary'
      ? requestedMode
      : autoDetect && detectEstimateIntent(transcript)
        ? 'estimate_v1'
        : 'crm_basic'

  try {
    const out = await runExtractionProfiles({
      profiles: [profileKey],
      auto_detect: false,
      text: transcript,
      source_type: 'chat',
      customer_id: conv.customer_id || null,
      conversation_id: conv.id,
      mode: 'full',
      save_runs: true,
      requested_by: session.user.id,
    })
    const first = out.results[0]
    if (!first) return NextResponse.json({ error: 'Khong co ket qua phan tich' }, { status: 500 })
    const extracted = first.extracted
    const missingFields = Array.isArray(first.missing_fields) ? first.missing_fields : []
    const normalizedExtracted = { ...(extracted || {}) } as Record<string, unknown>
    if (profileKey === 'estimate_v1' || profileKey === 'estimate_preliminary') {
      normalizedExtracted.summary = buildEstimateSummary(missingFields)
    }

    let existingCustomer = null
    if (typeof normalizedExtracted.phone_number === 'string' && normalizedExtracted.phone_number.trim()) {
      existingCustomer = await db.customer.findUnique({
        where: { phone_number: normalizedExtracted.phone_number.trim() },
        select: { id: true, full_name: true, phone_number: true, status: true },
      })
    }
    if (!existingCustomer && conv.customer_id) {
      existingCustomer = await db.customer.findUnique({
        where: { id: conv.customer_id },
        select: { id: true, full_name: true, phone_number: true, status: true },
      })
    }

    const channelQuestions = buildChannelRecommendedQuestions({
      profileKey,
      channel: conv.channel,
      missingFields,
      fallback: first.recommended_questions,
    })

    const prevMeta =
      conv.analysis?.sentiment_timeline && typeof conv.analysis.sentiment_timeline === 'object'
        ? (conv.analysis.sentiment_timeline as Record<string, unknown>)
        : {}
    const nextMeta = {
      ...prevMeta,
      last_analysis_profile_key: profileKey,
      last_analysis_missing_fields: missingFields,
      last_analysis_recommended_questions: channelQuestions,
      last_analysis_at: new Date().toISOString(),
    }
    await db.conversationAnalysis.upsert({
      where: { conversation_id: conv.id },
      update: { sentiment_timeline: nextMeta as any },
      create: {
        conversation_id: conv.id,
        model_used: 'analysis_profile',
        sentiment_timeline: nextMeta as any,
      },
    })

    return NextResponse.json({
      extracted: normalizedExtracted,
      existing_customer: existingCustomer,
      conversation_id: conv.id,
      channel: conv.channel,
      display_name: conv.display_name,
      external_user_id: conv.external_user_id,
      transcript_length: scopedMessages.length,
      analyzed_from_message_id: fromMessageId || scopedMessages[0]?.id || null,
      analyzed_to_message_id: scopedMessages[scopedMessages.length - 1]?.id || null,
      analysis_mode: profileKey,
      missing_fields: missingFields,
      recommended_questions: channelQuestions,
      status: missingFields.length ? 'needs_data' : 'completed',
    })
  } catch (err: any) {
    console.error('[ANALYZE] Error:', err.message)
    return NextResponse.json({ error: err.message || 'Analyze failed' }, { status: 500 })
  }
}

function buildEstimateSummary(missingFields: string[]): string {
  if (!missingFields.length) return 'Du du lieu de chay khai toan/du toan so bo.'
  return `Con thieu du lieu: ${missingFields.join(', ')}.`
}

function buildChannelRecommendedQuestions(params: {
  profileKey: AnalysisProfileKey
  channel: string
  missingFields: string[]
  fallback: string[]
}): string[] {
  const missing = Array.isArray(params.missingFields) ? params.missingFields : []
  if (!missing.length) return []

  const questions = missing
    .map((field) => questionByField(field, params.profileKey))
    .filter((x): x is string => Boolean(x))

  const base = questions.length ? questions : (Array.isArray(params.fallback) ? params.fallback : [])
  if (!base.length) return []

  const prefix = channelPrefix(params.channel)
  return base.map((q) => `${prefix}${q}`)
}

function channelPrefix(channel: string): string {
  const key = String(channel || '').toLowerCase()
  if (key === 'telegram') return '[TG] '
  if (key === 'zalo') return '[ZL] '
  if (key === 'messenger') return '[MSG] '
  return ''
}

function questionByField(field: string, profileKey: AnalysisProfileKey): string | null {
  const f = String(field || '').trim()
  if (!f) return null

  const common: Record<string, string> = {
    full_name: 'Anh/chi cho em xin ten de em xung ho chuan?',
    phone_number: 'Anh/chi cho em xin so dien thoai de de lien he?',
    residential_address: 'Dia chi cu tru hien tai cua anh/chi o khu vuc nao?',
    construction_address: 'Dia chi cong trinh du kien xay o dau (quan/huyen, tinh/thanh)?',
    house_type: 'Anh/chi du kien xay loai nha nao (nha pho, biet thu, cap 4...)?',
    floors: 'Cong trinh du kien xay bao nhieu tang?',
    floor_area: 'Tong dien tich san du kien khoang bao nhieu m2?',
    finish_level: 'Muc hoan thien mong muon la co ban, tieu chuan hay cao cap?',
    budget_target: 'Ngan sach du kien cua anh/chi khoang bao nhieu?',
    construction_timeframe: 'Anh/chi du kien khoi cong vao thoi diem nao?',
    alley_access: 'Duong vao cong trinh la mat tien hay hem (xe tai/xe be)?',
  }

  const estimateExtra: Record<string, string> = {
    region_code: 'Cong trinh nam o tinh/thanh nao de em ap dung don gia khu vuc?',
    style: 'Anh/chi muon phong cach nao (hien dai, tan co dien, co dien...)?',
    foundation_type: 'Anh/chi du kien dung loai mong nao (mong coc, mong bang, mong be)?',
    build_length_m: 'Chieu dai xay dung du kien la bao nhieu met?',
    build_width_m: 'Chieu rong xay dung du kien la bao nhieu met?',
    floor_height_m: 'Chieu cao tung tang du kien khoang bao nhieu met?',
    stair_void_area: 'Dien tich o thong tang/hoc thang du kien khoang bao nhieu m2?',
    tum_count: 'Cong trinh co tum khong? Neu co thi bao nhieu tum?',
    basement_count: 'Cong trinh co tang ham khong? Neu co thi bao nhieu tang ham?',
    bedroom_count: 'Du kien co bao nhieu phong ngu?',
    wc_count: 'Du kien co bao nhieu WC?',
    kitchen_count: 'Du kien co bao nhieu bep?',
    living_room_count: 'Du kien co bao nhieu phong khach?',
    base_cost_per_m2: 'Anh/chi co muc don gia/m2 mong muon de em can doi khong?',
    province_or_city: 'Cong trinh thuoc tinh/thanh nao?',
    district: 'Cong trinh thuoc quan/huyen nao?',
  }

  if (common[f]) return common[f]
  if (profileKey === 'estimate_v1' || profileKey === 'estimate_preliminary') {
    if (estimateExtra[f]) return estimateExtra[f]
  }
  return `Anh/chi bo sung giup em truong: ${f}?`
}
