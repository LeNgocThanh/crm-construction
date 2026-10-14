# Mo rong Module Nhan cong - Phase 2

## 1. Muc tieu

Mo rong module `labor` de phu hop hon voi van hanh xay dung thuc te:

1. Phan biet `nhan cong cong ty` va `nhan cong thue ngoai`
2. Bo sung truc phan loai `skill_level` nhu:
   - `tho_chinh`
   - `tho_phu`
   - `to_truong`
   - `giam_sat_hien_truong`
3. Chuan hoa logic `tam ung` va doi chieu cong no nhan cong

Quy uoc nghiep vu bo sung:

- `tam ung` va `tat toan` chi ap dung cho `nhan cong cong ty`
- `nhan cong thue ngoai` khong di theo luong tam ung luong
- `payment_type = settlement` duoc hieu la `tat toan`

Nguyen tac:

- khong pha logic attendance / payment dang chay
- uu tien mo rong tren cac bang hien co
- phan tich ro `ke toan cong`, `cong no tam ung`, `thanh toan cuoi ky`

## 2. Nen hien tai da co

Module hien tai da co:

- `labor_trades`
- `labor_crews`
- `labor_workers`
- `project_labor_engagements`
- `project_labor_attendances`
- `project_labor_roster`
- `project_labor_payments`
- `project_labor_payment_batches`

Diem rat tot:

- `project_labor_payments.payment_type` da co:
  - `advance`
  - `payment`
  - `settlement`

Tuc la phan `tam ung` da co dat nen, nhung chua co logic day du de:

- biet mot nhan cong dang duoc tam ung bao nhieu
- con no tam ung bao nhieu
- ky thanh toan nay duoc tru tam ung nhu the nao

## 3. Mo hinh nghiep vu de xuat

### 3.1 Phan loai nhan cong

`LaborWorker` nen co them:

- `worker_category`
  - `company`
  - `external`
- `skill_level_key`
  - vd: `tho_chinh`, `tho_phu`, `to_truong`, `giam_sat`
- `employment_mode`
  - `daily`
  - `monthly`
  - `piecework`
  - `subcontract`

Y nghia:

- `worker_category` tra loi: nguoi nay la nguon luc cua cong ty hay thue ngoai
- `skill_level_key` tra loi: trinh do / vai tro thuc thi cua nguoi nay
- `employment_mode` tra loi: cach tinh cong / cach chi tra chinh

### 3.2 Trade va skill level la 2 truc khac nhau

Khong nen tron `trade` va `skill_level`.

Vi du:

- trade = `tho_xay`
- skill_level = `tho_chinh`

hoac:

- trade = `tho_son`
- skill_level = `tho_phu`

Dieu nay dung hon vi:

- cung 1 nghe co the co tho chinh / tho phu
- 1 nguoi co the thay doi ky nang / cap bac ma van thuoc nghe cu

### 3.3 Tam ung la giao dich cong no, khong chi la mot dong payment

Ve ky thuat co the van dung `project_labor_payments.payment_type = advance`.

Nhung ve nghiep vu can coi no la:

- mot giao dich phat sinh cong no nhan cong
- se duoc doi chieu voi:
  - cong da xac nhan
  - tien cong phai tra
  - tien da thanh toan
  - tien da tam ung

## 4. Logic cong no nhan cong can co

### 4.1 Cac chi so can theo doi theo nhan cong

Theo moi worker, trong mot khoang thoi gian / toan bo:

- `tong_cong_xac_nhan`
- `tong_tien_cong_xac_nhan`
- `tong_tam_ung`
- `tong_thanh_toan_thuong`
- `tong_quyet_toan`
- `so_du_cong_no`

Cong thuc de nghi:

- `tong_phai_tra = tong_tien_cong_xac_nhan`
- `tong_da_chi = tong_tam_ung + tong_thanh_toan_thuong + tong_quyet_toan`
- `con_phai_tra = tong_phai_tra - tong_da_chi`

