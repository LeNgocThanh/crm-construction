// src/app/api/bot-cron/route.ts
// Gọi định kỳ để đóng conversations timeout
// Setup: crontab -e → */5 * * * * curl -s "http://localhost:3000/api/bot-cron?key=crm-cron-2026"
import { NextRequest, NextResponse } from 'next/server'
import { runTimeoutJob } from '@/lib/bot/analyzer'

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (key !== (process.env.CRON_SECRET || 'crm-cron-2026')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await runTimeoutJob()
  return NextResponse.json({ status: 'ok', ts: new Date().toISOString() })
}
