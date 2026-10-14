// src/lib/bot/engine.ts — V3.0: SĐT → Địa chỉ → Hẹn gặp flow
import { db } from '@/lib/db'
import { generateBotReply } from './reply'
import { checkBotShouldActivate } from './trigger'
import { sendMessage } from './sender'
import { analyzeConversation } from './analyzer'

export type Channel = 'zalo' | 'messenger' | 'telegram'

export interface IncomingMessage {
  channel:          Channel
  external_conv_id: string
  external_user_id: string
  display_name?:    string
  avatar_url?:      string | null
  content:          string
  msg_type?:        string
  external_msg_id?: string
  timestamp?:       Date
}

function platformReplyLabel(channel: Channel): string {
  if (channel === 'zalo')      return 'Trả lời trên Zalo'
  if (channel === 'messenger') return 'Trả lời trên Messenger'
  if (channel === 'telegram')  return 'Trả lời trên Telegram'
  return 'Trả lời bên ngoài'
}

export async function handleIncomingMessage(msg: IncomingMessage) {
  // 1. Upsert conversation
  let conv = await db.conversation.upsert({
    where: {
      channel_external_conv_id: {
        channel:          msg.channel,
        external_conv_id: msg.external_conv_id,
      },
    },
    create: {
      channel:          msg.channel,
      external_conv_id: msg.external_conv_id,
      external_user_id: msg.external_user_id,
      display_name:     msg.display_name,
      avatar_url:       msg.avatar_url,
      status:           'active',
      bot_mode:         'auto',
      last_message_at:  msg.timestamp || new Date(),
    },
    update: {
      display_name:    msg.display_name || undefined,
      last_message_at: msg.timestamp || new Date(),
    },
    include: {
      messages: { orderBy: { created_at: 'desc' }, take: 50 },
      analysis: true,
    },
  })

  // 2. Dedup check
  if (msg.external_msg_id) {
    const exists = await db.message.findFirst({ where: { external_msg_id: msg.external_msg_id } })
    if (exists) return { status: 'dedup', conv_id: conv.id }
  }

  // 3. Save incoming message
  await db.message.create({
    data: {
      conversation_id: conv.id,
      direction:       'in',
      sender_type:     'customer',
      sender_label:    conv.display_name || msg.display_name || 'Khách',
      content:         msg.content,
      msg_type:        msg.msg_type || 'text',
      external_msg_id: msg.external_msg_id,
    },
  })

  // Conversation da dong: chi luu message, khong tu dong reopen, khong auto-reply
  if (conv.status === 'closed') return { status: 'closed_logged', conv_id: conv.id }

  // 4. Takeover → không bot reply
  if (conv.bot_mode === 'takeover') return { status: 'takeover_active', conv_id: conv.id }

  // 5. Check bot config
  const config = await db.botConfig.findUnique({ where: { channel: msg.channel } })
  if (!config || !config.is_enabled) return { status: 'bot_disabled', conv_id: conv.id }

  const shouldBot = await checkBotShouldActivate(config, conv)
  if (!shouldBot) return { status: 'sales_handle', conv_id: conv.id }

  // 6. Reload conversation với messages đúng thứ tự
  conv = await db.conversation.findUniqueOrThrow({
    where: { id: conv.id },
    include: {
      messages: { orderBy: { created_at: 'asc' }, take: 50 },
      analysis: true,
    },
  })

  const replyResult = await generateBotReply({
    config,
    conversation: conv,
    latestMessage: msg.content,
  })

  // 7. Save bot reply
  await db.message.create({
    data: {
      conversation_id: conv.id,
      direction:       'out',
      sender_type:     'bot',
      sender_label:    'Chatbot',
      content:         replyResult.reply,
      msg_type:        'text',
    },
  })

  // 8. Update conversation flags
  const updates: any = { last_message_at: new Date() }

  if (replyResult.callback_requested)     { updates.needs_callback = true; updates.status = 'pending_callback' }
  if (replyResult.is_urgent)              updates.is_urgent = true
  if (replyResult.contact_info_extracted) updates.has_contact_info = true
  if (replyResult.address_extracted)      updates.has_address = true

  // Meeting flow flags
  if (replyResult.meeting_confirmed) {
    updates.meeting_confirmed  = true
    updates.meeting_requested  = true  // đảm bảo
  } else if (!conv.meeting_requested) {
    // Kiểm tra xem bot vừa mời hẹn chưa (có ask_meeting_msg trong reply)
    const cfg = config as any
    if (cfg.ask_meeting_msg && replyResult.reply.includes(
      (cfg.ask_meeting_msg || '').slice(0, 20)
    )) {
      updates.meeting_requested = true
    }
  }

  await db.conversation.update({ where: { id: conv.id }, data: updates })

  // 9. Nếu meeting_confirmed → tạo CustomerTimeline + update Customer
  if (replyResult.meeting_confirmed && replyResult.meeting_time) {
    await handleMeetingConfirmed({
      conv_id:          conv.id,
      customer_id:      conv.customer_id,
      meeting_time:     replyResult.meeting_time,
      meeting_location: replyResult.meeting_location,
      channel:          msg.channel,
    })
  }

  // 10. Send via platform
  await sendMessage({
    channel:          msg.channel,
    external_conv_id: msg.external_conv_id,
    external_user_id: msg.external_user_id,
    content:          replyResult.reply,
  })

  // 11. Bot session tracking
  const activeSession = await db.botSession.findFirst({
    where:   { conversation_id: conv.id, ended_at: null },
    orderBy: { started_at: 'desc' },
  })
  if (activeSession) {
    await db.botSession.update({
      where: { id: activeSession.id },
      data:  { messages_count: { increment: 1 } },
    })
  } else {
    await db.botSession.create({
      data: { conversation_id: conv.id, triggered_by: shouldBot.reason, messages_count: 1 },
    })
  }

  return { status: 'bot_replied', conv_id: conv.id, reply: replyResult.reply }
}

