# ESTIMATE V2 BLUEPRINT

> Status: Active reference (cap nhat 2026-07-22)

## 1) Muc tieu
- Du toan so bo minh bach, truy vet duoc template/rule/price source.
- Ket qua de tu van nhanh, khong thay the ho so ky thuat chi tiet.

## 2) Nguyen tac tinh toan (hien tai)
1. Assembly flow: block-first template, fallback auto-match.
2. Generate-v2 flow: auto-match template theo house/style/finish/foundation.
3. Case-based chi la fallback/boost theo `template_apply_mode`.

## 3) Du lieu mo
- Template/rule/taxonomy la du lieu DB, khong hardcode nghiep vu trong UI/API.
- Mapping `component_type -> template_type` da DB-driven qua taxonomy `assembly_component_template_map`.
- Rule va template co the versioned, co active/effective window khi nghiep vu can mo rong them.

## 4) Item + Formula
- Apply modes: `per_area`, `per_unit`, `fixed`, `formula`.
- Legacy `per_m2`, `per_room` van duoc ho tro.
- `quantity_basis_key` dinh nghia co so tinh.

## 4.1) Chinh sach tinh toan va pricing
- Engine tinh so lieu, AI chi phuc vu boc tach/ngon ngu.
- Pricing policy hien tai:
  - `lowest`
  - `highest`
  - `standard`
  - `premium`
- Co the mo rong supplier match policy:
  - `preferred_first`
  - `only_preferred`
  - `ignore`
- Khi save ket qua, can co pricing snapshot de truy vet nguon gia.

## 4.2) Output chuan
- `basic_metrics`
- `items`:
  - `quantity`
  - `unit_price`
  - `cost`
  - `source`
- `meta`:
  - `assumptions`
  - `warnings`
  - `missing_fields`
  - `pricing_snapshot`
  - `match_trace`

## 5) Preview-first
- Preview khong luu quote chinh thuc.
- Confirm save moi ghi DB.
- Preview tra ve: warnings, missing_fields, assumptions, pricing snapshot.
- Trong `/settings/estimate-v2`, preview item da di theo item thuc trong template thay vi hardcode mot mau block co dinh.
- User co the xem ro fact nao tu suy ra duoc va fact nao can nhap/xac nhan them truoc khi tin vao ket qua.

## 5.1) Quote lifecycle
- Khai toan / du toan so bo la tam tinh nhung van phai luu.
- Mot quote nen giu:
  - input snapshot
  - recipe / template / pricing mode da dung
  - breakdown
  - total cost
  - trang thai

## 5.2) Quy uoc van hanh
- Mac dinh uu tien bang gia chuan / bang gia dang cau hinh.
- Khi co gia vung rieng thi uu tien gia vung.
- Neu thieu du lieu thi:
  - bao thieu
  - hoac fallback ve co so tinh / base cost phu hop
- Neu can do on dinh cao hon, co the day ve huong `strict template` o giai doan sau.

## 5.3) He so boi canh mo rong sau
- `geo_factor`
- `labor_factor`
- `transport_factor`
- `difficulty_factor`
- `market_factor`

## 6) Nguon su that hien tai
- Formula va basis: `ESTIMATE_FORMULA_EXTENSIBILITY.md`
- Assembly thao tac van hanh: `ESTIMATE_ASSEMBLY_DESIGN_GUIDE.md`
- Changelog cap nhat: `CHANGELOG_V1.2.md`

## 7) Ghi chu
Tai lieu nay giu vai tro blueprint tong quan. Chi tiet implementation can doi chieu 3 tai lieu nguon su that o muc 6.
