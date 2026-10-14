# DEV CHECKLIST - CRM Construction MVP

## 1) First-Time Local Setup
- Confirm Node/npm version team is using.
- Run `npm install`.
- Prepare env file (from existing project examples) and set required keys.
- Run `npm run db:generate`.
- Run `npm run db:push` (or `npm run db:migrate` if migration-based flow is chosen).
- Seed initial admin: `npm run db:seed`.
- Start app: `npm run dev`.

### Prisma local note
- Local PostgreSQL runtime hien tai dung `DATABASE_URL=postgresql://...`.
- Khong dung `prisma generate --no-engine` cho local app runtime nay.
- Neu generate nham `--no-engine`, login/auth co the loi kieu:
  - `Error validating datasource db: the URL must start with the protocol prisma://`
- Cach xu ly dung:
  1. Tat server dev / process dang giu Prisma engine.
  2. Chay lai `npx prisma generate`.
  3. Mo lai app va test login.

## 2) Daily Start Checklist
- Pull latest changes and install if lockfile changed.
- Ensure Prisma client is up to date: `npm run db:generate` (after schema changes).
- Open app and verify login works.
- Check core pages load: Dashboard, Customers, Conversations, Projects.

## 3) Before Coding a Task
- Identify impacted layers:
- Prisma model(s),
- API route(s),
- dashboard page/component(s),
- shared lib(s) in `src/lib`.
- Confirm role behavior for `admin`, `manager`, `sales`.
- For data changes, decide forward compatibility strategy before editing schema.

## 4) During Implementation
- Keep API handlers explicit for auth and status codes.
- Sanitize response payloads with `BigInt`/`Date` safety.
- Keep channel/status enums consistent with existing DB values.
- Prefer incremental commits by feature slice.

## 5) Pre-PR Validation
- Run `npm run lint`.
- Run `npm run build` for integration-level confidence.
- Smoke test:
- Login and protected routes.
- Customers list/filter/create.
- Conversations list and detail.
- Bot config/settings pages.
- Webhook debug/status endpoints (if touched).
- If Prisma schema changed:
- include migration or documented `db push` plan,
- regenerate Prisma client.

## 6) High-Risk Areas
- Auth/session callbacks (`src/lib/auth.ts`).
- Route-level role checks (missing checks can leak data).
- Webhook processing and dedup logic.
- Chat/bot auto-reply behavior outside business hours.
- RAG import/sync consistency (`RagEntry` <-> Qdrant/Sheet).

## 7) Release Smoke Checklist
- App boots in production mode.
- Critical APIs return expected status and shape.
- No blocking console/runtime errors on dashboard.
- Basic KPI/report pages render.
- Webhook logging still captures inbound/outbound events.

## 8) Incident Checklist (Quick)
- Capture failing route + payload snippet from `WebhookLog`.
- Identify if issue is auth, schema, provider, or AI response shape.
- Add temporary safe guard (input validation/fallback) first.
- Create follow-up backlog item with root-cause fix.

## 9) Doc Update Map
Muc tieu:
- Khi thay doi code, khong can mo lai toan bo `docs/`.
- Chi can xac dinh minh dang cham vao module/luong nao roi update dung file chinh.

Tham chieu nhanh:
- `docs/DOC_TOUCH_MAP.md`

Ban do goi y:
- `projects/*`:
  - tong quan module: `docs/PROJECT_MODULE_GUIDE.md`
  - truc `status/stage/milestone/active plan`: `docs/PROJECT_EXECUTION_AXIS_SPEC.md`
  - neu thay doi diary / diary report / gallery / filter / phan trang: uu tien `docs/PROJECT_MODULE_GUIDE.md`
- `labor/*` hoac cham cong tu nhat ky:
  - `docs/LABOR_MODULE_GUIDE.md`
- `work-suggestions/*` hoac notification action:
  - `docs/WORK_SUGGESTIONS_GUIDE.md`
- `files/upload` hoac metadata file:
  - `docs/FILE_UPLOAD_METADATA_GUIDE.md`
- thay doi pham vi module / lien ket giua nhieu module:
  - `docs/SYSTEM_OVERVIEW.md`
- thay doi diem vao doc:
  - `docs/DOC_INDEX.md`

Quy tac nhe:
- Mot feature nho chi nen cap nhat 1-3 file docs chinh.
- Chi mo rong them khi thay doi thuc su anh huong module khac.
