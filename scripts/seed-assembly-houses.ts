import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const prismaAny = prisma as any
const CREATED_BY = 'seed_assembly_houses'

type OpeningSeed = {
  type: 'door' | 'window' | 'vent'
  face: 'front' | 'back' | 'left' | 'right'
  offset: number
  width: number
  height: number
  sill: number
}

type BlockSeed = {
  component_type: string
  template_code?: string | null
  level_index: number
  block_name: string
  sort_order: number
  length_order?: number
  height_order?: number
  dimensions_json: Record<string, unknown>
}

type AssemblySeed = {
  name: string
  house_type: string
  style: string
  level: string
  region_code: string
  status: string
  blocks: BlockSeed[]
}

function roomDims(args: {
  x: number
  y: number
  length: number
  width: number
  height: number
  roomType: string
  spaceType: string
  spaceProfile?: string
  facadeRole?: string
  interiorPreset?: string
  openingPreset?: string
  openings?: OpeningSeed[]
  hasCeiling?: boolean
  hasPaint?: boolean
  hasElectrical?: boolean
  hasPlumbing?: boolean
  hasWindow?: boolean
  hasDoor?: boolean
}) {
  return {
    x_m: args.x,
    y_m: args.y,
    length_m: args.length,
    width_m: args.width,
    height_m: args.height,
    area_m2: Number((args.length * args.width).toFixed(2)),
    room_type: args.roomType,
    space_type: args.spaceType,
    space_profile: args.spaceProfile || 'basic',
    facade_role: args.facadeRole || '',
    interior_preset: args.interiorPreset || '',
    opening_preset: args.openingPreset || '',
    openings: args.openings || [],
    has_ceiling: args.hasCeiling ?? true,
    has_paint: args.hasPaint ?? true,
    has_electrical: args.hasElectrical ?? true,
    has_plumbing: args.hasPlumbing ?? false,
    has_window: args.hasWindow ?? true,
    has_door: args.hasDoor ?? true,
    locked: false,
  }
}

function wallDims(args: {
  x: number
  y: number
  length: number
  width?: number
  height: number
  blockName?: string
  facadeRole?: string
  openingPreset?: string
  openings?: OpeningSeed[]
}) {
  const width = args.width ?? 0.2
  return {
    x_m: args.x,
    y_m: args.y,
    length_m: args.length,
    width_m: width,
    height_m: args.height,
    area_m2: Number((args.length * width).toFixed(2)),
    wall_area_m2: Number((args.length * args.height).toFixed(2)),
    wall_length_m: args.length,
    facade_role: args.facadeRole || '',
    opening_preset: args.openingPreset || '',
    openings: args.openings || [],
    block_name: args.blockName || null,
    has_window: true,
    has_door: true,
    locked: false,
  }
}

function foundationDims(args: {
  x: number
  y: number
  length: number
  width: number
  height: number
  foundationType: string
}) {
  return {
    x_m: args.x,
    y_m: args.y,
    length_m: args.length,
    width_m: args.width,
    height_m: args.height,
    area_m2: Number((args.length * args.width).toFixed(2)),
    foundation_type: args.foundationType,
    locked: false,
  }
}

function stairDims(args: {
  x: number
  y: number
  length: number
  width: number
  height: number
  stairPreset: string
}) {
  return {
    x_m: args.x,
    y_m: args.y,
    length_m: args.length,
    width_m: args.width,
    height_m: args.height,
    area_m2: Number((args.length * args.width).toFixed(2)),
    room_type: 'cau_thang',
    space_type: 'stair',
    space_profile: 'utility',
    stair_preset: args.stairPreset,
    has_ceiling: false,
    has_paint: true,
    has_electrical: true,
    has_window: false,
    has_door: false,
    locked: false,
  }
}

function roofDims(args: {
  x: number
  y: number
  length: number
  width: number
  height: number
  roofPreset: string
  facadeRole?: string
}) {
  return {
    x_m: args.x,
    y_m: args.y,
    length_m: args.length,
    width_m: args.width,
    height_m: args.height,
    area_m2: Number((args.length * args.width).toFixed(2)),
    roof_preset: args.roofPreset,
    facade_role: args.facadeRole || '',
    locked: false,
  }
}

