// src/lib/bot/reply.ts — V3.0: SĐT → Địa chỉ → Hẹn gặp flow
import type { BotConfig, Conversation, Message } from '@prisma/client'
import { searchSimilar, type SearchResult } from '@/lib/rag/qdrant'

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const MODEL       = process.env.OLLAMA_MODEL    || 'gemma3:12b'

type ConvWithMessages = Conversation & { messages: Message[] }

interface ReplyInput {
  config:       BotConfig
  conversation: ConvWithMessages
  latestMessage: string
}
interface ReplyResult {
  reply:                  string
  callback_requested:     boolean
  is_urgent:              boolean
  contact_info_extracted: boolean
  address_extracted:      boolean
  meeting_confirmed:      boolean
  meeting_time?:          string
  meeting_location?:      string
  ask_for_contact:        boolean
  rag_used:               boolean
  rag_sources:            number
}

const CALLBACK_KEYWORDS = ['gọi lại', 'goi lai', 'liên hệ lại', 'lien he lai', 'tư vấn trực tiếp', 'muốn gặp', 'hẹn gặp']
const URGENT_KEYWORDS   = ['khẩn', 'gấp', 'ngay', 'urgent', 'ngay bây giờ', 'hôm nay', 'sáng mai']
const MEETING_CONFIRM_KEYWORDS = [
  'đồng ý', 'ok', 'oke', 'okay', 'được', 'được bạn', 'có thể', 'rảnh',
  'thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy', 'chủ nhật',
  'sáng', 'chiều', 'tối', 'buổi', 'ngày', 'giờ', 'lúc',
]

