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
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ];

    return [
      // Widget routes — loaded in iframes on customer websites, so no X-Frame-Options
      {
        source: '/widget/:path*',
        headers: securityHeaders,
      },
      // All other routes — prevent clickjacking with SAMEORIGIN
      {
        source: '/((?!widget/).*)',
        headers: [
          ...securityHeaders,
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
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
