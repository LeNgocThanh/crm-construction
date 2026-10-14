# UI & Notification Coding Principles

> Muc tieu: giu giao dien nhat quan, de dung, va khong lech logic thong bao.

## 1) Nguyen tac UI bat buoc

1. Tat ca o nhap phai co nhan (label) ro rang.
- Khong dung placeholder thay cho label.
- Label dat sat o nhap de nguoi dung doc nhanh.

2. Dropdown hardcode phai hien thi nhan tieng Viet.
- `value` co the la key ky thuat (vd: `approved`, `draft`), nhung text hien thi bat buoc la tieng Viet.
- Khong de text dropdown la ma ky thuat hoac tieng Anh neu la man hinh nguoi dung.

3. Nut thao tac dung ngon ngu tieng Viet va ro y nghia.
- Uu tien: `Them`, `Luu`, `Luu sua`, `Xoa`, `Huy`.
- Tranh nut mo ho nhu `Submit`, `Action`.

4. Form phuc hop nghiep vu.
- Read-only thi khong hien nut CRUD.
- Trang van hanh thi chi hien thao tac van hanh.
- Trang planning thi tap trung CRUD ke hoach.

5. Truoc thao tac nguy hiem phai co xac nhan.
- Xoa, huy, ghi de du lieu phai co `confirm`.

## 2) Nguyen tac thong bao (notification)

1. Thong bao chi tao khi co su kien co y nghia nghiep vu.
- Vi du: tao/sua/xoa ke hoach, doi nguoi phu trach, sinh phieu kho, duyet/tu choi.

2. Noi dung thong bao phai de hieu voi nguoi dung.
- Uu tien ten doi tuong thay vi ID.
- Co boi canh toi thieu: cai gi, ai lam, lien quan den ai/du an nao.

3. Khong spam thong bao.
- Su kien preview, thu nghiem, thao tac tam thoi khong gui thong bao dai tra.
- Neu can, gom nhom hoac throttle theo policy.

4. Co kha nang truy vet.
- Moi thong bao co `source_ref_type/source_ref_id` de mo nguoc ve ban ghi goc.
- Lich su trang thai thong bao can ro (read/accepted/rejected/done...).

## 3) Quy tac dat text trong code

1. Nhan UI cho end-user:
- Viet tieng Viet ro nghia.
- Uu tien co dau o cac trang on dinh encoding.

2. Key/noi bo ky thuat:
- Giu dang key tieng Anh (snake_case) de o dinh.
- Khong dung key tieng Viet trong DB/API contract.

## 4) Checklist nhanh truoc khi merge

- Da co label cho tat ca input?
- Dropdown hardcode da la nhan tieng Viet?
- Trang nay la read-only hay CRUD da dung vai tro chua?
- Thao tac nguy hiem da co xac nhan?
- Su kien moi co can gui notification khong? Neu co, noi dung da de hieu chua?
- Notification da luu `source_ref_*` de truy vet chua?

