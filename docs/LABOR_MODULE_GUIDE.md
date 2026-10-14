# Labor Module Guide (Nhan cong / To doi / Cham cong / Thanh toan cong)

## 1) Muc tieu
- Tach **nhan cong thi cong** ra khoi **nhan su noi bo**.
- Quan ly:
  - danh muc nghe
  - doi/to thi cong
  - nhan cong
  - phan cong vao du an
  - cham cong
  - thanh toan cong
  - bao cao tong hop
- Lien ket du lieu nhan cong voi du an de:
  - lap ke hoach nhan cong
  - cham cong tu nhat ky thi cong
  - theo doi chi phi nhan cong da phat sinh / da chi / con phai tra

## 2) Pham vi hien tai

### 2.1) Trang UI
- `/labor`
  - Bang dieu khien nhan cong
  - Quan ly danh muc nghe, doi, nhan cong
- `/labor/assignments`
  - Phan cong khoan viec / gan nhan cong vao cong viec
- `/labor/attendance`
  - Cham cong
  - Duyet cham cong sinh tu nhat ky
- `/labor/payments`
  - Thanh toan cong
  - Theo doi da chi / con phai tra
- `/labor/reports`
  - Bao cao cham cong da xac nhan
- `/projects/[id]/labor`
  - Danh sach nhan cong mac dinh cua du an
- `/projects/[id]/diary`
  - Co phan cham cong tuy chon tu nhat ky
- `/projects/[id]/overview`
  - Co khoi tong quan tai chinh nhan cong cua du an
  - Co timeline thanh toan cong cua du an

### 2.2) API
- `GET/POST /api/labor/trades`
- `PATCH/DELETE /api/labor/trades/:id`
- `GET/POST /api/labor/crews`
- `PATCH/DELETE /api/labor/crews/:id`
- `GET/POST /api/labor/workers`
- `PATCH/DELETE /api/labor/workers/:id`
- `GET/POST /api/labor/engagements`
- `PATCH/DELETE /api/labor/engagements/:id`
- `GET/POST /api/labor/attendances`
- `PATCH/DELETE /api/labor/attendances/:id`
- `GET/POST /api/labor/payments`
- `PATCH/DELETE /api/labor/payments/:id`
- `GET/POST /api/labor/payment-batches`
- `PATCH /api/labor/payment-batches/:id`
- `POST /api/labor/payment-batches/:id/actions`
- `GET/POST /api/projects/:id/labor-roster`
- `PATCH/DELETE /api/projects/:id/labor-roster/:rosterId`
- `GET/POST /api/projects/:id/diary`
- `PATCH/DELETE /api/projects/:id/diary/:entryId`

## 3) Du lieu chinh

### 3.1) Master data
- `LaborTrade`
  - loai nghe / nhom tho
- `LaborCrew`
  - doi / to thi cong
- `LaborWorker`
  - nhan cong ca nhan

### 3.2) Van hanh
- `ProjectLaborEngagement`
  - phan cong / khoan viec / gan nhan cong vao du an
  - hien tai da co `plan_id` de gan phan cong vao ke hoach nhan cong cu the
- `ProjectLaborAttendance`
  - dong cham cong
- `ProjectLaborPayment`
  - dong thanh toan cong

### 3.3) Tich hop du an
- `ProjectLaborRoster`
  - danh sach nhan cong mac dinh cua tung du an

## 4) Nguyen tac nghiep vu hien tai

### 4.1) Nhan cong khac nhan su
- Nhan cong khong bat buoc co tai khoan he thong.
- Nhan cong phuc vu thi cong, co the tham gia nhieu du an.
- Nhan su noi bo van di theo module user/phan quyen rieng.

### 4.2) Ma tu sinh
- Ma nghe, ma doi, ma nhan cong co the de trong.
- He thong tu sinh ma tu ten.
- Nguoi dung van co the sua tay neu can.

### 4.3) Quan ly nghe va doi
- Hien tai moi nhan cong co:
  - 1 nghe chinh
  - 1 doi hien tai
- Day la pham vi Phase 1.
- Chua co lich su nhieu nghe / nhieu doi theo thoi gian.

### 4.4) Nhan cong mac dinh cua du an
- Moi du an co the gan 1 danh sach nhan cong mac dinh.
- Danh sach nay dung de:
  - chon nhanh khi cham cong
  - chon nhanh trong nhat ky thi cong
