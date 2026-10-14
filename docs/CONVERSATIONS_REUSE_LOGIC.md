# CONVERSATIONS REUSE LOGIC

> Muc tieu: xac nhan cac logic da co trong `/conversations` de tai su dung, tranh lam luong moi song song.

## 1) Data model hien tai (source of truth)

### `Conversation`
- Dinh danh thread theo `channel + external_conv_id` (unique).
- Trang thai: `active | closed | pending_callback`.
- Bot mode: `auto | manual | takeover`.
- Cac flag nghiep vu da co:
  - `has_contact_info`
  - `has_address`
  - `meeting_requested`
  - `meeting_confirmed`
  - `needs_callback`
  - `is_urgent`
- Link customer: `customer_id` (co the null neu chua match).

### `Message`
- Luu 2 chieu `in/out`, `sender_type` (`customer|bot|sales`).
- Co `external_msg_id` de dedup.
- Co `sender_label`, `sender_username`, `metadata`.
- Co feedback cho bot reply: `feedback`, `feedback_by`, `feedback_at`, `rag_status`, `rag_entry_id`.

### `ConversationAnalysis`
- 1-1 voi `Conversation`.
- Luu ket qua AI classify/extract sau khi close (hoac trigger analyze tay):
  - extracted fields (name/phone/address/house_type/budget)
  - stage, attitude, close_probability
  - summary, key_concerns, next_action.

### `BotSession`
- Track moi dot bot duoc kich hoat/tat.
- `triggered_by`: offline/schedule/manual.
- `ended_by`: timeout/takeover/callback/sales_close.

## 2) API va luong da co

### Conversation list/detail/messages
- `GET /api/conversations`
  - Filter: `channel`, `status`, `urgent`, `callback`, `search`, pagination.
- `GET /api/conversations/[id]`
  - Lay detail + messages + analysis + bot_sessions.
  - Tu dong mark incoming messages da doc.
- `GET /api/conversations/[id]/messages`
  - Lay messages (co cursor `before`), mark incoming da doc.
- `POST /api/conversations/[id]/messages`
  - Sales gui tin tu web (goi `sendSalesMessageFromWeb`).

### Takeover / release / close
- `POST /api/conversations/[id]/takeover` with `action=take|release`
  - `take`: dong bot session dang mo + set `bot_mode=takeover`.
  - `release`: set `bot_mode=auto`.
- `POST /api/conversations/[id]/close`
  - set `status=closed`, `close_reason`, `closed_at`.
  - dong bot sessions dang mo.
  - trigger `analyzeConversation()`.
- `POST /api/conversations/[id]/reopen`
  - mo lai conversation da dong (`status=active`), reset `close_reason`, `closed_at`.
  - dung de xu ly truong hop dong nham hoac lead quay lai.

### Analyze
- `POST /api/conversations/[id]/analyze`
  - Chay profile analysis (`crm_basic | estimate_v1 | estimate_preliminary`).
  - Transcript lay tu cum tin moi nhat cua conversation (hien tai 260 tin moi nhat),
    sau do dao lai theo thu tu thoi gian tang dan truoc khi dua vao AI.
  - Co `auto_detect` + detect estimate intent.
  - Luu run/facts qua module analysis store.
  - Tra `missing_fields` + `recommended_questions`.
  - `recommended_questions` da duoc chuan hoa theo `channel` + `mode` ngay tai API:
    - map theo tung `missing_field` de hoi lai dung nghiep vu (dac biet estimate fields),
    - gan prefix theo kenh (`[TG]`, `[ZL]`, `[MSG]`) de de track nguon chat,
    - fallback ve question mac dinh neu field chua co template rieng.
  - Quy tac `summary` hien tai:
    - `crm_basic`: summary duoc sieu chat de la tom tat CRM, khong chap nhan kieu "danh gia hoi thoai/nhan xet chat".
    - `estimate_v1` / `estimate_preliminary`: summary duoc chuan hoa o API thanh 2 trang thai:
      - `Du du lieu de chay khai toan/du toan so bo.`
      - `Con thieu du lieu: <danh sach missing_fields>.`

## 3) Bot engine logic da san

Source: `src/lib/bot/engine.ts`, `reply.ts`, `trigger.ts`, `sender.ts`, `analyzer.ts`.

### Inbound handling
- Upsert conversation.
- Dedup theo `external_msg_id`.
- Save incoming message.
- Neu `takeover` thi dung bot reply ngay.
- Check bot config + trigger (schedule/offline).
- Generate bot reply (RAG + prompt rules).
- Save outgoing bot message.
- Update conversation flags.
- Track `BotSession`.

