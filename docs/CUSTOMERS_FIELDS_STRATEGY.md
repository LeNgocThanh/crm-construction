# CUSTOMERS TABLE - GIU, THEM, TACH

## Muc tieu
Tai lieu nay ra quyet dinh cho bang `customers`:
- Truong nao giu o bang goc.
- Truong nao can them de phuc vu nghiep vu.
- Truong nao nen tach sang bang khac de tranh phinh bang va de quan tri lich su.

## Hien trang bang `customers`

Truong hien co:
- Dinh danh: `id`
- Lien he co ban: `phone_number`, `full_name`
- Pipeline: `status`
- Nhu cau xay dung: `address`, `house_type`, `floors`, `floor_area`, `budget_min`, `budget_max`
- Danh gia tiem nang: `potential_score`, `potential_level`, `next_action`
- Nguon khach: `source`, `referrer_name`, `referrer_phone`
- Social id: `telegram_id`, `telegram_username`, `zalo_id`, `zalo_username`, `messenger_id`, `messenger_username`
- Van hanh: `assigned_to`, `total_contacts`, `created_at`, `updated_at`

## 1) Nhom GIU o bang `customers`

### Core identity va lookup nhanh
- `id`
- `phone_number` (unique)
- `full_name`
- `created_at`, `updated_at`

Ly do:
- Day la danh tinh co ban, duoc dung o rat nhieu query list/detail.

### Pipeline hien tai (giu de tuong thich)
- `status`
- `assigned_to`
- `next_action`
- `potential_score`, `potential_level`
- `total_contacts`

Ly do:
- Dang duoc dung truc tiep boi API list/kanban va can bo loc nhanh.
- `next_action` can tiep tuc giu la truong cache hien thi nhanh.

### Nguon den khach
- `source`

Ly do:
- Hay dung de thong ke va filter dashboard.

## 2) Nhom THEM vao `customers` (nen them ngay)

### Thong tin van hanh CRM
- `customer_code String? @unique`
- `is_active Boolean @default(true)`
- `last_contact_at DateTime?`
- `last_activity_at DateTime?`
- `next_action_due_at DateTime?`

Ly do:
- `customer_code`: de trao doi nghiep vu, tim nhanh theo ma.
- `is_active`: soft archive khach thay vi xoa.
- `last_contact_at`/`last_activity_at`: sort danh sach uu tien cham soc.
- `next_action_due_at`: danh dau qua han khong can parse text.

### So huu du lieu va audit
- `owner_team String?` (neu can nhom theo team)
- `updated_by String?` (user cap nhat gan nhat)

Ly do:
- Ho tro kiem soat trach nhiem va truy vet thao tac.

## 3) Nhom NEN TACH khoi `customers`

### A. Referrer detail
Hien tai:
- `referrer_name`, `referrer_phone`

De xuat:
- Tach sang bang `customer_referrals` (1-n)

Ly do:
- 1 khach co the duoc gioi thieu boi nhieu nguon/nguoi qua thoi gian.
- Can luu lich su gioi thieu, trang thai hoa hong, campaign.

### B. Social profile
Hien tai:
- `telegram_id`, `telegram_username`, `zalo_id`, `zalo_username`, `messenger_id`, `messenger_username`

De xuat:
- Tach sang bang `customer_social_profiles` (1-n)

Ly do:
- 1 khach co the co nhieu tai khoan theo tung kenh, tung thoi diem.
- Can danh dau tai khoan chinh/phu, active/inactive, verify.
- Giam cot null trong bang `customers`.

### C. Nhu cau xay dung theo thoi gian
Hien tai:
- `address`, `house_type`, `floors`, `floor_area`, `budget_min`, `budget_max`

De xuat:
- De trung han: giu tren `customers` de bo loc nhanh.
- Dai han: tach snapshot sang bang `customer_requirement_snapshots` (1-n), bang `customers` giu ban moi nhat.

Ly do:
- Nhu cau thay doi nhieu lan; can lich su thay doi de so sanh.

## 4) Rule nghiep vu khuyen nghi cho `next_action`

- Nguon su that la `customer_care_activities` (action open gan nhat theo due date).
- `customers.next_action` la cache.
- Them `customers.next_action_due_at` de query qua han nhanh.
- Moi lan dong/mo action trong care activities thi sync nguoc:
- `next_action`
- `next_action_due_at`
- `last_activity_at`

## 5) Lo trinh tach an toan (khong vo logic hien tai)

### Pha 1 (ngay)
- Giu nguyen schema cu.
- Them cac cot moi an toan trong `customers`:
- `customer_code`, `is_active`, `last_contact_at`, `last_activity_at`, `next_action_due_at`, `updated_by`

### Pha 2
- Tao bang moi:
- `customer_social_profiles`
- `customer_referrals`
- Viet dual-write tu API: vua ghi bang moi vua giu cot cu.

### Pha 3
- Chuyen read path sang bang moi.
- Cot cu de che do fallback.
- On dinh xong moi danh dau deprecated cot cu.

## 6) Quyet dinh nhanh de team chot

Giu:
- `status`, `assigned_to`, `next_action`, `potential_*`, `source`, `total_contacts`

Them ngay:
- `customer_code`, `is_active`, `last_contact_at`, `last_activity_at`, `next_action_due_at`, `updated_by`

Tach ra:
- `referrer_name/referrer_phone` -> `customer_referrals`
- toan bo social id/username -> `customer_social_profiles`
- nhu cau xay dung lich su -> `customer_requirement_snapshots` (pha sau)

