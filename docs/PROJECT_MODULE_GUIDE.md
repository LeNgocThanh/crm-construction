# PROJECT MODULE GUIDE

Muc tieu:
- Gom cac quy uoc van hanh chinh cua module du an vao 1 diem doc.
- Giam viec tach manh docs theo tung phase nho.
- Giup team tra cuu nhanh cac lop:
  - investor view
  - tai lieu du an
  - lien ket ke hoach vat tu voi mua truc tiep
  - truc dieu hanh `status -> stage -> milestone -> active plan`

Cap nhat moi:
- Nhanh `labor` da duoc siet theo `active_labor_plan_id` tuong tu nhanh `material`.
- `ProjectLaborEngagement` da co `plan_id` de phan cong nhan cong bam vao ke hoach nhan cong dang van hanh.
- Bao cao thuc te nhan cong theo plan chi tinh attendance co `engagement.plan_id` trung ke hoach do, khong tron ca du an nua.

- /projects/[id]/diary da co gallery viewer full-screen cho anh/video nhat ky:
  - click thumbnail mo viewer noi bo
  - next / back / close
  - click ra ngoai de dong
  - hotkey ArrowLeft, ArrowRight, Escape
- Danh sach nhat ky da chuyen sang phan trang that:
  - page
  - pageSize
  - chon 10 / 20 / 30 ban ghi / trang
  - giu trang thai tren URL
- Danh sach nhat ky da co bo loc co ban:
  - tu ngay / den ngay
  - ca lam
  - chat luong
  - an toan
  - muc hien thi cong khai chu dau tu / noi bo
- Cac thao tac nhanh Tao viec / Canh bao / Bao thieu vat tu chi cho tao trong tuan hien tai cua nhat ky.

Doc nen doc kem:
- `PROJECT_EXECUTION_AXIS_SPEC.md`
- Tai lieu nay mo ta ro vai tro va rang buoc giua:
  - `status`
  - `stage`
  - `milestone`
  - `active material/labor plan`

## 1) Investor view va read-model du an

### Muc tieu
- Tao read-model de nhin du an theo goc chu dau tu.
- Giai doan dau uu tien read-only, sau do bo sung CRUD noi bo tung phan.

### Schema chinh da co
1. `project_milestone_statuses`
- Danh muc trang thai moc tien do.
- Key mac dinh: `pending`, `in_progress`, `completed`, `blocked`, `cancelled`.

2. `project_milestones`
- Moc tien do theo du an.
- Co `status_key`, `due_date`, `completed_at`, `sort_order`.

3. `project_estimate_links`
- Lien ket du an <-> `estimation_quotes`.
- Co the danh dau ban estimate dang active.

4. `project_payment_plans`
- Ke hoach thanh toan theo dot.
- Co `amount`, `plan_percent`, `due_date`, `status`.

5. `project_payments`
- Giao dich thu thuc te theo du an.
- Co lien ket optional den `payment_plan_id`.

6. `project_documents`
- Kho tai lieu chung cua du an.
- Dung `document_scope`, `document_type`, `access_level` de phan loai.

### Seed va lenh can chay
- Script: `scripts/seed-project-milestone-statuses.ts`
- NPM script: `npm run seed:project-milestones`

Sau khi keo code:
1. `npx prisma db push`
2. `npx prisma generate`
3. `npm run seed:project-milestones`

Luu y Prisma local:
- Khong generate Prisma client bang `--no-engine` trong local PostgreSQL flow.
- Neu login loi `the URL must start with the protocol prisma://`, can generate lai bang `npx prisma generate`.

### API read-model cho investor
- `GET /api/projects/:id/investor-view`

Output gom:
1. `overview`
2. `estimates`
   - `active`
   - `history`
3. `milestones`
4. `payments`
   - `plans`
   - `transactions`
   - `summary`
   - `next_due`
5. `documents`
   - chi lay `document_scope=investor_visible`

### UI
- Trang: `/projects/[id]/investor`
- Hien thi:
  - tong quan du an
  - du toan hien tai + lich su lien ket
  - tien do moc
  - thanh toan / cong no
  - tai lieu gui chu dau tu

### Mo rong noi bo da co
- CRUD nhanh cho:
  - milestones
  - payment plans
  - payments
  - project documents

API da co:
- `GET/POST /api/projects/:id/milestones`
- `PATCH/DELETE /api/projects/:id/milestones/:milestoneId`
- `GET/POST /api/projects/:id/payment-plans`
- `PATCH/DELETE /api/projects/:id/payment-plans/:planId`
- `GET/POST /api/projects/:id/payments`
- `PATCH/DELETE /api/projects/:id/payments/:paymentId`

### Dong bo payment plan
- Khi tao/sua/xoa `project_payments`, he thong tu dong sync `project_payment_plans.status`:
  - `planned`
  - `partially_paid`
  - `paid`
  - `overdue`
