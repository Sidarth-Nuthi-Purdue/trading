'use client';

import { useRouter } from 'next/navigation';

export default function TradingPage() {
  const router = useRouter();

  // Temporarily disable auto-redirect to stop the cycle
  // useEffect(() => {
  //   router.replace('/exchange');
  // }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="text-center text-white">
        <h1 className="text-2xl font-bold mb-4">Trading Page</h1>
        <p className="mb-4">Redirect temporarily disabled to fix cycling issue</p>
        <button 
          onClick={() => router.push('/exchange')}
          className="bg-blue-600 px-6 py-2 rounded hover:bg-blue-700"
        >
          Go to Exchange
        </button>
      </div>
    </div>
  );
}