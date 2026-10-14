# Luu tru file upload de tai su dung

## Muc tieu
- Upload file 1 lan, luu metadata tap trung.
- Gan lai file da upload cho nhieu module:
- `project_documents` (hop dong, phu luc, ban ve...)
- `project_diary_media` (anh/video nhat ky du an)

## Thanh phan moi
- Bang `file_records` (nguon metadata file chung).
- API upload proxy:
- `POST /api/files/upload`
- API danh sach file:
- `GET /api/files`

## Luong su dung de xuat
1. Frontend goi `POST /api/files/upload` voi `multipart/form-data`:
- `file` (bat buoc)
- `purpose` (vd: `contract`, `diary_image`)
- `owner_type`, `owner_id` (optional)
- `tag` (optional)
2. API proxy upload den `UPLOAD_API_URL` (default: `https://webhook.tidicons.online/api/upload`) voi bearer token `UPLOAD_API_TOKEN`.
   Link GET file cong khai mac dinh theo base:
   `https://webhook.tidicons.online/api/uploads/[filename]` (khong can token).
   Neu API upload chi tra ve `filename`, he thong se tu tao `file_url` theo `UPLOAD_FILE_BASE`.
3. API tao 1 ban ghi `file_records` va tra ve `file_record_id`.
4. Khi tao tai lieu/nhat ky:
- Gui `file_record_id` vao:
  - `POST /api/projects/[id]/documents`
  - `POST /api/projects/[id]/diary` (media item)
- He thong tu dien `file_url`, `mime_type`, `size` tu `file_records` neu frontend khong truyen tay.

## Y nghia cac truong chinh cua `file_records`
- `storage_filename`: ten ky thuat dung de truy cap file that (uu tien unique, tranh trung)
- `display_name`: ten hien thi cho nguoi dung (giu ten goc khi upload)
- `purpose`: phan loai nghiep vu (contract, diary_image, estimate_attachment...)
- `owner_type`, `owner_id`: "so huu logic" (project/customer/asset...)
- `external_file_id`: id ben he thong upload ngoai (neu co)
- `metadata_json`: payload goc tra ve tu upload service
- `file_url`: link dung de render/download

## Luu y
- Co the dung 1 file cho nhieu noi (khong can upload lai).
- Khuyen nghi luon truyen `purpose` de sau nay bao cao de.
- Neu can xoa logic, uu tien `is_active=false` thay vi xoa cung.
- Co the set:
  - `UPLOAD_API_URL` cho endpoint POST upload
  - `UPLOAD_FILE_BASE` cho endpoint GET file (mac dinh: `https://webhook.tidicons.online/api/uploads`)

## Ghi chu them cho nhat ky du an
- Media cua nhat ky hien tai duoc luu qua `project_diary_media` va render bang viewer noi bo full-screen trong `/projects/[id]/diary`.
- Viewer nay la lop xem UI:
  - click thumbnail de mo
  - next / back / close
  - `ArrowLeft`, `ArrowRight`, `Escape`
- Metadata file van can luu ro `purpose` / `category` de sau nay co the tach:
  - anh thi cong
  - video thi cong
  - anh loi
  - bien ban nghiem thu
  - tai lieu khac