Y nghia:

- duong: con no nhan cong
- am: da chi vuot, can doi chieu lai

### 4.2 Tam ung khong nhat thiet gan 1 ky cham cong

Tam ung co the:

- gan 1 du an
- gan 1 dot thi cong
- gan 1 worker
- khong can cho den ky chot cong

Vi du:

- hom nay tam ung 2 trieu cho tho A de di cong trinh
- cuoi tuan / cuoi ky se tru dan vao thanh toan phai tra

Rang gioi:

- chi cho `worker_category = company`
- khong ap cho `external`

### 4.3 Dot thanh toan can nhin thay tam ung

Trong `payment batch`, can co tong hop:

- cong phai tra
- da tam ung truoc do
- de xuat tru tam ung
- thuc chi ky nay

Noi cach khac:

- tam ung la khoan da chi
- khong duoc tinh lap lai thanh toan neu da ton tai

## 5. Thiet ke du lieu de xuat

### 5.1 Mo rong `labor_workers`

Them cac truong:

- `worker_category String?`
  - `company | external`
- `skill_level_id String?`
- `employment_mode String?`
  - `daily | monthly | piecework | subcontract`
- `base_salary BigInt?`
  - neu la nhan cong cong ty / nhan cong theo thang
- `identity_no String?`
- `address_text String?`
- `joined_at DateTime?`
- `left_at DateTime?`
- `payment_note String?`

### 5.2 Them bang master `labor_skill_levels`

Khong hardcode lau dai.

Bang de nghi:

- `id`
- `skill_key`
- `skill_name`
- `description`
- `sort_order`
- `is_active`

Seed mac dinh:

- `tho_chinh`
- `tho_phu`
- `to_truong`
- `giam_sat_hien_truong`
- `khac`

### 5.3 Khong can tao bang tam ung rieng o phase dau

Phase 2A nen tai su dung:

- `project_labor_payments`

bang cach:

- coi `payment_type = advance` la tam ung

Nhung can them helper / report de tong hop cong no.

Chi khi nghiep vu phinh hon moi can bang ledger rieng.

## 6. Logic UI/UX de xuat

### 6.1 Trang Nhan cong

Them tren form worker:

- Loai nhan cong
  - Nhan cong cong ty
  - Nhan cong thue ngoai
- Cap bac / ky nang
  - dropdown `skill_level`
- Hinh thuc lam viec
  - Theo cong
  - Theo thang
  - Theo khoan
  - To / doi nhan khoan

Neu `worker_category = company`:

- co the hien them luong co ban / ngay vao lam

Neu `worker_category = external`:

- uu tien thong tin lien he / ghi chu thanh toan / doi nhan khoan

### 6.2 Trang Cham cong

Khong can thay doi qua manh.

Nhung nen hien them:

- trade
- skill level
- worker category

de quan ly biet dang cham cong cho ai.

### 6.3 Trang Thanh toan cong

Can bo sung 2 view:

1. `Tam ung`
   - tao khoan tam ung cho worker
   - filter theo du an / worker / thoi gian
2. `Cong no`
   - worker
   - tong cong
   - tong tien cong
   - tong tam ung
   - tong da chi
   - con phai tra

### 6.4 Trong dot thanh toan

Khi chon worker / cong de thanh toan, can hien:

- Da tam ung: xxx
- Tong cong da xac nhan: xxx
- De xuat thuc chi: xxx

## 7. Ranh gioi nghiep vu quan trong

### 7.1 Nhan cong cong ty va nhan su noi bo khong phai mot

Khong nen ep `labor_worker` thanh `user`.

Ly do:

- nhieu tho khong can tai khoan he thong
- nguoi cham cong / quan ly / ke toan moi can user
- worker la doi tuong nghiep vu, khong phai tai khoan

### 7.2 1 worker co the thuoc crew nay, mai sang crew khac

Vi vay:

