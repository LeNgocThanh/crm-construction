// src/lib/ai/providers/ollama.ts
// LOCAL AI provider — Ollama gemma3:4b
import type { AIExtractionResult } from '@/types'

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const MODEL       = process.env.OLLAMA_MODEL     || 'gemma3:4b'

const EXTRACTION_PROMPT = `Bạn là AI chuyên phân tích hội thoại tư vấn xây dựng tại Việt Nam.
Từ nội dung dưới đây, hãy bóc tách thông tin và trả về JSON CHÍNH XÁC theo format sau.
QUAN TRỌNG: Chỉ trả về JSON thuần túy, không có markdown, không có text khác nào.

{
  "full_name": "Tên khách hàng hoặc null nếu không nhắc tới",
  "address": "Địa chỉ xây dựng hoặc null",
  "house_type": "Nhà phố hoặc Biệt thự hoặc Nhà cấp 4 hoặc Chung cư hoặc Khác hoặc null",
  "floors": số_tầng_nguyên_hoặc_null,
  "floor_area": diện_tích_m2_số_thực_hoặc_null,
  "estimated_budget": ngân_sách_VND_số_nguyên_hoặc_null,
  "ai_summary": "Tóm tắt ngắn gọn 2-3 câu về nội dung hội thoại",
  "ai_sentiment": "Tích cực hoặc Trung lập hoặc Gay gắt",
  "next_action": "Hành động cụ thể Sales cần làm tiếp theo (câu đầy đủ)",
  "lead_score": số_nguyên_từ_1_đến_10
}

Hướng dẫn đánh giá lead_score:
- 9-10: Khách rất muốn xây, có ngân sách, cần báo giá ngay
- 7-8: Khách quan tâm, cần tư vấn thêm
- 5-6: Khách đang tìm hiểu, chưa quyết định
- 3-4: Khách hỏi sơ qua, không rõ ràng
- 1-2: Khách không hào hứng hoặc phàn nàn

Nội dung hội thoại:
`

export async function extractFromTextOllama(text: string): Promise<AIExtractionResult> {
  const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt: EXTRACTION_PROMPT + text,
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 512,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const rawText: string = data.response || ''

  // Parse JSON từ response
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim()

  try {
    return JSON.parse(cleaned) as AIExtractionResult
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0]) as AIExtractionResult
    throw new Error(`Ollama trả về format không hợp lệ: ${cleaned.substring(0, 100)}`)
  }
}

// Health check Ollama
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

// List available models
export async function listOllamaModels(): Promise<string[]> {
  try {
    const res  = await fetch(`${OLLAMA_BASE}/api/tags`)
    const data = await res.json()
    return (data.models || []).map((m: any) => m.name)
  } catch {
    return []
  }
}
