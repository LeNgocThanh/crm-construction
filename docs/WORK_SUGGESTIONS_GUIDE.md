# Work Suggestions Guide

## Muc tieu
- Chuan hoa notification cho `next_action` thanh luong giao viec co xu ly.
- Ho tro mo hinh nguoi nhan: `1 chinh + nhieu phu`.
- Nguoi nhan co the `accept/reject`; manager/admin co the `assign`; nguoi xu ly co the `done`.

## Schema moi
- `work_suggestions`
  - `customer_id`, `care_activity_id`, `source_ref_type`, `source_ref_id`
  - `title`, `detail`, `next_action_text`
  - `due_at`, `priority`
  - `status`: `pending | accepted | rejected | assigned | done | cancelled`
  - `assigned_to`, `assigned_by`, `created_by`
- `work_suggestion_recipients`
  - `suggestion_id`, `user_id`
  - `role`: `primary | secondary`
  - `response_status`: `pending | accepted | rejected | assigned | done | dismissed`
  - `responded_at`, `responded_by`, `note`

## Nguon tao suggestion
- Khi tao/cap nhat `customer_care_activities` co:
  - `status = open`
  - va co `next_action_snapshot` (hoac fallback `summary`)
- He thong tao `work_suggestion` (idempotent theo `customer_id + source_ref + status-open`).

## Nguoi nhan
- Primary:
  - `care_owner_id` neu co
  - fallback `customer.assigned_to`
- Secondary:
  - thanh vien cung group voi primary (tru primary)
  - neu khong co primary -> fallback manager/admin

## API Phase 1
- `GET /api/work-suggestions`
  - query: `bucket=overdue|today|next3|all`, `mine=1|0`
- `POST /api/work-suggestions/[id]/actions`
  - body:
    - `action=accept` (+ `due_at`, `note`)
    - `action=reject` (+ `note`)
    - `action=assign` (+ `assign_to`, optional `due_at`, `note`) [manager/admin]
    - `action=done` (+ `note`)
  - rule:
    - neu suggestion dang o trang thai `assigned` ma `reject` thi bat buoc co `note` ly do.
    - khi reject do assign, tao notification nguoc lai cho nguoi assign.

## Notification integration
- `/api/notifications` da doc them nguon `work_suggestions` theo recipient hien tai.
- `notif_key` cho read tracking: `work:{recipient_id}`.
- `POST /api/notifications` mark-all da bao gom work notifications.
- them `user_notifications` de luu lich su notification theo user + status:
  - `pending | read | accepted | rejected | done | cancelled`.
- key mark read cho bang moi: `unf:{id}`.
- co the loc status: `GET /api/notifications?status=pending|read|accepted|rejected|done|cancelled`.

## Tac dong len CustomerCareActivity
- `accept/assign`:
  - cap nhat owner + due + status open cho activity lien ket.
- `done`:
  - cap nhat activity status done + completed_at/by + outcome.

## Ghi chu
- Phase 1 giu tuong thich voi luong notifications cu (contact_logs/hot_lead).
- UI Topbar hien notification work thong qua API /api/notifications, chua co man hinh queue rieng.

---

## Cap nhat tiep theo (da lam)

### 1) Action Timeline (phase 2)
- Da them luong ghi audit action vao `action_timeline_events`.
- Event da duoc ghi:
  - `created`, `assigned`, `reassigned`, `updated`, `accepted`, `rejected`, `done`, `due_changed`, `priority_changed`, `cancelled`.
- Cac diem da wire:
  - `/api/customers/[id]/care-activities` (POST/PATCH)
  - `/api/work-suggestions/[id]/actions`

### 2) Bridge sang Customer Timeline (phase 3)
- Da them helper bridge:
  - `src/lib/action-customer-bridge.ts`
- Chi day event can thiet sang customer timeline:
  - `created`, `updated`, `done`, `cancelled`.
- Event noi bo nhu assign/reassign/doi han/doi priority: khong day sang customer timeline.

### 3) Manual Actions page
- Da co trang tao/action list rieng:
  - `/actions`
- Da co API tao action thu cong:
  - `POST /api/work-suggestions`
- Ho tro:
  - gan customer + assignee + due + priority
  - tao notification cho nguoi duoc giao
  - ghi action timeline + (neu co customer) bridge customer timeline

### 4) Action noi bo (khong gan customer)
- `work_suggestions.customer_id` da cho phep nullable.
- `POST /api/work-suggestions` ho tro `is_internal=true`.
- UI `/actions` da co checkbox:
  - `Action noi bo (khong gan truc tiep khach hang)`.

### 5) Deadline operation
- Da them action:
  - `reschedule` (bat buoc due_at + ly do)
  - `cancel` (bat buoc ly do, co phan quyen)
- Hien trang da co:
  - metadata reschedule/cancel
  - action timeline event tuong ung
  - notifications lien quan
  - bridge customer timeline cho `cancelled` (neu co customer)
- UI `/actions` da co thao tac nhanh:
  - `Done`, `Gia han`, `Huy`
  - ly do chon bang dropdown (han che nhap tay)
  - preset deadline (`end_today`, `+1d`, `+3d`, `+7d`)

### 6) Rule nghiep vu hien hanh
- `done` tu notification/action = xac nhan noi bo da xu ly xong.
- Xac nhan nghiep vu khach hang thuc chat tiep tuc nam o luong workboard/customer care.

### 7) Ghi chu lien ket voi project diary
- Tu `/projects/[id]/diary`, he thong co the tao nhanh:
  - `Tao viec`
  - `Canh bao`
  - `Bao thieu vat tu`
- `Bao thieu vat tu` la 1 loai canh bao van hanh de nhac ra soat va len ke hoach bo sung, khong mac dinh la yeu cau mua hang truc tiep.
- 3 thao tac tren chi duoc tao khi ban ghi nhat ky con nam trong tuan hien tai.
