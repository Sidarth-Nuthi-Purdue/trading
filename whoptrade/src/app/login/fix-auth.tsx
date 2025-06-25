'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// Clear problematic cookies
const clearAuthCookies = () => {
  if (typeof document === 'undefined') return;
  
  // Get all cookies
  const cookies = document.cookie.split(';');
  
  // Log all cookies
  console.log('Current cookies:', cookies);
  
  // Find Supabase auth cookies
  cookies.forEach(cookie => {
    const name = cookie.split('=')[0].trim();
    // Match Supabase auth cookies
    if (name.includes('sb-') || name.includes('supabase-auth')) {
      // Clear the cookie
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax;`;
      console.log(`Cleared auth cookie: ${name}`);
    }
  });
};

export default function FixAuth() {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  const handleFixAuth = () => {
    try {
      setMessage('Clearing authentication cookies...');
      clearAuthCookies();
      
      setStatus('success');
      setMessage('Authentication cookies cleared successfully. Please try logging in again.');
      
      // Redirect to login page after a delay
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (error) {
      setStatus('error');
      setMessage(`Error clearing cookies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  const handleReload = () => {
    window.location.reload();
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Fix Authentication Issues</CardTitle>
        <CardDescription>
          Use this tool to fix issues with authentication cookies that may be preventing you from logging in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-4">
          If you&apos;re experiencing login issues, corrupted cookies might be the cause. 
          Click the button below to clear all authentication cookies and start fresh.
        </p>
        
        {message && (
          <div 
            className={`p-3 rounded-md text-sm mb-4 ${
              status === 'success' ? 'bg-green-100 text-green-700' : 
              status === 'error' ? 'bg-red-100 text-red-700' : 
              'bg-blue-100 text-blue-700'
            }`}
          >
            {message}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleReload}>
          Reload Page
        </Button>
        <Button onClick={handleFixAuth}>
          Clear Auth Cookies
        </Button>
      </CardFooter>
    </Card>
  );
} 