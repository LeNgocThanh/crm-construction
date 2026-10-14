# ESTIMATE FORMULA EXTENSIBILITY

## 1) Muc tieu
He thong estimate V2 cho phep mo rong cong thuc va co so tinh ma khong hardcode tung case.

## 2) Kieu tinh item
- `per_area`: tinh theo 1 area basis.
- `per_unit`: tinh theo 1 unit/count basis.
- `fixed`: so luong co dinh.
- `formula`: cong thuc tu facts.
- Legacy van map duoc: `per_m2`, `per_room`.

## 3) quantity_basis_key
- Dung voi `per_area`/`per_unit` de chi dinh fact nao lam co so tinh.
- Vi du:
  - `wall_surface_area_total`
  - `floor_area_without_tum`
  - `room_count`
  - `floor_count_total`

## 4) Basis option lay tu dau
Dropdown Basis trong `/settings/estimate-v2` lay theo thu tu:
1. Taxonomy `kind=quantity_basis`
2. Fallback taxonomy `kind=fact_key`

## 5) Vai tro formula va basis (uu tien)
- Neu item co `formula` hop le -> uu tien tinh theo formula.
- Neu khong co formula/khong parse duoc -> fallback theo apply_mode + quantity_basis_key.
- Neu thieu basis fact -> quantity = 0 (co canh bao trong ket qua).

## 6) extra_facts_json
- Dung de bo sung/override facts nang cao.
- Khong bat buoc cho workflow thong thuong.
- Van quan trong cho assembly preview (facts tu block merge vao day).

## 7) Assembly-specific update
- Assembly estimate-preview da uu tien template gan tren block (T0_forced_from_blocks).
- Assembly estimate-preview co them lop ep template mem tu `assembly_template_bundle_map`.
- Thu tu hien tai:
  1. `template_id` dang gan tren block
  2. `template_codes[]` tu `assembly_template_bundle_map`
  3. fallback auto-tier match cho phan chua du template
- Mapping `component_type -> template_type` da DB-driven qua taxonomy:
  - `kind=assembly_component_template_map`
  - value format: `component|template_type`
- Mapping semantic block -> template estimate mem duoc quan ly qua:
  - `kind=assembly_template_bundle_map`
  - UI: `/settings/assembly-template-bundles`
  - debug runtime: `/estimates/assemblies/block-facts`

## 8) APIs lien quan
- `POST /api/settings/estimate/templates/[id]/items`
- `PATCH /api/settings/estimate/template-items/[itemId]`
- `POST /api/estimates/v2/recompute-preview`
- `POST /api/assemblies/[id]/estimate-preview`
- `POST /api/assemblies/[id]/bulk-replace-template`

## 9) Luu y van hanh
- Khi doi template/item basis, can recompute preview de cap nhat gia.
- Luon quan ly taxonomy `quantity_basis`, `fact_key`, `assembly_component_template_map`, `assembly_template_bundle_map` de UI/API cung nhin cung mot bo quy tac.

## 10) Preview item that trong /settings/estimate-v2
- Muc tieu: giup user thu nghiem nhanh tung dong dinh muc ma khong can chay ca du toan.
- Luong dung:
  1. Chon template
  2. Chon item thuc trong template
  3. Xem he thong dien giai cach tinh tu item dang chon
- Preview doc truc tiep cac truong cua item:
  - `apply_mode`
  - `quantity_basis_key`
  - `required_facts`
  - `formula_expr`
  - `waste_factor`
- Facts hien thi tach thanh 2 nhom:
  - Fact tu suy ra tu block / mau phong
  - Fact can nhap hoac xac nhan them
- Neu dang preview item thuc, UI uu tien `scope_key` cua item.
- Truong `Loai phong / pham vi` chi mo de sua khi nguoi dung chon `Mau nhap tay`.

- Preview block mau da bo sung them fact gross/net cho tuong, so luong cua di/cua so/o thoang va cac canh bao fact chua ro trong formula.
- Khi luu template item, neu formula goi toi fact chua co trong taxonomy/preview thi UI se chan luu de tranh cau hinh sai am tham.