function tumDims(args: {
  x: number
  y: number
  length: number
  width: number
  height: number
  facadeRole?: string
}) {
  return {
    x_m: args.x,
    y_m: args.y,
    length_m: args.length,
    width_m: args.width,
    height_m: args.height,
    area_m2: Number((args.length * args.width).toFixed(2)),
    room_type: 'tum',
    space_type: 'tum',
    space_profile: 'utility',
    facade_role: args.facadeRole || 'rear',
    has_ceiling: true,
    has_paint: true,
    has_electrical: true,
    has_window: true,
    has_door: true,
    locked: false,
  }
}

async function getTemplateIds() {
  const rows = await prismaAny.estimationTemplateHeader.findMany({
    where: {
      template_code: {
        in: [
          'tpl_room_bedroom_std',
          'tpl_room_master_bedroom_std',
          'tpl_room_wc_std',
          'tpl_room_kitchen_std',
          'tpl_foundation_mong_coc_std',
          'tpl_facade_glass_std',
          'tpl_roof_thai_basic_std',
          'tpl_structure_column_std',
        ],
      },
      is_active: true,
    },
    orderBy: [{ version: 'desc' }],
  })
  const map = new Map<string, string>()
  for (const row of rows) {
    if (!map.has(String(row.template_code))) map.set(String(row.template_code), String(row.id))
  }
  return map
}

