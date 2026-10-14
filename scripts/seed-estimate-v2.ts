import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function upsertTaxonomy(
  kind: string,
  value: string,
  name: string,
  sort_order: number,
  description?: string | null
) {
  await (prisma as any).estimationTaxonomy.upsert({
    where: { kind_value: { kind, value } },
    update: { name, sort_order, description: description ?? null, is_active: true },
    create: { kind, value, name, sort_order, description: description ?? null, is_active: true },
  })
}

async function upsertCatalog(item: {
  item_code: string
  item_name: string
  item_type: string
  item_group: string
  item_unit: string
}) {
  await (prisma as any).estimationCatalogItem.upsert({
    where: { item_code: item.item_code },
    update: { ...item, is_active: true },
    create: { ...item, is_active: true },
  })
}

async function upsertTemplate(args: {
  template_code: string
  template_name: string
  template_type: string
  house_type: string
  finish_level: string
  room_type: string
  priority: number
  version: number
}) {
  return (prisma as any).estimationTemplateHeader.upsert({
    where: { template_code_version: { template_code: args.template_code, version: args.version } },
    update: {
      template_name: args.template_name,
      template_type: args.template_type,
      house_type: args.house_type,
      finish_level: args.finish_level,
      room_type: args.room_type,
      priority: args.priority,
      is_active: true,
    },
    create: {
      ...args,
      is_active: true,
    },
  })
}

async function upsertTemplateItem(args: {
  template_id: string
  catalog_item_id: string
  apply_mode: string
  quantity_basis_key?: string
  scope_key: string
  quantity_value: number
  sort_order: number
}) {
  const existed = await (prisma as any).estimationTemplateItem.findFirst({
    where: {
      template_id: args.template_id,
      catalog_item_id: args.catalog_item_id,
      sort_order: args.sort_order,
    },
  })
  if (existed) {
    return (prisma as any).estimationTemplateItem.update({
      where: { id: existed.id },
      data: {
        apply_mode: args.apply_mode,
        quantity_basis_key: args.quantity_basis_key || null,
        scope_key: args.scope_key,
        quantity_value: args.quantity_value,
        is_active: true,
      },
    })
  }
  return (prisma as any).estimationTemplateItem.create({
    data: {
      ...args,
      quantity_basis_key: args.quantity_basis_key || null,
      is_active: true,
    },
  })
}

async function upsertRule(args: {
  rule_code: string
  rule_name: string
  scope: string
  priority: number
  version: number
  is_active: boolean
}) {
  return (prisma as any).estimationRuleHeader.upsert({
    where: { rule_code_version: { rule_code: args.rule_code, version: args.version } },
    update: {
      rule_name: args.rule_name,
      scope: args.scope,
      priority: args.priority,
      is_active: args.is_active,
    },
    create: args,
  })
}

