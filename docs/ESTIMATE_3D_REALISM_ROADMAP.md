# ESTIMATE 3D REALISM ROADMAP

> Muc tieu: lam cho cum `assembly + 2D + 3D + estimate + proposal` thuc te hon, de dung hon, va co gia tri hon cho sales, ky thuat va khach hang.

## 1) Van de hien tai

He thong hien da lam duoc rat nhieu:

- ghep block theo assembly
- preview 2D / 3D
- estimate theo block-first + fallback
- proposal khach hang
- brief noi bo sales
- xuat JSON / OBJ

Nhung gia tri van chua "that su rat thuc te" o 3 diem:

1. block moi dung nhieu o muc hinh hoc, chua du manh o muc nghia khong gian
2. 3D da giup hinh dung, nhung chua du "giong nha that" de chot phuong an nhanh
3. estimate da co cong thuc, nhung chua gan chat vao tung loai phong / tung loai block / tung kieu cong nang

## 2) Dinh huong tong

Khong nen nhay ngay tu "block khoi hop" len "mau kien truc day du".

Nen di theo huong:

1. tang nghia cho block
2. tang preset kien truc co ban
3. gan preset do vao estimate
4. dua du lieu do vao proposal / compare / chot sale

Noi ngan gon:

- block khong chi la hinh
- block phai "biet no la cai gi"
- estimate khong chi tinh theo so do
- estimate phai "hieu day la phong nao / cong nang nao"

## 3) Muc tieu san pham

Sau khi lam xong roadmap nay, user co the:

- ghep nhanh mot mau nha so bo de trao doi voi khach
- co 3D nhin thuyet phuc hon
- co du toan so bo bam sat cong nang hon
- so sanh 2-3 phuong an de chot nhanh hon
- sinh proposal khach hang "co cau chuyen" thay vi chi co so tien

## 4) Phase A - Semantic Block

### Muc tieu

Moi block / room template khong chi co kich thuoc, ma con co y nghia nghiep vu.

### Can them

- `space_type` / `block_role`
  - phong khach
  - phong ngu
  - phong ngu master
  - bep
  - wc
  - hanh lang
  - cau thang
  - ban cong
  - gara
  - san thuong
  - tum
  - mai
  - kho

- `space_profile`
  - co ban
  - cao cap
  - tiet kiem
  - phu tro

- `usage_flags`
  - co tran
  - co son
  - co op lat
  - co cap thoat nuoc
  - co dien chieu sang
  - co cua so
  - co cua di

### Loi ich

- block co y nghia ro rang cho estimate
- sales de chon mau phong hon
- proposal de dien giai cong nang hon

### Dau ra mong muon

Moi block co the tra loi duoc:

- day la khong gian gi
- thuoc muc hoan thien nao
- can nhung he vat tu / he dien nuoc / he hoan thien nao

## 5) Phase B - Preset Kien Truc So Bo

### Muc tieu

Lam 3D va 2D "giong nha that hon" ma van giu toc do thao tac nhanh.

### Can them

- `opening presets`
  - cua di 1 canh
  - cua di 2 canh
  - cua lua
  - cua so nho
  - cua so lon
  - o thoang

- `roof presets`
  - mai bang
  - mai lech
  - mai Thai so bo
  - san thuong

- `stair presets`
  - thang thang
  - thang chu L
  - thang chu U

- `facade tone presets`
  - hien dai toi gian
  - nha pho thong dung
  - biet thu mini

- `finish hint`
  - tuong son
  - op gach wc
  - tran thach cao
  - san gach / san go / san xi mang xoa

### Nguyen tac

- khong can model 3D chi tiet ngay
- uu tien preset de khach "nhin ra day la nha"
- moi preset phai co gia tri cho estimate, khong chi de dep

### Loi ich

- preview 3D thu hut hon
- de chot huong mat tien / mai / cong nang
- giam khoang cach giua "khoi hop" va "phuong an nha"

## 6) Phase C - Estimate Theo Phong / Block Mau

### Muc tieu

Estimate bam theo cong nang thuc te hon, khong chi theo kich thuoc thuan tuy.

### Huong lam

Moi room/block template co:

- bo item estimate mac dinh
- cong thuc quantity theo:
  - chieu dai
  - chieu rong
  - chieu cao
  - dien tich san
  - dien tich tuong
  - dien tich tran
  - so cua
  - so cua so
  - loai mai
  - loai phong

### Vi du

`Phong ngu co ban`

- son tuong theo dien tich tuong
- tran theo dien tich tran
- den chieu sang theo dinh muc / m2
- o cam / cong tac theo preset co ban
- cua di 1 bo
- cua so 1-2 bo theo be rong phong

`WC`

- op gach cao den muc x
- chong tham san / tuong khu uot
- cap thoat nuoc
- thiet bi ve sinh co ban

