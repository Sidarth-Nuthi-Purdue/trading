'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { setCookie } from '@/lib/cookie-utils';

export interface WhopUser {
  id: string;
  name: string | null;
  username: string;
  profilePicture?: {
    sourceUrl: string;
  };
  phoneVerified: boolean;
  city: string | null;
  country: string | null;
  bio: string | null;
  banner: string | null;
  createdAt: number;
}

export interface WhopExperience {
  id: string;
  name: string;
  description: string;
  logo?: {
    sourceUrl: string;
  };
  app?: {
    id: string;
    name: string;
    icon?: {
      sourceUrl: string;
    };
  };
  company?: {
    id: string;
    title: string;
  };
  upsellType: string | null;
  upsellPlan: string | null;
}

export type WhopAccessLevel = 'admin' | 'member' | 'none';

interface WhopIframeData {
  isInWhopIframe: boolean;
  whopUser: WhopUser | null;
  whopExperience: WhopExperience | null;
  accessLevel: WhopAccessLevel;
  isLoading: boolean;
  error: string | null;
}

const ALLOWED_ORIGINS = ['whop.com', 'localhost'];

export function useWhopIframe(): WhopIframeData {
  const [isInWhopIframe, setIsInWhopIframe] = useState(false);
  const [whopUser, setWhopUser] = useState<WhopUser | null>(null);
  const [whopExperience, setWhopExperience] = useState<WhopExperience | null>(null);
  const [accessLevel, setAccessLevel] = useState<WhopAccessLevel>('none');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const searchParams = useSearchParams();
  
  useEffect(() => {
    // Check if we're in an iframe
    try {
      setIsInWhopIframe(window.self !== window.top);
    } catch (e) {
      // If we can't access window.top due to security restrictions,
      // we're definitely in an iframe from another domain
      setIsInWhopIframe(true);
    }
    
    // Get the whop-dev-user-token from the search params
    const whopDevUserToken = searchParams ? searchParams.get('whop-dev-user-token') : null;
    
    // If we have a token, store it in a cookie
    if (whopDevUserToken) {
      console.log('Setting whop_dev_user_token cookie from iframe');
      setCookie('whop_dev_user_token', whopDevUserToken, {
        path: '/',
        maxAge: 86400, // 24 hours
        secure: false, // For local development
        sameSite: 'lax'
      });
    }
    
    // Handle communication with parent window
    function handleMessage(event: MessageEvent) {
      // Verify the origin is allowed
      if (!ALLOWED_ORIGINS.some(origin => event.origin.includes(origin))) {
        console.warn('Message received from unauthorized origin:', event.origin);
        return;
      }
      
      console.log('Received message from Whop parent:', event.data);
      
      // Handle user data if provided
      if (event.data.user) {
        setWhopUser(event.data.user);
      }
      
      // Handle experience data if provided
      if (event.data.experience) {
        setWhopExperience(event.data.experience);
      }
      
      // Handle access level if provided
      if (event.data.accessLevel) {
        setAccessLevel(event.data.accessLevel as WhopAccessLevel);
      }
      
      // Handle auth token if provided
      if (event.data.token) {
        console.log('Received token from Whop parent');
        setCookie('whop_dev_user_token', event.data.token, {
          path: '/',
          maxAge: 86400, // 24 hours
          secure: false,
          sameSite: 'lax'
        });
      }
    }
    
    // Add message event listener
    window.addEventListener('message', handleMessage);
    
    // If in an iframe, request data from parent
    if (isInWhopIframe) {
      try {
        // Let the parent know we're ready to receive data
        window.parent.postMessage({ 
          type: 'WHOP_APP_READY',
          requestData: true
        }, '*');
      } catch (e) {
        console.error('Failed to send message to parent window:', e);
        setError('Failed to communicate with Whop');
      }
    }
    
    // Fetch user data if we're in a Whop iframe
    async function fetchWhopData() {
      if (!isInWhopIframe && !whopDevUserToken) {
        setIsLoading(false);
        return;
      }
      
      try {
        const response = await fetch('/api/user/me', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch Whop user data: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.user) {
          setWhopUser(data.user);
        }
        
        if (data.experience) {
          setWhopExperience(data.experience);
        }
        
        if (data.accessLevel) {
          setAccessLevel(data.accessLevel as WhopAccessLevel);
        }
      } catch (err) {
        console.error('Error fetching Whop data:', err);
        setError('Failed to load Whop user data');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchWhopData();
    
    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [searchParams]);
  
  return {
    isInWhopIframe,
    whopUser,
    whopExperience,
    accessLevel,
    isLoading,
    error
  };
} 