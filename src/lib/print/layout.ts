import { PRINT_BRAND_DEFAULT, type PrintBrandMeta, type PrintBrandSettings } from '@/lib/print/brand'

export function buildPrintBaseStyles(brand: PrintBrandSettings = PRINT_BRAND_DEFAULT) {
  return `
  * { box-sizing: border-box; }
  body { margin: 0; background: #f8fafc; color: #0f172a; font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-page { max-width: 1100px; margin: 0 auto; padding: 28px 32px 40px; }
  .print-toolbar { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 10px; }
  .print-btn { background: ${brand.accentColor}; color: white; border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 700; cursor: pointer; }
  .print-btn.secondary { background: #e2e8f0; color: #0f172a; }
  .print-sheet { background: white; border: 1px solid ${brand.borderColor}; border-radius: 14px; overflow: hidden; }
  .print-header { padding: 24px 28px 18px; border-bottom: 2px solid ${brand.accentColor}; background: linear-gradient(135deg, ${brand.accentSoft} 0%, #ffffff 65%); }
  .print-header-row { display: flex; justify-content: space-between; gap: 20px; align-items: flex-end; }
  .print-brand-wrap { display: flex; gap: 14px; align-items: flex-start; }
  .print-brand-badge { min-width: 56px; height: 56px; border-radius: 16px; background: ${brand.accentColor}; color: white; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; letter-spacing: 1px; box-shadow: 0 10px 24px rgba(234, 88, 12, 0.18); overflow: hidden; }
  .print-brand-logo { width: 100%; height: 100%; object-fit: cover; }
  .print-brand-name { font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; color: ${brand.accentColor}; font-weight: 700; }
  .print-brand-legal { font-size: 24px; font-weight: 800; margin-top: 4px; }
  .print-brand-tagline { font-size: 12px; color: #64748b; margin-top: 4px; }
  .print-doc-title { font-size: 24px; font-weight: 800; margin-top: 14px; }
  .print-doc-subtitle { font-size: 13px; color: #475569; margin-top: 6px; max-width: 760px; }
  .print-meta { text-align: right; font-size: 12px; color: #475569; min-width: 220px; }
  .print-meta strong { display: block; font-size: 16px; color: #0f172a; margin-bottom: 5px; }
  .print-scope { margin-top: 16px; background: ${brand.accentSoft}; border: 1px solid #fdba74; border-radius: 10px; padding: 10px 12px; font-size: 12px; color: #7c2d12; }
  .print-body { padding: 18px 28px 28px; }
  .print-summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
  .print-summary-card { background: white; border: 1px solid ${brand.borderColor}; border-radius: 10px; padding: 14px; }
  .print-summary-key { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
  .print-summary-value { font-size: 24px; font-weight: 800; margin-top: 6px; }
  .print-section { margin-bottom: 20px; }
  .print-section-title { font-size: 12px; letter-spacing: 2px; color: #64748b; text-transform: uppercase; margin-bottom: 8px; font-weight: 700; }
  .print-table { width: 100%; border-collapse: collapse; background: white; border: 1px solid ${brand.borderColor}; }
  .print-table th, .print-table td { border: 1px solid #e2e8f0; padding: 7px 8px; font-size: 12px; vertical-align: top; text-align: left; }
  .print-table th { background: ${brand.accentColor}; color: white; }
  .print-table tfoot th, .print-table tfoot td { background: #fff7ed; font-weight: 700; }
  .print-note { margin-top: 8px; font-size: 12px; color: #475569; }
  .print-sign-grid { margin-top: 24px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; text-align: center; font-size: 13px; }
  .print-sign-title { font-weight: 700; }
  .print-sign-box { min-height: 120px; border-top: 1px dashed #94a3b8; padding-top: 8px; color: #64748b; }
  .print-footer { padding: 14px 28px 18px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 11px; text-align: center; background: #fff; }
  .right { text-align: right; }
  .center { text-align: center; }
  @media print {
    body { background: white; }
    .no-print { display: none !important; }
    .print-page { padding: 0; max-width: none; }
    .print-sheet { border: 0; border-radius: 0; }
  }
`
}

export const PRINT_BASE_STYLES = buildPrintBaseStyles(PRINT_BRAND_DEFAULT)

export function escapePrintHtml(value: any) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderPrintHeaderHtml(meta: PrintBrandMeta, scopeHtml?: string, brand: PrintBrandSettings = PRINT_BRAND_DEFAULT) {
  const printedBy = meta.printedBy || 'He thong'
  const printedAt = meta.printedAt || new Date().toLocaleString('vi-VN')
  const codeHtml = meta.code ? `<div>Ma bao cao: <b>${escapePrintHtml(meta.code)}</b></div>` : ''
  const brandBadge = brand.logoUrl
    ? `<img src="${escapePrintHtml(brand.logoUrl)}" alt="${escapePrintHtml(brand.brandName)}" class="print-brand-logo" />`
    : escapePrintHtml(brand.brandName.slice(0, 2).toUpperCase())
  return `
    <div class="print-header">
      <div class="print-header-row">
        <div>
          <div class="print-brand-wrap">
            <div class="print-brand-badge">${brandBadge}</div>
            <div>
              <div class="print-brand-name">${escapePrintHtml(brand.brandName)}</div>
              <div class="print-brand-legal">${escapePrintHtml(brand.legalName)}</div>
              <div class="print-brand-tagline">${escapePrintHtml(brand.tagline)}</div>
            </div>
          </div>
          <div class="print-doc-title">${escapePrintHtml(meta.title)}</div>
          ${meta.subtitle ? `<div class="print-doc-subtitle">${escapePrintHtml(meta.subtitle)}</div>` : ''}
        </div>
        <div class="print-meta">
          <strong>${escapePrintHtml(printedBy)}</strong>
          ${codeHtml}
          <div>In luc: ${escapePrintHtml(printedAt)}</div>
        </div>
      </div>
      ${scopeHtml ? `<div class="print-scope">${scopeHtml}</div>` : ''}
    </div>
  `
}

export function renderPrintShellHtml(args: {
  titleTag: string
  headerHtml: string
  bodyHtml: string
  brand?: PrintBrandSettings
  autoPrint?: boolean
  printButtonLabel?: string
}) {
  const printLabel = args.printButtonLabel || 'In / Luu PDF'
  const brand = args.brand || PRINT_BRAND_DEFAULT
  return `<!DOCTYPE html>
  <html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapePrintHtml(args.titleTag)}</title>
    <style>${buildPrintBaseStyles(brand)}</style>
  </head>
  <body>
    <button class="print-btn no-print" onclick="window.print()">${escapePrintHtml(printLabel)}</button>
    <div class="print-page">
      <div class="print-sheet">
        ${args.headerHtml}
        <div class="print-body">
          ${args.bodyHtml}
        </div>
        <div class="print-footer">${escapePrintHtml(brand.footerText)}</div>
      </div>
    </div>
    ${args.autoPrint ? '<script>setTimeout(()=>window.print(),700)</script>' : ''}
  </body>
  </html>`
}