const semanticTaxonomies: Array<{ kind: string; value: string; name: string; sort: number; description?: string }> = [
  { kind: 'fact_key', value: 'opening_count_total', name: 'Tong so o mo preset', sort: 100 },
  { kind: 'fact_key', value: 'door_count_total', name: 'Tong so cua di preset', sort: 101 },
  { kind: 'fact_key', value: 'window_count_total', name: 'Tong so cua so preset', sort: 102 },
  { kind: 'fact_key', value: 'vent_count_total', name: 'Tong so o thong gio preset', sort: 103 },
  { kind: 'fact_key', value: 'opening_area_total', name: 'Tong dien tich o mo', sort: 104 },
  { kind: 'fact_key', value: 'window_area_total', name: 'Tong dien tich cua so', sort: 105 },
  { kind: 'fact_key', value: 'door_area_total', name: 'Tong dien tich cua di', sort: 106 },
  { kind: 'fact_key', value: 'roof_special_count_total', name: 'Tong khoi co mai dac biet', sort: 107 },
  { kind: 'fact_key', value: 'stair_block_count_total', name: 'Tong khoi co cau thang preset', sort: 108 },
  { kind: 'fact_key', value: 'space_type_count_living_room', name: 'So khong gian phong khach', sort: 110 },
  { kind: 'fact_key', value: 'space_type_count_bedroom', name: 'So khong gian phong ngu', sort: 111 },
  { kind: 'fact_key', value: 'space_type_count_master_bedroom', name: 'So khong gian phong ngu master', sort: 112 },
  { kind: 'fact_key', value: 'space_type_count_kitchen', name: 'So khong gian bep', sort: 113 },
  { kind: 'fact_key', value: 'space_type_count_wc', name: 'So khong gian WC', sort: 114 },
  { kind: 'fact_key', value: 'space_type_count_balcony', name: 'So khong gian ban cong', sort: 115 },
  { kind: 'fact_key', value: 'space_type_count_garage', name: 'So khong gian gara', sort: 116 },
  { kind: 'fact_key', value: 'space_type_count_storage', name: 'So khong gian kho', sort: 117 },
  { kind: 'fact_key', value: 'space_type_area_living_room', name: 'Dien tich phong khach theo block', sort: 118 },
  { kind: 'fact_key', value: 'space_type_area_bedroom', name: 'Dien tich phong ngu theo block', sort: 119 },
  { kind: 'fact_key', value: 'space_type_area_master_bedroom', name: 'Dien tich phong ngu master theo block', sort: 120 },
  { kind: 'fact_key', value: 'space_type_area_kitchen', name: 'Dien tich bep theo block', sort: 121 },
  { kind: 'fact_key', value: 'space_type_area_wc', name: 'Dien tich WC theo block', sort: 122 },
  { kind: 'fact_key', value: 'space_profile_count_basic', name: 'So khong gian muc co ban', sort: 123 },
  { kind: 'fact_key', value: 'space_profile_count_economy', name: 'So khong gian muc tiet kiem', sort: 124 },
  { kind: 'fact_key', value: 'space_profile_count_premium', name: 'So khong gian muc cao cap', sort: 125 },
  { kind: 'fact_key', value: 'space_profile_count_utility', name: 'So khong gian muc phu tro', sort: 126 },
  { kind: 'fact_key', value: 'opening_preset_count_door_single', name: 'So preset cua don', sort: 127 },
  { kind: 'fact_key', value: 'opening_preset_count_door_double', name: 'So preset cua doi', sort: 128 },
  { kind: 'fact_key', value: 'opening_preset_count_door_sliding', name: 'So preset cua lua', sort: 129 },
  { kind: 'fact_key', value: 'opening_preset_count_window_small', name: 'So preset cua so nho', sort: 130 },
  { kind: 'fact_key', value: 'opening_preset_count_window_large', name: 'So preset cua so lon', sort: 131 },
  { kind: 'fact_key', value: 'roof_preset_count_terrace', name: 'So preset san thuong', sort: 132 },
  { kind: 'fact_key', value: 'roof_preset_count_lean_to', name: 'So preset mai lech', sort: 133 },
  { kind: 'fact_key', value: 'roof_preset_count_thai_basic', name: 'So preset mai thai co ban', sort: 134 },
  { kind: 'fact_key', value: 'stair_preset_count_straight', name: 'So preset cau thang thang', sort: 135 },
  { kind: 'fact_key', value: 'stair_preset_count_l_shape', name: 'So preset cau thang chu L', sort: 136 },
  { kind: 'fact_key', value: 'stair_preset_count_u_shape', name: 'So preset cau thang chu U', sort: 137 },
  { kind: 'fact_key', value: 'has_ceiling_count', name: 'So block co tran', sort: 138 },
  { kind: 'fact_key', value: 'has_paint_count', name: 'So block co son', sort: 139 },
  { kind: 'fact_key', value: 'has_electrical_count', name: 'So block co dien', sort: 140 },
  { kind: 'fact_key', value: 'has_plumbing_count', name: 'So block co nuoc', sort: 141 },
  { kind: 'fact_key', value: 'has_window_count', name: 'So block co cua so', sort: 142 },
  { kind: 'fact_key', value: 'has_door_count', name: 'So block co cua di', sort: 143 },
  { kind: 'required_fact', value: 'door_count_total', name: 'Can tong so cua di preset', sort: 100 },
  { kind: 'required_fact', value: 'window_count_total', name: 'Can tong so cua so preset', sort: 101 },
  { kind: 'required_fact', value: 'opening_count_total', name: 'Can tong so o mo preset', sort: 102 },
  { kind: 'required_fact', value: 'window_area_total', name: 'Can tong dien tich cua so', sort: 103 },
  { kind: 'required_fact', value: 'door_area_total', name: 'Can tong dien tich cua di', sort: 104 },
  { kind: 'required_fact', value: 'space_type_area_bedroom', name: 'Can dien tich phong ngu theo block', sort: 105 },
  { kind: 'required_fact', value: 'space_type_area_wc', name: 'Can dien tich WC theo block', sort: 106 },
  { kind: 'required_fact', value: 'space_type_area_kitchen', name: 'Can dien tich bep theo block', sort: 107 },
  { kind: 'quantity_basis', value: 'opening_count_total', name: 'Tong so o mo preset', sort: 100 },
  { kind: 'quantity_basis', value: 'door_count_total', name: 'Tong so cua di preset', sort: 101 },
  { kind: 'quantity_basis', value: 'window_count_total', name: 'Tong so cua so preset', sort: 102 },
  { kind: 'quantity_basis', value: 'window_area_total', name: 'Tong dien tich cua so', sort: 103 },
  { kind: 'quantity_basis', value: 'door_area_total', name: 'Tong dien tich cua di', sort: 104 },
  { kind: 'quantity_basis', value: 'space_type_area_bedroom', name: 'Dien tich phong ngu theo block', sort: 105 },
  { kind: 'quantity_basis', value: 'space_type_area_master_bedroom', name: 'Dien tich phong ngu master theo block', sort: 106 },
  { kind: 'quantity_basis', value: 'space_type_area_kitchen', name: 'Dien tich bep theo block', sort: 107 },
  { kind: 'quantity_basis', value: 'space_type_area_wc', name: 'Dien tich WC theo block', sort: 108 },
]

