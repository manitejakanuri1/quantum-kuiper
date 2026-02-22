import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,

  // Note: removeConsole only works with Babel/SWC, not Turbopack.
  // Server-side console.log only appears in server logs (not client-visible).

  experimental: {
    optimizeCss: true,
    // Enable React 19 optimizations
    optimizePackageImports: ['lucide-react'],
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Performance optimizations
  poweredByHeader: false,

  // Turbopack configuration (Next.js 16+ default) - Enables automatic optimizations
  turbopack: {},

  // Security + caching headers
  async headers() {
    // Shared security headers (applied to all routes)
    const securityHeaders = [
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), geolocation=(), payment=(), usb=(), microphone=(self)',
      },
    ];

    // CSP directives shared between dashboard and widget
    const cspBase = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://vercel.live",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.deepgram.com wss://api.deepgram.com https://api.simli.ai wss://api.simli.ai https://*.livekit.cloud wss://*.livekit.cloud https://api.fish.audio https://vercel.live",
      "frame-src 'self' https://vercel.live",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ];

    return [
      // Widget routes — loaded in iframes on customer websites
      {
        source: '/widget/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Content-Security-Policy',
            value: [...cspBase, "frame-ancestors *"].join('; '),
          },
        ],
      },
      // All other routes — prevent clickjacking
      {
        source: '/((?!widget/).*)',
        headers: [
          ...securityHeaders,
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Content-Security-Policy',
            value: [...cspBase, "frame-ancestors 'self'"].join('; '),
          },
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