export async function generateBotReply(input: ReplyInput): Promise<ReplyResult> {
  const { config, conversation, latestMessage } = input
  const msgLower = latestMessage.toLowerCase()
  const conv     = conversation as any  // cast để access new fields

  // ── Callback ──────────────────────────────────────────────────────
  const callback_requested = CALLBACK_KEYWORDS.some(k => msgLower.includes(k))
  if (callback_requested) return makeResult({ reply: config.callback_msg, callback_requested: true })

  const is_urgent              = URGENT_KEYWORDS.some(k => msgLower.includes(k))
  const contact_info_extracted = hasContactInfo(latestMessage)
  const address_extracted      = hasAddress(latestMessage)
  const isSensitive            = config.sensitive_keywords.some(k => msgLower.includes(k.toLowerCase()))

  // ── Detect khách đồng ý hẹn ──────────────────────────────────────
  // Chỉ check khi đã mời hẹn và chưa confirm
  if (conv.meeting_requested && !conv.meeting_confirmed) {
    const isConfirming = MEETING_CONFIRM_KEYWORDS.some(k => msgLower.includes(k))
    if (isConfirming) {
      const extracted = await extractMeetingInfo(latestMessage, conversation.messages)
      if (extracted) {
        // Build confirm message từ template
        const confirmMsg = ((config as any).confirm_meeting_msg || 'Mình xác nhận hẹn gặp bạn vào {time} tại {location}. Bên mình sẽ liên hệ lại để xác nhận trước buổi hẹn nhé!')
          .replace('{time}',     extracted.meeting_time     || 'thời gian đã thỏa thuận')
          .replace('{location}', extracted.meeting_location || 'địa điểm đã thỏa thuận')

        return makeResult({
          reply:            confirmMsg,
          is_urgent,
          contact_info_extracted,
          address_extracted,
          meeting_confirmed:  true,
          meeting_time:       extracted.meeting_time,
          meeting_location:   extracted.meeting_location,
        })
      }
    }
  }

  // ── Ask for contact (tin 3,6,9 — chưa có SĐT) ────────────────────
  if (!conv.has_contact_info && !contact_info_extracted) {
    const msgCount = conversation.messages.filter(m => m.direction === 'in').length
    if (msgCount >= 2 && msgCount % 3 === 0) {
      return makeResult({ reply: config.ask_contact_msg, ask_for_contact: true, is_urgent })
    }
  }

  // ── RAG search ────────────────────────────────────────────────────
  let ragResults: SearchResult[] = []
  let rag_used = false
  if (config.rag_enabled) {
    try {
      ragResults = await searchSimilar(latestMessage, 4, config.rag_score_threshold || 0.65)
      rag_used   = ragResults.length > 0
    } catch (err) {
      console.error('[BOT] Qdrant search failed:', (err as Error).message)
    }
  }

  // ── Sensitive + no RAG ────────────────────────────────────────────
  if (isSensitive && !rag_used) {
    return makeResult({
      reply: is_urgent
        ? 'Đây là câu hỏi cần tư vấn chi tiết. Sales sẽ liên hệ bạn sớm nhất! Bạn vui lòng để lại số điện thoại?'
        : config.no_info_msg,
      is_urgent, contact_info_extracted,
    })
  }

  const ragContext = buildRagContext(ragResults)
  const recentMsgs = conversation.messages
    .slice(-10)
    .map(m => `${m.sender_type === 'customer' ? 'Khách' : 'Bot'}: ${m.content}`)
    .join('\n')

  const hasPrice   = ragResults.some(r => r.type === 'price')
  const hasPolicy  = ragResults.some(r => r.type === 'policy')
  const hasProcess = ragResults.some(r => r.type === 'process')
  const hasList    = msgLower.match(/có (những )?gì|gồm|bao gồm|liệt kê|tất cả|danh sách/)
  const isGreeting = msgLower.match(/^(xin chào|chào|hello|hi|hey|alo|good morning|good afternoon|chào bạn|bạn ơi|cho hỏi|hỏi chút)[\s!?.]*$/)
  const botGuidanceText = getBotGuidanceText(conv.analysis?.sentiment_timeline)
  const analyzeMeta = getAnalyzeMeta(conv.analysis?.sentiment_timeline)

  // ── Xác định rule cuối prompt theo trạng thái hội thoại ──────────
  const ctaRule = buildCtaRule({
    conv,
    contact_info_extracted,
    address_extracted,
    config,
  })
  const priorityAskRule = buildPriorityAskRule({
    conv,
    botGuidanceText,
    latestMissingFields: analyzeMeta.last_missing_fields,
    latestRecommendedQuestions: analyzeMeta.last_recommended_questions,
    contact_info_extracted,
    address_extracted,
  })

  const maxTokens = calcMaxTokens({ isGreeting: !!isGreeting, hasProcess, hasPrice, hasPolicy, hasList: !!hasList, ragLength: ragContext.length })
  const guidanceRule = botGuidanceText
    ? `7. DINH HUONG UU TIEN TU SALES: ${botGuidanceText}
8. Khi ap dung dinh huong: van phai tra loi dung cau hoi cua khach truoc, sau do moi hoi bo sung toi da 1 cau ngan o cuoi.`
    : ''

  // ── Prompt ────────────────────────────────────────────────────────
  const prompt = isGreeting
    ? `Bạn là tư vấn viên của công ty Tidi Cons — công ty xây dựng chuyên nghiệp. Hãy chào lại thân thiện, giới thiệu ngắn về Tidi Cons và hỏi khách cần tư vấn gì. Trả lời bằng tiếng Việt, 2-3 câu.

KHÁCH: ${latestMessage}

Trả lời:`
    : `Bạn là tư vấn viên của công ty Tidi Cons. Đối với các câu chào hỏi xã giao, hãy trả lời thân thiện như một người tư vấn của công ty Tidi Cons mà không cần kiểm tra kiến thức.

### QUY TẮC NGHIÊM NGẶT:
1. CHỈ sử dụng thông tin trong "DỮ LIỆU KIẾN THỨC" bên dưới. Tuyệt đối KHÔNG tự bịa ra quy trình kỹ thuật, đơn giá hoặc chính sách nếu không có trong dữ liệu.
2. Nếu dữ liệu KHÔNG có thông tin liên quan: Trả lời lịch sự rằng bạn chưa có thông tin này và đề nghị khách để lại SĐT chờ tư vấn gọi lại.
3. Khi liệt kê (danh mục, vật liệu, ưu đãi...): Phải liệt kê ĐẦY ĐỦ các ý có trong dữ liệu, không được tóm tắt sơ sài.
4. Trả lời bằng tiếng Việt, giọng điệu chuyên nghiệp, cầu thị.
${hasPrice  ? '5. [GIÁ] Kết thúc bằng "Đây là giá tham khảo, liên hệ để được báo giá chính xác theo thực tế công trình."' : ''}
${hasPolicy ? '5. [CHÍNH SÁCH] Trích dẫn nguyên văn, không rút gọn hay diễn giải lại nội dung bảo hành/cam kết.' : ''}
${hasProcess ? '5. [QUY TRÌNH] Liệt kê đầy đủ từng bước theo đúng thứ tự, không bỏ bước nào.' : ''}
${ctaRule}
${guidanceRule}
${priorityAskRule}

### DỮ LIỆU KIẾN THỨC:
${ragContext || 'KHÔNG CÓ DỮ LIỆU LIÊN QUAN — bắt buộc trả lời rằng chưa có thông tin và mời khách để lại SĐT.'}

### LỊCH SỬ HỘI THOẠI:
${recentMsgs || '(Tin đầu tiên)'}

### KHÁCH HỎI:
${latestMessage}

### TRẢ LỜI:`

  let reply: string
  try {
    reply = await callOllama(prompt, maxTokens)
    if (!reply || reply.trim().length < 5) reply = config.no_info_msg
  } catch (err) {
    console.error('[BOT] Ollama failed:', err)
    reply = config.no_info_msg
  }

  return makeResult({ reply, is_urgent, contact_info_extracted, address_extracted, rag_used, rag_sources: ragResults.length })
}

