'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setCookie, hasWhopAuthToken } from '@/lib/cookie-utils';

interface ExperienceData {
  id: string;
  name: string;
  description: string;
}

// Define allowed origins for postMessage
const ALLOWED_ORIGINS = [
  'https://whop.com',
  'https://aknm85dzxutr9tpxryi2.apps.whop.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002'
];

export default function ExperiencePage({ 
  params
}: { 
  params: Promise<{ experienceId: string }>
}) {
  // Use the React.use function to unwrap the params Promise
  const { experienceId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [experience, setExperience] = useState<ExperienceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWhopUser, setIsWhopUser] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  
  // Get the whop-dev-user-token from the search params hook - the safe way
  const whopDevUserToken = searchParams ? searchParams.get('whop-dev-user-token') : null;
  const storeMode = searchParams ? searchParams.get('store') === 'true' : false;

  useEffect(() => {
    if (!experienceId) return; // Skip if experienceId isn't set yet

    // Set a cookie for the whop-dev-user-token if it exists
    if (whopDevUserToken) {
      console.log('Setting whop_dev_user_token cookie:', whopDevUserToken.substring(0, 20) + '...');
      // Use our cookie utility to set the token
      setCookie('whop_dev_user_token', whopDevUserToken, {
        path: '/',
        maxAge: 3600,
        secure: false, // For local development
        sameSite: 'lax'
      });

      // Also set the whop user state
      setIsWhopUser(true);
    } else {
      // Check if we already have a token in cookies
      setIsWhopUser(hasWhopAuthToken());
    }
    
    // Check if running in an iframe
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      // If we can't access window.top due to security restrictions,
      // we're definitely in an iframe from another domain
      setIsInIframe(true);
    }

    // Handle communication with parent window
    function handleMessage(event: MessageEvent) {
      // Verify the origin is allowed
      if (!ALLOWED_ORIGINS.some(origin => event.origin.includes(origin))) {
        console.warn('Message received from unauthorized origin:', event.origin);
        return;
      }

      console.log('Received message from parent:', event.data);
      
      // Handle specific message types
      if (event.data.type === 'navigate') {
        router.push(event.data.path);
      }

      // Handle auth token if provided
      if (event.data.token) {
        console.log('Received token from parent');
        setCookie('whop_dev_user_token', event.data.token, {
          path: '/',
          maxAge: 3600,
          secure: false,
          sameSite: 'lax'
        });
        setIsWhopUser(true);
      }
    }

    // Add message event listener
    window.addEventListener('message', handleMessage);
    
    // If in an iframe and we have a token, send confirmation to parent window
    if (isInIframe && whopDevUserToken) {
      try {
        // Safely try to communicate with parent window
        window.parent.postMessage({ 
          type: 'EXPERIENCE_LOADED', 
          experienceId,
          authenticated: true
        }, '*'); // Using * as a fallback, though not ideal for security
      } catch (e) {
        console.error('Failed to send message to parent window:', e);
      }
    }

    async function loadExperience() {
      try {
        setLoading(true);
        
        // For demo purposes, we're creating a mock experience
        // In a real app, you'd fetch this from Whop's API using the token
        const mockExperience = {
          id: experienceId,
          name: `Experience ${experienceId}`,
          description: 'This is a Whop experience integration demo.'
        };
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setExperience(mockExperience);
        setLoading(false);
        
        // Log token for debugging (remove in production)
        if (whopDevUserToken) {
          console.log('Received Whop Dev User Token:', whopDevUserToken.substring(0, 20) + '...');
        }
        
        // If in store mode, redirect to dashboard after a delay
        if (storeMode) {
          setTimeout(() => {
            router.push('/dashboard');
          }, 1500);
        }
      } catch (err) {
        console.error('Error loading experience:', err);
        setError('Failed to load experience data');
        setLoading(false);
      }
    }
    
    loadExperience();

    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [experienceId, whopDevUserToken, storeMode, router, isInIframe]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Loading Experience...</h2>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center bg-red-50 p-6 rounded-lg max-w-md">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  if (storeMode) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Experience Loaded</h2>
          <p>Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 relative">
      {/* Login button at top right */}
      <div className="absolute top-4 right-4">
        {isWhopUser ? (
          <div className="flex items-center">
            <span className="text-green-600 text-sm mr-3">
              ✓ Authenticated via Whop
            </span>
            <button 
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-purple-600 text-white rounded-md font-medium hover:bg-purple-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <button 
            onClick={() => router.push('/api/oauth/init?next=/dashboard')}
            className="px-4 py-2 bg-purple-600 text-white rounded-md font-medium hover:bg-purple-700 transition-colors"
          >
            Login with Whop
          </button>
        )}
      </div>
      
      <div className="w-full max-w-4xl bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-2xl font-bold mb-4">Experience: {experience?.name}</h1>
        <p className="text-gray-600 mb-6">{experience?.description}</p>
        
        <div className="bg-gray-50 p-4 rounded border mb-6">
          <h3 className="font-semibold mb-2">Experience Details:</h3>
          <p className="text-sm"><span className="font-medium">ID:</span> {experience?.id}</p>
          <p className="text-sm"><span className="font-medium">Mode:</span> {storeMode ? 'Store Mode' : 'Direct Mode'}</p>
          <p className="text-sm"><span className="font-medium">Authentication:</span> {isWhopUser ? 'Authenticated' : 'Not Authenticated'}</p>
          {isInIframe && (
            <p className="text-sm mt-2 text-purple-600">
              <span className="font-medium">Display Context:</span> Running in Whop iframe
            </p>
          )}
        </div>
        
        <div className="flex flex-col gap-2">
          <button 
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
} 