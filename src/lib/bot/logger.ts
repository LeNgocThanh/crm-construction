// src/lib/bot/logger.ts
// Ghi log tất cả webhook request vào DB để debug

import { db } from '@/lib/db'

interface LogOptions {
  channel:    string
  direction:  'in' | 'out'
  event_type?: string
  chat_id?:   string
  content?:   string
  raw?:       any           // full payload — sẽ bị truncate nếu quá lớn
  status?:    'ok' | 'error' | 'rejected' | 'dedup'
  error?:     string
  duration_ms?: number
}

export async function webhookLog(opts: LogOptions): Promise<void> {
  try {
    // Truncate raw payload nếu quá lớn (giữ max 10KB)
    let raw = opts.raw
    if (raw) {
      const str = JSON.stringify(raw)
      if (str.length > 10_000) {
        raw = { _truncated: true, preview: str.slice(0, 500) }
      }
    }

    await db.webhookLog.create({
      data: {
        channel:    opts.channel,
        direction:  opts.direction,
        event_type: opts.event_type  || null,
        chat_id:    opts.chat_id     || null,
        content:    opts.content     ? opts.content.slice(0, 500) : null,
        raw:        raw              || undefined,
        status:     opts.status      || 'ok',
        error:      opts.error       || null,
        duration_ms: opts.duration_ms || null,
      },
    })
  } catch (err) {
    // Log thất bại không được crash app
    console.error('[WEBHOOK LOG] DB write failed:', (err as Error).message)
  }
}

// Tự xóa log cũ hơn 7 ngày — gọi từ cron
export async function pruneOldLogs(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const result = await db.webhookLog.deleteMany({
    where: { created_at: { lt: cutoff } },
  })
  return result.count
}