// ── CTA rule — xác định hành động cuối prompt theo trạng thái ──────
function buildCtaRule(opts: {
  conv:                   any
  contact_info_extracted: boolean
  address_extracted:      boolean
  config:                 any
}): string {
  const { conv, contact_info_extracted, address_extracted, config } = opts

  // Đã xác nhận hẹn → không cần CTA nữa
  if (conv.meeting_confirmed) return ''

  // Đã mời hẹn rồi → nhắc nhẹ nếu chưa confirm
  if (conv.meeting_requested) {
    return '6. Nếu phù hợp, nhẹ nhàng nhắc lại lời mời khảo sát mặt bằng miễn phí.'
  }

  // Đã có SĐT + địa chỉ → mời hẹn
  if ((conv.has_contact_info || contact_info_extracted) && (conv.has_address || address_extracted)) {
    return `6. Cuối trả lời, lồng ghép tự nhiên lời mời: "${config.ask_meeting_msg || 'Bên mình có dịch vụ khảo sát mặt bằng miễn phí tại nhà. Bạn có rảnh buổi nào trong tuần này không ạ?'}"`
  }

  // Đã có SĐT nhưng chưa có địa chỉ → hỏi địa chỉ
  if (conv.has_contact_info || contact_info_extracted) {
    return `6. Cuối trả lời, khéo léo hỏi: "${config.ask_address_msg || 'Bạn đang ở khu vực nào để mình tư vấn phù hợp với quy định xây dựng địa phương ạ?'}"`
  }

  // Chưa có gì → xin SĐT
  return '6. Cuối trả lời, khéo léo mời khách để lại số điện thoại để tư vấn chi tiết hơn.'
}

