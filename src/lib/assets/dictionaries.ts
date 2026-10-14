export const ASSET_STATUS_LABELS: Record<string, string> = {
  available: 'Sẵn sàng',
  in_use: 'Đang sử dụng',
  maintenance: 'Đang bảo trì',
  retired: 'Ngừng sử dụng',
  lost: 'Thất lạc',
}

export const ASSET_CONDITION_LABELS: Record<string, string> = {
  good: 'Tốt',
  fair: 'Trung bình',
  poor: 'Kém',
  broken: 'Hỏng',
}

export const ASSET_TYPE_LABELS: Record<string, string> = {
  equipment: 'Thiết bị',
  tool: 'Công cụ',
  vehicle: 'Phương tiện',
  sample: 'Đồ mẫu',
  other: 'Khác',
}

export const ASSET_ACQUISITION_METHOD_LABELS: Record<string, string> = {
  mua_moi: 'Mua mới',
  mua_cu: 'Mua cũ',
  dieu_chuyen: 'Điều chuyển',
  thue: 'Thuê',
  khac: 'Khác',
}

export function viLabelFromMap(map: Record<string, string>, value: string | null | undefined, fallback = 'Không xác định') {
  const key = String(value || '').trim()
  if (!key) return fallback
  return map[key] || key
}

