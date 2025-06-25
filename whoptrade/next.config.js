/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Remove swcMinify as it's deprecated in Next.js 15
  experimental: {
    // Update serverActions configuration for Next.js 15
    serverActions: {
      bodySizeLimit: '2mb',
      allowedOrigins: ['localhost:3000', 'localhost:3001'],
    },
  },
  // Improve caching behavior
  headers: async () => {
    return [
      {
        source: '/:path*',
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
        ],
      },
    ];
  },
  // Set dynamic rendering as default
  output: 'standalone',
  
  // Allow Alpaca API domain
  async rewrites() {
    return [
      {
        source: '/api/alpaca-proxy/:path*',
        destination: 'https://paper-api.alpaca.markets/:path*',
      },
      {
        source: '/api/alpaca-data-proxy/:path*',
        destination: 'https://data.alpaca.markets/:path*',
      },
    ];
  },
  
  // Environment variables to make available in the browser
  env: {
    NEXT_PUBLIC_ALPACA_PAPER_API_KEY: process.env.ALPACA_API_KEY,
    NEXT_PUBLIC_ALPACA_PAPER_API_SECRET: process.env.ALPACA_API_SECRET,
    NEXT_PUBLIC_ALPACA_API_BASE_URL: process.env.ALPACA_BASE_URL,
    NEXT_PUBLIC_ALPACA_DATA_BASE_URL: process.env.ALPACA_DATA_BASE_URL,
    ALPACA_PAPER: 'true',
  },
};

module.exports = nextConfig; 