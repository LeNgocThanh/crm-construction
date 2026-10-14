# PROJECT QA QC HSE PUNCHLIST SPEC

Muc tieu:
- Nghien cuu va chuan hoa luong:
  - nhat ky thi cong
  - QC punch list
  - HSE issue
  - bien ban nghiem thu
- Tranh chong lan voi `project_diary_entries`.
- Van giu duoc mach nghiep vu:
  - bao loi tu nhat ky
  - giao xu ly
  - xac nhan sua
  - nghiem thu lai
  - dong loi

## 1) Nguyen tac goc

Khong tach roi cac lop, ma tach vai tro:

- `Diary` = ghi nhan / bang chung / tin hieu trong ngay
- `Issue / Punch` = ticket loi cu the de xu ly
- `Acceptance` = xac nhan dat / khong dat / dat co dieu kien
- `Timeline` = audit su kien cua du an

Noi ngan gon:
- nhat ky la noi phat hien
- punchlist la noi xu ly
- nghiem thu la noi dong / mo lai theo ket qua

## 2) Ranh gioi voi diary hien tai

App dang co:
- `project_diary_entries`
- `quality_status = ok | issue | blocked`
- `safety_status = ok | warning | incident`
- `metadata_json.issue_resolution`
- `metadata_json.issue_eta`
- media, attendance, material in/out, daily summary

Y nghia de xuat:

### 2.1 Diary khong phai noi quan ly full lifecycle cua tung loi

Diary chi nen giu:
- danh gia tong quan ngay do
- boi canh hien truong
- bang chung anh/video
- tin hieu co van de chat luong / an toan
- danh sach issue duoc tao tu nhat ky do

Diary khong nen tu minh dam nhiem:
- assignee rieng cho tung loi
- reopen tung loi
- verify tung loi
- before/after tung loi
- due date rieng cho tung loi
- map vi tri 2D rieng cho tung loi

### 2.2 Mapping voi status hien tai

- `quality_status = ok`
  - khong co van de chat luong dang can theo doi
- `quality_status = issue`
  - co van de chat luong
  - co the tao 1 hoac nhieu issue/punch tu nhat ky
- `quality_status = blocked`
  - van de chat luong nghiem trong / can tro thi cong
  - nen duoc uu tien tao issue/punch

- `safety_status = ok`
  - binh thuong
- `safety_status = warning`
  - co canh bao an toan
  - co the tao HSE issue
- `safety_status = incident`
  - su co an toan that su
  - nen duoc dua thanh HSE issue rieng

### 2.3 `issue_resolution` va `issue_eta` trong diary giu vai tro gi

2 truong nay van co gia tri:
- mo ta cach xu ly tong quat cua ban ghi ngay do
- ETA tong quat cua su co / nhom van de

Nhung khong nen coi chung la thay the cho:
- workflow cua tung issue
- due date cua tung ticket
- verification cua tung ticket

## 3) Mo hinh nghiep vu de xuat

### 3.1 Lop 1 - Project Diary

Muc dich:
- nhap nhat ky theo ngay / ca
- ghi nhan van hanh thi cong
- tao issue/punch khi can

Lien ket mong muon:
- 1 diary entry co the sinh:
  - 0 issue
  - 1 issue
  - nhieu issue

### 3.2 Lop 2 - Project Site Issues

Khuyen nghi dat ten bang tong quat:
- `project_site_issues`

Khong chi dat ten `punchlist` tu dau, vi ve sau can bao phu:
- quality issue
- safety issue
- housekeeping
- material issue

Truong chinh de xuat:
- `id`
- `project_id`
- `source_diary_entry_id` nullable
- `source_type`:
  - `project_diary`
  - `acceptance`
  - `manual`
- `issue_type`:
  - `quality`
  - `safety`
  - `housekeeping`
  - `material`
  - `other`
- `workflow_type`:
  - `punchlist`
  - `hse_issue`
- `issue_code`
- `title`
- `detail`
- `severity`
- `status`
- `location_text`
- `floor_label`
- `area_label`
- `plan_file_record_id` nullable
- `marker_json` nullable
- `reported_by`
- `assigned_to`
- `assigned_vendor_id` nullable
- `due_at`
- `fixed_at`
- `verified_at`
- `verified_by`
- `closed_at`
- `closed_by`
- `reopened_at`
- `metadata_json`

### 3.3 Lop 3 - Issue Media

Bang de xuat:
- `project_site_issue_media`

Muc dich:
- luu anh/video:
  - truoc khi sua
  - trong qua trinh sua
  - sau khi sua
  - bang chung nghiem thu lai

Truong chinh:
- `issue_id`
- `file_record_id`
- `file_url`
- `file_type`
- `media_role`:
  - `before_fix`
  - `during_fix`
  - `after_fix`
  - `verification`
  - `other`
