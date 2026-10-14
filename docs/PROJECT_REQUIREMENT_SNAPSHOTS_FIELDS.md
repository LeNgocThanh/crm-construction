# PROJECT REQUIREMENT SNAPSHOTS - FIELD SPEC

## Muc tieu
Luu du lieu boc tach theo tung lan (version) tu chat/call/audio/manual, truoc khi chuyen thanh du an thuc te trong `construction_projects`.

## Nguyen tac
- Append-only theo version, khong ghi de ban cu.
- Moi customer co nhieu version.
- Chi 1 version `is_current=true` tai 1 thoi diem.

## Truong du lieu

| Field | Bat buoc | Y nghia |
| --- | --- | --- |
| `id` | Yes | Khoa chinh snapshot |
| `customer_id` | Yes | Khach hang so huu snapshot |
| `source_type` | Yes | Nguon tao snapshot: `conversation|contact_log|audio|manual|analysis` |
| `source_ref_id` | No | ID nguon goc (conversation/log/...) |
| `version_no` | Yes | So version tang dan theo customer |
| `is_current` | Yes | Danh dau version hien hanh |
| `status` | Yes | `new|reviewed|approved|rejected|converted` |
| `extracted_json` | No | Du lieu raw tu AI/nguon vao |
| `normalized_json` | No | Du lieu da chuan hoa de dung nghiep vu |
| `confidence_score` | No | Do tin cay (0..1 hoac 0..100 tuy profile) |
| `note` | No | Ghi chu nghiep vu |
| `created_by` | No | Nguoi/agent tao snapshot |
| `approved_by` | No | Nguoi duyet snapshot |
| `approved_at` | No | Thoi diem duyet |
| `converted_project_id` | No | ID `construction_projects` neu da convert |
| `created_at` | Yes | Thoi diem tao |
| `updated_at` | Yes | Thoi diem cap nhat gan nhat |

## Rule version
- Tao snapshot moi:
- Tim version lon nhat cua customer, +1.
- Set toan bo snapshot `is_current=true` cu thanh `false`.
- Tao ban moi `is_current=true`, `status=new`.

## Trang thai nghiep vu
- `new`: vua tao, chua review
- `reviewed`: da xem qua
- `approved`: duoc chap thuan de dung
- `rejected`: khong su dung
- `converted`: da chuyen thanh du an thuc te

## Pha sau (chua lam o buoc nay)
- Retention/archive snapshot cu > 6-12 thang.
- Tach payload raw lon sang object storage.

## API da co
- `GET /api/customers/[id]/requirement-snapshots`
- `POST /api/customers/[id]/requirement-snapshots`
- `PATCH /api/customers/[id]/requirement-snapshots/[snapshotId]`
- `POST /api/customers/[id]/requirement-snapshots/[snapshotId]/convert`
  - Tao `construction_projects` tu snapshot
  - Cap nhat snapshot sang `converted` + gan `converted_project_id`
  - Ghi `customer_timeline` event `project_created`
