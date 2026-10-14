// src/lib/db/providers/prisma.ts
// LOCAL provider — PostgreSQL qua Prisma ORM

import { PrismaClient } from '@prisma/client'

// Singleton pattern cho Next.js dev (tránh too many connections)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['error', 'warn']
      : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
