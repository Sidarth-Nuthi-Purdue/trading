import { createBrowserClient } from '@supabase/ssr';

/**
 * Create an authenticated Supabase client using Whop-bridge tokens
 */
export function createWhopSupabaseClient() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Check for stored auth session
  const storedAuth = localStorage.getItem('supabase.auth.token');
  if (storedAuth) {
    try {
      const authData = JSON.parse(storedAuth);
      // Set the session manually
      supabase.auth.setSession({
        access_token: authData.access_token,
        refresh_token: authData.refresh_token
      });
    } catch (error) {
      console.error('Error setting stored auth session:', error);
    }
  }

  return supabase;
}

/**
 * Get authentication headers for API requests
 */
export function getWhopAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  // Try to get token from window global or localStorage
  const authToken = (window as any).supabaseSession?.access_token || 
                   JSON.parse(localStorage.getItem('supabase.auth.token') || '{}').access_token;

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
    console.log('Using regular auth token');
  } else {
    // If no regular token, try to use Whop virtual token
    // Check if we have a stored user with whop_user_id
    const storedAuth = localStorage.getItem('supabase.auth.token');
    if (storedAuth) {
      try {
        const authData = JSON.parse(storedAuth);
        if (authData.user && authData.user.whop_user_id) {
          const virtualToken = `whop-${authData.user.whop_user_id}-${Date.now()}`;
          headers['Authorization'] = `Bearer ${virtualToken}`;
          console.log('Using Whop virtual token:', virtualToken);
        }
      } catch (error) {
        console.error('Error parsing stored auth for Whop token:', error);
      }
    }
    
    // Also check direct whop_user_id storage
    const whopUserId = localStorage.getItem('whop_user_id');
    if (whopUserId && !headers['Authorization']) {
      const virtualToken = `whop-${whopUserId}-${Date.now()}`;
      headers['Authorization'] = `Bearer ${virtualToken}`;
      console.log('Using stored Whop user ID token:', virtualToken);
    }
  }

  if (!headers['Authorization']) {
    console.warn('No authentication token available');
  }

  return headers;
}

/**
 * Check if user is authenticated with Whop-Supabase bridge
 */
export function isWhopAuthenticated(): boolean {
  try {
    const storedAuth = localStorage.getItem('supabase.auth.token');
    if (!storedAuth) return false;

    const authData = JSON.parse(storedAuth);
    const now = Date.now() / 1000;
    
    // Check if token is not expired
    return authData.expires_at && authData.expires_at > now;
  } catch {
    return false;
  }
}

/**
 * Clear Whop-Supabase authentication
 */
export function clearWhopAuth() {
  localStorage.removeItem('supabase.auth.token');
  delete (window as any).supabaseSession;
}