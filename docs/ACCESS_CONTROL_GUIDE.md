# ACCESS CONTROL GUIDE

## 1) Muc tieu

Chuan hoa he thong phan quyen theo huong:
- UI va API dung chung mot ngon ngu quyen
- tach ro `account_type`, `role`, `permission`, `scope`
- giam hardcode `session.user.role` trong route
- cho phep mo rong role / permission / explicit access ma khong pha logic dang chay

## 2) Van de cua giai doan cu

He thong truoc day chu yeu dua vao:
- an/hien menu o aside theo `role`
- check `session.user.role` truc tiep trong tung API route

He qua:
- de lech giua UI va API
- kho bao tri
- kho mo rong role/account type moi
- scope nghiep vu bi viet moi noi mot kieu

## 3) Kien truc quyen muc tieu

He thong quyen chia thanh 4 tang:

### 3.1 Authentication
- user da dang nhap hay chua
- user co `is_active` hay khong

### 3.2 Account type
Xac dinh ban chat tai khoan:
- `internal_user`
- `investor`
- `partner`
- `supplier`
- `subcontractor`

Tang nay quyet dinh user duoc vao khu nao cua he thong.

### 3.3 Role
Xac dinh user lam vai tro gi:
- `admin`
- `manager`
- `sales`
- mo rong sau: `accountant`, `site_manager`, `warehouse_keeper`, ...

Tang nay quyet dinh user co the lam loai thao tac nao.

### 3.4 Scope
Xac dinh user duoc tac dong vao du lieu nao:
- `own`
- `group`
- `organization`
- `explicit_access`
- `all`

## 4) Engine access tong quat

Thay vi chi viet helper hep theo module:
- `canReadCustomer`
- `canManageCustomer`

He thong dang di theo huong tong quat:
- `resourceType`
- `action`
- `permission`
- `scope`
- `resource facts`

Huong muc tieu:
- `canAccessResource({ user, resourceType, resourceId, action })`

Vi du:
- `resourceType = customer | project | conversation | warehouse | asset | labor_worker`
- `action = read | write | delete | assign | approve | manage`

Wrapper theo module van duoc giu de route de doc:
- `requireCustomerAccess(...)`
- `requireProjectAccess(...)`
- `requireConversationAccess(...)`

## 5) Data model hien tai

### 5.1) Users
Bang `users` hien dang giu:
- ho so tai khoan: `full_name`, `email`, `phone`, `employee_code`, `job_title`, `avatar_url`
- van hanh: `is_active`, `last_login_at`
- `role` text chi con la truong compatibility tam thoi

Nguon role that su:
- `user_role_memberships`
- `access_roles`

### 5.2) Groups
Da co:
- `groups`
- `user_group_memberships`

Muc dich:
- phan to chuc / nhom nguoi dung
- chua tham gia truc tiep vao authz API

### 5.3) Account types
Da co:
- `account_types`
- `user_account_type_memberships`

Da seed:
- `internal_user`
- `investor`
- `partner`
- `supplier`
- `subcontractor`

### 5.4) Access modules
Bang:
- `access_modules`

Nhom nghiep vu lon:
- users
- settings
- customers
- projects
- inventory
- labor
- assets
- conversations

### 5.5) Access resources
Bang:
- `access_resources`

Danh muc resource logic, khong phai tung record that.

Vi du:
- user
- setting
- customer
- project
- warehouse
- labor_worker
- asset
- conversation

### 5.6) Access permissions
Bang:
- `access_permissions`

Truong chinh:
- `permission_key`
- `permission_name`
- `module_id`
- `resource_id`
- `action_key`

Vi du:
- `projects.read`
- `projects.write`
- `inventory.read`
- `assets.write`

### 5.7) Access roles
Bang:
- `access_roles`

Seed hien tai:
- `admin`
- `manager`
- `sales`
- `mod`

### 5.8) Access role permissions
Bang:
- `access_role_permissions`

Muc dich:
- mot role co nhieu permission
- mot permission co the dung cho nhieu role

### 5.9) User role memberships
Bang:
- `user_role_memberships`

Muc dich:
- mot user co the co nhieu role
- danh dau role chinh bang `is_primary`
- song song voi `users.role` trong giai doan chuyen tiep

### 5.9.1) Quy uoc hien thi user tren UI

Tu giai doan nay, UI thong nhat hien thi user theo helper chung:
- file: `src/lib/user-display.ts`
- `getUserDisplayName(user)`:
  - uu tien `full_name (username)`
  - fallback ve `full_name`
  - fallback ve `username`
