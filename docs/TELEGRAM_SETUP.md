# 🤖 Hướng dẫn kết nối Telegram Bot

## Tổng quan

```
Khách nhắn tin vào Telegram Bot
          ↓
   Telegram API server
          ↓  (HTTPS webhook)
   Cloudflare Tunnel
          ↓
   localhost:3000 (Next.js)
          ↓
   /api/webhooks/telegram
          ↓
   Bot engine → Ollama RAG → Reply
          ↓
   Telegram API (gửi lại khách)
```

---

## Bước 1 — Tạo Telegram Bot

1. Mở Telegram, tìm **@BotFather**
2. Gửi lệnh: `/newbot`
3. Đặt tên hiển thị: `VD: Tư Vấn Xây Dựng ABC`
4. Đặt username: `VD: xaydung_abc_bot` (phải kết thúc bằng `_bot`)
5. BotFather sẽ trả về token dạng: `1234567890:AAHxxxxxxxx`

---

## Bước 2 — Cấu hình .env.local

```env
TELEGRAM_BOT_TOKEN="1234567890:AAHxxxxxxxx"
TELEGRAM_WEBHOOK_SECRET="crm-tg-secret-2026"
BOT_MOCK_MODE=false
```

Khởi động lại server: `npm run dev`

---

## Bước 3 — Cài Cloudflare Tunnel

### Windows (PowerShell):
```powershell
# Cài cloudflared
winget install Cloudflare.cloudflared

# Khởi động lại terminal, rồi chạy:
cloudflared tunnel --url http://localhost:3000
```

### macOS:
```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:3000
```

### Kết quả:
Terminal sẽ hiển thị URL như:
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://xxx-yyy-zzz.trycloudflare.com                                                     |
+--------------------------------------------------------------------------------------------+
```

> ⚠️ **Quan trọng:** URL này thay đổi mỗi lần restart tunnel.
> Nếu muốn URL cố định, dùng tunnel có tên (xem phần dưới).

---

## Bước 4 — Cập nhật NEXTAUTH_URL

```env
# .env.local — thay bằng URL từ bước 3
NEXTAUTH_URL="https://xxx-yyy-zzz.trycloudflare.com"
```

Khởi động lại server: `npm run dev`

---

## Bước 5 — Đăng ký webhook

### Cách A: Qua script (đơn giản nhất)
```bash
npm run setup:telegram
```

### Cách B: Qua Settings UI
Vào **Settings → Chatbot → tab "Kết nối"** → điền URL → bấm **"Đăng ký Webhook Tự Động"**

### Cách C: Qua API trực tiếp
```
GET https://xxx-yyy-zzz.trycloudflare.com/api/webhooks/telegram?setup=1
```

---

## Bước 6 — Kiểm tra

```bash
# Xem thông tin bot + webhook
GET /api/webhooks/telegram

# Xem chi tiết debug
GET /api/webhooks/telegram/debug

# Kiểm tra tất cả platforms
GET /api/webhooks/status
```

Hoặc vào **Settings → Chatbot → tab "Kết nối"** → bấm Refresh.

---

## Bước 7 — Bật bot

Vào **Settings → Chatbot → tab "Cấu hình"** → chọn **Telegram Bot** → bật toggle → Lưu.

---

## Test

1. Mở Telegram → tìm bot của bạn theo username
2. Nhắn: `Xin chào, tôi muốn hỏi về giá xây nhà`
3. Kiểm tra **Conversations** trong CRM → phải thấy conversation mới

---

## Tunnel cố định (khuyên dùng)

Nếu muốn URL không thay đổi:

```powershell
# Đăng nhập Cloudflare (cần tài khoản Cloudflare miễn phí)
cloudflared tunnel login

# Tạo tunnel có tên
cloudflared tunnel create crm-construction

# Lấy tunnel ID từ output, sau đó chạy:
cloudflared tunnel run --url http://localhost:3000 crm-construction
```

URL sẽ có dạng `https://crm-construction.YOUR_ACCOUNT.cfargotunnel.com` — cố định, không đổi.

---

## Troubleshooting

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|-----------|
| Bot không reply | Mock mode bật | `BOT_MOCK_MODE=false` trong .env.local |
| Webhook 401 | Sai secret token | Kiểm tra `TELEGRAM_WEBHOOK_SECRET` |
| Webhook không nhận được | Sai NEXTAUTH_URL | Cập nhật URL mới từ tunnel |
| Bot reply nhưng sai | RAG chưa có data | Vào Settings → RAG Knowledge → thêm dữ liệu |
| Tunnel mất kết nối | Tunnel restart | Chạy lại tunnel + đăng ký lại webhook |
