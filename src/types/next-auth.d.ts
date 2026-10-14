import { DefaultSession } from 'next-auth'

import type { UserRole } from '@/types'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      username: string
      role: UserRole
      role_keys: string[]
    } & DefaultSession['user']
  }

  interface User {
    id: string
    username: string
    role: UserRole
    role_keys?: string[]
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    username: string
    role: UserRole
    role_keys?: string[]
  }
}
