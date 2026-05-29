import { NextRequest, NextResponse } from 'next/server';

// Routes that require authentication
const protectedRoutes = ['/upload', '/dashboard'];

// Routes that are public
const publicRoutes = ['/', '/auth/login', '/auth/signup'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Check if user is authenticated by looking for the user cookie/session
  // Since we're using localStorage on the client, we'll need to check on the server side
  // For now, we'll implement a basic check
  
  // Note: In a real application, you'd validate a session token/JWT here
  // This is a simplified version that works with client-side auth

  const response = NextResponse.next();

  // Apply additional security headers at the middleware level
  // (These supplement the ones in next.config.ts)
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Block scraping / bot detection
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  
  // Disable caching of sensitive pages
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/upload') || pathname.startsWith('/admin')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)'],
};