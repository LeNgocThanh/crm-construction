// src/lib/auth.ts — V2.0: dùng Prisma thay Supabase
import { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import type { UserRole } from '@/types'
import { derivePrimaryRoleKey } from '@/lib/user-profiles'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages:   { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text'     },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const user = await db.user.findFirst({
          where: {
            username:  credentials.username,
            is_active: true,
          },
          include: {
            role_memberships: {
              where: {
                role: { is_active: true },
              },
              orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
              include: {
                role: {
                  select: {
                    role_key: true,
                  },
                },
              },
            },
          },
        })

        if (!user) return null

        const isValid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!isValid) return null

        const primaryRoleKey = (user.role_memberships || [])
          .map((membership: any) => String(membership?.role?.role_key || '').trim())
          .find(Boolean) || ''
        const roleKeys = (user.role_memberships || [])
          .map((membership: any) => String(membership?.role?.role_key || '').trim())
          .filter(Boolean)

        await db.user.update({
          where: { id: user.id },
          data: { last_login_at: new Date() },
        })

        return {
          id:         user.id,
          username:   user.username,
          role:       primaryRoleKey as UserRole,
          role_keys:  roleKeys,
          name:       user.full_name || user.username,
          email:      user.email || null,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id         = user.id
        token.username   = (user as any).username
        token.role       = (user as any).role
        token.role_keys  = (user as any).role_keys || []
      }
      if (token.id) {
        const currentUser = await db.user.findUnique({
          where: { id: String(token.id) },
          select: {
            role_memberships: {
              where: {
                role: { is_active: true },
              },
              orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
              select: {
                role: {
                  select: {
                    role_key: true,
                  },
                },
              },
            },
          },
        })
        const roleKeys = (currentUser?.role_memberships || [])
          .map((membership: any) => String(membership?.role?.role_key || '').trim())
          .filter(Boolean)
        token.role = (derivePrimaryRoleKey(currentUser) || '') as UserRole
        token.role_keys = roleKeys
      }
      return token
    },
    async session({ session, token }) {
      session.user.id         = token.id
      session.user.username   = token.username
      session.user.role       = token.role
      session.user.role_keys  = Array.isArray((token as any).role_keys) ? (token as any).role_keys : []
      return session
    },
  },
}
