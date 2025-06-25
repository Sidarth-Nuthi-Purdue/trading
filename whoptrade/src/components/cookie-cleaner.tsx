'use client';

import { useEffect } from 'react';

export function CookieCleaner() {
  useEffect(() => {
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

    clearBrowserCookies();
  }, []);

  return null; // This component doesn't render anything
}