// ── Extract thông tin hẹn gặp từ tin nhắn ────────────────────────
async function extractMeetingInfo(
  latestMessage: string,
  messages: Message[]
): Promise<{ meeting_time: string; meeting_location: string; location_source: string } | null> {
  // Lấy 5 tin nhắn gần nhất làm context
  const context = messages.slice(-5)
    .map(m => `${m.sender_type === 'customer' ? 'Khách' : 'Bot'}: ${m.content}`)
    .join('\n')

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt: `Đọc đoạn hội thoại và tin nhắn mới nhất, extract thông tin hẹn gặp. Trả về JSON thuần, không thêm gì khác.

LỊCH SỬ:
${context}

TIN MỚI NHẤT: ${latestMessage}

Trả về JSON:
{
  "meeting_time": "thời gian hẹn cụ thể (VD: 14:00 thứ Ba ngày 25/03) hoặc null",
  "meeting_location": "địa điểm hẹn cụ thể hoặc null",
  "location_source": "customer (địa chỉ khách) | company (văn phòng công ty) | other (địa điểm khác)",
  "is_confirmed": true/false
}`,
        stream: false,
        options: { temperature: 0.1, num_predict: 200 },
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) return null
    const data  = await res.json()
    let raw = (data.response || '').trim()
        raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')

    const parsed = JSON.parse(raw)
    if (!parsed.is_confirmed) return null
    return {
      meeting_time:     parsed.meeting_time     || '',
      meeting_location: parsed.meeting_location || '',
      location_source:  parsed.location_source  || 'other',
    }
  } catch {
    return null
  }
}

// ── Nhóm RAG results theo type ────────────────────────────────────
function buildRagContext(results: SearchResult[]): string {
  if (!results.length) return ''

  const byType: Record<string, SearchResult[]> = {}
  for (const r of results) {
    const t = r.type || 'knowledge'
    if (!byType[t]) byType[t] = []
    byType[t].push(r)
  }

  const sections: string[] = []

  if (byType.qa?.length) {
    const items = byType.qa.map(r =>
      `• ${r.question ? `Hỏi: ${r.question}\n  Đáp: ${r.answer}` : r.answer}`
    ).join('\n')
    sections.push(`[HỎI ĐÁP]\n${items}`)
  }
  if (byType.price?.length) {
    const items = byType.price.map(r => `• ${r.category ? `[${r.category}] ` : ''}${r.answer}`).join('\n')
    sections.push(`[BẢNG GIÁ THAM KHẢO — nhắc khách liên hệ để báo giá chính xác]\n${items}`)
  }
  if (byType.policy?.length) {
    const items = byType.policy.map(r => `• ${r.category ? `[${r.category}] ` : ''}${r.answer}`).join('\n')
    sections.push(`[CHÍNH SÁCH & CAM KẾT — trích dẫn chính xác, không diễn giải sai]\n${items}`)
  }
  if (byType.process?.length) {
    const items = byType.process.map(r => `• ${r.category ? `[${r.category}] ` : ''}${r.answer}`).join('\n')
    sections.push(`[QUY TRÌNH — liệt kê đủ các bước theo thứ tự]\n${items}`)
  }
  if (byType.knowledge?.length) {
    const items = byType.knowledge.map(r => `• ${r.category ? `[${r.category}] ` : ''}${r.answer}`).join('\n')
    sections.push(`[KIẾN THỨC CHUNG]\n${items}`)
  }

  return sections.join('\n\n')
}

// ── Tính max tokens động ──────────────────────────────────────────
function calcMaxTokens(opts: {
  isGreeting: boolean; hasProcess: boolean; hasPrice: boolean
  hasPolicy: boolean; hasList: boolean; ragLength: number
}): number {
  if (opts.isGreeting) return 150
  let extra = 0
  if (opts.hasProcess) extra += 300
  if (opts.hasPolicy)  extra += 200
  if (opts.hasList)    extra += 200
  if (opts.hasPrice)   extra += 150
  if (opts.ragLength > 500)  extra += 100
  if (opts.ragLength > 1000) extra += 150
  if (opts.ragLength > 2000) extra += 200
  return Math.min(300 + extra, 1000)
}

