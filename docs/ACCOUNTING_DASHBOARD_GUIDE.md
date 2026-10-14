# Accounting Dashboard Guide

## Muc tieu

Tao mot dashboard ke toan theo huong "tai chinh dieu hanh" de nguoi quan ly nhin nhanh:

1. Du an nao dang thieu von
2. Trong 30 ngay toi cong ty du kien thu / chi bao nhieu
3. Chi phi thuc te dang phat sinh den dau
4. Nhan cong con phai tra bao nhieu
5. Khoan thu nao cua chu dau tu sap den han nhung chua thu du
6. Cong no chu dau tu dang nam o nhom thoi gian nao

Phase 1 chua phai la so cai ke toan tong hop.
No chi dung cac nguon du lieu da co san va da du tin cay trong he thong hien tai.

## Nguon du lieu dung ngay

1. `construction_projects`
   - gia tri hop dong
   - ngan sach hien tai
   - chi phi thuc te
   - chi phi cam ket
   - trang thai du an
   - muc do rui ro

2. `project_cashflow_snapshots`
   - cash_on_hand
   - receivable_planned_30d
   - payable_planned_30d
   - demand_30d
   - supply_30d
   - gap_30d
   - warning_level

3. `project_payment_plans` + `project_payments`
   - cac khoan du kien thu sap den han
   - da thu du / chua thu du
   - tong thu da ghi nhan trong thang hien tai
   - cong no chu dau tu theo han thanh toan / qua han

4. `project_labor_attendances` + `project_labor_payments`
   - chi phi nhan cong thuc te
   - da tra nhan cong
   - con phai tra nhan cong

5. `lib/labor/finance.ts`
   - tong hop nhanh theo du an cho nhan cong

## Cac o KPI Phase 1

1. Tong gia tri hop dong
   - tong `contract_value` cua cac du an dang loc

2. Tong ngan sach hien tai
   - tong `budget_current` cua du an
   - neu du an co snapshot moi nhat thi uu tien so trong snapshot

3. Tong chi phi thuc te
   - tong `cost_actual`
   - uu tien snapshot moi nhat, fallback ve field tren du an

4. Du kien thu 30 ngay
   - tong `receivable_planned_30d`
   - uu tien snapshot moi nhat
   - fallback bang cach tinh tu payment plan chua thu du va sap den han trong 30 ngay

5. Du kien chi 30 ngay
   - tong `payable_planned_30d`
   - uu tien snapshot moi nhat
   - fallback = `labor payable` neu du an chua co snapshot

6. Chenh lech 30 ngay
   - tong `gap_30d`
   - hien thi xanh khi duong, do khi am

7. Thu da ghi nhan thang nay
   - tong `project_payments.amount` trong thang hien tai

8. Chi nhan cong da ghi nhan thang nay
   - tong `project_labor_payments.amount` trong thang hien tai
   - bo qua batch da huy

9. Con phai tra nhan cong
   - tong `labor payable_amount` theo du an

10. Cong no chu dau tu theo han thanh toan
   - tong cac payment plan con thieu tien
   - chia nhom:
     - chua den han
     - qua han 1-7 ngay
     - qua han 8-30 ngay
     - qua han tren 30 ngay
     - chua xac dinh han

## Bang canh bao Phase 1

1. Du an thieu von / sap thieu von
   - sap xep theo `gap_30d` tang dan
   - hien:
     - ten du an
     - canh bao
     - thu 30 ngay
     - chi 30 ngay
     - chenh lech

2. Khoan thu sap den han
   - lay payment plan trong 30 ngay
   - tinh `remaining_amount = plan.amount - tong payment da gan vao plan`
   - chi hien cac dong `remaining_amount > 0`

3. Cong no chu dau tu theo han thanh toan
   - lay toan bo payment plan dang mo
   - tinh `remaining_amount`
   - chia nhom theo chenh lech giua `due_date` va hom nay
   - hien bang chi tiet theo du an / khach / moc thanh toan / nhom thoi gian
4. Du an con phai tra nhan cong cao
   - sap xep theo `payable_amount` giam dan
   - hien:
     - ten du an
     - chi phi cong thuc te
     - da tra
     - con phai tra

5. Top du an chi phi thuc te cao
   - sap xep theo `cost_actual` giam dan

## Bo loc Phase 1

1. Trang thai du an
2. Chi hien du an co canh bao

## Gioi han Phase 1

1. Chua co so cai tong hop nen khong dat ten KPI la "Tien mat cong ty"
2. Chua co cong no NCC chuan nen chua hien "phai tra NCC tong"
3. Chua co but toan ke toan nen khong co lai lo ke toan chuan
4. Chua co dashboard thu chi tien mat ngoai pham vi du an

## Huong mo rong sau

1. Them cong no NCC va duyet chi mua hang truc tiep
2. Them dong tien theo tuan / thang
3. Them drill-down tu dashboard sang payment plans / labor payments / project overview
4. Them dashboard rieng cho ke toan truong va giam doc
