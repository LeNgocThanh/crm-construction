import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const items = [
    {
      account_type_key: 'internal_user',
      account_type_name: 'Nội bộ',
      description: 'Tài khoản nội bộ của công ty: sales, manager, admin, kế toán, kỹ thuật...',
      is_active: true,
    },
    {
      account_type_key: 'investor',
      account_type_name: 'Chủ đầu tư',
      description: 'Tài khoản phía chủ đầu tư, dùng cho portal xem dự án và báo cáo.',
      is_active: true,
    },
    {
      account_type_key: 'partner',
      account_type_name: 'Đối tác',
      description: 'Tài khoản đối tác phối hợp dự án hoặc hỗ trợ bán hàng.',
      is_active: true,
    },
    {
      account_type_key: 'supplier',
      account_type_name: 'Nhà cung cấp',
      description: 'Tài khoản nhà cung cấp vật tư, dịch vụ hoặc đơn vị hỗ trợ.',
      is_active: true,
    },
    {
      account_type_key: 'subcontractor',
      account_type_name: 'Thầu phụ',
      description: 'Tài khoản đơn vị thầu phụ hoặc tổ đội thi công ngoài công ty.',
      is_active: true,
    },
  ]

  for (const item of items) {
    await (db as any).accountType.upsert({
      where: { account_type_key: item.account_type_key },
      update: {
        account_type_name: item.account_type_name,
        description: item.description,
        is_active: item.is_active,
      },
      create: item,
    })
  }

  console.log(`Seeded ${items.length} account types.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
