import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MILESTONE_SEED = [
  { key: 'khao_sat', name: 'Khao sat hien trang', sort: 1 },
  { key: 'khai_toan', name: 'Chot khai toan/du toan so bo', sort: 2 },
  { key: 'hop_dong', name: 'Ky hop dong', sort: 3 },
  { key: 'thi_cong_tho', name: 'Thi cong phan tho', sort: 4 },
  { key: 'hoan_thien', name: 'Hoan thien', sort: 5 },
  { key: 'ban_giao', name: 'Ban giao', sort: 6 },
]

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

async function main() {
  const projects = await prisma.constructionProject.findMany({
    select: {
      id: true,
      start_date: true,
      estimated_budget: true,
      contract_value: true,
    },
    orderBy: { created_at: 'desc' },
    take: 200,
  })

  let createdMilestones = 0
  let createdPlans = 0

  for (const p of projects) {
    const msCount = await (prisma as any).projectMilestone.count({ where: { project_id: p.id, is_active: true } })
    if (msCount === 0) {
      const baseDate = p.start_date ? new Date(p.start_date) : new Date()
      for (let i = 0; i < MILESTONE_SEED.length; i++) {
        const m = MILESTONE_SEED[i]
        await (prisma as any).projectMilestone.create({
          data: {
            project_id: p.id,
            milestone_key: m.key,
            milestone_name: m.name,
            status_key: 'pending',
            due_date: addDays(baseDate, (i + 1) * 15),
            sort_order: m.sort,
            is_active: true,
          },
        })
        createdMilestones += 1
      }
    }

    const ppCount = await (prisma as any).projectPaymentPlan.count({ where: { project_id: p.id, is_active: true } })
    if (ppCount === 0) {
      const budget = Number(p.contract_value || p.estimated_budget || 0)
      const baseDate = p.start_date ? new Date(p.start_date) : new Date()
      const plans = [
        { name: 'Dot 1 - Tam ung', pct: 20, day: 0 },
        { name: 'Dot 2 - Thi cong tho', pct: 30, day: 30 },
        { name: 'Dot 3 - Hoan thien', pct: 30, day: 60 },
        { name: 'Dot 4 - Ban giao', pct: 20, day: 90 },
      ]
      for (let i = 0; i < plans.length; i++) {
        const x = plans[i]
        const amount = budget > 0 ? Math.round((budget * x.pct) / 100) : null
        await (prisma as any).projectPaymentPlan.create({
          data: {
            project_id: p.id,
            milestone_name: x.name,
            due_date: addDays(baseDate, x.day),
            amount: amount != null ? BigInt(amount) : null,
            plan_percent: x.pct,
            status: 'planned',
            sort_order: i + 1,
            is_active: true,
          },
        })
        createdPlans += 1
      }
    }
  }

  console.log(`Seeded project phase1 data: milestones=${createdMilestones}, payment_plans=${createdPlans}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

