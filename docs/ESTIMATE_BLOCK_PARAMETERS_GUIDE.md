# ESTIMATE BLOCK PARAMETERS GUIDE

## 1) Muc tieu
Tai lieu nay giai thich y nghia, lien ket va tac dong cua cac thong so dang co tren block trong cum:

- `/estimates/assemblies`
- `/estimates/assemblies/designer-2d`
- `/estimates/assemblies/designer-3d`
- `/api/assemblies/[id]/estimate-preview`
- `/api/assemblies/[id]/block-facts-preview`

Muc tieu la de team nhin 1 lan se biet:

- truong nao la truong hinh hoc
- truong nao la semantic nghiep vu
- truong nao chi de goi y
- truong nao se mo rong ra facts / estimate / preview / proposal

## 2) Nhom thong so block

## 2.0) Nguyen tac chot moi

Block khong nen cho phep user "tron y nghia" qua nhieu nhom semantic tren cung mot record.

Nguyen tac chot:

1. `component_type` la loai goc, quyet dinh block thuoc "ho" nao.
2. Moi `component_type` chi mo ra mot tap field phu hop.
3. Field khong lien quan phai:
   - an khoi UI
   - khong cho nhap tay trong luong van hanh binh thuong
   - ve sau co the validate cung o API
4. `room_type` duoc xem la field cu / fallback.
5. `space_type` moi la semantic chinh cho block phong.
6. template estimate co the vao tu 2 lop:
   - `template_id` gan truc tiep tren block
   - `assembly_template_bundle_map` de ep template mem theo dieu kien block

Noi ngan gon:

- khong co chuyen block vua la `foundation` vua la `bedroom`
- khong co chuyen block `foundation` ma lai co `openings[]`
- khong co chuyen block `roof` ma lai co `interior_preset`

### 2.1 Nhom nhan dang va sap xep

`component_type`
- La nhom block chinh: wall, room, slab, foundation, stair, roof...
- Day la truong goc de:
  - quy dinh min size
  - auto-layout
  - map sang `template_type`
  - phan biet logic 2D / 3D / estimate

`template_id`
- Template estimate dang duoc gan truc tiep cho block.
- Day la uu tien cao nhat trong preview estimate (`T0_forced_from_blocks`).
- Neu co `template_id`, engine estimate se uu tien template nay truoc khi fallback.

`assembly_template_bundle_map`
- Khong nam tren block, nhung la lop semantic de noi block voi template estimate.
- Cau hinh tai `/settings/assembly-template-bundles`.
- Dung cac dieu kien nhu:
  - `component_type`
  - `space_type`
  - `space_profile`
  - `foundation_type`
  - `opening_preset`
  - `roof_preset`
  - `stair_preset`
  - `interior_preset`
- Dau ra cua rule la `template_codes[]`.
- Khi nhieu rule dong hang cung match 1 block, `/estimates/assemblies/block-facts` se hien canh bao xung dot runtime.

`block_name`
- Ten goi de nguoi dung de nhin va thao tac.
- Khong phai truong tinh nghiep vu, nhung rat quan trong cho UI, proposal noi bo va export.

`level_index`
- Tang / cap do cua block.
- Anh huong:
  - auto-layout
  - clone tang
  - nhom hien thi 2D / 3D
  - tong hop so tang du an

`sort_order`, `length_order`, `height_order`
- Truong dieu huong cach list / cach dat block.
- Chu yeu phuc vu designer va auto-layout.

### 2.2 Nhom hinh hoc

`x_m`, `y_m`, `z_m`
- Toa do block trong assembly.
- `designer-2d` dung `x_m`, `y_m`.
- `designer-3d` dung du ca 3 truc.

`length_m`, `width_m`, `height_m`
- Kich thuoc chinh cua block.
- Day la nen de:
  - ve 2D / 3D
  - tinh dien tich / the tich goi y
  - suy ra opening area
  - sinh facts cho estimate

`area_m2`
- Dien tich override / bo sung.
- Dung khi muon uu tien 1 gia tri dien tich ro rang thay vi chi suy ra tu hinh hoc.

`count`
- So luong block / phong cung loai.
- Se anh huong truc tiep toi preview facts, tong hop phong va tinh so luong noi that co ban.