- `getUserRoleLabel(user)`:
  - uu tien `primary_access_role.name`
  - fallback `primary_access_role.key`
  - fallback `role` compatibility
- `getUserDisplayLabel(user)`:
  - ghep thanh `Ten hien thi (Vai tro truy cap chinh)`

Nguyen tac ap dung:
1. Dropdown chon user: dung `getUserDisplayLabel(user)`
2. Badge / summary user duoc chon: dung `getUserDisplayLabel(user)`
3. Noi chi can ten nguoi, khong can vai tro: dung `getUserDisplayName(user)`
4. Khong tu viet lai kieu `username (role)` moi noi mot kieu nua
5. `users.role` chi la fallback tam thoi, khong duoc coi la nguon role chinh

### 5.10) Resource access grants
Bang:
- `resource_access_grants`

Truong chinh:
- `resource_type`
- `resource_id`
- `user_id`
- `access_level`
- `can_read`
- `can_write`
- `can_approve`
- `can_manage`
- `granted_by`
- `granted_at`
- `expires_at`
- `is_active`

Muc dich:
- explicit override / ngoai le theo tung resource

## 6) Tuong thich nguoc

He thong hien tai van giu:
- `users.role`
- mot so mapping permission trong code

Nguyen tac noi authz:
1. neu user co `user_role_memberships` + role permissions trong DB thi lay quyen tu DB
2. neu chua du du lieu DB thi co the fallback theo du lieu cu o giai doan chuyen tiep

Muc tieu la mo rong dan, tranh big-bang migration.

Trang thai hien tai:
1. auth/session da suy role tu `user_role_memberships`
2. `/api/users`, `/api/my-profile` va mot so route tra embedded user da suy role tu membership
3. nhom API settings / webhook / bot-config / departments / organizations / pipeline / KPI / SLA escalate da bo check truc tiep `session.user.role` va chuyen sang helper authz
4. cac query tim `admin/manager/sales` trong API chinh da chuyen sang `role_memberships`
5. `users.role` khong con la nguon doc chinh cho user management, chi con de giu tuong thich tam thoi

Luu y:
- `session.user.role` van ton tai trong session object de tuong thich tam thoi
- `session.user.role_keys` da duoc bo sung de UI co the check nhieu role membership dung hon
- gia tri nay duoc derive tu role membership, khong doc truc tiep tu cot `users.role`
- nhom page UI settings/logs da chuyen qua check `role_keys` thay vi chi dua vao `role` don
- mot so page UI tong quat nhu dashboard/layout/sidebar van con giu `role` don cho muc dich hien thi / backward compatibility

## 7) Nguyen tac phan quyen

1. Route noi bo uu tien `internal_user`
2. Route portal ngoai check `account_type` tuong ung
3. `role` quyet dinh thao tac
4. `scope` quyet dinh du lieu cu the
5. UI va API nen dung cung helper authz
6. Khong tiep tuc hardcode role moi trong route neu da co helper chung

## 8) Permission set co ban dang dung

Permission hien tai toi thieu:
- `users.read`
- `users.manage`
- `settings.read`
- `settings.manage`
- `customers.read`
- `customers.write`
- `customers.manage`
- `projects.read`
- `projects.write`
- `projects.manage`
- `inventory.read`
- `inventory.write`
- `inventory.manage`
- `labor.read`
- `labor.write`
- `labor.manage`
- `assets.read`
- `assets.write`
- `assets.manage`
- `conversations.read`
- `conversations.write`

Mapping role tam thoi:
- `admin`: full
- `manager`: da phan lon read/write nghiep vu, khong quan ly users toan dien
- `sales`: nghiep vu read/write co ban, khong duoc settings manage, khong duoc users manage

## 9) Helper da co

Da tao:
- `src/lib/permissions.ts`
- `src/lib/authz.ts`
- `src/lib/access-control.ts`

Helper dang co:
- `requireAuth`
- `requireInternalUser`
- `requireRoles`
- `requireAccountTypes`
- `requirePermission`
- `canAccessResource`
- `requireResourceAccess`
- `requireCustomerAccess`
- `requireProjectAccess`
- `requireConversationAccess`

## 10) Pham vi migrate da thuc hien

### Quan tri
- `/api/users`
- `/api/users/[id]`
- `/api/groups`
- `/api/groups/[id]`
- `/api/account-types`
- `/api/account-types/[id]`

### Projects
- `/api/projects`
- `/api/projects/[id]`
- `/api/projects/[id]/investor-view`
- `/api/projects/[id]/timeline`
- `/api/projects/[id]/diary`
- `/api/projects/[id]/resource-plans`

