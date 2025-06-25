'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { setCookie, deleteCookie } from '@/lib/cookie-utils';
import { useSupabase } from '@/hooks/use-supabase';

/**
 * Component that automatically handles Whop authentication when in an iframe
 * This should be included in the root layout to ensure it's always present
 */
export function WhopAutoAuth() {
  const { isWhopAuthenticated } = useSupabase();
  const [isInIframe, setIsInIframe] = useState(false);
  const searchParams = useSearchParams();
  
  useEffect(() => {
    // Check if we're in an iframe
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      // If we can't access window.top due to security restrictions,
      // we're definitely in an iframe from another domain
      setIsInIframe(true);
    }
    
    // Get the whop-dev-user-token from the search params
    const whopDevUserToken = searchParams ? searchParams.get('whop-dev-user-token') : null;
    
    // If we have a token, store it in a cookie
    if (whopDevUserToken) {
      console.log('WhopAutoAuth: Setting whop_dev_user_token cookie');
      setCookie('whop_dev_user_token', whopDevUserToken, {
        path: '/',
        maxAge: 86400, // 24 hours
        secure: true, // Always use secure for cross-site contexts
        sameSite: 'none' // Required for cross-site iframe contexts
      });
    }
    
    // Handle communication with parent window
    function handleMessage(event: MessageEvent) {
      // Only accept messages from Whop domains or localhost for testing
      if (!event.origin.includes('whop.com') && !event.origin.includes('localhost')) {
        return;
      }
      
      // Handle auth token if provided
      if (event.data.token) {
        console.log('WhopAutoAuth: Received token from parent');
        setCookie('whop_dev_user_token', event.data.token, {
          path: '/',
          maxAge: 86400, // 24 hours
          secure: true, // Always use secure for cross-site contexts
          sameSite: 'none' // Required for cross-site iframe contexts
        });
        
        // Immediately notify parent that we're authenticated to avoid excessive polling
        if (isInIframe) {
          try {
            window.parent.postMessage({ 
              type: 'WHOP_APP_AUTH_SUCCESS',
              app: 'PaperTrader'
            }, '*');
          } catch (e) {
            console.error('WhopAutoAuth: Failed to send auth success message:', e);
          }
        }
      }
      
      // Handle clearing tokens if requested
      if (event.data.clearTokens) {
        console.log('WhopAutoAuth: Clearing tokens');
        deleteCookie('whop_dev_user_token');
        deleteCookie('whop_access_token');
        
        // Reload the page to apply changes
        window.location.reload();
      }
    }
    
    // Add message event listener
    window.addEventListener('message', handleMessage);
    
    // If in an iframe, notify the parent that we're ready
    if (isInIframe) {
      try {
        console.log('WhopAutoAuth: Sending ready message to parent');
        window.parent.postMessage({ 
          type: 'WHOP_APP_READY',
          app: 'PaperTrader',
          needsAuth: !isWhopAuthenticated
        }, '*');
      } catch (e) {
        console.error('WhopAutoAuth: Failed to send message to parent window:', e);
      }
    }
    
    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [searchParams, isWhopAuthenticated, isInIframe]);
  
  // This component doesn't render anything
  return null;
} 