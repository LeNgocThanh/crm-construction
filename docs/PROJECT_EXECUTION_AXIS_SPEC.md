# PROJECT EXECUTION AXIS SPEC

Muc tieu:
- Chuan hoa truc dieu hanh cua du an gom:
  - `status`
  - `stage`
  - `milestone`
  - `active plan`
- Giam tinh trang moi trang / moi API hieu du an theo mot kieu khac nhau.
- Tao nen de sau nay them rule, notification, checklist, dashboard va automation ma khong bi chong logic.

## 1) Van de hien tai

Hien tai module `projects` da co:
- `construction_projects.status`
- `construction_projects.stage`
- `project_milestones`
- `project_resource_plans`

Nhung 4 lop nay chua duoc rang buoc ro rang voi nhau.

He qua:
- cung 1 du an co the `status=in_progress` nhung milestone active lai chua ro
- `stage` mang tinh mo ta, nhung chua dieu khien UI / planning / operations that su
- co nhieu ke hoach vat tu / nhan cong, nhung chua ro ke hoach nao la ban dang van hanh
- timeline / report / warning co luc doc theo status, co luc doc theo milestone, co luc doc theo snapshot

## 2) Nguyen tac moi

Truc dieu hanh du an duoc chia thanh 4 lop, moi lop co vai tro rieng:

### 2.1 `status` = trang thai vong doi cap du an

Tra loi cau hoi:
- Du an dang o muc nghiep vu nao trong vong doi tong?

De xuat:
- `draft`
- `confirmed`
- `in_progress`
- `completed`
- `paused`
- `cancelled`

Y nghia:
- `draft`: du an moi tao, chua coi la du an thi cong chinh thuc
- `confirmed`: da chot, da du dieu kien de dua vao van hanh
- `in_progress`: dang thi cong / dang van hanh thuc te
- `completed`: da hoan tat
- `paused`: tam dung
- `cancelled`: huy

`status` khong thay the `milestone`.
`status` chi la lop tong quan cap cao.

### 2.2 `stage` = cum nghiep vu cap doan

Tra loi cau hoi:
- Du an dang o cum cong viec lon nao?

Vi du:
- `thiet_ke`
- `xin_phep`
- `mong`
- `tho`
- `hoan_thien`
- `ban_giao`

`stage` dung de:
- loc dashboard
- loc bao cao
- nhom cong viec
- dinh huong giao tiep chu dau tu / noi bo

`stage` khong phai la chi tiet tien do.
Chi tiet tien do thuoc `milestone`.

### 2.3 `milestone` = moc dieu hanh thuc te

Tra loi cau hoi:
- Hien tai du an dang chay moc nao?

Day la lop dieu hanh chinh.

Moi milestone nen co:
- `milestone_key`
- `milestone_name`
- `status_key`
- `due_date`
- `completed_at`
- `sort_order`
- `milestone_definition_id` neu co

Trong milestone, can co 1 moc duoc xem la `active milestone`.

### 2.4 `active plan` = ban ke hoach dang duoc dung de van hanh

Tra loi cau hoi:
- Ke hoach vat tu / nhan cong nao dang la ban chinh thuc de doi thi cong va kho thuc hien?

Khong phai moi `approved` plan deu la plan dang dung.
Can tach:
- `approved`
- `active`
- `superseded`
- `locked`

## 3) Dinh nghia chuan cua 4 lop

### 3.1 Boi canh status

`status` la trang thai cap project.

Rule tong quan:
- `draft`:
  - cho phep tao du an, planning, milestone, tai lieu nhap
  - chua nen day notification nghiep vu rong
  - chua nen xem la du an thi cong chinh thuc
- `confirmed`:
  - du an da chot
  - cho phep ap milestone template / khoi dong planning chinh thuc
- `in_progress`:
  - du an da co van hanh that
  - diary, operations, labor, inventory, cashflow snapshot bat dau co nghia trung tam
- `completed`:
  - dong van hanh chinh
  - khong cho them milestone active moi
  - chi cho cap nhat ho so / doi soat neu can
- `paused`:
  - tam dung van hanh
  - giu nguyen du lieu, canh bao va cho phep mo lai
- `cancelled`:
  - dung nghiep vu
  - khong cho mo them planning active moi

### 3.2 Boi canh stage

