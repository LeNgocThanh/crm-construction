# Notification Policy Matrix (De Xuat Mo Rong)

## Muc tieu
Xay dung co che thong bao theo ma tran, dung chung cho nhieu module (Projects, Customers, Inventory, Assets, Work Suggestions...), tranh hardcode tung API.

## Khai niem
Moi dong policy gom 4 truong chinh:

1. `event_key`
- Dinh danh su kien nghiep vu
- Vi du: `project_owner_changed`, `project_status_updated`, `payment_created`

2. `recipients`
- Nhom nguoi nhan theo vai tro/ngu canh
- Vi du:
  - `project_owner_current`
  - `project_owner_previous`
  - `customer_assignee`
  - `managers`
  - `finance_team`

3. `throttle`
- Co che chong spam/thong bao trung
- Vi du:
  - `none`
  - `dedupe_10m`
  - `digest_1h`

4. `priority`
- Muc do uu tien thong bao
- `low | normal | high | urgent`

## De xuat policy cho Project Timeline (tham khao)

### project_owner_changed
- recipients: `project_owner_previous`, `project_owner_current`, `managers`
- throttle: `none`
- priority: `high`

### project_status_updated
- recipients: `project_owner_current`, `customer_assignee`, `managers`
- throttle: `dedupe_10m`
- priority: `high`
- Ghi chu: neu status vao `paused/cancelled` thi co the nang len `urgent`

### milestone_created / milestone_updated / milestone_deleted
- recipients: `project_owner_current`, `managers`
- throttle: `dedupe_10m`
- priority: `normal`

### payment_plan_created / payment_plan_updated
- recipients: `project_owner_current`, `finance_team`, `managers`
- throttle: `dedupe_10m`
- priority: `high`

### payment_created / payment_deleted
- recipients: `project_owner_current`, `finance_team`, `managers`
- throttle: `none`
- priority: `high`

### project_document_created
- Neu `document_scope=investor_visible`:
  - recipients: `project_owner_current`, `customer_assignee`
  - priority: `normal`
- Neu `document_scope=internal`:
  - recipients: `project_owner_current`
  - priority: `low/normal`

### resource_plan_created / resource_plan_updated
- recipients: `project_owner_current`, `managers`
- throttle: `dedupe_10m`
- priority: `normal`

### resource_item_created / resource_item_updated / resource_item_deleted
- recipients: `project_owner_current`
- throttle: `digest_1h`
- priority: `normal`
- Ghi chu: uu tien gom thong bao theo dot de tranh spam

## Nguyen tac van hanh
1. Chi gui thong bao khi co "hanh dong tiep theo" hoac thay doi nghiep vu quan trong.
2. Khong gui thong bao cho cac thay doi nho (note text, sua mo ta khong quan trong).
3. Throttle theo fingerprint de loai thong bao trung.
4. Co the tach luong thong bao realtime va digest.

## Fingerprint de dedupe
Khuyen nghi:
- `event_key + module_id + source_ref_id + recipient_bucket`

Vi du:
- `project_status_updated|project_123|status_change_abc|owner_current`

## Mo rong lien module
Cung model nay co the dung cho:
- Customers timeline
- Work suggestions/actions
- Inventory transactions
- Asset lifecycle
- SLA escalations

## De xuat trien khai theo phase

### Phase 1 (khong UI)
- Them bang policy + rule engine resolve recipients/throttle/priority
- Hook vao cac diem ghi timeline chinh

### Phase 2
- Them digest job (theo 1h/1 ngay)
- Them bao cao hieu qua thong bao (duoc doc, duoc xu ly)

### Phase 3
- Them UI quan ly policy cho admin/manager
- Cho phep bat/tat tung policy, doi throttle, doi recipients

## Trang thai hien tai
- Day la tai lieu de quy hoach.
- Chua kich hoat policy engine tong quat tren he thong.

## Bo sung quy uoc `is_official` (quan trong)

### Ket luan
- `is_official` nen dat o **muc event** (vd: `ProjectTimelineEvent`), khong dat o `ConstructionProject` de thay the.
- Ly do: trong cung 1 project co the ton tai ca event noi bo (nhap) va event chinh thuc.

### Vi sao khong chi dua vao `project.status`
- `status` la trang thai tong quan cua du an.
- Noti/timeline can quyet dinh theo tung su kien cu the.
- Co event can gui thong bao du project chua confirmed (vd: chia se tai lieu cho khach).

### Quy tac de xuat
1. Moi event co `is_official` (hoac tam thoi `metadata_json.is_official`).
2. Notification engine mac dinh bo qua event `is_official=false`.
3. Chi gui noti cho event `is_official=true`, tru khi co policy override ro rang.

### Giai doan hien tai
- Logic draft/chinh thuc cua he thong chua hoan chinh, se con thay doi.
- Vi vay quy uoc `is_official` duoc luu nhu guideline de ap dung khi bat dau chuan hoa event bus/noti engine.
