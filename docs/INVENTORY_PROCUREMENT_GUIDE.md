# Inventory Procurement Guide

## Muc tieu

Trien khai luong mua hang kho tach ro 3 buoc:

1. `De nghi mua`
- The hien nhu cau vat tu can mua.
- Chua lam thay doi ton kho.
- Co the chot NCC du kien hoac de trong.

2. `Don mua`
- Tao sau khi de nghi mua da duoc duyet.
- The hien thoa thuan dat mua voi NCC.
- Chua lam thay doi ton kho.

3. `Nhan hang vao kho`
- Tao `phieu nhap kho nhap` tu don mua khi hang ve.
- Chi khi `ghi so` phieu kho thi ton kho moi tang that.

## Schema moi

Them 4 bang:

1. `InventoryPurchaseRequest`
- Dau phieu de nghi mua.

2. `InventoryPurchaseRequestItem`
- Dong vat tu cua de nghi mua.

3. `InventoryPurchaseOrder`
- Dau phieu don mua.

4. `InventoryPurchaseOrderItem`
- Dong vat tu cua don mua.
- Co cac cot:
  - `ordered_qty`
  - `received_qty`
  - `draft_receipt_qty`

## API

### De nghi mua

1. `GET /api/inventory/purchase-requests`
- Loc theo kho, NCC, trang thai, tu khoa.

2. `POST /api/inventory/purchase-requests`
- Tao de nghi mua nhap.

3. `GET /api/inventory/purchase-requests/[id]`
- Lay chi tiet.

4. `PATCH /api/inventory/purchase-requests/[id]`
- Chi sua khi con `draft`.

5. `POST /api/inventory/purchase-requests/[id]/actions`
- `submit`
- `approve`
- `reject`
- `cancel`

### Don mua

1. `GET /api/inventory/purchase-orders`
- Loc theo kho, NCC, de nghi nguon, trang thai, tu khoa.

2. `POST /api/inventory/purchase-orders`
- Tao don mua thu cong hoac nap tu de nghi mua da duyet.

3. `GET /api/inventory/purchase-orders/[id]`
- Lay chi tiet.

4. `PATCH /api/inventory/purchase-orders/[id]`
- Chi sua khi con `draft`.

5. `POST /api/inventory/purchase-orders/[id]/actions`
- `confirm`
- `cancel`
- `sync_receipts`
- `create_receipt_draft`

## Dong bo voi phieu kho

Khi phieu kho co:

- `reference_type = purchase_order`
- `reference_id = order_id`

thi he thong se tu dong tinh lai cho don mua:

- `received_qty`: tong so da ghi so
- `draft_receipt_qty`: tong so dang o phieu nhap nhap
- `remaining_qty`: so con lai co the nhan

Trang thai don mua:

- `confirmed`: chua nhan hang
- `partial_received`: da nhan mot phan
- `completed`: da nhan du
- `cancelled`: da huy

## UI

Trang moi:

- `/inventory/purchases`

Co 2 cum chinh:

1. `De nghi mua`
- Form tao/sua
- List loc theo kho, NCC, trang thai
- Nut gui duyet / duyet / tu choi / huy

2. `Don mua`
- Form tao/sua
- Co the nap nhanh tu de nghi mua dang chon
- Nut xac nhan / huy / dong bo nhan hang
- Khu tao `phieu nhan hang nhap` theo tung dong vat tu con lai

## Nguyen tac nghiep vu da chot

1. Dat mua khong dong nghia da co hang.
2. Don mua khong tu dong sinh phieu nhap kho posted.
3. Neu hang ve nhieu dot, cho phep tao nhieu phieu nhap nhap tu cung 1 don mua.
4. So luong con lai cua don mua duoc tinh tu thuc te phieu kho, khong tinh bang tay.

## Chua lam trong phase nay

1. Dieu chinh don mua sau khi da xac nhan theo quy trinh formal.
2. Cong no NCC / han thanh toan NCC.
3. Nhan hang mot phan co workflow nghiem thu chat luong rieng.
4. Tu dong sinh don mua tu purchase request theo rule phan quyen/approval phuc tap.
