import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Opt into dynamic rendering to prevent static analysis error with cookies()
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Create a response with cache control headers
    const response = NextResponse.json(
      { success: true, message: 'Cookies cleared' },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
    
    // Get cookie store and properly await it since Next.js 15 requires it
    const cookieStore = await cookies();
    
    // Get all cookies from the request
    const requestCookies = cookieStore.getAll();
    
    // Track which cookies we're deleting
    let deletedCookies = [];
    
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
    
    // Return the updated response with deleted cookies info
    return NextResponse.json(
      { success: true, message: 'Cookies cleared', deleted: deletedCookies },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
    
  } catch (error) {
    console.error('Error clearing cookies:', error);
    
    return NextResponse.json(
      { success: false, message: 'Failed to clear cookies: ' + (error as Error).message },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
} 