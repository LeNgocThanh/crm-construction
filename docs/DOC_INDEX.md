# DOC INDEX

> Muc tieu: giup team doc dung tai lieu, dung nguon su that.

## 1) Nguon su that (uu tien doc)

1. `SYSTEM_OVERVIEW.md`
- File tong quan de doc 1 lan la hieu app dang co gi, module nao da van hanh, module nao dang mo rong, va nen doc tiep tai lieu nao.

1a. `DOC_TOUCH_MAP.md`
- File tra nhanh de biet:
  - sua module nao thi cap nhat doc nao
  - giam viec phai ra soat toan bo `docs/`

2. `ESTIMATE_ASSEMBLY_DESIGN_GUIDE.md`
- Van hanh assembly text/2D/3D/result-v2.
- Logic estimate assembly hien tai (block-first + fallback).
- Clone/replace/zoom/auto-layout va thao tac user.
- Co them `block-facts`, bundle rule `block -> template`, va cach debug xung dot runtime.
- Da cap nhat them:
  - seed demo assembly / preset
  - list nhe + cache detail + phan trang trong designer 2D/3D
  - menu `Tien ich` va `Xuat du lieu` tren designer 3D

3. `ESTIMATE_BLOCK_PARAMETERS_GUIDE.md`
- Giai thich y nghia va lien ket cua cac thong so block:
  - `component_type`
  - `template_id`
  - `room_type`
  - `space_type`
  - `space_profile`
  - `foundation_type`
  - bo tick feature
  - `opening_preset`
  - `openings[]`
  - `interior_preset`
- Giai thich them lop `assembly_template_bundle_map` va thu tu uu tien template estimate.

4. `ESTIMATE_FORMULA_EXTENSIBILITY.md`
- Formula/apply_mode/basis (`quantity_basis_key`).
- Mapping component-template DB-driven.
- Nguyen tac tinh quantity va vai tro `extra_facts_json`.
- Co them template forced tu `assembly_template_bundle_map`.
- Co ca luong preview item thuc trong `/settings/estimate-v2` de user test tung dong dinh muc.

5. `CHANGELOG_V1.2.md`
- Doi thay doi moi nhat da release trong codebase.

6. `ESTIMATE_3D_REALISM_ROADMAP.md`
- Roadmap nang gia tri cho cum assembly + 2D/3D + estimate + proposal theo huong semantic block, preset kien truc va du toan thuc te hon.

## 2) Tai lieu kien truc tong quan (active reference)

- `ESTIMATE_V2_BLUEPRINT.md`

Dung de hieu buc tranh tong, naming nghiep vu, pham vi.

## 3) CRM / Customer-related docs

- `CUSTOMER_CARE_ACTIVITIES_FIELDS.md`
- `CUSTOMER_ESTIMATE_DISPATCHES_FIELDS.md`
- `CUSTOMERS_FIELDS_STRATEGY.md`
- `PROJECT_REQUIREMENT_SNAPSHOTS_FIELDS.md`
- `PROJECT_QA_QC_HSE_PUNCHLIST_SPEC.md`
- `CONVERSATIONS_REUSE_LOGIC.md` (logic chat/takeover/analyze/close de tai su dung)
- `WORK_SUGGESTIONS_GUIDE.md` (work suggestion + notifications + action timeline updates)
- `ACTIONS_OPERATION_GUIDE.md` (van hanh actions, deadline, internal action, reschedule/cancel)
- `TIMELINE_BOUNDARY_SPEC.md` (ranh gioi customer timeline vs action timeline)

## 4) Docs khac