- `caption`
- `sort_order`

### 3.4 Lop 4 - Issue Events

Bang de xuat:
- `project_site_issue_events`

Muc dich:
- audit workflow cua tung issue

Loai event:
- `created`
- `assigned`
- `reassigned`
- `started`
- `fixed_submitted`
- `verified`
- `reopened`
- `cancelled`
- `commented`
- `due_changed`

### 3.5 Lop 5 - Acceptance Records

Bang de xuat:
- `project_acceptance_records`

Muc dich:
- quan ly bien ban nghiem thu chuyen buoc thi cong

Truong chinh:
- `project_id`
- `milestone_id` nullable
- `acceptance_type`
- `title`
- `scope_text`
- `result`
- `accepted_at`
- `prepared_by`
- `approved_by`
- `document_file_record_id`
- `metadata_json`

Ket qua:
- `pass`
- `pass_with_punch`
- `fail`

### 3.6 Lop 6 - Acceptance <-> Issue links

Bang de xuat:
- `project_acceptance_issue_links`

Muc dich:
- biet bien ban nghiem thu nao sinh / tham chieu issue nao

## 4) Trang thai nghiep vu

### 4.1 Issue status

Khuyen nghi:
- `open`
- `assigned`
- `in_progress`
- `fixed_waiting_verify`
- `verified`
- `reopened`
- `cancelled`

### 4.2 Severity

Khuyen nghi:
- `low`
- `medium`
- `high`
- `critical`

## 5) Lien ket giua diary va issue

Day la phan quan trong nhat de tranh chong lan.

### 5.1 Diary la nguon phat sinh

Tu 1 diary entry:
- user co the khong tao issue nao
- hoac tao 1 issue
- hoac tao nhieu issue

Vi du:
- nhat ky ngay 12/8 co `quality_status=issue`
- nhung thuc te co 3 loi rieng
- diary do tao ra 3 issue/punch item

### 5.2 Issue song doc lap nhung quy chieu nguoc ve diary

Moi issue co:
- `source_diary_entry_id`

Nghia la:
- issue sinh ra tu nhat ky nao
- nhung sau do co workflow rieng

### 5.3 Trong UI diary phai nhin thay issue lien quan

Trong detail diary nen co block:
- `Issue / Punch tu nhat ky nay`

Hien thi:
- `issue_code`
- `title`
- `issue_type`
- `status`
- `severity`
- `assigned_to`
- `due_at`

Co summary:
- tong issue
- dang mo
- cho nghiem thu
- da verify

## 6) Lien ket giua acceptance va issue

### 6.1 Nghiem thu co the tao issue

Neu bien ban co ket qua:
- `pass_with_punch`
- `fail`

thi co the sinh issue tuong ung.

### 6.2 Nghiem thu co the dong issue

Neu issue dang o:
- `fixed_waiting_verify`

thi mot bien ban nghiem thu lai co the:
- chuyen sang `verified`
- hoac `reopened`

### 6.3 Khong de acceptance thay issue engine

Acceptance la lop xac nhan.
Issue van la noi giu workflow chinh.

## 7) Notification va timeline

### 7.1 Notification nen co

Khi:
- tao issue
- assign issue
- due sap den / qua han
- submit da sua xong
- verify
- reopen
- tao bien ban nghiem thu fail / pass_with_punch

### 7.2 Project timeline nen ghi

Nen co event:
- `project_issue_created`
- `project_issue_assigned`
- `project_issue_fixed_submitted`
- `project_issue_verified`
- `project_issue_reopened`
- `project_acceptance_created`
- `project_acceptance_result_changed`

Diary timeline / diary detail:
- hien thi cac issue duoc tao tu diary
- co the hien latest status cua chung

## 8) Vi tri loi tren mat bang 2D

De tranh phinh qua som:

### Phase A
- `location_text`
- `floor_label`
- `area_label`
- `plan_file_record_id`
- `marker_json` don gian:
  - `x`
  - `y`
  - `label`
  - `note`

### Phase B
- click len anh mat bang 2D de dat marker
- filter issue theo tang / khu vuc

### Phase C
- gan marker vao semantic room/block cua designer 2D

## 9) UI de xuat

### 9.1 `/projects/[id]/diary`
- giu diary la noi nhap va xem nhat ky
- them block:
  - issue / punch tu nhat ky nay
- them nut:
  - `Tao loi QC`
  - `Tao loi an toan`

### 9.2 `/projects/[id]/issues`
- list toan bo issue cua du an
- filter theo:
  - status
  - severity
  - issue_type
  - assigned_to
  - source diary
  - overdue

### 9.3 `/projects/[id]/issues/[issueId]`
- detail issue
- before / after media
- event history
- assign / reassign
- submit da sua
- verify / reopen

