import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function upsertSupplier(code: string, name: string, region = 'ALL') {
  const s = await (prisma as any).supplier.upsert({
    where: { supplier_code: code },
    update: { supplier_name: name, region_code: region, is_active: true },
    create: { supplier_code: code, supplier_name: name, region_code: region, is_active: true },
  })
  await (prisma as any).supplierProfile.upsert({
    where: { supplier_id: s.id },
    update: {},
    create: {
      supplier_id: s.id,
      supplier_type: 'company',
      payment_terms_days: 0,
      current_debt: BigInt(0),
    },
  })
  return s
}

async function main() {
  const sDefault = await upsertSupplier('ncc_default', 'NCC Mặc định', 'ALL')
  const sBasic = await upsertSupplier('ncc_basic', 'NCC Gói Cơ bản', 'ALL')
  const sPremium = await upsertSupplier('ncc_premium', 'NCC Gói Cao cấp', 'ALL')

  const baseMaterials = await prisma.estimationMaterialPrice.findMany({
    where: { is_active: true, OR: [{ region_code: 'ALL' }, { region_code: null }] },
    orderBy: [{ valid_from: 'desc' }, { created_at: 'desc' }],
    take: 30,
  })

  const uniqueByMaterial = new Map<string, (typeof baseMaterials)[number]>()
  for (const row of baseMaterials) {
    if (!uniqueByMaterial.has(row.material_key)) uniqueByMaterial.set(row.material_key, row)
  }

  for (const row of Array.from(uniqueByMaterial.values())) {
    const basePrice = Number(row.price_per_unit || 0)
    if (!basePrice || basePrice <= 0) continue

    const variants = [
      { supplier: sDefault, price: basePrice, note: 'Seed từ estimation_material_prices' },
      { supplier: sBasic, price: Math.max(1, Math.round(basePrice * 0.96)), note: 'Seed basic ~ -4%' },
      { supplier: sPremium, price: Math.max(1, Math.round(basePrice * 1.08)), note: 'Seed premium ~ +8%' },
    ]

    for (const v of variants) {
      const existed = await (prisma as any).supplierMaterialPrice.findFirst({
        where: {
          supplier_id: v.supplier.id,
          material_key: row.material_key,
          region_code: row.region_code || 'ALL',
          is_active: true,
        },
        orderBy: [{ valid_from: 'desc' }],
      })

      if (existed) continue

      await (prisma as any).supplierMaterialPrice.create({
        data: {
          supplier_id: v.supplier.id,
          material_key: row.material_key,
          material_name: row.material_name,
          unit: row.unit,
          region_code: row.region_code || 'ALL',
          price_per_unit: BigInt(v.price),
          currency: 'VND',
          source_note: v.note,
          valid_from: new Date(),
          is_active: true,
        },
      })
    }
  }

  console.log('Seed supplier + supplier prices done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
