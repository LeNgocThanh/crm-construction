import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const USERNAME = 'admin'
const PASSWORD = 'Admin@2026'
const PHONE = '0900000000'
const GROUP_KEY = 'ban_giam_doc'
const GROUP_NAME = 'Ban Giám đốc'
const ACCOUNT_TYPE_KEY = 'internal_user'

async function ensureBaseGroup() {
  return prisma.group.upsert({
    where: { group_key: GROUP_KEY },
    update: {
      group_name: GROUP_NAME,
      is_active: true,
    },
    create: {
      group_key: GROUP_KEY,
      group_name: GROUP_NAME,
      is_active: true,
    },
  })
}

async function ensureInternalAccountType() {
  return (prisma as any).accountType.upsert({
    where: { account_type_key: ACCOUNT_TYPE_KEY },
    update: {
      account_type_name: 'Nội bộ',
      description: 'Tài khoản nội bộ của công ty',
      is_active: true,
    },
    create: {
      account_type_key: ACCOUNT_TYPE_KEY,
      account_type_name: 'Nội bộ',
      description: 'Tài khoản nội bộ của công ty',
      is_active: true,
    },
  })
}

async function main() {
  const existing = await prisma.user.findUnique({ where: { username: USERNAME } })
  const group = await ensureBaseGroup()
  const accountType = await ensureInternalAccountType()

  if (existing) {
    const hasGroup = await prisma.userGroupMembership.findFirst({
      where: { user_id: existing.id, group_id: group.id },
      select: { id: true },
    })
    if (!hasGroup) {
      await prisma.userGroupMembership.create({
        data: {
          user_id: existing.id,
          group_id: group.id,
          is_primary: true,
        },
      })
    }

    const hasAccountType = await (prisma as any).userAccountTypeMembership.findFirst({
      where: { user_id: existing.id, account_type_id: accountType.id },
      select: { id: true },
    })
    if (!hasAccountType) {
      await (prisma as any).userAccountTypeMembership.create({
        data: {
          user_id: existing.id,
          account_type_id: accountType.id,
          is_primary: true,
        },
      })
    }

    console.log(`User "${USERNAME}" đã tồn tại, đã đồng bộ group và account type.`)
    return
  }

  const hash = await bcrypt.hash(PASSWORD, 10)
  const user = await prisma.user.create({
    data: {
      username: USERNAME,
      password_hash: hash,
      phone: PHONE,
      role: 'admin',
      is_active: true,
    },
  })

  await prisma.userGroupMembership.create({
    data: {
      user_id: user.id,
      group_id: group.id,
      is_primary: true,
    },
  })

  await (prisma as any).userAccountTypeMembership.create({
    data: {
      user_id: user.id,
      account_type_id: accountType.id,
      is_primary: true,
    },
  })

  console.log('Admin created!')
  console.log(`   id:       ${user.id}`)
  console.log(`   username: ${USERNAME}`)
  console.log(`   password: ${PASSWORD}`)
  console.log('   Hãy đổi mật khẩu ngay sau khi đăng nhập!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
