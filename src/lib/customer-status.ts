export const CUSTOMER_PROJECT_CONFIRM_READY_STATUSES = [
  'Đã chốt',
  'Chờ ký HĐ',
  'Đã ký HĐ',
  'Đang thi công',
  'Hoàn công',
  'Bảo hành',
  'Hoàn tất',
] as const

export function isCustomerReadyForProjectConfirm(status: string | null | undefined) {
  const s = String(status || '').trim()
  return CUSTOMER_PROJECT_CONFIRM_READY_STATUSES.includes(s as any)
}