- `cancelled` duoc giu nguyen, khong auto doi.

### Automation khi tao du an
Khi `POST /api/projects` tao du an:
- tao timeline cho customer:
  - `type=project_created`
- dong bo mot so field sang customer neu customer chua co:
  - `house_type`
  - `floors`
  - `floor_area`
  - `budget_max`

## 1.1) Truc van hanh va nhánh labor

### Nguyen tac hien tai
- `active material plan` dieu khien nhánh kho / vật tư / mua trực tiếp.
- `active labor plan` dieu khien nhánh phân công nhân công / thực tế nhân công.

### Rang buoc moi cho labor
- `ProjectLaborEngagement.plan_id` la diem neo cua phan cong nhan cong vao 1 ke hoach nhan cong cu the.
- Neu du an da co `active_labor_plan_id`:
  - tao/sua phan cong qua `/api/labor/engagements` se bi ep ve plan dang van hanh
  - neu co gui `plan_id` khac plan dang van hanh thi API tra `409`
- Plan nhan cong duoc gan phan cong phai:
  - thuoc dung du an
  - `is_active=true`
  - `status in (approved, locked)`
  - co item `resource_kind=labor`

### He qua nghiep vu
- Attendance tay hoac attendance tu nhat ky, khi da gan `engagement_id`, se ke thua ve dung plan nhan cong do.
- Actual summary cua 1 labor plan chi tong hop attendance co `engagement.plan_id = plan.id`.
- Vi vay so lieu du/thieu/thua nhan cong theo plan khong con bi “tron” voi cac phan cong ngoai plan do.

## 2) Tai lieu du an (`project_documents`)

### Nguyen tac
- `project_documents` la kho tai lieu chung cua du an.
- Khong tach rieng bang "gui khach" va "noi bo".
- Phan loai bang 3 truong:
  - `document_scope`
  - `document_type`
  - `access_level`

### Truong phan loai
- `document_scope`
  - `investor_visible`
  - `internal`
  - `execution`
  - `handover`
  - `as_built`
  - `finance_procurement`
  - `legal`

- `document_type`
  - `estimate`
  - `contract`
  - `appendix`
  - `drawing`
  - `meeting_minutes`
  - `execution_report`
  - `acceptance_report`
  - `handover_report`
  - `as_built_dossier`
  - `purchase_doc`
  - `invoice`
  - `receipt`
  - `warranty`
  - `other`

- `access_level`
  - `public_project`
  - `team_only`
  - `restricted`

### Link nghiep vu
- Co the gan lien ket qua:
  - `source_ref_type`
  - `source_ref_id`

Vi du:
- `source_ref_type=estimate_dispatch`
- `source_ref_type=inventory_transaction`

### API documents
- `GET /api/projects/:id/documents`
  - filter: `active_only`, `scope`, `type`
- `POST /api/projects/:id/documents`
- `PATCH /api/projects/:id/documents/:docId`
- `DELETE /api/projects/:id/documents/:docId`

### Validation runtime
- API validate gia tri `document_scope`, `document_type`, `access_level`.
- Taxonomy duoc dong bo tai:
  - `src/lib/projects/document-taxonomy.ts`

### Tinh trang hien tai
- [done] CRUD tai lieu ngay trong `/projects/[id]/overview`
- [todo] Rule theo moc tien do cho ho so bat buoc
- [todo] Dashboard tinh trang ho so toan bo du an

## 3) Lien ket ke hoach vat tu voi mua truc tiep NCC

### Muc tieu
- Noi luong "Mua truc tiep NCC" vao "Ke hoach vat tu".
- Theo doi du / thieu / thua dung theo ke hoach.

### Pham vi da lam
1. Gan phieu mua truc tiep vao ke hoach
- Them `plan_id` cho `ProjectDirectPurchase`.
- Mua truc tiep co the:
  - khong gan ke hoach
  - hoac gan vao 1 ke hoach da duyet cua du an

2. UI mua truc tiep trong `/projects/[id]/operations`
- Them dropdown `Ke hoach ap dung`.
- Khi da chon ke hoach:
  - co dropdown goi y vat tu con thieu tu ke hoach
  - neu nhap vat tu khong thuoc ke hoach thi hien canh bao, nhung van cho phep luu

3. Tong hop `actual-summary` theo ke hoach
- API `/api/projects/:id/resource-plans/:planId/actual-summary` da tinh:
  - du / thieu / thua cho vat tu trong ke hoach
  - cong them vat tu mua truc tiep `confirmed` nhung khong thuoc danh sach ke hoach vao nhom `excess`

Bo sung du lieu:
- `excess_out_of_plan`
- `source = direct_purchase_out_of_plan`