`wall_area_m2`
- Dien tich tuong uu tien cho cac block wall.
- Neu co thi estimate se uu tien truong nay truoc.

`wall_length_m`
- Chieu dai tuong fallback khi khong co `wall_area_m2`.

## 2.3) Ma tran field theo `component_type`

### A. `component_type = room`

Duoc dung:
- `template_id`
- `space_type`
- `space_profile`
- `room_type` (fallback / legacy)
- `interior_preset`
- feature ticks
- `opening_preset`
- `openings[]`
- `area_m2`, `count`

Khong nen dung:
- `foundation_type`
- `roof_preset`
- `stair_preset`

Giai thich:
- day la nhom phong / khong gian song
- co the co cua, cua so, noi that, dien, nuoc

### B. `component_type = wall`

Duoc dung:
- `template_id`
- feature ticks
- `opening_preset`
- `openings[]`
- `wall_area_m2`
- `wall_length_m`

Co the dung, nhung khong uu tien:
- `space_profile` neu sau nay muon tach tuong cao cap / co ban

Khong nen dung:
- `space_type`
- `room_type`
- `interior_preset`
- `foundation_type`
- `roof_preset`
- `stair_preset`

Giai thich:
- day la phan ket cau / bao che
- co the co opening
- khong phai phong nen khong co y nghia noi that phong

### C. `component_type = foundation`

Duoc dung:
- `template_id`
- `foundation_type`
- `area_m2` neu can

Khong nen dung:
- `space_type`
- `room_type`
- `space_profile`
- feature ticks
- `opening_preset`
- `openings[]`
- `interior_preset`
- `roof_preset`
- `stair_preset`

Giai thich:
- day la nhom mong
- nghiep vu chinh la loai mong va kich thuoc / dien tich

### D. `component_type = roof`

Duoc dung:
- `template_id`
- `roof_preset`
- `area_m2`

Khong nen dung:
- `space_type`
- `room_type`
- `foundation_type`
- `interior_preset`
- `opening_preset`
- `openings[]`
- `stair_preset`
- feature ticks

Giai thich:
- day la nhom mai / san thuong
- logic chinh la hinh khoi mai va estimate phan mai

### E. `component_type = stair`

Duoc dung:
- `template_id`
- `stair_preset`
- feature ticks neu can dien / son

Khong nen dung:
- `space_type`
- `room_type`
- `foundation_type`
- `roof_preset`
- `interior_preset`
- `opening_preset`
- `openings[]`

Giai thich:
- day la nhom cau thang
- logic chinh la preset hinh khoi thang va estimate thang

### F. `component_type = slab`

Duoc dung:
- `template_id`
- `area_m2`

Khong nen dung:
- `space_type`
- `room_type`
- `foundation_type`
- `roof_preset`
- `stair_preset`
- `interior_preset`
- `opening_preset`
- `openings[]`
- feature ticks

Giai thich:
- day la san / slab
- nghiep vu chinh la dien tich, ket cau, be tong, cot thep...

### G. `component_type = column`

Duoc dung:
- `template_id`
- kich thuoc / so luong

Khong nen dung:
- `space_type`
- `room_type`
- `foundation_type`
- `roof_preset`
- `stair_preset`
- `interior_preset`
- `opening_preset`
- `openings[]`
- da so feature ticks

### H. `component_type = ceiling`

Duoc dung:
- `template_id`
- `area_m2`
- co the dung `has_paint`, `has_electrical`

Khong nen dung:
- `space_type`
- `room_type`
- `foundation_type`
- `roof_preset`
- `stair_preset`
- `interior_preset`
- `opening_preset`
- `openings[]`

## 2.4) Field nao nen an / hien theo `component_type`

UI nen di theo bang sau:

- `space_type`, `space_profile`, `room_type`, `interior_preset`
  - chi hien khi `component_type = room`

- `foundation_type`
  - chi hien khi `component_type = foundation`

- `roof_preset`
  - chi hien khi `component_type = roof`

- `stair_preset`
  - chi hien khi `component_type = stair`

- `opening_preset`, `openings[]`
  - chi hien khi `component_type` thuoc nhom co opening hop ly:
    - `room`
    - `wall`

