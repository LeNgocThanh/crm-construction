import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const rows = [
  { skill_key: 'tho_chinh', skill_name: 'Tho chinh', default_rate: BigInt(600000), sort_order: 10 },
  { skill_key: 'tho_phu', skill_name: 'Tho phu', default_rate: BigInt(500000), sort_order: 20 },
  { skill_key: 'to_truong', skill_name: 'To truong', default_rate: BigInt(800000), sort_order: 30 },
  { skill_key: 'giam_sat_hien_truong', skill_name: 'Giam sat hien truong', default_rate: BigInt(900000), sort_order: 40 },
  { skill_key: 'khac', skill_name: 'Khac', default_rate: null, sort_order: 999 },
]

async function main() {
  for (const row of rows) {
    await prisma.laborSkillLevel.upsert({
      where: { skill_key: row.skill_key },
      update: {
        skill_name: row.skill_name,
        default_rate: row.default_rate,
        sort_order: row.sort_order,
        is_active: true,
      },
      create: {
        ...row,
        is_active: true,
      },
    })
  }
  console.log(`Seeded ${rows.length} labor skill levels`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