`Bep`

- cap thoat nuoc
- dien o cam nhieu hon phong thuong
- op lat khu bep

### Loi ich

- estimate "co hon" hon
- user khong can nhap tung vat tu
- sai so thap hon estimate chi dua tren tong m2 san

## 7) Phase D - Compare Phuong An Co Nghia

### Muc tieu

Khi so sanh 2-3 assembly, khach va sales nhin thay khac biet co y nghia, khong chi thay tong tien.

### Can hien

- tong gia tri
- tong dien tich su dung
- tong so phong ngu / wc
- tong phan tho
- tong hoan thien
- block / phong nao lam tang gia manh
- khac biet theo tang
- khac biet theo mat tien / mai / cong nang phu tro

### Loi ich

- sales co noi dung de tu van
- khach de chon phuong an hon
- giam tinh "so khung kho"

## 8) Phase E - Proposal Khach Hang Manh Hon

### Muc tieu

Bien proposal thanh tai lieu de gui khach de hieu, de hinh dung, de chot buoc tiep theo.

### Proposal nen co

- anh 3D preview
- mat bang 2D don gian
- tom tat cong nang
- tong chi phi so bo
- 2-3 diem noi bat cua phuong an
- phan can xac nhan them
- lua chon buoc tiep theo

### Brief noi bo sales nen co

- muc do nong
- diem de thuyet phuc
- diem can hoi them
- diem co nguy co vuot ngan sach

### Luu y

- proposal khach hang khong nen lo "bai noi bo"
- brief sales va proposal khach hang phai tach ro

## 9) Phase F - Kiem Tra Hop Ly So Bo

### Muc tieu

Khong khoa cung, nhung can canh bao de tranh user tao ra phuong an rat kho dung ngoai doi that.

### Canh bao mem

- phong qua hep
- wc qua nho
- thang khong du kich thuoc toi thieu
- hanh lang qua hep
- tong mat bang tang khong hop ly
- phong thieu thong thoang
- so cua so qua it so voi loai phong

### Ket qua

- user van co the tiep tuc
- nhung he thong bao muc do "hop ly so bo"

## 10) Phase G - Thu Vien Mau Nha

### Muc tieu

Dung ngay, demo nhanh, chot nhanh.

### Nen co san

- nha pho 1 tret 1 lau
- nha pho 1 tret 2 lau
- nha pho co tum
- nha co gara
- biet thu mini
- nha cho thue / co phong cho thue

Moi mau gom:

- assembly
- block layout
- room/block template
- estimate preset
- proposal tone goi y

## 11) Phan uu tien de lam ngay

Neu chon duong ngan nhat ma tang gia tri ro nhat, nen uu tien:

1. Semantic block / room template
2. Preset cua, cua so, mai, thang
3. Estimate theo room/block template
4. Compare phuong an co nghia hon
5. Proposal dung 2D/3D + cong nang + chi phi + cau chuyen

## 12) Nhung gi chua nen lam qua som

Chua nen lao vao ngay:

- model kien truc 3D qua chi tiet
- render dep nhu phan mem kien truc chuyen dung
- AI tu ve kien truc hoan chinh khong co rang buoc
- estimate qua chi tiet den muc thi cong that

Ly do:

- de phinh nghiep vu
- de vuot muc "du toan so bo de chot sale"
- de lam user roi vi qua nhieu lua chon

## 13) De xuat ky thuat

### Data model

Nen bo sung theo huong:

- room/block template co semantic fields
- opening preset / roof preset / stair preset
- estimate template map theo `space_type`
- finish level map theo `space_profile`

### UI

Nen cho user thao tac theo 3 lop:

1. nhanh:
   - chon mau nha
   - chon phong / block
   - chon tone hoan thien

2. ban chuyen nghiep:
   - chinh kich thuoc
   - chon preset cua / mai / thang

3. nang cao:
   - mo formula / item / rule

### Output

Mot assembly tot ve sau nen xuat duoc:

- 2D preview
- 3D preview
- estimate summary
- compare data
- proposal data
- brief sales data
- JSON / OBJ

## 14) Definition of Success

Roadmap nay duoc xem la di dung huong khi:

- sales co the dung nhanh de trao doi va chot buoc tiep theo voi khach
- khach nhin proposal de hinh dung hon, hoi it lan hon
- estimate so bo bam sat cong nang hon
- ky thuat co nen de refine, khong phai lam lai tu dau

## 15) File lien quan can doc kem

- `SYSTEM_OVERVIEW.md`
- `ESTIMATE_ASSEMBLY_DESIGN_GUIDE.md`
- `ESTIMATE_FORMULA_EXTENSIBILITY.md`
- `ESTIMATE_V2_BLUEPRINT.md`
- `CHANGELOG_V1.2.md`
