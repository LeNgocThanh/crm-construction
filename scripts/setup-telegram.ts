#!/usr/bin/env tsx
// scripts/setup-telegram.ts
// Chạy: npx tsx scripts/setup-telegram.ts
// 
// Script này sẽ:
// 1. Kiểm tra TELEGRAM_BOT_TOKEN hợp lệ
// 2. Đăng ký webhook với URL bạn nhập
// 3. In ra thông tin bot để verify

import * as readline from 'readline'
import * as dotenv from 'fs'

// Load .env.local manually
const envPath = '.env.local'
if (dotenv.existsSync(envPath)) {
  const lines = dotenv.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g,'')
  }
}

const TOKEN  = process.env.TELEGRAM_BOT_TOKEN
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'crm-tg-secret-2026'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, r))

async function main() {
  console.log('\n🤖 Telegram Webhook Setup\n')

  if (!TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN chưa được cấu hình trong .env.local')
    console.log('\nThêm dòng sau vào .env.local:')
    console.log('  TELEGRAM_BOT_TOKEN="your-token-from-botfather"')
    rl.close(); return
  }

  // Verify token
  process.stdout.write('🔍 Kiểm tra token... ')
  const meRes  = await fetch(`https://api.telegram.org/bot${TOKEN}/getMe`)
  const meData = await meRes.json()
  if (!meData.ok) {
    console.log('\n❌ Token không hợp lệ:', meData.description)
    rl.close(); return
  }
  const bot = meData.result
  console.log(`✅ Bot: @${bot.username} (${bot.first_name})`)

  // Get current webhook
  const whRes  = await fetch(`https://api.telegram.org/bot${TOKEN}/getWebhookInfo`)
  const whData = await whRes.json()
  const curUrl = whData.result?.url || ''
  if (curUrl) {
    console.log(`\n📌 Webhook hiện tại: ${curUrl}`)
    if (whData.result?.last_error_message) {
      console.log(`⚠️  Lỗi gần nhất: ${whData.result.last_error_message}`)
    }
  } else {
    console.log('\n📌 Chưa có webhook')
  }

  // Ask for public URL
  console.log('\n👉 Bạn cần có domain HTTPS public trước.')
  console.log('   Chạy: cloudflared tunnel --url http://localhost:3000')
  console.log('   Sẽ nhận URL dạng: https://xxx.trycloudflare.com\n')

  const publicUrl = (await ask('🌐 Nhập Public URL (VD: https://xxx.trycloudflare.com): ')).trim().replace(/\/$/, '')

  if (!publicUrl.startsWith('https://')) {
    console.log('❌ URL phải bắt đầu bằng https://')
    rl.close(); return
  }

  const webhookUrl = `${publicUrl}/api/webhooks/telegram`
  console.log(`\n📡 Đang đăng ký webhook: ${webhookUrl}`)

  const setRes = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url:             webhookUrl,
      secret_token:    SECRET,
      allowed_updates: ['message', 'callback_query', 'my_chat_member'],
      drop_pending_updates: true,
    }),
  })
  const setData = await setRes.json()

  if (setData.ok) {
    console.log('✅ Webhook đã đăng ký thành công!')
    console.log('\n📋 Tóm tắt cấu hình:')
    console.log(`   Bot:           @${bot.username}`)
    console.log(`   Webhook URL:   ${webhookUrl}`)
    console.log(`   Secret:        ${SECRET}`)
    console.log('\n📝 Bước tiếp theo:')
    console.log('   1. Cập nhật .env.local:')
    console.log(`      NEXTAUTH_URL="${publicUrl}"`)
    console.log('      BOT_MOCK_MODE=false')
    console.log('   2. Restart server: npm run dev')
    console.log('   3. Nhắn tin vào bot để test')
    console.log(`   4. Kiểm tra: ${publicUrl}/api/webhooks/status`)
  } else {
    console.log('❌ Lỗi đăng ký webhook:', setData.description)
  }

  rl.close()
}

main().catch(e => { console.error(e); process.exit(1) })
