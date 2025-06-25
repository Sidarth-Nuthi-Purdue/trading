import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// List of routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/practice-trading',
];

// List of routes that are accessible only to non-authenticated users
const authRoutes = [
  '/login',
  '/register',
];

// Routes that should not be redirected to login even if unauthenticated
const publicRoutes = [
  '/api',  // API routes
  '/_next', // Next.js assets
  '/favicon.ico',
  '/setup',
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
    // Clear corrupted cookies
    const corruptedCookieNames = [
      'sb-emscntnnljbgjrxeeolm-auth-token.0',
      'sb-emscntnnljbgjrxeeolm-auth-token.1',
      'sb-emscntnnljbgjrxeeolm-auth-token.2',
      'sb-emscntnnljbgjrxeeolm-auth-token.3',
      'sb-emscntnnljbgjrxeeolm-auth-token.4',
    ];
    
    corruptedCookieNames.forEach(name => {
      if (request.cookies.has(name)) {
        response.cookies.set({
          name,
          value: '',
          path: '/',
          maxAge: 0
        });
      }
    });
    
    // Create Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            // Only get the main auth token cookie for authentication
            if (name === 'sb-emscntnnljbgjrxeeolm-auth-token') {
              return request.cookies.get(name)?.value;
            }
            return undefined;
          },
          set(name, value, options) {
            // In development, don't use secure cookies
            response.cookies.set({
              name,
              value,
              ...options,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              path: '/'
            });
          },
          remove(name, options) {
            response.cookies.set({
              name,
              value: '',
              ...options,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              path: '/',
              maxAge: 0
            });
          }
        }
      }
    );

    // Get user
    const { data: { user } } = await supabase.auth.getUser();
    const url = request.nextUrl.clone();

    // Simple auth protection for routes
    if (user) {
      console.log('User authenticated:', user.id);
      // Logged in user trying to access auth routes should be redirected to dashboard
      if (url.pathname === '/login' || url.pathname === '/register') {
        return NextResponse.redirect(new URL('/dashboard/trading', request.url));
      }
    } else {
      console.log('No authenticated user found');
      // Non-logged in user trying to access protected routes should be redirected to login
      if (protectedRoutes.some(route => url.pathname.startsWith(route))) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }
    
    // Root path redirects
    if (url.pathname === '/') {
      if (user) {
        return NextResponse.redirect(new URL('/dashboard/trading', request.url));
      } else {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    return response;
  } catch (error) {
    console.error('Middleware error:', error);
    return response;
  }
}

// Specify which routes the middleware should run on
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 