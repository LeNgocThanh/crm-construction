# Print System Guide

## Muc tieu

Tao mot bo khung in dung chung cho toan he thong de:

1. dong nhat header / footer / mau sac / typographic
2. doi thuong hieu mot cho, ap dung cho nhieu mau in
3. tranh moi module tu viet mot mau in rieng

## File dung chung

### 1. `src/lib/print/brand.ts`

Chua:
- default brand fallback
- kieu du lieu `PrintBrandSettings`
- ham merge gia tri DB vao default

### 2. `src/lib/print/service.ts`

Chua:
- `getPrintBrandSettings()`
- doc cau hinh tu DB model `print_brand_configs`
- fallback ve default neu chua co du lieu

### 3. `src/lib/print/layout.ts`

Chua:
- `buildPrintBaseStyles()`
- `escapePrintHtml()`
- `renderPrintHeaderHtml()`
- `renderPrintShellHtml()`

## Cau hinh DB + UI

Da co model:
- `PrintBrandConfig`

Da co API:
- `GET /api/settings/print-brand`
- `PUT /api/settings/print-brand`

Da co UI:
- `/settings/print-brand`

Y nghia:
- nguoi dung co the doi ten thuong hieu, ten phap ly, mau nhan dien, footer
- cac mau in dung chung se doc theo cau hinh nay

## Truoc day va hien tai

Truoc day:
- brand hardcode 100%

Hien tai:
- van co default fallback trong code
- nhung da co cau hinh DB + UI de doi thuong hieu ma khong sua code
 
Day la khung dung chung cho cac route in HTML va page print client-side.

## Da ap dung

1. `src/app/api/inventory/prices/print/route.ts`
- da dung shell in chung
- da co header / footer / meta / scope / auto print

2. `src/app/(dashboard)/inventory/transactions/[id]/print/page.tsx`
- da dung style chung
- da dua ve cung nhan dien voi route in gia vat tu

## Nguyen tac mo rong

Khi tao them mau in moi:

1. uu tien route HTML in neu la bao cao tong hop
2. dung `renderPrintHeaderHtml()` va `renderPrintShellHtml()`
3. neu la page client-side print thi import:
- `buildPrintBaseStyles()`
- `mergePrintBrandSettings()`

4. khong copy style in tu file cu neu co the tai su dung helper

## Phase B de sau

1. Mo rong UI `/settings/print-brand`
- them upload logo thuc te
- them mau chu ky
- them bo footer nang cao

2. Luu:
- logo
- ten cong ty
- mau nhan dien
- footer
- thong tin lien he
- mau chu ky

3. Mo rong sang:
- labor
- accounting
- projects
- reports

## Luu y

Phase hien tai da co truong `logoUrl`, nhung neu chua nhap thi header se tu fallback ve brand badge chu cai de giu mau in on dinh.
