# Inventory Stock Audit Guide

## Muc tieu

Them nghiep vu kiem ke kho tach rieng voi phieu nhap/xuat/dieu chinh:

1. chup ton so tai mot thoi diem
2. nhap so dem thuc te
3. tinh chenh lech theo tung vat tu
4. khi xac nhan moi sinh phieu `adjust` de cap nhat ton kho

## Vi sao khong dung thang phieu adjust

Neu dung thang `adjust`:

- mat lich su "ton so luc kiem ke la bao nhieu"
- khong biet ai da dem, dem luc nao
- khong co buoc doi chieu truoc khi ghi so

Vi vay Phase 1 tach thanh 1 lop rieng:

- `inventory_stock_audits`
- `inventory_stock_audit_items`

Sau do moi sinh `inventory_transactions` loai `adjust`.

## Trang thai phieu kiem ke

1. `draft`
- vua tao snapshot ton so
- duoc nhap / sua so dem

2. `counted`
- da chot so dem
- cho phep doi chieu truoc khi ap chenh lech

3. `applied`
- da sinh phieu dieu chinh kho
- da ghi so chenh lech vao ton kho

4. `cancelled`
- huy phieu

## Luong nghiep vu Phase 1

1. Tao phieu kiem ke theo kho
- lay snapshot tu `warehouse_stocks`
- mac dinh chi lay dong co ton khac 0

2. Nhap so dem thuc te
- `counted_qty`
- `variance_qty = counted_qty - book_qty`
- `variance_value = variance_qty * avg_unit_cost`

3. Chot kiem ke
- khoa buoc dem
- luu thong tin nguoi chot va thoi diem

4. Ap chenh lech
- neu co dong chenh lech:
  - tao 1 phieu `inventory_transaction`
  - `txn_type = adjust`
  - `reference_type = stock_audit`
  - `reference_id = audit_id`
- sau do goi posting engine hien co

## API Phase 1

### 1. `GET /api/inventory/audits`
- danh sach phieu kiem ke
- loc theo kho, trang thai
- co phan trang

### 2. `POST /api/inventory/audits`
- tao phieu kiem ke moi
- input:
  - `warehouse_id`
  - `audit_date`
  - `note`
  - `include_zero`

### 3. `GET /api/inventory/audits/:id`
- xem chi tiet phieu + dong vat tu

### 4. `PATCH /api/inventory/audits/:id`
- cap nhat ghi chu
- cap nhat `counted_qty`, `note` tung dong
- chi cho phep khi `draft`

### 5. `POST /api/inventory/audits/:id/actions`
- `{ action: "counted" }`
- `{ action: "reopen" }`
- `{ action: "apply" }`
- `{ action: "cancel" }`

## UI Phase 1

Trang:
- `/inventory/audits`

Co:
- form tao phieu kiem ke
- danh sach phieu ben trai
- chi tiet phieu ben phai
- nhap so dem thuc te
- luu so dem
- chot kiem ke
- mo lai
- ap chenh lech
- huy phieu

## Gioi han hien tai

1. chua co in / PDF phieu kiem ke
2. chua co kiem ke theo khu / ke / vi tri
3. chua co kiem ke theo nhom vat tu
4. chua co workflow phe duyet nhieu cap
5. chua co ly do chenh lech theo danh muc

## Mo rong tiep theo

1. them bo loc theo vat tu / nhom vat tu
2. them in phieu kiem ke
3. them bao cao lich su chenh lech kiem ke theo kho
4. them canh bao vat tu lech lap lai nhieu lan
5. lien ket nguoc tu phieu `adjust` ve phieu kiem ke tren UI
