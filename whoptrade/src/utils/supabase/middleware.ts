import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create a Supabase client for authentication in middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: { path: string; maxAge: number; domain?: string; sameSite?: string; secure?: boolean }) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: { path: string; domain?: string; sameSite?: string; secure?: boolean }) {
          response.cookies.set({
            name,
            value: '',
            ...options,
            maxAge: 0,
          });
        },
      },
    }
  );

  // This will refresh the session if it exists and is expired
  await supabase.auth.getUser();

  // Add cache control headers
  response.headers.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
} 