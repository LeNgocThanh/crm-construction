import { PrismaClient } from '@prisma/client'
import { postInventoryTransaction } from '../src/lib/inventory/engine'

const prisma = new PrismaClient()

const WAREHOUSES = [
  { code: 'seed_price_hcm', name: 'Kho demo gia HCM', region: 'HCM' },
  { code: 'seed_price_hn', name: 'Kho demo gia HN', region: 'HN' },
]

const SUPPLIERS = [
  { code: 'seed_ncc_alpha', name: 'NCC Demo Alpha' },
  { code: 'seed_ncc_beta', name: 'NCC Demo Beta' },
  { code: 'seed_ncc_gamma', name: 'NCC Demo Gamma' },
]

const MATERIALS = [
  { code: 'seed_thep_hop_40x80', name: 'Thep hop 40x80 demo', unit: 'kg', group: 'ket_cau' },
  { code: 'seed_xi_mang_pc40', name: 'Xi mang PC40 demo', unit: 'kg', group: 'ket_cau' },
  { code: 'seed_day_dien_cv', name: 'Day dien CV demo', unit: 'm', group: 'mep_dien' },
  { code: 'seed_cat_vang', name: 'Cat vang demo', unit: 'm3', group: 'ket_cau' },
]

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

async function upsertWarehouse(input: { code: string; name: string; region: string }) {
  return (prisma as any).warehouse.upsert({
    where: { warehouse_code: input.code },
    update: {
      warehouse_name: input.name,
      region_code: input.region,
      is_active: true,
    },
    create: {
      warehouse_code: input.code,
      warehouse_name: input.name,
      region_code: input.region,
      is_active: true,
    },
  })
}

async function upsertSupplier(input: { code: string; name: string }) {
  const supplier = await (prisma as any).supplier.upsert({
    where: { supplier_code: input.code },
    update: {
      supplier_name: input.name,
      is_active: true,
    },
    create: {
      supplier_code: input.code,
      supplier_name: input.name,
      region_code: 'ALL',
      is_active: true,
    },
  })

  await (prisma as any).supplierProfile.upsert({
    where: { supplier_id: supplier.id },
    update: {
      supplier_type: 'company',
    },
    create: {
      supplier_id: supplier.id,
      supplier_type: 'company',
      payment_terms_days: 0,
      current_debt: BigInt(0),
    },
  })

  return supplier
}

async function upsertMaterial(input: { code: string; name: string; unit: string; group: string }) {
  return (prisma as any).estimationCatalogItem.upsert({
    where: { item_code: input.code },
    update: {
      item_name: input.name,
      item_type: 'material',
      item_group: input.group,
      item_unit: input.unit,
      is_active: true,
    },
    create: {
      item_code: input.code,
      item_name: input.name,
      item_type: 'material',
      item_group: input.group,
      item_unit: input.unit,
      is_active: true,
    },
  })
}

async function upsertSupplierConfigPrice(args: {
  supplierId: string
  materialKey: string
  materialName: string
  unit: string
  price: number
}) {
  await (prisma as any).supplierMaterialPrice.create({
    data: {
      supplier_id: args.supplierId,
      material_key: args.materialKey,
      material_name: args.materialName,
      unit: args.unit,
      region_code: 'ALL',
      price_per_unit: BigInt(Math.round(args.price)),
      currency: 'VND',
      source_note: 'Seed gia cau hinh cho demo bien dong gia',
      valid_from: new Date(),
      is_active: true,
    },
  })
}

async function createDraftTxn(args: {
  txnCode: string
  warehouseId: string
  supplierId?: string | null
  txnType: 'in' | 'out' | 'adjust' | 'transfer_in' | 'transfer_out'
  txnDate: Date
  note: string
  items: Array<{
    catalogItemId?: string | null
    materialKey: string
    materialName: string
    itemUnit: string
    quantity: number
    unitPrice?: number | null
    note?: string | null
  }>
}) {
  return (prisma as any).inventoryTransaction.create({
    data: {
      txn_code: args.txnCode,
      warehouse_id: args.warehouseId,
      supplier_id: args.supplierId || null,
      txn_type: args.txnType,
      txn_date: args.txnDate,
      reference_type: 'manual',
      reference_id: 'seed_inventory_price_tracking',
      status: 'draft',
      note: args.note,
      created_by: 'seed_inventory_price_tracking',
      items: {
        create: args.items.map((item) => ({
          catalog_item_id: item.catalogItemId || null,
          material_key: item.materialKey,
          material_name: item.materialName,
          item_unit: item.itemUnit,
          quantity: item.quantity,
          unit_price: item.unitPrice != null ? BigInt(Math.round(item.unitPrice)) : null,
          line_total: item.unitPrice != null ? BigInt(Math.round(item.quantity * item.unitPrice)) : null,
          note: item.note || null,
        })),
      },
    },
    include: { items: true },
  })
}

