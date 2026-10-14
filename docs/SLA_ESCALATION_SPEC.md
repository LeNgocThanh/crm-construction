# SLA & Escalation Spec (Actions/CRM)

## 1) Muc tieu
- Giam bo sot cong viec va xu ly tre han.
- Chuan hoa canh bao theo muc do quan trong.
- Escalate dung nguoi dung luc (assignee -> owner/manager/group lead).
- Khong pha logic hien tai cua actions/notifications/timeline.
- Khong hardcode so muc escalation trong code.

## 2) Scope phase 1
- Ap dung cho `work_suggestions` (actions) co status open:
  - `pending | accepted | assigned`.
- Khong ap dung cho:
  - `done | cancelled | rejected`.
- Chi lam SLA theo thoi gian + escalation notifications.
- Chua lam scoring/KPI nang cao.

## 3) Dinh nghia nghiep vu

### 3.1 SLA target
- Moi action co `sla_due_at` de danh gia cam ket xu ly.
- Neu action co `due_at` thi uu tien dung `due_at` lam SLA.
- Neu khong co `due_at` thi tinh theo policy (`target_minutes`).

### 3.2 Qua han
- Qua han khi:
  - status in (`pending`,`accepted`,`assigned`)
  - va `now > effective_due_at` (`due_at` hoac `sla_due_at`).

### 3.3 Escalation levels (DB-driven)
- Khong dung L0-L3 hardcode.
- Muc escalation la cac dong du lieu trong DB (`sla_policy_levels`), co `sort_order` va dieu kien trigger rieng.
- Co the cau hinh 2 muc, 4 muc, 6 muc ma khong sua code.

## 4) Du lieu can co

### 4.1 Bang hien tai: `work_suggestions`
Can them field:
- `sla_due_at DateTime?`
- `sla_policy_key String?`
- `current_sla_level_key String?` (muc hien tai, vd `warning`, `overdue_1h`, `critical_1d`)
- `escalated_at DateTime?`
- `last_escalation_notified_at DateTime?`
- `next_escalation_check_at DateTime?`

### 4.2 Bang moi: `sla_policies`
- `id`
- `policy_key` unique (vd: `default_normal`, `construction_pre_sale_high`)
- `name`
- `is_active`
- `priority` (de chon policy khi overlap)
- `match_json` (dieu kien match: source_ref_type, pipeline_phase, customer_type, group...)
- `target_minutes` (SLA target)
- `created_at`, `updated_at`

### 4.3 Bang moi: `sla_policy_levels`
- `id`
- `policy_id`
- `level_key` (vd: `warning`, `overdue`, `critical`)
- `level_name`
- `sort_order`
- `trigger_type` (`before_due` | `after_due`)
- `trigger_minutes` (moc kich hoat theo phut)
- `cooldown_minutes`
- `notify_type` (vd: `sla_warning`, `sla_overdue`, `sla_escalated`)
- `notify_targets_json` (assignee/assigner/manager/group/users)
- `is_active`
- `created_at`, `updated_at`

### 4.4 Bang moi: `sla_escalation_logs`
- `id`
- `work_suggestion_id`
- `policy_key`
- `from_level_key`
- `to_level_key`
- `reason`
- `snapshot_json`
- `created_at`
- `triggered_by` (`system`/user id)

## 5) Rule tinh SLA

### 5.1 Chon effective due
1. Neu `due_at` co gia tri -> `effective_due_at = due_at`
2. Neu khong ->
   - lay `sla_policy` match tot nhat
   - `sla_due_at = created_at + target_minutes`
   - `effective_due_at = sla_due_at`

### 5.2 Rule level (generic)
- `delta = effective_due_at - now` (phut)
- Duyet danh sach `sla_policy_levels` (sort by `sort_order`).
- Match level:
  - `trigger_type=before_due`: active neu `0 < delta <= trigger_minutes`
  - `trigger_type=after_due`: active neu `delta <= -trigger_minutes`
- Neu khong khop level nao -> xem la `on_track` (virtual state, khong can row DB).

### 5.3 De-dup notify
- Chi notify khi level thay doi (`to_level_key != from_level_key`) hoac qua cooldown cua level moi.
- Dung `last_escalation_notified_at` + `cooldown_minutes`.

## 6) Nguoi nhan escalation