// ── Xử lý khi khách xác nhận hẹn gặp ────────────────────────────
async function handleMeetingConfirmed(opts: {
  conv_id:          string
  customer_id:      string | null
  meeting_time:     string
  meeting_location: string | undefined
  channel:          Channel
}) {
  try {
    // Tạo CustomerTimeline nếu đã có Customer
    if (opts.customer_id) {
      await db.customerTimeline.create({
        data: {
          customer_id:  opts.customer_id,
          type:         'meeting',
          title:        `Hẹn gặp qua chat ${opts.channel}`,
          description:  `Thời gian: ${opts.meeting_time}${opts.meeting_location ? ` · Địa điểm: ${opts.meeting_location}` : ''}`,
          happened_at:  new Date(),  // thời gian tạo, meeting_time là text mô tả
          metadata: {
            meeting_time:     opts.meeting_time,
            meeting_location: opts.meeting_location || null,
            source:           `chat_${opts.channel}`,
            confirmed:        true,
          },
        },
      })

      // Update customer status → Hẹn gặp
      await db.customer.update({
        where: { id: opts.customer_id },
        data:  { status: 'Hẹn gặp' },
      })
    }
  } catch (err) {
    console.error('[ENGINE] handleMeetingConfirmed error:', err)
  }
}

// ─── Sales gửi tin từ WEB ─────────────────────────────────────────
export async function sendSalesMessageFromWeb(opts: {
  convId:        string
  content:       string
  salesId:       string
  salesUsername: string
}) {
  const conv = await db.conversation.findUniqueOrThrow({ where: { id: opts.convId } })

  const msg = await db.message.create({
    data: {
      conversation_id:  conv.id,
      direction:        'out',
      sender_type:      'sales',
      sender_id:        opts.salesId,
      sender_label:     opts.salesUsername,
      sender_username:  opts.salesUsername,
      content:          opts.content,
      msg_type:         'text',
    },
  })

  await db.conversation.update({
    where: { id: conv.id },
    data:  { last_message_at: new Date() },
  })

  await sendMessage({
    channel:          conv.channel as Channel,
    external_conv_id: conv.external_conv_id,
    external_user_id: conv.external_user_id,
    content:          opts.content,
  })

  return msg
}

// ─── Handle tin nhắn "trả lời từ platform" ───────────────────────
export async function handleOutgoingWebhookMessage(opts: {
  channel:          Channel
  external_conv_id: string
  content:          string
  external_msg_id?: string
}) {
  const conv = await db.conversation.findUnique({
    where: {
      channel_external_conv_id: { channel: opts.channel, external_conv_id: opts.external_conv_id }
    }
  })
  if (!conv) return

  if (opts.external_msg_id) {
    const exists = await db.message.findFirst({ where: { external_msg_id: opts.external_msg_id } })
    if (exists) return
  }

  await db.message.create({
    data: {
      conversation_id: conv.id,
      direction:       'out',
      sender_type:     'sales',
      sender_label:    platformReplyLabel(opts.channel),
      content:         opts.content,
      msg_type:        'text',
      external_msg_id: opts.external_msg_id,
    },
  })

  await db.conversation.update({ where: { id: conv.id }, data: { last_message_at: new Date() } })
}

export async function closeConversation(convId: string, reason: string) {
  await db.conversation.update({
    where: { id: convId },
    data:  { status: 'closed', close_reason: reason, closed_at: new Date() },
  })
  await db.botSession.updateMany({
    where: { conversation_id: convId, ended_at: null },
    data:  { ended_at: new Date(), ended_by: reason },
  })
  analyzeConversation(convId).catch(err => console.error('[BOT] Analysis failed', err.message))
}

export async function takeoverConversation(convId: string) {
  await db.botSession.updateMany({
    where: { conversation_id: convId, ended_at: null },
    data:  { ended_at: new Date(), ended_by: 'takeover' },
  })
  return db.conversation.update({ where: { id: convId }, data: { bot_mode: 'takeover' } })
}

export async function releaseConversation(convId: string) {
  return db.conversation.update({ where: { id: convId }, data: { bot_mode: 'auto' } })
}

export async function reopenConversation(convId: string) {
  return db.conversation.update({
    where: { id: convId },
    data: {
      status: 'active',
      close_reason: null,
      closed_at: null,
      last_message_at: new Date(),
    },
  })
}