- feature ticks
  - hien theo nhom:
    - `room`: hien day du
    - `wall`: co the chi giu `has_window`, `has_door`
    - `ceiling`: co the chi giu `has_paint`, `has_electrical`
    - `foundation/slab/roof`: an mac dinh

## 2.5) Truong nao nen reset khi doi `component_type`

Khi doi `component_type`, UI/logic nen co xu huong reset cac field khong con hop le.

Vi du:

- doi sang `foundation`
  - clear:
    - `space_type`
    - `space_profile`
    - `room_type`
    - `interior_preset`
    - `opening_preset`
    - `openings[]`
    - feature ticks

- doi sang `room`
  - co the giu:
    - `space_type`
    - `space_profile`
    - `room_type`
    - `opening_preset`
    - `openings[]`
    - feature ticks
  - clear:
    - `foundation_type`
    - `roof_preset`
    - `stair_preset`

- doi sang `roof`
  - clear:
    - `space_type`
    - `room_type`
    - `interior_preset`
    - `opening_preset`
    - `openings[]`
    - `foundation_type`

Day la mot trong nhung diem se can ap vao UI/API sau khi team chot migration logic.

## 3) Nhom semantic chinh

### 3.1 `room_type`
- Truong cu / truong mo rong mem de gan loai phong.
- Hien tai van duoc giu de tuong thich va fallback.
- Co the dung cho cac gia tri dac thu hon neu `space_type` chua du.

### 3.2 `space_type`
- Truong semantic chinh cho nghiep vu estimate va preset.
- Vi du:
  - `bedroom`
  - `master_bedroom`
  - `kitchen`
  - `wc`
  - `living_room`
  - `garage`
  - `storage`
- Truong nay hien la nguon uu tien hon `room_type` trong nhieu logic.

Tac dong hien tai:
- goi y template semantic
- ap preset nhanh theo khong gian
- tong hop `block_space_type_counts`
- tinh `bedroom_count`, `kitchen_count`, `wc_count`, ...
- la truong match quan trong nhat cho `assembly_template_bundle_map` cua nhom phong

### 3.3 `space_profile`
- Muc do / tinh chat cua khong gian.
- Vi du:
  - `basic`
  - `economy`
  - `premium`
  - `utility`

Tac dong hien tai:
- them semantic hint
- sinh facts `block_space_profile_counts`
- la diem mo rong sau nay cho don gia / finish / quality level

### 3.4 `foundation_type`
- Loai mong cua block / assembly lien quan.
- Hien duoc dung de:
  - goi y template semantic mong
  - suy ra `foundation_type` cho preview estimate

## 4) Nhom feature boolean

Bo tick hien tai:

- `has_ceiling` -> Co tran
- `has_paint` -> Co son
- `has_electrical` -> Co dien
- `has_plumbing` -> Co nuoc
- `has_window` -> Co cua so
- `has_door` -> Co cua di

Y nghia:
- Day la cac co nghiep vu nhanh cho user.
- Khong mo ra 1 hinh hoc moi ngay lap tuc.
- Nhung no co tac dung:
  - sinh facts `block_feature_counts`
  - goi y semantic
  - de sau nay map sang formula / items / checklist

Lien ket:
- `space_type` co the ap san mot bo tick phu hop.
- Vi du:
  - `kitchen` thuong bat `has_plumbing`
  - `wc` thuong bat `has_plumbing`
  - `bedroom` thuong bat `has_window`, `has_door`

## 5) Nhom preset

### 5.1 `opening_preset`
- Preset opening nhanh dang cu.
- Dung khi user chua khai bao `openings[]` chi tiet.
- Neu da co `openings[]`, he thong uu tien `openings[]`.

### 5.2 `roof_preset`
- Preset mai.
- Tac dong:
  - hinh khoi 3D
  - semantic hint
  - facts roof preset

### 5.3 `stair_preset`
- Preset cau thang.
- Tac dong:
  - hinh khoi 3D
  - semantic hint
  - facts stair preset

### 5.4 `interior_preset`
- Preset noi that co ban theo loai phong.
- Hien tai da co:
  - `bedroom_basic`
  - `kitchen_basic`
  - `wc_basic`

