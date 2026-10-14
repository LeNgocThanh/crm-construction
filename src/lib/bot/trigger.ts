// src/lib/bot/trigger.ts
// Kiểm tra điều kiện kích hoạt bot

import { db } from '@/lib/db'
import type { BotConfig, Conversation } from '@prisma/client'

interface TriggerResult {
  should: boolean
  reason: 'offline' | 'schedule' | 'none'
}

export async function checkBotShouldActivate(
  config:  BotConfig,
  conv:    Conversation
): Promise<TriggerResult | false> {

  if (!config.is_enabled) return false

  // Check 1: Trong khung giờ schedule?
  if (config.schedule_enabled) {
    const inSchedule = isInScheduleWindow(config.schedule_start, config.schedule_end)
    if (inSchedule) return { should: true, reason: 'schedule' }
  }

  // Check 2: Tất cả sales offline > threshold?
  const offlineThresholdMs = config.offline_threshold_min * 60 * 1000
  const cutoff = new Date(Date.now() - offlineThresholdMs)

  const onlineSales = await db.user.count({
    where: {
      role_memberships: {
        some: {
          role: {
            is_active: true,
            role_key: { in: ['admin', 'manager', 'sales'] },
          },
        },
      },
      is_active: true,
      updated_at: { gte: cutoff }, // dùng updated_at làm proxy online status
    },
  })

  if (onlineSales === 0) return { should: true, reason: 'offline' }

  return false
}

function isInScheduleWindow(start: string, end: string): boolean {
  const now = new Date()
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)

  const nowMin   = now.getHours() * 60 + now.getMinutes()
  const startMin = sh * 60 + sm
  const endMin   = eh * 60 + em

  // Handle overnight window: 22:00 → 07:00
  if (startMin > endMin) {
    return nowMin >= startMin || nowMin < endMin
  }
  return nowMin >= startMin && nowMin < endMin
}

// ─── Update user "last seen" (gọi khi user có action trong app) ───
export async function updateUserLastSeen(userId: string) {
  await db.user.update({
    where: { id: userId },
    data:  { updated_at: new Date() },
  })
}
