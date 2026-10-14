// src/lib/bot/analyzer.ts
// Batch analyze conversation sau khi đóng

import { db } from '@/lib/db'

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const MODEL       = process.env.OLLAMA_MODEL    || 'gemma3:4b'

export async function analyzeConversation(convId: string) {
  const conv = await db.conversation.findUnique({
    where:   { id: convId },
    include: { messages: { orderBy: { created_at: 'asc' } } },
  })
  if (!conv) return

  const transcript = conv.messages
    .map(m => `[${m.sender_type === 'customer' ? 'KH' : 'Bot'}] ${m.content}`)
    .join('\n')

  if (transcript.length < 20) return // quá ngắn, không cần analyze

  const prompt = `Bạn là AI phân tích hội thoại tư vấn xây dựng Việt Nam.
Phân tích đoạn hội thoại dưới đây và trả về JSON THUẦN TÚY (không markdown).

{
  "extracted_name":       "Tên khách hoặc null",
  "extracted_phone":      "SĐT 10 số hoặc null",
  "extracted_address":    "Địa chỉ xây dựng hoặc null",
  "extracted_house_type": "Nhà phố|Biệt thự|Nhà cấp 4|Chung cư|Khác|null",
  "extracted_budget":     số_VND_nguyên_hoặc_null,
  "stage":                "tim_hieu|tu_van|da_chot|bao_hanh|khac",
  "attitude":             "tich_cuc|trung_lap|kho_tinh|that_vong",
  "close_probability":    số_1_đến_10,
  "needs_urgent_support": true_hoặc_false,
  "callback_requested":   true_hoặc_false,
  "summary":              "Tóm tắt 2-3 câu nội dung hội thoại",
  "key_concerns":         ["mối quan tâm 1", "mối quan tâm 2"],
  "next_action":          "Hành động sales cần làm tiếp theo"
}

Hướng dẫn:
- stage: tim_hieu=mới hỏi thông tin, tu_van=đang thảo luận chi tiết, da_chot=đã đồng ý, bao_hanh=sau khi xây xong
- attitude: tích cực=quan tâm hỏi nhiều, trung_lap=hỏi sơ, kho_tinh=phàn nàn/khó chịu, that_vong=không hài lòng
- close_probability: 9-10=sắp chốt, 7-8=tiềm năng cao, 5-6=cần thêm tư vấn, 3-4=chưa rõ, 1-2=ít khả năng
- needs_urgent_support: true nếu khách có dấu hiệu cần hỗ trợ gấp hoặc không hài lòng nghiêm trọng

HỘI THOẠI:
${transcript}

JSON:`

  let result: any = {}
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:  MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 512 },
      }),
      signal: AbortSignal.timeout(60000),
    })
    const data    = await res.json()
    const rawText = (data.response || '').trim()
    const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
    try {
      result = JSON.parse(cleaned)
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (m) result = JSON.parse(m[0])
    }
  } catch (err) {
    console.error('[ANALYZER] Ollama failed:', err)
    result = {
      summary:              'Phân tích thất bại',
      stage:                'khac',
      attitude:             'trung_lap',
      close_probability:    5,
      needs_urgent_support: false,
      callback_requested:   conv.needs_callback,
    }
  }

  // Upsert analysis
  await db.conversationAnalysis.upsert({
    where:  { conversation_id: convId },
    create: {
      conversation_id:      convId,
      extracted_name:       result.extracted_name       || null,
      extracted_phone:      result.extracted_phone      || null,
      extracted_address:    result.extracted_address    || null,
      extracted_house_type: result.extracted_house_type || null,
      extracted_budget:     result.extracted_budget     ? BigInt(result.extracted_budget) : null,
      stage:                result.stage                || 'khac',
      attitude:             result.attitude             || 'trung_lap',
      close_probability:    result.close_probability    || 5,
      needs_urgent_support: result.needs_urgent_support || false,
      callback_requested:   result.callback_requested   || conv.needs_callback,
      summary:              result.summary              || null,
      key_concerns:         result.key_concerns         || [],
      next_action:          result.next_action          || null,
      model_used:           MODEL,
    },
    update: {
      extracted_name:       result.extracted_name       || null,
      extracted_phone:      result.extracted_phone      || null,
      extracted_address:    result.extracted_address    || null,
      extracted_house_type: result.extracted_house_type || null,
      extracted_budget:     result.extracted_budget     ? BigInt(result.extracted_budget) : null,
      stage:                result.stage                || 'khac',
      attitude:             result.attitude             || 'trung_lap',
      close_probability:    result.close_probability    || 5,
      needs_urgent_support: result.needs_urgent_support || false,
      callback_requested:   result.callback_requested   || conv.needs_callback,
      summary:              result.summary              || null,
      key_concerns:         result.key_concerns         || [],
      next_action:          result.next_action          || null,
      analyzed_at:          new Date(),
    },
  })

  // Update conv flags từ analysis
  await db.conversation.update({
    where: { id: convId },
    data: {
      is_urgent:       result.needs_urgent_support || false,
      needs_callback:  result.callback_requested   || conv.needs_callback,
      has_contact_info: !!(result.extracted_phone || result.extracted_name),
    },
  })

  console.log(`[ANALYZER] Done: ${convId} — stage=${result.stage}, prob=${result.close_probability}`)
}

// ─── Timeout job: đóng conversations im lặng quá lâu ─────────────
export async function runTimeoutJob() {
  const configs = await db.botConfig.findMany()

  for (const config of configs) {
    const cutoff = new Date(Date.now() - config.timeout_close_min * 60 * 1000)
    const staleConvs = await db.conversation.findMany({
      where: {
        channel:        config.channel,
        status:         'active',
        last_message_at: { lte: cutoff },
      },
      take: 50,
    })

    for (const conv of staleConvs) {
      await db.conversation.update({
        where: { id: conv.id },
        data: {
          status:       'closed',
          close_reason: 'timeout',
          closed_at:    new Date(),
        },
      })
      await db.botSession.updateMany({
        where: { conversation_id: conv.id, ended_at: null },
        data:  { ended_at: new Date(), ended_by: 'timeout' },
      })
      analyzeConversation(conv.id).catch(() => {})
    }

    if (staleConvs.length > 0) {
      console.log(`[TIMEOUT JOB] Closed ${staleConvs.length} stale ${config.channel} convs`)
    }
  }
}
