# Asset Module Guide (Tai san / Thiet bi)

## 1) Muc tieu
- Quan ly tai san/thiet bi dung trong quy trinh CSKH + thi cong.
- Biet tai san dang o dau, ai dang giu, dang phuc vu khach/project nao.
- Luu lich su ban giao/thu hoi de truy vet va lam KPI van hanh.

## 2) Pham vi Phase 1
- Co so du lieu:
  - `assets`
  - `asset_assignments`
  - `units`
  - `asset_types`
  - `asset_lifecycle_events`
  - `asset_action_types`
- API:
  - `GET/POST /api/assets`
  - `GET/PATCH/DELETE /api/assets/:id`
  - `GET/POST /api/assets/:id/assignments`
  - `PATCH /api/assets/assignments/:assignmentId` (action: `return` | `cancel`)
  - `GET /api/assets/assignments`
  - `GET/POST /api/settings/units`
  - `PATCH/DELETE /api/settings/units/:id`
  - `GET/POST /api/settings/asset-types`
  - `PATCH/DELETE /api/settings/asset-types/:id`
  - `GET/POST /api/settings/asset-action-types`
  - `PATCH/DELETE /api/settings/asset-action-types/:id`
  - `GET /api/assets/:id/lifecycle`
  - `POST /api/assets/:id/actions`
  - `GET /api/assets/lifecycle-by-user` (timeline van hanh theo user + role)
- UI:
  - Trang `/assets`
  - Trang `/assets/operations` cho luong van hanh (filter + action + timeline)
  - Trang `/assets/reports` cho bao cao tai san
  - Tao/sua tai san tren 1 form hop nhat (chon "Sua" se nap du lieu vao form tao)
  - Chon tai san + gan cho user/customer/project
  - Thu hoi tai san
  - Xem lich su ban giao theo tai san
  - Xem timeline van hanh theo user (actor/giao/nhan)
  - Trang `/settings/units` de chuan hoa don vi tinh
  - Trang `/settings/asset-types` de quan ly loai tai san + don vi mac dinh
  - Trang `/settings/asset-action-types` de quan ly action nghiep vu DB-driven

## 3) Nguyen tac nghiep vu
- 1 tai san co the khong gan customer/project (dung noi bo).
- Ban giao tao 1 dong lich su trong `asset_assignments`.
- Khi ban giao:
  - `assets.status` -> `in_use`
  - `current_holder_user_id/current_customer_id/current_project_id` duoc cap nhat.
- Khi thu hoi:
  - assignment -> `returned`
  - neu khong con assignment mo: asset -> `available`, clear current holder/customer/project.
- Khong cho xoa tai san neu con assignment `assigned|overdue`.

## 4) Anh huong den Customer / Project
- **Customer**:
  - Co lien ket tai san dang dung (`assets.current_customer_id`).
  - Co lich su assignment lien quan (`asset_assignments.customer_id`).
- **ConstructionProject**:
  - Co lien ket tai san dang dung (`assets.current_project_id`).
  - Co lich su assignment lien quan (`asset_assignments.project_id`).
- Khong thay doi logic cu cua customer pipeline/workboard.

## 5) Quyen truy cap
- Xem: user da dang nhap.
- Tao/sua/xoa/gan/thu hoi: `admin | manager`.

## 6) Du lieu chinh
- `units.category_key`: `count | length | area | volume | mass | other`
- `assets.status`: `available | in_use | maintenance | retired | lost`
- `assets.condition_status`: `good | fair | poor | broken`
- `asset_assignments.status`: `assigned | returned | cancelled | overdue`
- `asset_lifecycle_events.event_key`: `created | updated | assigned | returned | maintenance | warranty_updated | retired`
- `asset_action_types`: master data action co cac co `requires_*` de dieu huong validate nghiep vu
  - Luu y: bo `required_fields_json`, runtime chi dung cac co `requires_*` + `apply_owner_transfer`.

## 6.3) Action event schema (report-ready)
- `POST /api/assets/:id/actions` tu dong tao `description` day du de doc nhanh:
  - action name + asset name
  - holder truoc/sau
  - status truoc/sau
  - qty/context/note neu co
- `metadata_json` duoc chuan hoa de dung bao cao:
  - `schema_version`
  - `action`, `asset`, `actor`, `context`, `inputs`
  - `before`, `after`, `changes`
  - `participants`: danh sach user co role ro rang (`actor`, `handover_from`, `handover_to`) kem `username`
  - `search`: `participant_user_ids`, `participant_usernames`, `primary_user_id`, `primary_username`
  - `handover_document`: du lieu bien ban de in nhanh (thoi diem, nguoi giao/nhan, trang thai truoc/sau, so luong, tinh trang, phu kien)
  - `inputs.accessories_handover`, `inputs.condition_note`: luu thong tin thuc te khi ban giao/thu hoi

## 6.5) Phu kien di kem + Bien ban
- Ho so tai san:
  - Form `/assets` co truong `Phu kien mac dinh` (chuoi, phan tach boi dau phay).
  - Du lieu luu vao `assets.metadata_json.accessories_default`.
- Luong action `/assets/operations`:
  - Co truong `Phu kien ban giao` + `Tinh trang khi ban giao/thu hoi`.
  - Mac dinh tu do tu `accessories_default` cua tai san de thao tac nhanh.
  - Khi luu action, he thong dong goi du lieu bien ban vao `metadata_json.handover_document`.
- Timeline:
  - Event co `handover_document` hien nut `In bien ban` de mo popup in/PDF.

## 6.4) Bao cao theo user
- API: `GET /api/assets/lifecycle-by-user`
  - Query:
    - `user_id` (bat buoc)
    - `role=all|actor|handover_from|handover_to`
    - `from`, `to`, `limit`
  - Output:
    - danh sach event da filter
    - `summary` gom `total`, `actor_count`, `handover_from_count`, `handover_to_count`
- UI `/assets/reports`:
  - block "AI DANG GIU TAI SAN"
  - block "DANH SACH TAI SAN TONG QUAN"
  - block "TIMELINE VAN HANH THEO NGUOI"

## 6.1) Chuan hoa don vi
- Bang `units` la nguon don vi dung chung.
- `assets.unit_id` uu tien su dung de map don vi chuan.
- `assets.unit_text` la fallback cho du lieu cu/import dac biet.

## 6.2) Ho so tai san (bo sung)
- Thuoc tinh ky thuat: `brand`, `model`, `manufacturer`, `origin_country`
- Chung tu chat luong: `co_number`, `cq_number`, `doc_urls_json`
- Nguon nhap: `acquisition_method`, `acquisition_note`
- Bao hanh: `warranty_months`, `warranty_start_date`, `warranty_end_date`, `warranty_provider`, `warranty_terms`
- Khau hao: `depreciation_method`, `depreciation_months`, `depreciation_start_date`, `salvage_value`
- Vong doi: `commissioned_at`, `retired_at`, va log theo `asset_lifecycle_events`

## 7) Huong mo rong Phase 2
- Bao tri tai san (lich bao tri + nhac viec tu dong).
- Tu dong danh dau overdue theo `expected_return_at`.
- Tao `work_suggestion` khi qua han tra tai san.
- Dashboards: tai san ranh, tai san qua han, tan suat su dung.
