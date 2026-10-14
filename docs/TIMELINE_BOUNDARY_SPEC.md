# Customer Timeline vs Action Timeline

## Muc tieu
- Tach ro timeline doi ngoai (khach hang) va timeline noi bo (cong viec).
- Giu `customers.next_action` la con tro nhanh, khong phai nguon su that duy nhat.
- Dam bao KPI, audit va CRM khong chong cheo.

## Dinh nghia

### 1) Customer Timeline (doi ngoai/CRM)
Chi luu cac su kien co tac dong truc tiep den khach hang hoac trang thai kinh doanh cua ho so khach.

Vi du:
- Tao moi khach hang.
- Cuoc goi/nhan tin/lich hen quan trong.
- Gui khai toan/du toan/ho so cho khach.
- Doi trang thai pipeline khach hang.
- Chot/tu choi/huy giao dich.
- Cap nhat `next_action` dang uu tien cho khach.

### 2) Action Timeline (noi bo/van hanh)
Chi luu vong doi cua cong viec noi bo (task/action).

Vi du:
- Tao action/task.
- Assign/reassign nguoi phu trach.
- Accept/reject (co ly do neu reject theo rule).
- Doi han, doi priority, sua noi dung cong viec.
- Danh dau done/cancelled.
- Comment/noi dung noi bo.

## Nguyen tac map su kien
- Su kien chi noi bo, khong tac dong truc tiep den khach: ghi Action Timeline.
- Su kien co tac dong nghiep vu den khach: ghi ca 2 timeline.
  - Action Timeline: ghi day du ky thuat/audit.
  - Customer Timeline: ghi ban tom tat de nhin hanh trinh khach.
- Khong copy nguyen van toan bo noi dung noi bo sang Customer Timeline.

## Vai tro cua next_action
- `customers.next_action` = con tro hien tai de doc nhanh tren UI.
- Nguon su that = action open uu tien cao nhat (theo rule sap xep).
- Khi action dang tro thanh `next_action` bi done/cancelled:
  - tu dong chon action open tiep theo de cap nhat `customers.next_action`.
  - neu khong con action open: set `customers.next_action = null`.

## Event Matrix (v1)

1. Tao action thu cong (manual task)
- Action Timeline: Co
- Customer Timeline: Co neu action gan customer_id
- Notification: gui cho assignee

2. Assign/Reassign action
- Action Timeline: Co
- Customer Timeline: Khong bat buoc (chi ghi khi doi nguoi phu trach khach o cap customer)
- Notification: assignee moi (+ assignee cu neu reassign)

3. Cap nhat detail/priority/due_at action
- Action Timeline: Co
- Customer Timeline: Khong (tru khi doi next_action hien hanh)
- Notification: gui assignee

4. Done/Cancelled action
- Action Timeline: Co
- Customer Timeline: Co neu action gan customer va anh huong buoc cham soc
- Notification: gui assigner/nguoi lien quan

5. Cap nhat next_action customer
- Action Timeline: Co (neu cap nhat den tu action)
- Customer Timeline: Co
- Notification: gui owner/assignee lien quan

6. Gui bao gia/khai toan/dispatch cho khach
- Action Timeline: Co (neu la ket qua tu action)
- Customer Timeline: Co (bat buoc)
- Notification: theo luong phan cong

## Quy tac hien thi UI
- Customer profile page:
  - Tab Timeline: mac dinh la Customer Timeline.
  - Tab Work/Actions: danh sach action hien tai + lich su action.
- Workboard:
  - Doc tu action open (khong doc truc tiep tu customer timeline).
  - `next_action` chi la snapshot hien thi nhanh.

## Lo trinh trien khai de an toan
1. Spec first (tai lieu nay).
2. Tao Action Timeline store (neu chua co bang rieng).
3. Chuyen luong tao/sua/done action ghi vao Action Timeline.
4. Bo sung bridge: event nao can push sang Customer Timeline.
5. Chuan hoa rule cap nhat `customers.next_action` tu action open.
6. Hoan thien dashboard KPI tu action lifecycle.

## Khong lam trong phase nay
- Chua doi toan bo schema KPI.
- Chua them policy retention phuc tap.
- Chua chot automation toan bo channels chat/email.
