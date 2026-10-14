import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const STATUSES = [
  { status_key: 'pending', status_name: 'Chua bat dau', sort_order: 1 },
  { status_key: 'in_progress', status_name: 'Dang thuc hien', sort_order: 2 },
  { status_key: 'completed', status_name: 'Da hoan thanh', sort_order: 3 },
  { status_key: 'blocked', status_name: 'Bi chan', sort_order: 4 },
  { status_key: 'cancelled', status_name: 'Da huy', sort_order: 5 },
]

async function main() {
  for (const s of STATUSES) {
    await (prisma as any).projectMilestoneStatus.upsert({
      where: { status_key: s.status_key },
      update: {
        status_name: s.status_name,
        sort_order: s.sort_order,
        is_active: true,
      },
      create: {
        status_key: s.status_key,
        status_name: s.status_name,
        sort_order: s.sort_order,
        is_active: true,
      },
    })
  }
  console.log(`Seeded ${STATUSES.length} project milestone statuses`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

