# SYSTEM OVERVIEW

> Muc tieu: doc 1 file la hieu app da va dang lam duoc nhung gi, cac module lien ket voi nhau ra sao, va tai lieu nao la noi can doc sau do.

## 1) App nay la gi

Day la mot he thong CRM + dieu hanh + du toan + du an cho cong ty xay dung.

App hien tai da di qua muc CRM co ban va da mo rong thanh mot bo van hanh lien thong:

- tim lead / cham soc khach hang
- chat da kenh va AI ho tro
- next action / giao viec / notification
- du toan, assembly, 2D, 3D, proposal
- quan ly du an thi cong
- kho, mua hang, kiem ke, gia vat tu
- tai san / thiet bi
- nhan cong, cham cong, thanh toan cong
- dashboard ke toan / bao cao tong hop
- he thong phan quyen theo permission

Quy uoc UI moi:
- cac dropdown / badge / summary hien thi user dang duoc chuan hoa qua `src/lib/user-display.ts`
- uu tien `full_name (username)` + `vai tro truy cap chinh`
- tranh quay lai kieu hien thi cuc bo `username (role)` o tung man hinh

## 2) Triet ly hien tai cua he thong

- UI uu tien cho nguoi dung van hanh thuc te: co nhan, dropdown tieng Viet, thao tac nhanh.
- Notification duoc xem la phan cua nghiep vu, khong chi la UI phu.
- Timeline duoc tach ro theo boi canh:
  - customer timeline
  - action timeline
  - project timeline
  - asset lifecycle
- Cac module duoc noi voi nhau theo nghiep vu thay vi dung rieng le.
- Van uu tien logic dung va de van hanh truoc, cac phan refine sau se tiep tuc bo sung.

## 3) Cac module da co

### 3.1 CRM / Customers / Workboard

Da lam duoc:

- quan ly khach hang
- pipeline / workboard / kanban cham soc
- customer care activities la nguon nghiep vu chinh cho next action
- work suggestions / actions / notifications cho giao viec
- phan cong 1 chinh + nhieu phu
- log timeline cho cac thao tac quan trong
- dong bo voi project timeline khi can

Lien quan docs:

- `CUSTOMER_CARE_ACTIVITIES_FIELDS.md`
- `CUSTOMER_ESTIMATE_DISPATCHES_FIELDS.md`
- `CUSTOMERS_FIELDS_STRATEGY.md`
- `WORK_SUGGESTIONS_GUIDE.md`
- `ACTIONS_OPERATION_GUIDE.md`
- `TIMELINE_BOUNDARY_SPEC.md`

### 3.2 Conversations / AI chat / Analyze

Da lam duoc:

- nhan hoi thoai tu Zalo / Messenger / Telegram
- takeover / bat lai auto-reply
- phan tich hoi thoai theo mode
- lien ket customer co san neu tim thay
- co logic re-analyze theo doan tin nhan
- huong toi viec AI hoi kheo cac truong con thieu

Lien quan docs:

- `CONVERSATIONS_REUSE_LOGIC.md`
- `TELEGRAM_SETUP.md`

### 3.3 Estimate / Assembly / 2D / 3D / Proposal

Da lam duoc:

- estimate v2 theo cong thuc va dinh muc DB-driven
- assembly designer text / 2D / 3D
- clone block / auto-layout / preview estimate
- man `block-facts` de giai thich semantic block -> facts -> template -> estimate
- xuat JSON / OBJ cho du lieu massing
- semantic block duoc lam day hon voi `space_type`, `space_profile`, `opening_preset`, `openings[]`, `interior_preset`
- preview estimate da co them facts opening theo tung mat (`openings_by_face`) va facts noi that co ban
- da co `assembly_template_bundle_map` de ep template mem theo dieu kien block, co UI quan ly va canh bao xung dot rule
- designer 3D da co `Solid / X-ray / Presentation`, preset mau, doi mau tung nhom block, reset hien thi
- designer 2D da dong bo mau block theo preset / mau tuy chinh cua designer 3D
- designer 2D/3D da chuyen qua list assembly nhe + load detail theo id + cache local 10 mau gan nhat
- designer 2D/3D da co phan trang danh sach assembly, khong con phu thuoc vao viec load 100 mau 1 luc
- da co bo seed demo cho assembly va preset de test nhanh cac case nha pho, nha cap 4, biet thu mini, 2 mat tien, lech tang
- proposal khach hang
- brief noi bo sales
- tone proposal uu tien chi phi
- print proposal co the dung anh preview