`stage` la nhom nghiep vu lon hien tai cua du an.

Rule:
- mot project chi co 1 `stage` hien tai
- `stage` nen dong bo mem theo `active milestone`
- user van co the chinh tay trong phase dau
- ve sau co the chuyen sang tu dong de cao hon

De xuat mapping mem:
- milestone thuoc nhom thiet ke -> `stage=thiet_ke`
- milestone thuoc nhom xin phep -> `stage=xin_phep`
- milestone thuoc nhom mong -> `stage=mong`
- milestone thuoc nhom phan tho -> `stage=tho`
- milestone thuoc nhom hoan thien -> `stage=hoan_thien`
- milestone thuoc nhom ban giao -> `stage=ban_giao`

### 3.3 Boi canh milestone

Milestone la lop dieu hanh thuc te va phai co khái niem:
- `active milestone`
- `next milestone`
- `completed milestones`
- `blocked milestones`

De xuat rule xac dinh `active milestone`:
1. neu co milestone `status_key=in_progress` -> lay milestone do
2. neu khong co `in_progress`, lay milestone dau tien co `status_key=pending`
3. neu tat ca `completed` -> khong co active milestone
4. neu project `paused` / `cancelled` -> active milestone chi de tham chieu, khong xem la moc van hanh

Khong cho phep:
- nhieu milestone cung `in_progress` trong cung 1 project

Phase sau co the cho phep song song, nhung hien tai nen khoa 1 moc active de don gian.

### 3.4 Boi canh active plan

Can tach theo loai ke hoach:
- `material`
- `labor`
- ve sau co the co:
  - `cashflow`
  - `subcontract`
  - `equipment`

Trong phase nay, tap trung:
- active material plan
- active labor plan

De xuat nguyen tac:
- moi project co toi da:
  - 1 `active` material plan cho 1 milestone
  - 1 `active` labor plan cho 1 milestone
- mot plan `approved` chua chac da `active`
- khi kich hoat plan moi:
  - plan active cu cung loai se thanh `superseded`

## 4) Data model de xuat

Phase A khong nhat thiet doi schema lon ngay, chi can chuan hoa logic.

### 4.1 Muc toi thieu nen bo sung

De xuat bo sung vao `construction_projects`:
- `active_milestone_id` nullable
- `active_material_plan_id` nullable
- `active_labor_plan_id` nullable

Muc dich:
- doc nhanh o overview / operations / dashboard
- giam viec moi API tu phai suy ra lai

### 4.2 Trang thai plan de xuat

`project_resource_plans.status` nen duoc chuan hoa thanh:
- `draft`
- `reviewing`
- `approved`
- `active`
- `superseded`
- `locked`
- `cancelled`

Trong do:
- `approved`: da duyet, san sang dung
- `active`: dang dung de van hanh
- `superseded`: da bi thay bang plan revision moi
- `locked`: khoa vi da chay sau mot moc nghiep vu

Neu chua doi schema ngay, co the phase dau:
- van giu status cu
- them rule logic ben tren API/UI

## 5) Rule nghiep vu chuan

### 5.1 Rule giua `status` va `milestone`

- `draft`
  - cho phep tao milestone
  - khong bat buoc co active milestone
- `confirmed`
  - nen co milestone dau tien de bat dau dieu hanh
- `in_progress`
  - phai co `active milestone`
- `completed`
  - khong con milestone `in_progress`
  - tat ca milestone chinh da `completed` hoac da dong nghiep vu
- `paused`
  - co the giu milestone dang mo, nhung khong active moi
- `cancelled`
  - milestone chua xong nen dua ve `cancelled` hoac giu nguyen de audit, tuy rule phase sau

### 5.2 Rule giua `stage` va `milestone`

- `stage` duoc suy ra uu tien tu `active milestone`
- neu khong co `active milestone`, dung milestone pending tiep theo
- neu khong co milestone nao, giu `stage` nhap tay hoac null

### 5.3 Rule giua `milestone` va `active plan`

- active plan phai thuoc cung project
- uu tien active plan cung `milestone_id = active_milestone_id`
- neu user muon gan plan active khac milestone active:
  - cho phep trong phase dau
  - nhung can warning ro

### 5.4 Rule giua `active plan` va thuc te van hanh

