'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TradingPage() {
  const router = useRouter();

  useEffect(() => {
    // Simple redirect to exchange without causing cycles
    router.replace('/exchange');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
}