const semanticCatalogItems = [
  { item_code: 'son_noi_that', item_name: 'Sơn nội thất', item_type: 'material', item_group: 'hoan_thien', item_unit: 'm2' },
  { item_code: 'tran_thach_cao', item_name: 'Trần thạch cao', item_type: 'material', item_group: 'hoan_thien', item_unit: 'm2' },
  { item_code: 'ngoi_mai', item_name: 'Ngói mái', item_type: 'material', item_group: 'hoan_thien', item_unit: 'vien' },
  { item_code: 'kinh_mat_tien', item_name: 'Kính mặt tiền', item_type: 'material', item_group: 'hoan_thien', item_unit: 'm2' },
  { item_code: 'thiet_bi_bep', item_name: 'Thiết bị bếp cơ bản', item_type: 'equipment', item_group: 'noi_that', item_unit: 'bo' },
  { item_code: 'phu_kien_cua', item_name: 'Phụ kiện cửa', item_type: 'fixture', item_group: 'hoan_thien', item_unit: 'bo' },
]

async function main() {
    const taxonomies: Array<{ kind: string; value: string; name: string; sort: number; description?: string }> = [
    { kind: 'house_type', value: 'nha_pho', name: 'Nha pho', sort: 1 },
    { kind: 'house_type', value: 'biet_thu', name: 'Biet thu', sort: 2 },
    { kind: 'house_type', value: 'nha_cap_4', name: 'Nha cap 4', sort: 3 },
    { kind: 'foundation_type', value: 'mong_coc', name: 'Mong coc', sort: 1 },
    { kind: 'foundation_type', value: 'mong_bang', name: 'Mong bang', sort: 2 },
    { kind: 'foundation_type', value: 'mong_be', name: 'Mong be', sort: 3 },
    { kind: 'level', value: 'co_ban', name: 'Co ban', sort: 1 },
    { kind: 'level', value: 'tieu_chuan', name: 'Tieu chuan', sort: 2 },
    { kind: 'level', value: 'cao_cap', name: 'Cao cap', sort: 3 },
    { kind: 'template_type', value: 'room', name: 'Room', sort: 1 },
    { kind: 'template_type', value: 'wc', name: 'WC', sort: 2 },
    { kind: 'template_type', value: 'foundation', name: 'Foundation', sort: 3 },
    { kind: 'template_type', value: 'house', name: 'House', sort: 4 },
    { kind: 'template_type', value: 'mep', name: 'MEP', sort: 5 },
    { kind: 'room_type', value: 'bedroom', name: 'Phong ngu', sort: 1 },
    { kind: 'room_type', value: 'wc', name: 'WC', sort: 2 },
    { kind: 'room_type', value: 'kitchen', name: 'Bep', sort: 3 },
    { kind: 'room_type', value: 'living_room', name: 'Phong khach', sort: 4 },
    { kind: 'room_type', value: 'cau_thang', name: 'Cau thang', sort: 5 },
    { kind: 'room_type', value: 'mong_coc', name: 'Mong coc', sort: 6 },
    { kind: 'room_type', value: 'tum', name: 'Tum', sort: 7 },
    { kind: 'scope_type', value: 'bedroom', name: 'Bedroom', sort: 1 },
    { kind: 'scope_type', value: 'wc', name: 'WC', sort: 2 },
    { kind: 'scope_type', value: 'kitchen', name: 'Kitchen', sort: 3 },
    { kind: 'scope_type', value: 'living_room', name: 'Living room', sort: 4 },
    { kind: 'scope_type', value: 'cau_thang', name: 'Cau thang', sort: 5 },
    { kind: 'scope_type', value: 'mong_coc', name: 'Mong coc', sort: 6 },
    { kind: 'scope_type', value: 'tum', name: 'Tum', sort: 7 },
    { kind: 'assembly_component_type', value: 'foundation', name: 'Mong', sort: 1 },
    { kind: 'assembly_component_type', value: 'slab', name: 'San', sort: 2 },
    { kind: 'assembly_component_type', value: 'wall', name: 'Tuong', sort: 3 },
    { kind: 'assembly_component_type', value: 'column', name: 'Cot', sort: 4 },
    { kind: 'assembly_component_type', value: 'room', name: 'Phong', sort: 5 },
    { kind: 'assembly_component_type', value: 'stair', name: 'Cau thang', sort: 6 },
    { kind: 'assembly_component_type', value: 'ceiling', name: 'Tran', sort: 7 },
    { kind: 'assembly_component_type', value: 'tum', name: 'Tum', sort: 8 },
    { kind: 'assembly_component_type', value: 'tum_roof', name: 'Noc tum', sort: 9 },
    { kind: 'fact_key', value: 'build_length_m', name: 'Chieu dai xay dung (m)', sort: 1 },
    { kind: 'fact_key', value: 'build_width_m', name: 'Chieu rong xay dung (m)', sort: 2 },
    { kind: 'fact_key', value: 'floor_height_m', name: 'Chieu cao tang (m)', sort: 3 },
    { kind: 'fact_key', value: 'floors', name: 'So tang', sort: 4 },
    { kind: 'fact_key', value: 'tum_count', name: 'So tum', sort: 5 },
    { kind: 'fact_key', value: 'bedroom_count', name: 'So phong ngu', sort: 6 },
    { kind: 'fact_key', value: 'wc_count', name: 'So WC', sort: 7 },
    { kind: 'fact_key', value: 'floor_area_total', name: 'Tong dien tich san', sort: 8 },
    { kind: 'fact_key', value: 'wall_surface_area_total', name: 'Tong dien tich tuong', sort: 9 },
    { kind: 'required_fact', value: 'build_length_m', name: 'Can chieu dai xay dung', sort: 1 },
    { kind: 'required_fact', value: 'build_width_m', name: 'Can chieu rong xay dung', sort: 2 },
    { kind: 'required_fact', value: 'floor_height_m', name: 'Can chieu cao tang', sort: 3 },
    { kind: 'required_fact', value: 'floors', name: 'Can so tang', sort: 4 },
    { kind: 'required_fact', value: 'tum_count', name: 'Can so tum', sort: 5 },
    { kind: 'required_fact', value: 'floor_area_total', name: 'Can tong dien tich san', sort: 6 },
    { kind: 'required_fact', value: 'wall_surface_area_total', name: 'Can tong dien tich tuong', sort: 7 },
    { kind: 'formula_preset', value: 'wall_surface_total', name: 'm2 tuong tong', sort: 1, description: '(build_length_m + build_width_m) * 2 * floor_height_m * floors' },
    { kind: 'formula_preset', value: 'floor_area_without_tum', name: 'dien tich san khong tum', sort: 2, description: 'floor_area_total - tum_area' },
    { kind: 'quantity_basis', value: 'floor_area_total', name: 'Tong dien tich san', sort: 1 },
    { kind: 'quantity_basis', value: 'main_floor_area_total', name: 'Dien tich san khong tum', sort: 2 },
    { kind: 'quantity_basis', value: 'floor_area_without_tum', name: 'Dien tich san (derived)', sort: 3 },
    { kind: 'quantity_basis', value: 'wall_surface_area_total', name: 'Dien tich tuong', sort: 4 },
    { kind: 'quantity_basis', value: 'ceiling_area_total', name: 'Dien tich tran', sort: 5 },
    { kind: 'quantity_basis', value: 'column_linear_total', name: 'Chieu dai cot', sort: 6 },
    { kind: 'quantity_basis', value: 'tum_area_total', name: 'Dien tich tum', sort: 7 },
    { kind: 'quantity_basis', value: 'room_count', name: 'Tong so phong', sort: 8 },
    { kind: 'quantity_basis', value: 'bedroom_count', name: 'So phong ngu', sort: 9 },
    { kind: 'quantity_basis', value: 'wc_count', name: 'So WC', sort: 10 },
    { kind: 'quantity_basis', value: 'kitchen_count', name: 'So bep', sort: 11 },
    { kind: 'quantity_basis', value: 'living_room_count', name: 'So phong khach', sort: 12 },
    { kind: 'quantity_basis', value: 'floor_count_total', name: 'So san (tang + tum)', sort: 13 },
    { kind: 'item_type', value: 'material', name: 'Vat tu', sort: 1 },
    { kind: 'item_type', value: 'labor', name: 'Nhan cong', sort: 2 },
    { kind: 'item_type', value: 'equipment', name: 'Thiet bi', sort: 3 },
    { kind: 'item_type', value: 'fixture', name: 'Phu kien', sort: 4 },
    { kind: 'item_group', value: 'ket_cau', name: 'Ket cau', sort: 1 },
    { kind: 'item_group', value: 'xay_to', name: 'Xay to', sort: 2 },
    { kind: 'item_group', value: 'hoan_thien', name: 'Hoan thien', sort: 3 },
    { kind: 'item_group', value: 'mep_dien', name: 'MEP Dien', sort: 4 },
    { kind: 'item_group', value: 'mep_nuoc', name: 'MEP Nuoc', sort: 5 },
    { kind: 'item_unit', value: 'kg', name: 'kg', sort: 1 },
    { kind: 'item_unit', value: 'm2', name: 'm2', sort: 2 },
    { kind: 'item_unit', value: 'm3', name: 'm3', sort: 3 },
    { kind: 'item_unit', value: 'm', name: 'm', sort: 4 },
    { kind: 'item_unit', value: 'vien', name: 'vien', sort: 5 },
    { kind: 'item_unit', value: 'cai', name: 'cai', sort: 6 },
    { kind: 'item_unit', value: 'bo', name: 'bo', sort: 7 },
    { kind: 'supplier', value: 'ncc_default', name: 'NCC mac dinh', sort: 1 },
    { kind: 'supplier', value: 'ncc_premium', name: 'NCC cao cap', sort: 2 },
    ...semanticTaxonomies,
  ]
  for (const x of taxonomies) {
    await upsertTaxonomy(x.kind, x.value, x.name, x.sort, x.description ?? null)
  }
  const items = [
  { item_code: 'gach', item_name: 'Gạch', item_type: 'material', item_group: 'xay_to', item_unit: 'vien' },
  { item_code: 'xi_mang', item_name: 'Xi măng', item_type: 'material', item_group: 'xay_to', item_unit: 'kg' },
  { item_code: 'thep', item_name: 'Thép', item_type: 'material', item_group: 'ket_cau', item_unit: 'kg' },
  { item_code: 'coc_250_250', item_name: 'Cọc 250x250', item_type: 'material', item_group: 'ket_cau', item_unit: 'm' },
  { item_code: 'den_led', item_name: 'Đèn LED', item_type: 'equipment', item_group: 'mep_dien', item_unit: 'cai' },
  { item_code: 'day_dien', item_name: 'Dây điện', item_type: 'material', item_group: 'mep_dien', item_unit: 'm' },
  { item_code: 'cua_di', item_name: 'Cửa đi', item_type: 'fixture', item_group: 'hoan_thien', item_unit: 'cai' },
  { item_code: 'cua_so', item_name: 'Cửa sổ', item_type: 'fixture', item_group: 'hoan_thien', item_unit: 'cai' },
  { item_code: 'bon_cau', item_name: 'Bồn cầu', item_type: 'equipment', item_group: 'mep_nuoc', item_unit: 'cai' },
  { item_code: 'lavabo', item_name: 'Lavabo', item_type: 'equipment', item_group: 'mep_nuoc', item_unit: 'cai' },
  ...semanticCatalogItems,
]
  for (const x of items) await upsertCatalog(x)

  const itemRows = await (prisma as any).estimationCatalogItem.findMany({
    where: { item_code: { in: ['thep', 'xi_mang', 'den_led', 'day_dien', 'cua_di', 'cua_so', 'ngoi_mai', 'tran_thach_cao', 'thiet_bi_bep', 'kinh_mat_tien', 'phu_kien_cua'] } },
  })
  const itemMap = new Map<string, any>()
  itemRows.forEach((x: any) => itemMap.set(x.item_code, x))

  const columnTemplate = await upsertTemplate({
    template_code: 'tpl_structure_column_std',
    template_name: 'Cot ket cau so bo',
    template_type: 'house',
    house_type: 'nha_pho',
    finish_level: 'tieu_chuan',
    room_type: 'cot',
    priority: 22,
    version: 1,
  })
  const masterBedroomTemplate = await upsertTemplate({
    template_code: 'tpl_room_master_bedroom_std',
    template_name: 'Phong ngu master tieu chuan',
    template_type: 'room',
    house_type: 'nha_pho',
    finish_level: 'tieu_chuan',
    room_type: 'master_bedroom',
    priority: 12,
    version: 1,
  })
  const kitchenTemplate = await upsertTemplate({
    template_code: 'tpl_room_kitchen_std',
    template_name: 'Bep tieu chuan',
    template_type: 'room',
    house_type: 'nha_pho',
    finish_level: 'tieu_chuan',
    room_type: 'kitchen',
    priority: 13,
    version: 1,
  })
  const roofTemplate = await upsertTemplate({
    template_code: 'tpl_roof_thai_basic_std',
    template_name: 'Mai thai co ban',
    template_type: 'house',
    house_type: 'nha_pho',
    finish_level: 'tieu_chuan',
    room_type: 'roof',
    priority: 23,
    version: 1,
  })
  if (itemMap.get('thep')) {
    await upsertTemplateItem({
      template_id: columnTemplate.id,
      catalog_item_id: itemMap.get('thep').id,
      apply_mode: 'per_area',
      quantity_basis_key: 'column_linear_total',
      scope_key: 'cot',
      quantity_value: 28,
      sort_order: 1,
    })
  }
  if (itemMap.get('xi_mang')) {
    await upsertTemplateItem({
      template_id: columnTemplate.id,
      catalog_item_id: itemMap.get('xi_mang').id,
      apply_mode: 'per_area',
      quantity_basis_key: 'column_linear_total',
      scope_key: 'cot',
      quantity_value: 70,
      sort_order: 2,
    })
  }
  if (itemMap.get('den_led')) {
    await upsertTemplateItem({
      template_id: masterBedroomTemplate.id,
      catalog_item_id: itemMap.get('den_led').id,
      apply_mode: 'per_area',
      quantity_basis_key: 'space_type_area_master_bedroom',
      scope_key: 'master_bedroom',
      quantity_value: 1.2,
      sort_order: 1,
    })
  }
  if (itemMap.get('day_dien')) {
    await upsertTemplateItem({
      template_id: masterBedroomTemplate.id,
      catalog_item_id: itemMap.get('day_dien').id,
      apply_mode: 'per_area',
      quantity_basis_key: 'space_type_area_master_bedroom',
      scope_key: 'master_bedroom',
      quantity_value: 10,
      sort_order: 2,
    })
    await upsertTemplateItem({
      template_id: kitchenTemplate.id,
      catalog_item_id: itemMap.get('day_dien').id,
      apply_mode: 'per_area',
      quantity_basis_key: 'space_type_area_kitchen',
      scope_key: 'kitchen',
      quantity_value: 9,
      sort_order: 1,
    })
  }
  if (itemMap.get('cua_di')) {
    await upsertTemplateItem({
      template_id: masterBedroomTemplate.id,
      catalog_item_id: itemMap.get('cua_di').id,
      apply_mode: 'per_unit',
      quantity_basis_key: 'space_type_count_master_bedroom',
      scope_key: 'master_bedroom',
      quantity_value: 1,
      sort_order: 3,
    })
  }
  if (itemMap.get('cua_so')) {
    await upsertTemplateItem({
      template_id: masterBedroomTemplate.id,
      catalog_item_id: itemMap.get('cua_so').id,
      apply_mode: 'per_unit',
      quantity_basis_key: 'space_type_count_master_bedroom',
      scope_key: 'master_bedroom',
      quantity_value: 2,
      sort_order: 4,
    })
  }
  if (itemMap.get('thiet_bi_bep')) {
    await upsertTemplateItem({
      template_id: kitchenTemplate.id,
      catalog_item_id: itemMap.get('thiet_bi_bep').id,
      apply_mode: 'per_unit',
      quantity_basis_key: 'kitchen_count',
      scope_key: 'kitchen',
      quantity_value: 1,
      sort_order: 2,
    })
  }
  if (itemMap.get('ngoi_mai')) {
    await upsertTemplateItem({
      template_id: roofTemplate.id,
      catalog_item_id: itemMap.get('ngoi_mai').id,
      apply_mode: 'per_unit',
      quantity_basis_key: 'roof_preset_count_thai_basic',
      scope_key: 'roof',
      quantity_value: 320,
      sort_order: 1,
    })
  }
  if (itemMap.get('tran_thach_cao')) {
    await upsertTemplateItem({
      template_id: roofTemplate.id,
      catalog_item_id: itemMap.get('tran_thach_cao').id,
      apply_mode: 'per_area',
      quantity_basis_key: 'ceiling_area_total',
      scope_key: 'roof',
      quantity_value: 0.15,
      sort_order: 2,
    })
  }

  const ruleV1 = await upsertRule({
    rule_code: 'column_count_nha_pho',
    rule_name: 'So cot nha pho >= 3 tang (v1)',
    scope: 'structure',
    priority: 58,
    version: 1,
    is_active: false,
  })
  await (prisma as any).estimationRuleCondition.deleteMany({ where: { rule_id: ruleV1.id } })
  await (prisma as any).estimationRuleAction.deleteMany({ where: { rule_id: ruleV1.id } })
  await (prisma as any).estimationRuleCondition.createMany({
    data: [
      { rule_id: ruleV1.id, fact_key: 'house_type', operator: 'eq', value_text: 'nha_pho', sort_order: 1 },
      { rule_id: ruleV1.id, fact_key: 'floors', operator: 'gte', value_number: 3, sort_order: 2 },
      { rule_id: ruleV1.id, fact_key: 'floors', operator: 'lte', value_number: 3, sort_order: 3 },
    ],
  })
  await (prisma as any).estimationRuleAction.createMany({
    data: [
      { rule_id: ruleV1.id, action_type: 'set_field', target_key: 'column_count', value_number: 5, sort_order: 1 },
    ],
  })

  const ruleV2 = await upsertRule({
    rule_code: 'column_count_nha_pho',
    rule_name: 'So cot nha pho >= 3 tang (v2 - chuan)',
    scope: 'structure',
    priority: 60,
    version: 2,
    is_active: true,
  })
  await (prisma as any).estimationRuleCondition.deleteMany({ where: { rule_id: ruleV2.id } })
  await (prisma as any).estimationRuleAction.deleteMany({ where: { rule_id: ruleV2.id } })
  await (prisma as any).estimationRuleCondition.createMany({
    data: [
      { rule_id: ruleV2.id, fact_key: 'house_type', operator: 'eq', value_text: 'nha_pho', sort_order: 1 },
      { rule_id: ruleV2.id, fact_key: 'floors', operator: 'gte', value_number: 3, sort_order: 2 },
      { rule_id: ruleV2.id, fact_key: 'floors', operator: 'lte', value_number: 3, sort_order: 3 },
    ],
  })
  await (prisma as any).estimationRuleAction.createMany({
    data: [
      { rule_id: ruleV2.id, action_type: 'set_field', target_key: 'column_count', value_number: 6, sort_order: 1 },
      { rule_id: ruleV2.id, action_type: 'set_field', target_key: 'column_linear_total', formula_expr: 'column_count * floor_height_m * floors', sort_order: 2 },
      { rule_id: ruleV2.id, action_type: 'suggest_value', target_key: 'column_note', value_text: 'V2 dat 6 cot cho nha pho 3 tang', sort_order: 3 },
    ],
  })
  await (prisma as any).estimationRuleHeader.updateMany({
    where: { rule_code: 'column_count_nha_pho', id: { not: ruleV2.id } },
    data: { is_active: false },
  })

  const roofSemanticRule = await upsertRule({
    rule_code: 'semantic_roof_thai_basic',
    rule_name: 'Bo sung goi y cho mai thai co ban',
    scope: 'roof',
    priority: 70,
    version: 1,
    is_active: true,
  })
  await (prisma as any).estimationRuleCondition.deleteMany({ where: { rule_id: roofSemanticRule.id } })
  await (prisma as any).estimationRuleAction.deleteMany({ where: { rule_id: roofSemanticRule.id } })
  await (prisma as any).estimationRuleCondition.createMany({
    data: [
      { rule_id: roofSemanticRule.id, fact_key: 'roof_preset_count_thai_basic', operator: 'gte', value_number: 1, sort_order: 1 },
    ],
  })
  await (prisma as any).estimationRuleAction.createMany({
    data: [
      { rule_id: roofSemanticRule.id, action_type: 'add_warning', value_text: 'Co mai thai: nen kiem tra lai do doc mai va vat tu hoan thien mai.', sort_order: 1 },
      { rule_id: roofSemanticRule.id, action_type: 'suggest_value', target_key: 'roof_style_note', value_text: 'Mai thai co ban', sort_order: 2 },
    ],
  })

  const windowSemanticRule = await upsertRule({
    rule_code: 'semantic_window_large_glass',
    rule_name: 'Bo sung kinh cho cua so lon',
    scope: 'room',
    priority: 71,
    version: 1,
    is_active: true,
  })
  await (prisma as any).estimationRuleCondition.deleteMany({ where: { rule_id: windowSemanticRule.id } })
  await (prisma as any).estimationRuleAction.deleteMany({ where: { rule_id: windowSemanticRule.id } })
  await (prisma as any).estimationRuleCondition.createMany({
    data: [
      { rule_id: windowSemanticRule.id, fact_key: 'opening_preset_count_window_large', operator: 'gte', value_number: 1, sort_order: 1 },
    ],
  })
  await (prisma as any).estimationRuleAction.createMany({
    data: [
      {
        rule_id: windowSemanticRule.id,
        action_type: 'add_item',
        target_key: 'kinh_mat_tien',
        value_json: { item_code: 'kinh_mat_tien', item_name: 'Kinh mat tien', unit: 'm2', quantity: 4 },
        formula_expr: 'opening_preset_count_window_large * 4',
        sort_order: 1,
      },
      { rule_id: windowSemanticRule.id, action_type: 'add_warning', value_text: 'Co cua so lon: nen kiem tra lai phuong an nhom kinh va che nang.', sort_order: 2 },
    ],
  })

  const premiumSemanticRule = await upsertRule({
    rule_code: 'semantic_space_profile_premium',
    rule_name: 'Dieu chinh he so cho khong gian cao cap',
    scope: 'pricing',
    priority: 72,
    version: 1,
    is_active: true,
  })
  await (prisma as any).estimationRuleCondition.deleteMany({ where: { rule_id: premiumSemanticRule.id } })
  await (prisma as any).estimationRuleAction.deleteMany({ where: { rule_id: premiumSemanticRule.id } })
  await (prisma as any).estimationRuleCondition.createMany({
    data: [
      { rule_id: premiumSemanticRule.id, fact_key: 'space_profile_count_premium', operator: 'gte', value_number: 1, sort_order: 1 },
    ],
  })
  await (prisma as any).estimationRuleAction.createMany({
    data: [
      { rule_id: premiumSemanticRule.id, action_type: 'multiply_coeff', value_number: 1.08, sort_order: 1 },
      { rule_id: premiumSemanticRule.id, action_type: 'suggest_value', target_key: 'finish_note', value_text: 'Co khong gian cao cap: nen chon vat tu hoan thien tuong ung.', sort_order: 2 },
    ],
  })

  const windowAreaRule = await upsertRule({
    rule_code: 'semantic_window_area_glass',
    rule_name: 'Bo sung kinh theo tong dien tich cua so',
    scope: 'room',
    priority: 73,
    version: 1,
    is_active: true,
  })
  await (prisma as any).estimationRuleCondition.deleteMany({ where: { rule_id: windowAreaRule.id } })
  await (prisma as any).estimationRuleAction.deleteMany({ where: { rule_id: windowAreaRule.id } })
  await (prisma as any).estimationRuleCondition.createMany({
    data: [
      { rule_id: windowAreaRule.id, fact_key: 'window_area_total', operator: 'gte', value_number: 1, sort_order: 1 },
    ],
  })
  await (prisma as any).estimationRuleAction.createMany({
    data: [
      {
        rule_id: windowAreaRule.id,
        action_type: 'add_item',
        target_key: 'kinh_mat_tien',
        value_json: { item_code: 'kinh_mat_tien', item_name: 'Kinh mat tien', unit: 'm2', quantity: 1 },
        formula_expr: 'window_area_total',
        sort_order: 1,
      },
      { rule_id: windowAreaRule.id, action_type: 'suggest_value', target_key: 'window_note', value_text: 'Dien tich kinh dang lay theo tong dien tich cua so thuc te.', sort_order: 2 },
    ],
  })

  const doorHardwareRule = await upsertRule({
    rule_code: 'semantic_door_count_hardware',
    rule_name: 'Bo sung phu kien theo so cua di',
    scope: 'room',
    priority: 74,
    version: 1,
    is_active: true,
  })
  await (prisma as any).estimationRuleCondition.deleteMany({ where: { rule_id: doorHardwareRule.id } })
  await (prisma as any).estimationRuleAction.deleteMany({ where: { rule_id: doorHardwareRule.id } })
  await (prisma as any).estimationRuleCondition.createMany({
    data: [
      { rule_id: doorHardwareRule.id, fact_key: 'door_count_total', operator: 'gte', value_number: 1, sort_order: 1 },
    ],
  })
  await (prisma as any).estimationRuleAction.createMany({
    data: [
      {
        rule_id: doorHardwareRule.id,
        action_type: 'add_item',
        target_key: 'phu_kien_cua',
        value_json: { item_code: 'phu_kien_cua', item_name: 'Phu kien cua', unit: 'bo', quantity: 1 },
        formula_expr: 'door_count_total',
        sort_order: 1,
      },
      { rule_id: doorHardwareRule.id, action_type: 'suggest_value', target_key: 'door_note', value_text: 'Phu kien cua dang tam tinh theo so cua di thuc te.', sort_order: 2 },
    ],
  })

  console.log('Seed Estimate V2 done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
