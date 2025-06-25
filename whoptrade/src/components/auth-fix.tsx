'use client';

import { useEffect } from 'react';

export default function AuthFix() {
  useEffect(() => {
    // Fix common auth issues
    const fixAuthIssues = () => {
      // Clear any stale auth state
      if (typeof window !== 'undefined') {
        // Clear localStorage auth items
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('auth')) {
            localStorage.removeItem(key);
          }
        });
        
        // Clear sessionStorage auth items
        Object.keys(sessionStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('auth')) {
            sessionStorage.removeItem(key);
          }
        });
      }
    };

    fixAuthIssues();
  }, []);

  return null; // This component doesn't render anything
}