async function callOllama(prompt: string, maxTokens = 300): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, prompt, stream: false,
      options: { temperature: 0.3, num_predict: maxTokens },
    }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`Ollama ${res.status}`)
  const data = await res.json()
  return (data.response || '').trim()
}

// ── Detect SĐT/tên trong tin nhắn ────────────────────────────────
function hasContactInfo(text: string): boolean {
  return /(0|84)[0-9]{9,10}/.test(text) || /tên.{0,5}(là|:)\s+\w+/i.test(text)
}

// ── Detect địa chỉ trong tin nhắn ────────────────────────────────
function hasAddress(text: string): boolean {
  return !!(
    // Quận/huyện/tỉnh
    /(quận|huyện|tỉnh|thành phố|tp\.|q\.|p\.|phường|xã|đường|hẻm|ngõ|số nhà)\s+\d*/i.test(text) ||
    // Tên địa danh phổ biến
    /(hà nội|hcm|hồ chí minh|đà nẵng|bình dương|đồng nai|long an|tiền giang|cần thơ|hải phòng)/i.test(text) ||
    // Pattern "ở + địa điểm"
    /\bở\s+\w+/.test(text) ||
    // Địa chỉ số nhà
    /\d+\s*(\/\d+)?\s+đường/i.test(text)
  )
}

// ── Helper tạo ReplyResult ────────────────────────────────────────
function makeResult(opts: Partial<ReplyResult> & { reply: string }): ReplyResult {
  return {
    reply:                  opts.reply,
    callback_requested:     opts.callback_requested     ?? false,
    is_urgent:              opts.is_urgent              ?? false,
    contact_info_extracted: opts.contact_info_extracted ?? false,
    address_extracted:      opts.address_extracted      ?? false,
    meeting_confirmed:      opts.meeting_confirmed      ?? false,
    meeting_time:           opts.meeting_time,
    meeting_location:       opts.meeting_location,
    ask_for_contact:        opts.ask_for_contact        ?? false,
    rag_used:               opts.rag_used               ?? false,
    rag_sources:            opts.rag_sources            ?? 0,
  }
}

function getBotGuidanceText(sentimentTimeline: unknown): string {
  if (!sentimentTimeline || typeof sentimentTimeline !== 'object') return ''
  const timeline = sentimentTimeline as Record<string, unknown>
  const raw = timeline.bot_guidance_text
  if (typeof raw !== 'string') return ''
  return raw.trim()
}

function getAnalyzeMeta(sentimentTimeline: unknown): {
  last_missing_fields: string[]
  last_recommended_questions: string[]
} {
  if (!sentimentTimeline || typeof sentimentTimeline !== 'object') {
    return { last_missing_fields: [], last_recommended_questions: [] }
  }
  const meta = sentimentTimeline as Record<string, unknown>
  const missing = Array.isArray(meta.last_analysis_missing_fields)
    ? meta.last_analysis_missing_fields.map((x) => String(x || '').trim()).filter(Boolean)
    : []
  const questions = Array.isArray(meta.last_analysis_recommended_questions)
    ? meta.last_analysis_recommended_questions.map((x) => String(x || '').trim()).filter(Boolean)
    : []
  return { last_missing_fields: missing, last_recommended_questions: questions }
}

