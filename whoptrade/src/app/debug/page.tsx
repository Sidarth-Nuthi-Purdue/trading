'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { hasWhopAuthToken, getAllCookies } from '@/lib/cookie-utils';
import { useRouter } from 'next/navigation';

export default function DebugPage() {
  const router = useRouter();
  const [cookies, setCookies] = useState<Record<string, string>>({});
  const [hasToken, setHasToken] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check cookies and tokens
    const allCookies = getAllCookies();
    setCookies(allCookies);
    setHasToken(hasWhopAuthToken());

    // Try to fetch user data if token exists
    async function fetchUserData() {
      setLoading(true);
      
      try {
        const response = await fetch('/api/user/me', {
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setUserData(data);
        } else {
          setError(`API Error: ${response.status} ${response.statusText}`);
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    
    if (hasWhopAuthToken()) {
      fetchUserData();
    } else {
      setLoading(false);
    }
  }, []);
  
  // Helper to manually set a test cookie
  const setTestCookie = () => {
    document.cookie = 'test_cookie=debug_value; path=/; max-age=3600';
    setCookies(getAllCookies());
  };
  
  // Helper to clear cookies
  const clearAllCookies = () => {
    const allCookies = getAllCookies();
    Object.keys(allCookies).forEach(cookieName => {
      document.cookie = `${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    });
    setCookies({});
    setHasToken(false);
    setUserData(null);
  };
  
  // Manually set Whop token for testing
  const setTestWhopToken = () => {
    document.cookie = 'whop_dev_user_token=test_token_value; path=/; max-age=3600';
    setCookies(getAllCookies());
    setHasToken(true);
    router.refresh();
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Authentication Debug Page</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
          <div className="space-y-2">
            <p className="flex items-center">
              <span className="font-medium mr-2">Has Whop Token:</span>
              <span className={`px-2 py-1 rounded text-sm ${hasToken ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {hasToken ? 'Yes' : 'No'}
              </span>
            </p>
            
            <p className="flex items-center">
              <span className="font-medium mr-2">User Data:</span>
              <span className={`px-2 py-1 rounded text-sm ${userData ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {loading ? 'Loading...' : userData ? 'Available' : 'Not Available'}
              </span>
            </p>
            
            {error && (
              <p className="text-red-500 text-sm mt-2">
                Error: {error}
              </p>
            )}
          </div>
          
          <div className="mt-6 space-y-2">
            <Button onClick={() => router.push('/api/oauth/init?next=/debug')} className="w-full">
              Login with Whop
            </Button>
            <Button onClick={setTestCookie} variant="outline" className="w-full">
              Set Test Cookie
            </Button>
            <Button onClick={setTestWhopToken} variant="outline" className="w-full">
              Set Test Whop Token
            </Button>
            <Button onClick={clearAllCookies} variant="destructive" className="w-full">
              Clear All Cookies
            </Button>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Cookies</h2>
          
          {Object.keys(cookies).length === 0 ? (
            <p className="text-gray-500 italic">No cookies found</p>
          ) : (
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
              {JSON.stringify(cookies, null, 2)}
            </pre>
          )}
          
          {userData && (
            <>
              <h2 className="text-xl font-semibold mb-4 mt-8">User Data</h2>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
                {JSON.stringify(userData, null, 2)}
              </pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 