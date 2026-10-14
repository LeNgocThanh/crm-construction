import { PrismaClient } from '@prisma/client'
import {
  ACCESS_MODULE_SEEDS,
  ACCESS_PERMISSION_SEEDS,
  ACCESS_RESOURCE_SEEDS,
  ACCESS_ROLE_PERMISSION_SEEDS,
  ACCESS_ROLE_SEEDS,
} from '../src/lib/permissions'

const db = new PrismaClient()

async function main() {
  const prismaAny = db as any
  const moduleIdByKey = new Map<string, string>()
  const resourceIdByKey = new Map<string, string>()
  const permissionIdByKey = new Map<string, string>()
  const roleIdByKey = new Map<string, string>()

  for (const item of ACCESS_MODULE_SEEDS) {
    const row = await prismaAny.accessModule.upsert({
      where: { module_key: item.module_key },
      update: {
        module_name: item.module_name,
        description: item.description || null,
        is_active: true,
        sort_order: item.sort_order,
      },
      create: {
        module_key: item.module_key,
        module_name: item.module_name,
        description: item.description || null,
        is_active: true,
        sort_order: item.sort_order,
      },
    })
    moduleIdByKey.set(item.module_key, row.id)
  }

  for (const item of ACCESS_RESOURCE_SEEDS) {
    const moduleId = moduleIdByKey.get(item.module_key)
    if (!moduleId) continue
    const row = await prismaAny.accessResource.upsert({
      where: { resource_key: item.resource_key },
      update: {
        resource_name: item.resource_name,
        module_id: moduleId,
        description: item.description || null,
        is_active: true,
        sort_order: item.sort_order,
      },
      create: {
        resource_key: item.resource_key,
        resource_name: item.resource_name,
        module_id: moduleId,
        description: item.description || null,
        is_active: true,
        sort_order: item.sort_order,
      },
    })
    resourceIdByKey.set(item.resource_key, row.id)
  }

  for (const item of ACCESS_PERMISSION_SEEDS) {
    const moduleId = moduleIdByKey.get(item.module_key)
    if (!moduleId) continue
    const resourceId = item.resource_key ? resourceIdByKey.get(item.resource_key) || null : null
    const row = await prismaAny.accessPermission.upsert({
      where: { permission_key: item.permission_key },
      update: {
        permission_name: item.permission_name,
        module_id: moduleId,
        resource_id: resourceId,
        action_key: item.action_key,
        description: item.description || null,
        is_active: true,
        sort_order: item.sort_order,
      },
      create: {
        permission_key: item.permission_key,
        permission_name: item.permission_name,
        module_id: moduleId,
        resource_id: resourceId,
        action_key: item.action_key,
        description: item.description || null,
        is_active: true,
        sort_order: item.sort_order,
      },
    })
    permissionIdByKey.set(item.permission_key, row.id)
  }

  for (const item of ACCESS_ROLE_SEEDS) {
    const row = await prismaAny.accessRole.upsert({
      where: { role_key: item.role_key },
      update: {
        role_name: item.role_name,
        description: item.description || null,
        is_active: true,
        is_system: true,
        sort_order: item.sort_order,
      },
      create: {
        role_key: item.role_key,
        role_name: item.role_name,
        description: item.description || null,
        is_active: true,
        is_system: true,
        sort_order: item.sort_order,
      },
    })
    roleIdByKey.set(item.role_key, row.id)
  }

  for (const [roleKey, permissionKeys] of Object.entries(ACCESS_ROLE_PERMISSION_SEEDS)) {
    const roleId = roleIdByKey.get(roleKey)
    if (!roleId) continue
    for (const permissionKey of permissionKeys) {
      const permissionId = permissionIdByKey.get(permissionKey)
      if (!permissionId) continue
      await prismaAny.accessRolePermission.upsert({
        where: {
          role_id_permission_id: {
            role_id: roleId,
            permission_id: permissionId,
          },
        },
        update: {},
        create: {
          role_id: roleId,
          permission_id: permissionId,
        },
      })
    }
  }

  const users = await db.user.findMany({
    select: { id: true, role: true },
  })

  for (const user of users) {
    const roleId = roleIdByKey.get(String(user.role || '').trim())
    if (!roleId) continue
    await prismaAny.userRoleMembership.upsert({
      where: {
        user_id_role_id: {
          user_id: user.id,
          role_id: roleId,
        },
      },
      update: {
        is_primary: true,
      },
      create: {
        user_id: user.id,
        role_id: roleId,
        is_primary: true,
      },
    })
  }

  console.log(`Seeded ${ACCESS_MODULE_SEEDS.length} modules, ${ACCESS_RESOURCE_SEEDS.length} resources, ${ACCESS_PERMISSION_SEEDS.length} permissions, ${ACCESS_ROLE_SEEDS.length} roles.`)
  console.log(`Synced ${users.length} users from legacy users.role to user_role_memberships.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