async function postDraftTxn(txnId: string) {
  await postInventoryTransaction({
    txnId,
    actorUserId: 'seed_inventory_price_tracking',
    actorUsername: 'seed_inventory_price_tracking',
    allowNegative: false,
  })
}

async function cleanupOldSeed() {
  const txns = await (prisma as any).inventoryTransaction.findMany({
    where: {
      OR: [
        { reference_id: 'seed_inventory_price_tracking' },
        { created_by: 'seed_inventory_price_tracking' },
        { txn_code: { startsWith: 'SEED-PRICE-' } },
      ],
    },
    select: { id: true, warehouse_id: true, items: { select: { material_key: true } } },
  })

  const txnIds = txns.map((row: any) => row.id)
  const affectedWarehouseMaterialPairs = new Set<string>()
  for (const txn of txns) {
    for (const item of txn.items || []) {
      affectedWarehouseMaterialPairs.add(`${String(txn.warehouse_id)}__${String(item.material_key)}`)
    }
  }

  if (txnIds.length) {
    await (prisma as any).inventoryMaterialPriceLog.deleteMany({
      where: {
        OR: [
          { txn_id: { in: txnIds } },
          { created_by: 'seed_inventory_price_tracking' },
        ],
      },
    })
    await (prisma as any).inventoryTransaction.deleteMany({
      where: { id: { in: txnIds } },
    })
  }

  for (const pair of affectedWarehouseMaterialPairs) {
    const [warehouseId, materialKey] = pair.split('__')
    await (prisma as any).inventoryCostCycle.deleteMany({
      where: {
        warehouse_id: warehouseId,
        material_key: materialKey,
      },
    })
    await (prisma as any).warehouseStock.deleteMany({
      where: {
        warehouse_id: warehouseId,
        material_key: materialKey,
      },
    })
  }

  await (prisma as any).supplierMaterialPrice.deleteMany({
    where: {
      source_note: 'Seed gia cau hinh cho demo bien dong gia',
    },
  })
}

