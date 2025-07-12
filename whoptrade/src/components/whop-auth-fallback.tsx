'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function WhopAuthFallback() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleDirectAuth = async () => {
    if (!token.trim()) {
      setError('Please enter your Whop access token');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/auth/whop-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ whopToken: token.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Authentication successful! Redirecting...');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = () => {
    window.location.href = '/api/oauth/init?next=/dashboard';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <Card className="w-full max-w-md bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-center text-white">Whop Authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="oauth" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-800">
              <TabsTrigger value="oauth" className="data-[state=active]:bg-gray-700">OAuth Login</TabsTrigger>
              <TabsTrigger value="direct" className="data-[state=active]:bg-gray-700">Direct Token</TabsTrigger>
            </TabsList>
            
            <TabsContent value="oauth" className="space-y-4">
              <div className="space-y-4">
                <p className="text-sm text-gray-400 text-center">
                  Use Whop OAuth for secure authentication
                </p>
                <Button 
                  onClick={handleOAuthLogin}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Login with Whop OAuth
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="direct" className="space-y-4">
              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  If OAuth isn't working, enter your Whop access token directly:
                </p>
                
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="Enter Whop access token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                  <div className="text-xs text-gray-500">
                    Get your token from the Whop dashboard or browser developer tools
                  </div>
                </div>

                <Button 
                  onClick={handleDirectAuth}
                  disabled={loading || !token.trim()}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {loading ? 'Authenticating...' : 'Authenticate'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <Alert className="mt-4 border-red-700 bg-red-900/20">
              <AlertDescription className="text-red-400">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mt-4 border-green-700 bg-green-900/20">
              <AlertDescription className="text-green-400">{success}</AlertDescription>
            </Alert>
          )}

          <div className="mt-6 space-y-2 text-xs text-gray-500">
            <p><strong>OAuth not working?</strong></p>
            <ul className="space-y-1 ml-4">
              <li>• Check if OAuth is enabled in your Whop app settings</li>
              <li>• Verify redirect URI is configured: <code>http://localhost:56231/api/oauth/callback</code></li>
              <li>• Use the direct token method as a fallback</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}