Tinh than hien tai:

- block-first
- fallback ve facts / formula khi can
- mo rong dan theo template / component / basis

Lien quan docs:

- `ESTIMATE_ASSEMBLY_DESIGN_GUIDE.md`
- `ESTIMATE_BLOCK_PARAMETERS_GUIDE.md`
- `ESTIMATE_FORMULA_EXTENSIBILITY.md`
- `ESTIMATE_V2_BLUEPRINT.md`
- `DOC_INDEX.md`
- `CHANGELOG_V1.2.md`

### 3.4 Projects

Da lam duoc:

- tao / sua / quan ly du an xay dung
- owner, customer, timeline lien ket
- investor view
- overview / planning / operations / diary / diary report
- diary da co:
  - filter tu ngay / den ngay, ca lam, chat luong, an toan, muc hien thi
  - phan trang that + giu state tren URL
  - gallery viewer full-screen cho anh/video nhat ky
  - thao tac nhanh chi cho tao trong tuan hien tai
- site issues / punch list da co notification ro hon khi tao, phan cong, bao khac phuc, xac nhan, mo lai, huy, them ghi chu
- milestone status / milestone template / rule co ban
- resource plan cho vat tu va nhan cong
- direct purchase cho du an
- project material ledger / ton du an co ban
- documents / legal-doc style luu tai lieu du an
- cap nhat snapshot van hanh theo thang / thoi diem
- truc van hanh da siết ro hon cho ca nhánh vat tu va nhánh nhan cong

Projects hien da la trung tam lien ket voi:

- customer
- inventory
- labor
- diary
- payments / accounting
- asset assignments

Lien quan docs:

- `PROJECT_MODULE_GUIDE.md`
- `PROJECT_EXECUTION_AXIS_SPEC.md`
- `PROJECT_REQUIREMENT_SNAPSHOTS_FIELDS.md`

### 3.5 Inventory / Warehouse / Procurement

Da lam duoc:

- quan ly kho, vat tu, NCC, gia NCC
- phiếu nhap / xuat / dieu chinh / draft / posted / cancel
- posted engine va update ton kho
- average cost theo vong ton
- clear stock mo vong gia moi
- project-linked stock logic co ban
- dashboard canh bao van hanh kho
- kiem ke kho
- de nghi mua -> don mua -> nhan hang
- theo doi bien dong gia vat tu
- print phiếu / bao cao gia

Lien quan docs:

- `SUPPLIER_INVENTORY_BLUEPRINT.md`
- `INVENTORY_STOCK_AUDIT_GUIDE.md`
- `INVENTORY_PROCUREMENT_GUIDE.md`
- `INVENTORY_PRICE_TRACKING_GUIDE.md`

### 3.6 Assets / Equipment

Da lam duoc:

- danh muc asset type, unit, action type
- assets list / create / update / active / inactive
- asset operations page
- lifecycle event va participant role
- report co ban theo nguoi giu / tinh trang / action cuoi
- co lien ket du an khi ban giao / gan asset

Lien quan docs:

- `ASSET_MODULE_GUIDE.md`

### 3.7 Labor

Da lam duoc:

