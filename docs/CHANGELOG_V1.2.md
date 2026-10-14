# CHANGELOG V1.2

## 2026-07-22

### Estimate V2 Settings UX
- `/settings/estimate-v2` bo sung xem thu item theo mau block va theo item thuc.
- Preview da doc truc tiep `apply_mode`, `quantity_basis_key`, `required_facts`, `formula_expr`, `waste_factor` tu item dang chon.
- Facts duoc tach thanh 2 nhom ro hon:
  - Fact tu suy ra tu block / mau phong
  - Fact can nhap hoac xac nhan them
- Khi chon item thuc, UI uu tien theo `scope_key` cua item; chi mo sua `Loai phong / pham vi` khi chon `Mau nhap tay`.

### Proposal / Result V2
- Proposal khach hang khong con phu thuoc hoan toan vao `sessionStorage`.
- Neu chua tung preview 2D/3D, `result-v2` co the tu tao anh fallback de in proposal.
- Them luong `Lam moi anh + in proposal` de nguoi dung chu dong tao lai preview truoc khi in.

## 2026-05-06

### Assembly Estimate
- Assembly preview da chuyen sang block-first:
  - Uu tien template dang gan tren block
  - Fallback auto-match cho nhom con thieu
- Match trace bo sung tier `T0_forced_from_blocks`.

### Component-Template Mapping
- Da bo hardcode mapping co dinh trong UI/API.
- Mapping da DB-driven qua taxonomy:
  - `kind=assembly_component_template_map`
  - value format: `component|template_type`
- `/settings/estimate-taxonomies` bo sung panel `Mapping preview` de xem group mapping truc quan.

### Assemblies Productivity
- Them `Clone tang`.
- Them `Clone block` va auto focus vao block moi sau clone.
- Them `Quick Replace Template` theo dieu kien:
  - `component_type` (bat buoc)
  - `level_index` (optional)
  - `template hien tai` (optional)
  - `template moi` (bat buoc)
  - Dry-run + Apply + auto preview

## 2026-05-05

### Designers
- 2D/3D co `Luu tat ca`.
- 2D: zoom (`-`, `+`, `1x`, `Ctrl + wheel`), overlap listing, auto-layout by_length.
- 3D: giao nhau AABB, truc X/Y/Z + max axis.
- Input so thap phan duoc cai thien (`4.`, `4.5`, `0.1`).

## Ghi chu
- Cac muc changelog cu da duoc don dep de tranh trung lap va loi encoding.
- Chi giu cac cap nhat con phu hop voi logic hien tai.