### 9.4 `/projects/[id]/acceptance`
- list bien ban nghiem thu
- tao bien ban
- link issue lien quan

## 10) Quy tac chong chong lan

Chot de team dung chung:

- Khong mo rong `project_diary_entries` thanh ticket system
- Khong dung 1 diary record de thay the nhieu issue rieng
- Khong dua full workflow verify/reopen vao ngay diary
- Co lien ket 2 chieu:
  - diary -> issue
  - issue -> diary

## 11) Roadmap de xuat

### Phase A
- `project_site_issues`
- `project_site_issue_media`
- `project_site_issue_events`
- tao issue tu diary
- assign / due / status
- notifications
- project timeline
- list/detail issue page

### Phase B
- `project_acceptance_records`
- `project_acceptance_issue_links`
- tao issue tu acceptance
- verify / reopen issue tu nghiem thu lai

### Phase C
- marker tren mat bang 2D
- filter theo tang / khu vuc / mat bang
- dashboard QC/HSE

## 11.1) Phase A schema cu the

Muc tieu:
- Du ro de implement Prisma + API ngay.
- Chua nhay vao marker 2D phuc tap hay acceptance workflow day du.

### A. `project_site_issues`

Bang nay la bang trung tam.

Truong de xuat:
- `id`
  - `String @id @default(uuid())`
- `project_id`
  - bat buoc
- `source_diary_entry_id`
  - nullable
  - neu issue tao tu nhat ky thi gan vao day
- `source_type`
  - `String`
  - gia tri phase A:
    - `project_diary`
    - `manual`
- `issue_code`
  - `String @unique`
  - de in/an/tra cuu
- `issue_type`
  - `String`
  - phase A:
    - `quality`
    - `safety`
    - `other`
- `workflow_type`
  - `String`
  - phase A:
    - `punchlist`
    - `hse_issue`
- `title`
  - `String`
- `detail`
  - `String? @db.Text`
- `severity`
  - `String`
  - phase A:
    - `low`
    - `medium`
    - `high`
    - `critical`
- `status`
  - `String`
  - phase A:
    - `open`
    - `assigned`
    - `in_progress`
    - `fixed_waiting_verify`
    - `verified`
    - `reopened`
    - `cancelled`
- `location_text`
  - `String?`
- `floor_label`
  - `String?`
- `area_label`
  - `String?`
- `plan_file_record_id`
  - `String?`
- `marker_json`
  - `Json?`
  - phase A cho phep de san, chua can UI phuc tap
- `reported_by`
  - `String?`
- `assigned_to`
  - `String?`
- `due_at`
  - `DateTime?`
- `fixed_at`
  - `DateTime?`
- `verified_at`
  - `DateTime?`
- `verified_by`
  - `String?`
- `cancelled_at`
  - `DateTime?`
- `cancelled_by`
  - `String?`
- `metadata_json`
  - `Json?`
- `created_at`
  - `DateTime @default(now())`
- `updated_at`
  - `DateTime @updatedAt`

Relation de xuat:
- `project -> ConstructionProject`
- `source_diary_entry -> ProjectDiaryEntry?`
- `assignee -> User?`
- `reporter -> User?`
- `verifier -> User?`
- `canceller -> User?`
- `plan_file_record -> FileRecord?`
- `media[] -> ProjectSiteIssueMedia`
- `events[] -> ProjectSiteIssueEvent`

Index nen co:
- `[project_id, status, due_at]`
- `[project_id, issue_type, status]`
- `[project_id, source_diary_entry_id]`
- `[assigned_to, status, due_at]`
- `[project_id, created_at]`

### B. `project_site_issue_media`

Muc dich:
- luu before/after media cua tung issue

Truong de xuat:
- `id`
- `issue_id`
- `file_record_id`
- `file_url`
- `file_type`
  - `image | video | file`
- `media_role`
  - phase A:
    - `before_fix`
    - `after_fix`
    - `verification`
    - `other`
- `caption`
- `sort_order`
- `metadata_json`
- `created_at`
- `updated_at`

Relation:
- `issue -> ProjectSiteIssue`
- `file_record -> FileRecord?`

Index:
- `[issue_id, sort_order]`
- `[file_record_id]`

### C. `project_site_issue_events`

Muc dich:
- audit trail cua issue

Truong de xuat:
- `id`
- `issue_id`
- `event_key`
  - phase A:
    - `created`
    - `assigned`
    - `reassigned`
    - `started`
    - `fixed_submitted`
    - `verified`
    - `reopened`
    - `cancelled`
    - `commented`
    - `due_changed`
- `title`
- `detail`
- `actor_user_id`
- `payload_json`
- `created_at`