function buildPriorityAskRule(opts: {
  conv: any
  botGuidanceText: string
  latestMissingFields: string[]
  latestRecommendedQuestions: string[]
  contact_info_extracted: boolean
  address_extracted: boolean
}): string {
  const {
    conv,
    botGuidanceText,
    latestMissingFields,
    latestRecommendedQuestions,
    contact_info_extracted,
    address_extracted,
  } = opts

  const priorityKeys = parsePriorityKeys(botGuidanceText)
  const fallbackPriority = ['phone_number', 'construction_address']
  const orderedKeys = priorityKeys.length ? priorityKeys : fallbackPriority
  const nextPriorityKey = orderedKeys.find((k) =>
    !hasFieldData(conv, k, { contact_info_extracted, address_extracted })
  )

  const missingQuestion = pickMissingQuestion(latestMissingFields, latestRecommendedQuestions)

  if (!nextPriorityKey && !missingQuestion) {
    return '9. Neu da du thong tin lien he co ban (so dien thoai/dia chi), khong can hoi lai. Co the xac nhan ngan gon rang da nhan du thong tin.'
  }

  const parts: string[] = ['9. O cuoi cau tra loi, chi dat toi da 1 cau hoi bo sung ngan, lich su.']

  if (nextPriorityKey) {
    parts.push(`10. Uu tien hoi field: ${nextPriorityKey}. Neu field nay da co thi bo qua va xet field uu tien tiep theo.`)
  } else {
    parts.push('10. Cac field uu tien da co du, khong hoi lai cac field uu tien.')
  }

  if (missingQuestion) {
    parts.push(`11. Neu can bo sung du lieu de phan tich/du toan, uu tien cau hoi sau: "${missingQuestion}"`)
  } else {
    parts.push('11. Neu khong co missing field thi khong can hoi them ve du lieu khuyet.')
  }

  return parts.join('\n')
}

function parsePriorityKeys(text: string): string[] {
  const raw = String(text || '').trim()
  if (!raw) return []
  const map: Record<string, string> = {
    phone: 'phone_number',
    phone_number: 'phone_number',
    sdt: 'phone_number',
    dien_thoai: 'phone_number',
    residential_address: 'residential_address',
    construction_address: 'construction_address',
    address: 'construction_address',
    dia_chi: 'construction_address',
    house_type: 'house_type',
    floors: 'floors',
    floor_area: 'floor_area',
    budget_target: 'budget_target',
    finish_level: 'finish_level',
    construction_timeframe: 'construction_timeframe',
  }
  const tokens = raw
    .toLowerCase()
    .split(/[\n,;>|]+/g)
    .map((x) => x.trim().replace(/\s+/g, '_'))
    .filter(Boolean)
  const out: string[] = []
  for (const t of tokens) {
    const key = map[t]
    if (!key) continue
    if (!out.includes(key)) out.push(key)
  }
  return out
}

function hasFieldData(
  conv: any,
  field: string,
  flags: { contact_info_extracted: boolean; address_extracted: boolean }
): boolean {
  const analysis = conv?.analysis || {}
  if (field === 'phone_number') {
    return Boolean(conv?.has_contact_info || flags.contact_info_extracted || analysis?.extracted_phone)
  }
  if (field === 'construction_address' || field === 'residential_address') {
    return Boolean(conv?.has_address || flags.address_extracted || analysis?.extracted_address)
  }
  const map: Record<string, unknown> = {
    house_type: analysis?.extracted_house_type,
    budget_target: analysis?.extracted_budget,
    full_name: analysis?.extracted_name,
  }
  const v = map[field]
  return v !== null && v !== undefined && String(v).trim() !== ''
}

function pickMissingQuestion(missingFields: string[], recommendedQuestions: string[]): string | null {
  if (Array.isArray(recommendedQuestions) && recommendedQuestions.length) return recommendedQuestions[0] || null
  if (!Array.isArray(missingFields) || !missingFields.length) return null
  const field = missingFields[0]
  const fallbackMap: Record<string, string> = {
    phone_number: 'Anh/chi cho em xin so dien thoai de de lien he?',
    construction_address: 'Anh/chi cho em xin dia chi cong trinh du kien xay dung?',
    residential_address: 'Anh/chi cho em xin dia chi cu tru hien tai?',
    floors: 'Cong trinh du kien xay bao nhieu tang?',
    floor_area: 'Tong dien tich san du kien khoang bao nhieu m2?',
    budget_target: 'Ngan sach du kien cua anh/chi khoang bao nhieu?',
    finish_level: 'Anh/chi mong muon muc hoan thien co ban, tieu chuan hay cao cap?',
  }
  return fallbackMap[field] || `Anh/chi bo sung giup em thong tin: ${field}?`
}