Neu plan da co phat sinh thuc te:
- khong cho sua truc tiep cac item chinh
- neu can doi:
  - tao revision moi
  - plan cu thanh `superseded` hoac `locked`

Thuc te gom:
- xuat kho / nhap kho gan plan
- mua truc tiep gan plan
- attendance / engagement gan plan lao dong (phase sau neu can)

## 6) Hanh vi UI de xuat

### 6.1 `/projects`

List du an nen hien:
- status
- stage
- active milestone
- active material plan
- active labor plan
- warning neu:
  - `in_progress` nhung khong co active milestone
  - active milestone co nhung khong co active material plan / labor plan khi can

### 6.2 `/projects/[id]/overview`

Them khoi:
- `Truc dieu hanh du an`

Noi dung:
- status hien tai
- stage hien tai
- active milestone
- active material plan
- active labor plan
- nut:
  - doi milestone active
  - kich hoat plan vat tu
  - kich hoat plan nhan cong

### 6.3 `/projects/[id]/planning`

Moi plan hien:
- status nghiep vu
- co phai active plan khong
- co phat sinh thuc te chua
- neu khong duoc sua thi phai ghi ro ly do

### 6.4 `/projects/[id]/operations`

Mac dinh:
- lay active material plan de goi y xuat kho / direct purchase
- neu chua co active material plan:
  - hien canh bao
  - cho user chon tay plan

### 6.5 `/projects/[id]/diary`

Diary nen hien tham chieu:
- active milestone luc tao nhat ky
- active stage

Tinh trang UI hien tai:
- diary da co lop van hanh doc lieu ro hon:
  - phan trang that
  - bo loc theo ngay / ca lam / chat luong / an toan / muc hien thi
  - viewer full-screen cho anh/video nhat ky
- nhung phan tren moi la lop xem va tra cuu; chua thay doi quy uoc "diary nen tham chieu active milestone / active stage" neu muon chuan hoa sau.

Ve sau co the luu snapshot:
- diary nay thuoc milestone nao

## 7) Notification / timeline nen sinh

Can co event timeline khi:
- doi `status`
- doi `stage`
- doi `active milestone`
- kich hoat `active material plan`
- kich hoat `active labor plan`
- plan bi `superseded`

Notification nen can nhac cho:
- owner du an
- default owner
- quan ly du an neu co
- doi kho / doi labor khi active plan doi

## 8) Phase trien khai de xuat

### Phase 1 - Chuan hoa logic doc
- Khong doi schema hoac doi rat it
- Them helper suy ra:
  - active milestone
  - active material plan
  - active labor plan
  - stage de xuat
- Hien thi ro trong UI

### Phase 2 - Chuan hoa thao tac
- Them hanh dong:
  - dat active milestone
  - dat active material plan
  - dat active labor plan
- Them timeline / notification

### Phase 3 - Khoa nghiep vu
- Plan co phat sinh thuc te khong sua truc tiep
- Buoc qua revision
- Rule rang buoc status / milestone / plan chat hon

## 9) Nhung cau hoi nghiep vu da du ro

Da co the chot ngay:
- 1 project tai 1 thoi diem chi nen co 1 active milestone
- 1 loai plan tai 1 thoi diem chi nen co 1 active plan
- `status` la lop tong
- `milestone` la lop dieu hanh chinh
- `stage` la lop nhom nghiep vu
- `active plan` la lop van hanh de inventory / labor / operations dua vao

## 10) Nhung diem de sau

Chua can lam ngay:
- cho nhieu milestone song song
- auto doi `stage` 100% theo rule cung
- workflow approve nhieu cap cho plan
- rule checklist ho so theo active milestone
- SLA / escalation theo milestone

## 11) Ket luan

Neu khong chuan hoa truc nay, module du an se cang ngay cang kho mo rong vi:
- planning doc mot kieu
- operations doc mot kieu
- diary doc mot kieu
- report doc mot kieu

Neu chuan hoa truc nay, ca module `projects` se co mot "xuong song" ro rang:
- `status` cho biet vi tri trong vong doi
- `stage` cho biet cum nghiep vu
- `milestone` cho biet moc dang chay
- `active plan` cho biet ban ke hoach dang duoc van hanh

Do day la lop can uu tien truoc khi mo rong sau hon sang:
- issue management
- checklist ho so
- cost engine tu dong
- notification policy du an