### 6.1 Mac dinh
- Neu `notify_targets_json` rong, fallback:
  - assignee + recipients.

### 6.2 Override theo level
- `notify_targets_json` trong `sla_policy_levels` la nguon cau hinh chinh.
- Ho tro:
  - `assignee`
  - `assigned_by`
  - `customer_owner`
  - `managers`
  - `group:<group_key>`
  - `users:[id1,id2]`

## 7) Notification contract
- Tao `user_notifications` theo `notify_type` cua level.
- `source_type = work_suggestion`
- `source_id = work_suggestion.id`
- metadata gom:
  - `policy_key`
  - `level_key`
  - `effective_due_at`
  - `minutes_to_due` hoac `minutes_overdue`

## 8) Action Timeline / Customer Timeline mapping

### 8.1 Action Timeline
- Luon ghi event khi doi level:
  - `event_key = sla_level_changed`
- metadata event:
  - `from_level_key`, `to_level_key`, `policy_key`, `effective_due_at`.

### 8.2 Customer Timeline
- Khong push mac dinh (noi bo van hanh).
- Chi push neu business muon visible voi khach (phase sau).

## 9) Scheduler & job

### 9.1 Job de xuat
- Route cron/noi bo: `POST /api/jobs/sla/escalate`
- Chay moi 5 phut (phase 1 co the 10 phut).

### 9.2 Luong job
1. Query actions open co due/sla_due.
2. Resolve policy + effective due.
3. Load levels theo policy.
4. Tinh `to_level_key`.
5. Neu level doi:
   - update `work_suggestions.current_sla_level_key` + fields lien quan
   - ghi `sla_escalation_logs`
   - ghi `action_timeline_events`
   - tao `user_notifications` theo level
6. Cap nhat `next_escalation_check_at`.

### 9.3 Bao ve hieu nang
- Batch size (vd 300-500 row/job).
- Co index:
  - `(status, due_at)`
  - `(status, sla_due_at)`
  - `(next_escalation_check_at, status)`
  - `(current_sla_level_key, status)`

## 10) UI can co (phase 1.5)
- Actions list:
  - badge SLA level (`level_name` tu DB)
  - hien phut con lai / qua han.
- Filter nhanh:
  - `sap den han`
  - `qua han`
  - `escalated`.
- Notification panel:
  - nhom rieng SLA alerts.

## 11) Phan quyen
- Sales:
  - xem SLA cua viec lien quan minh.
- Manager/Admin:
  - xem tat ca + thay doi policy/levels.
- Policy CRUD:
  - manager/admin.

## 12) Observability
- Log counters moi run:
  - `checked_count`
  - `level_changed_count`
  - `notifications_sent_count`
  - `errors_count`
- Co endpoint health job:
  - lan chay cuoi, so item xu ly cuoi.

## 13) Rollout de an toan

### Phase A
- Them schema fields + tables + helper service SLA (policy + levels).
- Chua bat notify.

### Phase B
- Bat job tinh level, chi ghi action timeline (silent mode).

### Phase C
- Bat notifications SLA cho 1 nhom user pilot.

### Phase D
- Rollout full + UI filter/badge + UI policy-level editor.

## 14) Tinh huong dac biet
- Action noi bo (`customer_id = null`): van ap SLA binh thuong.
- Action khong due_at: duoc cap `sla_due_at` tu policy.
- Reschedule: recalc SLA + co the reset level theo due moi.
- Cancel/Done: dong SLA tracking ngay.

## 15) API de can bo sung
- `GET /api/settings/sla-policies`
- `POST /api/settings/sla-policies`
- `PATCH /api/settings/sla-policies/:id`
- `GET /api/settings/sla-policies/:id/levels`
- `POST /api/settings/sla-policies/:id/levels`
- `PATCH /api/settings/sla-policy-levels/:levelId`
- `POST /api/jobs/sla/escalate`
- (optional) `GET /api/actions/sla-summary`

## 16) Acceptance criteria (phase 1)
- Co policy mac dinh cho 4 priority.
- Moi policy co level config DB-driven (khong hardcode levels trong code).
- Co job tinh dung `current_sla_level_key` theo levels.
- Co escalation notification dung nguoi theo `notify_targets_json`.
- Co action timeline event khi doi level.
- Khong spam notify (co cooldown/de-dup).
- Khong anh huong luong done/cancel/reschedule hien tai.
