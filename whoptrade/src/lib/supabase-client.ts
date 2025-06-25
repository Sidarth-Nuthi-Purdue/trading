'use client';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Create a singleton instance of the Supabase client
let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (supabaseInstance) {
    return supabaseInstance;
  }
  
  supabaseInstance = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storageKey: 'supabase_auth_token',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    }
  );
  
  return supabaseInstance;
}

// Function to clear corrupted cookies in the browser
export function clearCorruptedCookies() {
  if (typeof document === 'undefined') return;
  
  const clearCookie = (name: string, path = '/') => {
    document.cookie = `${name}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax;`;
  };
  
  // Clear all potential Supabase cookies
  clearCookie('sb-access-token');
  clearCookie('sb-refresh-token');
  
  // Clear potential cookie with the project reference
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1];
  if (projectRef) {
    clearCookie(`sb-${projectRef}-auth-token`);
  }
  
  // Try to find and clear any Supabase cookies by iterating through all cookies
  document.cookie.split(';').forEach(cookie => {
    const [name] = cookie.trim().split('=');
    if (name && (name.includes('supabase') || name.includes('sb-') || name.includes('auth'))) {
      clearCookie(name);
    }
  });
}