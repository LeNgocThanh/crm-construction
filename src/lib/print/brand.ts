export type PrintBrandSettings = {
  brandName: string
  legalName: string
  tagline: string
  logoUrl: string | null
  accentColor: string
  accentSoft: string
  borderColor: string
  address: string | null
  phone: string | null
  email: string | null
  taxCode: string | null
  footerText: string
}

export const PRINT_BRAND_DEFAULT: PrintBrandSettings = {
  brandName: 'TidiCons',
  legalName: 'CRM Construction',
  tagline: 'Bieu mau van hanh va bao cao noi bo',
  logoUrl: null,
  accentColor: '#ea580c',
  accentSoft: '#fff7ed',
  borderColor: '#cbd5e1',
  address: null,
  phone: null,
  email: null,
  taxCode: null,
  footerText: 'TidiCons CRM Construction - Mau in dung chung cho kho, nhan cong, ke toan va du an.',
}

export function mergePrintBrandSettings(input?: Partial<PrintBrandSettings> | null): PrintBrandSettings {
  return {
    ...PRINT_BRAND_DEFAULT,
    ...(input || {}),
    brandName: String(input?.brandName || PRINT_BRAND_DEFAULT.brandName),
    legalName: String(input?.legalName || PRINT_BRAND_DEFAULT.legalName),
    tagline: String(input?.tagline || PRINT_BRAND_DEFAULT.tagline),
    logoUrl: input?.logoUrl ? String(input.logoUrl) : null,
    accentColor: String(input?.accentColor || PRINT_BRAND_DEFAULT.accentColor),
    accentSoft: String(input?.accentSoft || PRINT_BRAND_DEFAULT.accentSoft),
    borderColor: String(input?.borderColor || PRINT_BRAND_DEFAULT.borderColor),
    address: input?.address ? String(input.address) : null,
    phone: input?.phone ? String(input.phone) : null,
    email: input?.email ? String(input.email) : null,
    taxCode: input?.taxCode ? String(input.taxCode) : null,
    footerText: String(input?.footerText || PRINT_BRAND_DEFAULT.footerText),
  }
}
