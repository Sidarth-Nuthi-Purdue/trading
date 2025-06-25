'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export function FixAuthCookie() {
  const [hasError, setHasError] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const router = useRouter();

  // Check for cookie parsing errors on component mount
  useEffect(() => {
    // Set the error flag if we detect cookie parse errors in the console
    const errorHandler = (event: ErrorEvent) => {
      if (event.error && event.error.message) {
        const errorMessage = event.error.message;
        if (
          errorMessage.includes('Failed to parse cookie') || 
          errorMessage.includes('JSON.parse') ||
          errorMessage.includes('unexpected character')
        ) {
          setHasError(true);
        }
      }
    };

    // Watch for error events
    window.addEventListener('error', errorHandler);

    // Also manually clear cookies on initial load if we detect issues
    const hasCookieIssue = document.cookie.includes('sb-') || document.cookie.includes('supabase-auth-token');
    if (hasCookieIssue) {
      setHasError(true);
    }

    return () => {
      window.removeEventListener('error', errorHandler);
    };
  }, []);

  // Check for price display issues and auth issues
  useEffect(() => {
    // Look for NaN or authentication issues in the DOM
    const observer = new MutationObserver(() => {
      // Look for NaN prices
      const priceElements = document.querySelectorAll('span, div');
      for (const elem of priceElements) {
        if (elem.textContent?.includes('$NaN') || elem.textContent?.includes('Authentication required')) {
          setHasError(true);
          break;
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // Handle fixing the cookies
  const handleFixCookies = async () => {
    try {
      setIsFixing(true);
      
      // Manual cookie deletion (client-side)
      const cookies = document.cookie.split(';');
      
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
        
        // Delete all Supabase related cookies
        if (name.includes('sb-') || name.includes('supabase-auth')) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
        }
      }
      
      // Clear localStorage
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('supabase.auth.refreshToken');
      localStorage.removeItem('supabase-auth-token');

      // Also call the API to ensure server-side cookies are cleared
      await fetch('/api/auth/fix-cookies');
      
      // Wait a moment then reload the page
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
    } catch (error) {
      console.error('Error fixing cookies:', error);
      // If the API fails, still try to redirect
      window.location.href = '/login';
    } finally {
      setIsFixing(false);
    }
  };

  if (!hasError) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Authentication Error</AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          We detected an issue with your authentication or price data. This can happen due to corrupted cookies or session data.
        </p>
        <Button 
          onClick={handleFixCookies} 
          disabled={isFixing}
          size="sm"
          variant="outline"
        >
          {isFixing ? 'Fixing...' : 'Fix & Login Again'}
        </Button>
      </AlertDescription>
    </Alert>
  );
} 