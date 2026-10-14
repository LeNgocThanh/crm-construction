export const PROJECT_DOCUMENT_SCOPE_OPTIONS = [
  { value: 'investor_visible', label: 'Gửi chủ đầu tư' },
  { value: 'internal', label: 'Nội bộ' },
  { value: 'legal', label: 'Pháp lý' },
  { value: 'execution', label: 'Thi công' },
  { value: 'handover', label: 'Bàn giao' },
  { value: 'as_built', label: 'Hoàn công' },
  { value: 'finance_procurement', label: 'Tài chính - mua sắm' },
] as const

export const PROJECT_DOCUMENT_TYPE_OPTIONS = [
  { value: 'estimate', label: 'Dự toán' },
  { value: 'contract', label: 'Hợp đồng' },
  { value: 'appendix', label: 'Phụ lục' },
  { value: 'drawing', label: 'Bản vẽ' },
  { value: 'meeting_minutes', label: 'Biên bản họp' },
  { value: 'execution_report', label: 'Báo cáo thi công' },
  { value: 'acceptance_report', label: 'Biên bản nghiệm thu' },
  { value: 'handover_report', label: 'Biên bản bàn giao' },
  { value: 'as_built_dossier', label: 'Hồ sơ hoàn công' },
  { value: 'purchase_doc', label: 'Chứng từ mua sắm' },
  { value: 'invoice', label: 'Hóa đơn' },
  { value: 'receipt', label: 'Biên nhận' },
  { value: 'warranty', label: 'Bảo hành' },
  { value: 'other', label: 'Khác' },
] as const

export const PROJECT_DOCUMENT_ACCESS_LEVEL_OPTIONS = [
  { value: 'public_project', label: 'Toàn dự án' },
  { value: 'team_only', label: 'Chỉ nội bộ đội dự án' },
  { value: 'restricted', label: 'Hạn chế' },
] as const

export function isValidProjectDocumentScope(v: string) {
  return PROJECT_DOCUMENT_SCOPE_OPTIONS.some((x) => x.value === v)
}

export function isValidProjectDocumentType(v: string) {
  return PROJECT_DOCUMENT_TYPE_OPTIONS.some((x) => x.value === v)
}

export function isValidProjectDocumentAccessLevel(v: string) {
  return PROJECT_DOCUMENT_ACCESS_LEVEL_OPTIONS.some((x) => x.value === v)
}

export function projectDocumentScopeLabel(v: string | null | undefined) {
  const key = String(v || '')
  return PROJECT_DOCUMENT_SCOPE_OPTIONS.find((x) => x.value === key)?.label || key || '-'
}

export function projectDocumentTypeLabel(v: string | null | undefined) {
  const key = String(v || '')
  return PROJECT_DOCUMENT_TYPE_OPTIONS.find((x) => x.value === key)?.label || key || '-'
}

export function projectDocumentAccessLevelLabel(v: string | null | undefined) {
  const key = String(v || '')
  return PROJECT_DOCUMENT_ACCESS_LEVEL_OPTIONS.find((x) => x.value === key)?.label || key || '-'
}