Tac dong hien tai:
- luu tren block semantic
- xuat theo `design-3d-export`
- sinh facts preview:
  - `block_interior_preset_counts`
  - `interior_bed_count`
  - `kitchen_counter_length_total_m`
  - `wc_fixture_set_count`

Tac dong mo rong sau:
- render mock furniture 3D co ban
- estimate noi that / thiet bi
- proposal / brief sale ro hon
- co the dung lam dieu kien match cho `assembly_template_bundle_map`

### 5.5 `assembly_template_bundle_map`
- Day la lop cau hinh ben ngoai block, khong phai field trong `dimensions_json`.
- Muc tieu:
  - noi semantic block voi template estimate
  - giam hardcode trong `/api/assemblies/[id]/estimate-preview`
  - cho phep van hanh tu them rule moi tren settings
- Noi xem / debug:
  - `/settings/assembly-template-bundles`
  - `/estimates/assemblies/block-facts`
  - `/api/assemblies/[id]/block-facts-preview`

## 6) Nhom openings chi tiet

`openings[]`
- Danh sach opening chi tiet thay cho preset cu.
- Moi opening gom:
  - `type`: `door | window | vent`
  - `face`: `front | back | left | right`
  - `offset`
  - `width`
  - `height`
  - `sill`

Y nghia:
- Day la mo ta opening thuc te hon preset.
- Hien duoc dung trong:
  - `designer-2d`: hien opening tren canvas
  - `designer-3d`: render opening tren khoi
  - `estimate-preview`: tinh opening area / openings_by_face

Quy tac uu tien:
1. Neu co `openings[]` -> uu tien dung `openings[]`
2. Neu khong co `openings[]` -> fallback `opening_preset`

Facts sinh ra tu `openings[]`:
- `opening_count_total`
- `door_count_total`
- `window_count_total`
- `vent_count_total`
- `opening_area_total`
- `window_area_total`
- `door_area_total`
- `openings_by_face`
- `opening_face_count_front`
- `opening_face_area_front`
- `opening_face_window_count_front`
- ...

## 7) Truong nao mo / suy ra truong nao

`component_type`
- mo ra:
  - min size rule
  - map template type
  - logic hinh hoc rieng theo nhom block

`space_type`
- mo ra:
  - preset nhanh feature booleans
  - template semantic hint
  - interior preset phu hop
  - room counts cho estimate

`space_profile`
- mo ra:
  - semantic hint premium / utility
  - facts profile
  - ve sau co the doi he so finish / vat tu

`foundation_type`
- mo ra:
  - hint mong
  - suy ra estimate mong

`opening_preset`
- mo ra opening visual fallback neu chua co `openings[]`

`openings[]`
- mo ra:
  - opening render 2D
  - opening render 3D
  - opening area
  - opening by face

`interior_preset`
- mo ra:
  - noi that co ban cho loai phong
  - facts noi that de estimate / brief / proposal

## 8) Truong nao la nguon that trong runtime hien tai

Nguon uu tien semantic block:
1. `dimensions_json` tren block
2. `draft` trong designer khi user dang sua
3. fallback tu `template.room_type` neu can

Nguon uu tien estimate:
1. `template_id` dang gan tren block
2. `assembly_template_bundle_map` ep them template theo dieu kien block
3. facts suy ra tu block semantic
4. auto-match fallback

Nguon uu tien opening:
1. `openings[]`
2. `opening_preset`

## 9) Huong dung cho user van hanh

Neu muon dung nhanh:
- chon `component_type`
- nhap kich thuoc block
- chon `space_type`
- bam ap preset nhanh
- chinh them opening neu can
- gan template neu da biet template chuan

Neu muon estimate dung hon:
- uu tien chon dung `space_type`
- gan `template_id` phu hop
- kiem tra `block-facts` neu dang dung semantic moi hoac rule bundle moi
- dung `openings[]` thay vi chi dung preset
- dung `interior_preset` cho phong ngu / bep / wc

## 10) Tai lieu lien quan

- `ESTIMATE_ASSEMBLY_DESIGN_GUIDE.md`
- `ESTIMATE_FORMULA_EXTENSIBILITY.md`
- `ESTIMATE_V2_BLUEPRINT.md`
- `ESTIMATE_3D_REALISM_ROADMAP.md`