- labor workers / crews / trades
- labor roster mac dinh cho du an
- cham cong tu nhat ky du an
- xac nhan cham cong rieng
- payment batch / payment records
- khoa cham cong khi da di vao thanh toan
- labor reports theo ngay / theo nhan cong / theo ky
- payroll API co ban cho accounting
- skill level dang duoc mo rong cho tho ngoai / tho chinh / tho phu
- tam ung va tat toan dang duoc mo them theo huong module labor + accounting
- `project_labor_engagement` da duoc gan `plan_id` de bam vao labor plan dang van hanh
- actual summary nhan cong theo plan chi tinh attendance co `engagement.plan_id` trung plan, khong tron ca du an

Lien quan docs:

- `LABOR_MODULE_GUIDE.md`
- `LABOR_EXPANSION_PHASE2_SPEC.md`

### 3.8 Accounting / Dashboards

Da lam duoc:

- dashboard ke toan tong hop co ban
- payroll view theo ky
- cong no chu dau tu theo cac nguong thoi gian
- lien ket du lieu tu project payments, labor payments, inventory va snapshot du an

Tinh chat hien tai:

- nghieng ve dashboard dieu hanh va tong hop
- chua phai he thong ke toan day du

Lien quan docs:

- `ACCOUNTING_DASHBOARD_GUIDE.md`

### 3.9 Access Control / Roles / Permissions

Da lam duoc:

- chuyen dan tu role cu sang permission / role / role-permission
- co trang quan ly roles / permissions / membership
- user profile da mo rong theo huong ho so tai khoan, role that su doc tu role membership
- da migrate nhieu route settings, projects, rag, labor, assets...
- da migrate them nhom API setup / webhook / bot-config / KPI / reports KPI / SLA escalate sang authz helper va membership query
- session da co them `role_keys` de page client check nhieu role membership thay vi phu thuoc `role` don
- co helper authz de ap dung vao page va API

Tinh than:

- bo role cu dan dan
- su dung permission moi la huong chinh
- scope record-level se mo rong sau

Lien quan docs:

- `ACCESS_CONTROL_GUIDE.md`

### 3.10 Print system

Da lam duoc:

- bo print brand dung chung
- print shell / header / footer dung chung
- da ap vao inventory va labor payments
- la nen de sau nay ap tiep cho proposal, project report, accounting report...

Lien quan docs:

- `PRINT_SYSTEM_GUIDE.md`

## 4) Cac lien ket nghiep vu quan trong

### Customer <-> Conversations

- chat moi co the phan tich de tim customer
- customer co the duoc cap nhat tu insight hoi thoai

### Customer <-> Actions / Notifications

- next action sinh notification
- action done / assign / cancel co audit trail

### Customer <-> Projects

- project gan customer
- doi owner / event du an co the day sang timeline / notification

### Projects <-> Inventory

- ke hoach vat tu co the sinh nhu cau kho
- xuat kho / nhap kho / mua truc tiep gan vao du an
- ton du an dang duoc quan ly o muc co ban

### Projects <-> Labor

- du an co roster nhan cong
- roster la danh sach mac dinh cap du an, khong phai lop active plan
- engagement moi la lop van hanh bam vao labor plan
- nhat ky co the sinh cham cong
- cham cong da xac nhan di vao thanh toan cong
- bao cao du/thieu/thua nhan cong theo plan da doc theo `engagement.plan_id`

## 4.1) Luu y van hanh local voi Prisma

- App local PostgreSQL hien tai dung `DATABASE_URL=postgresql://...`
- Khong nen chay `prisma generate --no-engine` cho local runtime nay.
- Neu generate nham `--no-engine`, auth/login co the loi:
  - `Error validating datasource db: the URL must start with the protocol prisma://`
- Cach khoi phuc:
  1. tat server dev dang giu Prisma engine
  2. chay lai `npx prisma generate`
  3. mo app lai va test login

### Projects <-> Assets

- tai san da ban giao cho du an co the xem o project overview

### Inventory <-> Accounting

- dashboard kho va dashboard ke toan da bat dau dung chung mot phan du lieu gia / giao dich / cam ket chi

## 5) Trang thai hien tai cua app

### Da co gia tri van hanh thuc te

