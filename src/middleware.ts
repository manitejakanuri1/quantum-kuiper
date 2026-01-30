/**
 * Next.js Middleware for security headers and request processing
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security Headers
  const headers = response.headers;

  // Prevent clickjacking
  headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  headers.set('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection (legacy browsers)
  headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy (disable unused features)
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  // Content Security Policy
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' data: https: blob:;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.deepgram.com https://api.openai.com;
    media-src 'self' https: blob:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  headers.set('Content-Security-Policy', cspHeader);

  // HSTS (HTTP Strict Transport Security) - only in production with HTTPS
  if (process.env.NODE_ENV === 'production') {
    headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  // CORS headers for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Allow credentials
    headers.set('Access-Control-Allow-Credentials', 'true');

    // Allow specific origin (configure based on your frontend domain)
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:8080',
      process.env.NEXT_PUBLIC_APP_URL,
    ].filter(Boolean);

    if (origin && allowedOrigins.includes(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
    }

    // Allow specific methods
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

    // Allow specific headers
    headers.set(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );
  }

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers,
    });
  }

  return response;
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
