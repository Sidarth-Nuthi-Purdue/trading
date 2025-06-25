'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { CookieCleaner } from '@/components/cookie-cleaner';
import AuthFix from '@/components/auth-fix';
import { hasWhopAuthToken } from '@/lib/cookie-utils';

// Create a direct Supabase client for this component
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInIframe, setIsInIframe] = useState(false);
  const [hasWhopAuth, setHasWhopAuth] = useState(false);
  const router = useRouter();
  
  useEffect(() => {
    // Check if we're in an iframe
    setIsInIframe(isInWhopIframe());
    
    // Check if we have Whop authentication
    setHasWhopAuth(hasWhopAuthToken());
    
    // If we're in a Whop iframe and have Whop auth, redirect to dashboard
    if (isInWhopIframe() && hasWhopAuthToken()) {
      console.log("Detected Whop iframe authentication, redirecting to dashboard");
      router.push('/dashboard/trading');
      return;
    }
    
    // Check if already logged in
    const checkAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Auth error:", error);
          return;
        }
        
        if (data.session) {
          console.log("Already authenticated, redirecting...");
          router.push('/dashboard/trading');
          return;
        }
      } catch (err) {
        console.error('Auth check error:', err);
      }
    };
    
    checkAuth();
  }, [router]);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Format username
      const username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`.replace(/[^a-z0-9_]/g, '');
      
      // Try direct Supabase auth
      console.log('Registering user with email:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            username
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        console.error('Registration error:', error);
        setError(error.message || 'Registration failed');
        return;
      }
      
      if (data.user) {
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
          // Continue with registration even if this fails
        }
        
        // Successfully registered
        router.push('/login?message=Registration successful. You can now log in.');
      } else {
        setError('Registration failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Unexpected registration error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-950">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Register</h1>
          <p className="mt-2 text-gray-400">Create a new account</p>
        </div>
        
        {/* Fix auth issues automatically */}
        <AuthFix />
        <CookieCleaner />
        
        {isInIframe && (
          <div className="bg-blue-900/50 text-blue-300 p-4 rounded-lg text-center">
            <p className="font-medium">Whop Iframe Detected</p>
            <p className="text-sm mt-1">
              You're viewing this app in a Whop iframe. No need to register - use Whop authentication instead.
            </p>
            <button
              onClick={() => window.location.href = '/api/oauth/init?next=/dashboard/trading'}
              className="mt-3 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
            >
              Login with Whop
            </button>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 text-red-400 rounded">
              {error}
            </div>
          )}
          
          <form onSubmit={handleRegister} className="space-y-6">
            <div className="flex space-x-4">
              <div className="w-1/2">
                <label className="block mb-2 text-sm font-medium text-gray-300">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="w-1/2">
                <label className="block mb-2 text-sm font-medium text-gray-300">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-300">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                minLength={6}
              />
              <p className="text-xs text-gray-400 mt-1">Password must be at least 6 characters</p>
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2 font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating Account...' : 'Register'}
            </button>
          </form>
          
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-400 mb-4">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-blue-400 hover:underline">
                Sign in
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
            
            <button
              onClick={() => window.location.href = '/api/oauth/init?next=/dashboard/trading'}
              className="w-full px-4 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-200 flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                <path d="M11 7h2v6h-2zm0 8h2v2h-2z"/>
              </svg>
              Login with Whop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 