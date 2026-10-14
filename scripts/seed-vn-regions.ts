import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DATASET_URL =
  'https://raw.githubusercontent.com/thanglequoc/vietnamese-provinces-database/master/json/vn_only_simplified_json_generated_data_vn_units_minified.json'
const SOURCE = 'thanglequoc/vietnamese-provinces-database'
const SOURCE_VERSION = 'master'
const BATCH_SIZE = 500

type DatasetWard = {
  Code?: string
  FullName?: string
  ProvinceCode?: string
}

type DatasetProvince = {
  Code?: string
  FullName?: string
  Wards?: DatasetWard[]
}

async function fetchDataset(): Promise<DatasetProvince[]> {
  const res = await fetch(DATASET_URL)
  if (!res.ok) {
    throw new Error(`Khong tai duoc dataset (${res.status} ${res.statusText})`)
  }
  const json = await res.json()
  if (!Array.isArray(json)) {
    throw new Error('Dataset khong dung dinh dang array')
  }
  return json as DatasetProvince[]
}

function toStr(v: unknown) {
  return String(v || '').trim()
}

async function createManyInBatches(rows: Array<Record<string, unknown>>) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    await (prisma as any).geoRegion.createMany({
      data: batch,
      skipDuplicates: true,
    })
  }
}

async function main() {
  console.log('Seed geo regions from:', SOURCE)
  console.log('Dataset URL:', DATASET_URL)

  const dataset = await fetchDataset()

  const provinces: Array<Record<string, unknown>> = []
  const wards: Array<Record<string, unknown>> = []

  dataset.forEach((p, provinceIdx) => {
    const provinceCode = toStr(p.Code)
    const provinceName = toStr(p.FullName)
    if (!provinceCode || !provinceName) return

    provinces.push({
      code: provinceCode,
      name: provinceName,
      level: 'province',
      parent_code: null,
      source: SOURCE,
      source_version: SOURCE_VERSION,
      meta_json: { dataset: 'vn_only_simplified', tier: 'province' },
      is_active: true,
      sort_order: provinceIdx + 1,
    })

    const list = Array.isArray(p.Wards) ? p.Wards : []
    list.forEach((w, wardIdx) => {
      const wardCode = toStr(w.Code)
      const wardName = toStr(w.FullName)
      const wardProvinceCode = toStr(w.ProvinceCode) || provinceCode
      if (!wardCode || !wardName) return

      wards.push({
        code: wardCode,
        name: wardName,
        level: 'ward',
        parent_code: wardProvinceCode,
        source: SOURCE,
        source_version: SOURCE_VERSION,
        meta_json: {
          dataset: 'vn_only_simplified',
          tier: 'ward',
          province_code: wardProvinceCode,
        },
        is_active: true,
        sort_order: (provinceIdx + 1) * 100000 + wardIdx + 1,
      })
    })
  })

  await (prisma as any).geoRegion.deleteMany({
    where: {
      source: SOURCE,
    },
  })

  await createManyInBatches(provinces)
  await createManyInBatches(wards)

  console.log(`Done. Provinces: ${provinces.length}, Wards: ${wards.length}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
