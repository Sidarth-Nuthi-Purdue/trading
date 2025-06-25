import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  productionBrowserSourceMaps: true,
  poweredByHeader: false,
  reactStrictMode: true,
  
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.whop.com https://whop.com http://localhost:3000;",
          },
          {
            key: 'X-Frame-Options',
            value: 'ALLOW-FROM https://whop.com',
          },
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        // Add stricter cache control for authentication-related routes
        source: '/(login|register|dashboard|api/auth/:path*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, max-age=0, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store',
          },
          {
            key: 'Vary',
            value: '*',
          },
        ],
      },
      {
        // Special handling for API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, max-age=0, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'X-Middleware-Cache',
            value: 'no-cache',
          },
        ],
      },
    ];
  },
  
  // Fixed experimental options based on Next.js 15
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
};

export default nextConfig;
