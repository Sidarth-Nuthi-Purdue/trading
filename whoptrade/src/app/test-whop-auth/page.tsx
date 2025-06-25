'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSupabase } from '@/hooks/use-supabase';
import { Badge } from '@/components/ui/badge';
import { hasWhopAuthToken, getAllCookies } from '@/lib/cookie-utils';

export default function TestWhopAuth() {
  const { user, isWhopAuthenticated, whopUserId } = useSupabase();
  const [isInIframe, setIsInIframe] = useState(false);
  const [whopUserInfo, setWhopUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cookies, setCookies] = useState<Record<string, string>>({});
  
  useEffect(() => {
    // Check if we're in an iframe
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      // If we can't access window.top due to security restrictions,
      // we're definitely in an iframe from another domain
      setIsInIframe(true);
    }
    
    // Get all cookies for debugging
    setCookies(getAllCookies());
    
    // Fetch Whop user info if authenticated
    if (isWhopAuthenticated || hasWhopAuthToken()) {
      fetch('/api/user/me', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      })
        .then(res => {
          if (!res.ok) throw new Error(`Failed to fetch user data: ${res.status}`);
          return res.json();
        })
        .then(data => {
          setWhopUserInfo(data);
        })
        .catch(err => {
          console.error('Error fetching Whop user info:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [isWhopAuthenticated]);
  
  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold">Authentication Test Page</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Status</CardTitle>
            <CardDescription>Current authentication state</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="font-medium">In Whop iframe:</span>
              {isInIframe ? (
                <Badge variant="success" className="bg-green-500">Yes</Badge>
              ) : (
                <Badge variant="destructive">No</Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-medium">Whop authenticated:</span>
              {isWhopAuthenticated ? (
                <Badge variant="success" className="bg-green-500">Yes</Badge>
              ) : (
                <Badge variant="destructive">No</Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-medium">Supabase authenticated:</span>
              {user ? (
                <Badge variant="success" className="bg-green-500">Yes</Badge>
              ) : (
                <Badge variant="destructive">No</Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-medium">Whop User ID:</span>
              {whopUserId ? (
                <Badge variant="outline">{whopUserId}</Badge>
              ) : (
                <Badge variant="secondary">None</Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-medium">Supabase User ID:</span>
              {user ? (
                <Badge variant="outline">{user.id}</Badge>
              ) : (
                <Badge variant="secondary">None</Badge>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Whop User Info</CardTitle>
            <CardDescription>Data from Whop API</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            ) : whopUserInfo ? (
              <div className="space-y-4">
                {whopUserInfo.profilePicture && (
                  <div className="flex justify-center">
                    <img 
                      src={whopUserInfo.profilePicture.sourceUrl || whopUserInfo.profilePicture} 
                      alt={whopUserInfo.name || whopUserInfo.username} 
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <div>
                    <span className="font-medium">Name:</span> {whopUserInfo.name || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">Username:</span> {whopUserInfo.username || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">Email:</span> {whopUserInfo.email || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">ID:</span> {whopUserInfo.id || 'N/A'}
                  </div>
                  
                  {whopUserInfo.experience && (
                    <>
                      <div className="mt-4 font-bold">Experience Data:</div>
                      <div>
                        <span className="font-medium">Experience:</span> {whopUserInfo.experience.name || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Experience ID:</span> {whopUserInfo.experience.id || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Access Level:</span> {whopUserInfo.accessLevel || 'N/A'}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                No Whop user data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Debug Information</CardTitle>
          <CardDescription>Cookies and other debug data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <h3 className="font-bold">Cookies:</h3>
            <pre className="bg-gray-100 p-4 rounded-md overflow-auto max-h-60 text-xs">
              {JSON.stringify(cookies, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 