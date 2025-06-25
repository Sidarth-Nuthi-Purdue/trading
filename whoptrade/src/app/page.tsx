'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function HomePage() {
  const router = useRouter();
  
  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        // Create Supabase client
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        
        // Check if user is logged in
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // User is logged in, redirect to dashboard
          router.push('/dashboard/trading');
        } else {
          // User is not logged in, redirect to login
          router.push('/login');
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        // On error, redirect to login
        router.push('/login');
      }
    };
    
    checkAuthAndRedirect();
  }, [router]);
  
  // Loading state while checking auth
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <h1 className="text-xl font-medium text-white">Loading WhopTrade...</h1>
      </div>
    </div>
  );
}