const seeds: AssemblySeed[] = [
  {
    name: 'Seed Demo - Nha pho 2 tang + tum 5x16',
    house_type: 'nha_pho',
    style: 'hien_dai',
    level: 'tieu_chuan',
    region_code: 'ALL',
    status: 'draft',
    blocks: [
      {
        component_type: 'foundation',
        template_code: 'tpl_foundation_mong_coc_std',
        level_index: 0,
        block_name: 'Mong coc 5x16',
        sort_order: 1,
        dimensions_json: foundationDims({ x: 0, y: 0, length: 16, width: 5, height: 1.2, foundationType: 'mong_coc' }),
      },
      {
        component_type: 'wall',
        template_code: 'tpl_facade_glass_std',
        level_index: 0,
        block_name: 'Tuong mat tien tret',
        sort_order: 2,
        dimensions_json: wallDims({
          x: 0,
          y: 0,
          length: 5,
          height: 3.8,
          facadeRole: 'main_front',
          openingPreset: 'door_double',
          openings: [
            { type: 'door', face: 'front', offset: 0.8, width: 2.4, height: 2.9, sill: 0 },
            { type: 'window', face: 'front', offset: 3.5, width: 1.1, height: 1.4, sill: 0.9 },
          ],
        }),
      },
      {
        component_type: 'room',
        level_index: 0,
        block_name: 'Phong khach',
        sort_order: 10,
        dimensions_json: roomDims({
          x: 0,
          y: 0,
          length: 5,
          width: 5.5,
          height: 3.8,
          roomType: 'living_room',
          spaceType: 'living_room',
          spaceProfile: 'premium',
          facadeRole: 'main_front',
          openingPreset: 'window_large',
          openings: [{ type: 'window', face: 'front', offset: 3.3, width: 1.2, height: 1.4, sill: 0.9 }],
        }),
      },
      {
        component_type: 'stair',
        level_index: 0,
        block_name: 'Cau thang',
        sort_order: 11,
        dimensions_json: stairDims({ x: 0, y: 5.5, length: 2.2, width: 4, height: 3.8, stairPreset: 'l_shape' }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_wc_std',
        level_index: 0,
        block_name: 'WC tang tret',
        sort_order: 12,
        dimensions_json: roomDims({
          x: 2.2,
          y: 5.5,
          length: 1.4,
          width: 2,
          height: 3.8,
          roomType: 'wc',
          spaceType: 'wc',
          spaceProfile: 'basic',
          interiorPreset: 'wc_basic',
          hasPlumbing: true,
          hasWindow: false,
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_kitchen_std',
        level_index: 0,
        block_name: 'Bep + an',
        sort_order: 13,
        dimensions_json: roomDims({
          x: 0,
          y: 9.5,
          length: 5,
          width: 6.5,
          height: 3.8,
          roomType: 'kitchen',
          spaceType: 'kitchen',
          spaceProfile: 'premium',
          interiorPreset: 'kitchen_basic',
          hasPlumbing: true,
          openingPreset: 'window_large',
        }),
      },
      {
        component_type: 'wall',
        template_code: 'tpl_facade_glass_std',
        level_index: 1,
        block_name: 'Tuong mat tien tang 2',
        sort_order: 20,
        dimensions_json: wallDims({
          x: 0,
          y: 0,
          length: 5,
          height: 3.6,
          facadeRole: 'main_front',
          openingPreset: 'window_large',
          openings: [
            { type: 'window', face: 'front', offset: 0.7, width: 1.6, height: 1.5, sill: 0.85 },
            { type: 'window', face: 'front', offset: 2.9, width: 1.4, height: 1.5, sill: 0.85 },
          ],
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_master_bedroom_std',
        level_index: 1,
        block_name: 'Master tang 2',
        sort_order: 21,
        dimensions_json: roomDims({
          x: 0,
          y: 0,
          length: 5,
          width: 6.5,
          height: 3.6,
          roomType: 'master_bedroom',
          spaceType: 'master_bedroom',
          spaceProfile: 'premium',
          facadeRole: 'main_front',
          interiorPreset: 'bedroom_basic',
          openingPreset: 'window_large',
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_bedroom_std',
        level_index: 1,
        block_name: 'Phong ngu 2',
        sort_order: 22,
        dimensions_json: roomDims({
          x: 0,
          y: 6.5,
          length: 3.2,
          width: 4.2,
          height: 3.6,
          roomType: 'bedroom',
          spaceType: 'bedroom',
          spaceProfile: 'basic',
          interiorPreset: 'bedroom_basic',
          openingPreset: 'window_small',
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_wc_std',
        level_index: 1,
        block_name: 'WC tang 2',
        sort_order: 23,
        dimensions_json: roomDims({
          x: 3.2,
          y: 6.5,
          length: 1.8,
          width: 2.2,
          height: 3.6,
          roomType: 'wc',
          spaceType: 'wc',
          spaceProfile: 'basic',
          interiorPreset: 'wc_basic',
          hasPlumbing: true,
          hasWindow: false,
        }),
      },
      {
        component_type: 'tum',
        level_index: 2,
        block_name: 'Tum + phong tho',
        sort_order: 30,
        dimensions_json: tumDims({ x: 0.6, y: 9.2, length: 4.4, width: 3.8, height: 3.2, facadeRole: 'rear' }),
      },
      {
        component_type: 'roof',
        template_code: 'tpl_roof_thai_basic_std',
        level_index: 2,
        block_name: 'Mai thai chinh',
        sort_order: 31,
        dimensions_json: roofDims({ x: -0.2, y: -0.2, length: 16.4, width: 5.4, height: 1.6, roofPreset: 'thai_basic', facadeRole: 'main_front' }),
      },
    ],
  },
  {
    name: 'Seed Demo - Nha cap 4 3 phong ngu 8x14',
    house_type: 'nha_cap_4',
    style: 'mai_thai',
    level: 'tieu_chuan',
    region_code: 'ALL',
    status: 'draft',
    blocks: [
      {
        component_type: 'foundation',
        template_code: 'tpl_foundation_mong_coc_std',
        level_index: 0,
        block_name: 'Mong cap 4',
        sort_order: 1,
        dimensions_json: foundationDims({ x: 0, y: 0, length: 14, width: 8, height: 1, foundationType: 'mong_coc' }),
      },
      {
        component_type: 'wall',
        template_code: 'tpl_facade_glass_std',
        level_index: 0,
        block_name: 'Tuong mat tien',
        sort_order: 2,
        dimensions_json: wallDims({
          x: 0,
          y: 0,
          length: 8,
          height: 3.9,
          facadeRole: 'main_front',
          openingPreset: 'door_double',
          openings: [
            { type: 'door', face: 'front', offset: 2.7, width: 2.2, height: 2.8, sill: 0 },
            { type: 'window', face: 'front', offset: 0.5, width: 1.4, height: 1.3, sill: 0.95 },
            { type: 'window', face: 'front', offset: 5.8, width: 1.4, height: 1.3, sill: 0.95 },
          ],
        }),
      },
      {
        component_type: 'room',
        level_index: 0,
        block_name: 'Phong khach',
        sort_order: 10,
        dimensions_json: roomDims({
          x: 0,
          y: 0,
          length: 8,
          width: 4.2,
          height: 3.9,
          roomType: 'living_room',
          spaceType: 'living_room',
          spaceProfile: 'premium',
          facadeRole: 'main_front',
          openingPreset: 'window_large',
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_kitchen_std',
        level_index: 0,
        block_name: 'Bep + an',
        sort_order: 11,
        dimensions_json: roomDims({
          x: 0,
          y: 4.2,
          length: 4.2,
          width: 3.6,
          height: 3.9,
          roomType: 'kitchen',
          spaceType: 'kitchen',
          spaceProfile: 'basic',
          interiorPreset: 'kitchen_basic',
          hasPlumbing: true,
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_bedroom_std',
        level_index: 0,
        block_name: 'Phong ngu 1',
        sort_order: 12,
        dimensions_json: roomDims({
          x: 4.2,
          y: 4.2,
          length: 3.8,
          width: 3.6,
          height: 3.9,
          roomType: 'bedroom',
          spaceType: 'bedroom',
          interiorPreset: 'bedroom_basic',
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_bedroom_std',
        level_index: 0,
        block_name: 'Phong ngu 2',
        sort_order: 13,
        dimensions_json: roomDims({
          x: 0,
          y: 7.8,
          length: 4,
          width: 3.3,
          height: 3.9,
          roomType: 'bedroom',
          spaceType: 'bedroom',
          interiorPreset: 'bedroom_basic',
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_master_bedroom_std',
        level_index: 0,
        block_name: 'Phong ngu master',
        sort_order: 14,
        dimensions_json: roomDims({
          x: 4,
          y: 7.8,
          length: 4,
          width: 3.3,
          height: 3.9,
          roomType: 'master_bedroom',
          spaceType: 'master_bedroom',
          spaceProfile: 'premium',
          interiorPreset: 'bedroom_basic',
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_wc_std',
        level_index: 0,
        block_name: 'WC chung',
        sort_order: 15,
        dimensions_json: roomDims({
          x: 2.7,
          y: 11.1,
          length: 2,
          width: 1.8,
          height: 3.9,
          roomType: 'wc',
          spaceType: 'wc',
          interiorPreset: 'wc_basic',
          hasPlumbing: true,
          hasWindow: false,
        }),
      },
      {
        component_type: 'roof',
        template_code: 'tpl_roof_thai_basic_std',
        level_index: 0,
        block_name: 'Mai thai cap 4',
        sort_order: 20,
        dimensions_json: roofDims({ x: -0.3, y: -0.3, length: 14.6, width: 8.6, height: 1.8, roofPreset: 'thai_basic', facadeRole: 'main_front' }),
      },
    ],
  },
  {
    name: 'Seed Demo - Biet thu mini 2 tang 10x12',
    house_type: 'biet_thu',
    style: 'tan_co_dien',
    level: 'cao_cap',
    region_code: 'ALL',
    status: 'draft',
    blocks: [
      {
        component_type: 'foundation',
        template_code: 'tpl_foundation_mong_coc_std',
        level_index: 0,
        block_name: 'Mong biet thu mini',
        sort_order: 1,
        dimensions_json: foundationDims({ x: 0, y: 0, length: 12, width: 10, height: 1.2, foundationType: 'mong_coc' }),
      },
      {
        component_type: 'wall',
        template_code: 'tpl_facade_glass_std',
        level_index: 0,
        block_name: 'Tuong mat tien biet thu',
        sort_order: 2,
        dimensions_json: wallDims({
          x: 0,
          y: 0,
          length: 10,
          height: 4,
          facadeRole: 'main_front',
          openingPreset: 'door_double',
          openings: [
            { type: 'door', face: 'front', offset: 3.6, width: 2.6, height: 3.1, sill: 0 },
            { type: 'window', face: 'front', offset: 0.8, width: 1.6, height: 1.5, sill: 1 },
            { type: 'window', face: 'front', offset: 7.4, width: 1.6, height: 1.5, sill: 1 },
          ],
        }),
      },
      {
        component_type: 'room',
        level_index: 0,
        block_name: 'Phong khach lon',
        sort_order: 10,
        dimensions_json: roomDims({
          x: 0,
          y: 0,
          length: 6,
          width: 5,
          height: 4,
          roomType: 'living_room',
          spaceType: 'living_room',
          spaceProfile: 'premium',
          facadeRole: 'main_front',
          openingPreset: 'window_large',
        }),
      },
      {
        component_type: 'stair',
        level_index: 0,
        block_name: 'Sanh + cau thang',
        sort_order: 11,
        dimensions_json: stairDims({ x: 6, y: 0, length: 2.6, width: 5, height: 4, stairPreset: 'u_shape' }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_kitchen_std',
        level_index: 0,
        block_name: 'Bep + an',
        sort_order: 12,
        dimensions_json: roomDims({
          x: 0,
          y: 5,
          length: 6.6,
          width: 4.5,
          height: 4,
          roomType: 'kitchen',
          spaceType: 'kitchen',
          spaceProfile: 'premium',
          interiorPreset: 'kitchen_basic',
          hasPlumbing: true,
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_wc_std',
        level_index: 0,
        block_name: 'WC tang 1',
        sort_order: 13,
        dimensions_json: roomDims({
          x: 6.6,
          y: 5,
          length: 1.8,
          width: 2.2,
          height: 4,
          roomType: 'wc',
          spaceType: 'wc',
          interiorPreset: 'wc_basic',
          hasPlumbing: true,
          hasWindow: false,
        }),
      },
      {
        component_type: 'room',
        level_index: 0,
        block_name: 'Gara',
        sort_order: 14,
        dimensions_json: roomDims({
          x: 8.4,
          y: 5,
          length: 1.6,
          width: 4.5,
          height: 4,
          roomType: 'garage',
          spaceType: 'garage',
          spaceProfile: 'utility',
          hasWindow: false,
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_master_bedroom_std',
        level_index: 1,
        block_name: 'Master tang 2',
        sort_order: 20,
        dimensions_json: roomDims({
          x: 0,
          y: 0,
          length: 6,
          width: 5.5,
          height: 3.8,
          roomType: 'master_bedroom',
          spaceType: 'master_bedroom',
          spaceProfile: 'premium',
          facadeRole: 'main_front',
          interiorPreset: 'bedroom_basic',
          openingPreset: 'window_large',
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_bedroom_std',
        level_index: 1,
        block_name: 'Phong ngu 2',
        sort_order: 21,
        dimensions_json: roomDims({
          x: 6,
          y: 0,
          length: 4,
          width: 3.4,
          height: 3.8,
          roomType: 'bedroom',
          spaceType: 'bedroom',
          interiorPreset: 'bedroom_basic',
          facadeRole: 'main_front',
          openingPreset: 'window_large',
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_bedroom_std',
        level_index: 1,
        block_name: 'Phong ngu 3',
        sort_order: 22,
        dimensions_json: roomDims({
          x: 6,
          y: 3.4,
          length: 4,
          width: 3.1,
          height: 3.8,
          roomType: 'bedroom',
          spaceType: 'bedroom',
          interiorPreset: 'bedroom_basic',
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_wc_std',
        level_index: 1,
        block_name: 'WC tang 2',
        sort_order: 23,
        dimensions_json: roomDims({
          x: 4.5,
          y: 5.5,
          length: 1.7,
          width: 1.9,
          height: 3.8,
          roomType: 'wc',
          spaceType: 'wc',
          interiorPreset: 'wc_basic',
          hasPlumbing: true,
          hasWindow: false,
        }),
      },
      {
        component_type: 'tum',
        level_index: 2,
        block_name: 'Tum ky thuat',
        sort_order: 30,
        dimensions_json: tumDims({ x: 6.4, y: 7.5, length: 2.8, width: 2.8, height: 3.2, facadeRole: 'rear' }),
      },
      {
        component_type: 'roof',
        template_code: 'tpl_roof_thai_basic_std',
        level_index: 2,
        block_name: 'Mai thai biet thu',
        sort_order: 31,
        dimensions_json: roofDims({ x: -0.4, y: -0.4, length: 12.8, width: 10.8, height: 2, roofPreset: 'thai_basic', facadeRole: 'main_front' }),
      },
    ],
  },
  {
    name: 'Seed Demo - Nha ong 2 mat tien 6x14',
    house_type: 'nha_pho',
    style: 'hien_dai',
    level: 'cao_cap',
    region_code: 'ALL',
    status: 'draft',
    blocks: [
      {
        component_type: 'foundation',
        template_code: 'tpl_foundation_mong_coc_std',
        level_index: 0,
        block_name: 'Mong nha 2 mat tien',
        sort_order: 1,
        dimensions_json: foundationDims({ x: 0, y: 0, length: 14, width: 6, height: 1.2, foundationType: 'mong_coc' }),
      },
      {
        component_type: 'wall',
        template_code: 'tpl_facade_glass_std',
        level_index: 0,
        block_name: 'Mat tien truoc',
        sort_order: 2,
        dimensions_json: wallDims({
          x: 0,
          y: 0,
          length: 6,
          height: 3.9,
          facadeRole: 'main_front',
          openingPreset: 'door_double',
          openings: [
            { type: 'door', face: 'front', offset: 1.6, width: 2.2, height: 2.9, sill: 0 },
            { type: 'window', face: 'front', offset: 4.3, width: 1.1, height: 1.4, sill: 0.9 },
          ],
        }),
      },
      {
        component_type: 'wall',
        template_code: 'tpl_facade_glass_std',
        level_index: 0,
        block_name: 'Mat ben pho',
        sort_order: 3,
        dimensions_json: wallDims({
          x: 0,
          y: 0,
          length: 5.4,
          height: 3.9,
          facadeRole: 'side_left',
          openingPreset: 'window_large',
          openings: [
            { type: 'window', face: 'left', offset: 0.9, width: 1.4, height: 1.5, sill: 0.8 },
            { type: 'window', face: 'left', offset: 3.0, width: 1.4, height: 1.5, sill: 0.8 },
          ],
        }),
      },
      {
        component_type: 'room',
        level_index: 0,
        block_name: 'Phong khach 2 mat thoang',
        sort_order: 10,
        dimensions_json: roomDims({
          x: 0,
          y: 0,
          length: 6,
          width: 4.8,
          height: 3.9,
          roomType: 'living_room',
          spaceType: 'living_room',
          spaceProfile: 'premium',
          facadeRole: 'main_front',
          openingPreset: 'window_large',
        }),
      },
      {
        component_type: 'stair',
        level_index: 0,
        block_name: 'Cau thang giua nha',
        sort_order: 11,
        dimensions_json: stairDims({ x: 0, y: 4.8, length: 2.2, width: 3.6, height: 3.9, stairPreset: 'l_shape' }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_kitchen_std',
        level_index: 0,
        block_name: 'Bep + an',
        sort_order: 12,
        dimensions_json: roomDims({
          x: 0,
          y: 8.4,
          length: 6,
          width: 5.6,
          height: 3.9,
          roomType: 'kitchen',
          spaceType: 'kitchen',
          spaceProfile: 'premium',
          interiorPreset: 'kitchen_basic',
          hasPlumbing: true,
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_master_bedroom_std',
        level_index: 1,
        block_name: 'Master mat tien',
        sort_order: 20,
        dimensions_json: roomDims({
          x: 0,
          y: 0,
          length: 6,
          width: 5.8,
          height: 3.7,
          roomType: 'master_bedroom',
          spaceType: 'master_bedroom',
          spaceProfile: 'premium',
          facadeRole: 'main_front',
          interiorPreset: 'bedroom_basic',
          openingPreset: 'window_large',
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_bedroom_std',
        level_index: 1,
        block_name: 'Phong ngu phu',
        sort_order: 21,
        dimensions_json: roomDims({
          x: 0,
          y: 5.8,
          length: 3,
          width: 4,
          height: 3.7,
          roomType: 'bedroom',
          spaceType: 'bedroom',
          interiorPreset: 'bedroom_basic',
          facadeRole: 'side_left',
          openingPreset: 'window_large',
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_wc_std',
        level_index: 1,
        block_name: 'WC tang 2',
        sort_order: 22,
        dimensions_json: roomDims({
          x: 3,
          y: 5.8,
          length: 1.6,
          width: 2.2,
          height: 3.7,
          roomType: 'wc',
          spaceType: 'wc',
          interiorPreset: 'wc_basic',
          hasPlumbing: true,
          hasWindow: false,
        }),
      },
      {
        component_type: 'roof',
        template_code: 'tpl_roof_thai_basic_std',
        level_index: 1,
        block_name: 'Mai lech thong thoang',
        sort_order: 30,
        dimensions_json: roofDims({ x: -0.2, y: -0.2, length: 14.4, width: 6.4, height: 1.7, roofPreset: 'lean_to', facadeRole: 'main_front' }),
      },
    ],
  },
  {
    name: 'Seed Demo - Nha pho lech tang 4x18',
    house_type: 'nha_pho',
    style: 'hien_dai',
    level: 'tieu_chuan',
    region_code: 'ALL',
    status: 'draft',
    blocks: [
      {
        component_type: 'foundation',
        template_code: 'tpl_foundation_mong_coc_std',
        level_index: 0,
        block_name: 'Mong nha ong lech tang',
        sort_order: 1,
        dimensions_json: foundationDims({ x: 0, y: 0, length: 18, width: 4, height: 1.1, foundationType: 'mong_coc' }),
      },
      {
        component_type: 'wall',
        template_code: 'tpl_facade_glass_std',
        level_index: 0,
        block_name: 'Tuong mat tien',
        sort_order: 2,
        dimensions_json: wallDims({
          x: 0,
          y: 0,
          length: 4,
          height: 4,
          facadeRole: 'main_front',
          openingPreset: 'door_single',
          openings: [
            { type: 'door', face: 'front', offset: 0.6, width: 1.4, height: 2.8, sill: 0 },
            { type: 'window', face: 'front', offset: 2.2, width: 1.2, height: 1.5, sill: 0.8 },
          ],
        }),
      },
      {
        component_type: 'room',
        level_index: 0,
        block_name: 'Gara + sanh',
        sort_order: 10,
        dimensions_json: roomDims({
          x: 0,
          y: 0,
          length: 4,
          width: 5,
          height: 4,
          roomType: 'garage',
          spaceType: 'garage',
          spaceProfile: 'utility',
          facadeRole: 'main_front',
          hasWindow: false,
        }),
      },
      {
        component_type: 'stair',
        level_index: 0,
        block_name: 'Cau thang lech tang',
        sort_order: 11,
        dimensions_json: stairDims({ x: 0, y: 5, length: 1.8, width: 3.2, height: 2.1, stairPreset: 'straight' }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_kitchen_std',
        level_index: 0,
        block_name: 'Bep + an cuoi nha',
        sort_order: 12,
        dimensions_json: roomDims({
          x: 0,
          y: 8.2,
          length: 4,
          width: 5.4,
          height: 3.6,
          roomType: 'kitchen',
          spaceType: 'kitchen',
          interiorPreset: 'kitchen_basic',
          hasPlumbing: true,
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_wc_std',
        level_index: 0,
        block_name: 'WC tang lech 1',
        sort_order: 13,
        dimensions_json: roomDims({
          x: 2.2,
          y: 5.1,
          length: 1.2,
          width: 1.7,
          height: 2.6,
          roomType: 'wc',
          spaceType: 'wc',
          interiorPreset: 'wc_basic',
          hasPlumbing: true,
          hasWindow: false,
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_bedroom_std',
        level_index: 1,
        block_name: 'Phong ngu lech 1',
        sort_order: 20,
        dimensions_json: roomDims({
          x: 0,
          y: 0.6,
          length: 4,
          width: 4.4,
          height: 3.6,
          roomType: 'bedroom',
          spaceType: 'bedroom',
          interiorPreset: 'bedroom_basic',
          facadeRole: 'main_front',
          openingPreset: 'window_large',
        }),
      },
      {
        component_type: 'room',
        template_code: 'tpl_room_bedroom_std',
        level_index: 2,
        block_name: 'Phong ngu lech 2',
        sort_order: 21,
        dimensions_json: roomDims({
          x: 0,
          y: 7.5,
          length: 4,
          width: 4.8,
          height: 3.5,
          roomType: 'bedroom',
          spaceType: 'bedroom',
          interiorPreset: 'bedroom_basic',
          openingPreset: 'window_small',
        }),
      },
      {
        component_type: 'tum',
        level_index: 3,
        block_name: 'Tum giat phoi',
        sort_order: 30,
        dimensions_json: tumDims({ x: 0.4, y: 13.2, length: 3.6, width: 2.8, height: 3, facadeRole: 'rear' }),
      },
      {
        component_type: 'roof',
        template_code: 'tpl_roof_thai_basic_std',
        level_index: 3,
        block_name: 'Mai tum + san thuong',
        sort_order: 31,
        dimensions_json: roofDims({ x: -0.2, y: -0.2, length: 18.3, width: 4.4, height: 1.2, roofPreset: 'terrace', facadeRole: 'rear' }),
      },
    ],
  },
]

async function upsertAssembly(seed: AssemblySeed, templateIds: Map<string, string>) {
  const existing = await prismaAny.projectAssembly.findFirst({
    where: {
      name: seed.name,
      created_by: CREATED_BY,
    },
  })

  const assembly = existing
    ? await prismaAny.projectAssembly.update({
        where: { id: existing.id },
        data: {
          house_type: seed.house_type,
          style: seed.style,
          level: seed.level,
          region_code: seed.region_code,
          status: seed.status,
        },
      })
    : await prismaAny.projectAssembly.create({
        data: {
          name: seed.name,
          customer_id: null,
          house_type: seed.house_type,
          style: seed.style,
          level: seed.level,
          region_code: seed.region_code,
          status: seed.status,
          created_by: CREATED_BY,
        },
      })

  await prismaAny.projectAssemblyBlock.deleteMany({
    where: { assembly_id: assembly.id },
  })

  for (const block of seed.blocks) {
    await prismaAny.projectAssemblyBlock.create({
      data: {
        assembly_id: assembly.id,
        component_type: block.component_type,
        template_id: block.template_code ? templateIds.get(block.template_code) || null : null,
        level_index: block.level_index,
        block_name: block.block_name,
        dimensions_json: block.dimensions_json,
        sort_order: block.sort_order,
        length_order: block.length_order ?? block.sort_order,
        height_order: block.height_order ?? block.level_index,
        is_active: true,
      },
    })
  }

  return assembly
}

async function main() {
  const templateIds = await getTemplateIds()

  if (!templateIds.size) {
    throw new Error('Khong tim thay template estimate v2. Hay chay seed:estimate-v2 truoc.')
  }

  const results: Array<{ name: string; id: string; blocks: number }> = []
  for (const seed of seeds) {
    const assembly = await upsertAssembly(seed, templateIds)
    results.push({ name: seed.name, id: String(assembly.id), blocks: seed.blocks.length })
  }

  console.log('Seed sample assemblies done:')
  for (const row of results) {
    console.log(`- ${row.name} | ${row.blocks} blocks | ${row.id}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
