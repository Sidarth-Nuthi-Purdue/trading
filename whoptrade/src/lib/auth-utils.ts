import { verifyUserToken } from '@whop/api';
import { headers } from 'next/headers';
import { cookies } from 'next/headers';

export interface AuthResult {
  authorized: boolean;
  userId: string | null;
  error: string | null;
  userMessage?: string;
}

/**
 * Basic user token verification
 */
export async function verifyUser(request: Request): Promise<AuthResult> {
  try {
    const headersList = new Headers(request.headers);
    
    // Get token from cookie and add it to Authorization header
    const cookieStore = cookies();
    const token = (await cookieStore.get('whop_access_token'))?.value;
    if (token) {
      headersList.set('Authorization', `Bearer ${token}`);
    }

    const { userId } = await verifyUserToken(headersList);
    
    if (!userId) {
      return { 
        authorized: false, 
        userId: null, 
        error: 'No valid user token',
        userMessage: 'You must be logged in to access this feature.'
      };
    }

    return { authorized: true, userId, error: null };
    
  } catch (error) {
    console.error('User verification error:', error);
    return { 
      authorized: false, 
      userId: null, 
      error: 'Authentication failed',
      userMessage: 'Authentication failed. Please try signing in again.'
    };
  }
}

/**
 * Get user token from request cookies
 */
export function getUserToken(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';');
  const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('whop_access_token='));
  
  if (!tokenCookie) return null;
  
  return tokenCookie.split('=')[1];
}

/**
 * Check if user is authenticated by looking for token in cookies
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = cookies();
  const token = await cookieStore.get('whop_access_token');
  return !!token;
}

/**
 * Authentication utilities for fixing issues with Supabase auth
 */

// Clear all Supabase auth cookies to fix issues
export function clearAllAuthCookies() {
  if (typeof document === 'undefined') return;
  
  // Get all cookies
  const cookies = document.cookie.split(';');
  
  // Find Supabase auth cookies
  cookies.forEach(cookie => {
    const name = cookie.split('=')[0].trim();
    // Match Supabase auth cookies
    if (name.includes('sb-') || name.includes('supabase-auth')) {
      // Clear the cookie
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax;`;
      console.log(`Cleared auth cookie: ${name}`);
    }
  });
}

// Log all cookies for debugging
export function logAllCookies() {
  if (typeof document === 'undefined') {
    console.log('Document not available (server-side)');
    return {};
  }
  
  console.log('All cookies: ', document.cookie);
  
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=');
    if (name) acc[name] = value;
    return acc;
  }, {} as Record<string, string>);
  
  return cookies;
}

// Try to fix authentication issues by clearing problematic cookies
export function fixAuthIssues() {
  // Log before cleanup
  console.log('Before cleanup:');
  logAllCookies();
  
  // Clear all auth cookies
  clearAllAuthCookies();
  
  // Log after cleanup
  console.log('After cleanup:');
  logAllCookies();
  
  return true;
}

// Fix common Supabase auth issues
export async function repairAuthSession() {
  try {
    // First clear any corrupted cookies
    clearAllAuthCookies();
    
    // Then reload the page to apply changes
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error repairing auth session:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
} 