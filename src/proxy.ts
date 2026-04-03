import { withAuth } from 'next-auth/middleware';

export default withAuth({});

export const config = {
  matcher: [
    '/',
    '/assets/:path*',
    '/work-orders/:path*',
    '/inventory/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/users/:path*'
  ]
};