- Mac dinh trang `/projects/[id]/labor` chi hien nhan cong chua duoc gan cho du an khac.
- Co tick `Hien tat ca nhan cong` de cho phep 1 nhan cong tham gia nhieu du an.
- Van chan viec gan trung 1 nhan cong 2 lan trong cung 1 du an.

### 4.5) Phan cong nhan cong va ke hoach dang van hanh
- `roster` chi la danh sach mac dinh cap du an, khong bi ep theo plan.
- `engagement` moi la lop van hanh can bam vao ke hoach nhan cong.
- Neu du an da co `active_labor_plan_id`:
  - phan cong moi qua `/api/labor/engagements` se tu dong bam vao plan dang van hanh
  - khong duoc sua/gian phan cong sang 1 labor plan khac
  - phan cong thuoc labor plan cu, khong con la plan dang van hanh, se bi chan sua/xoa de tranh lam lech truc van hanh
- Plan duoc gan engagement phai la plan:
  - thuoc dung du an
  - dang `approved` hoac `locked`
  - co item `resource_kind = labor`

## 5) Huong dan su dung theo trang

### 5.1) `/labor` - Bang dieu khien nhan cong
Dung de tao du lieu nen truoc khi van hanh.

#### a) Danh muc nghe
- Tao nghe nhu:
  - tho xay
  - tho dien
  - tho son
  - phu ho
- Nen tao day du de:
  - lap ke hoach nhan cong
  - loc bao cao
  - tong hop chi phi theo loai tho

#### b) Danh muc doi
- Tao doi/to thi cong.
- Dung khi can quan ly theo to doi thuc te.

#### c) Danh muc nhan cong
- Tao ho so nhan cong.
- Gan nghe chinh, doi hien tai, so dien thoai, ghi chu neu can.

### 5.2) `/projects/[id]/labor` - Nhan cong mac dinh cua du an
- Chon nhan cong se thuong xuyen lam tai du an.
- Day la buoc nen lam som sau khi tao du an.
- Sau khi da gan:
  - `/projects/[id]/diary` co the cham cong nhanh cho dung nhung nguoi nay
  - `/labor/attendance` de loc va thao tac theo du an nhanh hon

### 5.3) `/labor/assignments` - Phan cong khoan viec
- Dung de gan nhan cong/doi vao du an va cong viec.
- Hien tai chu yeu la luu nghiep vu phan cong co ban.
- Chua co logic sau ve khoan doanh thu, khoan khoi luong hay quyet toan phuc tap.

Luu y moi:
- Neu du an da chon `ke hoach nhan cong dang van hanh`, phan cong tao/sua tu trang nay se phai di theo ke hoach do.
- Muc dich la giu cho:
  - phan cong
  - attendance
  - bao cao du/thieu/thua nhan cong
  cung nam tren 1 truc van hanh ro rang.

#### Y nghia trang thai phan cong
- `planned`: da len ke hoach
- `active`: dang thuc hien
- `paused`: tam dung
- `completed`: hoan thanh
- `cancelled`: da huy

### 5.4) `/projects/[id]/diary` - Cham cong tu nhat ky
- Phan cham cong trong nhat ky la **khong bat buoc**.
- Chi cho chon nhan cong da gan vao du an.
- Muc dich:
  - nhap nhanh thong tin cong phat sinh trong ngay
  - chua tinh la cham cong chot

Bo tro UI da co:
- danh sach nhat ky da co:
  - phan trang that
  - giu trang thai tren URL
  - bo loc theo:
    - tu ngay / den ngay
    - ca lam
    - chat luong
    - an toan
    - muc hien thi
- media trong nhat ky mo bang viewer full-screen noi bo, khong bat ra URL goc.

#### Quy tac cong mac dinh trong nhat ky
- `full_day` -> `1 cong`
- `night` -> `1 cong`
- `morning` -> `0.5 cong`
- `afternoon` -> `0.5 cong`

Luu y:
- Trong nhat ky **khong sua so cong tuy y**.
- Neu can sua so cong khac muc mac dinh, phai qua trang `/labor/attendance`.
- Cac thao tac nhanh tu nhat ky nhu:
  - `Tao viec`
  - `Canh bao`
  - `Bao thieu vat tu`
  chi duoc tao trong tuan hien tai cua ban ghi nhat ky.

#### Kiem soat trung/xung dot
- Khong cho tao nhat ky xung dot `full_day` voi `morning/afternoon` cung ngay cua cung du an.
- Attendance tao tu nhat ky cung bi chan xung dot theo:
  - nhan cong
  - ngay
  - ca lam
  - du an