- `crew_id` tren worker chi nen la `crew mac dinh / hien tai`
- lich su tham gia du an van di qua:
  - `project_labor_engagement`
  - `project_labor_roster`

### 7.3 Tam ung co the theo worker, khong can bat buoc theo attendance

Neu ep gan tung khoan tam ung vao attendance se rat cung.

Dung hon la:

- tam ung gan worker + project + ngay
- sau do doi chieu theo ky thanh toan

## 8. De xuat phase lam viec

### Phase 2A - lam ngay, it rui ro

1. Tao bang `labor_skill_levels`
2. Seed `skill_level` mac dinh
3. Mo rong `labor_workers`:
   - `worker_category`
   - `skill_level_id`
   - `employment_mode`
   - them mot vai field co ban
4. Sua UI `/labor` de nhap duoc cac field moi
5. Them bo loc theo:
   - loai nhan cong
   - skill level
6. Tren `/labor/payments` bo sung view tong hop:
   - tong tam ung
   - tong da chi
   - con phai tra

### Phase 2B - tam ung thuc chien

1. Form tao `tam ung`
2. Filter / report tam ung theo worker / project / time
3. Hien so du tam ung trong dot thanh toan
4. PDF phieu tam ung

### Phase 2C - doi chieu va khoa ky

1. chot ky thanh toan
2. khoa cong da dua vao quyet toan
3. canh bao chi vuot
4. doi chieu tam ung / thanh toan / cong no

## 9. Kien nghi chot

Neu uu tien gia tri / rui ro tot nhat, nen lam theo thu tu:

1. `skill_level` + `worker_category`
2. view tong hop `tam ung / cong no`
3. form `tam ung`

Khong nen nhay ngay vao ledger qua sau ngay luc nay.

Nen tan dung:

- `project_labor_payments.payment_type = advance`

de mo nhanh tinh nang ma van giu duoc tinh mo rong sau nay.

## 10. Tinh trang trien khai

Da lam:

1. Tao bang `labor_skill_levels`
2. Seed cap bac mac dinh:
   - `tho_chinh`
   - `tho_phu`
   - `to_truong`
   - `giam_sat_hien_truong`
   - `khac`
3. Mo rong `labor_workers` voi:
   - `skill_level_id`
   - `worker_category`
   - `employment_mode`
4. Them API:
   - `GET/POST /api/labor/skill-levels`
   - `PATCH/DELETE /api/labor/skill-levels/[id]`
5. Cap nhat API `/api/labor/workers` de doc/ghi:
   - `skill_level_id`
   - `worker_category`
   - `employment_mode`
6. Cap nhat UI `/labor`:
   - CRUD cap bac tay nghe
   - form nhan cong co loai nhan cong, cap bac, hinh thuc lam viec
   - bo loc theo loai nhan cong / cap bac
   - goi y don gia theo `skill_level` cho nhan cong thue ngoai neu chua co don gia rieng

Chua lam:

1. Form `tam ung`
2. Bao cao cong no / tam ung theo worker
3. Logic doi chieu tam ung vao dot thanh toan

Da lam them sau spec ban dau:

1. `Tam ung` va `tat toan` chi cho `nhan cong cong ty`
2. Them API tong hop cong no nhan cong:
   - `GET /api/labor/worker-balances`
3. Trang `/labor/payments` hien:
   - tong da tam ung
   - tong da thanh toan dot
   - tong da tat toan
   - con phai tat toan
4. Form thanh toan cong:
   - neu chon `tam ung` / `tat toan` thi chi cho chon nhan cong cong ty
   - neu chon `tat toan` se goi y so tien con lai
5. In an / bao cao:
   - co the in phieu rieng cho tung dong `tam ung` / `tat toan`
   - co the in `bao cao tam ung noi bo` theo bo loc thoi gian hien tai
   - bao cao tam ung noi bo gom tong hop theo nhan cong va chi tiet tung lan tam ung
