'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { hasWhopAuthToken } from '@/lib/cookie-utils';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

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
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax;`;
  };
  
  // Clear known Supabase cookies
  clearCookie('sb-access-token');
  clearCookie('sb-refresh-token');
  
  // Clear other potential auth cookies
  document.cookie.split(';').forEach(cookie => {
    const [name] = cookie.trim().split('=');
    if (name && (name.includes('supabase') || name.includes('sb-') || name.includes('auth'))) {
      clearCookie(name);
    }
  });
};

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

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isInIframe, setIsInIframe] = useState(false);
  const [hasWhopAuth, setHasWhopAuth] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for message in URL
    const urlMessage = searchParams?.get('message');
    if (urlMessage) {
      setMessage(urlMessage);
    }
    
    // Check if we're in an iframe
    setIsInIframe(isInWhopIframe());
    
    // Check if we have Whop authentication
    setHasWhopAuth(hasWhopAuthToken());
    
    // If we're in a Whop iframe, redirect to Whop dashboard
    if (isInWhopIframe()) {
      console.log("Detected Whop iframe, redirecting to Whop dashboard");
      router.push('/dashboard-whop');
      return;
    }
    
    // Clear browser cookies on mount
    clearBrowserCookies();
    
    // Check if already logged in
    const checkAuth = async () => {
      setIsChecking(true);
      try {
        console.log("Checking auth...");
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Auth error:", error);
          setIsChecking(false);
          return;
        }
        
        if (data.session) {
          console.log("Already authenticated, redirecting...");
          router.push('/dashboard/trading');
          return;
        }
      } catch (err) {
        console.error('Auth check error:', err);
      } finally {
        setIsChecking(false);
      }
    };
    
    checkAuth();
  }, [router, searchParams]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      // Clear cookies before login
      clearBrowserCookies();
      
      // Try to sign in
      console.log("Signing in with:", email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        setMessage('Login successful! Redirecting...');
        
        // Initialize the trading database for the user
        try {
          await fetch('/api/reset-db', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
        } catch (dbError) {
          console.error('Error initializing database:', dbError);
          // Continue with login even if this fails
        }
        
        // Navigate to dashboard
        setTimeout(() => {
          router.push('/dashboard/trading');
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading screen while checking auth
  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-950">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">WhopTrade</h1>
          <p className="mt-2 text-gray-400">Sign in to your account</p>
        </div>

        {isInIframe && (
          <div className="bg-blue-900/50 text-blue-300 p-4 rounded-lg text-center">
            <p className="font-medium">Whop Iframe Detected</p>
            <p className="text-sm mt-1">
              You're viewing this app in a Whop iframe. Authentication will be handled automatically.
            </p>
            <Link
              href="/dashboard-whop"
              className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
            >
              Access Dashboard
            </Link>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
          {message && (
            <div className="mb-4 p-3 bg-green-900/50 text-green-400 rounded">
              {message}
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 text-red-400 rounded">
              {error}
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-300">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-300">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-400 mb-2">
              Don't have an account?{' '}
              <Link href="/register" className="text-blue-400 hover:underline">
                Sign up
              </Link>
            </p>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 text-gray-400 bg-gray-800">Or</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Link
                href="/dashboard-whop"
                className="block w-full px-4 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-200 text-center"
              >
                <div className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                    <path d="M11 7h2v6h-2zm0 8h2v2h-2z"/>
                  </svg>
                  Access Whop Dashboard
                </div>
              </Link>
              
              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 text-center">
                <p className="text-blue-300 text-sm">
                  <strong>Note:</strong> Whop authentication works automatically when this app is accessed through Whop's platform. 
                  The dashboard will verify your Whop credentials automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 