- CRM + cham soc + workboard
- conversations da kenh
- proposal / estimate / assembly
- projects
- inventory
- labor
- asset
- notification
- print base

### Da co khung tot nhung con mo rong tiep

- accounting
- advanced permission scope theo resource cu the
- SLA / escalation
- project diary reporting sau hon
- inventory procurement sau khi mo rong approval / receiving
- labor advance / settlement day du

### Chua nen coi la hoan tat

- module ke toan tong the
- phan quyen record-level chi tiet
- quy trinh approval phuc tap nhieu cap
- AI policy/config linh hoat cho moi nghiep vu
- proposal tone nang cao dua theo design/material thuc te

## 6) Neu muon hieu app nhanh thi doc theo thu tu nay

1. `SYSTEM_OVERVIEW.md`
2. `DOC_INDEX.md`
3. Theo module dang can:
   - CRM -> `WORK_SUGGESTIONS_GUIDE.md`, `TIMELINE_BOUNDARY_SPEC.md`
   - Du an -> `PROJECT_MODULE_GUIDE.md`
   - Kho -> `SUPPLIER_INVENTORY_BLUEPRINT.md`
   - Nhan cong -> `LABOR_MODULE_GUIDE.md`
   - Du toan -> `ESTIMATE_ASSEMBLY_DESIGN_GUIDE.md`, `ESTIMATE_BLOCK_PARAMETERS_GUIDE.md`, `ESTIMATE_FORMULA_EXTENSIBILITY.md`
   - Phan quyen -> `ACCESS_CONTROL_GUIDE.md`

## 7) Tai lieu spec tuong lai dang giu lai

Nhung file nay van con gia tri vi no mo ta huong mo rong sap toi:

- `SLA_ESCALATION_SPEC.md`
- `LABOR_EXPANSION_PHASE2_SPEC.md`
- `NOTIFICATION_POLICY_MATRIX_FUTURE.md`
- `TIMELINE_BOUNDARY_SPEC.md`

## 8) Huong phat trien uu tien tiep theo

Nhung huong nay uu tien theo tieu chi ap dung duoc vao van hanh thuc te cua cong ty xay dung. Neu nghiep vu da pho bien trong cac app lon nhu Procore, Autodesk Construction Cloud, Buildertrend, CoConstruct thi cang nen tham khao, nhung khi dua vao app nay van phai giu dung logic hien co.

### 8.1 QA/QC & HSE - Punch list thuc chien

Muc tieu:

- bien nhat ky thi cong thanh nguon tao loi / canh bao / viec khac phuc
- theo doi loi chat luong, canh bao an toan, su co tai cong truong
- co du anh truoc / sau, nguoi xu ly, han xu ly, nghiem thu lai

Nen phat trien tiep:

- punch list theo du an, moc tien do, hang muc, nguoi phu trach
- trang thai: moi / da giao / dang xu ly / cho nghiem thu / dat / khong dat / huy
- tao issue tu nhat ky va tu anh nhat ky
- thong bao khi tao issue, gan nguoi xu ly, doi han, hoan tat, nghiem thu khong dat
- bao cao loi lap lai theo hang muc / doi thi cong / nha thau phu

Lien ket chinh:

- `project_diary_entries`
- project issues / punch list
- notifications
- project timeline
- labor / subcontractor neu loi gan voi doi thi cong

### 8.2 Change Order - Phat sinh ngoai hop dong

Muc tieu:

- quan ly cac phat sinh trong qua trinh thi cong de tranh that thoat va tranh cai voi chu dau tu
- tu phat sinh co the tao du toan phat sinh, tai lieu xac nhan, anh minh chung

Nen phat trien tiep:

- de nghi phat sinh theo du an
- ly do phat sinh, pham vi phat sinh, anh / file lien quan
- du toan phat sinh theo vat tu / nhan cong / nha thau phu
- trang thai: nhap / gui xac nhan / da duyet / tu choi / da thuc hien / da quyet toan
- khi duyet thi cap nhat ngan sach hien tai, chi phi cam ket, project timeline

