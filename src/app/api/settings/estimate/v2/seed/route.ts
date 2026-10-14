import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

type SeedTaxonomy = { kind: string; value: string; name: string; sort_order: number; description?: string | null }
type SeedCatalog = {
  item_code: string
  item_name: string
  item_type: string
  item_group: string
  item_unit: string
}

const semanticFactSeeds: SeedTaxonomy[] = [
  { kind: 'fact_key', value: 'footprint_area', name: 'Dien tich footprint', sort_order: 90 },
  { kind: 'fact_key', value: 'gross_wall_area_total', name: 'Tong dien tich tuong tho', sort_order: 91 },
  { kind: 'fact_key', value: 'net_wall_area_total', name: 'Tong dien tich tuong thuan', sort_order: 92 },
  { kind: 'fact_key', value: 'wall_surface_area_gross', name: 'Dien tich be mat tuong tho', sort_order: 93 },
  { kind: 'fact_key', value: 'wall_surface_area_net', name: 'Dien tich be mat tuong thuan', sort_order: 94 },
  { kind: 'fact_key', value: 'opening_count_total', name: 'Tong so o mo preset', sort_order: 100 },
  { kind: 'fact_key', value: 'door_count_total', name: 'Tong so cua di preset', sort_order: 101 },
  { kind: 'fact_key', value: 'window_count_total', name: 'Tong so cua so preset', sort_order: 102 },
  { kind: 'fact_key', value: 'vent_count_total', name: 'Tong so o thong gio preset', sort_order: 103 },
  { kind: 'fact_key', value: 'opening_area_total', name: 'Tong dien tich o mo', sort_order: 104 },
  { kind: 'fact_key', value: 'window_area_total', name: 'Tong dien tich cua so', sort_order: 105 },
  { kind: 'fact_key', value: 'door_area_total', name: 'Tong dien tich cua di', sort_order: 106 },
  { kind: 'fact_key', value: 'facade_role_window_area_main_front', name: 'Dien tich cua so mat tien chinh', sort_order: 1061 },
  { kind: 'fact_key', value: 'facade_role_opening_count_main_front', name: 'Tong o mo mat tien chinh', sort_order: 1062 },
  { kind: 'fact_key', value: 'roof_special_count_total', name: 'Tong khoi co mai dac biet', sort_order: 107 },
  { kind: 'fact_key', value: 'stair_block_count_total', name: 'Tong khoi co cau thang preset', sort_order: 108 },
  { kind: 'fact_key', value: 'space_type_count_living_room', name: 'So khong gian phong khach', sort_order: 110 },
  { kind: 'fact_key', value: 'space_type_count_bedroom', name: 'So khong gian phong ngu', sort_order: 111 },
  { kind: 'fact_key', value: 'space_type_count_master_bedroom', name: 'So khong gian phong ngu master', sort_order: 112 },
  { kind: 'fact_key', value: 'space_type_count_kitchen', name: 'So khong gian bep', sort_order: 113 },
  { kind: 'fact_key', value: 'space_type_count_wc', name: 'So khong gian WC', sort_order: 114 },
  { kind: 'fact_key', value: 'space_type_count_balcony', name: 'So khong gian ban cong', sort_order: 115 },
  { kind: 'fact_key', value: 'space_type_count_garage', name: 'So khong gian gara', sort_order: 116 },
  { kind: 'fact_key', value: 'space_type_count_storage', name: 'So khong gian kho', sort_order: 117 },
  { kind: 'fact_key', value: 'space_type_area_living_room', name: 'Dien tich phong khach theo block', sort_order: 118 },
  { kind: 'fact_key', value: 'space_type_area_bedroom', name: 'Dien tich phong ngu theo block', sort_order: 119 },
  { kind: 'fact_key', value: 'space_type_area_master_bedroom', name: 'Dien tich phong ngu master theo block', sort_order: 120 },
  { kind: 'fact_key', value: 'space_type_area_kitchen', name: 'Dien tich bep theo block', sort_order: 121 },
  { kind: 'fact_key', value: 'space_type_area_wc', name: 'Dien tich WC theo block', sort_order: 122 },
  { kind: 'fact_key', value: 'space_profile_count_basic', name: 'So khong gian muc co ban', sort_order: 123 },
  { kind: 'fact_key', value: 'space_profile_count_economy', name: 'So khong gian muc tiet kiem', sort_order: 124 },
  { kind: 'fact_key', value: 'space_profile_count_premium', name: 'So khong gian muc cao cap', sort_order: 125 },
  { kind: 'fact_key', value: 'space_profile_count_utility', name: 'So khong gian muc phu tro', sort_order: 126 },
  { kind: 'fact_key', value: 'opening_preset_count_door_single', name: 'So preset cua don', sort_order: 127 },
  { kind: 'fact_key', value: 'opening_preset_count_door_double', name: 'So preset cua doi', sort_order: 128 },
  { kind: 'fact_key', value: 'opening_preset_count_door_sliding', name: 'So preset cua lua', sort_order: 129 },
  { kind: 'fact_key', value: 'opening_preset_count_window_small', name: 'So preset cua so nho', sort_order: 130 },
  { kind: 'fact_key', value: 'opening_preset_count_window_large', name: 'So preset cua so lon', sort_order: 131 },
  { kind: 'fact_key', value: 'roof_preset_count_terrace', name: 'So preset san thuong', sort_order: 132 },
  { kind: 'fact_key', value: 'roof_preset_count_lean_to', name: 'So preset mai lech', sort_order: 133 },
  { kind: 'fact_key', value: 'roof_preset_count_thai_basic', name: 'So preset mai thai co ban', sort_order: 134 },
  { kind: 'fact_key', value: 'stair_preset_count_straight', name: 'So preset cau thang thang', sort_order: 135 },
  { kind: 'fact_key', value: 'stair_preset_count_l_shape', name: 'So preset cau thang chu L', sort_order: 136 },
  { kind: 'fact_key', value: 'stair_preset_count_u_shape', name: 'So preset cau thang chu U', sort_order: 137 },
  { kind: 'fact_key', value: 'has_ceiling_count', name: 'So block co tran', sort_order: 138 },
  { kind: 'fact_key', value: 'has_paint_count', name: 'So block co son', sort_order: 139 },
  { kind: 'fact_key', value: 'has_electrical_count', name: 'So block co dien', sort_order: 140 },
  { kind: 'fact_key', value: 'has_plumbing_count', name: 'So block co nuoc', sort_order: 141 },
  { kind: 'fact_key', value: 'has_window_count', name: 'So block co cua so', sort_order: 142 },
  { kind: 'fact_key', value: 'has_door_count', name: 'So block co cua di', sort_order: 143 },
  { kind: 'required_fact', value: 'gross_wall_area_total', name: 'Can tong dien tich tuong tho', sort_order: 95 },
  { kind: 'required_fact', value: 'net_wall_area_total', name: 'Can tong dien tich tuong thuan', sort_order: 96 },
  { kind: 'required_fact', value: 'wall_surface_area_gross', name: 'Can dien tich be mat tuong tho', sort_order: 97 },
  { kind: 'required_fact', value: 'wall_surface_area_net', name: 'Can dien tich be mat tuong thuan', sort_order: 98 },
  { kind: 'required_fact', value: 'door_count_total', name: 'Can tong so cua di preset', sort_order: 100 },
  { kind: 'required_fact', value: 'window_count_total', name: 'Can tong so cua so preset', sort_order: 101 },
  { kind: 'required_fact', value: 'opening_count_total', name: 'Can tong so o mo preset', sort_order: 102 },
  { kind: 'required_fact', value: 'window_area_total', name: 'Can tong dien tich cua so', sort_order: 103 },
  { kind: 'required_fact', value: 'door_area_total', name: 'Can tong dien tich cua di', sort_order: 104 },
  { kind: 'required_fact', value: 'facade_role_window_area_main_front', name: 'Can dien tich cua so mat tien chinh', sort_order: 1041 },
  { kind: 'required_fact', value: 'facade_role_opening_count_main_front', name: 'Can tong o mo mat tien chinh', sort_order: 1042 },
  { kind: 'required_fact', value: 'space_type_area_bedroom', name: 'Can dien tich phong ngu theo block', sort_order: 105 },
  { kind: 'required_fact', value: 'space_type_area_wc', name: 'Can dien tich WC theo block', sort_order: 106 },
  { kind: 'required_fact', value: 'space_type_area_kitchen', name: 'Can dien tich bep theo block', sort_order: 107 },
  { kind: 'quantity_basis', value: 'footprint_area', name: 'Dien tich footprint', sort_order: 90 },
  { kind: 'quantity_basis', value: 'gross_wall_area_total', name: 'Tong dien tich tuong tho', sort_order: 91 },
  { kind: 'quantity_basis', value: 'net_wall_area_total', name: 'Tong dien tich tuong thuan', sort_order: 92 },
  { kind: 'quantity_basis', value: 'wall_surface_area_gross', name: 'Dien tich be mat tuong tho', sort_order: 93 },
  { kind: 'quantity_basis', value: 'wall_surface_area_net', name: 'Dien tich be mat tuong thuan', sort_order: 94 },
  { kind: 'quantity_basis', value: 'opening_count_total', name: 'Tong so o mo preset', sort_order: 100 },
  { kind: 'quantity_basis', value: 'door_count_total', name: 'Tong so cua di preset', sort_order: 101 },
  { kind: 'quantity_basis', value: 'window_count_total', name: 'Tong so cua so preset', sort_order: 102 },
  { kind: 'quantity_basis', value: 'window_area_total', name: 'Tong dien tich cua so', sort_order: 103 },
  { kind: 'quantity_basis', value: 'door_area_total', name: 'Tong dien tich cua di', sort_order: 104 },
  { kind: 'quantity_basis', value: 'facade_role_window_area_main_front', name: 'Dien tich cua so mat tien chinh', sort_order: 1041 },
  { kind: 'quantity_basis', value: 'facade_role_opening_count_main_front', name: 'Tong o mo mat tien chinh', sort_order: 1042 },
  { kind: 'quantity_basis', value: 'space_type_area_bedroom', name: 'Dien tich phong ngu theo block', sort_order: 105 },
  { kind: 'quantity_basis', value: 'space_type_area_master_bedroom', name: 'Dien tich phong ngu master theo block', sort_order: 106 },
  { kind: 'quantity_basis', value: 'space_type_area_kitchen', name: 'Dien tich bep theo block', sort_order: 107 },
  { kind: 'quantity_basis', value: 'space_type_area_wc', name: 'Dien tich WC theo block', sort_order: 108 },
]

