import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const prismaAny = prisma as any
const ASSEMBLY_CREATED_BY = 'seed_assembly_houses'
const PRESET_CREATED_BY = 'seed_assembly_presets'

const PRESET_MAPPINGS = [
  {
    assemblyName: 'Seed Demo - Nha pho 2 tang + tum 5x16',
    presetName: 'Preset Demo - Nha pho 2 tang + tum 5x16',
  },
  {
    assemblyName: 'Seed Demo - Nha cap 4 3 phong ngu 8x14',
    presetName: 'Preset Demo - Nha cap 4 3 phong ngu 8x14',
  },
  {
    assemblyName: 'Seed Demo - Biet thu mini 2 tang 10x12',
    presetName: 'Preset Demo - Biet thu mini 2 tang 10x12',
  },
  {
    assemblyName: 'Seed Demo - Nha ong 2 mat tien 6x14',
    presetName: 'Preset Demo - Nha ong 2 mat tien 6x14',
  },
  {
    assemblyName: 'Seed Demo - Nha pho lech tang 4x18',
    presetName: 'Preset Demo - Nha pho lech tang 4x18',
  },
] as const

async function upsertPresetFromAssembly(args: {
  assemblyName: string
  presetName: string
}) {
  const source = await prismaAny.projectAssembly.findFirst({
    where: {
      name: args.assemblyName,
      created_by: ASSEMBLY_CREATED_BY,
    },
    include: {
      blocks: {
        where: { is_active: true },
        orderBy: [{ level_index: 'asc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
      },
    },
  })

  if (!source) {
    throw new Error(`Khong tim thay assembly seed: ${args.assemblyName}`)
  }

  const existing = await prismaAny.projectAssemblyPreset.findFirst({
    where: {
      name: args.presetName,
      created_by: PRESET_CREATED_BY,
    },
  })

  const preset = existing
    ? await prismaAny.projectAssemblyPreset.update({
        where: { id: existing.id },
        data: {
          source_assembly_id: source.id,
          house_type: source.house_type || null,
          style: source.style || null,
          level: source.level || null,
          region_code: source.region_code || 'ALL',
          is_active: true,
        },
      })
    : await prismaAny.projectAssemblyPreset.create({
        data: {
          name: args.presetName,
          source_assembly_id: source.id,
          house_type: source.house_type || null,
          style: source.style || null,
          level: source.level || null,
          region_code: source.region_code || 'ALL',
          is_active: true,
          created_by: PRESET_CREATED_BY,
        },
      })

  await prismaAny.projectAssemblyPresetBlock.deleteMany({
    where: { preset_id: preset.id },
  })

  if (Array.isArray(source.blocks) && source.blocks.length) {
    await prismaAny.projectAssemblyPresetBlock.createMany({
      data: source.blocks.map((b: any) => ({
        preset_id: preset.id,
        component_type: String(b.component_type || ''),
        template_id: b.template_id || null,
        level_index: Number.isFinite(Number(b.level_index)) ? Math.trunc(Number(b.level_index)) : 0,
        block_name: b.block_name || null,
        dimensions_json: b.dimensions_json || null,
        sort_order: Number.isFinite(Number(b.sort_order)) ? Math.trunc(Number(b.sort_order)) : 0,
        length_order: Number.isFinite(Number(b.length_order)) ? Math.trunc(Number(b.length_order)) : 0,
        height_order: Number.isFinite(Number(b.height_order)) ? Math.trunc(Number(b.height_order)) : 0,
        is_active: true,
      })),
    })
  }

  return {
    id: String(preset.id),
    name: String(preset.name),
    blockCount: Array.isArray(source.blocks) ? source.blocks.length : 0,
  }
}

async function main() {
  const results = []
  for (const row of PRESET_MAPPINGS) {
    results.push(await upsertPresetFromAssembly(row))
  }

  console.log('Seed assembly presets done:')
  for (const row of results) {
    console.log(`- ${row.name} | ${row.blockCount} blocks | ${row.id}`)
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