### 5.5) `/labor/attendance` - Cham cong
Trang nay gom 2 luong:

#### a) Danh sach cham cong tu nhat ky
- Nguon: tao tu `/projects/[id]/diary`
- Trang thai: `draft`
- Co the:
  - sua so cong
  - sua so tien
  - sua ghi chu
  - bam `Xac nhan`

#### b) Danh sach cham cong da xac nhan
- Day moi la du lieu cham cong thuc te de bao cao va tinh chi phi.
- Cham cong tao tay o trang nay di thang vao nhom da xac nhan.

#### Quy tac xac nhan
- Attendance `draft` sinh tu nhat ky chua duoc tinh la cham cong chot.
- Sau khi `Xac nhan`, dong do moi duoc dua vao:
  - bao cao cham cong
  - tong hop chi phi nhan cong
  - du lieu tai chinh nhan cong cua du an

#### Lien ket voi labor plan
- Attendance duoc xem la “thuoc ke hoach nao” thong qua `engagement_id`.
- Khi xem actual summary cua 1 ke hoach nhan cong trong module project, he thong chi tong hop attendance co `engagement.plan_id` dung bang plan do.
- Neu attendance khong gan engagement thi khong nen coi la da gan vao 1 labor plan cu the.

### 5.6) `/labor/reports` - Bao cao cham cong
Chi lay **cham cong da xac nhan**.

#### Bo loc hien co
- Du an
- Loai ca
- Tuan nay
- Thang nay
- Tu chon khoang ngay

#### Cac khoi tong hop
- Tong so dong cham cong
- Tong cong
- Tong tien cong
- Tong hop theo loai ca

#### Bang tong hop theo ngay + nhan cong
- Khong tach tung ca nua.
- Moi dong la:
  - Ngay
  - Nhan cong
  - Tong cong
  - Tong tien cong
- Dong cuoi bang co:
  - Tong so nhan cong
  - Tong toan bo cong
  - Tong toan bo tien cong

#### Xuat PDF
- Co nut xuat PDF bang tong hop.
- Cach hien tai la mo ban in de luu PDF tu trinh duyet.

### 5.7) `/labor/payments` - Thanh toan cong
Dung de quan ly 2 lop:
- **Dot thanh toan cong**: action nghiep vu
- **Dong thanh toan cong**: chi tiet chi tra

#### a) Dot thanh toan cong
- Moi dot co:
  - ten dot
  - ky thanh toan
  - ngay chi du kien
  - loai dot
  - trang thai
- Trang thai hien co:
  - `draft`: nhap
  - `approved`: da duyet
  - `paid`: da chi thuc te
  - `cancelled`: da huy

#### Action cua dot
- `Duyet`
- `Da chi`
- `Huy`
- `Mo lai`

#### Nguyen tac
- Dot `paid` hoac `cancelled` thi cac dong chi tiet ben trong bi khoa.
- Chi phi nhan cong **da chi thuc te** chi tinh:
  - dong thanh toan khong gan dot
  - hoac dong nam trong dot co `status = paid`

#### b) Dong thanh toan cong
Truong chinh:
- Du an
- Dot thanh toan (neu co)
- Phan cong (neu co)
- Nhan cong
- Doi
- Ngay thanh toan
- Loai thanh toan
- So tien
- Ghi chu

#### Loai thanh toan hien co
- `advance`: tam ung
- `payment`: thanh toan dot
- `settlement`: quyet toan

#### Tong hop tren trang
- Tong so dong thanh toan
- Gia tri cac dong thanh toan
- Cong da ghi nhan trong ky
- Da chi thuc te trong ky
- Con phai tra trong ky

#### Bang tong hop
- Theo nhan cong / doi
- Theo du an
- Theo dot thanh toan

#### In / xuat PDF
- Moi dot thanh toan co nut `In / xuat PDF`.
- He thong mo bang in rieng cua dot do.
- Tu cua so in, nguoi dung co the:
  - in truc tiep
  - hoac luu thanh file PDF

#### Notification va timeline
- Khi dot chuyen `approved`:
  - tao event timeline cho du an
  - gui notification cho nguoi lien quan
- Khi dot chuyen `paid`:
  - tao event timeline cho du an
  - gui notification cho nguoi lien quan
- Doi tuong nhan notification hien tai:
  - nguoi tao dot
  - owner cua du an
  - default owner cua du an
  - bo qua nguoi vua thao tac de tranh tu thong bao cho chinh minh

## 6) Lien ket voi module Du an

