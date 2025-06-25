'use client';

import React, { useEffect, useState } from 'react';
import { User, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { hasWhopAuthToken, getAllCookies } from '@/lib/cookie-utils';

interface WhopUserInfo {
  name: string;
  email: string;
  profilePicture?: string;
}

export function WhopUserInfo() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<WhopUserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    // Check for token presence immediately to avoid UI flicker
    setHasToken(hasWhopAuthToken());
    
    async function fetchUserInfo() {
      try {
        setIsLoading(true);
        
        // First check if we have a token in cookies using our util
        const hasToken = hasWhopAuthToken();
        
        // Debug cookie information (only in development)
        if (process.env.NODE_ENV === 'development') {
          console.log('Has Whop token:', hasToken);
        }
          
        if (!hasToken) {
          console.log('No Whop token found in cookies');
          setUserInfo(null);
          setHasToken(false);
          setIsLoading(false);
          return;
        }
        
        setHasToken(true);
        
        // Make API request to get user info
        const response = await fetch('/api/user/me', {
          credentials: 'include', // Include cookies
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache', // Prevent caching
          },
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to get user info:', errorData);
          setUserInfo(null);
          setIsLoading(false);
          return;
        }
        
        const data = await response.json();
        
        setUserInfo({
          name: data.username || data.name || data.email?.split('@')[0] || 'Whop User',
          email: data.email || 'No email provided',
          profilePicture: data.profile_picture || data.profilePicture,
        });
      } catch (err) {
        console.error('Error fetching Whop user info:', err);
        setError('Failed to load user info');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchUserInfo();
    
    // Set up a refresh interval to check for token changes - but much less frequently
    const refreshInterval = setInterval(fetchUserInfo, 60000); // Check once per minute
    
    return () => clearInterval(refreshInterval);
  }, []);

  const handleLogin = () => {
    router.push('/api/oauth/init?next=/dashboard');
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 border-t border-sidebar-border animate-pulse">
        <div className="w-8 h-8 rounded-full bg-muted"></div>
        <div className="flex flex-col gap-1">
          <div className="h-3 w-20 bg-muted rounded"></div>
          <div className="h-2 w-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 border-t border-sidebar-border">
        <div className="text-red-500 text-xs">
          {error}
        </div>
      </div>
    );
  }
  
  if (!hasToken || !userInfo) {
    return (
      <div className="flex flex-col gap-2 p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">Not authenticated</span>
            <span className="text-xs text-muted-foreground">via Whop</span>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          size="sm"
          className="mt-2 w-full flex items-center gap-2"
          onClick={handleLogin}
        >
          <LogIn className="h-3.5 w-3.5" />
          <span>Login with Whop</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 border-t border-sidebar-border">
      {userInfo.profilePicture ? (
        <img 
          src={userInfo.profilePicture} 
          alt={userInfo.name} 
          className="w-8 h-8 rounded-full object-cover"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <span className="text-sm font-bold text-primary-foreground">
            {userInfo.name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      
      <div className="flex flex-col overflow-hidden">
        <span className="text-sm font-medium truncate">{userInfo.name}</span>
        <span className="text-xs text-muted-foreground truncate">{userInfo.email}</span>
      </div>
    </div>
  );
} 