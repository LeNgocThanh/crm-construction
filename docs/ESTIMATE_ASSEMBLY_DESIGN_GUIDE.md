# ESTIMATE ASSEMBLY DESIGN GUIDE

## 1) Muc tieu
Tai lieu van hanh cho luong Assembly theo Text - 2D - 3D -> Estimate theo block.

Nguyen tac hien tai:
1. Assembly la nguon su that
2. 2D/3D la lop thao tac va trinh bay
3. Estimate preview uu tien template gan tren block, fallback auto-match neu block khong co template

## 2) Cac trang chinh
- `/estimates/assemblies`: Form/Text builder + preset + clone + quick replace.
- `/estimates/assemblies/block-facts`: Man giai thich fact theo block, dung de debug semantic -> template -> estimate.
- `/estimates/assemblies/designer-2d`: Chinh block 2D, zoom, auto-layout, overlap.
- `/estimates/assemblies/designer-3d`: Chinh block 3D, move/scale/toa do, giao nhau.
- `/estimates/assemblies/result-v2`: Ket qua estimate theo block/template/items.

## 2.1) Seed demo hien tai
- Da co script seed demo cho assembly:
  - `npm run seed:assembly-houses`
- Da co script seed demo cho preset:
  - `npm run seed:assembly-presets`
- Nhom demo hien tai gom:
  - nha pho 2 tang + tum
  - nha cap 4 3 phong ngu
  - biet thu mini 2 tang
  - nha ong 2 mat tien
  - nha pho lech tang
- Muc tieu cua bo seed nay:
  - co mau de test 2D / 3D / estimate nhanh
  - co tinh huong facade / opening / roof / stair / tum ro hon
  - co preset de sales ap nhanh thay vi phai tao assembly tu dau

## 3) Luong nhanh de chot du toan
1. Tao/chon assembly.
2. Them/sua block (component, level, kich thuoc, template).
3. Preview estimate tu 2D hoac 3D.
4. Qua result-v2 de doi NCC/recompute.
5. In proposal khach hang neu can.

## 4) Logic estimate hien tai (quan trong)
- Endpoint: `/api/assemblies/[id]/estimate-preview`.
- Engine se:
  1. Uu tien template IDs dang gan tren blocks (T0_forced_from_blocks)
  2. Uu tien them template IDs duoc ep tu `assembly_template_bundle_map`
  3. Fallback auto-tier match (T1..T8) cho nhom con thieu
- Vi vay doi template tren block da co hieu luc truc tiep.
- `assembly_template_bundle_map` la lop noi semantic block voi template estimate ma khong can hardcode route.
- UI quan ly:
  - `/settings/assembly-template-bundles`
  - user chon dieu kien block va tick template can ep
- Co 2 lop kiem tra:
  - xung dot tiem nang tren trang settings
  - xung dot runtime tren `/estimates/assemblies/block-facts`

## 5) Mapping component -> template_type
- Da chuyen sang DB-driven.
- Nguon mapping: taxonomy `kind=assembly_component_template_map`.
- Dinh dang value: `component|template_type` (vi du `wall|structure`).
- Co fallback map mac dinh neu component chua duoc cau hinh trong DB.

## 6) Cong cu nang suat trong `/estimates/assemblies`
- Clone tang: copy toan bo block tu tang A sang tang B (co overwrite tuy chon).
- Clone block: tao ban sao block va auto focus vao form sua ngay sau clone.
- Quick Replace Template (dieu kien):
  - Scope theo `component_type`
  - Tuy chon `level_index`
  - Tuy chon `template hien tai`
  - Chon `template moi`
  - Dry-run truoc, sau do Apply + auto preview

## 7) Quy uoc du lieu block
- Vi tri: `x_m`, `y_m`, `z_m`
- Kich thuoc: `length_m`, `width_m`, `height_m`
- Tang: `level_index`
- Nhom block: `component_type`
- Wall uu tien:
  - `wall_area_m2`
  - fallback `wall_length_m`

## 8) 2D/3D hien tai
### Designer 2D
- Luu block hoac Luu tat ca.
- Zoom: `-`, `+`, `1x`, `Ctrl + wheel`.
- Hien overlap va list block de focus.
- Opening chi tiet `openings[]` co the sua ngay trong panel block va hien truc tiep tren canvas 2D.
- Mau block 2D tu dong dong bo theo preset hien thi va mau tuy chinh dang duoc chon ben Designer 3D.
- Khi bam `Preview Estimate`, he thong chup preview mat bang 2D hien tai va luu tam trong `sessionStorage`.
- Auto-layout by_length:
  - Cung `level_index + height_order + length_order` -> chong cung vi tri.
  - Nhom length_order sau noi tiep theo block dai nhat cua nhom truoc.
- Khong bat snap 0.5m cung; cho phep thao tac linh hoat va nhap so thap phan.
- Cac nhom thao tac lon da chuyen sang dang thu gon / mo rong de giam roi mat.
- Danh sach assembly da chuyen sang:
  - list nhe `summary_only=true`
  - phan trang tung trang
  - chi load detail cua assembly dang chon
  - co cache local cho `10` assembly detail gan nhat
