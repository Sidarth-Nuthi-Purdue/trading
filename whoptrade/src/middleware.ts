import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// List of routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/practice-trading',
];

// Routes that should not be redirected to login even if unauthenticated
const publicRoutes = [
  '/api',  // API routes
  '/_next', // Next.js assets
  '/favicon.ico',
  '/setup',
  '/experiences', // Whop experiences
  '/test-whop-auth', // Test page for Whop auth
];

export async function middleware(request: NextRequest) {
  // Initialize response
  let response = NextResponse.next();
  
  // Add CORS headers for API routes
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');
  if (isApiRoute) {
    // Set CORS headers
    response = NextResponse.next({
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // Handle preflight requests
  if (request.method === 'OPTIONS' && isApiRoute) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // Check if we're in a cross-site iframe context by looking for specific headers
    const secFetchDest = request.headers.get('sec-fetch-dest');
    const secFetchSite = request.headers.get('sec-fetch-site');
    const isInIframe = secFetchDest === 'iframe' || secFetchSite === 'cross-site';
    
    // Check for Whop token in cookies or URL params
    const whopAccessToken = request.cookies.get('whop_access_token');
    const whopDevUserToken = request.cookies.get('whop_dev_user_token');
    const whopDevUserTokenParam = request.nextUrl.searchParams.get('whop-dev-user-token');
    
    // Determine if this is a Whop iframe context
    const isWhopContext = isInIframe || whopAccessToken || whopDevUserToken || whopDevUserTokenParam;
    
    // If we have a Whop dev token in URL but not in cookie, set it
    if (whopDevUserTokenParam && !whopDevUserToken) {
      response.cookies.set({
        name: 'whop_dev_user_token',
        value: whopDevUserTokenParam,
        path: '/',
        sameSite: 'none',
        secure: true,
        maxAge: 60 * 60 * 24 // 24 hours
      });
    }
    
    // Create Supabase client with appropriate cookie settings
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return request.cookies.get(name)?.value;
          },
          set(name, value, options) {
            // Use different cookie settings based on context
            response.cookies.set({
              name,
              value,
              ...options,
              // Use SameSite=None for Whop iframe context
              sameSite: isWhopContext ? 'none' : 'lax',
              // Always use Secure for SameSite=None cookies
              secure: isWhopContext ? true : process.env.NODE_ENV === 'production',
              path: '/'
            });
          },
          remove(name, options) {
            response.cookies.set({
              name,
              value: '',
              ...options,
              // Use SameSite=None for Whop iframe context
              sameSite: isWhopContext ? 'none' : 'lax',
              // Always use Secure for SameSite=None cookies
              secure: isWhopContext ? true : process.env.NODE_ENV === 'production',
              path: '/',
              maxAge: 0
            });
          }
        }
      }
    );

    // Get user from Supabase
    const { data: { user } } = await supabase.auth.getUser();
    const url = request.nextUrl.clone();

    // Check if we have Whop authentication but no Supabase auth
    const hasWhopAuth = whopAccessToken || whopDevUserToken || whopDevUserTokenParam;
    
    // Skip auth redirects for Whop iframe context or public routes
    if (isWhopContext && (url.pathname.startsWith('/dashboard') || publicRoutes.some(route => url.pathname.startsWith(route)))) {
      return response;
    }
    
    // Simple auth protection for routes
    if (user || hasWhopAuth) {
      // Logged in user trying to access auth routes should be redirected to dashboard
      if (url.pathname === '/login' || url.pathname === '/register') {
        return NextResponse.redirect(new URL('/dashboard/trading', request.url));
      }
    } else {
      // Non-logged in user trying to access protected routes should be redirected to login
      if (protectedRoutes.some(route => url.pathname.startsWith(route))) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }
    
    // Root path redirects
    if (url.pathname === '/') {
      if (user || hasWhopAuth) {
        return NextResponse.redirect(new URL('/dashboard/trading', request.url));
      } else {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    return response;
  } catch (error) {
    console.error('Middleware error:', error);
    
    // Clear problematic cookies
    const corruptedCookieNames = [
      'sb-emscntnnljbgjrxeeolm-auth-token',
      'sb-emscntnnljbgjrxeeolm-auth-token.0',
      'sb-emscntnnljbgjrxeeolm-auth-token.1',
      'sb-emscntnnljbgjrxeeolm-auth-token.2',
      'sb-emscntnnljbgjrxeeolm-auth-token.3',
      'sb-emscntnnljbgjrxeeolm-auth-token.4',
      'supabase-auth-token',
      'sb-access-token',
      'sb-refresh-token'
    ];
    
    corruptedCookieNames.forEach(name => {
      response.cookies.set({
        name,
        value: '',
        path: '/',
        maxAge: 0
      });
    });
    
    return response;
  }
}

// Specify which routes the middleware should run on
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 