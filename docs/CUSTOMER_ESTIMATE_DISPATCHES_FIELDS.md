# CUSTOMER ESTIMATE DISPATCHES - FIELD SPEC

## Muc tieu
Tai lieu nay chot nghiep vu luu lich su gui khaitoan/dutoan qua bang `customer_estimate_dispatches`.

## Nguyen tac luu du lieu
- Moi lan gui la 1 record rieng (khong ghi de record cu).
- Trang thai giao nhan cap nhat theo vong doi ro rang.
- Co the lien ket 1 dispatch voi `estimation_quote` de truy vet nguon so lieu.

## Danh sach truong va y nghia

| Field | Bat buoc | Luu gi | Khi nao ghi | Vi du |
| --- | --- | --- | --- | --- |
| `id` | Yes | Khoa chinh ban ghi dispatch | Tu dong khi tao | `disp_001` |
| `customer_id` | Yes | Khach hang nhan dispatch | Moi lan tao dispatch | `cus_123` |
| `estimation_quote_id` | No | Quote duoc gui (neu co) | Khi gui tu quote da luu | `quote_789` |
| `estimate_type` | Yes | Loai ban gui | Moi lan tao dispatch | `quick_estimate`, `preliminary_estimate` |
| `channel` | Yes | Kenh gui | Moi lan tao dispatch | `zalo`, `telegram`, `messenger`, `email`, `other` |
| `sent_at` | Yes | Thoi diem gui | Moi lan tao dispatch | `2026-04-23T10:10:00Z` |
| `sent_by` | No | Nguoi thuc hien gui | Khi biet user gui | `user_sales_a` |
| `delivery_status` | Yes | Trang thai giao nhan/open/confirm | Tao moi va cap nhat sau do | `sent`, `delivered`, `opened`, `confirmed`, `failed` |
| `opened_at` | No | Thoi diem khach mo xem | Khi co event opened | `2026-04-23T10:35:00Z` |
| `confirmed_at` | No | Thoi diem khach xac nhan | Khi co event confirmed | `2026-04-23T11:00:00Z` |
| `message_text` | No | Noi dung tin nhan/gui kem | Khi can truy vet noi dung da gui | `Em gui anh bang du toan so bo...` |
| `attachment_url` | No | Link file gui cho khach | Khi co file pdf/xlsx/... | `https://.../quote.pdf` |
| `snapshot_json` | No | Snapshot du lieu tai thoi diem gui | Khi can dong bang du lieu de doi chieu ve sau | `{"total_cost": 1200000000, "region_code": "HCM"}` |
| `created_at` | Yes | Thoi diem tao record | Tu dong | `2026-04-23T10:10:01Z` |
| `updated_at` | Yes | Thoi diem update gan nhat | Tu dong khi update | `2026-04-23T10:35:00Z` |

## Dinh nghia gia tri de team dong bo

### `estimate_type`
- `quick_estimate`: khaitoan nhanh
- `preliminary_estimate`: dutoan so bo

### `delivery_status` (luong de xuat)
- `sent`: da gui tu he thong
- `delivered`: kenh xac nhan da giao toi khach
- `opened`: khach da mo xem
- `confirmed`: khach da xac nhan da nhan/noi dung
- `failed`: gui that bai

Khuyen nghi transition:
- `sent -> delivered -> opened -> confirmed`
- `sent|delivered|opened -> failed` (neu phat sinh loi giao nhan)

## Rule nghiep vu khuyen nghi
- Tao moi dispatch:
- Bat buoc co `customer_id`, `estimate_type`, `channel`
- `delivery_status` mac dinh `sent`
- Neu gui tu quote, luu `estimation_quote_id`
- Cap nhat trang thai:
- Khi len `opened`, nen set `opened_at` neu chua co
- Khi len `confirmed`, nen set `confirmed_at` neu chua co
- Theo doi cham soc:
- Moi dispatch nen tao kem 1 `customer_care_activities` loai `estimate_sent`
- Moi thay doi status quan trong (`opened/confirmed/failed`) nen tao them activity tuong ung

## JSON mau tao dispatch

```json
{
  "customer_id": "cus_123",
  "estimation_quote_id": "quote_456",
  "estimate_type": "preliminary_estimate",
  "channel": "zalo",
  "sent_at": "2026-04-23T10:10:00Z",
  "sent_by": "user_sales_a",
  "delivery_status": "sent",
  "message_text": "Em gui anh bang du toan so bo de minh tham khao",
  "attachment_url": "https://files.example.com/quote_456.pdf",
  "snapshot_json": {
    "total_cost": 1250000000,
    "region_code": "HCM",
    "pricing_mode": "mixed"
  }
}
```

## JSON mau cap nhat trang thai opened

```json
{
  "delivery_status": "opened",
  "opened_at": "2026-04-23T10:35:00Z"
}
```

## JSON mau cap nhat trang thai confirmed

```json
{
  "delivery_status": "confirmed",
  "confirmed_at": "2026-04-23T11:00:00Z"
}
```

