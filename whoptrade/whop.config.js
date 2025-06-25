/**
 * Whop configuration for OAuth and API interactions
 * @type {import('@whop-apps/sdk').WhopConfig}
 */
module.exports = {
  // Your Whop app credentials
  app: {
    id: process.env.WHOP_APP_ID || 'app_y5KuCD6iLO1Jxs',
    secret: process.env.WHOP_CLIENT_SECRET || '1Sval759S_dDHrd-mDGdMz7rt6uyh-rWYQu-m0_rSCk',
  },
  
  // The callback URL when OAuth completes - must match what's configured in Whop
  redirect_uri: process.env.REDIRECT_URI || 'http://localhost:3000/api/oauth/callback',
  
  // Route patterns for middleware checks
  routes: {
    // These routes are protected and require authentication
    protected: ['/api/user/**'],
    
    // These routes don't require authentication
    public: [
      '/login', 
      '/api/auth/whop/**', 
      '/api/oauth/**', 
      '/', 
      '/dashboard', 
      '/dashboard/**', 
      '/test-theme',
      '/experiences',
      '/experiences/**',
      '/api/experiences/**'
    ],
  },
  
  // Configuration for the Whop dev proxy
  proxy: {
    port: 55314, // Default port for the proxy
    routes: {
      // Routes to proxy through the Whop proxy
      '/api/auth/whop': {
        target: 'http://localhost:3000/api/auth/whop',
        changeOrigin: true,
      },
      '/api/oauth/callback': {
        target: 'http://localhost:3000/api/oauth/callback',
        changeOrigin: true,
      },
      '/experiences': {
        target: 'http://localhost:3000/experiences',
        changeOrigin: true,
      },
      '/api/experiences': {
        target: 'http://localhost:3000/api/experiences',
        changeOrigin: true,
      },
    }
  },
  access_token_ttl: 86400, // 24 hours
  auth_cookie_options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 86400, // 24 hours
    path: '/',
    sameSite: 'lax',
  },
}; 