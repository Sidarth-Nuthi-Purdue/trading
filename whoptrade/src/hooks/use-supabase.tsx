'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import { hasWhopAuthToken, getCookie } from '@/lib/cookie-utils';

// Cookie options interface
interface CookieOptions {
  maxAge?: number;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

// Create a Supabase client with cross-site cookie support
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      get(name: string) {
        if (typeof document === 'undefined') return '';
        const cookie = document.cookie
          .split('; ')
          .find((row) => row.startsWith(`${name}=`));
        return cookie ? cookie.split('=')[1] : '';
      },
      set(name: string, value: string, options: CookieOptions) {
        if (typeof document === 'undefined') return;
        // Always use SameSite=None and Secure for cross-site iframe support
        document.cookie = `${name}=${value}; path=/; max-age=${options.maxAge ?? 60 * 60 * 24}; SameSite=None; Secure`;
      },
      remove(name: string, _options: CookieOptions) {
        if (typeof document === 'undefined') return;
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure`;
      },
    },
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

// Create a context for the Supabase client and user data
type SupabaseContextType = {
  supabase: typeof supabase;
  user: User | null;
  isLoading: boolean;
  isWhopAuthenticated: boolean;
  whopUserId: string | null;
};

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

// Check if we're in a Whop iframe
function isInWhopIframe(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    return window.self !== window.top;
  } catch {
    // If we can't access window.top due to security restrictions,
    // we're definitely in an iframe from another domain
    return true;
  }
}

// Provider component that wraps your app and makes auth available
export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWhopAuthenticated, setIsWhopAuthenticated] = useState(false);
  const [whopUserId, setWhopUserId] = useState<string | null>(null);

  useEffect(() => {
    // Check for Whop authentication first
    const checkWhopAuth = async () => {
      // Check if we're in a Whop iframe or have a Whop token
      const inWhopIframe = isInWhopIframe();
      const hasWhopToken = hasWhopAuthToken();
      
      if (inWhopIframe || hasWhopToken) {
        console.log('Detected Whop authentication context');
        setIsWhopAuthenticated(true);
        
        // Try to get the Whop user ID from the token or cookie
        const whopDevUserToken = getCookie('whop_dev_user_token');
        const whopAccessToken = getCookie('whop_access_token');
        
        if (whopDevUserToken || whopAccessToken) {
          try {
            // Fetch user info from our API
            const response = await fetch('/api/user/me', {
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
              },
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.id) {
                setWhopUserId(data.id);
              }
            }
          } catch (err) {
            console.error('Error fetching Whop user info:', err);
          }
        }
        
        // If we're in a Whop iframe, we don't need to check Supabase auth
        if (inWhopIframe) {
          setIsLoading(false);
          return true;
        }
      }
      
      return false;
    };
    
    // Check for active session on mount
    const checkUser = async () => {
      try {
        // First check for Whop authentication
        const isWhopAuth = await checkWhopAuth();
        
        // If we're authenticated via Whop, we can skip Supabase auth check
        if (isWhopAuth) {
          return;
        }
        
        // Otherwise check Supabase auth
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);
      } catch (error) {
        console.error('Error checking user session:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Only update user if we're not using Whop authentication
        if (!isWhopAuthenticated) {
        setUser(session?.user || null);
        setIsLoading(false);
        }
      }
    );

    checkUser();

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    supabase,
    user,
    isLoading,
    isWhopAuthenticated,
    whopUserId,
  };

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
}

// Hook to use the Supabase context
export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
} 