- Sau khi them / sua / xoa block hoac luu assembly:
  - designer 2D se force refresh detail that
  - khong dung lai cache cu de tranh lech du lieu

### Designer 3D
- Move/Scale + nhap tay `x_m/y_m/z_m` + size.
- Hien giao nhau AABB.
- Co truc X/Y/Z + max axis.
- Co Luu tat ca.
- Co `interior_preset` cho `bedroom`, `kitchen`, `wc`.
- `openings[]` uu tien hon `opening_preset` va duoc dung cho render opening thuc te.
- Co 3 che do nhin nhanh:
  - `Solid`
  - `X-ray`
  - `Presentation`
- Catalog cho `opening_preset`, `roof_preset`, `stair_preset`, `interior_preset` da duoc dua vao DB qua `Estimate Taxonomies`, user co the tu them/sua/bat-tat preset tren settings.
- Hien tai phan hinh khoi render 3D van map theo `value` preset trong code; DB dang quan ly catalog, ten hien thi va mo ta de khong bi cung trong UI.
- Co panel `HIEN THI MO HINH` de doi preset mau va doi mau tung nhom block ngay tren viewer.
- Co luu `view mode`, `preset mau`, `mau override` vao `localStorage` de reload trang khong mat cau hinh.
- Co nut `Khoi phuc hien thi mac dinh` de reset nhanh ve trang thai goc.
- Label tren canvas 3D da giam bot roi:
  - uu tien hien block dang chon
  - hien block dang giao nhau khi canh overlap
- Dropdown `Xuat du lieu` gom:
  - `Xuat JSON AI`
  - `Copy brief AI`
  - `Xuat OBJ + JSON`
- Khi bam `Preview Estimate`, he thong chup preview phoi khoi 3D hien tai va luu tam trong `sessionStorage`.
- Cac nhom thao tac lon da chuyen sang dang thu gon / mo rong de giam roi mat.
- Cac nut dieu huong / preview da duoc gom vao menu `Tien ich`:
  - `Mo Designer 2D`
  - `Preview Estimate`
  - `Ve Assemblies`
- Danh sach assembly da chuyen sang:
  - list nhe `summary_only=true`
  - phan trang tung trang
  - chi load detail cua assembly dang chon
  - co cache local cho `10` assembly detail gan nhat
- Sau khi luu block hoac luu tat ca:
  - designer 3D se force refresh detail that
  - sau do moi dong bo lai list summary

## 8.1) Facts semantic moi
- Preview estimate hien co them:
  - `block_interior_preset_counts`
  - `interior_bed_count`
  - `kitchen_counter_length_total_m`
  - `wc_fixture_set_count`
  - `openings_by_face`
  - cac fact phang theo tung mat: `opening_face_count_*`, `opening_face_area_*`, ...
- Co them man `block-facts` de nhin:
  - block nao dang sinh fact nao
  - rule bundle nao dang match
  - template nao bi ep tu block
  - template nao bi ep tu bundle
  - block nao dang bi nhieu rule dong hang cung match

## 8.2) Doc them ve y nghia cac thong so block
- Xem `ESTIMATE_BLOCK_PARAMETERS_GUIDE.md` de hieu:
  - moi truong semantic co y nghia gi
  - truong nao mo ra logic nao
  - uu tien giua `template_id`, `space_type`, `opening_preset`, `openings[]`, `interior_preset`

## 9) Result-v2 / Proposal khach hang
- `result-v2` hien dang co:
  - Du toan so bo theo block
  - Recompute theo NCC
  - In / xuat PDF so bo
  - In proposal khach hang
  - Brief sale phase 1
- Proposal khach hang hien tai:
  - Dang khoa tone `Uu tien chi phi`
  - Co the in kem preview `Mat bang 2D` va `Phoi khoi 3D`
  - Uu tien dung anh preview da chup tu designer neu co
  - Neu chua co preview, `result-v2` se tu tao anh fallback de proposal van in duoc
- Neu muon proposal dep hon va dung goc nhin dang xem:
  1. Preview tu trang 2D va/hoac 3D
  2. Mo `result-v2`
  3. Dung luong `Lam moi anh + in proposal`

## 10) Brief sale phase 1
- Brief sale tren `result-v2` hien tai la rule-based, chua dung LLM.
- Muc tieu:
  - Tom tat nhanh de sales trao doi voi khach
  - Goi y follow-up
  - Khong auto tao `next action`
- Nguon uu tien cho nhu cau tiep theo:
  1. `customer_care_activities` dang open
  2. `customers.next_action` chi de fallback legacy

## 11) Gioi han an toan
- Toa do clamp: `[-1000, 1000]`.
- Kich thuoc clamp theo component:
  - Mac dinh min `0.5m`
  - `slab`, `ceiling` min `0.1m`

## 12) Checklist truoc khi gui khach
- [ ] Dung assembly dung phuong an
- [ ] Da gan template hop le theo component
- [ ] Da kiem tra `block-facts` neu assembly co semantic moi / rule moi
- [ ] Da preview estimate moi nhat
- [ ] Da recompute sau khi doi NCC/template
- [ ] Da kiem tra tong chi phi + breakdown block
- [ ] Neu can proposal dep hon: da preview 2D va/hoac 3D de lay anh minh hoa
