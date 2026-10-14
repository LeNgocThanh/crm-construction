export type SalesBriefHeatValueType = 'number' | 'percent'
export type SalesBriefHeatLabelKey = 'easy_close' | 'nurture' | 'reduce_budget'

export type SalesBriefHeatConfigSeed = {
  config_key: string
  config_name: string
  group_name: string
  value_type: SalesBriefHeatValueType
  config_value: string
  description: string
  sort_order: number
}

export type SalesBriefHeatRuntimeConfig = {
  budget_over_soft_pct: number
  budget_over_hard_pct: number
  score_has_budget: number
  score_within_budget: number
  score_has_location: number
  score_has_function: number
  score_has_foundation: number
  score_has_active_care: number
  score_over_soft_budget: number
  score_over_hard_budget: number
  score_missing_each_core_field: number
  hot_threshold_easy_close: number
  hot_threshold_nurture_min: number
  missing_core_fields_for_nurture: number
}

export type SalesBriefHeatEvaluation = {
  label: SalesBriefHeatLabelKey
  labelText: string
  score: number
  reasons: string[]
  missingCount: number
  budgetDeltaPct: number | null
}

export const SALES_BRIEF_HEAT_CONFIG_SEEDS: SalesBriefHeatConfigSeed[] = [
  {
    config_key: 'budget_over_soft_pct',
    config_name: 'Ngưỡng vượt ngân sách nhẹ (%)',
    group_name: 'Ngân sách',
    value_type: 'percent',
    config_value: '10',
    description: 'Nếu tổng đầu tư sơ bộ vượt quá ngưỡng này so với ngân sách tối đa của khách thì bắt đầu trừ điểm.',
    sort_order: 10,
  },
  {
    config_key: 'budget_over_hard_pct',
    config_name: 'Ngưỡng vượt ngân sách mạnh (%)',
    group_name: 'Ngân sách',
    value_type: 'percent',
    config_value: '20',
    description: 'Nếu tổng đầu tư sơ bộ vượt quá ngưỡng này thì ưu tiên xếp vào nhóm cần hạ ngân sách.',
    sort_order: 20,
  },
  {
    config_key: 'score_has_budget',
    config_name: 'Điểm cộng khi đã có ngân sách',
    group_name: 'Điểm cộng',
    value_type: 'number',
    config_value: '2',
    description: 'Cộng điểm khi hồ sơ khách đã có ngân sách tối thiểu hoặc tối đa rõ ràng.',
    sort_order: 30,
  },
  {
    config_key: 'score_within_budget',
    config_name: 'Điểm cộng khi phương án nằm trong ngân sách',
    group_name: 'Điểm cộng',
    value_type: 'number',
    config_value: '2',
    description: 'Cộng điểm khi tổng đầu tư sơ bộ đang nằm trong hoặc bằng ngân sách tối đa của khách.',
    sort_order: 40,
  },
  {
    config_key: 'score_has_location',
    config_name: 'Điểm cộng khi đã có địa điểm xây dựng',
    group_name: 'Điểm cộng',
    value_type: 'number',
    config_value: '1',
    description: 'Cộng điểm khi đã có địa chỉ hoặc nơi xây dựng để sales tư vấn sát hơn.',
    sort_order: 50,
  },
  {
    config_key: 'score_has_function',
    config_name: 'Điểm cộng khi đã có công năng chính',
    group_name: 'Điểm cộng',
    value_type: 'number',
    config_value: '1',
    description: 'Cộng điểm khi đã biết số phòng ngủ hoặc nhu cầu công năng chính.',
    sort_order: 60,
  },
  {
    config_key: 'score_has_foundation',
    config_name: 'Điểm cộng khi đã có định hướng móng',
    group_name: 'Điểm cộng',
    value_type: 'number',
    config_value: '1',
    description: 'Cộng điểm khi đã có thông tin về móng hoặc hiện trạng nền đất.',
    sort_order: 70,
  },
  {
    config_key: 'score_has_active_care',
    config_name: 'Điểm cộng khi có care activity đang mở',
    group_name: 'Điểm cộng',
    value_type: 'number',
    config_value: '1',
    description: 'Cộng điểm khi khách đang có luồng chăm sóc tiếp theo rõ ràng.',
    sort_order: 80,
  },
  {
    config_key: 'score_over_soft_budget',
    config_name: 'Điểm trừ khi vượt ngân sách nhẹ',
    group_name: 'Điểm trừ',
    value_type: 'number',
    config_value: '-3',
    description: 'Điểm trừ khi tổng đầu tư sơ bộ vượt ngân sách tối đa nhưng chưa tới ngưỡng mạnh.',
    sort_order: 90,
  },
  {
    config_key: 'score_over_hard_budget',
    config_name: 'Điểm trừ khi vượt ngân sách mạnh',
    group_name: 'Điểm trừ',
    value_type: 'number',
    config_value: '-5',
    description: 'Điểm trừ mạnh khi phương án vượt ngân sách quá đáng kể.',
    sort_order: 100,
  },
  {
    config_key: 'score_missing_each_core_field',
    config_name: 'Điểm trừ cho mỗi thông tin cốt lõi còn thiếu',
    group_name: 'Điểm trừ',
    value_type: 'number',
    config_value: '-1',
    description: 'Áp dụng cho các thông tin cốt lõi như ngân sách, địa điểm, công năng, móng.',
    sort_order: 110,
  },
  {
    config_key: 'hot_threshold_easy_close',
    config_name: 'Ngưỡng điểm để xếp Dễ chốt',
    group_name: 'Ngưỡng xếp loại',
    value_type: 'number',
    config_value: '5',
    description: 'Nếu tổng điểm từ ngưỡng này trở lên và không vượt ngân sách mạnh thì brief được xếp Dễ chốt.',
    sort_order: 120,
  },
  {
    config_key: 'hot_threshold_nurture_min',
    config_name: 'Ngưỡng điểm tối thiểu để vẫn ở mức Cần nuôi thêm',
    group_name: 'Ngưỡng xếp loại',
    value_type: 'number',
    config_value: '0',
    description: 'Nếu chưa đạt Dễ chốt nhưng vẫn từ ngưỡng này trở lên thì xếp Cần nuôi thêm.',
    sort_order: 130,
  },
  {
    config_key: 'missing_core_fields_for_nurture',
    config_name: 'Số thông tin cốt lõi thiếu để ưu tiên xếp Cần nuôi thêm',
    group_name: 'Ngưỡng xếp loại',
    value_type: 'number',
    config_value: '2',
    description: 'Nếu thiếu từ số thông tin này trở lên thì ưu tiên xem là cần nuôi thêm thay vì dễ chốt.',
    sort_order: 140,
  },
]

