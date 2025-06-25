import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Opt into dynamic rendering to resolve the static analysis error with cookies()
export const dynamic = 'force-dynamic';

// Helper function to create consistent responses
function createResponse(success: boolean, message: string, data: Record<string, unknown> | null = null, status: number = 200) {
  return NextResponse.json(
    { success, message, ...data },
    { 
      status, 
      headers: { 
        'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      } 
    }
  );
}

export async function GET() {
  try {
    // Clear all existing cookies using the response cookies
    const response = NextResponse.next();
    
    // Get cookie store and properly await it since Next.js 15 requires it
    const cookieStore = await cookies();
    
    // Get all cookies from the request
    const requestCookies = cookieStore.getAll();
    
    // Track which cookies we're deleting
    const deletedCookies: string[] = [];
    
    for (const cookie of requestCookies) {
      if (cookie.name.includes('supabase') || 
          cookie.name.includes('sb-') || 
          cookie.name.includes('auth') ||
          cookie.name === 'access_token' ||
          cookie.name === 'refresh_token') {
        // Delete the cookie from the cookie store
        cookieStore.delete(cookie.name);
        // Also set the cookie deletion in the response
        response.cookies.delete(cookie.name);
        deletedCookies.push(cookie.name);
      }
    }
    
    console.log(`Deleted ${deletedCookies.length} cookies: ${deletedCookies.join(', ')}`);
    
    // Create a fresh Supabase client for admin operations
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    // Create admin client but don't need to store it since we don't use it
    createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    );
    
    console.log('Supabase client created successfully');
    
    // Set up the JSON response
    const jsonResponse = createResponse(true, 'Authentication state has been reset', {
      cookiesCleared: deletedCookies
    });
    
    // Add cache control headers
    jsonResponse.headers.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
    jsonResponse.headers.set('Pragma', 'no-cache');
    jsonResponse.headers.set('Expires', '0');
    
    // Copy cookies from the initial response to the JSON response
    const responseCookies = response.cookies.getAll();
    responseCookies.forEach(cookie => {
      jsonResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    
    return jsonResponse;
  } catch (error) {
    console.error('Error fixing auth:', error);
    
    return createResponse(false, 'Failed to fix authentication: ' + (error as Error).message, null, 500);
  }
} 