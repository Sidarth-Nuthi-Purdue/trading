'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { NavigationDock } from '@/components/navigation-dock';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { hasWhopAuthToken, getCookie } from '@/lib/cookie-utils';
import { WhopAutoAuth } from '@/components/whop-auto-auth';
import { WhopSupabaseSync } from '@/components/whop-supabase-sync';

// Force dynamic rendering to prevent caching issues
export const dynamic = 'force-dynamic';

// Create a direct Supabase client for this component
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Clear client-side auth cookies
const clearBrowserCookies = () => {
  if (typeof document === 'undefined') return;
  
  // Helper function to clear cookies
  const clearCookie = (name: string) => {
    // Check if we're in an iframe context
    let isInIframe = false;
    try {
      isInIframe = window.self !== window.top;
    } catch {
      isInIframe = true;
    }
    
    // For cross-site contexts, need to use SameSite=None; Secure
    if (isInIframe) {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure`;
    } else {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    }
  };
  
  // Clear known Supabase cookies
  clearCookie('sb-access-token');
  clearCookie('sb-refresh-token');
  
  // Clear Whop cookies
  clearCookie('whop_access_token');
  clearCookie('whop_dev_user_token');
  
  // Clear other potential auth cookies
  document.cookie.split(';').forEach(cookie => {
    const [name] = cookie.trim().split('=');
    if (name && (name.includes('supabase') || name.includes('sb-') || name.includes('auth'))) {
      clearCookie(name);
    }
  });
};

// Check if we're in an iframe
const isInIframe = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [whopUser, setWhopUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWhopAuth, setIsWhopAuth] = useState(false);
  
  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        
        // First check if we have a Whop token
        const hasWhopToken = hasWhopAuthToken();
        
        if (hasWhopToken) {
          setIsWhopAuth(true);
          
          // Fetch Whop user info
          try {
            const response = await fetch('/api/user/me', {
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
              },
            });
            
            if (response.ok) {
              const data = await response.json();
              setWhopUser(data);
              setUser(null); // Clear Supabase user if we're using Whop auth
              setIsLoading(false);
              return;
            }
          } catch (e) {
            console.error('Failed to fetch Whop user info:', e);
          }
        }
        
        // If we don't have a Whop token or failed to fetch Whop user info, try Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw sessionError;
        }
        
        if (session) {
          setUser(session.user);
          setIsWhopAuth(false);
        } else {
          // No session found, check if we're in the login flow
          if (!pathname.includes('/login') && !pathname.includes('/register')) {
            // Prevent infinite redirect loops by adding a delay and checking if already redirecting
            if (!window.location.href.includes('redirecting')) {
              console.log('Dashboard layout: redirecting to login due to no session');
              window.location.replace(`/login?redirect=${encodeURIComponent(pathname)}&redirecting=true`);
              return;
            }
          }
        }
      } catch (err) {
        console.error('Auth check error:', err);
        setError('Authentication failed. Please try logging in again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [pathname]);
  
  // Handle sign out
  const handleSignOut = async () => {
    try {
      if (isWhopAuth) {
        // Clear Whop cookies
        clearBrowserCookies();
        
        // Check if we're in an iframe
        let isInIframe = false;
        try {
          isInIframe = window.self !== window.top;
        } catch {
          isInIframe = true;
        }
        
        if (isInIframe) {
          // In iframe, notify parent
          window.parent.postMessage({ type: 'WHOP_APP_LOGOUT' }, '*');
        } else {
          // Not in iframe, redirect
          window.location.replace('/login');
        }
      } else {
        // Supabase signout
        await supabase.auth.signOut();
        
        // Clear cookies and redirect
        clearBrowserCookies();
        window.location.replace('/login');
      }
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        {/* Include WhopAutoAuth to handle iframe auth */}
        <WhopAutoAuth />
      </div>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-gray-950 text-white">
        <div className="bg-red-900/30 p-4 rounded-lg max-w-md text-center mb-4">
          <h2 className="text-xl font-bold mb-2">Authentication Error</h2>
          <p className="text-red-300">{error}</p>
        </div>
        <button 
          onClick={() => window.location.replace(`/login?t=${Date.now()}`)} 
          className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
        >
          Return to Login
        </button>
        {/* Include WhopAutoAuth to handle iframe auth */}
        <WhopAutoAuth />
      </div>
    );
  }
  
  // If no user and no Whop auth, redirect should happen in useEffect
  if (!user && !isWhopAuth) return <WhopAutoAuth />;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Include WhopAutoAuth to handle iframe auth */}
      <WhopAutoAuth />
      
      {/* Auto-sync Whop users to Supabase */}
      {isWhopAuth && whopUser && (
        <WhopSupabaseSync 
          whopUserData={whopUser}
          onSyncComplete={(session) => {
            console.log('Supabase session created for Whop user:', session.user.id);
            // Optionally refresh the page or update state
          }}
        />
      )}
      
      {/* Main Content - No top header */}
      <main className="pb-20">
        {children}
      </main>

      {/* Navigation Dock */}
      <NavigationDock />
    </div>
  );
} 