4. UI planning phan biet "thua ngoai ke hoach"
- Trong `/projects/[id]/planning`, cot thua co nhan dien rieng
- Co checkbox `Chi xem thua ngoai ke hoach`

### File chinh da doi
- `prisma/schema.prisma`
- `src/app/api/projects/[id]/direct-purchases/route.ts`
- `src/lib/projects/resource-plan-actuals.ts`
- `src/app/api/projects/[id]/resource-plans/[planId]/actual-summary/route.ts`
- `src/app/(dashboard)/projects/[id]/operations/page.tsx`
- `src/app/(dashboard)/projects/[id]/planning/page.tsx`

### Lenh can chay
1. `npm run db:push`
2. `npm run db:generate`

### Ghi chu nghiep vu
- "Mua truc tiep ngoai ke hoach" khong bi chan, chi canh bao.
- Muc tieu la van hanh linh hoat ngoai cong truong nhung van minh bach du/thieu/thua theo ke hoach.

## 3.1) Nhat ky du an (/projects/[id]/diary)

### Muc tieu hien tai
- Nhap nhat ky thi cong theo ngay / ca.
- Gom nhanh:
  - tom tat cong viec
  - chat luong / an toan
  - nhan luc / may
  - vat tu vao / vat tu ra
  - cham cong tu nhat ky
  - anh / video / tep hien truong
- Ho tro xem lai nhat ky theo huong van hanh hang ngay, khong chi la 1 form nhap lieu.

### Danh sach nhat ky da co
- Phan trang API + UI:
  - GET /api/projects/:id/diary?page=1&pageSize=10
  - pageSize hop le: 10, 20, 30
- Giu trang thai tren URL:
  - page
  - pageSize
  - entry_date_from
  - entry_date_to
  - shift_type
  - quality_status
  - safety_status
  - visibility
- Neu xoa ban ghi cuoi cung cua 1 trang thi UI tu lui ve trang truoc.

### Bo loc dang co
- Tu ngay / den ngay
- Ca lam
- Chat luong
- An toan
- Muc hien thi:
  - public = cong khai chu dau tu
  - internal = noi bo

### Gallery media
- Thumbnail anh / video trong nhat ky khong mo URL goc nua.
- Click thumbnail mo viewer full-screen dang slide.
- Co:
  - Truoc
  - Sau
  - Dong
- Hotkey:
  - ArrowLeft
  - ArrowRight
  - Escape
- Click ra ngoai modal se dong viewer.

### Quy uoc thao tac nhanh tu nhat ky
- Tao viec
- Canh bao
- Bao thieu vat tu

Ghi chu:
- Bao thieu vat tu la canh bao van hanh, khong phai lenh mua hang truc tiep.
- 3 thao tac tren chi duoc mo trong tuan hien tai cua ban ghi nhat ky.
- Khi qua tuan, UI se disable nut va hien helper text giai thich ly do.

### QC / HSE issue notification
- `project_site_issues` la lop punch list / loi hien truong cua du an.
- Khi tao issue:
  - neu da co nguoi phu trach thi gui notification cho nguoi do
  - neu chua co nguoi phu trach thi gui ve owner / default owner cua du an
- Khi phan cong / doi nguoi phu trach:
  - gui notification cho nguoi moi duoc giao
  - metadata co `project_id`, `project_name`, `issue_code`, `due_at`
- Khi bao da khac phuc / mo lai / huy / them ghi chu:
  - gui notification cho nguoi bao loi, nguoi phu trach, owner / default owner
  - khong gui nguoc lai nguoi vua thao tac de giam nhieu thong bao noi bo
- Khi nghiem thu dat:
  - gui notification cho nguoi bao loi va nguoi phu trach
- Khi nghiem thu khong dat:
  - thao tac UI dung action `reopen`
  - co the nhap ly do, ly do se di vao detail cua event / notification
  - loi quay lai trang thai can xu ly tiep
- `/api/notifications` da co display mapper rieng cho:
  - `project_site_issue_created`
  - `project_site_issue_assigned`
  - `project_site_issue_fixed_submitted`
  - `project_site_issue_verified`
  - `project_site_issue_reopened`
  - `project_site_issue_cancelled`
  - `project_site_issue_commented`

## 4) Khi nao cap nhat doc nay
- Moi thay doi investor-view / milestones / payment plans / payments
- Moi thay doi project documents
- Moi thay doi direct purchase <-> resource plan
- Moi thay doi diary / diary manager / diary report / gallery viewer / bo loc / phan trang nhat ky
- Moi thay doi project site issues / punch list / QC-HSE notification

Tai lieu nay la diem doc tong hop cho module du an. Cac doc khac chi nen tach rieng khi nghiep vu lon den muc can 1 tai lieu chuyen de doc lap.