- `DEV_CHECKLIST.md`: checklist dev/qa.
- `ESTIMATE_3D_REALISM_ROADMAP.md`: roadmap phat trien tiep cho estimate, khoi 3D, proposal va semantic block.
- `ESTIMATE_BLOCK_PARAMETERS_GUIDE.md`: giai nghia tung thong so block va quan he giua semantic, preset, facts va estimate.
- `ESTIMATE_ASSEMBLY_DESIGN_GUIDE.md`: van hanh assembly + `block-facts` + `bundle map`.
- `ACCOUNTING_DASHBOARD_GUIDE.md`: quy uoc KPI/canh bao cho dashboard ke toan dieu hanh.
- `LABOR_MODULE_GUIDE.md`: module nhan cong (danh muc, roster du an, cham cong, nhat ky, thanh toan cong, bao cao va lien ket voi du an).
- `ASSET_MODULE_GUIDE.md`: module tai san/thiet bi, action schema, reports theo user.
- `PROJECT_MODULE_GUIDE.md`: tai lieu tong hop cho module du an (investor view, documents, direct purchase link voi planning, diary / gallery viewer / bo loc / phan trang nhat ky).
- `PROJECT_EXECUTION_AXIS_SPEC.md`: quy uoc chuan cho truc van hanh du an `status - stage - milestone - active plan`.
- `PROJECT_QA_QC_HSE_PUNCHLIST_SPEC.md`: spec nghien cuu luong `Diary -> Issue/Punch -> Acceptance` de trien khai QA/QC, HSE va punch list ma khong chong lan voi nhat ky du an.
- `ACCESS_CONTROL_GUIDE.md`: tai lieu tong hop cho access-control (muc tieu, data model, helper authz, route da migrate, huong mo rong).
- `SUPPLIER_INVENTORY_BLUEPRINT.md`: huong supplier/kho + cap nhat Inventory Phase A (API transactions/stocks, posting engine draft->posted, rule cancel/sua).
- `INVENTORY_STOCK_AUDIT_GUIDE.md`: nghiep vu kiem ke kho (snapshot ton so -> dem thuc te -> ap chenh lech thanh adjust).
- `INVENTORY_PROCUREMENT_GUIDE.md`: luong de nghi mua -> don mua -> nhan hang nhap kho, tach ro dat mua va nhap ton that.
- `INVENTORY_PRICE_TRACKING_GUIDE.md`: tach gia NCC cau hinh, gia nhap thuc te va vong gia ton de theo doi bien dong gia vat tu.
- `PRINT_SYSTEM_GUIDE.md`: khung in dung chung (brand/layout/shell) da ap cho bao cao gia vat tu va phieu kho.
- `SYSTEM_OVERVIEW.md`: diem vao tong quan cap he thong.
- `TELEGRAM_SETUP.md`: setup Telegram.
- `UI_NOTIFICATION_CODING_PRINCIPLES.md`: nguyen tac bat buoc cho UI label/dropdown tieng Viet va tieu chuan tao notification.
- `DOC_TOUCH_MAP.md`: ban do tra nhanh module -> file docs can cap nhat.
- `DOC_INDEX.md` la diem vao docs chinh; `README.md` da bo de tranh trung lap.

## 5) Quy uoc cap nhat docs

- Moi thay doi API/logic estimate: cap nhat `CHANGELOG_V1.2.md`.
- Moi thay doi thao tac assembly/designer: cap nhat `ESTIMATE_ASSEMBLY_DESIGN_GUIDE.md`.
- Moi thay doi y nghia / lien ket thong so block semantic: cap nhat `ESTIMATE_BLOCK_PARAMETERS_GUIDE.md`.
- Moi thay doi formula/basis/mapping: cap nhat `ESTIMATE_FORMULA_EXTENSIBILITY.md`.
- Moi thay doi kho (transactions/stocks/posting): cap nhat `SUPPLIER_INVENTORY_BLUEPRINT.md`.
- Moi thay doi kiem ke kho: cap nhat `INVENTORY_STOCK_AUDIT_GUIDE.md`.
- Moi thay doi luong mua hang kho: cap nhat `INVENTORY_PROCUREMENT_GUIDE.md`.
- Moi thay doi bien dong gia vat tu / vong gia ton: cap nhat `INVENTORY_PRICE_TRACKING_GUIDE.md`.
- Moi thay doi investor-view, project documents, direct purchase <-> planning: cap nhat `PROJECT_MODULE_GUIDE.md`.
- Moi thay doi quy uoc `status/stage/milestone/active plan`: cap nhat `PROJECT_EXECUTION_AXIS_SPEC.md`.
- Moi thay doi access-control, permission, role, account type, route migrate: cap nhat `ACCESS_CONTROL_GUIDE.md`.
- Moi thay doi quy uoc UI/notification: cap nhat `UI_NOTIFICATION_CODING_PRINCIPLES.md`.
- Moi thay doi pham vi module hoac lien ket giua cac module: cap nhat `SYSTEM_OVERVIEW.md`.
- Neu tai lieu khong con dung runtime: danh dau `historical` hoac xoa.