### Customers
- `/api/customers`
- `/api/customers/workboard`
- `/api/customers/timeline-by-user`
- `/api/customers/export`
- `/api/customers/bulk`
- `/api/customers/from-analysis`
- `/api/customers/[id]`
- `/api/customers/[id]/timeline`
- `/api/customers/[id]/contact-logs`
- `/api/customers/[id]/care-activities`
- `/api/customers/[id]/care-activities/[activityId]`
- `/api/customers/[id]/requirement-snapshots`
- `/api/customers/[id]/requirement-snapshots/[snapshotId]`
- `/api/customers/[id]/requirement-snapshots/[snapshotId]/convert`
- `/api/customers/[id]/merge-extraction`
- `/api/customers/[id]/estimate-dispatches`
- `/api/customers/[id]/estimate-dispatches/[dispatchId]`

### Conversations
- `/api/conversations`
- `/api/conversations/[id]`
- `/api/conversations/[id]/messages`
- `/api/conversations/[id]/messages/[msgId]/feedback`
- `/api/conversations/[id]/analyze`
- `/api/conversations/[id]/close`
- `/api/conversations/[id]/reopen`
- `/api/conversations/[id]/takeover`

### Inventory
- `/api/inventory/transactions`
- `/api/inventory/transactions/[id]`
- `/api/inventory/transactions/[id]/actions`
- `/api/inventory/stocks`

### Labor
- `/api/labor/trades`
- `/api/labor/trades/[id]`
- `/api/labor/crews`
- `/api/labor/crews/[id]`
- `/api/labor/workers`
- `/api/labor/workers/[id]`
- `/api/labor/engagements`
- `/api/labor/engagements/[id]`
- `/api/labor/attendances`
- `/api/labor/attendances/[id]`
- `/api/labor/payment-batches`
- `/api/labor/payment-batches/[id]`
- `/api/labor/payment-batches/[id]/actions`
- `/api/labor/payment-batches/[id]/attendance-links`
- `/api/labor/payments`
- `/api/labor/payments/[id]`

### Assets
- `/api/assets`
- `/api/assets/[id]`
- `/api/assets/[id]/actions`
- `/api/assets/[id]/lifecycle`
- `/api/assets/[id]/assignments`
- `/api/assets/assignments`
- `/api/assets/assignments/[assignmentId]`
- `/api/assets/lifecycle-by-user`

## 11) Ghi chu trien khai hien tai

1. `investor-view` hien tai van duoc coi la route noi bo trong phase nay.
2. Investor portal that su se tach o phase sau va di kem access theo project.
3. Engine record-level scope da ton tai trong `src/lib/access-control.ts`, gom ca `owner / assignee / group / organization / explicit_access`.
4. `resource_access_grants` da co data model va helper nap grant theo tung record, nhung moi duoc noi vao mot phan module/route.
5. Cum `customers` da co nguon check quyen thong nhat hon, nhung scope chi tiet `own / assigned / explicit_access` chua duoc siet dong deu tren moi route collection.
6. Giai doan hien tai la "da co scope theo record, chua rollout va siet rong khap". Nghia la he thong khong con chi dung role-level, nhung van chua ep scope that chat o tat ca module.
7. Route collection co the dung `requirePermission(...)`, route item co the doi sang `requireResourceAccess(...)`.
8. Cum `inventory`, `labor`, `assets` da bat dau noi vao authz chung nhung van giu mot so tang bao toan hanh vi cu o thao tac nhay cam.

## 12) Huong mo rong tiep theo

### Phase tiep theo cho resource-specific access
- bo sung `resource facts`
- bo sung UI CRUD cho `resource_access_grants`
- doi dan role scope policy tu `all` sang `assigned/owner/group/...`

### Phase tiep theo cho role / permission
- CRUD UI cho role va permission
- gan role cho user tu trang Users
- dong bo dan session / aside theo role membership

### Giai doan sau nua
- bo dan `users.role`
- tach permission chi tiet hon theo module
- dua scope policy vao DB
- field-level visibility:
  - project finance
  - diary noi bo / diary investor
  - document internal / investor visible

## 13) Khi nao cap nhat doc nay

- Moi thay doi authz engine
- Moi thay doi data model access-control
- Moi thay doi mapping permission / role / account_type
- Moi thay doi pham vi route da migrate

Tai lieu nay la diem doc tong hop duy nhat cho access-control o giai doan hien tai.
