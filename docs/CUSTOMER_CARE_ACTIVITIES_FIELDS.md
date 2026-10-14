# CUSTOMER CARE ACTIVITIES - FIELD SPEC

## Muc tieu
Tai lieu nay chot y nghia nghiep vu va cach luu cho bang `customer_care_activities`, bao gom cac truong hien co va cac truong moi vua thong nhat.

## Nguyen tac luu du lieu
- Moi hanh dong cham soc la 1 dong du lieu (append theo su kien).
- `customer.next_action` la truong hien thi nhanh, khong thay the lich su trong bang nay.
- Cac truong thoi gian dung ISO datetime.
- Cac truong text ngan uu tien ngan gon, de loc tim nhanh.

## Danh sach truong va y nghia

| Field | Bat buoc | Luu gi | Khi nao ghi | Vi du |
| --- | --- | --- | --- | --- |
| `id` | Yes | Khoa chinh dinh danh ban ghi activity | Tu dong khi tao record | `b8c7...` |
| `customer_id` | Yes | Khach hang ma activity nay thuoc ve | Moi lan tao activity | `cus_123` |
| `activity_type` | Yes | Loai hanh dong cham soc | Moi lan tao activity | `call`, `meeting`, `estimate_sent`, `followup`, `next_action_update` |
| `summary` | Yes | Tom tat 1 dong de doc nhanh | Moi lan tao activity | `Da goi tu van lan 1` |
| `detail` | No | Noi dung chi tiet (ghi chu, ket qua trao doi) | Khi can luu noi dung day du | `Khach muon tham khao goi 3 tang...` |
| `source_ref_type` | No | Nguon phat sinh activity | Khi activity den tu module khac | `contact_log`, `estimate_dispatch`, `manual`, `system` |
| `source_ref_id` | No | ID ban ghi goc cua nguon phat sinh | Khi co lien ket voi ban ghi goc | `log_456`, `dispatch_789` |
| `channel` | No | Kenh giao tiep da dung | Khi co kenh ro rang | `call`, `zalo`, `telegram`, `messenger`, `email`, `other` |
| `happened_at` | Yes | Thoi diem hanh dong thuc te xay ra | Moi lan tao activity | `2026-04-23T09:00:00Z` |
| `due_at` | No | Han can xu ly tiep theo cho action nay | Cho cac viec can follow-up | `2026-04-24T09:00:00Z` |
| `created_by` | No | Nguoi tao ban ghi activity | Khi biet user thao tac | `user_sales_a` |
| `care_owner_id` | No (nen co) | Nguoi chiu trach nhiem xu ly action | Khi giao viec cham soc | `user_sales_b` |
| `status` | Yes (truong moi) | Trang thai xu ly action cham soc | Dat khi tao va cap nhat xu ly | `open`, `done`, `cancelled`, `overdue` |
| `priority` | Yes (truong moi) | Do uu tien cua action | Dat khi tao/cap nhat muc do gap | `low`, `normal`, `high`, `urgent` |
| `completed_at` | No (truong moi) | Thoi diem dong action | Khi `status` chuyen `done` | `2026-04-24T11:20:00Z` |
| `completed_by` | No (truong moi) | Nguoi xac nhan hoan tat action | Khi `status` chuyen `done` | `user_manager_1` |
| `outcome` | No (truong moi) | Ket qua ngan sau khi xu ly xong | Khi close action hoac can ghi ket qua | `Khach dong y hen gap thu 7` |
| `metadata_json` | No | Du lieu mo rong (context ky thuat/nghiep vu) | Khi can luu extra khong nen tao cot moi | `{"ai_sentiment":"Tich cuc","lead_score":8}` |
| `created_at` | Yes | Thoi diem tao ban ghi | Tu dong | `2026-04-23T09:01:02Z` |
| `updated_at` | Yes | Thoi diem cap nhat ban ghi gan nhat | Tu dong khi update | `2026-04-23T09:15:00Z` |

## Dinh nghia gia tri de team dong bo

### `activity_type` (goi y)
- `call`: goi dien trao doi
- `chat`: chat text
- `meeting`: gap truc tiep
- `estimate_sent`: da gui khai toan/du toan
- `followup`: viec theo doi
- `note`: ghi chu thu cong
- `next_action_update`: cap nhat next action
- `reassigned`: doi nguoi phu trach

### `status`
- `open`: dang mo, chua xu ly xong
- `done`: da xu ly xong
- `cancelled`: huy bo, khong can xu ly tiep
- `overdue`: qua han (co the do job tu dong danh dau)

### `priority`
- `low`: thap
- `normal`: binh thuong
- `high`: cao
- `urgent`: khan cap

## Rule nghiep vu khuyen nghi
- Tao moi activity:
- `status` mac dinh `open`
- `priority` mac dinh `normal`
- `care_owner_id` mac dinh lay tu `customer.assigned_to` neu co
- Dong activity:
- Bat buoc set `status = done`
- Gan `completed_at`, `completed_by`
- Nen co `outcome` de truy vet ket qua cham soc
- Qua han:
- Neu `due_at < now` va `status = open` thi danh dau `overdue` (job dinh ky)

## JSON mau khi tao activity follow-up

```json
{
  "customer_id": "cus_123",
  "activity_type": "followup",
  "summary": "Goi lai xac nhan lich hen",
  "detail": "Khach yeu cau goi lai sau 17h",
  "source_ref_type": "estimate_dispatch",
  "source_ref_id": "dispatch_001",
  "channel": "call",
  "happened_at": "2026-04-23T10:00:00Z",
  "due_at": "2026-04-23T17:30:00Z",
  "created_by": "user_sales_a",
  "care_owner_id": "user_sales_a",
  "status": "open",
  "priority": "high",
  "metadata_json": {
    "estimate_type": "preliminary_estimate"
  }
}
```

## JSON mau khi hoan tat action

```json
{
  "status": "done",
  "completed_at": "2026-04-23T17:40:00Z",
  "completed_by": "user_sales_a",
  "outcome": "Khach xac nhan lich gap 9h sang mai"
}
```

