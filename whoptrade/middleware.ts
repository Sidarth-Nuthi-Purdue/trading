import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';
import { createServerClient } from '@supabase/ssr';

// Public paths that don't require auth
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/api/auth/clear-cookies',
  '/api/oauth/callback',
  '/api/oauth/init',
  '/_next',
  '/favicon.ico'
];

// Protected paths that require auth
const PROTECTED_PATHS = [
  '/dashboard',
  '/trading',
  '/portfolio',
  '/settings',
  '/api/trading'
];

// This middleware handles authentication and caching behavior
export async function middleware(request: NextRequest) {
  const res = await updateSession(request);
  
  // Get the pathname
  const pathname = request.nextUrl.pathname;
  
  // Create supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: (name, value, options) => {
          res.cookies.set({ name, value, ...options });
        },
        remove: (name, options) => {
          res.cookies.delete({ name, ...options });
        },
      },
    }
  );
  
  try {
    // Get the current session (already refreshed by updateSession)
    const { data: { session } } = await supabase.auth.getSession();
    
    // Clone URL for redirects if needed
    const url = request.nextUrl.clone();
    
    // Protection for dashboard routes - must be authenticated
    if (pathname.startsWith('/dashboard') && !session) {
      console.log("Middleware: redirecting unauthenticated user from dashboard to login");
      
      // Add timestamp for cache busting
      url.pathname = '/login';
      url.searchParams.set('t', Date.now().toString());
      
      return NextResponse.redirect(url);
    }
    
    // Redirect from login page when already authenticated
    if ((pathname === '/login' || pathname === '/register') && session) {
      console.log("Middleware: redirecting authenticated user from auth page to dashboard");
      
      // Add timestamp for cache busting
      url.pathname = '/dashboard/trading';
      url.searchParams.set('t', Date.now().toString());
      
      return NextResponse.redirect(url);
    }
  } catch (error) {
    console.error("Middleware auth error:", error);
    // On auth error, continue and let page handle authentication
  }
  
  return res;
}

// Apply middleware to auth and dashboard routes
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/register',
  ],
}; 