Lien ket chinh:

- projects
- estimate v2 / assembly neu phat sinh tu thay doi thiet ke
- project documents
- accounting dashboard
- inventory / labor neu phat sinh can vat tu hoac nhan cong

### 8.3 RFI - Cau hoi ky thuat can xac nhan

Muc tieu:

- gom cac cau hoi can chu dau tu, ky thuat, giam sat hoac nha thau phu xac nhan
- giam viec trao doi roi rac qua chat va tranh mat dau vet quyet dinh

Nen phat trien tiep:

- tao RFI tu project, diary, issue, document
- nguoi hoi, nguoi can tra loi, deadline, muc uu tien
- cau tra loi chinh thuc va file dinh kem
- khi tra loi xong thi ghi project timeline

Lien ket chinh:

- project timeline
- notifications
- project documents
- conversations neu cau hoi phat sinh tu chat

### 8.4 Submittal - Duyet mau vat tu / thiet bi

Muc tieu:

- quan ly viec trinh mau va duyet mau vat tu truoc khi mua / thi cong
- giup sales, ky thuat, kho va chu dau tu cung nhin mot quyet dinh vat tu

Nen phat trien tiep:

- submittal theo du an, hang muc, vat tu, NCC
- anh mau, catalogue, bao gia, COCQ neu co
- trang thai: nhap / da gui / can sua / da duyet / tu choi / thay the
- vat tu da duyet co the duoc uu tien khi lap ke hoach mua hang / nhap kho

Lien ket chinh:

- inventory materials / suppliers / supplier prices
- project documents
- direct purchase / procurement
- investor portal

### 8.5 Investor portal - Trang theo doi cho chu dau tu

Muc tieu:

- bien cac du lieu da co thanh mot noi de chu dau tu xem tien do, nhat ky, anh, thanh toan va viec can xac nhan
- tang gia tri cam nhan cua app voi khach hang cuoi

Nen phat trien tiep:

- trang tong quan rieng cho chu dau tu
- xem nhat ky theo tuan / thang, anh noi bat, van de dang xu ly
- xem payment plan, mốc da thu / sap den han
- xem phat sinh can duyet, RFI can tra loi, submittal can xac nhan
- muc hien thi theo `investor_visibility_level`

Lien ket chinh:

- project diary report
- project documents
- payment plans / payments
- change orders
- RFI / submittal
- notifications danh cho tai khoan chu dau tu

### 8.6 Room schedule va bo tach tu 2D/3D

Muc tieu:

- bien cac block 2D/3D thanh danh sach phong / hang muc co so lieu ro rang
- giup du toan giai thich duoc: vi sao ra vat tu, vi sao ra chi phi

Nen phat trien tiep:

- room schedule tu block: ten phong, dien tich san, tuong, tran, cua, cua so, dien nuoc co ban
- so sanh 2-3 phuong an theo block / phong / nhom chi phi
- spec sheet gui khach: khong gian nao, vat lieu chinh nao, phan nao co the toi uu ngan sach
- mapping semantic block -> template -> formula -> vat tu can co trang giai thich ro hon cho user van hanh

Lien ket chinh:

- assembly designer 2D/3D
- estimate v2 templates / formula presets
- proposal khach hang
- planning vat tu / nhan cong cua project sau khi chot phuong an

### 8.7 Thu tu nen lam

Neu can chon viec tiep theo, uu tien theo thu tu:

1. QA/QC & HSE punch list noi sau voi nhat ky.
2. Change Order / phat sinh ngoai hop dong.
3. Investor portal.
4. Room schedule tu block 2D/3D.
5. RFI.
6. Submittal duyet mau vat tu.

## 9) Nguyen tac cap nhat file nay

Cap nhat `SYSTEM_OVERVIEW.md` khi co mot trong cac thay doi sau:

- them module moi
- mot module chuyen tu spec sang da van hanh
- thay doi lien ket nghiep vu giua cac module
- doi diem vao chinh de team doc docs
