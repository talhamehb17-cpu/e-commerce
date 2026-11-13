import { NextResponse } from 'next/server';

/**
 * Exposes the request pathname to server components (used by the admin shell)
 * and keeps admin routes out of search engines.
 */
export function middleware(request) {
  const headers = new Headers(request.headers);
  headers.set('x-pathname', request.nextUrl.pathname);
  const res = NextResponse.next({ request: { headers } });
  if (request.nextUrl.pathname.startsWith('/admin')) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return res;
}

export const config = {
  matcher: ['/admin/:path*'],
};