async function main() {
  console.log('Seeding inventory price tracking demo...')
  await cleanupOldSeed()

  const [warehouseHcm, warehouseHn] = await Promise.all(WAREHOUSES.map(upsertWarehouse))
  const [supplierAlpha, supplierBeta, supplierGamma] = await Promise.all(SUPPLIERS.map(upsertSupplier))
  const catalogItems = await Promise.all(MATERIALS.map(upsertMaterial))

  const materialMap = new Map(catalogItems.map((row: any) => [String(row.item_code), row]))

  const configSeedRows = [
    { supplier: supplierAlpha, materialKey: 'seed_thep_hop_40x80', price: 24500 },
    { supplier: supplierBeta, materialKey: 'seed_thep_hop_40x80', price: 25200 },
    { supplier: supplierGamma, materialKey: 'seed_thep_hop_40x80', price: 24800 },
    { supplier: supplierAlpha, materialKey: 'seed_xi_mang_pc40', price: 2050 },
    { supplier: supplierBeta, materialKey: 'seed_xi_mang_pc40', price: 1980 },
    { supplier: supplierGamma, materialKey: 'seed_xi_mang_pc40', price: 2100 },
    { supplier: supplierAlpha, materialKey: 'seed_day_dien_cv', price: 18200 },
    { supplier: supplierBeta, materialKey: 'seed_day_dien_cv', price: 17500 },
    { supplier: supplierGamma, materialKey: 'seed_day_dien_cv', price: 18800 },
    { supplier: supplierAlpha, materialKey: 'seed_cat_vang', price: 360000 },
    { supplier: supplierBeta, materialKey: 'seed_cat_vang', price: 348000 },
    { supplier: supplierGamma, materialKey: 'seed_cat_vang', price: 372000 },
  ]

  for (const row of configSeedRows) {
    const item = materialMap.get(row.materialKey)
    if (!item) continue
    await upsertSupplierConfigPrice({
      supplierId: row.supplier.id,
      materialKey: row.materialKey,
      materialName: String(item.item_name),
      unit: String(item.item_unit),
      price: row.price,
    })
  }

  const baseDate = new Date()
  baseDate.setHours(9, 0, 0, 0)
  baseDate.setDate(1)
  baseDate.setMonth(baseDate.getMonth() - 1)

  const txnPlans = [
    {
      code: 'SEED-PRICE-001',
      txnType: 'in' as const,
      warehouseId: warehouseHcm.id,
      supplierId: supplierAlpha.id,
      date: addDays(baseDate, 1),
      note: 'Seed nhap gia dot 1',
      items: [
        { key: 'seed_thep_hop_40x80', qty: 120, price: 24000 },
        { key: 'seed_xi_mang_pc40', qty: 1000, price: 1980 },
        { key: 'seed_day_dien_cv', qty: 500, price: 17100 },
      ],
    },
    {
      code: 'SEED-PRICE-002',
      txnType: 'in' as const,
      warehouseId: warehouseHcm.id,
      supplierId: supplierBeta.id,
      date: addDays(baseDate, 8),
      note: 'Seed nhap gia dot 2',
      items: [
        { key: 'seed_thep_hop_40x80', qty: 80, price: 25200 },
        { key: 'seed_xi_mang_pc40', qty: 600, price: 2070 },
      ],
    },
    {
      code: 'SEED-PRICE-003',
      txnType: 'out' as const,
      warehouseId: warehouseHcm.id,
      supplierId: null,
      date: addDays(baseDate, 11),
      note: 'Seed xuat gan het de tao vong gia',
      items: [
        { key: 'seed_thep_hop_40x80', qty: 200, price: null },
        { key: 'seed_xi_mang_pc40', qty: 1600, price: null },
      ],
    },
    {
      code: 'SEED-PRICE-004',
      txnType: 'in' as const,
      warehouseId: warehouseHcm.id,
      supplierId: supplierGamma.id,
      date: addDays(baseDate, 15),
      note: 'Seed nhap lai sau clear stock',
      items: [
        { key: 'seed_thep_hop_40x80', qty: 90, price: 26700 },
        { key: 'seed_xi_mang_pc40', qty: 700, price: 2140 },
      ],
    },
    {
      code: 'SEED-PRICE-005',
      txnType: 'adjust' as const,
      warehouseId: warehouseHcm.id,
      supplierId: supplierGamma.id,
      date: addDays(baseDate, 17),
      note: 'Seed adjust tang ton co gia',
      items: [
        { key: 'seed_day_dien_cv', qty: 100, price: 18900 },
      ],
    },
    {
      code: 'SEED-PRICE-006',
      txnType: 'in' as const,
      warehouseId: warehouseHn.id,
      supplierId: supplierBeta.id,
      date: addDays(baseDate, 20),
      note: 'Seed HN nhap cat va day dien',
      items: [
        { key: 'seed_cat_vang', qty: 25, price: 342000 },
        { key: 'seed_day_dien_cv', qty: 300, price: 17800 },
      ],
    },
    {
      code: 'SEED-PRICE-007',
      txnType: 'in' as const,
      warehouseId: warehouseHn.id,
      supplierId: supplierAlpha.id,
      date: addDays(baseDate, 24),
      note: 'Seed HN nhap cat gia tang',
      items: [
        { key: 'seed_cat_vang', qty: 18, price: 388000 },
      ],
    },
    {
      code: 'SEED-PRICE-008',
      txnType: 'in' as const,
      warehouseId: warehouseHcm.id,
      supplierId: supplierAlpha.id,
      date: addDays(baseDate, 28),
      note: 'Seed HCM nhap day dien gia giam',
      items: [
        { key: 'seed_day_dien_cv', qty: 400, price: 16500 },
      ],
    },
    {
      code: 'SEED-PRICE-009',
      txnType: 'in' as const,
      warehouseId: warehouseHcm.id,
      supplierId: supplierBeta.id,
      date: addDays(baseDate, 33),
      note: 'Seed thang hien tai nhap thep gia tang tiep',
      items: [
        { key: 'seed_thep_hop_40x80', qty: 60, price: 27900 },
        { key: 'seed_xi_mang_pc40', qty: 500, price: 2160 },
      ],
    },
    {
      code: 'SEED-PRICE-010',
      txnType: 'in' as const,
      warehouseId: warehouseHn.id,
      supplierId: supplierGamma.id,
      date: addDays(baseDate, 37),
      note: 'Seed thang hien tai day dien gia tang manh',
      items: [
        { key: 'seed_day_dien_cv', qty: 250, price: 19600 },
      ],
    },
    {
      code: 'SEED-PRICE-011',
      txnType: 'in' as const,
      warehouseId: warehouseHn.id,
      supplierId: supplierBeta.id,
      date: addDays(baseDate, 40),
      note: 'Seed thang hien tai cat giam gia',
      items: [
        { key: 'seed_cat_vang', qty: 22, price: 336000 },
      ],
    },
    {
      code: 'SEED-PRICE-012',
      txnType: 'in' as const,
      warehouseId: warehouseHcm.id,
      supplierId: supplierAlpha.id,
      date: addDays(baseDate, 42),
      note: 'Seed thang hien tai thep giam nhe, xi mang giam nhe',
      items: [
        { key: 'seed_thep_hop_40x80', qty: 40, price: 27100 },
        { key: 'seed_xi_mang_pc40', qty: 450, price: 2080 },
      ],
    },
    {
      code: 'SEED-PRICE-013',
      txnType: 'in' as const,
      warehouseId: warehouseHn.id,
      supplierId: supplierGamma.id,
      date: addDays(baseDate, 43),
      note: 'Seed thang hien tai day dien giam tu dinh',
      items: [
        { key: 'seed_day_dien_cv', qty: 220, price: 18400 },
      ],
    },
    {
      code: 'SEED-PRICE-014',
      txnType: 'in' as const,
      warehouseId: warehouseHn.id,
      supplierId: supplierAlpha.id,
      date: addDays(baseDate, 44),
      note: 'Seed thang hien tai cat hoi tang lai',
      items: [
        { key: 'seed_cat_vang', qty: 20, price: 351000 },
      ],
    },
  ]

  for (const plan of txnPlans) {
    const txn = await createDraftTxn({
      txnCode: plan.code,
      warehouseId: plan.warehouseId,
      supplierId: plan.supplierId,
      txnType: plan.txnType,
      txnDate: plan.date,
      note: plan.note,
      items: plan.items.map((item) => {
        const catalogItem: any = materialMap.get(item.key)
        if (!catalogItem) throw new Error(`Khong tim thay catalog item ${item.key}`)
        return {
          catalogItemId: catalogItem.id,
          materialKey: String(catalogItem.item_code),
          materialName: String(catalogItem.item_name),
          itemUnit: String(catalogItem.item_unit),
          quantity: item.qty,
          unitPrice: item.price,
          note: 'Seed inventory price tracking',
        }
      }),
    })
    await postDraftTxn(txn.id)
  }

  const logsCount = await (prisma as any).inventoryMaterialPriceLog.count({
    where: { created_by: 'seed_inventory_price_tracking' },
  })
  const cycleCount = await (prisma as any).inventoryCostCycle.count({
    where: {
      OR: [
        { warehouse_id: warehouseHcm.id, material_key: { startsWith: 'seed_' } },
        { warehouse_id: warehouseHn.id, material_key: { startsWith: 'seed_' } },
      ],
    },
  })

  console.log('Seed inventory price tracking done.')
  console.log(`Warehouses: ${warehouseHcm.warehouse_code}, ${warehouseHn.warehouse_code}`)
  console.log(`Suppliers: ${SUPPLIERS.map((row) => row.code).join(', ')}`)
  console.log(`Materials: ${MATERIALS.map((row) => row.code).join(', ')}`)
  console.log(`Price logs created: ${logsCount}`)
  console.log(`Cost cycles created: ${cycleCount}`)
  console.log('Go to /inventory/prices and /inventory to view demo data.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
