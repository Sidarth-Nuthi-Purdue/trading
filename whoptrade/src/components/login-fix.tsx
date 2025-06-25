'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

// Clear all supabase auth cookies
function clearAllAuthCookies() {
  if (typeof document === 'undefined') return;
  
  const cookieNames = document.cookie.split(';').map(cookie => cookie.split('=')[0].trim());
  
  cookieNames.forEach(name => {
    if (name.includes('sb-') || name.includes('supabase-auth')) {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
      console.log(`Cleared cookie: ${name}`);
    }
  });
}

export function LoginFix() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  
  const supabase = createClientComponentClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    options: {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
      },
      cookies: {
        name: 'sb-auth-token', // Use a consistent cookie name
        lifetime: 60 * 60 * 24 * 7, // 7 days
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  });
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setMessage('Please provide both email and password');
      return;
    }
    
    try {
      setIsLoading(true);
      setMessage('Signing in...');
      
      // First, clear any existing auth cookies to prevent conflicts
      clearAllAuthCookies();
      
      // Then sign in with the provided credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Login error:', error);
        setMessage(`Login failed: ${error.message}`);
        return;
      }
      
      if (data?.user) {
        setMessage(`Login successful! User ID: ${data.user.id}`);
        console.log('Login successful, redirecting to dashboard...');
        
        // Redirect to dashboard
        setTimeout(() => {
          router.push('/dashboard/trading');
          router.refresh();
        }, 1000);
      }
    } catch (error) {
      console.error('Login error:', error);
      setMessage(`An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLogout = async () => {
    try {
      setIsLoading(true);
      setMessage('Signing out...');
      
      // First, clear all auth cookies
      clearAllAuthCookies();
      
      // Then sign out from Supabase
      await supabase.auth.signOut({ scope: 'global' });
      
      setMessage('Successfully signed out and cleared all auth cookies');
      
      // Reload the page to apply changes
      setTimeout(() => {
        router.refresh();
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Logout error:', error);
      setMessage(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Fix Login Issues</h2>
      
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div className="flex gap-2">
          <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
            {isLoading ? 'Processing...' : 'Login (Fixed)'}
          </Button>
          
          <Button type="button" onClick={handleLogout} disabled={isLoading} variant="destructive">
            Sign Out & Clear Cookies
          </Button>
        </div>
      </form>
      
      {message && (
        <div className="mt-4 p-3 bg-gray-100 rounded-md text-sm">
          {message}
        </div>
      )}
    </div>
  );
} 