const DEFAULT_RUNTIME_CONFIG: SalesBriefHeatRuntimeConfig = {
  budget_over_soft_pct: 10,
  budget_over_hard_pct: 20,
  score_has_budget: 2,
  score_within_budget: 2,
  score_has_location: 1,
  score_has_function: 1,
  score_has_foundation: 1,
  score_has_active_care: 1,
  score_over_soft_budget: -3,
  score_over_hard_budget: -5,
  score_missing_each_core_field: -1,
  hot_threshold_easy_close: 5,
  hot_threshold_nurture_min: 0,
  missing_core_fields_for_nurture: 2,
}

export function getDefaultSalesBriefHeatConfig(): SalesBriefHeatRuntimeConfig {
  return { ...DEFAULT_RUNTIME_CONFIG }
}

function toNumber(value: unknown, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function normalizeSalesBriefHeatConfig(rows: Array<{ config_key?: string | null; config_value?: string | null }> | null | undefined) {
  const next = getDefaultSalesBriefHeatConfig()
  for (const row of rows || []) {
    const key = String(row?.config_key || '').trim() as keyof SalesBriefHeatRuntimeConfig
    if (!key || !(key in next)) continue
    next[key] = toNumber(row?.config_value, next[key])
  }
  return next
}

export function getSalesBriefHeatLabelText(label: SalesBriefHeatLabelKey) {
  if (label === 'easy_close') return 'Dễ chốt'
  if (label === 'reduce_budget') return 'Cần hạ ngân sách'
  return 'Cần nuôi thêm'
}

export function evaluateSalesBriefHeat(input: {
  totalCost: number
  budgetMax: number
  hasBudget: boolean
  hasLocation: boolean
  hasFunction: boolean
  hasFoundation: boolean
  hasActiveCare: boolean
  config: SalesBriefHeatRuntimeConfig
}) : SalesBriefHeatEvaluation {
  const { totalCost, budgetMax, hasBudget, hasLocation, hasFunction, hasFoundation, hasActiveCare, config } = input
  let score = 0
  const reasons: string[] = []
  let missingCount = 0

  if (hasBudget) {
    score += config.score_has_budget
    reasons.push('Đã có khung ngân sách để tư vấn sát hơn.')
  } else {
    missingCount += 1
    score += config.score_missing_each_core_field
    reasons.push('Chưa có ngân sách rõ nên vẫn cần hỏi thêm trước khi chốt hướng tư vấn.')
  }

  if (hasLocation) {
    score += config.score_has_location
    reasons.push('Đã có địa điểm xây dựng nên có thể trao đổi theo bối cảnh thực tế.')
  } else {
    missingCount += 1
    score += config.score_missing_each_core_field
    reasons.push('Chưa rõ địa điểm xây dựng nên phần vùng giá và điều kiện thi công còn cần xác nhận.')
  }

  if (hasFunction) {
    score += config.score_has_function
    reasons.push('Đã có nhu cầu công năng chính để nói chuyện theo nhu cầu thực.')
  } else {
    missingCount += 1
    score += config.score_missing_each_core_field
    reasons.push('Chưa rõ công năng chính nên phương án vẫn cần nuôi thêm để sát nhu cầu.')
  }

  if (hasFoundation) {
    score += config.score_has_foundation
    reasons.push('Đã có định hướng móng hoặc hiện trạng nền đất để giải thích phần chi phí nền móng.')
  } else {
    missingCount += 1
    score += config.score_missing_each_core_field
    reasons.push('Chưa rõ định hướng móng hoặc hiện trạng nền đất nên chưa nên đi quá sâu vào phần nền móng.')
  }

  if (hasActiveCare) {
    score += config.score_has_active_care
    reasons.push('Đang có care activity mở nên nhịp follow-up khá rõ ràng.')
  } else {
    reasons.push('Chưa có care activity mở nên cần chủ động chốt bước tiếp theo.')
  }

  let budgetDeltaPct: number | null = null
  if (hasBudget && budgetMax > 0) {
    budgetDeltaPct = ((totalCost - budgetMax) / budgetMax) * 100
    if (totalCost <= budgetMax) {
      score += config.score_within_budget
      reasons.push('Tổng đầu tư sơ bộ đang nằm trong khung ngân sách của khách.')
    } else if (budgetDeltaPct > config.budget_over_hard_pct) {
      score += config.score_over_hard_budget
      reasons.push(`Tổng đầu tư sơ bộ đang vượt ngân sách khoảng ${Math.round(budgetDeltaPct)}%, cần ưu tiên hạ ngân sách hoặc tinh gọn phương án.`)
    } else if (budgetDeltaPct > config.budget_over_soft_pct) {
      score += config.score_over_soft_budget
      reasons.push(`Tổng đầu tư sơ bộ đang vượt ngân sách khoảng ${Math.round(budgetDeltaPct)}%, nên trao đổi theo hướng tinh chỉnh thêm.`)
    } else {
      reasons.push('Tổng đầu tư sơ bộ chỉ chênh nhẹ so với ngân sách, vẫn có thể tiếp tục trao đổi để tinh chỉnh.')
    }
  }

  let label: SalesBriefHeatLabelKey = 'nurture'
  if (budgetDeltaPct != null && budgetDeltaPct > config.budget_over_hard_pct) {
    label = 'reduce_budget'
  } else if (missingCount >= config.missing_core_fields_for_nurture) {
    label = 'nurture'
  } else if (score >= config.hot_threshold_easy_close) {
    label = 'easy_close'
  } else if (score >= config.hot_threshold_nurture_min) {
    label = 'nurture'
  } else {
    label = hasBudget && budgetDeltaPct != null && budgetDeltaPct > config.budget_over_soft_pct ? 'reduce_budget' : 'nurture'
  }

  return {
    label,
    labelText: getSalesBriefHeatLabelText(label),
    score,
    reasons,
    missingCount,
    budgetDeltaPct: budgetDeltaPct != null ? Number(budgetDeltaPct.toFixed(1)) : null,
  }
}
