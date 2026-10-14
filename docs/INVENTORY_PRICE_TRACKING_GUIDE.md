# Inventory Price Tracking Guide

## Muc tieu

Tach ro 2 lop gia de theo doi dung:

1. Gia cau hinh / gia NCC
- Nguon: `supplier_material_prices`
- Dung cho bang gia, bao gia, so sanh nha cung cap

2. Gia thuc te / gia van hanh kho
- Nguon moi:
  - `inventory_material_price_logs`
  - `inventory_cost_cycles`
- Dung cho theo doi bien dong gia mua thuc te va vong gia ton

## Tai sao can 2 lop gia

`avg_unit_cost` trong kho tra loi cau hoi:
- "Hang trong kho hien dang mang gia von binh quan bao nhieu?"

Nhung no khong tra loi tot cac cau hoi:
- NCC A thang nay tang gia bao nhieu?
- Lan nhap thuc te gan nhat mua gia nao?
- Sau khi clear stock, gia binh quan moi bat dau tu khi nao?

Vi vay Phase 1 them 2 bang moi de giai quyet.

## Schema moi

### 1. `inventory_material_price_logs`

Luu moi lan gia thuc te phat sinh:
- theo vat tu
- theo NCC neu co
- theo kho neu co
- theo phieu kho / dong phieu kho
- kem so luong, thanh tien, thoi diem, cycle_no

Muc dich:
- xem lich su gia nhap thuc te
- so sanh NCC theo thoi gian
- lam nguon cho dashboard bien dong gia

### 2. `inventory_cost_cycles`

Luu tung vong gia ton cua vat tu trong moi kho:
- khi ton da ve 0, vong cu dong lai
- khi nhap moi sau do, mo vong moi

Muc dich:
- theo doi gia binh quan theo tung doi ton
- biet ro sau `clear stock` thi tu khi nao bat dau vong moi
- tranh tron gia cu va gia moi vao cung mot lich su mo ho

## Auto-log da trien khai

Khi `postInventoryTransaction()` ghi so phieu kho:

1. Neu la `in` / `transfer_in`
- cap nhat ton kho nhu hien tai
- mo `inventory_cost_cycle` neu truoc do khong con vong mo
- ghi `inventory_material_price_log` neu co `unit_price`

2. Neu la `adjust` tang ton (`quantity > 0`)
- co the mo lai vong gia moi neu ton truoc do da ve 0
- ghi `inventory_material_price_log` neu co `unit_price`

3. Neu la `out` / `transfer_out` / `adjust` giam ton
- cap nhat ton kho nhu hien tai
- neu ton ve 0 -> dong `inventory_cost_cycle` hien tai voi `reset_reason = clear_stock`

## Nguyen tac nghiep vu

1. `supplier_material_prices`
- la bang gia cau hinh
- khong bi ghi de boi gia nhap thuc te

2. `inventory_material_price_logs`
- la su that phat sinh
- co the khac gia cau hinh

3. `avg_unit_cost`
- chi dung cho ton kho / xuat kho / gia von binh quan hien tai
- khong dung de dai dien cho gia NCC hien tai

4. Khi clear stock
- vong gia ton cu duoc dong
- lan nhap tiep theo mo vong gia ton moi

## Da lam trong Phase 1

1. API `GET /api/inventory/prices`
- loc theo kho, NCC, vat tu, loai gia, khoang thoi gian
- co phan trang
- tra ve:
  - lich su gia thuc te
  - vat tu tang gia / giam gia trong ky
  - NCC / vat tu bien dong manh
  - so sanh gia cau hinh va gia thuc nhap gan nhat

2. UI `/inventory/prices`
- bo loc day du
- dashboard tom tat bien dong gia
- bang top tang / giam
- bang NCC bien dong manh
- bang so sanh gia cau hinh vs gia thuc te
- bang lich su gia thuc te co phan trang

## Chua lam tiep

1. Cac canh bao:
- gia nhap tang manh
- NCC tang gia vuot nguong
- gia mua thuc te lech lon so voi bang gia
2. Auto dong bo gia thuc te vao de xuat bang gia NCC
- tam thoi khong lam de tranh ghi de nham "gia cau hinh" bang "gia mua mot lan"

## Buoc tiep theo de lam tiep

1. Them canh bao:
- tang > X%
- giam > Y%
- gia mua vuot bang gia NCC gan nhat

2. Them bieu do:
- trend gia theo vat tu
- trend gia theo NCC
- nhin theo vong gia ton

3. Export:
- da co xuat Excel cho `/inventory/prices`
- da co In / PDF cho `/inventory/prices`
- bao cao NCC tang gia theo ky de sau

## Luu y trien khai

Sau khi keo code:

1. chay `npx prisma db push`
2. neu can, chay lai `npx prisma generate`
3. neu muon co du lieu demo de xem ngay UI:
   - `npm run seed:inventory-price-tracking`

Neu muon xem du lieu moi, can ghi so them mot vai phieu nhap/xuat sau khi schema da duoc push.
