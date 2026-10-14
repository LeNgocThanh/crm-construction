import { db } from '@/lib/db'
import { PRINT_BRAND_DEFAULT, mergePrintBrandSettings, type PrintBrandSettings } from '@/lib/print/brand'

export const PRINT_BRAND_CONFIG_ID = 'default'

export function mapPrintBrandRow(row: any | null | undefined): PrintBrandSettings {
  if (!row) return PRINT_BRAND_DEFAULT
  return mergePrintBrandSettings({
    brandName: row.brand_name || undefined,
    legalName: row.legal_name || undefined,
    tagline: row.tagline || undefined,
    logoUrl: row.logo_url || null,
    accentColor: row.accent_color || undefined,
    accentSoft: row.accent_soft || undefined,
    borderColor: row.border_color || undefined,
    address: row.address || null,
    phone: row.phone || null,
    email: row.email || null,
    taxCode: row.tax_code || null,
    footerText: row.footer_text || undefined,
  })
}

export async function getPrintBrandSettings(): Promise<PrintBrandSettings> {
  const row = await (db as any).printBrandConfig.findUnique({
    where: { id: PRINT_BRAND_CONFIG_ID },
  }).catch(() => null)
  return mapPrintBrandRow(row)
}
