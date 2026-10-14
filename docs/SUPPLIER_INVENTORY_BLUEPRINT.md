# Supplier + Inventory Blueprint (Phase 1)

## Mục tiêu
- Chuẩn hóa dữ liệu giá vật tư theo **nhà cung cấp**.
- Tạo nền dữ liệu cho mô hình **xuất nhập kho** nhiều kho.
- Giữ tương thích với luồng dự toán hiện tại.

## Đã triển khai trong phase này
- Thêm model DB:
  - `Supplier`
  - `SupplierMaterialPrice`
  - `Warehouse`
  - `WarehouseStock`
  - `InventoryTransaction`
  - `InventoryTransactionItem`
- Mở rộng quan hệ từ `EstimationCatalogItem` sang:
  - giá NCC
  - tồn kho
  - dòng phiếu kho
- Thêm API quản trị:
  - `GET/POST /api/settings/suppliers`
  - `PATCH/DELETE /api/settings/suppliers/:id`
  - `GET/POST /api/settings/supplier-prices`
  - `PATCH/DELETE /api/settings/supplier-prices/:id`
- Cập nhật `engine-v2`:
  - đọc giá từ cả bảng cũ `estimation_material_prices`
  - và bảng mới `supplier_material_prices`
  - nếu chưa migrate bảng mới, hệ thống tự fallback bảng cũ.

## Nguyên tắc giá
- Báo giá luôn có snapshot policy + giá đã chọn.
- Policy hỗ trợ: `lowest | highest | standard | premium`.
- Có thể chỉ định NCC ưu tiên (`preferred_supplier_key`) và chế độ match.

## Lộ trình phase tiếp theo
1. UI admin cho NCC + giá NCC.
2. UI kho:
   - Danh mục kho
   - Tồn kho theo item
   - Phiếu nhập/xuất/điều chỉnh
3. Engine kho:
   - Cập nhật tồn theo transaction
   - Cảnh báo thiếu tồn theo ngưỡng `min_qty`
4. Kết nối dự toán với kho:
   - Khi generate, hiển thị item thiếu tồn
   - Gợi ý NCC theo policy (rẻ nhất/cao cấp/NCC chuẩn).


## Cap nhat moi: Inventory Phase A (Backend da lam)

### API moi
- `GET /api/inventory/transactions`
- `POST /api/inventory/transactions` (tao phieu kho `draft` + dong vat tu)
- `GET /api/inventory/transactions/:id`
- `PATCH /api/inventory/transactions/:id` (chi sua khi `draft`)
- `POST /api/inventory/transactions/:id/actions`
  - `{ "action": "post" }` -> ghi so
  - `{ "action": "cancel" }` -> huy phieu `draft`
- `GET /api/inventory/stocks` (xem ton kho theo kho/vat tu)

### Engine ghi so (posting engine)
- File: `src/lib/inventory/engine.ts`
- Chi cho ghi so phieu co `status = draft`.
- Rule cap nhat ton:
  - `in`, `transfer_in`: cong `on_hand_qty`
  - `out`, `transfer_out`: tru `on_hand_qty` (mac dinh chan am ton)
  - `adjust`: cong/tru theo `quantity` dong vat tu
- Tu dong tao/cap nhat `warehouse_stocks` theo key `(warehouse_id, material_key)`.

### Rule nghiep vu da khoa
- Khong cho sua phieu da `posted`.
- Khong cho huy truc tiep phieu da `posted`.
- Neu can dao/hieu chinh phieu da `posted` -> tao phieu moi (`adjust`/dao chieu), khong sua lich su.

### Huong dan test nhanh
1. Tao phieu draft:
   - `POST /api/inventory/transactions`
2. Sua draft neu can:
   - `PATCH /api/inventory/transactions/:id`
3. Ghi so:
   - `POST /api/inventory/transactions/:id/actions` body `{ "action":"post" }`
4. Xem ton:
   - `GET /api/inventory/stocks?warehouse_id=...`

### Cap nhat moi: Muc dich xuat kho
- Phieu `out` co them truong `issue_purpose`.
- Muc dich xuat hardcode phase nay:
  - `project_supply`: cap cho du an
  - `crew_supply`: cap cho doi thi cong
  - `maintenance_supply`: cap cho bao tri
  - `loss_damage`: hao hut / hu hong
  - `internal_use`: dung noi bo
  - `other`: muc dich khac
- Rule phase nay:
  - phieu xuat kho thu cong bat buoc chon `muc dich xuat`
  - phieu xuat sinh tu ke hoach du an auto gan `project_supply`
- Muc dich xuat duoc dung lai cho:
  - danh sach phieu kho
  - bao cao xuat kho theo muc dich
  - phan tich hao hut / su dung noi bo sau nay

### Cap nhat moi: Canh bao van hanh kho
- Dashboard kho bo sung nhom canh bao de co tinh hanh dong hon:
  - ton duoi min
  - vat tu lau khong bien dong
  - gia nhap tang manh
  - phieu draft de lau chua ghi so
  - vat tu sap thieu theo nhu cau du an
- Nhom canh bao nay hien dang dung nguong code-level de team van hanh duoc ngay; co the tach thanh cau hinh mem o phase sau.

### Cap nhat moi: Dashboard kho phase 1
- Dashboard kho giai doan nay tap trung vao goc nhin van hanh:
  - gia tri ton kho hien tai
  - so ma vat tu dang co ton
  - vat tu duoi muc toi thieu
  - tong nhap / xuat / dieu chinh trong ky
  - kho dang giu gia tri ton cao
  - phieu kho gan day theo trang thai `draft / posted / cancelled`
- Nguon du lieu dung cho dashboard:
  - `warehouse_stocks`
  - `inventory_transactions`
  - `inventory_transaction_items`
- Gioi han hien tai:
  - dashboard kho chua phai bao cao ke toan kho day du
  - gia tri xuat kho lich su chua du sau de lam mot dashboard gia von chuan