### Meeting flow da co
- Reply layer detect confirm meeting.
- Engine goi `handleMeetingConfirmed`:
  - Tao `CustomerTimeline` type `meeting` (neu da link customer).
  - Update `customer.status = "Hen gap"`.

### Outbound sending
- `sendMessage()` ho tro `telegram|zalo|messenger`.
- Ho tro mock_mode tu DB (`bot_configs.mock_mode`).
- Ghi outbound webhook log.

### Timeout close
- `runTimeoutJob()`:
  - dong cac conversation `active` qua timeout theo channel config.
  - dong bot sessions.
  - trigger analyze sau khi close.

## 4) UI logic da co (co the tai su dung)

### `/conversations`
- Danh sach co filter channel/status/urgent/callback/search.
- SSE alerts (`/api/alerts/stream`) cho urgent/callback.
- Hien unread count.

### `/conversations/[id]`
- Chat detail.
- Send message by sales.
- Toggle takeover/release.
- Close conversation.
- Analyze modal:
  - chon mode
  - xem missing fields / recommended questions
  - luu/cap nhat customer tu ket qua analyze.
- Feedback bot message (like/dislike) de import RAG.

## 5) Nguyen tac mo rong (de tranh vo luong hien tai)

1. Khong tao "dispatch chat" bang model rieng neu da la tin outbound trong `Message`.
2. Neu can tracking gui du toan:
- uu tien link `dispatch` -> `conversation message` (metadata/ref id),
- khong nhan ban noi dung gui sang bang khac neu khong can.
3. Takeover tiep tuc la cong tac "khoa auto-reply", khong doi pipeline customer.
4. Event nghiep vu doi ngoai (gui that cho khach) moi day vao `customer_care_activities`/timeline.
5. Preview noi bo (gen thu) khong tu dong tao action cham soc.

## 6) Gap hien tai can luu y

1. Da co lien ket metadata co ban giua `customer_estimate_dispatches` va `messages`
   - `snapshot_json` cua dispatch co `conversation_id`, `message_id`, `provider_message_id`.
   - `messages.metadata` co `dispatch_id`, `dispatch_delivery_status`, ...
   - Hien tai chua enforce FK schema cap DB (dang metadata-level).
2. Da co dong bo delivery co ban tu `PATCH dispatch` -> `messages.metadata`.
   - Chua co worker webhook provider day du de cap nhat realtime theo provider callback.
3. Chua co UI dispatch tren customer detail (API da co).
4. Chua co rule auto tao follow-up sau khi "gui that" qua chat/email.

## 7) De xuat buoc tiep theo (nhanh, it vo code cu)

1. Them `dispatch_ref` metadata tren `Message` outbound.
2. Khi gui estimate qua chat:
- tao outbound message
- tao dispatch record
- link cheo bang `source_ref_id`/metadata.
3. Them worker update delivery status theo provider webhook -> cap nhat vao message metadata.
4. Tu dispatch thanh cong, tao `customer_care_activity` follow-up (T+1/T+3).

## 8) Bot guidance theo tung conversation

- API: `PATCH /api/conversations/[id]`
  - payload: `{ "bot_guidance_text": "..." }`
  - luu vao `ConversationAnalysis.sentiment_timeline`:
    - `bot_guidance_text`
    - `bot_guidance_updated_at`
    - `bot_guidance_updated_by`
- UI: `/conversations/[id]` co panel `BOT GUIDANCE` de nhap/sua guidance.
- Bot reply engine:
  - lay `bot_guidance_text` tu `conversation.analysis.sentiment_timeline`.
  - van tra loi dung cau hoi cua khach truoc.
  - neu co guidance thi chi them 1 cau hoi bo sung ngan o cuoi theo dinh huong (vd xin SĐT/dia chi).
  - neu field uu tien da co roi thi tu dong fallback sang field uu tien tiep theo.
  - neu da du cac field uu tien va khong con missing field, bot khong hoi lap lai.

## 9) Missing fields hoi kheo trong chat bot

- Sau moi lan `POST /api/conversations/[id]/analyze`, he thong luu them vao
  `ConversationAnalysis.sentiment_timeline`:
  - `last_analysis_missing_fields`
  - `last_analysis_recommended_questions`
- Luong bot reply doc 2 truong nay:
  - neu con thieu du lieu, uu tien 1 cau hoi kheo theo `recommended_questions` (hoac fallback theo field).
  - van giu quy tac: tra loi cau hoi hien tai cua khach truoc, cau hoi bo sung dat o cuoi.