Relation:
- `issue -> ProjectSiteIssue`
- `actor -> User?`

Index:
- `[issue_id, created_at]`
- `[actor_user_id, created_at]`

### D. Ma code issue

Khuyen nghi format:
- `PLI-YYYYMMDD-xxxx` cho punchlist quality
- `HSI-YYYYMMDD-xxxx` cho HSE issue

Phase A co the dung helper generate ma theo:
- `workflow_type`
- ngay tao
- sequence ngau nhien ngan

Khong can seed bang sequence rieng ngay tu dau.

## 11.2) Phase A API contract de xuat

### `GET /api/projects/:id/site-issues`

Muc dich:
- list issue theo du an

Query phase A:
- `page`
- `pageSize`
- `status`
- `issue_type`
- `workflow_type`
- `severity`
- `assigned_to`
- `source_diary_entry_id`
- `overdue=1|0`

Response:
- `data`
- `pagination`
- co them `summary` neu can:
  - `open_count`
  - `overdue_count`
  - `verified_count`

### `POST /api/projects/:id/site-issues`

Muc dich:
- tao issue thu cong hoac tao tu diary

Input toi thieu:
- `title`
- `issue_type`
- `workflow_type`

Input thuong gap:
- `detail`
- `severity`
- `location_text`
- `floor_label`
- `area_label`
- `assigned_to`
- `due_at`
- `source_diary_entry_id`
- `media[]`

Rule:
- neu co `source_diary_entry_id` thi diary phai thuoc dung du an
- neu `issue_type=quality` thi default `workflow_type=punchlist`
- neu `issue_type=safety` thi default `workflow_type=hse_issue`

### `GET /api/projects/:id/site-issues/:issueId`
- lay detail issue
- kem media
- kem events

### `PATCH /api/projects/:id/site-issues/:issueId`

Cho phep sua:
- noi dung co ban
- assignee
- due_at
- status
- media them moi

Rule chuyen status phase A:
- `open -> assigned | in_progress | cancelled`
- `assigned -> in_progress | cancelled`
- `in_progress -> fixed_waiting_verify | cancelled`
- `fixed_waiting_verify -> verified | reopened`
- `reopened -> assigned | in_progress | cancelled`
- `verified` khoa workflow, chi co the mo lai bang `reopened`

### `POST /api/projects/:id/site-issues/:issueId/actions`

Neu muon tach action ro hon, co the dung route action:
- `assign`
- `start`
- `submit_fix`
- `verify`
- `reopen`
- `cancel`
- `comment`

Phase A co the chon 1 trong 2 huong:
- patch status truc tiep
- hoac action endpoint ro nghiep vu

Khuyen nghi:
- list/detail dung `GET`
- create dung `POST`
- update field dung `PATCH`
- action workflow dung `POST .../actions`

## 11.3) Phase A UI scope de xuat

Trang toi thieu:

### `/projects/[id]/site-issues`
- list issue
- filter co ban
- tao issue moi
- badge theo:
  - issue_type
  - severity
  - status
- quick action:
  - assign
  - bat dau
  - bao da sua xong
  - verify
  - reopen

### `/projects/[id]/site-issues/[issueId]`
- detail issue
- before / after media
- event history
- thong tin source diary

### Trong `/projects/[id]/diary`
- moi row diary co them:
  - danh sach issue duoc tao tu row do
  - nut:
    - `Tao loi QC`
    - `Tao loi an toan`
- co summary:
  - tong issue
  - dang mo
  - da verify

## 11.4) Phase A automation can co

### Notification
- khi tao issue va co `assigned_to`
- khi doi `assigned_to`
- khi issue qua han
- khi submit da sua xong
- khi verify
- khi reopen

### Timeline
- project timeline:
  - `project_issue_created`
  - `project_issue_assigned`
  - `project_issue_fixed_submitted`
  - `project_issue_verified`
  - `project_issue_reopened`

### Diary bridge
- diary detail/list co the hien:
  - so issue lien quan
  - latest status

Khong nen:
- push full event history cua issue vao diary text
- bien diary thanh ticket log

## 11.5) Nhung gi chua lam trong Phase A

Chua can dua vao phase A:
- marker 2D thao tac that tren mat bang
- acceptance workflow day du
- issue checklist theo loai nghiem thu
- nha thau phu / vendor workflow phuc tap
- SLA / escalation theo issue

## 12) Ket luan

Huong dung:
- diary van la goc ghi nhan va boi canh
- issue/punch la ticket xu ly cu the
- acceptance la lop xac nhan chuyen buoc / dong mo lai theo ket qua

Nhu vay:
- khong thua nghiep vu
- khong chong lan voi diary hien tai
- van giu duoc toan bo qua trinh xu ly loi nam trong dong chay nhat ky cua du an
