import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: { signIn: '/login' },
})

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/customers/:path*',
    '/logs/:path*',
    '/projects/:path*',
    '/estimates/:path*',
    '/pipeline/:path*',
    '/analytics/:path*',
    '/kpi/:path*',
    '/reports/:path*',
    '/users/:path*',
    '/conversations/:path*',
    '/settings/:path*',
  ],
}
