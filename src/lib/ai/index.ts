// src/lib/ai/index.ts
// Unified AI interface — switch provider via AI_PROVIDER env
import Groq from 'groq-sdk'
import type { AIExtractionResult } from '@/types'
import { extractFromTextOllama } from './providers/ollama'
import { extractFromTextGemini } from './providers/gemini'

const AI_PROVIDER = process.env.AI_PROVIDER || 'ollama'

// ─── Extraction: route to active provider ─────────────────────────
export async function extractFromText(text: string): Promise<AIExtractionResult> {
  if (AI_PROVIDER === 'gemini') {
    return extractFromTextGemini(text)
  }
  // Default: ollama
  return extractFromTextOllama(text)
}

// ─── Whisper: Groq (primary) ───────────────────────────────────────
// Groq free tier: 28,800 seconds/day (~8 hours audio)
// Nếu hết token → throw error rõ ràng để UI báo user
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' })

export async function transcribeAudio(buffer: Buffer, filename: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY chưa được cấu hình')
  }

  const file = new File([new Uint8Array(buffer)], filename, { type: getAudioMimeType(filename) })

  try {
    const transcription = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
      language: 'vi',
      response_format: 'text',
    })
    return transcription as unknown as string
  } catch (err: any) {
    // Groq rate limit / token hết
    if (err?.status === 429) {
      throw new Error('Groq Whisper đã hết token miễn phí hôm nay. Thử lại sau 00:00 UTC hoặc nhập text thủ công.')
    }
    throw new Error(`Transcription thất bại: ${err?.message || 'Unknown error'}`)
  }
}

function getAudioMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop()
  const types: Record<string, string> = {
    mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4',
    ogg: 'audio/ogg',  webm: 'audio/webm', flac: 'audio/flac',
  }
  return types[ext || ''] || 'audio/mpeg'
}

// ─── Re-export for backward compat ────────────────────────────────
export { checkOllamaHealth, listOllamaModels } from './providers/ollama'
export { AI_PROVIDER }
