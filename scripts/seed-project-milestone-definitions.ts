import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFINITIONS = [
  {
    key: 'khao_sat_hien_trang',
    name: 'Khảo sát hiện trạng',
    defaultStatus: 'pending',
    sort: 1,
    description: 'Khảo sát thực tế công trình, chốt dữ liệu đầu vào ban đầu.',
  },
  {
    key: 'chot_khai_toan',
    name: 'Chốt khái toán sơ bộ',
    defaultStatus: 'pending',
    sort: 2,
    description: 'Chốt phương án khái toán/dự toán sơ bộ trước khi thương thảo.',
  },
  {
    key: 'ky_hop_dong',
    name: 'Ký hợp đồng',
    defaultStatus: 'pending',
    sort: 3,
    description: 'Ký hợp đồng thi công với chủ đầu tư.',
  },
  {
    key: 'thi_cong_mong',
    name: 'Thi công móng',
    defaultStatus: 'pending',
    sort: 4,
    description: 'Triển khai và nghiệm thu phần móng.',
  },
  {
    key: 'thi_cong_phan_tho',
    name: 'Thi công phần thô',
    defaultStatus: 'pending',
    sort: 5,
    description: 'Thi công kết cấu, tường, sàn, cột và các hạng mục phần thô.',
  },
  {
    key: 'hoan_thien',
    name: 'Hoàn thiện',
    defaultStatus: 'pending',
    sort: 6,
    description: 'Thi công hoàn thiện nội thất, điện nước, sơn bả.',
  },
  {
    key: 'nghiem_thu',
    name: 'Nghiệm thu',
    defaultStatus: 'pending',
    sort: 7,
    description: 'Nghiệm thu chất lượng và khối lượng theo hợp đồng.',
  },
  {
    key: 'ban_giao',
    name: 'Bàn giao',
    defaultStatus: 'pending',
    sort: 8,
    description: 'Bàn giao công trình cho chủ đầu tư.',
  },
  {
    key: 'bao_hanh',
    name: 'Bảo hành',
    defaultStatus: 'pending',
    sort: 9,
    description: 'Theo dõi, xử lý yêu cầu bảo hành sau bàn giao.',
  },
]

async function main() {
  // Ensure default milestone statuses exist
  const statusKeys = ['pending', 'in_progress', 'completed', 'blocked', 'cancelled']
  for (const key of statusKeys) {
    const existed = await (prisma as any).projectMilestoneStatus.findUnique({ where: { status_key: key } })
    if (!existed) {
      console.warn(`[skip] thiếu status_key=${key}. Hãy chạy seed:project-milestones trước.`)
    }
  }

  let created = 0
  let updated = 0
  for (const d of DEFINITIONS) {
    const existed = await (prisma as any).projectMilestoneDefinition.findUnique({
      where: { definition_key: d.key },
      select: { id: true },
    })
    await (prisma as any).projectMilestoneDefinition.upsert({
      where: { definition_key: d.key },
      create: {
        definition_key: d.key,
        definition_name: d.name,
        default_status_key: d.defaultStatus,
        sort_order: d.sort,
        description: d.description,
        is_active: true,
      },
      update: {
        definition_name: d.name,
        default_status_key: d.defaultStatus,
        sort_order: d.sort,
        description: d.description,
        is_active: true,
      },
    })
    if (existed) updated += 1
    else created += 1
  }

  console.log(`Seeded project milestone definitions: created=${created}, updated=${updated}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

