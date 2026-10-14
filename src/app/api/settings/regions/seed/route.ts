import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

const DATASET_URL =
  'https://raw.githubusercontent.com/thanglequoc/vietnamese-provinces-database/master/json/vn_only_simplified_json_generated_data_vn_units_minified.json'
const SOURCE = 'thanglequoc/vietnamese-provinces-database'
const SOURCE_VERSION = 'master'

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

function toStr(v: unknown) {
  return String(v || '').trim()
}

export async function POST() {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const res = await fetch(DATASET_URL)
  if (!res.ok) {
    return NextResponse.json({ error: `Khong tai duoc dataset (${res.status})` }, { status: 400 })
  }
  const json = (await res.json()) as DatasetProvince[]
  if (!Array.isArray(json)) {
    return NextResponse.json({ error: 'Dataset khong dung dinh dang' }, { status: 400 })
  }

  const provinces: any[] = []
  const wards: any[] = []

  json.forEach((p, provinceIdx) => {
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

  await (db as any).geoRegion.deleteMany({ where: { source: SOURCE } })

  const rows = [...provinces, ...wards]
  const batch = 500
  for (let i = 0; i < rows.length; i += batch) {
    await (db as any).geoRegion.createMany({
      data: rows.slice(i, i + batch),
      skipDuplicates: true,
    })
  }

  return NextResponse.json({
    ok: true,
    data: {
      source: SOURCE,
      source_version: SOURCE_VERSION,
      provinces: provinces.length,
      wards: wards.length,
      total: rows.length,
    },
  })
}
