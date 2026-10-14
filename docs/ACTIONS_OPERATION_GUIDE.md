# Actions Operation Guide

## Muc tieu
- Tach `actions/tasks` ra khoi `next_action` don le.
- Cho phep giao viec theo nguoi phu trach, theo deadline, co notification va audit.
- Ho tro ca action gan customer va action noi bo.

## Pham vi hien tai

### 1) Trang van hanh
- `/actions`
  - Tao action moi
  - Gan nguoi phu trach
  - Chon uu tien, han xu ly
  - Theo doi danh sach action
  - Thao tac nhanh: done / gia han / huy

### 2) API chinh
- `GET /api/work-suggestions`
  - list action theo bucket/mine/status/customer
- `POST /api/work-suggestions`
  - tao action thu cong
  - ho tro `is_internal=true` de tao action noi bo khong gan customer
- `POST /api/work-suggestions/[id]/actions`
  - `accept`, `reject`, `assign`, `done`, `reschedule`, `cancel`

## Dinh nghia trang thai
- `pending`: moi tao/chua nhan
- `accepted`: da nhan viec
- `assigned`: duoc giao cu the
- `done`: da xu ly xong (noi bo)
- `rejected`: tu choi
- `cancelled`: huy action

## Deadline rule
- Qua han = `status in (pending, accepted, assigned)` va `due_at < now`.
- Chua qua han = `status in (pending, accepted, assigned)` va `due_at >= now`.
- `done/cancelled/rejected` khong tinh qua han.

## Reschedule / Cancel rule

### Reschedule
- Action: `reschedule`
- Bat buoc:
  - `due_at` moi hop le
  - `note` (ly do)
- Tac dong:
  - cap nhat due_at
  - ghi metadata reschedule
  - ghi `action_timeline_events (due_changed)`
  - notify nguoi lien quan

### Cancel
- Action: `cancel`
- Bat buoc:
  - `note` (ly do)
- Quyen:
  - manager/admin hoac nguoi giao viec (`assigned_by`)
- Tac dong:
  - status -> cancelled
  - dong recipient pending/accepted/assigned -> dismissed
  - ghi metadata cancel
  - ghi `action_timeline_events (cancelled)`
  - push customer timeline neu action co customer

## Action Timeline vs Customer Timeline

### Action Timeline
- Luu audit chi tiet action lifecycle.
- Nguon du lieu: `action_timeline_events`.

### Customer Timeline
- Chi luu su kien can hien thi hanh trinh khach hang.
- Bridge event hien tai:
  - `created`, `updated`, `done`, `cancelled`.
- Event noi bo (assign/reassign/doi han/doi priority) khong push sang customer timeline.

## Notification rule
- Tao action/assign -> notify assignee.
- reject/accept/done/reschedule/cancel -> notify ben lien quan theo role.
- User co lich su notification rieng va mark read.

## Action noi bo
- `is_internal=true` + `customer_id = null`
- Khong push customer timeline.
- Van co:
  - assignment
  - deadline
  - notification
  - action timeline audit

## UI han che nhap tay
- Preset deadline:
  - Cuoi ngay hom nay (17:30)
  - +1 ngay (09:00)
  - +3 ngay (09:00)
  - +7 ngay (09:00)
- Ly do gia han/huy:
  - chon bang dropdown.