export async function POST() {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const prismaAny = db as any

  const taxonomySeeds: SeedTaxonomy[] = [
    { kind: 'house_type', value: 'nha_pho', name: 'Nha pho', sort_order: 1 },
    { kind: 'house_type', value: 'biet_thu', name: 'Biet thu', sort_order: 2 },
    { kind: 'house_type', value: 'nha_cap_4', name: 'Nha cap 4', sort_order: 3 },
    { kind: 'foundation_type', value: 'mong_coc', name: 'Mong coc', sort_order: 1 },
    { kind: 'foundation_type', value: 'mong_bang', name: 'Mong bang', sort_order: 2 },
    { kind: 'foundation_type', value: 'mong_be', name: 'Mong be', sort_order: 3 },

    { kind: 'level', value: 'co_ban', name: 'Co ban', sort_order: 1 },
    { kind: 'level', value: 'tieu_chuan', name: 'Tieu chuan', sort_order: 2 },
    { kind: 'level', value: 'cao_cap', name: 'Cao cap', sort_order: 3 },

    { kind: 'template_type', value: 'room', name: 'Room', sort_order: 1 },
    { kind: 'template_type', value: 'wc', name: 'WC', sort_order: 2 },
    { kind: 'template_type', value: 'foundation', name: 'Foundation', sort_order: 3 },
    { kind: 'template_type', value: 'house', name: 'House', sort_order: 4 },
    { kind: 'template_type', value: 'mep', name: 'MEP', sort_order: 5 },
    { kind: 'template_type', value: 'facade', name: 'Facade', sort_order: 6 },

    { kind: 'room_type', value: 'bedroom', name: 'Phong ngu', sort_order: 1 },
    { kind: 'room_type', value: 'wc', name: 'WC', sort_order: 2 },
    { kind: 'room_type', value: 'kitchen', name: 'Bep', sort_order: 3 },
    { kind: 'room_type', value: 'living_room', name: 'Phong khach', sort_order: 4 },
    { kind: 'room_type', value: 'cau_thang', name: 'Cau thang', sort_order: 5 },
    { kind: 'room_type', value: 'mong_coc', name: 'Mong coc', sort_order: 6 },
    { kind: 'room_type', value: 'tum', name: 'Tum', sort_order: 7 },

    { kind: 'opening_preset', value: 'door_single', name: 'Cua di 1 canh', sort_order: 1, description: '{"summary":"1 cua di co ban, phu hop phong thuong.","opening_type":"door","opening_count":1,"opening_area":1.89,"width_ratio":0.18,"min_width":0.7,"height_ratio":0.64,"max_height":2.1,"color":"#1d4ed8"}' },
    { kind: 'opening_preset', value: 'door_double', name: 'Cua di 2 canh', sort_order: 2, description: '{"summary":"1 bo cua doi, phu hop mat tien rong hon.","opening_type":"door","opening_count":1,"opening_area":3.08,"width_ratio":0.32,"min_width":1.4,"height_ratio":0.64,"max_height":2.2,"color":"#1d4ed8"}' },
    { kind: 'opening_preset', value: 'door_sliding', name: 'Cua lua', sort_order: 3, description: '{"summary":"Cua truot / cua lua, thuong dung cho mo rong tam nhin.","opening_type":"door","opening_count":1,"opening_area":3.12,"width_ratio":0.38,"min_width":1.6,"height_ratio":0.56,"max_height":1.95,"color":"#38bdf8"}' },
    { kind: 'opening_preset', value: 'window_small', name: 'Cua so nho', sort_order: 4, description: '{"summary":"Cua so kich thuoc nho, lay sang co ban.","opening_type":"window","opening_count":1,"opening_area":1.08,"width_ratio":0.22,"min_width":0.9,"height_ratio":0.22,"max_height":0.6,"sill_ratio":0.08,"color":"#7dd3fc"}' },
    { kind: 'opening_preset', value: 'window_large', name: 'Cua so lon', sort_order: 5, description: '{"summary":"Cua so lon, uu tien tam nhin va lay sang.","opening_type":"window","opening_count":1,"opening_area":2.24,"width_ratio":0.42,"min_width":1.6,"height_ratio":0.3,"max_height":0.8,"sill_ratio":0.06,"color":"#7dd3fc"}' },
    { kind: 'opening_preset', value: 'vent', name: 'O thong gio', sort_order: 6, description: '{"summary":"O thong gio cho WC, kho, khu phu tro.","opening_type":"vent","opening_count":1,"opening_area":0.22,"width_ratio":0.18,"min_width":0.7,"height_ratio":0.12,"max_height":0.32,"sill_ratio":0.22,"color":"#cbd5e1"}' },

    { kind: 'roof_preset', value: 'flat', name: 'Mai bang', sort_order: 1, description: '{"summary":"Khoi mai bang co ban, de mo rong len san thuong sau nay.","roof_height_ratio":0,"roof_height_min":0,"body_height_min":0.3,"roof_color":"#cbd5e1"}' },
    { kind: 'roof_preset', value: 'lean_to', name: 'Mai lech', sort_order: 2, description: '{"summary":"Khoi mai lech 1 huong, tao diem nhan hinh khoi.","roof_height_ratio":0.22,"roof_height_min":0.2,"body_height_min":0.3,"lean_to_tilt_rad":-0.24,"roof_color":"#f59e0b"}' },
    { kind: 'roof_preset', value: 'thai_basic', name: 'Mai Thai so bo', sort_order: 3, description: '{"summary":"Khoi mai Thai mockup de hinh dung nhanh phuong an.","roof_height_ratio":0.3,"roof_height_min":0.24,"body_height_min":0.3,"thai_radius_ratio":0.6,"roof_color":"#dc2626"}' },
    { kind: 'roof_preset', value: 'terrace', name: 'San thuong', sort_order: 4, description: '{"summary":"Khoi san thuong / mai co the su dung nhu tum, phoi, ky thuat.","roof_height_ratio":0.02,"roof_height_min":0.1,"body_height_min":0.3,"roof_color":"#cbd5e1"}' },

    { kind: 'stair_preset', value: 'straight', name: 'Thang thang', sort_order: 1, description: '{"summary":"Cau thang 1 vet thang, thao tac nhanh va gon.","step_count":4,"step_width_ratio":0.8,"min_step_width":0.6,"min_step_depth":0.35,"turn_ratio":0.18}' },
    { kind: 'stair_preset', value: 'l_shape', name: 'Thang chu L', sort_order: 2, description: '{"summary":"Cau thang doi huong 1 lan, de dat vao goc nha.","step_count":5,"step_width_ratio":0.45,"min_step_width":0.6,"min_step_depth":0.35,"turn_ratio":0.18}' },
    { kind: 'stair_preset', value: 'u_shape', name: 'Thang chu U', sort_order: 3, description: '{"summary":"Cau thang doi huong 2 vet, phu hop khi can giam do doc.","step_count":6,"step_width_ratio":0.45,"min_step_width":0.6,"min_step_depth":0.35,"turn_ratio":0.18}' },

    { kind: 'interior_preset', value: 'bedroom_basic', name: 'Phong ngu co ban', sort_order: 1, description: '{"summary":"Sinh mockup noi that co ban cho phong ngu.","semantic_facts":{"interior_bed_count":1}}' },
    { kind: 'interior_preset', value: 'kitchen_basic', name: 'Bep co ban', sort_order: 2, description: '{"summary":"Sinh mockup noi that co ban cho bep.","semantic_facts":{"kitchen_counter_length_total_m":2.4}}' },
    { kind: 'interior_preset', value: 'wc_basic', name: 'WC co ban', sort_order: 3, description: '{"summary":"Sinh mockup noi that co ban cho WC.","semantic_facts":{"wc_fixture_set_count":1}}' },

    { kind: 'assembly_template_bundle_map', value: 'bundle_room_bedroom_basic', name: 'Phong ngu co ban -> template phong ngu', sort_order: 1, description: '{"component_type":"room","space_type":"bedroom","template_codes":["tpl_room_bedroom_std"]}' },
    { kind: 'assembly_template_bundle_map', value: 'bundle_room_master_bedroom_basic', name: 'Phong ngu master -> template phong ngu master', sort_order: 2, description: '{"component_type":"room","space_type":"master_bedroom","template_codes":["tpl_room_master_bedroom_std"]}' },
    { kind: 'assembly_template_bundle_map', value: 'bundle_room_wc_basic', name: 'WC co ban -> template WC', sort_order: 3, description: '{"component_type":"room","space_type":"wc","template_codes":["tpl_room_wc_std"]}' },
    { kind: 'assembly_template_bundle_map', value: 'bundle_room_kitchen_basic', name: 'Bep co ban -> template bep', sort_order: 4, description: '{"component_type":"room","space_type":"kitchen","template_codes":["tpl_room_kitchen_std"]}' },
    { kind: 'assembly_template_bundle_map', value: 'bundle_foundation_mong_coc', name: 'Mong coc -> template mong coc', sort_order: 5, description: '{"component_type":"foundation","foundation_type":"mong_coc","template_codes":["tpl_foundation_mong_coc_std"]}' },
    { kind: 'assembly_template_bundle_map', value: 'bundle_roof_thai_basic', name: 'Mai Thai so bo -> template mai Thai', sort_order: 6, description: '{"component_type":"roof","roof_preset":"thai_basic","template_codes":["tpl_roof_thai_basic_std"]}' },
    { kind: 'assembly_template_bundle_map', value: 'bundle_facade_main_front', name: 'Tuong mat tien chinh -> template facade', sort_order: 7, description: '{"component_type":"wall","facade_role":"main_front","template_codes":["tpl_facade_glass_std"]}' },
 
    { kind: 'scope_type', value: 'bedroom', name: 'Bedroom', sort_order: 1 },
    { kind: 'scope_type', value: 'wc', name: 'WC', sort_order: 2 },
    { kind: 'scope_type', value: 'kitchen', name: 'Kitchen', sort_order: 3 },
    { kind: 'scope_type', value: 'living_room', name: 'Living room', sort_order: 4 },
    { kind: 'scope_type', value: 'cau_thang', name: 'Cau thang', sort_order: 5 },
    { kind: 'scope_type', value: 'mong_coc', name: 'Mong coc', sort_order: 6 },
    { kind: 'scope_type', value: 'tum', name: 'Tum', sort_order: 7 },
    { kind: 'scope_type', value: 'facade', name: 'Mat tien', sort_order: 8 },
    { kind: 'assembly_component_type', value: 'foundation', name: 'Mong', sort_order: 1 },
    { kind: 'assembly_component_type', value: 'slab', name: 'San', sort_order: 2 },
    { kind: 'assembly_component_type', value: 'wall', name: 'Tuong', sort_order: 3 },
    { kind: 'assembly_component_type', value: 'column', name: 'Cot', sort_order: 4 },
    { kind: 'assembly_component_type', value: 'room', name: 'Phong', sort_order: 5 },
    { kind: 'assembly_component_type', value: 'stair', name: 'Cau thang', sort_order: 6 },
    { kind: 'assembly_component_type', value: 'ceiling', name: 'Tran', sort_order: 7 },
    { kind: 'assembly_component_type', value: 'tum', name: 'Tum', sort_order: 8 },
    { kind: 'assembly_component_type', value: 'tum_roof', name: 'Noc tum', sort_order: 9 },

    { kind: 'fact_key', value: 'build_length_m', name: 'Chieu dai xay dung (m)', sort_order: 1 },
    { kind: 'fact_key', value: 'build_width_m', name: 'Chieu rong xay dung (m)', sort_order: 2 },
    { kind: 'fact_key', value: 'floor_height_m', name: 'Chieu cao tang (m)', sort_order: 3 },
    { kind: 'fact_key', value: 'floors', name: 'So tang', sort_order: 4 },
    { kind: 'fact_key', value: 'tum_count', name: 'So tum', sort_order: 5 },
    { kind: 'fact_key', value: 'bedroom_count', name: 'So phong ngu', sort_order: 6 },
    { kind: 'fact_key', value: 'wc_count', name: 'So WC', sort_order: 7 },
    { kind: 'fact_key', value: 'floor_area_total', name: 'Tong dien tich san', sort_order: 8 },
    { kind: 'fact_key', value: 'wall_surface_area_total', name: 'Tong dien tich tuong', sort_order: 9 },
    { kind: 'required_fact', value: 'build_length_m', name: 'Can chieu dai xay dung', sort_order: 1 },
    { kind: 'required_fact', value: 'build_width_m', name: 'Can chieu rong xay dung', sort_order: 2 },
    { kind: 'required_fact', value: 'floor_height_m', name: 'Can chieu cao tang', sort_order: 3 },
    { kind: 'required_fact', value: 'floors', name: 'Can so tang', sort_order: 4 },
    { kind: 'required_fact', value: 'tum_count', name: 'Can so tum', sort_order: 5 },
    { kind: 'required_fact', value: 'floor_area_total', name: 'Can tong dien tich san', sort_order: 6 },
    { kind: 'required_fact', value: 'wall_surface_area_total', name: 'Can tong dien tich tuong', sort_order: 7 },

    { kind: 'formula_preset', value: 'wall_surface_total', name: 'm2 tuong tong', sort_order: 1, description: '{"short_name":"m2 tuong tong","expr":"(build_length_m + build_width_m) * 2 * floor_height_m * floors","hint":"Uoc tinh nhanh tong dien tich tuong tu kich thuoc nha va so tang."}' },
    { kind: 'formula_preset', value: 'floor_area_without_tum', name: 'dien tich san khong tum', sort_order: 2, description: '{"short_name":"san khong tum","expr":"floor_area_total - tum_area","hint":"Lay tong dien tich san va tru phan tum de tinh phan san chinh."}' },
    { kind: 'formula_preset', value: 'paint_wall_net_basic', name: 'Son tuong thuan co ban', sort_order: 10, description: '{"short_name":"Son tuong thuan","expr":"wall_surface_area_net","hint":"Dung dien tich tuong sau khi da tru o mo, phu hop son/bot ba co ban."}' },
    { kind: 'formula_preset', value: 'plaster_wall_gross_basic', name: 'To tuong tho co ban', sort_order: 11, description: '{"short_name":"To tuong tho","expr":"wall_surface_area_gross","hint":"Dung dien tich tuong tho truoc khi tru cua, phu hop to/trat thuan."}' },
    { kind: 'formula_preset', value: 'tile_floor_waste_5', name: 'Lat san + hao hut 5%', sort_order: 12, description: '{"short_name":"Lat san +5%","expr":"floor_area_total * 1.05","hint":"Lay dien tich san va cong them 5% hao hut thi cong/cat gach."}' },
    { kind: 'formula_preset', value: 'ceiling_finish_waste_7', name: 'Hoan thien tran + hao hut 7%', sort_order: 13, description: '{"short_name":"Tran +7%","expr":"ceiling_area_total * 1.07","hint":"Dung dien tich tran va cong 7% hao hut cho tam/khung/phu kien."}' },
    { kind: 'formula_preset', value: 'door_by_count', name: 'Cua di theo so luong', sort_order: 14, description: '{"short_name":"Cua di theo so luong","expr":"door_count_total","hint":"Moi cua di tinh thanh 1 bo hoac 1 cay tuy hạng muc."}' },
    { kind: 'formula_preset', value: 'window_by_count', name: 'Cua so theo so luong', sort_order: 15, description: '{"short_name":"Cua so theo so luong","expr":"window_count_total","hint":"Moi cua so tinh thanh 1 bo hoac 1 cum phu kien."}' },
    { kind: 'formula_preset', value: 'glass_window_area_waste_5', name: 'Kinh cua so + hao hut 5%', sort_order: 16, description: '{"short_name":"Kinh cua so +5%","expr":"window_area_total * 1.05","hint":"Lay tong dien tich cua so va cong 5% hao hut cat kinh."}' },
    { kind: 'formula_preset', value: 'hardware_by_opening_count', name: 'Phu kien theo tong o mo', sort_order: 17, description: '{"short_name":"Phu kien theo o mo","expr":"opening_count_total","hint":"Phu hop khi moi o mo can 1 bo phu kien/nhan cong co dinh."}' },
    { kind: 'formula_preset', value: 'foundation_by_footprint', name: 'Mong theo footprint', sort_order: 18, description: '{"short_name":"Mong theo footprint","expr":"footprint_area","hint":"Dung footprint de tinh vat tu mong so bo tren mat bang nha."}' },
    { kind: 'formula_preset', value: 'roof_by_footprint_waste_8', name: 'Mai theo footprint + hao hut 8%', sort_order: 19, description: '{"short_name":"Mai +8%","expr":"footprint_area * 1.08","hint":"Dung footprint va cong 8% cho phan lop mai/co cat ghep."}' },
    { kind: 'formula_preset', value: 'wc_fixture_by_room_count', name: 'Thiet bi WC theo so phong WC', sort_order: 20, description: '{"short_name":"Thiet bi WC theo phong","expr":"space_type_count_wc","hint":"Moi phong WC tinh 1 bo thiet bi co ban."}' },
    { kind: 'formula_preset', value: 'kitchen_setup_by_room_count', name: 'Thiet bi bep theo so phong bep', sort_order: 21, description: '{"short_name":"Thiet bi bep theo phong","expr":"space_type_count_kitchen","hint":"Moi bep tinh 1 bo thiet bi co ban."}' },
    { kind: 'formula_preset', value: 'bedroom_floor_finish_waste_5', name: 'Phong ngu lat san + hao hut 5%', sort_order: 30, description: '{"short_name":"Phong ngu lat san +5%","expr":"space_type_area_bedroom * 1.05","hint":"Dung dien tich phong ngu theo block, cong 5% hao hut cho lat san/phu san."}' },
    { kind: 'formula_preset', value: 'bedroom_paint_wall_net', name: 'Phong ngu son tuong thuan', sort_order: 31, description: '{"short_name":"Phong ngu son tuong","expr":"space_type_area_bedroom * 3.1","hint":"Uoc tinh son tuong phong ngu theo he so dien tich phong, dung khi chua co wall fact rieng."}' },
    { kind: 'formula_preset', value: 'wc_wall_tile_basic', name: 'WC op tuong co ban', sort_order: 32, description: '{"short_name":"WC op tuong","expr":"space_type_area_wc * 2.4","hint":"Uoc tinh op tuong WC theo he so dien tich su dung cho phuong an so bo."}' },
    { kind: 'formula_preset', value: 'wc_floor_tile_waste_5', name: 'WC lat san + hao hut 5%', sort_order: 33, description: '{"short_name":"WC lat san +5%","expr":"space_type_area_wc * 1.05","hint":"Lay dien tich WC theo block va cong 5% hao hut."}' },
    { kind: 'formula_preset', value: 'kitchen_floor_finish_waste_5', name: 'Bep lat san + hao hut 5%', sort_order: 34, description: '{"short_name":"Bep lat san +5%","expr":"space_type_area_kitchen * 1.05","hint":"Lay dien tich bep theo block va cong 5% hao hut."}' },
    { kind: 'formula_preset', value: 'kitchen_wall_tile_basic', name: 'Bep op tuong khu thao tac', sort_order: 35, description: '{"short_name":"Bep op tuong","expr":"kitchen_counter_length_total_m * 0.75","hint":"Op tuong khu thao tac theo chieu dai ban bep, quy doi ra m2 so bo."}' },
    { kind: 'formula_preset', value: 'facade_glass_by_window_area', name: 'Mat tien kinh theo dien tich cua so', sort_order: 36, description: '{"short_name":"Mat tien kinh","expr":"facade_role_window_area_main_front * 1.1","hint":"Lay dien tich cua so thuoc block mat tien chinh va cong 10% cho vach kinh/phu tro."}' },
    { kind: 'formula_preset', value: 'facade_frame_by_window_area', name: 'Khung mat tien theo dien tich cua so', sort_order: 37, description: '{"short_name":"Khung mat tien","expr":"facade_role_window_area_main_front","hint":"Dung dien tich cua so cua block mat tien chinh lam co so tinh khung mat tien."}' },
    { kind: 'quantity_basis', value: 'floor_area_total', name: 'Tong dien tich san', sort_order: 1 },
    { kind: 'quantity_basis', value: 'main_floor_area_total', name: 'Dien tich san khong tum', sort_order: 2 },
    { kind: 'quantity_basis', value: 'floor_area_without_tum', name: 'Dien tich san (derived)', sort_order: 3 },
    { kind: 'quantity_basis', value: 'wall_surface_area_total', name: 'Dien tich tuong', sort_order: 4 },
    { kind: 'quantity_basis', value: 'ceiling_area_total', name: 'Dien tich tran', sort_order: 5 },
    { kind: 'quantity_basis', value: 'column_linear_total', name: 'Chieu dai cot', sort_order: 6 },
    { kind: 'quantity_basis', value: 'tum_area_total', name: 'Dien tich tum', sort_order: 7 },
    { kind: 'quantity_basis', value: 'room_count', name: 'Tong so phong', sort_order: 8 },
    { kind: 'quantity_basis', value: 'bedroom_count', name: 'So phong ngu', sort_order: 9 },
    { kind: 'quantity_basis', value: 'wc_count', name: 'So WC', sort_order: 10 },
    { kind: 'quantity_basis', value: 'kitchen_count', name: 'So bep', sort_order: 11 },
    { kind: 'quantity_basis', value: 'living_room_count', name: 'So phong khach', sort_order: 12 },
    { kind: 'quantity_basis', value: 'floor_count_total', name: 'So san (tang + tum)', sort_order: 13 },

    { kind: 'item_type', value: 'material', name: 'Vat tu', sort_order: 1 },
    { kind: 'item_type', value: 'labor', name: 'Nhan cong', sort_order: 2 },
    { kind: 'item_type', value: 'equipment', name: 'Thiet bi', sort_order: 3 },
    { kind: 'item_type', value: 'fixture', name: 'Phu kien', sort_order: 4 },
    { kind: 'item_type', value: 'service', name: 'Dich vu', sort_order: 5 },

    { kind: 'item_group', value: 'ket_cau', name: 'Ket cau', sort_order: 1 },
    { kind: 'item_group', value: 'xay_to', name: 'Xay to', sort_order: 2 },
    { kind: 'item_group', value: 'hoan_thien', name: 'Hoan thien', sort_order: 3 },
    { kind: 'item_group', value: 'mep_dien', name: 'MEP Dien', sort_order: 4 },
    { kind: 'item_group', value: 'mep_nuoc', name: 'MEP Nuoc', sort_order: 5 },
    { kind: 'item_group', value: 'noi_that', name: 'Noi that', sort_order: 6 },

    { kind: 'item_unit', value: 'kg', name: 'kg', sort_order: 1 },
    { kind: 'item_unit', value: 'm2', name: 'm2', sort_order: 2 },
    { kind: 'item_unit', value: 'm3', name: 'm3', sort_order: 3 },
    { kind: 'item_unit', value: 'm', name: 'm', sort_order: 4 },
    { kind: 'item_unit', value: 'vien', name: 'vien', sort_order: 5 },
    { kind: 'item_unit', value: 'cai', name: 'cai', sort_order: 6 },
    { kind: 'item_unit', value: 'bo', name: 'bo', sort_order: 7 },
    ...semanticFactSeeds,
  ]
  const catalogSeeds: SeedCatalog[] = [
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
    { item_code: 'son_noi_that', item_name: 'Sơn nội thất', item_type: 'material', item_group: 'hoan_thien', item_unit: 'm2' },
    { item_code: 'tran_thach_cao', item_name: 'Trần thạch cao', item_type: 'material', item_group: 'hoan_thien', item_unit: 'm2' },
    { item_code: 'ngoi_mai', item_name: 'Ngói mái', item_type: 'material', item_group: 'hoan_thien', item_unit: 'vien' },
    { item_code: 'kinh_mat_tien', item_name: 'Kính mặt tiền', item_type: 'material', item_group: 'hoan_thien', item_unit: 'm2' },
    { item_code: 'thiet_bi_bep', item_name: 'Thiết bị bếp cơ bản', item_type: 'equipment', item_group: 'noi_that', item_unit: 'bo' },
    { item_code: 'phu_kien_cua', item_name: 'Phụ kiện cửa', item_type: 'fixture', item_group: 'hoan_thien', item_unit: 'bo' },
  ]

  let taxonomyCount = 0
  for (const x of taxonomySeeds) {
    await prismaAny.estimationTaxonomy.upsert({
      where: { kind_value: { kind: x.kind, value: x.value } },
      update: { name: x.name, sort_order: x.sort_order, description: x.description ?? null, is_active: true },
      create: { ...x, is_active: true },
    })
    taxonomyCount += 1
  }

  let catalogCount = 0
  for (const x of catalogSeeds) {
    await prismaAny.estimationCatalogItem.upsert({
      where: { item_code: x.item_code },
      update: {
        item_name: x.item_name,
        item_type: x.item_type,
        item_group: x.item_group,
        item_unit: x.item_unit,
        is_active: true,
      },
      create: { ...x, is_active: true },
    })
    catalogCount += 1
  }

  const bedroomTemplate = await prismaAny.estimationTemplateHeader.upsert({
    where: { template_code_version: { template_code: 'tpl_room_bedroom_std', version: 1 } },
    update: {
      template_name: 'Phòng ngủ tiêu chuẩn',
      template_type: 'room',
      house_type: 'nha_pho',
      finish_level: 'tieu_chuan',
      room_type: 'bedroom',
      is_active: true,
    },
    create: {
      template_code: 'tpl_room_bedroom_std',
      template_name: 'Phòng ngủ tiêu chuẩn',
      template_type: 'room',
      house_type: 'nha_pho',
      finish_level: 'tieu_chuan',
      room_type: 'bedroom',
      version: 1,
      priority: 10,
      is_active: true,
      created_by: session.user.id,
    },
  })

  const wcTemplate = await prismaAny.estimationTemplateHeader.upsert({
    where: { template_code_version: { template_code: 'tpl_room_wc_std', version: 1 } },
    update: {
      template_name: 'WC tiêu chuẩn',
      template_type: 'wc',
      house_type: 'nha_pho',
      finish_level: 'tieu_chuan',
      room_type: 'wc',
      is_active: true,
    },
    create: {
      template_code: 'tpl_room_wc_std',
      template_name: 'WC tiêu chuẩn',
      template_type: 'wc',
      house_type: 'nha_pho',
      finish_level: 'tieu_chuan',
      room_type: 'wc',
      version: 1,
      priority: 11,
      is_active: true,
      created_by: session.user.id,
    },
  })

  const foundationTemplate = await prismaAny.estimationTemplateHeader.upsert({
    where: { template_code_version: { template_code: 'tpl_foundation_mong_coc_std', version: 1 } },
    update: {
      template_name: 'Móng cọc sơ bộ',
      template_type: 'foundation',
      house_type: 'nha_pho',
      finish_level: 'tieu_chuan',
      room_type: 'mong_coc',
      is_active: true,
    },
    create: {
      template_code: 'tpl_foundation_mong_coc_std',
      template_name: 'Móng cọc sơ bộ',
      template_type: 'foundation',
      house_type: 'nha_pho',
      finish_level: 'tieu_chuan',
      room_type: 'mong_coc',
      version: 1,
      priority: 20,
      is_active: true,
      created_by: session.user.id,
    },
  })
  const columnTemplate = await prismaAny.estimationTemplateHeader.upsert({
    where: { template_code_version: { template_code: 'tpl_structure_column_std', version: 1 } },
    update: {
      template_name: 'Cot ket cau so bo',
      template_type: 'house',
      house_type: 'nha_pho',
      finish_level: 'tieu_chuan',
      room_type: 'cot',
      is_active: true,
    },
    create: {
      template_code: 'tpl_structure_column_std',
      template_name: 'Cot ket cau so bo',
      template_type: 'house',
      house_type: 'nha_pho',
      finish_level: 'tieu_chuan',
      room_type: 'cot',
      version: 1,
      priority: 22,
      is_active: true,
      created_by: session.user.id,
    },
  })
  const masterBedroomTemplate = await prismaAny.estimationTemplateHeader.upsert({
    where: { template_code_version: { template_code: 'tpl_room_master_bedroom_std', version: 1 } },
    update: {
      template_name: 'Phòng ngủ master tiêu chuẩn',
      template_type: 'room',
      house_type: 'nha_pho',
      finish_level: 'tieu_chuan',
      room_type: 'master_bedroom',
      is_active: true,
    },
    create: {
      template_code: 'tpl_room_master_bedroom_std',
      template_name: 'Phòng ngủ master tiêu chuẩn',
      template_type: 'room',
      house_type: 'nha_pho',
      finish_level: 'tieu_chuan',
      room_type: 'master_bedroom',
      version: 1,
      priority: 12,
      is_active: true,
      created_by: session.user.id,
    },
  })
  const kitchenTemplate = await prismaAny.estimationTemplateHeader.upsert({
    where: { template_code_version: { template_code: 'tpl_room_kitchen_std', version: 1 } },
    update: {
      template_name: 'Bếp tiêu chuẩn',
      template_type: 'room',
      house_type: 'nha_pho',
      finish_level: 'tieu_chuan',
      room_type: 'kitchen',
      is_active: true,
    },
    create: {
      template_code: 'tpl_room_kitchen_std',
      template_name: 'Bếp tiêu chuẩn',
      template_type: 'room',
      house_type: 'nha_pho',
      finish_level: 'tieu_chuan',
      room_type: 'kitchen',
      version: 1,
      priority: 13,
      is_active: true,
      created_by: session.user.id,
    },
  })
  const facadeTemplate = await prismaAny.estimationTemplateHeader.upsert({
    where: { template_code_version: { template_code: 'tpl_facade_glass_std', version: 1 } },
    update: {
      template_name: 'Mặt tiền kính cơ bản',
      template_type: 'facade',
      house_type: 'nha_pho',
      finish_level: 'tieu_chuan',
      room_type: 'facade',
      is_active: true,
    },
    create: {
      template_code: 'tpl_facade_glass_std',
      template_name: 'Mặt tiền kính cơ bản',
      template_type: 'facade',
      house_type: 'nha_pho',
      finish_level: 'tieu_chuan',
      room_type: 'facade',
      version: 1,
      priority: 18,
      is_active: true,
      created_by: session.user.id,
    },
  })
  const roofTemplate = await prismaAny.estimationTemplateHeader.upsert({
    where: { template_code_version: { template_code: 'tpl_roof_thai_basic_std', version: 1 } },
    update: {
      template_name: 'Mái thái cơ bản',
      template_type: 'house',
      house_type: 'nha_pho',
      finish_level: 'tieu_chuan',
      room_type: 'roof',
      is_active: true,
    },
    create: {
      template_code: 'tpl_roof_thai_basic_std',
      template_name: 'Mái thái cơ bản',
      template_type: 'house',
      house_type: 'nha_pho',
      finish_level: 'tieu_chuan',
      room_type: 'roof',
      version: 1,
      priority: 23,
      is_active: true,
      created_by: session.user.id,
    },
  })

  const itemByCode = new Map<string, any>()
  for (const item of await prismaAny.estimationCatalogItem.findMany({
    where: { item_code: { in: catalogSeeds.map((x) => x.item_code) } },
  })) {
    itemByCode.set(item.item_code, item)
  }

  async function upsertTemplateItem(args: {
    template_id: string
    code: string
    apply_mode: string
    quantity_basis_key?: string
    scope_key?: string
    quantity_value?: number | null
    formula_expr?: string | null
    sort_order: number
  }) {
    const c = itemByCode.get(args.code)
    if (!c) return
    const existed = await prismaAny.estimationTemplateItem.findFirst({
      where: { template_id: args.template_id, catalog_item_id: c.id, sort_order: args.sort_order },
    })
    if (existed) {
      await prismaAny.estimationTemplateItem.update({
        where: { id: existed.id },
        data: {
          apply_mode: args.apply_mode,
          quantity_basis_key: args.quantity_basis_key || null,
          scope_key: args.scope_key || null,
          quantity_value: args.quantity_value ?? null,
          formula_expr: args.formula_expr ?? null,
          is_active: true,
        },
      })
      return
    }
    await prismaAny.estimationTemplateItem.create({
      data: {
        template_id: args.template_id,
        catalog_item_id: c.id,
        apply_mode: args.apply_mode,
        quantity_basis_key: args.quantity_basis_key || null,
        scope_key: args.scope_key || null,
        quantity_value: args.quantity_value ?? null,
        formula_expr: args.formula_expr ?? null,
        sort_order: args.sort_order,
        is_active: true,
      },
    })
  }

  await upsertTemplateItem({ template_id: bedroomTemplate.id, code: 'den_led', apply_mode: 'per_area', quantity_basis_key: 'main_floor_area_total', scope_key: 'bedroom', quantity_value: 1, sort_order: 1 })
  await upsertTemplateItem({ template_id: bedroomTemplate.id, code: 'day_dien', apply_mode: 'per_area', quantity_basis_key: 'main_floor_area_total', scope_key: 'bedroom', quantity_value: 8, sort_order: 2 })
  await upsertTemplateItem({ template_id: bedroomTemplate.id, code: 'cua_di', apply_mode: 'per_unit', quantity_basis_key: 'bedroom_count', scope_key: 'bedroom', quantity_value: 1, sort_order: 3 })
  await upsertTemplateItem({ template_id: bedroomTemplate.id, code: 'cua_so', apply_mode: 'per_unit', quantity_basis_key: 'bedroom_count', scope_key: 'bedroom', quantity_value: 2, sort_order: 4 })
  await upsertTemplateItem({ template_id: bedroomTemplate.id, code: 'son_noi_that', apply_mode: 'formula', scope_key: 'bedroom', formula_expr: 'space_type_area_bedroom * 3.1', sort_order: 5 })

  await upsertTemplateItem({ template_id: wcTemplate.id, code: 'den_led', apply_mode: 'per_unit', quantity_basis_key: 'wc_count', scope_key: 'wc', quantity_value: 1, sort_order: 1 })
  await upsertTemplateItem({ template_id: wcTemplate.id, code: 'bon_cau', apply_mode: 'per_unit', quantity_basis_key: 'wc_count', scope_key: 'wc', quantity_value: 1, sort_order: 2 })
  await upsertTemplateItem({ template_id: wcTemplate.id, code: 'lavabo', apply_mode: 'per_unit', quantity_basis_key: 'wc_count', scope_key: 'wc', quantity_value: 1, sort_order: 3 })
  await upsertTemplateItem({ template_id: wcTemplate.id, code: 'day_dien', apply_mode: 'per_unit', quantity_basis_key: 'wc_count', scope_key: 'wc', quantity_value: 12, sort_order: 4 })
  await upsertTemplateItem({ template_id: wcTemplate.id, code: 'gach', apply_mode: 'formula', scope_key: 'wc', formula_expr: 'space_type_area_wc * 1.05', sort_order: 5 })
  await upsertTemplateItem({ template_id: wcTemplate.id, code: 'son_noi_that', apply_mode: 'formula', scope_key: 'wc', formula_expr: 'space_type_area_wc * 2.4', sort_order: 6 })
  await upsertTemplateItem({ template_id: masterBedroomTemplate.id, code: 'den_led', apply_mode: 'per_area', quantity_basis_key: 'space_type_area_master_bedroom', scope_key: 'master_bedroom', quantity_value: 1.2, sort_order: 1 })
  await upsertTemplateItem({ template_id: masterBedroomTemplate.id, code: 'day_dien', apply_mode: 'per_area', quantity_basis_key: 'space_type_area_master_bedroom', scope_key: 'master_bedroom', quantity_value: 10, sort_order: 2 })
  await upsertTemplateItem({ template_id: masterBedroomTemplate.id, code: 'cua_di', apply_mode: 'per_unit', quantity_basis_key: 'space_type_count_master_bedroom', scope_key: 'master_bedroom', quantity_value: 1, sort_order: 3 })
  await upsertTemplateItem({ template_id: masterBedroomTemplate.id, code: 'cua_so', apply_mode: 'per_unit', quantity_basis_key: 'space_type_count_master_bedroom', scope_key: 'master_bedroom', quantity_value: 2, sort_order: 4 })
  await upsertTemplateItem({ template_id: masterBedroomTemplate.id, code: 'son_noi_that', apply_mode: 'formula', scope_key: 'master_bedroom', formula_expr: 'space_type_area_master_bedroom * 3.1', sort_order: 5 })
  await upsertTemplateItem({ template_id: kitchenTemplate.id, code: 'day_dien', apply_mode: 'per_area', quantity_basis_key: 'space_type_area_kitchen', scope_key: 'kitchen', quantity_value: 9, sort_order: 1 })
  await upsertTemplateItem({ template_id: kitchenTemplate.id, code: 'den_led', apply_mode: 'per_area', quantity_basis_key: 'space_type_area_kitchen', scope_key: 'kitchen', quantity_value: 0.8, sort_order: 2 })
  await upsertTemplateItem({ template_id: kitchenTemplate.id, code: 'thiet_bi_bep', apply_mode: 'per_unit', quantity_basis_key: 'kitchen_count', scope_key: 'kitchen', quantity_value: 1, sort_order: 3 })
  await upsertTemplateItem({ template_id: kitchenTemplate.id, code: 'gach', apply_mode: 'formula', scope_key: 'kitchen', formula_expr: 'space_type_area_kitchen * 1.05', sort_order: 4 })
  await upsertTemplateItem({ template_id: kitchenTemplate.id, code: 'son_noi_that', apply_mode: 'formula', scope_key: 'kitchen', formula_expr: 'kitchen_counter_length_total_m * 0.75', sort_order: 5 })
  await upsertTemplateItem({ template_id: facadeTemplate.id, code: 'kinh_mat_tien', apply_mode: 'formula', scope_key: 'facade', formula_expr: 'facade_role_window_area_main_front * 1.1', sort_order: 1 })
  await upsertTemplateItem({ template_id: facadeTemplate.id, code: 'phu_kien_cua', apply_mode: 'formula', scope_key: 'facade', formula_expr: 'facade_role_opening_count_main_front', sort_order: 2 })
  await upsertTemplateItem({ template_id: roofTemplate.id, code: 'ngoi_mai', apply_mode: 'per_unit', quantity_basis_key: 'roof_preset_count_thai_basic', scope_key: 'roof', quantity_value: 320, sort_order: 1 })
  await upsertTemplateItem({ template_id: roofTemplate.id, code: 'tran_thach_cao', apply_mode: 'per_area', quantity_basis_key: 'ceiling_area_total', scope_key: 'roof', quantity_value: 0.15, sort_order: 2 })

  await upsertTemplateItem({ template_id: foundationTemplate.id, code: 'coc_250_250', apply_mode: 'per_area', quantity_basis_key: 'footprint_area', scope_key: 'mong_coc', quantity_value: 2.2, sort_order: 1 })
  await upsertTemplateItem({ template_id: foundationTemplate.id, code: 'thep', apply_mode: 'per_area', quantity_basis_key: 'footprint_area', scope_key: 'mong_coc', quantity_value: 20, sort_order: 2 })
  await upsertTemplateItem({ template_id: foundationTemplate.id, code: 'xi_mang', apply_mode: 'per_area', quantity_basis_key: 'footprint_area', scope_key: 'mong_coc', quantity_value: 45, sort_order: 3 })
  await upsertTemplateItem({ template_id: foundationTemplate.id, code: 'gach', apply_mode: 'per_area', quantity_basis_key: 'footprint_area', scope_key: 'mong_coc', quantity_value: 60, sort_order: 4 })
  await upsertTemplateItem({ template_id: columnTemplate.id, code: 'thep', apply_mode: 'per_area', quantity_basis_key: 'column_linear_total', scope_key: 'cot', quantity_value: 28, sort_order: 1 })
  await upsertTemplateItem({ template_id: columnTemplate.id, code: 'xi_mang', apply_mode: 'per_area', quantity_basis_key: 'column_linear_total', scope_key: 'cot', quantity_value: 70, sort_order: 2 })

  const rule = await prismaAny.estimationRuleHeader.upsert({
    where: { rule_code_version: { rule_code: 'foundation_mong_coc_nha_pho_3t1tum', version: 1 } },
    update: {
      rule_name: 'Đề xuất móng cọc cho nhà phố >= 3 tầng',
      scope: 'foundation',
      is_active: true,
      priority: 50,
    },
    create: {
      rule_code: 'foundation_mong_coc_nha_pho_3t1tum',
      rule_name: 'Đề xuất móng cọc cho nhà phố >= 3 tầng',
      scope: 'foundation',
      version: 1,
      priority: 50,
      is_active: true,
      created_by: session.user.id,
    },
  })

  await prismaAny.estimationRuleCondition.deleteMany({ where: { rule_id: rule.id } })
  await prismaAny.estimationRuleAction.deleteMany({ where: { rule_id: rule.id } })

  await prismaAny.estimationRuleCondition.createMany({
    data: [
      { rule_id: rule.id, fact_key: 'house_type', operator: 'eq', value_text: 'nha_pho', sort_order: 1 },
      { rule_id: rule.id, fact_key: 'floors', operator: 'gte', value_number: 3, sort_order: 2 },
      { rule_id: rule.id, fact_key: 'tum_count', operator: 'gte', value_number: 1, sort_order: 3 },
      { rule_id: rule.id, fact_key: 'foundation_type', operator: 'eq', value_text: 'mong_coc', sort_order: 4 },
    ],
  })
  await prismaAny.estimationRuleAction.createMany({
    data: [
      { rule_id: rule.id, action_type: 'suggest_value', target_key: 'pile_section', value_text: '250x250', sort_order: 1 },
      { rule_id: rule.id, action_type: 'suggest_value', target_key: 'pile_spacing', value_text: '1.2-1.5m', sort_order: 2 },
      { rule_id: rule.id, action_type: 'add_warning', value_text: 'Gia tri mong coc chi la de xuat so bo, can ky thuat khao sat de chot', sort_order: 3 },
    ],
  })

  const columnRuleV1 = await prismaAny.estimationRuleHeader.upsert({
    where: { rule_code_version: { rule_code: 'column_count_nha_pho', version: 1 } },
    update: {
      rule_name: 'So cot nha pho >= 3 tang (v1)',
      scope: 'structure',
      is_active: false,
      priority: 58,
    },
    create: {
      rule_code: 'column_count_nha_pho',
      rule_name: 'So cot nha pho >= 3 tang (v1)',
      scope: 'structure',
      version: 1,
      priority: 58,
      is_active: false,
      created_by: session.user.id,
    },
  })
  await prismaAny.estimationRuleCondition.deleteMany({ where: { rule_id: columnRuleV1.id } })
  await prismaAny.estimationRuleAction.deleteMany({ where: { rule_id: columnRuleV1.id } })
  await prismaAny.estimationRuleCondition.createMany({
    data: [
      { rule_id: columnRuleV1.id, fact_key: 'house_type', operator: 'eq', value_text: 'nha_pho', sort_order: 1 },
      { rule_id: columnRuleV1.id, fact_key: 'floors', operator: 'gte', value_number: 3, sort_order: 2 },
      { rule_id: columnRuleV1.id, fact_key: 'floors', operator: 'lte', value_number: 3, sort_order: 3 },
    ],
  })
  await prismaAny.estimationRuleAction.createMany({
    data: [
      { rule_id: columnRuleV1.id, action_type: 'set_field', target_key: 'column_count', value_number: 5, sort_order: 1 },
      { rule_id: columnRuleV1.id, action_type: 'add_warning', value_text: 'Rule cot v1: tam tinh 5 cot', sort_order: 2 },
    ],
  })

  const columnRuleV2 = await prismaAny.estimationRuleHeader.upsert({
    where: { rule_code_version: { rule_code: 'column_count_nha_pho', version: 2 } },
    update: {
      rule_name: 'So cot nha pho >= 3 tang (v2 - chuan)',
      scope: 'structure',
      is_active: true,
      priority: 60,
    },
    create: {
      rule_code: 'column_count_nha_pho',
      rule_name: 'So cot nha pho >= 3 tang (v2 - chuan)',
      scope: 'structure',
      version: 2,
      priority: 60,
      is_active: true,
      created_by: session.user.id,
    },
  })
  await prismaAny.estimationRuleCondition.deleteMany({ where: { rule_id: columnRuleV2.id } })
  await prismaAny.estimationRuleAction.deleteMany({ where: { rule_id: columnRuleV2.id } })
  await prismaAny.estimationRuleCondition.createMany({
    data: [
      { rule_id: columnRuleV2.id, fact_key: 'house_type', operator: 'eq', value_text: 'nha_pho', sort_order: 1 },
      { rule_id: columnRuleV2.id, fact_key: 'floors', operator: 'gte', value_number: 3, sort_order: 2 },
      { rule_id: columnRuleV2.id, fact_key: 'floors', operator: 'lte', value_number: 3, sort_order: 3 },
    ],
  })
  await prismaAny.estimationRuleAction.createMany({
    data: [
      { rule_id: columnRuleV2.id, action_type: 'set_field', target_key: 'column_count', value_number: 6, sort_order: 1 },
      { rule_id: columnRuleV2.id, action_type: 'set_field', target_key: 'column_linear_total', formula_expr: 'column_count * floor_height_m * floors', sort_order: 2 },
      { rule_id: columnRuleV2.id, action_type: 'suggest_value', target_key: 'column_note', value_text: 'V2 dat 6 cot cho nha pho 3 tang', sort_order: 3 },
    ],
  })
  await prismaAny.estimationRuleHeader.updateMany({
    where: { rule_code: 'column_count_nha_pho', id: { not: columnRuleV2.id } },
    data: { is_active: false },
  })

  const roofSemanticRule = await prismaAny.estimationRuleHeader.upsert({
    where: { rule_code_version: { rule_code: 'semantic_roof_thai_basic', version: 1 } },
    update: {
      rule_name: 'Bổ sung gợi ý cho mái thái cơ bản',
      scope: 'roof',
      is_active: true,
      priority: 70,
    },
    create: {
      rule_code: 'semantic_roof_thai_basic',
      rule_name: 'Bổ sung gợi ý cho mái thái cơ bản',
      scope: 'roof',
      version: 1,
      priority: 70,
      is_active: true,
      created_by: session.user.id,
    },
  })
  await prismaAny.estimationRuleCondition.deleteMany({ where: { rule_id: roofSemanticRule.id } })
  await prismaAny.estimationRuleAction.deleteMany({ where: { rule_id: roofSemanticRule.id } })
  await prismaAny.estimationRuleCondition.createMany({
    data: [
      { rule_id: roofSemanticRule.id, fact_key: 'roof_preset_count_thai_basic', operator: 'gte', value_number: 1, sort_order: 1 },
    ],
  })
  await prismaAny.estimationRuleAction.createMany({
    data: [
      { rule_id: roofSemanticRule.id, action_type: 'add_warning', value_text: 'Có mái thái: nên kiểm tra lại độ dốc mái và vật tư hoàn thiện mái.', sort_order: 1 },
      { rule_id: roofSemanticRule.id, action_type: 'suggest_value', target_key: 'roof_style_note', value_text: 'Mái thái cơ bản', sort_order: 2 },
    ],
  })

  const windowSemanticRule = await prismaAny.estimationRuleHeader.upsert({
    where: { rule_code_version: { rule_code: 'semantic_window_large_glass', version: 1 } },
    update: {
      rule_name: 'Bổ sung kính cho cửa sổ lớn',
      scope: 'room',
      is_active: true,
      priority: 71,
    },
    create: {
      rule_code: 'semantic_window_large_glass',
      rule_name: 'Bổ sung kính cho cửa sổ lớn',
      scope: 'room',
      version: 1,
      priority: 71,
      is_active: true,
      created_by: session.user.id,
    },
  })
  await prismaAny.estimationRuleCondition.deleteMany({ where: { rule_id: windowSemanticRule.id } })
  await prismaAny.estimationRuleAction.deleteMany({ where: { rule_id: windowSemanticRule.id } })
  await prismaAny.estimationRuleCondition.createMany({
    data: [
      { rule_id: windowSemanticRule.id, fact_key: 'opening_preset_count_window_large', operator: 'gte', value_number: 1, sort_order: 1 },
    ],
  })
  await prismaAny.estimationRuleAction.createMany({
    data: [
      {
        rule_id: windowSemanticRule.id,
        action_type: 'add_item',
        target_key: 'kinh_mat_tien',
        value_json: { item_code: 'kinh_mat_tien', item_name: 'Kính mặt tiền', unit: 'm2', quantity: 4 },
        formula_expr: 'opening_preset_count_window_large * 4',
        sort_order: 1,
      },
      { rule_id: windowSemanticRule.id, action_type: 'add_warning', value_text: 'Có cửa sổ lớn: nên kiểm tra lại phương án nhôm kính và che nắng.', sort_order: 2 },
    ],
  })

  const premiumSemanticRule = await prismaAny.estimationRuleHeader.upsert({
    where: { rule_code_version: { rule_code: 'semantic_space_profile_premium', version: 1 } },
    update: {
      rule_name: 'Điều chỉnh hệ số cho không gian cao cấp',
      scope: 'pricing',
      is_active: true,
      priority: 72,
    },
    create: {
      rule_code: 'semantic_space_profile_premium',
      rule_name: 'Điều chỉnh hệ số cho không gian cao cấp',
      scope: 'pricing',
      version: 1,
      priority: 72,
      is_active: true,
      created_by: session.user.id,
    },
  })
  await prismaAny.estimationRuleCondition.deleteMany({ where: { rule_id: premiumSemanticRule.id } })
  await prismaAny.estimationRuleAction.deleteMany({ where: { rule_id: premiumSemanticRule.id } })
  await prismaAny.estimationRuleCondition.createMany({
    data: [
      { rule_id: premiumSemanticRule.id, fact_key: 'space_profile_count_premium', operator: 'gte', value_number: 1, sort_order: 1 },
    ],
  })
  await prismaAny.estimationRuleAction.createMany({
    data: [
      { rule_id: premiumSemanticRule.id, action_type: 'multiply_coeff', value_number: 1.08, sort_order: 1 },
      { rule_id: premiumSemanticRule.id, action_type: 'suggest_value', target_key: 'finish_note', value_text: 'Có không gian cao cấp: nên chọn vật tư hoàn thiện tương ứng.', sort_order: 2 },
    ],
  })

  const windowAreaRule = await prismaAny.estimationRuleHeader.upsert({
    where: { rule_code_version: { rule_code: 'semantic_window_area_glass', version: 1 } },
    update: {
      rule_name: 'Bổ sung kính theo tổng diện tích cửa sổ',
      scope: 'room',
      is_active: true,
      priority: 73,
    },
    create: {
      rule_code: 'semantic_window_area_glass',
      rule_name: 'Bổ sung kính theo tổng diện tích cửa sổ',
      scope: 'room',
      version: 1,
      priority: 73,
      is_active: true,
      created_by: session.user.id,
    },
  })
  await prismaAny.estimationRuleCondition.deleteMany({ where: { rule_id: windowAreaRule.id } })
  await prismaAny.estimationRuleAction.deleteMany({ where: { rule_id: windowAreaRule.id } })
  await prismaAny.estimationRuleCondition.createMany({
    data: [
      { rule_id: windowAreaRule.id, fact_key: 'window_area_total', operator: 'gte', value_number: 1, sort_order: 1 },
    ],
  })
  await prismaAny.estimationRuleAction.createMany({
    data: [
      {
        rule_id: windowAreaRule.id,
        action_type: 'add_item',
        target_key: 'kinh_mat_tien',
        value_json: { item_code: 'kinh_mat_tien', item_name: 'Kính mặt tiền', unit: 'm2', quantity: 1 },
        formula_expr: 'window_area_total',
        sort_order: 1,
      },
      { rule_id: windowAreaRule.id, action_type: 'suggest_value', target_key: 'window_note', value_text: 'Diện tích kính đang lấy theo tổng diện tích cửa sổ thực tế.', sort_order: 2 },
    ],
  })

  const doorHardwareRule = await prismaAny.estimationRuleHeader.upsert({
    where: { rule_code_version: { rule_code: 'semantic_door_count_hardware', version: 1 } },
    update: {
      rule_name: 'Bổ sung phụ kiện theo số cửa đi',
      scope: 'room',
      is_active: true,
      priority: 74,
    },
    create: {
      rule_code: 'semantic_door_count_hardware',
      rule_name: 'Bổ sung phụ kiện theo số cửa đi',
      scope: 'room',
      version: 1,
      priority: 74,
      is_active: true,
      created_by: session.user.id,
    },
  })
  await prismaAny.estimationRuleCondition.deleteMany({ where: { rule_id: doorHardwareRule.id } })
  await prismaAny.estimationRuleAction.deleteMany({ where: { rule_id: doorHardwareRule.id } })
  await prismaAny.estimationRuleCondition.createMany({
    data: [
      { rule_id: doorHardwareRule.id, fact_key: 'door_count_total', operator: 'gte', value_number: 1, sort_order: 1 },
    ],
  })
  await prismaAny.estimationRuleAction.createMany({
    data: [
      {
        rule_id: doorHardwareRule.id,
        action_type: 'add_item',
        target_key: 'phu_kien_cua',
        value_json: { item_code: 'phu_kien_cua', item_name: 'Phụ kiện cửa', unit: 'bo', quantity: 1 },
        formula_expr: 'door_count_total',
        sort_order: 1,
      },
      { rule_id: doorHardwareRule.id, action_type: 'suggest_value', target_key: 'door_note', value_text: 'Phụ kiện cửa đang tạm tính theo số cửa đi thực tế.', sort_order: 2 },
    ],
  })

  return NextResponse.json({
    ok: true,
    data: {
      taxonomy_seeded: taxonomyCount,
      catalog_seeded: catalogCount,
      templates_seeded: 7,
      rules_seeded: 8,
    },
  })
}





