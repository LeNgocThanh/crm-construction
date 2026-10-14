// src/lib/ai/providers/gemini.ts
// CLOUD AI provider — Google Gemini (inactive, giữ để switch)
// Để kích hoạt: đổi AI_PROVIDER=gemini trong .env.local
import type { AIExtractionResult } from '@/types'

const EXTRACTION_PROMPT = `Bạn là AI chuyên phân tích cuộc gọi tư vấn xây dựng tại Việt Nam.
Từ nội dung cuộc gọi dưới đây, hãy bóc tách thông tin và trả về JSON CHÍNH XÁC theo format sau.
QUAN TRỌNG: Chỉ trả về JSON thuần túy, không có markdown, không có text khác nào.

{
  "full_name": "Tên khách hàng hoặc null nếu không nhắc tới",
  "address": "Địa chỉ xây dựng hoặc null",
  "house_type": "Nhà phố hoặc Biệt thự hoặc Nhà cấp 4 hoặc Chung cư hoặc Khác hoặc null",
  "floors": số_tầng_nguyên_hoặc_null,
  "floor_area": diện_tích_m2_số_thực_hoặc_null,
  "estimated_budget": ngân_sách_VND_số_nguyên_hoặc_null,
  "ai_summary": "Tóm tắt ngắn gọn 2-3 câu về nội dung cuộc gọi",
  "ai_sentiment": "Tích cực hoặc Trung lập hoặc Gay gắt",
  "next_action": "Hành động cụ thể Sales cần làm tiếp theo (câu đầy đủ)",
  "lead_score": số_nguyên_từ_1_đến_10
}

Nội dung cuộc gọi:
`

export async function extractFromTextGemini(text: string): Promise<AIExtractionResult> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: { temperature: 0.1 },
  })

  const result   = await model.generateContent(EXTRACTION_PROMPT + text)
  const rawText  = result.response.text()
  const cleaned  = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()

  try {
    return JSON.parse(cleaned) as AIExtractionResult
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0]) as AIExtractionResult
    throw new Error('Không thể parse kết quả Gemini')
  }
}
