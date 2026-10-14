import { PrismaClient } from '@prisma/client'
import { SALES_BRIEF_HEAT_CONFIG_SEEDS } from '../src/lib/estimate/sales-brief-heat'

const db = new PrismaClient()

async function main() {
  const prismaAny = db as any
  for (const item of SALES_BRIEF_HEAT_CONFIG_SEEDS) {
    await prismaAny.salesBriefHeatConfig.upsert({
      where: { config_key: item.config_key },
      update: {
        config_name: item.config_name,
        group_name: item.group_name,
        value_type: item.value_type,
        description: item.description,
        sort_order: item.sort_order,
        is_active: true,
        is_locked: true,
      },
      create: {
        config_key: item.config_key,
        config_name: item.config_name,
        group_name: item.group_name,
        value_type: item.value_type,
        config_value: item.config_value,
        description: item.description,
        sort_order: item.sort_order,
        is_active: true,
        is_locked: true,
      },
    })
  }
  console.log(`Seeded ${SALES_BRIEF_HEAT_CONFIG_SEEDS.length} sales brief heat configs.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