### 6.1) Planning
- Trong `/projects/[id]/planning`, item nhan cong co the chon **loai tho** tu danh muc nghe.
- Bao cao thuc te nhan cong hien tai da co tong hop du/thieu/thua theo nghe.
- So lieu thuc te nay da duoc siết theo `engagement.plan_id`, khong con tong hop tron tat ca attendance cua du an vao moi plan.

### 6.2) Overview
`/projects/[id]/overview` co khoi **Tai chinh nhan cong** gom:
- Ke hoach nhan cong
- Cong thuc te da ghi nhan
- Da chi nhan cong
- Con phai tra
- Tong cong ke hoach
- Tong cong thuc te
- Lech ke hoach nhan cong
- Du tien tra cong hien tai

Ngoai ra overview da co:
- `Timeline thanh toan cong`
  - tao dot
  - cap nhat dot
  - duyet dot
  - xac nhan da chi
  - huy / mo lai dot

### 6.3) Dashboard du an
- Trang dashboard du an co khoi:
  - `Du an dang no cong nhieu nhat`
- Muc dich:
  - nhin nhanh du an nao dang co nghia vu tra cong lon
  - canh bao du an sap thieu tien tra cong

### 6.4) Danh sach du an
- Moi du an co the duoc gan canh bao:
  - `Du tien tra cong`
  - `Sap thieu tien tra cong`
  - `Thieu tien tra cong`

## 7) Y nghia cac chi so tai chinh nhan cong

### 7.1) Ke hoach nhan cong
- Tong chi phi nhan cong theo cac item nhan cong trong ke hoach duoc duyet/ap dung.

### 7.2) Cong thuc te da ghi nhan
- Tong tien cong tu **attendance da xac nhan**.
- Chua chac da chi.

### 7.3) Da chi nhan cong
- Tong tien tu `ProjectLaborPayment`.

### 7.4) Con phai tra
- `Cong thuc te da ghi nhan - Da chi nhan cong`

### 7.5) Du tien tra cong hien tai
- Doi voi project overview:
  - lay `cash_on_hand - con_phai_tra`
- Dung de biet:
  - du an con du tien tra cong
  - sap thieu
  - hay da thieu

## 8) Luong du lieu thuc te

### Luong 1: Tao du lieu nen
1. Tao nghe
2. Tao doi
3. Tao nhan cong

### Luong 2: Gan nhan cong vao du an
1. Vao `/projects/[id]/labor`
2. Chon nhan cong mac dinh
3. Luu roster

### Luong 3: Phat sinh cong trong ngay
1. Vao `/projects/[id]/diary`
2. Tao nhat ky
3. Tick nhan cong co lam ngay do
4. Luu nhat ky

Ket qua:
- He thong tao attendance `draft`

### Luong 4: Xac nhan cham cong
1. Vao `/labor/attendance`
2. Kiem tra danh sach tu nhat ky
3. Sua neu can
4. Bam `Xac nhan`

Ket qua:
- Attendance thanh `confirmed`
- Duoc dua vao bao cao va chi phi thuc te

### Luong 5: Thanh toan cong
1. Vao `/labor/payments`
2. Tao dot thanh toan neu can quan ly theo dot
3. Them cac dong thanh toan vao dot
4. Duyet dot
5. Danh dau `Da chi` khi tien da tra thuc te

Hoac:
- Tao dong thanh toan truc tiep khong qua dot
- Truong hop nay he thong xem nhu da chi thuc te ngay

Ket qua:
- Du an cap nhat duoc so da chi va con phai tra

## 9) Gioi han hien tai
- Chua co lich su 1 nhan cong lam nhieu nghe theo thoi gian.
- Chua co lich su 1 nhan cong chuyen qua nhieu doi theo thoi gian.
- Chua co quy trinh luong phuc tap:
  - tang ca
  - thuong
  - phat
  - khau tru
  - quyet toan tu dong
- Chua co quy trinh dong bo voi ke toan chinh thuc.
- Trang `assignments` hien tai moi la muc luu nghiep vu co ban, chua phat trien sau phan khoan viec.

## 10) Mo rong nen lam sau
- Lich su nghe / doi cua nhan cong
- Bao cao thanh toan cong theo thang / theo nhan cong / theo du an
- Canh bao nhan cong sap den ky tra cong
- KPI theo doi thi cong / doi tho
- Quy trinh tam ung -> thanh toan dot -> quyet toan ro hon
- Dong bo voi module tai chinh / ke toan neu sau nay tach rieng
